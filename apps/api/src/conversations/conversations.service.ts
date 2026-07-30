import { Injectable } from "@nestjs/common";
import { NotificationKind } from "../generated/prisma/client.js";
import { badRequest, forbidden, notFound } from "../lib/errors.js";
import { assertOwnedObjectKey } from "../lib/owned-keys.js";
import {
  messagePreviewText,
  profileName,
  serializeConversationInbox,
  serializeMessage,
} from "../lib/serializers.js";
import { PrismaService } from "../prisma/prisma.service.js";
import type { ConversationListQueryDto, SendConversationMessageDto } from "./conversations.dto.js";

@Injectable()
export class ConversationsService {
  constructor(private readonly prisma: PrismaService) {}

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
    const memberships = await this.prisma.conversationParticipant.findMany({
      where: { userId, isArchived: query.archived === "true" },
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
    data.sort((first, second) => {
      if (first.isPinned !== second.isPinned) return first.isPinned ? -1 : 1;
      return new Date(second.updatedAt).getTime() - new Date(first.updatedAt).getTime();
    });
    return {
      data,
      meta: { unreadCount: data.reduce((sum, conversation) => sum + conversation.unreadCount, 0) },
    };
  }

  async archive(conversationId: string, userId: string, isArchived: boolean) {
    await this.requireMembership(conversationId, userId);
    const updated = await this.prisma.conversationParticipant.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: { isArchived },
    });
    return { id: conversationId, isArchived: updated.isArchived };
  }

  async pin(conversationId: string, userId: string, isPinned: boolean) {
    await this.requireMembership(conversationId, userId);
    const updated = await this.prisma.conversationParticipant.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: { isPinned },
    });
    return { id: conversationId, isPinned: updated.isPinned };
  }

  async messages(conversationId: string, userId: string) {
    await this.requireMembership(conversationId, userId);
    const [messages, readStates] = await Promise.all([
      this.prisma.message.findMany({
        where: { conversationId },
        include: { sender: true },
        orderBy: { createdAt: "asc" },
      }),
      this.prisma.conversationParticipant.findMany({
        where: { conversationId },
        select: { userId: true, lastReadAt: true },
      }),
    ]);
    await this.prisma.conversationParticipant.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: { lastReadAt: new Date() },
    });
    return messages.map((message) => serializeMessage(message, userId, readStates));
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

    const recipientId = conversation.participants.find(
      (participant) => participant.userId !== userId,
    )?.userId;
    if (recipientId) {
      const previewRaw = messagePreviewText(message);
      const preview =
        previewRaw.length > 120
          ? `${previewRaw.slice(0, 117)}...`
          : previewRaw || "Sent an attachment";
      await this.prisma.notification.create({
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
    }
    return serializeMessage(message, userId, conversation.participants);
  }

  async read(conversationId: string, userId: string) {
    await this.requireMembership(conversationId, userId);
    await this.prisma.conversationParticipant.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: { lastReadAt: new Date() },
    });
    return { ok: true };
  }
}
