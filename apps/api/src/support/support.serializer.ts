import type {
  SupportActivity,
  SupportAttachment,
  SupportCannedResponse,
  SupportInternalNote,
  SupportMessage,
  SupportStatusHistory,
  SupportTicket,
  User,
} from "../generated/prisma/client.js";
import { mediaUrlForKey, profileName } from "../lib/serializers.js";

type UserPick = Pick<
  User,
  "id" | "email" | "displayName" | "businessName" | "preferBusinessName" | "avatarKey" | "role" | "status" | "createdAt"
>;

function serializeSupportUser(user: UserPick) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    profileName: profileName(user),
    avatarUrl: user.avatarKey ? mediaUrlForKey(user.avatarKey) : null,
    role: user.role,
    status: user.status,
    memberSince: user.createdAt.toISOString(),
  };
}

export function serializeSupportAttachment(attachment: SupportAttachment) {
  return {
    id: attachment.id,
    spacesKey: attachment.spacesKey,
    url: mediaUrlForKey(attachment.spacesKey),
    fileName: attachment.fileName,
    mimeType: attachment.mimeType,
    sizeBytes: attachment.sizeBytes,
    messageId: attachment.messageId,
    createdAt: attachment.createdAt.toISOString(),
  };
}

export function serializeSupportMessage(
  message: SupportMessage & {
    sender: UserPick;
    attachments: SupportAttachment[];
  },
) {
  return {
    id: message.id,
    ticketId: message.ticketId,
    body: message.body,
    isStaff: message.isStaff,
    createdAt: message.createdAt.toISOString(),
    readAt: message.readAt?.toISOString() ?? null,
    sender: serializeSupportUser(message.sender),
    attachments: message.attachments.map(serializeSupportAttachment),
  };
}

function isSlaBreached(ticket: SupportTicket, now = new Date()) {
  if (ticket.status === "RESOLVED" || ticket.status === "CLOSED") return false;
  if (!ticket.firstResponseAt && ticket.responseDueAt && ticket.responseDueAt < now) return true;
  if (ticket.resolveDueAt && ticket.resolveDueAt < now) return true;
  return false;
}

export function serializeSupportTicketListItem(
  ticket: SupportTicket & {
    createdBy: UserPick;
    assignedAdmin: UserPick | null;
    _count?: { attachments: number; messages: number };
  },
  viewer: { isAdmin: boolean; userId: string },
) {
  const unreadCount = viewer.isAdmin ? ticket.unreadByAdmin : ticket.unreadByUser;
  return {
    id: ticket.id,
    caseNumber: ticket.caseNumber,
    subject: ticket.subject,
    description: ticket.description,
    category: ticket.category,
    priority: ticket.priority,
    status: ticket.status,
    tags: ticket.tags,
    mergedIntoId: ticket.mergedIntoId,
    firstResponseAt: ticket.firstResponseAt?.toISOString() ?? null,
    responseDueAt: ticket.responseDueAt?.toISOString() ?? null,
    resolveDueAt: ticket.resolveDueAt?.toISOString() ?? null,
    resolvedAt: ticket.resolvedAt?.toISOString() ?? null,
    closedAt: ticket.closedAt?.toISOString() ?? null,
    lastMessageAt: ticket.lastMessageAt?.toISOString() ?? null,
    unreadCount,
    slaBreached: isSlaBreached(ticket),
    appVersion: ticket.appVersion,
    platform: ticket.platform,
    deviceName: ticket.deviceName,
    systemVersion: ticket.systemVersion,
    createdAt: ticket.createdAt.toISOString(),
    updatedAt: ticket.updatedAt.toISOString(),
    createdBy: serializeSupportUser(ticket.createdBy),
    assignedAdmin: ticket.assignedAdmin ? serializeSupportUser(ticket.assignedAdmin) : null,
    attachmentCount: ticket._count?.attachments,
    messageCount: ticket._count?.messages,
  };
}

export function serializeSupportTicketDetail(
  ticket: SupportTicket & {
    createdBy: UserPick;
    assignedAdmin: UserPick | null;
    messages: Array<
      SupportMessage & { sender: UserPick; attachments: SupportAttachment[] }
    >;
    attachments: SupportAttachment[];
    internalNotes: Array<SupportInternalNote & { author: UserPick }>;
    statusHistory: Array<SupportStatusHistory & { changedBy: UserPick }>;
    activities: Array<SupportActivity & { actor: UserPick }>;
  },
  viewer: { isAdmin: boolean; userId: string },
  devices?: Array<{
    id: string;
    platform: string;
    name: string | null;
    systemVersion: string | null;
    appVersion: string | null;
    isActive: boolean;
    updatedAt: Date;
  }>,
) {
  return {
    ...serializeSupportTicketListItem(ticket, viewer),
    userAgent: ticket.userAgent,
    userLastReadAt: ticket.userLastReadAt?.toISOString() ?? null,
    adminLastReadAt: ticket.adminLastReadAt?.toISOString() ?? null,
    messages: ticket.messages.map(serializeSupportMessage),
    attachments: ticket.attachments.map(serializeSupportAttachment),
    internalNotes: viewer.isAdmin
      ? ticket.internalNotes.map((note) => ({
          id: note.id,
          ticketId: note.ticketId,
          body: note.body,
          createdAt: note.createdAt.toISOString(),
          updatedAt: note.updatedAt.toISOString(),
          author: serializeSupportUser(note.author),
        }))
      : [],
    statusHistory: ticket.statusHistory.map((row) => ({
      id: row.id,
      fromStatus: row.fromStatus,
      toStatus: row.toStatus,
      note: row.note,
      createdAt: row.createdAt.toISOString(),
      changedBy: serializeSupportUser(row.changedBy),
    })),
    activities: ticket.activities.map((activity) => ({
      id: activity.id,
      type: activity.type,
      details: (activity.details as Record<string, unknown> | null) ?? null,
      createdAt: activity.createdAt.toISOString(),
      actor: serializeSupportUser(activity.actor),
    })),
    devices: devices?.map((device) => ({
      id: device.id,
      platform: device.platform,
      name: device.name,
      systemVersion: device.systemVersion,
      appVersion: device.appVersion,
      isActive: device.isActive,
      updatedAt: device.updatedAt.toISOString(),
    })),
  };
}

export function serializeCannedResponse(
  response: SupportCannedResponse & { createdBy: UserPick },
) {
  return {
    id: response.id,
    title: response.title,
    body: response.body,
    category: response.category,
    shortcut: response.shortcut,
    createdAt: response.createdAt.toISOString(),
    updatedAt: response.updatedAt.toISOString(),
    createdBy: serializeSupportUser(response.createdBy),
  };
}

export { serializeSupportUser, isSlaBreached };
