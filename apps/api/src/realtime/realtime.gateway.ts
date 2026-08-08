import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { Logger } from "@nestjs/common";
import type { Server, Socket } from "socket.io";
import { z } from "zod";
import { MessageStatus, UserRole, UserStatus } from "../generated/prisma/client.js";
import { verifyAccessToken } from "../lib/auth.js";
import { PrismaService } from "../prisma/prisma.service.js";
import {
  ADMIN_MODERATION_ROOM,
  ADMIN_ROOM,
  ADMIN_SUPPORT_ROOM,
  createRealtimeEnvelope,
  REALTIME_PROTOCOL_VERSION,
  RealtimeClientEvent,
  RealtimeServerEvent,
  SOCKET_RATE_LIMIT,
  TYPING_TTL_MS,
  userRoom,
} from "./realtime.constants.js";
import { RealtimePresenceService } from "./realtime.presence.service.js";
import { RealtimePublisher } from "./realtime.publisher.js";

type SocketUser = {
  id: string;
  role: "USER" | "ADMIN";
  displayName: string;
};

type AuthedSocket = Socket & {
  data: { user?: SocketUser; eventHits?: number[]; typingHits?: number[] };
};

const roomSchema = z.object({ room: z.string().min(3).max(120) });
const typingSchema = z.object({
  room: z.string().min(3).max(120),
  isTyping: z.boolean(),
});
const deliveredSchema = z.object({
  conversationId: z.string().min(1).max(64),
  messageId: z.string().min(1).max(64),
});
const readSchema = z.object({
  conversationId: z.string().min(1).max(64),
});

function extractToken(socket: Socket): string | null {
  const auth = socket.handshake.auth as { token?: unknown } | undefined;
  if (typeof auth?.token === "string" && auth.token.trim()) return auth.token.trim();

  const authHeader = socket.handshake.headers.authorization;
  if (typeof authHeader === "string" && authHeader.toLowerCase().startsWith("bearer ")) {
    return authHeader.slice(7).trim() || null;
  }

  const queryToken = socket.handshake.query.token;
  if (typeof queryToken === "string" && queryToken.trim()) return queryToken.trim();
  if (Array.isArray(queryToken) && typeof queryToken[0] === "string") {
    return queryToken[0].trim() || null;
  }

  return null;
}

@WebSocketGateway({
  namespace: "/realtime",
  transports: ["websocket", "polling"],
})
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly prisma: PrismaService,
    private readonly publisher: RealtimePublisher,
    private readonly presence: RealtimePresenceService,
  ) {}

  afterInit(server: Server) {
    this.publisher.attachServer(server);
    this.logger.log("Realtime gateway initialized (namespace /realtime)");
  }

  async handleConnection(socket: AuthedSocket) {
    try {
      const token = extractToken(socket);
      if (!token) {
        this.reject(socket, "UNAUTHORIZED", "Missing access token");
        return;
      }

      const userId = await verifyAccessToken(token);
      if (!userId) {
        this.reject(socket, "UNAUTHORIZED", "Invalid or expired token");
        return;
      }

      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          role: true,
          status: true,
          displayName: true,
          businessName: true,
          preferBusinessName: true,
        },
      });
      if (!user || user.status === UserStatus.BANNED) {
        this.reject(socket, "FORBIDDEN", "Account is not allowed to connect");
        return;
      }

      const displayName =
        user.preferBusinessName && user.businessName?.trim()
          ? user.businessName.trim()
          : user.displayName;

      socket.data.user = {
        id: user.id,
        role: user.role === UserRole.ADMIN ? "ADMIN" : "USER",
        displayName,
      };
      socket.data.eventHits = [];
      socket.data.typingHits = [];

      const rooms = [userRoom(user.id)];
      await socket.join(userRoom(user.id));

      if (socket.data.user.role === "ADMIN") {
        for (const room of [ADMIN_ROOM, ADMIN_MODERATION_ROOM, ADMIN_SUPPORT_ROOM]) {
          await socket.join(room);
          rooms.push(room);
        }
      }

      const { becameOnline } = await this.presence.connect(user.id, socket.id);
      if (becameOnline) {
        this.publisher.presenceUpdate({
          userId: user.id,
          status: "online",
          lastSeenAt: new Date().toISOString(),
        });
      }

      this.publisher.emitToSocket(socket, RealtimeServerEvent.READY, {
        userId: user.id,
        role: socket.data.user.role,
        rooms,
        protocolVersion: REALTIME_PROTOCOL_VERSION,
      });

      this.logger.log(`Socket connected user=${user.id} socket=${socket.id}`);
    } catch (error) {
      this.logger.error(`Connection error: ${String(error)}`);
      this.reject(socket, "INTERNAL", "Connection failed");
    }
  }

  async handleDisconnect(socket: AuthedSocket) {
    const user = socket.data.user;
    if (!user) return;
    try {
      const { becameOffline, lastSeenAt } = await this.presence.disconnect(user.id, socket.id);
      if (becameOffline) {
        this.publisher.presenceUpdate({
          userId: user.id,
          status: "offline",
          lastSeenAt: lastSeenAt.toISOString(),
        });
      }
      this.logger.log(`Socket disconnected user=${user.id} socket=${socket.id}`);
    } catch (error) {
      this.logger.warn(`Disconnect cleanup failed: ${String(error)}`);
    }
  }

  @SubscribeMessage(RealtimeClientEvent.ROOM_JOIN)
  async onRoomJoin(@ConnectedSocket() socket: AuthedSocket, @MessageBody() body: unknown) {
    if (!this.allow(socket)) return;
    const parsed = roomSchema.safeParse(body);
    if (!parsed.success) {
      this.emitError(socket, "VALIDATION", "Invalid room.join payload");
      return;
    }
    const user = socket.data.user!;
    const allowed = await this.canJoinRoom(user, parsed.data.room);
    if (!allowed) {
      this.emitError(socket, "FORBIDDEN", `Not allowed to join ${parsed.data.room}`);
      return;
    }
    await socket.join(parsed.data.room);
    return createRealtimeEnvelope("room.joined", { room: parsed.data.room });
  }

  @SubscribeMessage(RealtimeClientEvent.ROOM_LEAVE)
  async onRoomLeave(@ConnectedSocket() socket: AuthedSocket, @MessageBody() body: unknown) {
    if (!this.allow(socket)) return;
    const parsed = roomSchema.safeParse(body);
    if (!parsed.success) {
      this.emitError(socket, "VALIDATION", "Invalid room.leave payload");
      return;
    }
    if (parsed.data.room === userRoom(socket.data.user!.id)) {
      this.emitError(socket, "FORBIDDEN", "Cannot leave personal room");
      return;
    }
    await socket.leave(parsed.data.room);
    return createRealtimeEnvelope("room.left", { room: parsed.data.room });
  }

  @SubscribeMessage(RealtimeClientEvent.TYPING_UPDATE)
  async onTyping(@ConnectedSocket() socket: AuthedSocket, @MessageBody() body: unknown) {
    if (!this.allow(socket, "typing")) return;
    const parsed = typingSchema.safeParse(body);
    if (!parsed.success) {
      this.emitError(socket, "VALIDATION", "Invalid typing.update payload");
      return;
    }
    const user = socket.data.user!;
    if (!(await this.canJoinRoom(user, parsed.data.room))) {
      this.emitError(socket, "FORBIDDEN", "Not allowed to type in this room");
      return;
    }

    const payload = {
      room: parsed.data.room,
      userId: user.id,
      displayName: user.displayName,
      isTyping: parsed.data.isTyping,
      expiresAt: new Date(Date.now() + TYPING_TTL_MS).toISOString(),
    };

    if (parsed.data.room.startsWith("support:")) {
      const ticketId = parsed.data.room.slice("support:".length);
      this.publisher.supportTyping({
        ticketId,
        userId: user.id,
        displayName: user.displayName,
        isTyping: parsed.data.isTyping,
      });
    } else {
      socket.to(parsed.data.room).emit(
        RealtimeServerEvent.TYPING_UPDATE,
        createRealtimeEnvelope(RealtimeServerEvent.TYPING_UPDATE, payload),
      );
    }
  }

  @SubscribeMessage(RealtimeClientEvent.PRESENCE_PING)
  async onPresencePing(@ConnectedSocket() socket: AuthedSocket) {
    if (!this.allow(socket)) return;
    await this.presence.heartbeat(socket.data.user!.id);
  }

  @SubscribeMessage(RealtimeClientEvent.MESSAGE_DELIVERED)
  async onMessageDelivered(@ConnectedSocket() socket: AuthedSocket, @MessageBody() body: unknown) {
    if (!this.allow(socket)) return;
    const parsed = deliveredSchema.safeParse(body);
    if (!parsed.success) {
      this.emitError(socket, "VALIDATION", "Invalid message.delivered payload");
      return;
    }
    const user = socket.data.user!;
    const membership = await this.prisma.conversationParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId: parsed.data.conversationId,
          userId: user.id,
        },
      },
    });
    if (!membership) {
      this.emitError(socket, "FORBIDDEN", "Not a conversation participant");
      return;
    }
    await this.prisma.message.updateMany({
      where: {
        id: parsed.data.messageId,
        conversationId: parsed.data.conversationId,
        senderId: { not: user.id },
        status: { in: [MessageStatus.SENT, MessageStatus.SENDING] },
      },
      data: { status: MessageStatus.DELIVERED },
    });
    this.publisher.messageDelivered({
      conversationId: parsed.data.conversationId,
      messageId: parsed.data.messageId,
      userId: user.id,
    });
  }

  @SubscribeMessage(RealtimeClientEvent.MESSAGE_READ)
  async onMessageRead(@ConnectedSocket() socket: AuthedSocket, @MessageBody() body: unknown) {
    if (!this.allow(socket)) return;
    const parsed = readSchema.safeParse(body);
    if (!parsed.success) {
      this.emitError(socket, "VALIDATION", "Invalid message.read payload");
      return;
    }
    const user = socket.data.user!;
    const membership = await this.prisma.conversationParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId: parsed.data.conversationId,
          userId: user.id,
        },
      },
    });
    if (!membership) {
      this.emitError(socket, "FORBIDDEN", "Not a conversation participant");
      return;
    }

    // Idempotent: skip emit when already caught up (avoids client refetch storms).
    const unread = await this.prisma.message.findFirst({
      where: {
        conversationId: parsed.data.conversationId,
        senderId: { not: user.id },
        ...(membership.lastReadAt
          ? { createdAt: { gt: membership.lastReadAt } }
          : {}),
      },
      select: { id: true },
    });
    if (!unread) return;

    const readAt = new Date();
    await this.prisma.$transaction([
      this.prisma.conversationParticipant.update({
        where: {
          conversationId_userId: {
            conversationId: parsed.data.conversationId,
            userId: user.id,
          },
        },
        data: { lastReadAt: readAt },
      }),
      this.prisma.message.updateMany({
        where: {
          conversationId: parsed.data.conversationId,
          senderId: { not: user.id },
          status: { not: MessageStatus.READ },
          ...(membership.lastReadAt
            ? { createdAt: { gt: membership.lastReadAt } }
            : {}),
        },
        data: { status: MessageStatus.READ },
      }),
    ]);

    const participants = await this.prisma.conversationParticipant.findMany({
      where: { conversationId: parsed.data.conversationId },
      select: { userId: true },
    });

    this.publisher.messageRead({
      conversationId: parsed.data.conversationId,
      readerId: user.id,
      participantIds: participants.map((participant) => participant.userId),
      readAt: readAt.toISOString(),
    });
    this.publisher.unreadUpdated(user.id, {
      conversationId: parsed.data.conversationId,
      conversationUnread: 0,
    });
  }

  private allow(socket: AuthedSocket, kind: "default" | "typing" = "default") {
    if (!socket.data.user) {
      this.emitError(socket, "UNAUTHORIZED", "Not authenticated");
      socket.disconnect(true);
      return false;
    }
    const now = Date.now();
    const bucketKey = kind === "typing" ? "typingHits" : "eventHits";
    const limit = kind === "typing" ? SOCKET_RATE_LIMIT.maxTyping : SOCKET_RATE_LIMIT.maxEvents;
    const hits = (socket.data[bucketKey] ?? []).filter((ts: number) => now - ts < SOCKET_RATE_LIMIT.windowMs);
    hits.push(now);
    socket.data[bucketKey] = hits;
    if (hits.length > limit) {
      this.emitError(socket, "RATE_LIMITED", "Too many socket events");
      this.logger.warn(`Rate limited user=${socket.data.user.id} kind=${kind}`);
      return false;
    }
    return true;
  }

  private async canJoinRoom(user: SocketUser, room: string): Promise<boolean> {
    if (room === userRoom(user.id)) return true;
    if (room === ADMIN_ROOM || room === ADMIN_MODERATION_ROOM || room === ADMIN_SUPPORT_ROOM) {
      return user.role === "ADMIN";
    }
    if (room.startsWith("conversation:")) {
      const conversationId = room.slice("conversation:".length);
      const membership = await this.prisma.conversationParticipant.findUnique({
        where: { conversationId_userId: { conversationId, userId: user.id } },
        select: { userId: true },
      });
      return Boolean(membership);
    }
    if (room.startsWith("request:")) {
      const requestId = room.slice("request:".length);
      if (user.role === "ADMIN") return true;
      // Participants only — never open public browse rooms (avoids offer price leakage).
      const request = await this.prisma.serviceRequest.findUnique({
        where: { id: requestId },
        select: {
          ownerId: true,
          offers: { where: { offererId: user.id }, select: { id: true }, take: 1 },
          conversations: {
            where: { participants: { some: { userId: user.id } } },
            select: { id: true },
            take: 1,
          },
        },
      });
      if (!request) return false;
      if (request.ownerId === user.id) return true;
      if (request.offers.length > 0) return true;
      return request.conversations.length > 0;
    }
    if (room.startsWith("support:")) {
      const ticketId = room.slice("support:".length);
      if (user.role === "ADMIN") return true;
      const ticket = await this.prisma.supportTicket.findUnique({
        where: { id: ticketId },
        select: { createdById: true },
      });
      return ticket?.createdById === user.id;
    }
    return false;
  }

  private reject(socket: Socket, code: string, message: string) {
    socket.emit(
      RealtimeServerEvent.ERROR,
      createRealtimeEnvelope(RealtimeServerEvent.ERROR, { code, message }),
    );
    socket.disconnect(true);
  }

  private emitError(socket: Socket, code: string, message: string) {
    socket.emit(
      RealtimeServerEvent.ERROR,
      createRealtimeEnvelope(RealtimeServerEvent.ERROR, { code, message }),
    );
  }
}
