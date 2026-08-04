export type SupportTicketCategory =
  | "BUG"
  | "FEATURE_REQUEST"
  | "PAYMENT"
  | "ACCOUNT"
  | "VERIFICATION"
  | "ABUSE"
  | "OTHER";

export type SupportTicketPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";

export type SupportTicketStatus =
  | "OPEN"
  | "WAITING_FOR_USER"
  | "IN_PROGRESS"
  | "RESOLVED"
  | "CLOSED";

export type SupportActivityType =
  | "CREATED"
  | "STATUS_CHANGED"
  | "PRIORITY_CHANGED"
  | "ASSIGNED"
  | "REASSIGNED"
  | "MESSAGE_ADDED"
  | "NOTE_ADDED"
  | "NOTE_UPDATED"
  | "NOTE_DELETED"
  | "ATTACHMENT_ADDED"
  | "TAG_ADDED"
  | "TAG_REMOVED"
  | "MERGED"
  | "REOPENED"
  | "SLA_BREACHED"
  | "READ";

export type SupportUserSummaryDto = {
  id: string;
  email: string;
  displayName: string;
  profileName: string;
  avatarUrl: string | null;
  role: string;
  status?: string;
  memberSince?: string;
};

export type SupportAttachmentDto = {
  id: string;
  spacesKey: string;
  url: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  messageId: string | null;
  createdAt: string;
};

export type SupportMessageDto = {
  id: string;
  ticketId: string;
  body: string;
  isStaff: boolean;
  createdAt: string;
  readAt: string | null;
  sender: SupportUserSummaryDto;
  attachments: SupportAttachmentDto[];
};

export type SupportInternalNoteDto = {
  id: string;
  ticketId: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  author: SupportUserSummaryDto;
};

export type SupportStatusHistoryDto = {
  id: string;
  fromStatus: SupportTicketStatus | null;
  toStatus: SupportTicketStatus;
  note: string | null;
  createdAt: string;
  changedBy: SupportUserSummaryDto;
};

export type SupportActivityDto = {
  id: string;
  type: SupportActivityType;
  details: Record<string, unknown> | null;
  createdAt: string;
  actor: SupportUserSummaryDto;
};

export type SupportTicketDto = {
  id: string;
  caseNumber: string;
  subject: string;
  description: string;
  category: SupportTicketCategory;
  priority: SupportTicketPriority;
  status: SupportTicketStatus;
  tags: string[];
  mergedIntoId: string | null;
  firstResponseAt: string | null;
  responseDueAt: string | null;
  resolveDueAt: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
  slaBreached: boolean;
  appVersion: string | null;
  platform: string | null;
  deviceName: string | null;
  systemVersion: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: SupportUserSummaryDto;
  assignedAdmin: SupportUserSummaryDto | null;
  attachmentCount?: number;
  messageCount?: number;
};

export type SupportTicketDetailDto = SupportTicketDto & {
  userAgent: string | null;
  userLastReadAt: string | null;
  adminLastReadAt: string | null;
  messages: SupportMessageDto[];
  attachments: SupportAttachmentDto[];
  internalNotes: SupportInternalNoteDto[];
  statusHistory: SupportStatusHistoryDto[];
  activities: SupportActivityDto[];
  devices?: Array<{
    id: string;
    platform: string;
    name: string | null;
    systemVersion: string | null;
    appVersion: string | null;
    isActive: boolean;
    updatedAt: string;
  }>;
};

export type SupportStatsDto = {
  open: number;
  waitingForUser: number;
  inProgress: number;
  resolved: number;
  closed: number;
  urgent: number;
  unassigned: number;
  slaBreached: number;
  avgFirstResponseMinutes: number | null;
  avgResolutionMinutes: number | null;
  createdToday: number;
  createdThisWeek: number;
};

export type SupportCannedResponseDto = {
  id: string;
  title: string;
  body: string;
  category: SupportTicketCategory | null;
  shortcut: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: SupportUserSummaryDto;
};

export type CreateSupportTicketInput = {
  subject: string;
  description: string;
  category: SupportTicketCategory;
  priority?: SupportTicketPriority;
  attachmentKeys?: string[];
  appVersion?: string;
  platform?: string;
  deviceName?: string;
  systemVersion?: string;
};

export type SendSupportMessageInput = {
  body?: string;
  attachmentKeys?: string[];
};

export type UpdateSupportTicketInput = {
  status?: SupportTicketStatus;
  priority?: SupportTicketPriority;
  assignedAdminId?: string | null;
  tags?: string[];
  category?: SupportTicketCategory;
  note?: string;
};

export type CreateSupportNoteInput = {
  body: string;
};

export type SupportBulkActionInput = {
  ids: string[];
  action: "assign" | "status" | "priority" | "close" | "reopen" | "add_tag" | "remove_tag";
  assignedAdminId?: string | null;
  status?: SupportTicketStatus;
  priority?: SupportTicketPriority;
  tag?: string;
};

export type MergeSupportTicketsInput = {
  sourceTicketId: string;
};

export type CreateCannedResponseInput = {
  title: string;
  body: string;
  category?: SupportTicketCategory | null;
  shortcut?: string | null;
};

export type SupportTicketsQuery = {
  limit?: number;
  offset?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  status?: SupportTicketStatus;
  category?: SupportTicketCategory;
  priority?: SupportTicketPriority;
  assignedAdminId?: string;
  createdById?: string;
  caseNumber?: string;
  tag?: string;
  from?: string;
  to?: string;
  unassigned?: boolean;
  slaBreached?: boolean;
};
