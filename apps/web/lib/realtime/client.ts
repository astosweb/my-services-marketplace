"use client";

import {
  RealtimeClientEvent,
  RealtimeServerEvent,
  realtimeEnvelopeSchema,
  type RealtimeEnvelope,
} from "@monorepo/shared";
import { io, type Socket } from "socket.io-client";

export type SocketTokenResponse = {
  token: string;
  namespace: string;
  protocolVersion: number;
  url: string;
};

type Handler = (envelope: RealtimeEnvelope) => void;

/**
 * Browser Socket.IO client for the Nest `/realtime` namespace.
 * Auth tokens come from the BFF `/api/auth/socket-token` route (HttpOnly cookies).
 */
export class RealtimeClient {
  private socket: Socket | null = null;
  private handlers = new Map<string, Map<Handler, (payload: unknown) => void>>();
  private connecting: Promise<Socket> | null = null;
  private intentionalClose = false;

  constructor(private readonly fetchToken: () => Promise<SocketTokenResponse>) {}

  get connected() {
    return Boolean(this.socket?.connected);
  }

  on(event: string, handler: Handler) {
    const wrapped = (payload: unknown) => {
      const parsed = realtimeEnvelopeSchema.safeParse(payload);
      if (!parsed.success) return;
      handler(parsed.data);
    };
    const set = this.handlers.get(event) ?? new Map();
    set.set(handler, wrapped);
    this.handlers.set(event, set);
    this.socket?.on(event, wrapped);
    return () => this.off(event, handler);
  }

  off(event: string, handler: Handler) {
    const wrapped = this.handlers.get(event)?.get(handler);
    if (wrapped) this.socket?.off(event, wrapped);
    this.handlers.get(event)?.delete(handler);
  }

  async connect() {
    this.intentionalClose = false;
    if (this.socket?.connected) return this.socket;
    if (this.connecting) return this.connecting;

    this.connecting = (async () => {
      const { token, url, namespace } = await this.fetchToken();
      if (this.socket) {
        this.socket.auth = { token };
        this.socket.connect();
        return this.socket;
      }

      const socket = io(`${url}${namespace || "/realtime"}`, {
        auth: { token },
        transports: ["websocket", "polling"],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 800,
        reconnectionDelayMax: 8_000,
        timeout: 15_000,
        autoConnect: true,
      });

      socket.on("connect_error", async (error) => {
        if (/unauthorized|jwt|token/i.test(error.message)) {
          try {
            const refreshed = await this.fetchToken();
            socket.auth = { token: refreshed.token };
            socket.connect();
          } catch {
            // Session likely expired.
          }
        }
      });

      for (const [event, set] of this.handlers) {
        for (const [, wrapped] of set) {
          socket.on(event, wrapped);
        }
      }

      this.socket = socket;
      return socket;
    })();

    try {
      return await this.connecting;
    } finally {
      this.connecting = null;
    }
  }

  disconnect() {
    this.intentionalClose = true;
    this.socket?.removeAllListeners();
    this.socket?.disconnect();
    this.socket = null;
  }

  join(room: string) {
    this.socket?.emit(RealtimeClientEvent.ROOM_JOIN, { room });
  }

  leave(room: string) {
    this.socket?.emit(RealtimeClientEvent.ROOM_LEAVE, { room });
  }

  setTyping(room: string, isTyping: boolean) {
    this.socket?.emit(RealtimeClientEvent.TYPING_UPDATE, { room, isTyping });
  }

  pingPresence() {
    this.socket?.emit(RealtimeClientEvent.PRESENCE_PING);
  }

  markDelivered(conversationId: string, messageId: string) {
    this.socket?.emit(RealtimeClientEvent.MESSAGE_DELIVERED, {
      conversationId,
      messageId,
    });
  }

  markRead(conversationId: string) {
    this.socket?.emit(RealtimeClientEvent.MESSAGE_READ, { conversationId });
  }
}

export const LIVE_QUERY_EVENTS = [
  RealtimeServerEvent.MESSAGE_CREATED,
  RealtimeServerEvent.MESSAGE_READ,
  RealtimeServerEvent.MESSAGE_DELIVERED,
  RealtimeServerEvent.CONVERSATION_UPDATED,
  RealtimeServerEvent.UNREAD_UPDATED,
  RealtimeServerEvent.NOTIFICATION_CREATED,
  RealtimeServerEvent.NOTIFICATION_UPDATED,
  RealtimeServerEvent.OFFER_CREATED,
  RealtimeServerEvent.OFFER_UPDATED,
  RealtimeServerEvent.REQUEST_CREATED,
  RealtimeServerEvent.REQUEST_UPDATED,
  RealtimeServerEvent.REQUEST_MODERATION,
  RealtimeServerEvent.JOB_PROGRESS,
  RealtimeServerEvent.SUPPORT_TICKET_UPDATED,
  RealtimeServerEvent.SUPPORT_MESSAGE_CREATED,
  RealtimeServerEvent.ADMIN_STATS,
  RealtimeServerEvent.ADMIN_MODERATION,
  RealtimeServerEvent.PAYMENT_UPDATED,
] as const;
