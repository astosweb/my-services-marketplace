import { Injectable } from "@nestjs/common";
import { Prisma, ServiceRequestStatus, UserRole, type User } from "../generated/prisma/client.js";
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
  AdminBulkUsersDto,
  AdminConversationsQueryDto,
  AdminOffersQueryDto,
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
    return this.adminUser(user, user._count);
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

  async listRequests(query: AdminRequestsQueryDto) {
    const where: Prisma.ServiceRequestWhereInput = {
      status: query.status,
      city: query.city,
      categoryId: query.categoryId,
      ...(query.search ? { title: { contains: query.search, mode: "insensitive" as const } } : {}),
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
        progressEvents: { orderBy: { createdAt: "asc" } },
        offers: { include: { offerer: true }, orderBy: { createdAt: "desc" } },
        reviews: { include: { author: true, request: true } },
      },
    });
    if (!request) throw notFound("Request not found");
    return {
      ...serializeRequest(request),
      offers: request.offers.map(serializeOffer),
      reviews: request.reviews.map(serializeReview),
    };
  }

  async updateRequest(id: string, data: AdminUpdateRequestDto) {
    if (Object.keys(data).length === 0) throw badRequest("No fields to update");
    const existing = await this.prisma.serviceRequest.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) throw notFound("Request not found");
    const now = new Date();
    await this.prisma.serviceRequest.update({
      where: { id },
      data: {
        ...data,
        ...(data.status === ServiceRequestStatus.COMPLETED ? { completedAt: now } : {}),
        ...(data.status === ServiceRequestStatus.CANCELLED ? { cancelledAt: now } : {}),
      },
    });
    return this.getRequest(id);
  }

  async deleteRequest(id: string) {
    const { count } = await this.prisma.serviceRequest.deleteMany({ where: { id } });
    if (!count) throw notFound("Request not found");
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
