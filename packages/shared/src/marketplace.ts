export type ServiceRequestStatus =
  | "PENDING_REVIEW"
  | "OPEN"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

export type ServiceRequestDto = {
  id: string;
  categoryId: string;
  categoryName: string;
  categorySymbol: string;
  title: string;
  description: string;
  city: string;
  location: string;
  budgetCents: number | null;
  budget: string | null;
  status: ServiceRequestStatus;
  isPremium: boolean;
  offerCount: number;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
  rejectionReason?: string | null;
  requester: {
    id: string;
    profileName: string;
    avatarUrl: string | null;
  };
};

export type AuditLogDto = {
  id: string;
  actorId: string;
  actorName: string;
  actorEmail?: string;
  action: string;
  resource: string;
  resourceId: string;
  details: Record<string, unknown> | null;
  createdAt: string;
};

export type JobProgressEventDto = {
  id: string;
  requestId: string;
  status: string;
  createdAt: string;
};

export type ServiceRequestDetailDto = ServiceRequestDto & {
  latitude: number;
  longitude: number;
  pricingMode: "PROVIDER_OFFERS" | "OWNER_FIXED_PRICE";
  budgetLabel: string | null;
  scheduledAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  photos: Array<{ id: string; spacesKey: string; url: string; sortOrder: number }>;
  offers: OfferDto[];
  reviews: ReviewDto[];
  progressEvents: JobProgressEventDto[];
  auditLogs: AuditLogDto[];
  owner: {
    id: string;
    email: string;
    displayName: string;
    profileName: string;
    businessName: string | null;
    rating: number;
    reviewCount: number;
    avatarUrl: string | null;
    role: string;
    createdAt: string;
  };
};

export type AdminCreateRequestInput = {
  ownerId: string;
  categoryId: string;
  title: string;
  description: string;
  city: string;
  location: string;
  latitude?: number;
  longitude?: number;
  budgetCents?: number;
  budgetLabel?: string;
  pricingMode?: "PROVIDER_OFFERS" | "OWNER_FIXED_PRICE";
  status?: ServiceRequestStatus;
  isPremium?: boolean;
  scheduledAt?: string;
};

export type AdminApproveRequestInput = {
  note?: string;
};

export type AdminRejectRequestInput = {
  reason: string;
};


export type OfferStatus = "PENDING" | "ACCEPTED" | "DECLINED" | "WITHDRAWN";

export type OfferDto = {
  id: string;
  requestId: string;
  priceCents: number | null;
  message: string | null;
  status: OfferStatus;
  createdAt: string;
  offerer: {
    id: string;
    profileName: string;
    avatarUrl: string | null;
  };
  request?: { id: string; title: string };
};

export type ReviewDto = {
  id: string;
  rating: number;
  body: string | null;
  createdAt: string;
  author: {
    id: string;
    profileName: string;
    avatarUrl: string | null;
  };
  subject?: {
    id: string;
    profileName: string;
    avatarUrl: string | null;
  };
  request: { id: string; title: string } | null;
};

export type CategoryDto = {
  id: string;
  name: string;
  symbol: string;
  requestCount?: number;
};

export type ConversationDto = {
  id: string;
  requestId: string;
  requestTitle: string;
  categoryName: string;
  participants: Array<{
    id: string;
    profileName: string;
    avatarUrl: string | null;
  }>;
  lastMessage: {
    body: string;
    createdAt: string;
    senderId: string;
  } | null;
  updatedAt: string;
  createdAt: string;
};

export type ConversationMessageDto = {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar: string | null;
  body: string | null;
  attachmentKey: string | null;
  attachmentUrl: string | null;
  createdAt: string;
};

export type ConversationDetailDto = {
  id: string;
  requestId: string;
  requestTitle: string;
  requestStatus: string;
  participants: Array<{
    id: string;
    profileName: string;
    avatarUrl: string | null;
  }>;
  messages: ConversationMessageDto[];
};

export type RoleDto = {
  name: string;
  permissions: string[];
};

export type PermissionDto = {
  name: string;
  description: string;
};

export type NotificationDto = {
  id: string;
  kind: string;
  title: string;
  body: string;
  contextTag: string | null;
  isRead: boolean;
  createdAt: string;
};

export type NotificationsResponse = {
  items: NotificationDto[];
  meta: {
    total: number;
    limit: number;
    offset: number;
    unreadCount: number;
    page?: number;
    totalPages?: number;
    hasNextPage?: boolean;
    hasPreviousPage?: boolean;
  };
};

export type SystemStatusDto = {
  api: boolean;
  database: boolean;
};

/** Legacy stubs removed from product — kept only if referenced during migration */
export type OrganizationDto = never;
export type AuditAction = string;
