import { Injectable, Logger } from "@nestjs/common";
import {
  NotificationKind,
  Prisma,
  SupportActivityType,
  SupportTicketPriority,
  SupportTicketStatus,
  UserRole,
  UserStatus,
} from "../generated/prisma/client.js";
import { EmailService } from "../email/email.service.js";
import { badRequest, forbidden, notFound } from "../lib/errors.js";
import { assertOwnedObjectKeys } from "../lib/owned-keys.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { PushService } from "../push/push.service.js";
import {
  CreateCannedResponseDto,
  CreateSupportNoteDto,
  CreateSupportTicketDto,
  MergeSupportTicketsDto,
  SendSupportMessageDto,
  SupportBulkActionDto,
  SupportTicketsQueryDto,
  UpdateCannedResponseDto,
  UpdateSupportTicketDto,
} from "./support.dto.js";
import {
  isSlaBreached,
  serializeCannedResponse,
  serializeSupportMessage,
  serializeSupportTicketDetail,
  serializeSupportTicketListItem,
} from "./support.serializer.js";

const SLA_HOURS: Record<
  SupportTicketPriority,
  { responseHours: number; resolveHours: number }
> = {
  URGENT: { responseHours: 1, resolveHours: 4 },
  HIGH: { responseHours: 4, resolveHours: 24 },
  NORMAL: { responseHours: 24, resolveHours: 72 },
  LOW: { responseHours: 48, resolveHours: 120 },
};

const userSelect = {
  id: true,
  email: true,
  displayName: true,
  businessName: true,
  preferBusinessName: true,
  avatarKey: true,
  role: true,
  status: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

const ticketInclude = {
  createdBy: { select: userSelect },
  assignedAdmin: { select: userSelect },
  _count: { select: { attachments: true, messages: true } },
} satisfies Prisma.SupportTicketInclude;

const detailInclude = {
  createdBy: { select: userSelect },
  assignedAdmin: { select: userSelect },
  messages: {
    orderBy: { createdAt: "asc" as const },
    include: {
      sender: { select: userSelect },
      attachments: { orderBy: { createdAt: "asc" as const } },
    },
  },
  attachments: { orderBy: { createdAt: "asc" as const } },
  internalNotes: {
    orderBy: { createdAt: "desc" as const },
    include: { author: { select: userSelect } },
  },
  statusHistory: {
    orderBy: { createdAt: "asc" as const },
    include: { changedBy: { select: userSelect } },
  },
  activities: {
    orderBy: { createdAt: "desc" as const },
    take: 100,
    include: { actor: { select: userSelect } },
  },
} satisfies Prisma.SupportTicketInclude;

type TypingState = { userId: string; displayName: string; expiresAt: number };

@Injectable()
export class SupportService {
  private readonly logger = new Logger(SupportService.name);
  private readonly typingByTicket = new Map<string, Map<string, TypingState>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly pushService: PushService,
    private readonly emailService: EmailService,
  ) {}

  private slaDeadlines(priority: SupportTicketPriority, from = new Date()) {
    const hours = SLA_HOURS[priority];
    return {
      responseDueAt: new Date(from.getTime() + hours.responseHours * 60 * 60 * 1000),
      resolveDueAt: new Date(from.getTime() + hours.resolveHours * 60 * 60 * 1000),
    };
  }

  private async nextCaseNumber(tx: Prisma.TransactionClient) {
    const now = new Date();
    const dateKey = [
      now.getUTCFullYear(),
      String(now.getUTCMonth() + 1).padStart(2, "0"),
      String(now.getUTCDate()).padStart(2, "0"),
    ].join("");

    const sequence = await tx.supportCaseSequence.upsert({
      where: { dateKey },
      create: { dateKey, lastValue: 1 },
      update: { lastValue: { increment: 1 } },
    });

    return `SUP-${dateKey}-${String(sequence.lastValue).padStart(6, "0")}`;
  }

  private sanitizeText(value: string) {
    return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim();
  }

  private async resolveAttachmentMeta(keys: string[], userId: string) {
    assertOwnedObjectKeys(keys, userId, "support");
    const { getUploadObjectSize } = await import("../lib/storage.js");
    return Promise.all(
      keys.map(async (key) => {
        const fileName = key.split("/").pop() ?? "attachment";
        const ext = fileName.includes(".") ? fileName.split(".").pop()!.toLowerCase() : "";
        const mimeType =
          ext === "pdf"
            ? "application/pdf"
            : ext === "png"
              ? "image/png"
              : ext === "webp"
                ? "image/webp"
                : ext === "txt"
                  ? "text/plain"
                  : "image/jpeg";
        const sizeBytes = (await getUploadObjectSize(key)) ?? 0;
        return { spacesKey: key, fileName, mimeType, sizeBytes };
      }),
    );
  }

  private async notifySupportEvent(input: {
    userIds: string[];
    kind: NotificationKind;
    title: string;
    body: string;
    ticketId: string;
    caseNumber: string;
    emails?: Array<{ email: string; text: string }>;
  }) {
    try {
      await this.pushService.notifyUsers({
        userIds: input.userIds,
        kind: input.kind,
        title: input.title,
        body: input.body,
        contextTag: "support",
        payload: {
          ticketId: input.ticketId,
          caseNumber: input.caseNumber,
          action: input.kind,
        },
      });
    } catch (error) {
      this.logger.error({ error }, "Support push notification failed");
    }

    for (const email of input.emails ?? []) {
      await this.emailService.sendSupportNotification({
        recipient: email.email,
        subject: input.title,
        text: email.text,
      });
    }
  }

  private async loadTicketOrThrow(id: string, viewer: { userId: string; isAdmin: boolean }) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id },
      include: detailInclude,
    });
    if (!ticket || ticket.mergedIntoId) throw notFound("Support ticket not found");
    if (!viewer.isAdmin && ticket.createdById !== viewer.userId) {
      throw forbidden("You do not have access to this ticket");
    }
    return ticket;
  }

  private buildWhere(query: SupportTicketsQueryDto, createdById?: string): Prisma.SupportTicketWhereInput {
    const where: Prisma.SupportTicketWhereInput = {
      mergedIntoId: null,
    };

    if (createdById) where.createdById = createdById;
    if (query.status) where.status = query.status;
    if (query.category) where.category = query.category;
    if (query.priority) where.priority = query.priority;
    if (query.createdById) where.createdById = query.createdById;
    if (query.caseNumber) {
      where.caseNumber = { contains: query.caseNumber.trim().toUpperCase(), mode: "insensitive" };
    }
    if (query.tag) where.tags = { has: query.tag.trim().toLowerCase() };
    if (query.assignedAdminId) where.assignedAdminId = query.assignedAdminId;
    if (query.unassigned === "true") where.assignedAdminId = null;
    if (query.unassigned === "false") where.assignedAdminId = { not: null };

    if (query.from || query.to) {
      where.createdAt = {};
      if (query.from) where.createdAt.gte = new Date(query.from);
      if (query.to) where.createdAt.lte = new Date(query.to);
    }

    if (query.slaBreached === "true") {
      const now = new Date();
      where.AND = [
        { status: { notIn: [SupportTicketStatus.RESOLVED, SupportTicketStatus.CLOSED] } },
        {
          OR: [
            { firstResponseAt: null, responseDueAt: { lt: now } },
            { resolveDueAt: { lt: now } },
          ],
        },
      ];
    }

    if (query.search?.trim()) {
      const search = query.search.trim();
      where.OR = [
        { caseNumber: { contains: search, mode: "insensitive" } },
        { subject: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { createdBy: { email: { contains: search, mode: "insensitive" } } },
        { createdBy: { displayName: { contains: search, mode: "insensitive" } } },
        { tags: { has: search.toLowerCase() } },
      ];
    }

    return where;
  }

  async createTicket(
    userId: string,
    data: CreateSupportTicketDto,
    meta?: { userAgent?: string },
  ) {
    const subject = this.sanitizeText(data.subject);
    const description = this.sanitizeText(data.description);
    if (subject.length < 3) throw badRequest("Subject is too short");
    if (description.length < 10) throw badRequest("Description is too short");

    const priority = data.priority ?? SupportTicketPriority.NORMAL;
    const deadlines = this.slaDeadlines(priority);
    const attachmentKeys = data.attachmentKeys ?? [];
    const attachmentMeta = attachmentKeys.length
      ? await this.resolveAttachmentMeta(attachmentKeys, userId)
      : [];

    const ticket = await this.prisma.$transaction(async (tx) => {
      const caseNumber = await this.nextCaseNumber(tx);
      const created = await tx.supportTicket.create({
        data: {
          caseNumber,
          subject,
          description,
          category: data.category,
          priority,
          status: SupportTicketStatus.OPEN,
          createdById: userId,
          responseDueAt: deadlines.responseDueAt,
          resolveDueAt: deadlines.resolveDueAt,
          lastMessageAt: new Date(),
          userLastReadAt: new Date(),
          unreadByAdmin: 1,
          appVersion: data.appVersion?.trim() || null,
          platform: data.platform?.trim() || null,
          deviceName: data.deviceName?.trim() || null,
          systemVersion: data.systemVersion?.trim() || null,
          userAgent: meta?.userAgent?.slice(0, 500) || null,
          messages: {
            create: {
              senderId: userId,
              body: description,
              isStaff: false,
            },
          },
          statusHistory: {
            create: {
              fromStatus: null,
              toStatus: SupportTicketStatus.OPEN,
              changedById: userId,
              note: "Ticket created",
            },
          },
          activities: {
            create: {
              actorId: userId,
              type: SupportActivityType.CREATED,
              details: { caseNumber, category: data.category, priority },
            },
          },
        },
        include: ticketInclude,
      });

      if (attachmentMeta.length) {
        const firstMessage = await tx.supportMessage.findFirst({
          where: { ticketId: created.id },
          orderBy: { createdAt: "asc" },
        });
        await tx.supportAttachment.createMany({
          data: attachmentMeta.map((file) => ({
            ticketId: created.id,
            messageId: firstMessage?.id,
            uploaderId: userId,
            spacesKey: file.spacesKey,
            fileName: file.fileName,
            mimeType: file.mimeType,
            sizeBytes: file.sizeBytes,
          })),
        });
        await tx.supportActivity.create({
          data: {
            ticketId: created.id,
            actorId: userId,
            type: SupportActivityType.ATTACHMENT_ADDED,
            details: { count: attachmentMeta.length },
          },
        });
      }

      return tx.supportTicket.findUniqueOrThrow({
        where: { id: created.id },
        include: ticketInclude,
      });
    });

    const admins = await this.prisma.user.findMany({
      where: { role: UserRole.ADMIN, status: UserStatus.ACTIVE },
      select: { id: true, email: true },
    });

    await this.notifySupportEvent({
      userIds: admins.map((admin) => admin.id),
      kind: NotificationKind.SUPPORT_TICKET_CREATED,
      title: `New support ticket ${ticket.caseNumber}`,
      body: ticket.subject,
      ticketId: ticket.id,
      caseNumber: ticket.caseNumber,
      emails: admins.map((admin) => ({
        email: admin.email,
        text: `A new support ticket was created.\n\nCase: ${ticket.caseNumber}\nSubject: ${ticket.subject}\nCategory: ${ticket.category}\nPriority: ${ticket.priority}`,
      })),
    });

    return serializeSupportTicketListItem(ticket, { isAdmin: false, userId });
  }

  async listTickets(
    viewer: { userId: string; isAdmin: boolean },
    query: SupportTicketsQueryDto,
  ) {
    const where = this.buildWhere(query, viewer.isAdmin ? undefined : viewer.userId);
    const orderBy = { [query.sortBy]: query.sortOrder } as Prisma.SupportTicketOrderByWithRelationInput;

    const [total, rows] = await Promise.all([
      this.prisma.supportTicket.count({ where }),
      this.prisma.supportTicket.findMany({
        where,
        include: ticketInclude,
        orderBy,
        take: query.limit,
        skip: query.offset,
      }),
    ]);

    return {
      data: rows.map((row) => serializeSupportTicketListItem(row, viewer)),
      meta: { total, limit: query.limit, offset: query.offset },
    };
  }

  async getTicket(id: string, viewer: { userId: string; isAdmin: boolean }) {
    const ticket = await this.loadTicketOrThrow(id, viewer);
    const devices = viewer.isAdmin
      ? await this.prisma.deviceToken.findMany({
          where: { userId: ticket.createdById },
          orderBy: { updatedAt: "desc" },
          take: 10,
          select: {
            id: true,
            platform: true,
            name: true,
            systemVersion: true,
            appVersion: true,
            isActive: true,
            updatedAt: true,
          },
        })
      : undefined;

    return serializeSupportTicketDetail(ticket, viewer, devices);
  }

  async markRead(id: string, viewer: { userId: string; isAdmin: boolean }) {
    const ticket = await this.loadTicketOrThrow(id, viewer);
    const now = new Date();

    if (viewer.isAdmin) {
      await this.prisma.$transaction([
        this.prisma.supportTicket.update({
          where: { id: ticket.id },
          data: { adminLastReadAt: now, unreadByAdmin: 0 },
        }),
        this.prisma.supportMessage.updateMany({
          where: {
            ticketId: ticket.id,
            isStaff: false,
            readAt: null,
          },
          data: { readAt: now },
        }),
      ]);
    } else {
      await this.prisma.$transaction([
        this.prisma.supportTicket.update({
          where: { id: ticket.id },
          data: { userLastReadAt: now, unreadByUser: 0 },
        }),
        this.prisma.supportMessage.updateMany({
          where: {
            ticketId: ticket.id,
            isStaff: true,
            readAt: null,
          },
          data: { readAt: now },
        }),
      ]);
    }

    return { read: true as const };
  }

  async sendMessage(
    id: string,
    viewer: { userId: string; isAdmin: boolean },
    data: SendSupportMessageDto,
  ) {
    const ticket = await this.loadTicketOrThrow(id, viewer);
    if (ticket.status === SupportTicketStatus.CLOSED && !viewer.isAdmin) {
      throw badRequest("Closed tickets cannot receive replies. Reopen the ticket first.");
    }

    const body = this.sanitizeText(data.body ?? "");
    const attachmentKeys = data.attachmentKeys ?? [];
    if (!body && attachmentKeys.length === 0) {
      throw badRequest("Message body or attachment is required");
    }

    const attachmentMeta = attachmentKeys.length
      ? await this.resolveAttachmentMeta(attachmentKeys, viewer.userId)
      : [];

    const isStaff = viewer.isAdmin;
    const now = new Date();

    const message = await this.prisma.$transaction(async (tx) => {
      const created = await tx.supportMessage.create({
        data: {
          ticketId: ticket.id,
          senderId: viewer.userId,
          body,
          isStaff,
          attachments: attachmentMeta.length
            ? {
                create: attachmentMeta.map((file) => ({
                  ticketId: ticket.id,
                  uploaderId: viewer.userId,
                  spacesKey: file.spacesKey,
                  fileName: file.fileName,
                  mimeType: file.mimeType,
                  sizeBytes: file.sizeBytes,
                })),
              }
            : undefined,
        },
        include: {
          sender: { select: userSelect },
          attachments: true,
        },
      });

      const nextStatus =
        isStaff && ticket.status === SupportTicketStatus.OPEN
          ? SupportTicketStatus.WAITING_FOR_USER
          : !isStaff &&
              (ticket.status === SupportTicketStatus.WAITING_FOR_USER ||
                ticket.status === SupportTicketStatus.RESOLVED)
            ? SupportTicketStatus.IN_PROGRESS
            : ticket.status;

      await tx.supportTicket.update({
        where: { id: ticket.id },
        data: {
          lastMessageAt: now,
          updatedAt: now,
          status: nextStatus,
          firstResponseAt:
            isStaff && !ticket.firstResponseAt ? now : ticket.firstResponseAt,
          unreadByUser: isStaff ? { increment: 1 } : undefined,
          unreadByAdmin: !isStaff ? { increment: 1 } : undefined,
          userLastReadAt: !isStaff ? now : undefined,
          adminLastReadAt: isStaff ? now : undefined,
        },
      });

      if (nextStatus !== ticket.status) {
        await tx.supportStatusHistory.create({
          data: {
            ticketId: ticket.id,
            fromStatus: ticket.status,
            toStatus: nextStatus,
            changedById: viewer.userId,
            note: "Auto-updated after message",
          },
        });
        await tx.supportActivity.create({
          data: {
            ticketId: ticket.id,
            actorId: viewer.userId,
            type: SupportActivityType.STATUS_CHANGED,
            details: { from: ticket.status, to: nextStatus },
          },
        });
      }

      await tx.supportActivity.create({
        data: {
          ticketId: ticket.id,
          actorId: viewer.userId,
          type: SupportActivityType.MESSAGE_ADDED,
          details: { messageId: created.id, isStaff, hasAttachments: attachmentMeta.length > 0 },
        },
      });

      if (attachmentMeta.length) {
        await tx.supportActivity.create({
          data: {
            ticketId: ticket.id,
            actorId: viewer.userId,
            type: SupportActivityType.ATTACHMENT_ADDED,
            details: { count: attachmentMeta.length, messageId: created.id },
          },
        });
      }

      return created;
    });

    if (isStaff) {
      await this.notifySupportEvent({
        userIds: [ticket.createdById],
        kind: NotificationKind.SUPPORT_TICKET_REPLY,
        title: `Support replied · ${ticket.caseNumber}`,
        body: body || "Sent an attachment",
        ticketId: ticket.id,
        caseNumber: ticket.caseNumber,
        emails: [
          {
            email: ticket.createdBy.email,
            text: `Support replied to ${ticket.caseNumber}.\n\n${body || "(attachment)"}`,
          },
        ],
      });
    } else {
      const notifyIds = [
        ...(ticket.assignedAdminId ? [ticket.assignedAdminId] : []),
      ];
      if (notifyIds.length === 0) {
        const admins = await this.prisma.user.findMany({
          where: { role: UserRole.ADMIN, status: UserStatus.ACTIVE },
          select: { id: true, email: true },
        });
        await this.notifySupportEvent({
          userIds: admins.map((admin) => admin.id),
          kind: NotificationKind.SUPPORT_TICKET_REPLY,
          title: `User replied · ${ticket.caseNumber}`,
          body: body || "Sent an attachment",
          ticketId: ticket.id,
          caseNumber: ticket.caseNumber,
          emails: admins.map((admin) => ({
            email: admin.email,
            text: `User replied on ${ticket.caseNumber}.\n\n${body || "(attachment)"}`,
          })),
        });
      } else {
        const assignees = await this.prisma.user.findMany({
          where: { id: { in: notifyIds } },
          select: { id: true, email: true },
        });
        await this.notifySupportEvent({
          userIds: notifyIds,
          kind: NotificationKind.SUPPORT_TICKET_REPLY,
          title: `User replied · ${ticket.caseNumber}`,
          body: body || "Sent an attachment",
          ticketId: ticket.id,
          caseNumber: ticket.caseNumber,
          emails: assignees.map((admin) => ({
            email: admin.email,
            text: `User replied on ${ticket.caseNumber}.\n\n${body || "(attachment)"}`,
          })),
        });
      }
    }

    return serializeSupportMessage(message);
  }

  async updateTicket(
    id: string,
    actorId: string,
    data: UpdateSupportTicketDto,
  ) {
    const ticket = await this.loadTicketOrThrow(id, { userId: actorId, isAdmin: true });
    const updates: Prisma.SupportTicketUpdateInput = {};
    const activities: Prisma.SupportActivityCreateManyInput[] = [];

    if (data.category && data.category !== ticket.category) {
      updates.category = data.category;
    }

    if (data.priority && data.priority !== ticket.priority) {
      updates.priority = data.priority;
      const deadlines = this.slaDeadlines(data.priority);
      if (!ticket.firstResponseAt) updates.responseDueAt = deadlines.responseDueAt;
      updates.resolveDueAt = deadlines.resolveDueAt;
      activities.push({
        ticketId: ticket.id,
        actorId,
        type: SupportActivityType.PRIORITY_CHANGED,
        details: { from: ticket.priority, to: data.priority },
      });
    }

    if (data.tags) {
      const tags = [...new Set(data.tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean))];
      updates.tags = tags;
      activities.push({
        ticketId: ticket.id,
        actorId,
        type: SupportActivityType.TAG_ADDED,
        details: { tags },
      });
    }

    if (data.assignedAdminId !== undefined && data.assignedAdminId !== ticket.assignedAdminId) {
      if (data.assignedAdminId) {
        const admin = await this.prisma.user.findFirst({
          where: { id: data.assignedAdminId, role: UserRole.ADMIN },
        });
        if (!admin) throw badRequest("Assigned admin not found");
        updates.assignedAdmin = { connect: { id: data.assignedAdminId } };
      } else {
        updates.assignedAdmin = { disconnect: true };
      }
      activities.push({
        ticketId: ticket.id,
        actorId,
        type: ticket.assignedAdminId
          ? SupportActivityType.REASSIGNED
          : SupportActivityType.ASSIGNED,
        details: {
          from: ticket.assignedAdminId,
          to: data.assignedAdminId,
        },
      });
    }

    let statusChangedTo: SupportTicketStatus | undefined;
    if (data.status && data.status !== ticket.status) {
      statusChangedTo = data.status;
      updates.status = data.status;
      if (data.status === SupportTicketStatus.RESOLVED) {
        updates.resolvedAt = new Date();
      }
      if (data.status === SupportTicketStatus.CLOSED) {
        updates.closedAt = new Date();
        if (!ticket.resolvedAt) updates.resolvedAt = new Date();
      }
      if (
        data.status === SupportTicketStatus.OPEN ||
        data.status === SupportTicketStatus.IN_PROGRESS ||
        data.status === SupportTicketStatus.WAITING_FOR_USER
      ) {
        updates.closedAt = null;
        if (ticket.status === SupportTicketStatus.CLOSED || ticket.status === SupportTicketStatus.RESOLVED) {
          updates.resolvedAt = null;
        }
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.supportTicket.update({
        where: { id: ticket.id },
        data: updates,
        include: detailInclude,
      });

      if (statusChangedTo) {
        await tx.supportStatusHistory.create({
          data: {
            ticketId: ticket.id,
            fromStatus: ticket.status,
            toStatus: statusChangedTo,
            changedById: actorId,
            note: data.note?.trim() || null,
          },
        });
        await tx.supportActivity.create({
          data: {
            ticketId: ticket.id,
            actorId,
            type: SupportActivityType.STATUS_CHANGED,
            details: { from: ticket.status, to: statusChangedTo, note: data.note ?? null },
          },
        });
      }

      if (activities.length) {
        await tx.supportActivity.createMany({ data: activities });
      }

      await tx.auditLog.create({
        data: {
          actorId,
          action: "support.ticket.update",
          resource: "support_ticket",
          resourceId: ticket.id,
          details: data as unknown as Prisma.InputJsonValue,
        },
      });

      return tx.supportTicket.findUniqueOrThrow({
        where: { id: ticket.id },
        include: detailInclude,
      });
    });

    if (statusChangedTo) {
      const kind =
        statusChangedTo === SupportTicketStatus.RESOLVED ||
        statusChangedTo === SupportTicketStatus.CLOSED
          ? NotificationKind.SUPPORT_TICKET_RESOLVED
          : NotificationKind.SUPPORT_TICKET_STATUS;
      await this.notifySupportEvent({
        userIds: [ticket.createdById],
        kind,
        title: `Ticket ${statusChangedTo.toLowerCase().replaceAll("_", " ")} · ${ticket.caseNumber}`,
        body: ticket.subject,
        ticketId: ticket.id,
        caseNumber: ticket.caseNumber,
        emails: [
          {
            email: ticket.createdBy.email,
            text: `Your support ticket ${ticket.caseNumber} is now ${statusChangedTo}.\n\nSubject: ${ticket.subject}`,
          },
        ],
      });
    }

    if (data.assignedAdminId && data.assignedAdminId !== ticket.assignedAdminId) {
      await this.notifySupportEvent({
        userIds: [data.assignedAdminId],
        kind: NotificationKind.SUPPORT_TICKET_ASSIGNED,
        title: `Ticket assigned · ${ticket.caseNumber}`,
        body: ticket.subject,
        ticketId: ticket.id,
        caseNumber: ticket.caseNumber,
      });
    }

    return serializeSupportTicketDetail(updated, { isAdmin: true, userId: actorId });
  }

  async addNote(id: string, actorId: string, data: CreateSupportNoteDto) {
    await this.loadTicketOrThrow(id, { userId: actorId, isAdmin: true });
    const body = this.sanitizeText(data.body);
    if (!body) throw badRequest("Note body is required");

    const note = await this.prisma.$transaction(async (tx) => {
      const created = await tx.supportInternalNote.create({
        data: { ticketId: id, authorId: actorId, body },
        include: { author: { select: userSelect } },
      });
      await tx.supportActivity.create({
        data: {
          ticketId: id,
          actorId,
          type: SupportActivityType.NOTE_ADDED,
          details: { noteId: created.id },
        },
      });
      return created;
    });

    return {
      id: note.id,
      ticketId: note.ticketId,
      body: note.body,
      createdAt: note.createdAt.toISOString(),
      updatedAt: note.updatedAt.toISOString(),
      author: {
        id: note.author.id,
        email: note.author.email,
        displayName: note.author.displayName,
        profileName: note.author.displayName,
        avatarUrl: null,
        role: note.author.role,
      },
    };
  }

  async updateNote(ticketId: string, noteId: string, actorId: string, data: CreateSupportNoteDto) {
    const note = await this.prisma.supportInternalNote.findFirst({
      where: { id: noteId, ticketId },
    });
    if (!note) throw notFound("Internal note not found");
    const body = this.sanitizeText(data.body);
    if (!body) throw badRequest("Note body is required");

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.supportInternalNote.update({
        where: { id: noteId },
        data: { body },
        include: { author: { select: userSelect } },
      });
      await tx.supportActivity.create({
        data: {
          ticketId,
          actorId,
          type: SupportActivityType.NOTE_UPDATED,
          details: { noteId },
        },
      });
      return row;
    });

    return {
      id: updated.id,
      ticketId: updated.ticketId,
      body: updated.body,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
      author: {
        id: updated.author.id,
        email: updated.author.email,
        displayName: updated.author.displayName,
        profileName: updated.author.displayName,
        avatarUrl: null,
        role: updated.author.role,
      },
    };
  }

  async deleteNote(ticketId: string, noteId: string, actorId: string) {
    const note = await this.prisma.supportInternalNote.findFirst({
      where: { id: noteId, ticketId },
    });
    if (!note) throw notFound("Internal note not found");

    await this.prisma.$transaction([
      this.prisma.supportInternalNote.delete({ where: { id: noteId } }),
      this.prisma.supportActivity.create({
        data: {
          ticketId,
          actorId,
          type: SupportActivityType.NOTE_DELETED,
          details: { noteId },
        },
      }),
    ]);

    return { deleted: true as const };
  }

  async reopen(id: string, viewer: { userId: string; isAdmin: boolean }) {
    const ticket = await this.loadTicketOrThrow(id, viewer);
    if (
      ticket.status !== SupportTicketStatus.CLOSED &&
      ticket.status !== SupportTicketStatus.RESOLVED
    ) {
      throw badRequest("Only resolved or closed tickets can be reopened");
    }

    const deadlines = this.slaDeadlines(ticket.priority);
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.supportTicket.update({
        where: { id: ticket.id },
        data: {
          status: SupportTicketStatus.OPEN,
          closedAt: null,
          resolvedAt: null,
          responseDueAt: deadlines.responseDueAt,
          resolveDueAt: deadlines.resolveDueAt,
          firstResponseAt: null,
          unreadByAdmin: viewer.isAdmin ? ticket.unreadByAdmin : { increment: 1 },
          unreadByUser: viewer.isAdmin ? { increment: 1 } : ticket.unreadByUser,
        },
        include: detailInclude,
      });
      await tx.supportStatusHistory.create({
        data: {
          ticketId: ticket.id,
          fromStatus: ticket.status,
          toStatus: SupportTicketStatus.OPEN,
          changedById: viewer.userId,
          note: "Ticket reopened",
        },
      });
      await tx.supportActivity.create({
        data: {
          ticketId: ticket.id,
          actorId: viewer.userId,
          type: SupportActivityType.REOPENED,
          details: { from: ticket.status },
        },
      });
      return row;
    });

    const notifyIds = viewer.isAdmin
      ? [ticket.createdById]
      : ticket.assignedAdminId
        ? [ticket.assignedAdminId]
        : (
            await this.prisma.user.findMany({
              where: { role: UserRole.ADMIN, status: UserStatus.ACTIVE },
              select: { id: true },
            })
          ).map((admin) => admin.id);

    await this.notifySupportEvent({
      userIds: notifyIds,
      kind: NotificationKind.SUPPORT_TICKET_STATUS,
      title: `Ticket reopened · ${ticket.caseNumber}`,
      body: ticket.subject,
      ticketId: ticket.id,
      caseNumber: ticket.caseNumber,
    });

    return serializeSupportTicketDetail(updated, viewer);
  }

  async mergeTickets(targetId: string, actorId: string, data: MergeSupportTicketsDto) {
    if (targetId === data.sourceTicketId) {
      throw badRequest("Cannot merge a ticket into itself");
    }

    const [target, source] = await Promise.all([
      this.loadTicketOrThrow(targetId, { userId: actorId, isAdmin: true }),
      this.loadTicketOrThrow(data.sourceTicketId, { userId: actorId, isAdmin: true }),
    ]);

    await this.prisma.$transaction(async (tx) => {
      await tx.supportMessage.updateMany({
        where: { ticketId: source.id },
        data: { ticketId: target.id },
      });
      await tx.supportAttachment.updateMany({
        where: { ticketId: source.id },
        data: { ticketId: target.id },
      });
      await tx.supportInternalNote.updateMany({
        where: { ticketId: source.id },
        data: { ticketId: target.id },
      });
      await tx.supportTicket.update({
        where: { id: source.id },
        data: {
          mergedIntoId: target.id,
          status: SupportTicketStatus.CLOSED,
          closedAt: new Date(),
        },
      });
      await tx.supportActivity.create({
        data: {
          ticketId: target.id,
          actorId,
          type: SupportActivityType.MERGED,
          details: {
            sourceTicketId: source.id,
            sourceCaseNumber: source.caseNumber,
          },
        },
      });
      await tx.supportActivity.create({
        data: {
          ticketId: source.id,
          actorId,
          type: SupportActivityType.MERGED,
          details: {
            targetTicketId: target.id,
            targetCaseNumber: target.caseNumber,
          },
        },
      });
      await tx.supportTicket.update({
        where: { id: target.id },
        data: {
          lastMessageAt: new Date(),
          tags: [...new Set([...target.tags, ...source.tags, `merged:${source.caseNumber}`])],
        },
      });
    });

    return this.getTicket(targetId, { userId: actorId, isAdmin: true });
  }

  async bulkAction(actorId: string, data: SupportBulkActionDto) {
    const ids = [...new Set(data.ids)];
    let updated = 0;

    for (const id of ids) {
      try {
        if (data.action === "assign") {
          await this.updateTicket(id, actorId, { assignedAdminId: data.assignedAdminId ?? null });
        } else if (data.action === "status" && data.status) {
          await this.updateTicket(id, actorId, { status: data.status });
        } else if (data.action === "priority" && data.priority) {
          await this.updateTicket(id, actorId, { priority: data.priority });
        } else if (data.action === "close") {
          await this.updateTicket(id, actorId, { status: SupportTicketStatus.CLOSED });
        } else if (data.action === "reopen") {
          await this.reopen(id, { userId: actorId, isAdmin: true });
        } else if (data.action === "add_tag" && data.tag) {
          const ticket = await this.prisma.supportTicket.findUnique({ where: { id } });
          if (!ticket) continue;
          const tags = [...new Set([...ticket.tags, data.tag.trim().toLowerCase()])];
          await this.updateTicket(id, actorId, { tags });
        } else if (data.action === "remove_tag" && data.tag) {
          const ticket = await this.prisma.supportTicket.findUnique({ where: { id } });
          if (!ticket) continue;
          const tags = ticket.tags.filter((tag) => tag !== data.tag!.trim().toLowerCase());
          await this.updateTicket(id, actorId, { tags });
        } else {
          continue;
        }
        updated += 1;
      } catch (error) {
        this.logger.warn({ error, id }, "Bulk support action skipped ticket");
      }
    }

    return { updated, total: ids.length };
  }

  async stats() {
    const now = new Date();
    const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const startOfWeek = new Date(startOfDay);
    startOfWeek.setUTCDate(startOfWeek.getUTCDate() - 7);

    const base = { mergedIntoId: null as null };

    const [
      open,
      waitingForUser,
      inProgress,
      resolved,
      closed,
      urgent,
      unassigned,
      slaBreached,
      createdToday,
      createdThisWeek,
      responseSamples,
      resolutionSamples,
    ] = await Promise.all([
      this.prisma.supportTicket.count({ where: { ...base, status: SupportTicketStatus.OPEN } }),
      this.prisma.supportTicket.count({
        where: { ...base, status: SupportTicketStatus.WAITING_FOR_USER },
      }),
      this.prisma.supportTicket.count({
        where: { ...base, status: SupportTicketStatus.IN_PROGRESS },
      }),
      this.prisma.supportTicket.count({
        where: { ...base, status: SupportTicketStatus.RESOLVED },
      }),
      this.prisma.supportTicket.count({
        where: { ...base, status: SupportTicketStatus.CLOSED },
      }),
      this.prisma.supportTicket.count({
        where: {
          ...base,
          priority: SupportTicketPriority.URGENT,
          status: { notIn: [SupportTicketStatus.RESOLVED, SupportTicketStatus.CLOSED] },
        },
      }),
      this.prisma.supportTicket.count({
        where: {
          ...base,
          assignedAdminId: null,
          status: { notIn: [SupportTicketStatus.RESOLVED, SupportTicketStatus.CLOSED] },
        },
      }),
      this.prisma.supportTicket.count({
        where: {
          ...base,
          status: { notIn: [SupportTicketStatus.RESOLVED, SupportTicketStatus.CLOSED] },
          OR: [
            { firstResponseAt: null, responseDueAt: { lt: now } },
            { resolveDueAt: { lt: now } },
          ],
        },
      }),
      this.prisma.supportTicket.count({
        where: { ...base, createdAt: { gte: startOfDay } },
      }),
      this.prisma.supportTicket.count({
        where: { ...base, createdAt: { gte: startOfWeek } },
      }),
      this.prisma.supportTicket.findMany({
        where: { ...base, firstResponseAt: { not: null } },
        select: { createdAt: true, firstResponseAt: true },
        take: 500,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.supportTicket.findMany({
        where: { ...base, resolvedAt: { not: null } },
        select: { createdAt: true, resolvedAt: true },
        take: 500,
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const avg = (samples: number[]) =>
      samples.length === 0
        ? null
        : Math.round(samples.reduce((sum, value) => sum + value, 0) / samples.length);

    return {
      open,
      waitingForUser,
      inProgress,
      resolved,
      closed,
      urgent,
      unassigned,
      slaBreached,
      avgFirstResponseMinutes: avg(
        responseSamples.map(
          (row) => (row.firstResponseAt!.getTime() - row.createdAt.getTime()) / 60_000,
        ),
      ),
      avgResolutionMinutes: avg(
        resolutionSamples.map(
          (row) => (row.resolvedAt!.getTime() - row.createdAt.getTime()) / 60_000,
        ),
      ),
      createdToday,
      createdThisWeek,
    };
  }

  async exportCsv(query: SupportTicketsQueryDto) {
    const where = this.buildWhere(query);
    const rows = await this.prisma.supportTicket.findMany({
      where,
      include: {
        createdBy: { select: { email: true, displayName: true } },
        assignedAdmin: { select: { email: true, displayName: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 5000,
    });

    const escape = (value: string) => `"${value.replaceAll('"', '""')}"`;
    const header = [
      "caseNumber",
      "subject",
      "category",
      "priority",
      "status",
      "createdBy",
      "assignedAdmin",
      "tags",
      "slaBreached",
      "createdAt",
      "updatedAt",
      "closedAt",
    ].join(",");

    const lines = rows.map((row) =>
      [
        row.caseNumber,
        escape(row.subject),
        row.category,
        row.priority,
        row.status,
        escape(row.createdBy.email),
        escape(row.assignedAdmin?.email ?? ""),
        escape(row.tags.join("|")),
        String(isSlaBreached(row)),
        row.createdAt.toISOString(),
        row.updatedAt.toISOString(),
        row.closedAt?.toISOString() ?? "",
      ].join(","),
    );

    return [header, ...lines].join("\n");
  }

  async listCannedResponses() {
    const rows = await this.prisma.supportCannedResponse.findMany({
      include: { createdBy: { select: userSelect } },
      orderBy: { title: "asc" },
    });
    return rows.map(serializeCannedResponse);
  }

  async createCannedResponse(actorId: string, data: CreateCannedResponseDto) {
    const created = await this.prisma.supportCannedResponse.create({
      data: {
        title: this.sanitizeText(data.title),
        body: this.sanitizeText(data.body),
        category: data.category ?? null,
        shortcut: data.shortcut?.trim() || null,
        createdById: actorId,
      },
      include: { createdBy: { select: userSelect } },
    });
    return serializeCannedResponse(created);
  }

  async updateCannedResponse(id: string, data: UpdateCannedResponseDto) {
    const existing = await this.prisma.supportCannedResponse.findUnique({ where: { id } });
    if (!existing) throw notFound("Canned response not found");

    const updated = await this.prisma.supportCannedResponse.update({
      where: { id },
      data: {
        title: data.title !== undefined ? this.sanitizeText(data.title) : undefined,
        body: data.body !== undefined ? this.sanitizeText(data.body) : undefined,
        category: data.category === undefined ? undefined : data.category,
        shortcut:
          data.shortcut === undefined ? undefined : data.shortcut?.trim() || null,
      },
      include: { createdBy: { select: userSelect } },
    });
    return serializeCannedResponse(updated);
  }

  async deleteCannedResponse(id: string) {
    const existing = await this.prisma.supportCannedResponse.findUnique({ where: { id } });
    if (!existing) throw notFound("Canned response not found");
    await this.prisma.supportCannedResponse.delete({ where: { id } });
    return { deleted: true as const };
  }

  setTyping(
    ticketId: string,
    actor: { userId: string; displayName: string },
    isTyping: boolean,
  ) {
    const bucket = this.typingByTicket.get(ticketId) ?? new Map<string, TypingState>();
    if (isTyping) {
      bucket.set(actor.userId, {
        userId: actor.userId,
        displayName: actor.displayName,
        expiresAt: Date.now() + 8_000,
      });
    } else {
      bucket.delete(actor.userId);
    }
    this.typingByTicket.set(ticketId, bucket);
    return this.getTyping(ticketId, actor.userId);
  }

  getTyping(ticketId: string, excludeUserId?: string) {
    const bucket = this.typingByTicket.get(ticketId);
    if (!bucket) return { typers: [] as Array<{ userId: string; displayName: string }> };
    const now = Date.now();
    const typers: Array<{ userId: string; displayName: string }> = [];
    for (const [userId, state] of bucket) {
      if (state.expiresAt < now) {
        bucket.delete(userId);
        continue;
      }
      if (excludeUserId && userId === excludeUserId) continue;
      typers.push({ userId: state.userId, displayName: state.displayName });
    }
    return { typers };
  }
}
