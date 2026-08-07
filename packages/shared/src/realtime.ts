import { z } from "zod";

/** Wire protocol version for all Socket.IO payloads. */
export const REALTIME_PROTOCOL_VERSION = 1 as const;

export const RealtimeServerEvent = {
  READY: "realtime.ready",
  ERROR: "realtime.error",
  MESSAGE_CREATED: "message.created",
  MESSAGE_UPDATED: "message.updated",
  MESSAGE_READ: "message.read",
  MESSAGE_DELIVERED: "message.delivered",
  CONVERSATION_UPDATED: "conversation.updated",
  UNREAD_UPDATED: "unread.updated",
  TYPING_UPDATE: "typing.update",
  PRESENCE_UPDATE: "presence.update",
  NOTIFICATION_CREATED: "notification.created",
  NOTIFICATION_UPDATED: "notification.updated",
  OFFER_CREATED: "offer.created",
  OFFER_UPDATED: "offer.updated",
  REQUEST_CREATED: "request.created",
  REQUEST_UPDATED: "request.updated",
  REQUEST_MODERATION: "request.moderation",
  JOB_PROGRESS: "job.progress",
  SUPPORT_TICKET_UPDATED: "support.ticket.updated",
  SUPPORT_MESSAGE_CREATED: "support.message.created",
  SUPPORT_TYPING: "support.typing",
  ADMIN_STATS: "admin.stats",
  ADMIN_MODERATION: "admin.moderation",
  PAYMENT_UPDATED: "payment.updated",
} as const;

export type RealtimeServerEventName =
  (typeof RealtimeServerEvent)[keyof typeof RealtimeServerEvent];

export const RealtimeClientEvent = {
  ROOM_JOIN: "room.join",
  ROOM_LEAVE: "room.leave",
  TYPING_UPDATE: "typing.update",
  PRESENCE_PING: "presence.ping",
  MESSAGE_DELIVERED: "message.delivered",
  MESSAGE_READ: "message.read",
} as const;

export type RealtimeClientEventName =
  (typeof RealtimeClientEvent)[keyof typeof RealtimeClientEvent];

export const realtimeRoomPrefix = {
  user: "user",
  conversation: "conversation",
  request: "request",
  support: "support",
  admin: "admin",
} as const;

export function userRoom(userId: string) {
  return `${realtimeRoomPrefix.user}:${userId}`;
}

export function conversationRoom(conversationId: string) {
  return `${realtimeRoomPrefix.conversation}:${conversationId}`;
}

export function requestRoom(requestId: string) {
  return `${realtimeRoomPrefix.request}:${requestId}`;
}

export function supportRoom(ticketId: string) {
  return `${realtimeRoomPrefix.support}:${ticketId}`;
}

export const ADMIN_ROOM = realtimeRoomPrefix.admin;
export const ADMIN_MODERATION_ROOM = `${realtimeRoomPrefix.admin}:moderation`;
export const ADMIN_SUPPORT_ROOM = `${realtimeRoomPrefix.admin}:support`;

const isoDateSchema = z.string().min(1);

export const realtimeEnvelopeSchema = z.object({
  v: z.literal(REALTIME_PROTOCOL_VERSION),
  event: z.string().min(1).max(80),
  ts: isoDateSchema,
  data: z.record(z.string(), z.unknown()),
});

export type RealtimeEnvelope = z.infer<typeof realtimeEnvelopeSchema>;

export function createRealtimeEnvelope(
  event: string,
  data: Record<string, unknown>,
  ts = new Date().toISOString(),
): RealtimeEnvelope {
  return {
    v: REALTIME_PROTOCOL_VERSION,
    event,
    ts,
    data,
  };
}

export const roomJoinSchema = z.object({
  room: z.string().min(3).max(120),
});

export const roomLeaveSchema = roomJoinSchema;

export const typingUpdateSchema = z.object({
  room: z.string().min(3).max(120),
  isTyping: z.boolean(),
});

export const messageDeliveredSchema = z.object({
  conversationId: z.string().min(1).max(64),
  messageId: z.string().min(1).max(64),
});

export const messageReadSchema = z.object({
  conversationId: z.string().min(1).max(64),
});

export const unreadUpdatedSchema = z.object({
  conversationsUnread: z.number().int().nonnegative().optional(),
  notificationsUnread: z.number().int().nonnegative().optional(),
  supportUnread: z.number().int().nonnegative().optional(),
  conversationId: z.string().optional(),
  conversationUnread: z.number().int().nonnegative().optional(),
});

export type UnreadUpdatedPayload = z.infer<typeof unreadUpdatedSchema>;

export const presenceUpdateSchema = z.object({
  userId: z.string().min(1),
  status: z.enum(["online", "offline"]),
  lastSeenAt: z.string().nullable().optional(),
});

export type PresenceUpdatePayload = z.infer<typeof presenceUpdateSchema>;

export const realtimeReadySchema = z.object({
  userId: z.string(),
  role: z.enum(["USER", "ADMIN"]),
  rooms: z.array(z.string()),
  protocolVersion: z.literal(REALTIME_PROTOCOL_VERSION),
});

export type RealtimeReadyPayload = z.infer<typeof realtimeReadySchema>;

export const realtimeErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
});
