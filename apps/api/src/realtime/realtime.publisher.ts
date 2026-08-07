import { Injectable, Logger } from "@nestjs/common";
import type { Server, Socket } from "socket.io";
import {
  ADMIN_MODERATION_ROOM,
  ADMIN_ROOM,
  ADMIN_SUPPORT_ROOM,
  conversationRoom,
  createRealtimeEnvelope,
  RealtimeServerEvent,
  requestRoom,
  supportRoom,
  type RealtimeServerEventName,
  type UnreadUpdatedPayload,
  userRoom,
} from "./realtime.constants.js";

/**
 * Central fan-out for realtime events. REST/service layers call this publisher
 * after durable writes so Socket.IO handlers never duplicate business logic.
 */
@Injectable()
export class RealtimePublisher {
  private readonly logger = new Logger(RealtimePublisher.name);
  private server: Server | null = null;

  attachServer(server: Server) {
    this.server = server;
    this.logger.log("Realtime publisher attached to Socket.IO server");
  }

  isReady() {
    return this.server !== null;
  }

  private room(room: string) {
    if (!this.server) {
      this.logger.debug(`Dropping realtime event (no server): room=${room}`);
      return null;
    }
    return this.server.to(room);
  }

  emitToRoom(room: string, event: RealtimeServerEventName | string, data: Record<string, unknown>) {
    const target = this.room(room);
    if (!target) return;
    const envelope = createRealtimeEnvelope(event, data);
    target.emit(event, envelope);
    this.logger.debug(`emit ${event} → ${room}`);
  }

  emitToUser(userId: string, event: RealtimeServerEventName | string, data: Record<string, unknown>) {
    this.emitToRoom(userRoom(userId), event, data);
  }

  emitToUsers(userIds: string[], event: RealtimeServerEventName | string, data: Record<string, unknown>) {
    const unique = [...new Set(userIds)].filter(Boolean);
    for (const userId of unique) this.emitToUser(userId, event, data);
  }

  emitToConversation(conversationId: string, event: RealtimeServerEventName | string, data: Record<string, unknown>) {
    this.emitToRoom(conversationRoom(conversationId), event, data);
  }

  emitToRequest(requestId: string, event: RealtimeServerEventName | string, data: Record<string, unknown>) {
    this.emitToRoom(requestRoom(requestId), event, data);
  }

  emitToSupport(ticketId: string, event: RealtimeServerEventName | string, data: Record<string, unknown>) {
    this.emitToRoom(supportRoom(ticketId), event, data);
  }

  emitToAdmins(event: RealtimeServerEventName | string, data: Record<string, unknown>) {
    this.emitToRoom(ADMIN_ROOM, event, data);
  }

  emitToAdminModeration(event: RealtimeServerEventName | string, data: Record<string, unknown>) {
    this.emitToRoom(ADMIN_MODERATION_ROOM, event, data);
  }

  emitToAdminSupport(event: RealtimeServerEventName | string, data: Record<string, unknown>) {
    this.emitToRoom(ADMIN_SUPPORT_ROOM, event, data);
  }

  messageCreated(input: {
    conversationId: string;
    participantIds: string[];
    message: Record<string, unknown>;
  }) {
    this.emitToConversation(input.conversationId, RealtimeServerEvent.MESSAGE_CREATED, {
      conversationId: input.conversationId,
      message: input.message,
    });
    this.emitToUsers(input.participantIds, RealtimeServerEvent.CONVERSATION_UPDATED, {
      conversationId: input.conversationId,
      reason: "message.created",
      message: input.message,
    });
  }

  messageRead(input: {
    conversationId: string;
    readerId: string;
    participantIds: string[];
    readAt: string;
  }) {
    this.emitToConversation(input.conversationId, RealtimeServerEvent.MESSAGE_READ, {
      conversationId: input.conversationId,
      readerId: input.readerId,
      readAt: input.readAt,
    });
    this.emitToUsers(input.participantIds, RealtimeServerEvent.MESSAGE_READ, {
      conversationId: input.conversationId,
      readerId: input.readerId,
      readAt: input.readAt,
    });
  }

  messageDelivered(input: {
    conversationId: string;
    messageId: string;
    userId: string;
  }) {
    this.emitToConversation(input.conversationId, RealtimeServerEvent.MESSAGE_DELIVERED, input);
  }

  unreadUpdated(userId: string, payload: UnreadUpdatedPayload) {
    this.emitToUser(userId, RealtimeServerEvent.UNREAD_UPDATED, payload);
  }

  typingUpdate(input: {
    room: string;
    userId: string;
    displayName?: string;
    isTyping: boolean;
  }) {
    this.emitToRoom(input.room, RealtimeServerEvent.TYPING_UPDATE, input);
  }

  supportTyping(input: {
    ticketId: string;
    userId: string;
    displayName?: string;
    isTyping: boolean;
  }) {
    this.emitToSupport(input.ticketId, RealtimeServerEvent.SUPPORT_TYPING, input);
    this.emitToAdminSupport(RealtimeServerEvent.SUPPORT_TYPING, input);
  }

  presenceUpdate(input: {
    userId: string;
    status: "online" | "offline";
    lastSeenAt?: string | null;
    notifyUserIds?: string[];
  }) {
    const payload = {
      userId: input.userId,
      status: input.status,
      lastSeenAt: input.lastSeenAt ?? null,
    };
    if (input.notifyUserIds?.length) {
      this.emitToUsers(input.notifyUserIds, RealtimeServerEvent.PRESENCE_UPDATE, payload);
    } else {
      this.emitToUser(input.userId, RealtimeServerEvent.PRESENCE_UPDATE, payload);
    }
  }

  notificationCreated(userId: string, notification: Record<string, unknown>) {
    this.emitToUser(userId, RealtimeServerEvent.NOTIFICATION_CREATED, { notification });
  }

  notificationsCreated(userIds: string[], notification: Omit<Record<string, unknown>, "id"> & { kind: string }) {
    for (const userId of userIds) {
      this.emitToUser(userId, RealtimeServerEvent.NOTIFICATION_CREATED, {
        notification: { ...notification, userId },
      });
    }
  }

  offerCreated(input: {
    requestId: string;
    ownerId: string;
    providerId: string;
    offer: Record<string, unknown>;
  }) {
    // User rooms only — request rooms may include competing offerers.
    this.emitToUser(input.ownerId, RealtimeServerEvent.OFFER_CREATED, input);
    this.emitToUser(input.providerId, RealtimeServerEvent.OFFER_CREATED, input);
  }

  offerUpdated(input: {
    requestId: string;
    ownerId: string;
    providerId: string;
    offer: Record<string, unknown>;
  }) {
    this.emitToUsers([input.ownerId, input.providerId], RealtimeServerEvent.OFFER_UPDATED, input);
  }

  requestUpdated(input: {
    requestId: string;
    ownerId: string;
    interestedUserIds?: string[];
    request: Record<string, unknown>;
    reason?: string;
  }) {
    this.emitToRequest(input.requestId, RealtimeServerEvent.REQUEST_UPDATED, input);
    this.emitToUser(input.ownerId, RealtimeServerEvent.REQUEST_UPDATED, input);
    if (input.interestedUserIds?.length) {
      this.emitToUsers(input.interestedUserIds, RealtimeServerEvent.REQUEST_UPDATED, input);
    }
  }

  requestModeration(input: {
    requestId: string;
    ownerId: string;
    status: string;
    reason?: string | null;
  }) {
    this.emitToUser(input.ownerId, RealtimeServerEvent.REQUEST_MODERATION, input);
    this.emitToAdminModeration(RealtimeServerEvent.REQUEST_MODERATION, input);
    this.emitToAdmins(RealtimeServerEvent.ADMIN_MODERATION, {
      type: "request",
      ...input,
    });
  }

  jobProgress(input: {
    requestId: string;
    ownerId: string;
    providerId?: string | null;
    progress: Record<string, unknown>;
  }) {
    this.emitToRequest(input.requestId, RealtimeServerEvent.JOB_PROGRESS, input);
    const users = [input.ownerId, input.providerId].filter(Boolean) as string[];
    this.emitToUsers(users, RealtimeServerEvent.JOB_PROGRESS, input);
  }

  supportTicketUpdated(input: {
    ticketId: string;
    userId: string;
    assigneeId?: string | null;
    ticket: Record<string, unknown>;
  }) {
    this.emitToSupport(input.ticketId, RealtimeServerEvent.SUPPORT_TICKET_UPDATED, input);
    this.emitToUser(input.userId, RealtimeServerEvent.SUPPORT_TICKET_UPDATED, input);
    if (input.assigneeId) {
      this.emitToUser(input.assigneeId, RealtimeServerEvent.SUPPORT_TICKET_UPDATED, input);
    }
    this.emitToAdminSupport(RealtimeServerEvent.SUPPORT_TICKET_UPDATED, input);
  }

  supportMessageCreated(input: {
    ticketId: string;
    userId: string;
    assigneeId?: string | null;
    message: Record<string, unknown>;
  }) {
    this.emitToSupport(input.ticketId, RealtimeServerEvent.SUPPORT_MESSAGE_CREATED, input);
    this.emitToUser(input.userId, RealtimeServerEvent.SUPPORT_MESSAGE_CREATED, input);
    if (input.assigneeId) {
      this.emitToUser(input.assigneeId, RealtimeServerEvent.SUPPORT_MESSAGE_CREATED, input);
    }
    this.emitToAdminSupport(RealtimeServerEvent.SUPPORT_MESSAGE_CREATED, input);
  }

  adminStats(data: Record<string, unknown>) {
    this.emitToAdmins(RealtimeServerEvent.ADMIN_STATS, data);
  }

  paymentUpdated(input: {
    userIds: string[];
    payment: Record<string, unknown>;
  }) {
    this.emitToUsers(input.userIds, RealtimeServerEvent.PAYMENT_UPDATED, input);
  }

  emitToSocket(socket: Socket, event: RealtimeServerEventName | string, data: Record<string, unknown>) {
    socket.emit(event, createRealtimeEnvelope(event, data));
  }
}
