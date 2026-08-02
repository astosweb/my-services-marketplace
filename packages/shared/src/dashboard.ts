export type DashboardMetrics = {
  totalUsers: number;
  totalRequests: number;
  openRequests: number;
  completedRequests: number;
  totalOffers: number;
  totalReviews: number;
  totalConversations: number;
  unreadNotifications: number;
};

export type DashboardTrendPoint = {
  date: string;
  count: number;
};

export type ActivityLogDto = {
  id: string;
  action: string;
  resource: string;
  createdAt: string;
  actorName?: string;
  title?: string;
};

export type DashboardResponse = {
  metrics: DashboardMetrics;
  trend: DashboardTrendPoint[];
  recentActivity: ActivityLogDto[];
  breakdown?: {
    requestsByStatus: Record<string, number>;
  };
  recentRequests?: unknown[];
  health?: { api: boolean; database: boolean };
};
