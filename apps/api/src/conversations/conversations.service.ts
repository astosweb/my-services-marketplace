import { Injectable } from "@nestjs/common";
import { NotificationKind } from "../generated/prisma/client.js";
import { badRequest, forbidden, notFound } from "../lib/errors.js";
import { assertOwnedObjectKey } from "../lib/owned-keys.js";
import {
  messagePreviewText,
  profileName,
  serializeConversationInbox,
  serializeMessage,
  serializeNotification,
} from "../lib/serializers.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { RealtimePublisher } from "../realtime/realtime.publisher.js";
import type { ConversationListQueryDto, SendConversationMessageDto } from "./conversations.dto.js";

@Injectable()
export class ConversationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimePublisher,
  ) {}

  private getMembership(conversationId: string, userId: string) {
    return this.prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
  }

  private async requireMembership(conversationId: string, userId: string) {
    const membership = await this.getMembership(conversationId, userId);
    if (!membership) throw forbidden("You do not have access to this conversation");
    return membership;
  }

  async list(userId: string, query: ConversationListQueryDto) {
    const where = { userId, isArchived: query.archived === "true" };
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;

    const [memberships, total] = await Promise.all([
      this.prisma.conversationParticipant.findMany({
        where,
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
        orderBy: [{ isPinned: "desc" }, { conversation: { updatedAt: "desc" } }],
        take: limit,
        skip: offset,
      }),
      this.prisma.conversationParticipant.count({ where }),
    ]);

    const unreadMessages =
      memberships.length === 0
        ? []
        : await this.prisma.message.findMany({
            where: {
              senderId: { not: userId },
              OR: memberships.map((membership) => ({
                conversationId: membership.conversationId,
                createdAt: { gt: membership.lastReadAt ?? new Date(0) },
              })),
            },
            select: { conversationId: true },
          });
    const unreadByConversation = unreadMessages.reduce((counts, message) => {
      counts.set(message.conversationId, (counts.get(message.conversationId) ?? 0) + 1);
      return counts;
    }, new Map<string, number>());

    const data = memberships.map((membership) =>
      serializeConversationInbox(
        membership.conversation,
        membership,
        userId,
        unreadByConversation.get(membership.conversationId) ?? 0,
      ),
    );

    const unreadWhere = {
      userId,
      isArchived: false,
    };
    const allActive = await this.prisma.conversationParticipant.findMany({
      where: unreadWhere,
      select: { conversationId: true, lastReadAt: true },
    });
    const globalUnread =
      allActive.length === 0
        ? 0
        : await this.prisma.message.count({
            where: {
              senderId: { not: userId },
              OR: allActive.map((membership) => ({
                conversationId: membership.conversationId,
                createdAt: { gt: membership.lastReadAt ?? new Date(0) },
              })),
            },
          });

    return {
      data,
      meta: {
        total,
        limit,
        offset,
        unreadCount: globalUnread,
      },
    };
  }

  async archive(conversationId: string, userId: string, isArchived: boolean) {
    await this.requireMembership(conversationId, userId);
    const updated = await this.prisma.conversationParticipant.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: { isArchived },
    });
    this.realtime.emitToUser(userId, "conversation.updated", {
      conversationId,
      reason: isArchived ? "archived" : "unarchived",
      isArchived: updated.isArchived,
    });
    return { id: conversationId, isArchived: updated.isArchived };
  }

  async pin(conversationId: string, userId: string, isPinned: boolean) {
    await this.requireMembership(conversationId, userId);
    const updated = await this.prisma.conversationParticipant.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: { isPinned },
    });
    this.realtime.emitToUser(userId, "conversation.updated", {
      conversationId,
      reason: isPinned ? "pinned" : "unpinned",
      isPinned: updated.isPinned,
    });
    return { id: conversationId, isPinned: updated.isPinned };
  }

  async messages(conversationId: string, userId: string, limit = 100) {
    await this.requireMembership(conversationId, userId);
    const take = Math.min(Math.max(limit, 1), 200);
    const [messages, readStates] = await Promise.all([
      this.prisma.message.findMany({
        where: { conversationId },
        include: { sender: true },
        orderBy: { createdAt: "desc" },
        take,
      }),
      this.prisma.conversationParticipant.findMany({
        where: { conversationId },
        select: { userId: true, lastReadAt: true },
      }),
    ]);
    const readAt = new Date();
    await this.prisma.conversationParticipant.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: { lastReadAt: readAt },
    });
    this.realtime.messageRead({
      conversationId,
      readerId: userId,
      participantIds: readStates.map((state) => state.userId),
      readAt: readAt.toISOString(),
    });
    this.realtime.unreadUpdated(userId, {
      conversationId,
      conversationUnread: 0,
    });
    return [...messages].reverse().map((message) => serializeMessage(message, userId, readStates));
  }

  async send(conversationId: string, userId: string, data: SendConversationMessageDto) {
    if (!(data.body?.trim().length || data.attachmentKey)) {
      throw badRequest("Message must include text or an attachment");
    }
    await this.requireMembership(conversationId, userId);
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        request: { select: { id: true, title: true, ownerId: true } },
        participants: { select: { userId: true, lastReadAt: true } },
      },
    });
    if (!conversation) throw notFound("Conversation not found");
    if (data.attachmentKey) assertOwnedObjectKey(data.attachmentKey, userId, "messages");

    const now = new Date();
    const message = await this.prisma.$transaction(async (transaction) => {
      const created = await transaction.message.create({
        data: {
          conversationId,
          senderId: userId,
          body: data.body?.trim() ?? "",
          attachmentKey: data.attachmentKey,
          attachmentName: data.attachmentName,
          attachmentMimeType: data.attachmentMimeType,
        },
        include: { sender: true },
      });
      await transaction.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: now },
      });
      await transaction.conversationParticipant.update({
        where: { conversationId_userId: { conversationId, userId } },
        data: { lastReadAt: now },
      });
      return created;
    });

    const participantIds = conversation.participants.map((participant) => participant.userId);
    const serialized = serializeMessage(message, userId, conversation.participants);
    this.realtime.messageCreated({
      conversationId,
      participantIds,
      message: serialized as unknown as Record<string, unknown>,
    });

    const recipientId = conversation.participants.find(
      (participant) => participant.userId !== userId,
    )?.userId;
    if (recipientId) {
      const previewRaw = messagePreviewText(message);
      const preview =
        previewRaw.length > 120
          ? `${previewRaw.slice(0, 117)}...`
          : previewRaw || "Sent an attachment";
      const notification = await this.prisma.notification.create({
        data: {
          userId: recipientId,
          kind: NotificationKind.NEW_MESSAGE,
          title: `${profileName(message.sender)} sent you a message`,
          body: preview,
          contextTag: conversation.request.title,
          payload: {
            requestId: conversation.requestId,
            conversationId,
            messageId: message.id,
          },
        },
      });
      this.realtime.notificationCreated(
        recipientId,
        serializeNotification(notification) as unknown as Record<string, unknown>,
      );
      this.realtime.unreadUpdated(recipientId, {
        conversationId,
      });
    }
    return serialized;
  }

  async read(conversationId: string, userId: string) {
    await this.requireMembership(conversationId, userId);
    const readAt = new Date();
    await this.prisma.conversationParticipant.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: { lastReadAt: readAt },
    });
    const participants = await this.prisma.conversationParticipant.findMany({
      where: { conversationId },
      select: { userId: true },
    });
    this.realtime.messageRead({
      conversationId,
      readerId: userId,
      participantIds: participants.map((participant) => participant.userId),
      readAt: readAt.toISOString(),
    });
    this.realtime.unreadUpdated(userId, {
      conversationId,
      conversationUnread: 0,
    });
    return { ok: true };
  }
}
