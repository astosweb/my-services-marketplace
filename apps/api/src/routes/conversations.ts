import { Hono } from "hono";
import { z } from "zod";
import { NotificationKind } from "../generated/prisma/client.js";
import { forbidden, notFound } from "../lib/errors.js";
import { assertOwnedObjectKey } from "../lib/owned-keys.js";
import { prisma } from "../lib/prisma.js";
import {
  messagePreviewText,
  serializeConversationInbox,
  serializeMessage,
} from "../lib/serializers.js";
import { parseOrThrow } from "../lib/validate.js";
import type { AuthVariables } from "../middleware/auth.js";
import { requireAuth } from "../middleware/auth.js";

const sendMessageSchema = z
  .object({
    body: z.string().max(5000).optional(),
    attachmentKey: z.string().min(1).optional(),
    attachmentName: z.string().max(255).optional(),
    attachmentMimeType: z.string().max(100).optional(),
  })
  .refine((data) => (data.body?.trim().length ?? 0) > 0 || Boolean(data.attachmentKey), {
    message: "Message must include text or an attachment",
  });

const listQuerySchema = z.object({
  archived: z.enum(["true", "false"]).optional(),
});

const updateArchiveSchema = z.object({
  isArchived: z.boolean(),
});

const updatePinSchema = z.object({
  isPinned: z.boolean(),
});

export const conversationRoutes = new Hono<{ Variables: AuthVariables }>();

conversationRoutes.use("*", requireAuth);

async function getMembership(conversationId: string, userId: string) {
  return prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
  });
}

conversationRoutes.get("/", async (c) => {
  const userId = c.get("userId");
  const parsed = parseOrThrow(listQuerySchema, c.req.query());
  const isArchived = parsed.archived === "true";

  const memberships = await prisma.conversationParticipant.findMany({
    where: { userId, isArchived },
    include: {
      conversation: {
        include: {
          request: { include: { category: true, owner: true } },
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
            include: { sender: true },
          },
          participants: { include: { user: true } },
        },
      },
    },
    orderBy: { conversation: { updatedAt: "desc" } },
  });

  const data = await Promise.all(
    memberships.map(async (membership) => {
      const { conversation } = membership;
      const readSince = membership.lastReadAt ?? new Date(0);
      const unreadCount = await prisma.message.count({
        where: {
          conversationId: conversation.id,
          senderId: { not: userId },
          createdAt: { gt: readSince },
        },
      });
      return serializeConversationInbox(conversation, membership, userId, unreadCount);
    }),
  );

  data.sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  const unreadCount = data.reduce((sum, row) => sum + row.unreadCount, 0);

  return c.json({ data, meta: { unreadCount } });
});

conversationRoutes.patch("/:id/archive", async (c) => {
  const userId = c.get("userId");
  const conversationId = c.req.param("id");

  const parsed = parseOrThrow(updateArchiveSchema, await c.req.json());

  const membership = await getMembership(conversationId, userId);
  if (!membership) throw forbidden("You do not have access to this conversation");

  const updated = await prisma.conversationParticipant.update({
    where: { conversationId_userId: { conversationId, userId } },
    data: { isArchived: parsed.isArchived },
  });

  return c.json({ data: { id: conversationId, isArchived: updated.isArchived } });
});

conversationRoutes.patch("/:id/pin", async (c) => {
  const userId = c.get("userId");
  const conversationId = c.req.param("id");

  const parsed = parseOrThrow(updatePinSchema, await c.req.json());

  const membership = await getMembership(conversationId, userId);
  if (!membership) throw forbidden("You do not have access to this conversation");

  const updated = await prisma.conversationParticipant.update({
    where: { conversationId_userId: { conversationId, userId } },
    data: { isPinned: parsed.isPinned },
  });

  return c.json({ data: { id: conversationId, isPinned: updated.isPinned } });
});

conversationRoutes.get("/:id/messages", async (c) => {
  const userId = c.get("userId");
  const conversationId = c.req.param("id");

  const membership = await getMembership(conversationId, userId);
  if (!membership) throw forbidden("You do not have access to this conversation");

  const messages = await prisma.message.findMany({
    where: { conversationId },
    include: { sender: true },
    orderBy: { createdAt: "asc" },
  });
  const readStates = await prisma.conversationParticipant.findMany({
    where: { conversationId },
    select: { userId: true, lastReadAt: true },
  });

  await prisma.conversationParticipant.update({
    where: { conversationId_userId: { conversationId, userId } },
    data: { lastReadAt: new Date() },
  });

  return c.json({ data: messages.map((message) => serializeMessage(message, userId, readStates)) });
});

conversationRoutes.post("/:id/messages", async (c) => {
  const userId = c.get("userId");
  const conversationId = c.req.param("id");

  const parsed = parseOrThrow(sendMessageSchema, await c.req.json());

  const membership = await getMembership(conversationId, userId);
  if (!membership) throw forbidden("You do not have access to this conversation");

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      request: { select: { id: true, title: true, ownerId: true } },
      participants: { select: { userId: true, lastReadAt: true } },
    },
  });
  if (!conversation) throw notFound("Conversation not found");

  if (parsed.attachmentKey) {
    assertOwnedObjectKey(parsed.attachmentKey, userId, "messages");
  }

  const bodyText = parsed.body?.trim() ?? "";

  const message = await prisma.message.create({
    data: {
      conversationId,
      senderId: userId,
      body: bodyText,
      attachmentKey: parsed.attachmentKey,
      attachmentName: parsed.attachmentName,
      attachmentMimeType: parsed.attachmentMimeType,
    },
    include: { sender: true },
  });

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  });

  await prisma.conversationParticipant.update({
    where: { conversationId_userId: { conversationId, userId } },
    data: { lastReadAt: new Date() },
  });

  const recipientId = conversation.participants.find((p) => p.userId !== userId)?.userId;
  if (recipientId) {
    const previewRaw = messagePreviewText(message);
    const preview =
      previewRaw.length > 120
        ? `${previewRaw.slice(0, 117)}...`
        : previewRaw || "Sent an attachment";
    await prisma.notification.create({
      data: {
        userId: recipientId,
        kind: NotificationKind.NEW_MESSAGE,
        title: `${message.sender.displayName} sent you a message`,
        body: preview,
        contextTag: conversation.request.title,
        payload: {
          requestId: conversation.requestId,
          conversationId,
          messageId: message.id,
        },
      },
    });
  }

  return c.json({ data: serializeMessage(message, userId, conversation.participants) }, 201);
});

conversationRoutes.post("/:id/read", async (c) => {
  const userId = c.get("userId");
  const conversationId = c.req.param("id");

  const membership = await getMembership(conversationId, userId);
  if (!membership) throw forbidden("You do not have access to this conversation");

  await prisma.conversationParticipant.update({
    where: { conversationId_userId: { conversationId, userId } },
    data: { lastReadAt: new Date() },
  });

  return c.json({ data: { ok: true } });
});
