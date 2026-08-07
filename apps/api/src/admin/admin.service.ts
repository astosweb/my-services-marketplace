import { Injectable, Logger } from "@nestjs/common";
import {
  NotificationKind,
  Prisma,
  ServiceRequestStatus,
  UserRole,
  UserStatus,
  type User,
} from "../generated/prisma/client.js";
import { ADMIN_PERMISSIONS, permissionsForRole } from "../lib/admin-permissions.js";
import { toCsv } from "../lib/csv.js";
import { badRequest, forbidden, notFound } from "../lib/errors.js";
import {
  mediaUrlForKey,
  messagePreviewText,
  profileName,
  serializeCategory,
  serializeMe,
  serializeOffer,
  serializeRequest,
  serializeReview,
  serializeUser,
} from "../lib/serializers.js";
import { refreshUserRating } from "../lib/user-rating.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { PushService } from "../push/push.service.js";
import { RealtimePublisher } from "../realtime/realtime.publisher.js";
import type {
  AdminApproveRequestDto,
  AdminAuditLogsQueryDto,
  AdminBulkUsersDto,
  AdminConversationsQueryDto,
  AdminCreateRequestDto,
  AdminOffersQueryDto,
  AdminRejectRequestDto,
  AdminRequestsQueryDto,
  AdminReviewsQueryDto,
  AdminUpdateOfferDto,
  AdminUpdateRequestDto,
  AdminUpdateUserDto,
  AdminUsersQueryDto,
} from "./admin.dto.js";

const chartDays = 14;

const requestListInclude = {
  category: true,
  owner: true,
  photos: true,
  _count: { select: { offers: true } },
};

const userCountsSelect = { requests: true, offers: true, reviewsReceived: true };

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pushService: PushService,
    private readonly realtime: RealtimePublisher,
  ) {}

  private adminUser(
    user: User,
    counts?: { requests: number; offers: number; reviewsReceived: number },
  ) {
    const base = serializeMe(user);
    return {
      ...base,
      status: user.status,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
      requestCount: counts?.requests,
      offerCount: counts?.offers,
      reviewsReceivedCount: counts?.reviewsReceived,
    };
  }

  private databaseReachable() {
    return this.prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false);
  }

  async dashboardStats() {
    const chartStart = new Date();
    chartStart.setUTCHours(0, 0, 0, 0);
    chartStart.setUTCDate(chartStart.getUTCDate() - (chartDays - 1));

    const [
      users,
      requests,
      requestGroups,
      offers,
      reviews,
      conversations,
      unreadNotifications,
      recentUsers,
      recentRequests,
      recentAuditLogs,
      database,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.serviceRequest.count(),
      this.prisma.serviceRequest.groupBy({ by: ["status"], _count: { _all: true } }),
      this.prisma.offer.count(),
      this.prisma.review.count(),
      this.prisma.conversation.count(),
      this.prisma.notification.count({ where: { isRead: false } }),
      this.prisma.user.findMany({ orderBy: { createdAt: "desc" }, take: 5 }),
      this.prisma.serviceRequest.findMany({
        include: requestListInclude,
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      this.prisma.auditLog.findMany({
        include: { actor: true },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      this.databaseReachable(),
    ]);

    let chartRequests: Array<{ day: Date; count: bigint }> = [];
    try {
      chartRequests = await this.prisma.$queryRaw<Array<{ day: Date; count: bigint }>>`
        SELECT date_trunc('day', "createdAt") AS day, COUNT(*)::bigint AS count
        FROM "ServiceRequest"
        WHERE "createdAt" >= ${chartStart}
        GROUP BY 1
        ORDER BY 1
      `;
    } catch (error) {
      this.logger.warn(
        `Dashboard chart query failed; continuing without trend data: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    const requestsByStatus = Object.fromEntries(
      Object.values(ServiceRequestStatus).map((status) => [status, 0]),
    ) as Record<ServiceRequestStatus, number>;
    for (const group of requestGroups) requestsByStatus[group.status] = group._count._all;

    const dailyCounts = new Map<string, number>();
    for (let day = 0; day < chartDays; day += 1) {
      const date = new Date(chartStart);
      date.setUTCDate(chartStart.getUTCDate() + day);
      dailyCounts.set(date.toISOString().slice(0, 10), 0);
    }
    for (const row of chartRequests) {
      const date = new Date(row.day).toISOString().slice(0, 10);
      dailyCounts.set(date, Number(row.count));
    }

    const syntheticActivity = [
      ...recentUsers.map((user) => ({
        id: `user-${user.id}`,
        action: "USER_JOINED",
        resource: "user",
        createdAt: user.createdAt.toISOString(),
        actorName: serializeUser(user).profileName,
      })),
      ...recentRequests.map((request) => ({
        id: `request-${request.id}`,
        action: "REQUEST_CREATED",
        resource: "request",
        createdAt: request.createdAt.toISOString(),
        actorName: serializeUser(request.owner).profileName,
        title: request.title,
      })),
    ]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 10);

    const auditActivity = recentAuditLogs.map((log) => ({
      id: log.id,
      action: log.action,
      resource: log.resource,
      createdAt: log.createdAt.toISOString(),
      actorName: log.actor ? profileName(log.actor) : "System",
      title: log.resourceId,
    }));

    return {
      metrics: {
        totalUsers: users,
        totalRequests: requests,
        openRequests: requestsByStatus.OPEN,
        completedRequests: requestsByStatus.COMPLETED,
        totalOffers: offers,
        totalReviews: reviews,
        totalConversations: conversations,
        unreadNotifications,
      },
      breakdown: { requestsByStatus },
      trend: [...dailyCounts].map(([date, count]) => ({ date, count })),
      recentActivity: auditActivity.length > 0 ? auditActivity : syntheticActivity,
      recentUsers: recentUsers.map((user) => this.adminUser(user)),
      recentRequests: recentRequests.map((request) => serializeRequest(request)),
      health: { ok: database, api: true, database },
    };
  }

  async listAuditLogs(query: AdminAuditLogsQueryDto) {
    const createdAt: Prisma.DateTimeFilter = {};
    if (query.from) {
      const from = new Date(query.from);
      if (Number.isNaN(from.getTime())) throw badRequest("Invalid from date");
      createdAt.gte = from;
    }
    if (query.to) {
      const to = new Date(query.to);
      if (Number.isNaN(to.getTime())) throw badRequest("Invalid to date");
      createdAt.lte = to;
    }

    const where: Prisma.AuditLogWhereInput = {
      ...(query.action ? { action: query.action } : {}),
      ...(query.resource ? { resource: query.resource } : {}),
      ...(query.actorId ? { actorId: query.actorId } : {}),
      ...(Object.keys(createdAt).length > 0 ? { createdAt } : {}),
      ...(query.search
        ? {
            OR: [
              { action: { contains: query.search, mode: "insensitive" as const } },
              { resource: { contains: query.search, mode: "insensitive" as const } },
              { resourceId: { contains: query.search, mode: "insensitive" as const } },
              {
                actor: {
                  OR: [
                    { email: { contains: query.search, mode: "insensitive" as const } },
                    { displayName: { contains: query.search, mode: "insensitive" as const } },
                  ],
                },
              },
            ],
          }
        : {}),
    };

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: { actor: true },
        orderBy: { createdAt: "desc" },
        take: query.limit,
        skip: query.offset,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      data: logs.map((log) => this.serializeAuditLog(log)),
      meta: { total, limit: query.limit, offset: query.offset },
    };
  }

  async listUsers(query: AdminUsersQueryDto) {
    const where: Prisma.UserWhereInput = {
      role: query.role,
      status: query.status,
      ...(query.search
        ? {
            OR: [
              { email: { contains: query.search, mode: "insensitive" as const } },
              { displayName: { contains: query.search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };
    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: { _count: { select: userCountsSelect } },
        orderBy: { [query.sortBy]: query.sortOrder },
        take: query.limit,
        skip: query.offset,
      }),
      this.prisma.user.count({ where }),
    ]);
    return {
      data: users.map((user) => this.adminUser(user, user._count)),
      meta: { total, limit: query.limit, offset: query.offset },
    };
  }

  async getUser(id: string) {
    const now = new Date();
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { _count: { select: userCountsSelect } },
    });
    if (!user) throw notFound("User not found");

    const [
      requests,
      offers,
      reviewsReceived,
      reviewsGiven,
      refreshTokens,
      deviceTokens,
      passwordResetTokens,
      auditLogs,
      notifications,
      conversationParticipants,
      notificationCount,
      conversationCount,
    ] = await Promise.all([
      this.prisma.serviceRequest.findMany({
        where: { ownerId: id },
        include: requestListInclude,
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      this.prisma.offer.findMany({
        where: { offererId: id },
        include: {
          offerer: true,
          request: { select: { id: true, title: true, status: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      this.prisma.review.findMany({
        where: { subjectId: id },
        include: { author: true, subject: true, request: true },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      this.prisma.review.findMany({
        where: { authorId: id },
        include: { author: true, subject: true, request: true },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      this.prisma.refreshToken.findMany({
        where: { userId: id },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      this.prisma.deviceToken.findMany({
        where: { userId: id },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      this.prisma.passwordResetToken.findMany({
        where: { userId: id, expiresAt: { gt: now } },
        orderBy: { createdAt: "desc" },
        take: 1,
      }),
      this.prisma.auditLog.findMany({
        where: {
          OR: [
            { actorId: id },
            { resource: "user", resourceId: id },
          ],
        },
        include: { actor: true },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      this.prisma.notification.findMany({
        where: { userId: id },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
      this.prisma.conversationParticipant.findMany({
        where: { userId: id },
        include: {
          conversation: {
            include: {
              request: { select: { id: true, title: true, status: true } },
              participants: { include: { user: true } },
              messages: { orderBy: { createdAt: "desc" }, take: 1 },
              _count: { select: { messages: true } },
            },
          },
        },
        take: 20,
      }),
      this.prisma.notification.count({ where: { userId: id } }),
      this.prisma.conversationParticipant.count({ where: { userId: id } }),
    ]);

    const sessions = refreshTokens.map((token) => ({
      id: token.id,
      ipAddress: token.ipAddress,
      userAgent: token.userAgent,
      lastUsedAt: token.lastUsedAt.toISOString(),
      createdAt: token.createdAt.toISOString(),
      expiresAt: token.expiresAt.toISOString(),
      isExpired: token.expiresAt < now,
    }));
    const activeSession = sessions.find((session) => !session.isExpired) ?? sessions[0] ?? null;
    const pendingReset = passwordResetTokens[0] ?? null;

    const conversations = conversationParticipants
      .map((participant) => participant.conversation)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .map((conversation) => {
        const lastMessage = conversation.messages[0];
        return {
          id: conversation.id,
          requestId: conversation.requestId,
          requestTitle: conversation.request.title,
          requestStatus: conversation.request.status,
          messageCount: conversation._count.messages,
          lastMessageAt: lastMessage ? lastMessage.createdAt.toISOString() : null,
          otherParticipants: conversation.participants
            .filter((p) => p.userId !== id)
            .map((p) => serializeUser(p.user)),
        };
      });

    return {
      ...this.adminUser(user, user._count),
      preferBusinessName: user.preferBusinessName,
      memberSince: user.createdAt.toISOString(),
      hasPassword: Boolean(user.passwordHash),
      lastLoginAt: activeSession?.lastUsedAt ?? activeSession?.createdAt ?? null,
      lastLoginIp: activeSession?.ipAddress ?? null,
      sessionCount: sessions.length,
      activeSessionCount: sessions.filter((session) => !session.isExpired).length,
      deviceCount: deviceTokens.length,
      notificationCount,
      conversationCount,
      pendingPasswordReset: pendingReset
        ? {
            createdAt: pendingReset.createdAt.toISOString(),
            expiresAt: pendingReset.expiresAt.toISOString(),
          }
        : null,
      sessions,
      devices: deviceTokens.map((device) => ({
        id: device.id,
        platform: device.platform,
        tokenPreview: device.token.length <= 4 ? "••••" : `…${device.token.slice(-4)}`,
        name: device.name,
        systemVersion: device.systemVersion,
        appVersion: device.appVersion,
        ipAddress: device.ipAddress,
        userAgent: device.userAgent,
        isActive: device.isActive,
        createdAt: device.createdAt.toISOString(),
        updatedAt: device.updatedAt.toISOString(),
      })),
      auditLogs: auditLogs.map((log) => this.serializeAuditLog(log)),
      notifications: notifications.map((notification) => ({
        id: notification.id,
        kind: notification.kind,
        title: notification.title,
        body: notification.body,
        isRead: notification.isRead,
        createdAt: notification.createdAt.toISOString(),
      })),
      conversations,
      requests: requests.map((request) => {
        const serialized = serializeRequest(request);
        return {
          id: serialized.id,
          title: serialized.title,
          description: serialized.description,
          status: serialized.status,
          city: serialized.city,
          location: serialized.location,
          budget: serialized.budget,
          budgetCents: serialized.budgetCents,
          pricingMode: serialized.pricingMode,
          isPremium: serialized.isPremium,
          scheduledAt: serialized.scheduledAt,
          offerCount: serialized.offerCount,
          createdAt: serialized.createdAt,
          categoryId: serialized.categoryId,
          categoryName: serialized.categoryName,
          categorySymbol: serialized.categorySymbol,
        };
      }),
      offers: offers.map((offer) => ({
        ...serializeOffer(offer),
        request: offer.request,
      })),
      reviewsReceived: reviewsReceived.map((review) => ({
        ...serializeReview(review),
        subject: serializeUser(review.subject),
      })),
      reviewsGiven: reviewsGiven.map((review) => ({
        ...serializeReview(review),
        subject: serializeUser(review.subject),
      })),
    };
  }

  async updateUser(id: string, adminId: string, data: AdminUpdateUserDto) {
    if (Object.keys(data).length === 0) throw badRequest("No fields to update");
    const existing = await this.prisma.user.findUnique({
      where: { id },
      select: { role: true, status: true, displayName: true, bio: true, businessName: true },
    });
    if (!existing) throw notFound("User not found");
    if (id === adminId && data.role && data.role !== existing.role) {
      throw forbidden("You cannot change your own role");
    }
    if (id === adminId && data.status === UserStatus.BANNED) {
      throw forbidden("You cannot ban your own account");
    }

    const updated = await this.prisma.$transaction(async (transaction) => {
      const user = await transaction.user.update({ where: { id }, data });
      if (data.status === UserStatus.BANNED && existing.status !== UserStatus.BANNED) {
        await transaction.refreshToken.deleteMany({ where: { userId: id } });
        await transaction.deviceToken.deleteMany({ where: { userId: id } });
      }
      return user;
    });

    await this.logAudit(adminId, "USER_UPDATED", "user", id, {
      changes: data,
      previous: {
        role: existing.role,
        status: existing.status,
        displayName: existing.displayName,
        bio: existing.bio,
        businessName: existing.businessName,
      },
    });
    if (data.status === UserStatus.BANNED && existing.status !== UserStatus.BANNED) {
      this.realtime.presenceUpdate({ userId: id, status: "offline" });
    }
    return this.adminUser(updated);
  }

  async deleteUser(id: string, adminId: string) {
    if (id === adminId) throw forbidden("You cannot delete your own account");
    const existing = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, displayName: true },
    });
    if (!existing) throw notFound("User not found");
    await this.logAudit(adminId, "USER_DELETED", "user", id, {
      email: existing.email,
      displayName: existing.displayName,
    });
    const { count } = await this.prisma.user.deleteMany({ where: { id } });
    if (!count) throw notFound("User not found");
  }

  async revokeUserSession(userId: string, sessionId: string, adminId: string) {
    const session = await this.prisma.refreshToken.findFirst({
      where: { id: sessionId, userId },
      select: { id: true, ipAddress: true, userAgent: true },
    });
    if (!session) throw notFound("Session not found");
    await this.prisma.refreshToken.delete({ where: { id: session.id } });
    await this.logAudit(adminId, "SESSION_REVOKED", "user", userId, {
      sessionId: session.id,
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
    });
    return { revoked: true as const, sessionId: session.id };
  }

  async revokeAllUserSessions(userId: string, adminId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) throw notFound("User not found");
    const { count } = await this.prisma.refreshToken.deleteMany({ where: { userId } });
    await this.logAudit(adminId, "SESSIONS_REVOKED", "user", userId, { count });
    return { revoked: count };
  }

  async revokeUserDevice(userId: string, deviceId: string, adminId: string) {
    const device = await this.prisma.deviceToken.findFirst({
      where: { id: deviceId, userId },
      select: {
        id: true,
        platform: true,
        name: true,
        token: true,
        ipAddress: true,
      },
    });
    if (!device) throw notFound("Device not found");
    await this.prisma.deviceToken.delete({ where: { id: device.id } });
    await this.logAudit(adminId, "DEVICE_REVOKED", "user", userId, {
      deviceId: device.id,
      platform: device.platform,
      name: device.name,
      ipAddress: device.ipAddress,
      tokenPreview: device.token.length <= 4 ? "••••" : `…${device.token.slice(-4)}`,
    });
    return { revoked: true as const, deviceId: device.id };
  }

  async revokeAllUserDevices(userId: string, adminId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) throw notFound("User not found");
    const { count } = await this.prisma.deviceToken.deleteMany({ where: { userId } });
    await this.logAudit(adminId, "DEVICES_REVOKED", "user", userId, { count });
    return { revoked: count };
  }

  async bulkUsers(adminId: string, data: AdminBulkUsersDto) {
    if (data.ids.includes(adminId) && (data.action === "delete" || data.action === "ban")) {
      throw forbidden("You cannot ban or delete your own account");
    }

    if (data.action === "delete") {
      const { count } = await this.prisma.user.deleteMany({ where: { id: { in: data.ids } } });
      return { affected: count, action: data.action };
    }

    const status = data.action === "ban" ? UserStatus.BANNED : UserStatus.ACTIVE;
    const { count } = await this.prisma.user.updateMany({
      where: { id: { in: data.ids } },
      data: { status },
    });

    if (data.action === "ban") {
      await Promise.all([
        this.prisma.refreshToken.deleteMany({ where: { userId: { in: data.ids } } }),
        this.prisma.deviceToken.deleteMany({ where: { userId: { in: data.ids } } }),
      ]);
    }

    await this.logAudit(
      adminId,
      data.action === "ban" ? "USERS_BANNED" : "USERS_UNBANNED",
      "user",
      adminId,
      { ids: data.ids, count },
    );

    return { affected: count, action: data.action };
  }

  async exportUsersCsv() {
    const users = await this.prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 10_000,
    });
    return toCsv(
      ["id", "email", "displayName", "businessName", "role", "rating", "reviewCount", "createdAt"],
      users.map((user) => [
        user.id,
        user.email,
        user.displayName,
        user.businessName ?? "",
        user.role,
        user.rating.toFixed(2),
        user.reviewCount,
        user.createdAt.toISOString(),
      ]),
    );
  }

  private async logAudit(
    actorId: string,
    action: string,
    resource: string,
    resourceId: string,
    details?: Record<string, unknown>,
  ) {
    return this.prisma.auditLog.create({
      data: {
        actorId,
        action,
        resource,
        resourceId,
        details: details ? (details as Prisma.InputJsonValue) : Prisma.JsonNull,
      },
    });
  }

  private serializeAuditLog(
    log: {
      id: string;
      actorId: string | null;
      action: string;
      resource: string;
      resourceId: string;
      details: Prisma.JsonValue | null;
      createdAt: Date;
      actor: User | null;
    },
  ) {
    return {
      id: log.id,
      actorId: log.actorId,
      actorName: log.actor ? profileName(log.actor) : "Deleted user",
      actorEmail: log.actor?.email ?? null,
      action: log.action,
      resource: log.resource,
      resourceId: log.resourceId,
      details: (log.details as Record<string, unknown> | null) ?? null,
      createdAt: log.createdAt.toISOString(),
    };
  }

  async createRequest(adminId: string, data: AdminCreateRequestDto) {
    const owner = await this.prisma.user.findUnique({
      where: { id: data.ownerId },
      select: { id: true },
    });
    if (!owner) throw notFound("Owner user not found");

    const category = await this.prisma.category.findUnique({
      where: { id: data.categoryId },
      select: { id: true },
    });
    if (!category) throw notFound("Category not found");

    const created = await this.prisma.serviceRequest.create({
      data: {
        ownerId: data.ownerId,
        categoryId: data.categoryId,
        title: data.title,
        description: data.description,
        city: data.city,
        location: data.location,
        latitude: data.latitude ?? 59.437,
        longitude: data.longitude ?? 24.7535,
        budgetCents: data.budgetCents ?? null,
        budgetLabel: data.budgetLabel ?? null,
        pricingMode: data.pricingMode ?? "PROVIDER_OFFERS",
        status: data.status ?? ServiceRequestStatus.OPEN,
        isPremium: data.isPremium ?? false,
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
      },
    });

    await this.logAudit(adminId, "REQUEST_CREATED", "request", created.id, {
      title: created.title,
      ownerId: created.ownerId,
      city: created.city,
      status: created.status,
    });

    return this.getRequest(created.id);
  }

  async listRequests(query: AdminRequestsQueryDto) {
    const where: Prisma.ServiceRequestWhereInput = {
      status: query.status,
      city: query.city,
      categoryId: query.categoryId,
      ...(query.isPremium !== undefined ? { isPremium: query.isPremium } : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: "insensitive" as const } },
              { description: { contains: query.search, mode: "insensitive" as const } },
              { location: { contains: query.search, mode: "insensitive" as const } },
              { owner: { displayName: { contains: query.search, mode: "insensitive" as const } } },
              { owner: { email: { contains: query.search, mode: "insensitive" as const } } },
            ],
          }
        : {}),
    };
    const [requests, total] = await Promise.all([
      this.prisma.serviceRequest.findMany({
        where,
        include: requestListInclude,
        orderBy: { [query.sortBy]: query.sortOrder },
        take: query.limit,
        skip: query.offset,
      }),
      this.prisma.serviceRequest.count({ where }),
    ]);
    return {
      data: requests.map((request) => serializeRequest(request)),
      meta: { total, limit: query.limit, offset: query.offset },
    };
  }

  async getRequest(id: string) {
    const request = await this.prisma.serviceRequest.findUnique({
      where: { id },
      include: {
        ...requestListInclude,
        owner: true,
        category: true,
        photos: { orderBy: { sortOrder: "asc" } },
        progressEvents: { orderBy: { createdAt: "asc" } },
        offers: { include: { offerer: true }, orderBy: { createdAt: "desc" } },
        reviews: { include: { author: true, subject: true, request: true } },
      },
    });
    if (!request) throw notFound("Request not found");

    const offerIds = request.offers.map((offer) => offer.id);
    const reviewIds = request.reviews.map((review) => review.id);
    const auditLogs = await this.prisma.auditLog.findMany({
      where: {
        OR: [
          { resource: "request", resourceId: id },
          ...(offerIds.length > 0
            ? [{ resource: "offer", resourceId: { in: offerIds } }]
            : []),
          ...(reviewIds.length > 0
            ? [{ resource: "review", resourceId: { in: reviewIds } }]
            : []),
        ],
      },
      include: { actor: true },
      orderBy: { createdAt: "desc" },
    });

    return {
      ...serializeRequest(request),
      latitude: request.latitude,
      longitude: request.longitude,
      pricingMode: request.pricingMode,
      budgetLabel: request.budgetLabel,
      scheduledAt: request.scheduledAt ? request.scheduledAt.toISOString() : null,
      completedAt: request.completedAt ? request.completedAt.toISOString() : null,
      cancelledAt: request.cancelledAt ? request.cancelledAt.toISOString() : null,
      photos: request.photos.map((photo) => ({
        id: photo.id,
        spacesKey: photo.spacesKey,
        url: mediaUrlForKey(photo.spacesKey),
        sortOrder: photo.sortOrder,
      })),
      offers: request.offers.map(serializeOffer),
      reviews: request.reviews.map(serializeReview),
      progressEvents: request.progressEvents.map((e) => ({
        id: e.id,
        requestId: e.requestId,
        status: e.status,
        createdAt: e.createdAt.toISOString(),
      })),
      auditLogs: auditLogs.map((log) => this.serializeAuditLog(log)),
      owner: {
        id: request.owner.id,
        email: request.owner.email,
        displayName: request.owner.displayName,
        profileName: profileName(request.owner),
        businessName: request.owner.businessName,
        rating: request.owner.rating,
        reviewCount: request.owner.reviewCount,
        avatarUrl: request.owner.avatarKey ? mediaUrlForKey(request.owner.avatarKey) : null,
        role: request.owner.role,
        createdAt: request.owner.createdAt.toISOString(),
      },
    };
  }

  async updateRequest(id: string, adminId: string, data: AdminUpdateRequestDto) {
    if (Object.keys(data).length === 0) throw badRequest("No fields to update");
    const existing = await this.prisma.serviceRequest.findUnique({
      where: { id },
      select: { id: true, status: true, title: true },
    });
    if (!existing) throw notFound("Request not found");

    if (data.categoryId) {
      const category = await this.prisma.category.findUnique({
        where: { id: data.categoryId },
        select: { id: true },
      });
      if (!category) throw notFound("Category not found");
    }

    const now = new Date();
    const updateData: Prisma.ServiceRequestUpdateInput = {
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.categoryId !== undefined ? { category: { connect: { id: data.categoryId } } } : {}),
      ...(data.city !== undefined ? { city: data.city } : {}),
      ...(data.location !== undefined ? { location: data.location } : {}),
      ...(data.budgetCents !== undefined ? { budgetCents: data.budgetCents } : {}),
      ...(data.budgetLabel !== undefined ? { budgetLabel: data.budgetLabel } : {}),
      ...(data.pricingMode !== undefined ? { pricingMode: data.pricingMode } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.isPremium !== undefined ? { isPremium: data.isPremium } : {}),
      ...(data.scheduledAt !== undefined
        ? { scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null }
        : {}),
      ...(data.status === ServiceRequestStatus.COMPLETED ? { completedAt: now } : {}),
      ...(data.status === ServiceRequestStatus.CANCELLED ? { cancelledAt: now } : {}),
      ...(data.status === ServiceRequestStatus.OPEN
        ? { cancelledAt: null, rejectionReason: null }
        : {}),
      ...(data.status === ServiceRequestStatus.PENDING_REVIEW
        ? { cancelledAt: null, rejectionReason: null }
        : {}),
    };

    await this.prisma.serviceRequest.update({
      where: { id },
      data: updateData,
    });

    await this.logAudit(adminId, "REQUEST_EDITED", "request", id, {
      changes: data,
    });

    return this.getRequest(id);
  }

  async approveRequest(id: string, adminId: string, data: AdminApproveRequestDto) {
    const existing = await this.prisma.serviceRequest.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        ownerId: true,
        status: true,
        categoryId: true,
        category: { select: { id: true, name: true } },
      },
    });
    if (!existing) throw notFound("Request not found");
    if (
      existing.status !== ServiceRequestStatus.PENDING_REVIEW &&
      existing.status !== ServiceRequestStatus.CANCELLED
    ) {
      throw badRequest("Only pending or rejected requests can be approved");
    }

    await this.prisma.serviceRequest.update({
      where: { id },
      data: {
        status: ServiceRequestStatus.OPEN,
        cancelledAt: null,
        rejectionReason: null,
      },
    });

    await this.logAudit(adminId, "REQUEST_APPROVED", "request", id, {
      note: data.note ?? null,
      previousStatus: existing.status,
      categoryId: existing.categoryId,
    });

    await this.prisma.notification.create({
      data: {
        userId: existing.ownerId,
        kind: NotificationKind.SYSTEM,
        title: "Request Approved",
        body: data.note
          ? `Your request "${existing.title}" was approved: ${data.note}`
          : `Your request "${existing.title}" has been approved and is now public.`,
        contextTag: "request",
        payload: { requestId: id, action: "APPROVED" },
      },
    });

    try {
      const pushResult = await this.pushService.notifyCategorySubscribersOfApprovedRequest({
        requestId: existing.id,
        categoryId: existing.category.id,
        categoryName: existing.category.name,
        title: existing.title,
        ownerId: existing.ownerId,
      });
      this.logger.log({
        msg: "Category approval push complete",
        requestId: id,
        categoryId: existing.categoryId,
        ...pushResult,
      });
    } catch (error) {
      this.logger.error(
        `Failed to notify category subscribers for request ${id}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    const approvedRequest = await this.getRequest(id);
    this.realtime.requestModeration({
      requestId: id,
      ownerId: existing.ownerId,
      status: ServiceRequestStatus.OPEN,
    });
    this.realtime.requestUpdated({
      requestId: id,
      ownerId: existing.ownerId,
      request: approvedRequest as Record<string, unknown>,
      reason: "approved",
    });

    return approvedRequest;
  }

  async rejectRequest(id: string, adminId: string, data: AdminRejectRequestDto) {
    const existing = await this.prisma.serviceRequest.findUnique({
      where: { id },
      select: { id: true, title: true, ownerId: true, status: true },
    });
    if (!existing) throw notFound("Request not found");
    if (existing.status === ServiceRequestStatus.CANCELLED) {
      throw badRequest("Request is already cancelled");
    }
    if (existing.status === ServiceRequestStatus.COMPLETED) {
      throw badRequest("Completed requests cannot be rejected");
    }

    const reason = data.reason.trim();
    const now = new Date();
    await this.prisma.serviceRequest.update({
      where: { id },
      data: {
        status: ServiceRequestStatus.CANCELLED,
        cancelledAt: now,
        rejectionReason: reason,
      },
    });

    await this.logAudit(adminId, "REQUEST_REJECTED", "request", id, {
      reason,
      previousStatus: existing.status,
    });

    await this.prisma.notification.create({
      data: {
        userId: existing.ownerId,
        kind: NotificationKind.SYSTEM,
        title: "Request Rejected",
        body: `Your request "${existing.title}" was rejected. Reason: ${reason}`,
        contextTag: "request",
        payload: { requestId: id, action: "REJECTED", reason },
      },
    });

    const rejectedRequest = await this.getRequest(id);
    this.realtime.requestModeration({
      requestId: id,
      ownerId: existing.ownerId,
      status: ServiceRequestStatus.CANCELLED,
      reason,
    });
    this.realtime.requestUpdated({
      requestId: id,
      ownerId: existing.ownerId,
      request: rejectedRequest as Record<string, unknown>,
      reason: "rejected",
    });

    return rejectedRequest;
  }

  async deleteRequest(id: string, adminId: string) {
    const existing = await this.prisma.serviceRequest.findUnique({
      where: { id },
      select: { id: true, title: true, ownerId: true },
    });
    if (!existing) throw notFound("Request not found");

    await this.logAudit(adminId, "REQUEST_DELETED", "request", id, {
      title: existing.title,
      ownerId: existing.ownerId,
    });

    await this.prisma.serviceRequest.delete({ where: { id } });
  }

  async listOffers(query: AdminOffersQueryDto) {
    const where: Prisma.OfferWhereInput = { status: query.status, requestId: query.requestId };
    const [offers, total] = await Promise.all([
      this.prisma.offer.findMany({
        where,
        include: {
          offerer: true,
          request: { select: { id: true, title: true, status: true } },
        },
        orderBy: { [query.sortBy]: query.sortOrder },
        take: query.limit,
        skip: query.offset,
      }),
      this.prisma.offer.count({ where }),
    ]);
    return {
      data: offers.map((offer) => ({ ...serializeOffer(offer), request: offer.request })),
      meta: { total, limit: query.limit, offset: query.offset },
    };
  }

  async updateOffer(id: string, adminId: string, data: AdminUpdateOfferDto) {
    const existing = await this.prisma.offer.findUnique({
      where: { id },
      include: { offerer: true, request: { select: { ownerId: true } } },
    });
    if (!existing) throw notFound("Offer not found");
    const updated = await this.prisma.offer.update({
      where: { id },
      data: { status: data.status },
      include: { offerer: true },
    });
    await this.logAudit(adminId, "OFFER_UPDATED", "offer", id, { status: data.status });
    const serializedOffer = serializeOffer(updated);
    this.realtime.offerUpdated({
      requestId: existing.requestId,
      ownerId: existing.request.ownerId,
      providerId: existing.offererId,
      offer: serializedOffer as Record<string, unknown>,
    });
    return serializedOffer;
  }

  async deleteOffer(id: string, adminId: string) {
    const offer = await this.prisma.offer.findUnique({
      where: { id },
      select: { id: true, requestId: true, offererId: true, status: true },
    });
    if (!offer) throw notFound("Offer not found");
    await this.prisma.$transaction([
      this.prisma.offer.delete({ where: { id } }),
      this.prisma.auditLog.create({
        data: {
          actorId: adminId,
          action: "OFFER_DELETED",
          resource: "offer",
          resourceId: id,
          details: {
            requestId: offer.requestId,
            offererId: offer.offererId,
            status: offer.status,
          },
        },
      }),
    ]);
  }

  async listReviews(query: AdminReviewsQueryDto) {
    const where: Prisma.ReviewWhereInput = {
      subjectId: query.subjectId,
      ...(query.search ? { body: { contains: query.search, mode: "insensitive" as const } } : {}),
    };
    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        include: { author: true, subject: true, request: true },
        orderBy: { [query.sortBy]: query.sortOrder },
        take: query.limit,
        skip: query.offset,
      }),
      this.prisma.review.count({ where }),
    ]);
    return {
      data: reviews.map((review) => ({
        ...serializeReview(review),
        subject: serializeUser(review.subject),
      })),
      meta: { total, limit: query.limit, offset: query.offset },
    };
  }

  async deleteReview(id: string, adminId: string) {
    const review = await this.prisma.review.findUnique({
      where: { id },
      select: { subjectId: true, authorId: true, requestId: true, rating: true },
    });
    if (!review) throw notFound("Review not found");
    await this.prisma.$transaction(async (transaction) => {
      await transaction.review.delete({ where: { id } });
      await refreshUserRating(transaction, review.subjectId);
      await transaction.auditLog.create({
        data: {
          actorId: adminId,
          action: "REVIEW_DELETED",
          resource: "review",
          resourceId: id,
          details: {
            subjectId: review.subjectId,
            authorId: review.authorId,
            requestId: review.requestId,
            rating: review.rating,
          },
        },
      });
    });
    return { deleted: true as const, id };
  }

  async listCategories() {
    const categories = await this.prisma.category.findMany({
      include: { _count: { select: { requests: true } } },
      orderBy: { name: "asc" },
    });
    return categories.map((category) => ({
      ...serializeCategory(category),
      requestCount: category._count.requests,
    }));
  }

  async listConversations(query: AdminConversationsQueryDto) {
    const where: Prisma.ConversationWhereInput = query.search
      ? { request: { title: { contains: query.search, mode: "insensitive" } } }
      : {};
    const [conversations, total] = await Promise.all([
      this.prisma.conversation.findMany({
        where,
        include: {
          request: {
            select: {
              id: true,
              title: true,
              status: true,
              category: { select: { name: true } },
            },
          },
          participants: { include: { user: true } },
          messages: { orderBy: { createdAt: "desc" }, take: 1 },
          _count: { select: { messages: true } },
        },
        orderBy: { updatedAt: query.sortOrder },
        take: query.limit,
        skip: query.offset,
      }),
      this.prisma.conversation.count({ where }),
    ]);
    return {
      data: conversations.map((conversation) => {
        const lastMessage = conversation.messages[0];
        return {
          id: conversation.id,
          requestId: conversation.requestId,
          requestTitle: conversation.request.title,
          categoryName: conversation.request.category.name,
          requestStatus: conversation.request.status,
          participants: conversation.participants.map((participant) =>
            serializeUser(participant.user),
          ),
          messageCount: conversation._count.messages,
          lastMessage: lastMessage
            ? {
                body: messagePreviewText(lastMessage),
                senderId: lastMessage.senderId,
                createdAt: lastMessage.createdAt.toISOString(),
              }
            : null,
          updatedAt: conversation.updatedAt.toISOString(),
          createdAt: conversation.createdAt.toISOString(),
        };
      }),
      meta: { total, limit: query.limit ?? 50, offset: query.offset ?? 0 },
    };
  }

  async getConversationMessages(conversationId: string, limit = 200) {
    const take = Math.min(Math.max(limit, 1), 500);
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        request: { select: { id: true, title: true, status: true } },
        participants: { include: { user: true } },
        messages: {
          include: { sender: true },
          orderBy: { createdAt: "desc" },
          take,
        },
      },
    });
    if (!conversation) throw notFound("Conversation not found");
    const messages = [...conversation.messages].reverse();

    return {
      id: conversation.id,
      requestId: conversation.requestId,
      requestTitle: conversation.request.title,
      requestStatus: conversation.request.status,
      participants: conversation.participants.map((p) => serializeUser(p.user)),
      messages: messages.map((message) => ({
        id: message.id,
        senderId: message.senderId,
        senderName: profileName(message.sender),
        senderAvatar: message.sender.avatarKey ? mediaUrlForKey(message.sender.avatarKey) : null,
        body: message.body,
        attachmentKey: message.attachmentKey,
        attachmentUrl: message.attachmentKey ? mediaUrlForKey(message.attachmentKey) : null,
        createdAt: message.createdAt.toISOString(),
      })),
    };
  }

  listRoles() {
    return Object.values(UserRole).map((role) => ({
      name: role,
      permissions: permissionsForRole(role),
    }));
  }

  listPermissions() {
    return ADMIN_PERMISSIONS.map((name) => ({
      name,
      description: name.replace(":", " — "),
    }));
  }

  async systemStatus() {
    return { api: true, database: await this.databaseReachable() };
  }
}
