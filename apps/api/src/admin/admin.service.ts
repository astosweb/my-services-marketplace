import { Injectable } from "@nestjs/common";
import { NotificationKind, Prisma, ServiceRequestStatus, UserRole, type User } from "../generated/prisma/client.js";
import { ADMIN_PERMISSIONS, permissionsForRole } from "../lib/admin-permissions.js";
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
import { PrismaService } from "../prisma/prisma.service.js";
import type {
  AdminApproveRequestDto,
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

const csvCell = (value: string) => `"${value.replaceAll('"', '""')}"`;

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  private adminUser(
    user: User,
    counts?: { requests: number; offers: number; reviewsReceived: number },
  ) {
    const base = serializeMe(user);
    return {
      ...base,
      status: "active" as const,
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
      chartRequests,
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
      this.prisma.serviceRequest.findMany({
        where: { createdAt: { gte: chartStart } },
        select: { createdAt: true },
      }),
      this.databaseReachable(),
    ]);

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
    for (const request of chartRequests) {
      const date = request.createdAt.toISOString().slice(0, 10);
      dailyCounts.set(date, (dailyCounts.get(date) ?? 0) + 1);
    }

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
      recentActivity: [
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
        .slice(0, 10),
      recentUsers: recentUsers.map((user) => this.adminUser(user)),
      recentRequests: recentRequests.map((request) => serializeRequest(request)),
      health: { ok: database, api: true, database },
    };
  }

  async listUsers(query: AdminUsersQueryDto) {
    const where: Prisma.UserWhereInput = {
      role: query.role,
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
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { _count: { select: userCountsSelect } },
    });
    if (!user) throw notFound("User not found");

    const [requests, offers, reviewsReceived, reviewsGiven] = await Promise.all([
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
    ]);

    return {
      ...this.adminUser(user, user._count),
      preferBusinessName: user.preferBusinessName,
      memberSince: user.createdAt.toISOString(),
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
    const existing = await this.prisma.user.findUnique({ where: { id }, select: { role: true } });
    if (!existing) throw notFound("User not found");
    if (id === adminId && data.role && data.role !== existing.role) {
      throw forbidden("You cannot change your own role");
    }
    return this.adminUser(await this.prisma.user.update({ where: { id }, data }));
  }

  async deleteUser(id: string, adminId: string) {
    if (id === adminId) throw forbidden("You cannot delete your own account");
    const { count } = await this.prisma.user.deleteMany({ where: { id } });
    if (!count) throw notFound("User not found");
  }

  async bulkUsers(adminId: string, data: AdminBulkUsersDto) {
    if (data.ids.includes(adminId)) throw forbidden("You cannot delete your own account");
    const { count } = await this.prisma.user.deleteMany({ where: { id: { in: data.ids } } });
    return { affected: count, action: data.action, deleted: count };
  }

  async exportUsersCsv() {
    const users = await this.prisma.user.findMany({ orderBy: { createdAt: "desc" } });
    const rows = [
      ["id", "email", "displayName", "businessName", "role", "rating", "reviewCount", "createdAt"],
      ...users.map((user) => [
        user.id,
        user.email,
        user.displayName,
        user.businessName ?? "",
        user.role,
        user.rating.toFixed(2),
        String(user.reviewCount),
        user.createdAt.toISOString(),
      ]),
    ];
    return rows.map((row) => row.map(csvCell).join(",")).join("\n");
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
    const [request, auditLogs] = await Promise.all([
      this.prisma.serviceRequest.findUnique({
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
      }),
      this.prisma.auditLog.findMany({
        where: { resource: "request", resourceId: id },
        include: { actor: true },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    if (!request) throw notFound("Request not found");

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
      auditLogs: auditLogs.map((log) => ({
        id: log.id,
        actorId: log.actorId,
        actorName: profileName(log.actor),
        actorEmail: log.actor.email,
        action: log.action,
        resource: log.resource,
        resourceId: log.resourceId,
        details: (log.details as Record<string, unknown> | null) ?? null,
        createdAt: log.createdAt.toISOString(),
      })),
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
      select: { id: true, title: true, ownerId: true, status: true },
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

    return this.getRequest(id);
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

    return this.getRequest(id);
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

  async updateOffer(id: string, data: AdminUpdateOfferDto) {
    const existing = await this.prisma.offer.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw notFound("Offer not found");
    return serializeOffer(
      await this.prisma.offer.update({
        where: { id },
        data: { status: data.status },
        include: { offerer: true },
      }),
    );
  }

  async deleteOffer(id: string) {
    const { count } = await this.prisma.offer.deleteMany({ where: { id } });
    if (!count) throw notFound("Offer not found");
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

  async deleteReview(id: string) {
    const review = await this.prisma.review.findUnique({
      where: { id },
      select: { subjectId: true },
    });
    if (!review) throw notFound("Review not found");
    await this.prisma.review.delete({ where: { id } });
    const aggregate = await this.prisma.review.aggregate({
      where: { subjectId: review.subjectId },
      _avg: { rating: true },
      _count: { _all: true },
    });
    await this.prisma.user.update({
      where: { id: review.subjectId },
      data: { rating: aggregate._avg.rating ?? 0, reviewCount: aggregate._count._all },
    });
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

  async getConversationMessages(conversationId: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        request: { select: { id: true, title: true, status: true } },
        participants: { include: { user: true } },
        messages: {
          include: { sender: true },
          orderBy: { createdAt: "asc" },
        },
      },
    });
    if (!conversation) throw notFound("Conversation not found");

    return {
      id: conversation.id,
      requestId: conversation.requestId,
      requestTitle: conversation.request.title,
      requestStatus: conversation.request.status,
      participants: conversation.participants.map((p) => serializeUser(p.user)),
      messages: conversation.messages.map((message) => ({
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
