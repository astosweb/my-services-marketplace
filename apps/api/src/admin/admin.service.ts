import { Injectable } from "@nestjs/common";
import {
  Prisma,
  ServiceRequestStatus,
  UserRole,
} from "../generated/prisma/client.js";
import { badRequest, conflict, forbidden, notFound } from "../lib/errors.js";
import {
  serializeAdminUser,
  serializeCategory,
  serializeOffer,
  serializeRequest,
  serializeReview,
} from "../lib/serializers.js";
import { PrismaService } from "../prisma/prisma.service.js";
import type {
  AdminCreateCategoryDto,
  AdminListQueryDto,
  AdminOfferListQueryDto,
  AdminRequestListQueryDto,
  AdminUpdateCategoryDto,
  AdminUpdateRequestDto,
  AdminUpdateUserDto,
  AdminUserListQueryDto,
} from "./admin.dto.js";

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard() {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [
      users,
      disabledUsers,
      admins,
      requests,
      openRequests,
      inProgressRequests,
      completedRequests,
      cancelledRequests,
      premiumRequests,
      offers,
      pendingOffers,
      reviews,
      categories,
      conversations,
      messages,
      newUsers7d,
      newRequests7d,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { isDisabled: true } }),
      this.prisma.user.count({ where: { role: UserRole.ADMIN } }),
      this.prisma.serviceRequest.count(),
      this.prisma.serviceRequest.count({ where: { status: ServiceRequestStatus.OPEN } }),
      this.prisma.serviceRequest.count({ where: { status: ServiceRequestStatus.IN_PROGRESS } }),
      this.prisma.serviceRequest.count({ where: { status: ServiceRequestStatus.COMPLETED } }),
      this.prisma.serviceRequest.count({ where: { status: ServiceRequestStatus.CANCELLED } }),
      this.prisma.serviceRequest.count({ where: { isPremium: true } }),
      this.prisma.offer.count(),
      this.prisma.offer.count({ where: { status: "PENDING" } }),
      this.prisma.review.count(),
      this.prisma.category.count(),
      this.prisma.conversation.count(),
      this.prisma.message.count(),
      this.prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      this.prisma.serviceRequest.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    ]);

    return {
      users: { total: users, disabled: disabledUsers, admins, new7d: newUsers7d },
      requests: {
        total: requests,
        open: openRequests,
        inProgress: inProgressRequests,
        completed: completedRequests,
        cancelled: cancelledRequests,
        premium: premiumRequests,
        new7d: newRequests7d,
      },
      offers: { total: offers, pending: pendingOffers },
      reviews: { total: reviews },
      categories: { total: categories },
      messaging: { conversations, messages },
    };
  }

  async listUsers(query: AdminUserListQueryDto) {
    const where: Prisma.UserWhereInput = {};
    if (query.role) where.role = query.role;
    if (query.isDisabled !== undefined) where.isDisabled = query.isDisabled;
    if (query.q?.trim()) {
      const q = query.q.trim();
      where.OR = [
        { email: { contains: q, mode: "insensitive" } },
        { displayName: { contains: q, mode: "insensitive" } },
        { businessName: { contains: q, mode: "insensitive" } },
      ];
    }

    const [total, users] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: query.limit,
        skip: query.offset,
      }),
    ]);

    return {
      data: users.map(serializeAdminUser),
      meta: { total, limit: query.limit, offset: query.offset },
    };
  }

  async getUser(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw notFound("User not found");
    const [requestCount, offerCount, reviewCount] = await Promise.all([
      this.prisma.serviceRequest.count({ where: { ownerId: id } }),
      this.prisma.offer.count({ where: { offererId: id } }),
      this.prisma.review.count({ where: { subjectId: id } }),
    ]);
    return {
      ...serializeAdminUser(user),
      stats: { requestCount, offerCount, reviewCount },
    };
  }

  async updateUser(id: string, adminId: string, data: AdminUpdateUserDto) {
    if (Object.keys(data).length === 0) throw badRequest("No fields to update");
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw notFound("User not found");

    if (id === adminId && data.role === UserRole.USER) {
      throw forbidden("Cannot demote your own admin account");
    }
    if (id === adminId && data.isDisabled === true) {
      throw forbidden("Cannot disable your own admin account");
    }

    if (data.role === UserRole.USER && user.role === UserRole.ADMIN) {
      const adminCount = await this.prisma.user.count({ where: { role: UserRole.ADMIN } });
      if (adminCount <= 1) throw forbidden("Cannot demote the last admin");
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        ...(data.role !== undefined ? { role: data.role } : {}),
        ...(data.isDisabled !== undefined ? { isDisabled: data.isDisabled } : {}),
        ...(data.displayName !== undefined ? { displayName: data.displayName } : {}),
      },
    });

    if (data.isDisabled === true) {
      await this.prisma.refreshToken.deleteMany({ where: { userId: id } });
    }

    return serializeAdminUser(updated);
  }

  async revokeUserSessions(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!user) throw notFound("User not found");
    const result = await this.prisma.refreshToken.deleteMany({ where: { userId: id } });
    return { revoked: result.count };
  }

  async deleteUser(id: string, adminId: string) {
    if (id === adminId) throw forbidden("Cannot delete your own admin account");
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw notFound("User not found");
    if (user.role === UserRole.ADMIN) {
      const adminCount = await this.prisma.user.count({ where: { role: UserRole.ADMIN } });
      if (adminCount <= 1) throw forbidden("Cannot delete the last admin");
    }
    await this.prisma.user.delete({ where: { id } });
    return { ok: true };
  }

  async listRequests(query: AdminRequestListQueryDto) {
    const where: Prisma.ServiceRequestWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.isPremium !== undefined) where.isPremium = query.isPremium;
    if (query.q?.trim()) {
      const q = query.q.trim();
      where.OR = [
        { title: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { location: { contains: q, mode: "insensitive" } },
      ];
    }

    const [total, requests] = await Promise.all([
      this.prisma.serviceRequest.count({ where }),
      this.prisma.serviceRequest.findMany({
        where,
        include: {
          category: true,
          owner: true,
          photos: true,
          _count: { select: { offers: true } },
        },
        orderBy: { createdAt: "desc" },
        take: query.limit,
        skip: query.offset,
      }),
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
        category: true,
        owner: true,
        photos: true,
        offers: { include: { offerer: true }, orderBy: { createdAt: "desc" } },
        progressEvents: { orderBy: { createdAt: "asc" } },
        _count: { select: { offers: true } },
      },
    });
    if (!request) throw notFound("Request not found");
    return serializeRequest(request);
  }

  async updateRequest(id: string, data: AdminUpdateRequestDto) {
    if (Object.keys(data).length === 0) throw badRequest("No fields to update");
    const existing = await this.prisma.serviceRequest.findUnique({ where: { id } });
    if (!existing) throw notFound("Request not found");

    const patch: Prisma.ServiceRequestUpdateInput = {};
    if (data.title !== undefined) patch.title = data.title;
    if (data.description !== undefined) patch.description = data.description;
    if (data.isPremium !== undefined) patch.isPremium = data.isPremium;
    if (data.status !== undefined) {
      patch.status = data.status;
      if (data.status === ServiceRequestStatus.CANCELLED) {
        patch.cancelledAt = existing.cancelledAt ?? new Date();
      }
      if (data.status === ServiceRequestStatus.COMPLETED) {
        patch.completedAt = existing.completedAt ?? new Date();
      }
      if (data.status === ServiceRequestStatus.OPEN) {
        patch.cancelledAt = null;
        patch.completedAt = null;
        patch.progressStatus = null;
        patch.progressUpdatedAt = null;
      }
    }

    const request = await this.prisma.serviceRequest.update({
      where: { id },
      data: patch,
      include: {
        category: true,
        owner: true,
        photos: true,
        offers: { include: { offerer: true } },
        progressEvents: { orderBy: { createdAt: "asc" } },
        _count: { select: { offers: true } },
      },
    });
    return serializeRequest(request);
  }

  async deleteRequest(id: string) {
    const existing = await this.prisma.serviceRequest.findUnique({ where: { id } });
    if (!existing) throw notFound("Request not found");
    await this.prisma.serviceRequest.delete({ where: { id } });
    return { ok: true };
  }

  async listOffers(query: AdminOfferListQueryDto) {
    const where: Prisma.OfferWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.q?.trim()) {
      const q = query.q.trim();
      where.OR = [
        { message: { contains: q, mode: "insensitive" } },
        { request: { title: { contains: q, mode: "insensitive" } } },
        { offerer: { displayName: { contains: q, mode: "insensitive" } } },
        { offerer: { email: { contains: q, mode: "insensitive" } } },
      ];
    }

    const [total, offers] = await Promise.all([
      this.prisma.offer.count({ where }),
      this.prisma.offer.findMany({
        where,
        include: {
          offerer: true,
          request: { select: { id: true, title: true, status: true } },
        },
        orderBy: { createdAt: "desc" },
        take: query.limit,
        skip: query.offset,
      }),
    ]);

    return {
      data: offers.map((offer) => ({
        ...serializeOffer(offer),
        request: offer.request,
      })),
      meta: { total, limit: query.limit, offset: query.offset },
    };
  }

  async listReviews(query: AdminListQueryDto) {
    const where: Prisma.ReviewWhereInput = {};
    if (query.q?.trim()) {
      const q = query.q.trim();
      where.OR = [
        { body: { contains: q, mode: "insensitive" } },
        { author: { displayName: { contains: q, mode: "insensitive" } } },
        { subject: { displayName: { contains: q, mode: "insensitive" } } },
      ];
    }

    const [total, reviews] = await Promise.all([
      this.prisma.review.count({ where }),
      this.prisma.review.findMany({
        where,
        include: {
          author: true,
          subject: true,
          request: true,
        },
        orderBy: { createdAt: "desc" },
        take: query.limit,
        skip: query.offset,
      }),
    ]);

    return {
      data: reviews.map((review) => ({
        ...serializeReview(review),
        subject: {
          id: review.subject.id,
          displayName: review.subject.displayName,
          email: review.subject.email,
        },
      })),
      meta: { total, limit: query.limit, offset: query.offset },
    };
  }

  async deleteReview(id: string) {
    const review = await this.prisma.review.findUnique({ where: { id } });
    if (!review) throw notFound("Review not found");

    await this.prisma.$transaction(async (tx) => {
      await tx.review.delete({ where: { id } });
      const aggregates = await tx.review.aggregate({
        where: { subjectId: review.subjectId },
        _avg: { rating: true },
        _count: { _all: true },
      });
      await tx.user.update({
        where: { id: review.subjectId },
        data: {
          rating: aggregates._avg.rating ?? 0,
          reviewCount: aggregates._count._all,
        },
      });
    });

    return { ok: true };
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

  async createCategory(data: AdminCreateCategoryDto) {
    const id = data.id.trim().toLowerCase().replace(/\s+/g, "_");
    if (!/^[a-z0-9_]+$/.test(id)) {
      throw badRequest("Category id must be lowercase letters, numbers, and underscores");
    }
    if (await this.prisma.category.findUnique({ where: { id } })) {
      throw conflict("Category already exists");
    }
    const category = await this.prisma.category.create({
      data: { id, name: data.name.trim(), symbol: data.symbol.trim() },
    });
    return serializeCategory(category);
  }

  async updateCategory(id: string, data: AdminUpdateCategoryDto) {
    if (Object.keys(data).length === 0) throw badRequest("No fields to update");
    try {
      const category = await this.prisma.category.update({
        where: { id },
        data: {
          ...(data.name !== undefined ? { name: data.name.trim() } : {}),
          ...(data.symbol !== undefined ? { symbol: data.symbol.trim() } : {}),
        },
      });
      return serializeCategory(category);
    } catch {
      throw notFound("Category not found");
    }
  }

  async deleteCategory(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: { _count: { select: { requests: true } } },
    });
    if (!category) throw notFound("Category not found");
    if (category._count.requests > 0) {
      throw conflict("Cannot delete a category that still has requests");
    }
    await this.prisma.category.delete({ where: { id } });
    return { ok: true };
  }
}
