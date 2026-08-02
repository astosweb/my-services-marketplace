export type ServiceRequestStatus =
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
  requester: {
    id: string;
    profileName: string;
    avatarUrl: string | null;
  };
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
