/** Room helpers + protocol constants for the Nest realtime layer.
 * Keep names aligned with `packages/shared/src/realtime.ts`.
 */

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

export function userRoom(userId: string) {
  return `user:${userId}`;
}

export function conversationRoom(conversationId: string) {
  return `conversation:${conversationId}`;
}

export function requestRoom(requestId: string) {
  return `request:${requestId}`;
}

export function supportRoom(ticketId: string) {
  return `support:${ticketId}`;
}

export const ADMIN_ROOM = "admin";
export const ADMIN_MODERATION_ROOM = "admin:moderation";
export const ADMIN_SUPPORT_ROOM = "admin:support";

export const SOCKET_RATE_LIMIT = {
  maxEvents: 60,
  windowMs: 60_000,
  maxTyping: 20,
} as const;

export const PRESENCE_TTL_MS = 90_000;
export const TYPING_TTL_MS = 8_000;

export type UnreadUpdatedPayload = {
  conversationsUnread?: number;
  notificationsUnread?: number;
  supportUnread?: number;
  conversationId?: string;
  conversationUnread?: number;
};

export function createRealtimeEnvelope(
  event: string,
  data: Record<string, unknown>,
  ts = new Date().toISOString(),
) {
  return {
    v: REALTIME_PROTOCOL_VERSION,
    event,
    ts,
    data,
  };
}
