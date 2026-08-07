import { Injectable } from "@nestjs/common";
import { RealtimeServerEvent } from "@monorepo/shared";
import {
  JobProgressStatus,
  NotificationKind,
  OfferStatus,
  RequestPricingMode,
  ServiceRequestStatus,
} from "../generated/prisma/client.js";
import { badRequest, conflict, forbidden, notFound } from "../lib/errors.js";
import { assertOwnedObjectKeys } from "../lib/owned-keys.js";
import {
  profileName,
  serializeMessage,
  serializeNotification,
  serializeOffer,
  serializeRequest,
  serializeReview,
} from "../lib/serializers.js";
import { refreshUserRating } from "../lib/user-rating.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { RealtimePublisher } from "../realtime/realtime.publisher.js";
import type {
  CreateOfferDto,
  CreateRequestDto,
  CreateReviewDto,
  MineRequestQueryDto,
  RequestListQueryDto,
  SendRequestMessageDto,
  UpdateOfferStatusDto,
  UpdateProgressDto,
  UpdateRequestStatusDto,
} from "./requests.dto.js";

const providerProgressOrder = [
  JobProgressStatus.ACCEPTED,
  JobProgressStatus.ON_THE_WAY,
  JobProgressStatus.STARTED,
  JobProgressStatus.PROVIDER_DONE,
] as const;

const requestDetailInclude = {
  category: true,
  owner: true,
  photos: true,
  progressEvents: { orderBy: { createdAt: "asc" as const } },
  offers: {
    where: { status: OfferStatus.ACCEPTED },
    include: { offerer: true },
  },
  _count: { select: { offers: true } },
};

@Injectable()
export class RequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimePublisher,
  ) {}

  private async ensureConversation(requestId: string, userA: string, userB: string) {
    if (userA === userB) throw badRequest("Cannot message yourself");

    return this.prisma.$transaction(async (tx) => {
      // Acquire lock to serialize conversation creation for this request
      await tx.$executeRaw`SELECT 1 FROM "ServiceRequest" WHERE id = ${requestId} FOR UPDATE`;

      const existing = await tx.conversation.findFirst({
        where: {
          requestId,
          AND: [
            { participants: { some: { userId: userA } } },
            { participants: { some: { userId: userB } } },
          ],
        },
      });
      if (existing) return existing;

      return tx.conversation.create({
        data: {
          requestId,
          participants: { create: [{ userId: userA }, { userId: userB }] },
        },
      });
    });
  }

  private async assertCanOpenRequestChat(
    requestId: string,
    userId: string,
    peerUserId?: string,
  ) {
    const request = await this.prisma.serviceRequest.findUnique({
      where: { id: requestId },
      select: {
        id: true,
        title: true,
        ownerId: true,
        status: true,
        offers: {
          where: {
            status: { in: [OfferStatus.PENDING, OfferStatus.ACCEPTED] },
          },
          select: { offererId: true, status: true },
        },
      },
    });
    if (!request) throw notFound("Request not found");

    const peer = peerUserId ?? (request.ownerId === userId ? undefined : request.ownerId);
    if (!peer) throw badRequest("peerUserId is required");
    if (peer === userId) throw badRequest("Cannot message yourself");

    const isOwner = request.ownerId === userId;
    const isPeerOwner = request.ownerId === peer;
    const userOffer = request.offers.find((offer) => offer.offererId === userId);
    const peerOffer = request.offers.find((offer) => offer.offererId === peer);

    // Owner may chat with anyone who has a pending or accepted offer.
    // Offerer may chat with the owner when they have a pending or accepted offer.
    const allowed =
      (isOwner && isPeerOwner === false && Boolean(peerOffer)) ||
      (!isOwner && isPeerOwner && Boolean(userOffer));
    if (!allowed) {
      throw forbidden("You can only message participants related to this request");
    }

    const peerUser = await this.prisma.user.findUnique({
      where: { id: peer },
      select: { id: true, status: true },
    });
    if (!peerUser || peerUser.status === "BANNED") throw notFound("User not found");

    return { request, peerUserId: peer };
  }

  private findUserConversation(requestId: string, userId: string, peerUserId?: string) {
    return this.prisma.conversation.findFirst({
      where: {
        requestId,
        participants: { some: { userId } },
        ...(peerUserId ? { AND: [{ participants: { some: { userId: peerUserId } } }] } : {}),
      },
      include: {
        messages: {
          include: { sender: true },
          orderBy: { createdAt: "desc" },
          take: 100,
        },
        participants: { select: { userId: true, lastReadAt: true } },
      },
      orderBy: { updatedAt: "desc" },
    });
  }

  async list(query: RequestListQueryDto) {
    if (query.status && query.status !== ServiceRequestStatus.OPEN) {
      throw badRequest("Only open requests are publicly listed");
    }
    const where = {
      city: query.city,
      categoryId: query.categoryId,
      status: ServiceRequestStatus.OPEN,
      owner: { status: "ACTIVE" as const },
    };
    const [requests, total] = await Promise.all([
      this.prisma.serviceRequest.findMany({
        where,
        include: {
          category: true,
          owner: true,
          photos: { orderBy: { sortOrder: "asc" }, take: 1 },
          offers: {
            where: { status: OfferStatus.ACCEPTED },
            include: { offerer: true },
          },
          _count: { select: { offers: true } },
        },
        orderBy: { createdAt: "desc" },
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

  async mine(userId: string, query: MineRequestQueryDto) {
    const where =
      query.role === "owner" ? { ownerId: userId } : { offers: { some: { offererId: userId } } };
    const [requests, total] = await Promise.all([
      this.prisma.serviceRequest.findMany({
        where,
        include: {
          category: true,
          owner: true,
          photos: true,
          offers: {
            where:
              query.role === "owner"
                ? { status: OfferStatus.ACCEPTED }
                : { OR: [{ offererId: userId }, { status: OfferStatus.ACCEPTED }] },
            include: { offerer: true },
            orderBy: { createdAt: "desc" },
          },
          _count: { select: { offers: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: query.limit,
        skip: query.offset,
      }),
      this.prisma.serviceRequest.count({ where }),
    ]);
    return {
      data: requests.map((request) => serializeRequest(request, userId)),
      meta: { total, limit: query.limit, offset: query.offset },
    };
  }

  async get(id: string, viewerUserId?: string) {
    const request = await this.prisma.serviceRequest.findUnique({
      where: { id },
      include: {
        category: true,
        owner: true,
        photos: true,
        progressEvents: { orderBy: { createdAt: "asc" } },
        offers: {
          where: viewerUserId
            ? { OR: [{ status: OfferStatus.ACCEPTED }, { offererId: viewerUserId }] }
            : { status: OfferStatus.ACCEPTED },
          include: { offerer: true },
          orderBy: { createdAt: "desc" },
        },
        _count: { select: { offers: true } },
      },
    });
    if (!request) throw notFound("Request not found");
    if (request.owner.status === "BANNED" && request.ownerId !== viewerUserId) {
      throw notFound("Request not found");
    }

    const isParticipant =
      Boolean(viewerUserId) &&
      (request.ownerId === viewerUserId ||
        request.offers.some((offer) => offer.offererId === viewerUserId));

    if (request.status === ServiceRequestStatus.PENDING_REVIEW) {
      if (request.ownerId !== viewerUserId) throw notFound("Request not found");
    } else if (request.status !== ServiceRequestStatus.OPEN && !isParticipant) {
      throw notFound("Request not found");
    }

    return serializeRequest(request, viewerUserId);
  }

  async view(id: string, viewerUserId?: string) {
    const existing = await this.prisma.serviceRequest.findUnique({
      where: { id },
      select: { ownerId: true, updatedAt: true, status: true },
    });
    if (!existing) throw notFound("Request not found");
    if (viewerUserId !== existing.ownerId && existing.status === ServiceRequestStatus.OPEN) {
      await this.prisma.serviceRequest.update({
        where: { id },
        data: { viewCount: { increment: 1 }, updatedAt: existing.updatedAt },
      });
    }
    return this.get(id, viewerUserId);
  }

  async create(ownerId: string, data: CreateRequestDto) {
    const pricingMode = data.pricingMode ?? RequestPricingMode.PROVIDER_OFFERS;
    if (pricingMode === RequestPricingMode.OWNER_FIXED_PRICE && data.budgetCents == null) {
      throw badRequest("Fixed price is required");
    }
    if (data.photoKeys?.length) assertOwnedObjectKeys(data.photoKeys, ownerId, "requests");
    if (!(await this.prisma.category.findUnique({ where: { id: data.categoryId } }))) {
      throw badRequest("Category not found");
    }
    const request = await this.prisma.serviceRequest.create({
      data: {
        ownerId,
        categoryId: data.categoryId,
        title: data.title,
        description: data.description,
        city: data.city,
        latitude: data.latitude,
        longitude: data.longitude,
        location: data.location,
        budgetCents: data.budgetCents,
        budgetLabel:
          data.budgetLabel ??
          (data.budgetCents != null ? `€${(data.budgetCents / 100).toFixed(0)}` : undefined),
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : undefined,
        pricingMode,
        status: ServiceRequestStatus.PENDING_REVIEW,
        isPremium: false,
        photos: data.photoKeys?.length
          ? {
              create: data.photoKeys.map((spacesKey, sortOrder) => ({
                spacesKey,
                sortOrder,
              })),
            }
          : undefined,
      },
      include: {
        category: true,
        owner: true,
        photos: true,
        _count: { select: { offers: true } },
      },
    });
    const serialized = serializeRequest(request);
    this.realtime.emitToAdmins(RealtimeServerEvent.ADMIN_MODERATION, {
      type: "request_pending",
      requestId: request.id,
      ownerId,
    });
    this.realtime.emitToAdminModeration(RealtimeServerEvent.REQUEST_MODERATION, {
      requestId: request.id,
      ownerId,
      status: ServiceRequestStatus.PENDING_REVIEW,
    });
    this.realtime.emitToUser(ownerId, RealtimeServerEvent.REQUEST_UPDATED, {
      requestId: request.id,
      reason: "created",
    });
    return serialized;
  }

  async update(id: string, userId: string, data: CreateRequestDto) {
    const pricingMode = data.pricingMode ?? RequestPricingMode.PROVIDER_OFFERS;
    if (pricingMode === RequestPricingMode.OWNER_FIXED_PRICE && data.budgetCents == null) {
      throw badRequest("Fixed price is required");
    }
    if (data.photoKeys?.length) assertOwnedObjectKeys(data.photoKeys, userId, "requests");
    const existing = await this.prisma.serviceRequest.findUnique({
      where: { id },
      select: { ownerId: true, status: true, _count: { select: { offers: true } } },
    });
    if (!existing) throw notFound("Request not found");
    if (existing.ownerId !== userId) throw forbidden("Only the post owner can edit this request");
    if (
      existing.status !== ServiceRequestStatus.OPEN &&
      existing.status !== ServiceRequestStatus.PENDING_REVIEW
    ) {
      throw badRequest("Only pending or open requests can be edited");
    }
    if (existing._count.offers > 0) {
      throw conflict("Cannot edit a request that already has offers");
    }
    if (!(await this.prisma.category.findUnique({ where: { id: data.categoryId } }))) {
      throw badRequest("Category not found");
    }
    const request = await this.prisma.$transaction(async (transaction) => {
      if (data.photoKeys) {
        await transaction.requestPhoto.deleteMany({ where: { requestId: id } });
        if (data.photoKeys.length) {
          await transaction.requestPhoto.createMany({
            data: data.photoKeys.map((spacesKey, sortOrder) => ({
              requestId: id,
              spacesKey,
              sortOrder,
            })),
          });
        }
      }
      return transaction.serviceRequest.update({
        where: { id },
        data: {
          categoryId: data.categoryId,
          title: data.title,
          description: data.description,
          city: data.city,
          latitude: data.latitude,
          longitude: data.longitude,
          location: data.location,
          budgetCents: data.budgetCents ?? null,
          budgetLabel:
            data.budgetLabel ??
            (data.budgetCents != null ? `€${(data.budgetCents / 100).toFixed(0)}` : null),
          scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
          pricingMode,
        },
        include: {
          category: true,
          owner: true,
          photos: true,
          _count: { select: { offers: true } },
        },
      });
    });
    return serializeRequest(request);
  }

  async offers(requestId: string, userId: string) {
    const request = await this.prisma.serviceRequest.findUnique({
      where: { id: requestId },
      select: { ownerId: true },
    });
    if (!request) throw notFound("Request not found");
    if (request.ownerId !== userId) throw forbidden("Only the post owner can view offers");
    return (
      await this.prisma.offer.findMany({
        where: { requestId },
        include: { offerer: true },
        orderBy: { createdAt: "desc" },
      })
    ).map(serializeOffer);
  }

  async updateOffer(
    requestId: string,
    offerId: string,
    userId: string,
    data: UpdateOfferStatusDto,
  ) {
    const offer = await this.prisma.offer.findFirst({
      where: { id: offerId, requestId },
      include: {
        offerer: true,
        request: { select: { ownerId: true, title: true, status: true } },
      },
    });
    if (!offer) throw notFound("Offer not found");
    if (offer.status !== OfferStatus.PENDING) {
      throw badRequest("Only pending offers can be updated");
    }
    if (data.status === OfferStatus.WITHDRAWN) {
      if (offer.offererId !== userId) {
        throw forbidden("Only the offer author can withdraw an offer");
      }
      const withdrawn = await this.prisma.offer.updateMany({
        where: { id: offer.id, status: OfferStatus.PENDING },
        data: { status: OfferStatus.WITHDRAWN },
      });
      if (!withdrawn.count) throw badRequest("Only pending offers can be updated");
      const withdrawnOffer = await this.prisma.offer.findUniqueOrThrow({
        where: { id: offer.id },
        include: { offerer: true },
      });
      const serializedWithdrawn = serializeOffer(withdrawnOffer);
      this.realtime.offerUpdated({
        requestId,
        ownerId: offer.request.ownerId,
        providerId: offer.offererId,
        offer: serializedWithdrawn as Record<string, unknown>,
      });
      return serializedWithdrawn;
    }
    if (offer.request.ownerId !== userId) {
      throw forbidden("Only the post owner can respond to offers");
    }
    if (
      data.status === OfferStatus.ACCEPTED &&
      offer.request.status !== ServiceRequestStatus.OPEN
    ) {
      throw badRequest("Request is not open for offers");
    }
    const updated = await this.prisma.$transaction(async (transaction) => {
      if (data.status === OfferStatus.ACCEPTED) {
        const existingRequest = await transaction.serviceRequest.findUnique({
          where: { id: requestId },
          select: { updatedAt: true },
        });
        if (!existingRequest) throw notFound("Request not found");
        const now = new Date();
        const changed = await transaction.serviceRequest.updateMany({
          where: { id: requestId, status: ServiceRequestStatus.OPEN },
          data: {
            status: ServiceRequestStatus.IN_PROGRESS,
            progressStatus: JobProgressStatus.ACCEPTED,
            progressUpdatedAt: now,
            updatedAt: existingRequest.updatedAt,
            cancelledAt: null,
            completedAt: null,
          },
        });
        if (!changed.count) throw badRequest("Request is not open for offers");
        await transaction.jobProgressEvent.create({
          data: {
            requestId,
            status: JobProgressStatus.ACCEPTED,
            createdAt: now,
          },
        });
      }
      const next = await transaction.offer.update({
        where: { id: offer.id },
        data: { status: data.status },
        include: { offerer: true },
      });
      if (data.status === OfferStatus.ACCEPTED) {
        await transaction.offer.updateMany({
          where: {
            requestId,
            id: { not: offer.id },
            status: OfferStatus.PENDING,
          },
          data: { status: OfferStatus.DECLINED },
        });
      }
      return next;
    });
    const responseLabel =
      offer.priceCents == null ? "interest" : `€${(offer.priceCents / 100).toFixed(0)} offer`;
    if (data.status === OfferStatus.ACCEPTED) {
      await this.ensureConversation(requestId, userId, offer.offererId);
    }
    await this.prisma.notification.create({
      data: {
        userId: offer.offererId,
        kind:
          data.status === OfferStatus.ACCEPTED
            ? NotificationKind.OFFER_ACCEPTED
            : NotificationKind.OFFER_DECLINED,
        title:
          data.status === OfferStatus.ACCEPTED
            ? offer.priceCents == null
              ? "Your interest was accepted"
              : "Your offer was accepted"
            : offer.priceCents == null
              ? "Interest declined"
              : "Offer declined",
        body:
          data.status === OfferStatus.ACCEPTED
            ? `The owner accepted your ${responseLabel}.`
            : `Your ${responseLabel} was declined.`,
        contextTag: offer.request.title,
        payload: { requestId, offerId: offer.id },
      },
    });
    const serializedOffer = serializeOffer(updated);
    this.realtime.offerUpdated({
      requestId,
      ownerId: offer.request.ownerId,
      providerId: offer.offererId,
      offer: serializedOffer as Record<string, unknown>,
    });
    if (data.status === OfferStatus.ACCEPTED) {
      const request = await this.prisma.serviceRequest.findUniqueOrThrow({
        where: { id: requestId },
        include: {
          ...requestDetailInclude,
          offers: {
            where: { status: OfferStatus.ACCEPTED },
            include: { offerer: true },
          },
        },
      });
      this.realtime.requestUpdated({
        requestId,
        ownerId: offer.request.ownerId,
        interestedUserIds: [offer.offererId],
        request: serializeRequest(request, userId) as Record<string, unknown>,
        reason: "offer.accepted",
      });
      this.realtime.jobProgress({
        requestId,
        ownerId: offer.request.ownerId,
        providerId: offer.offererId,
        progress: {
          status: JobProgressStatus.ACCEPTED,
          requestId,
        },
      });
    }
    return serializedOffer;
  }

  async updateStatus(requestId: string, ownerId: string, data: UpdateRequestStatusDto) {
    const existing = await this.prisma.serviceRequest.findUnique({
      where: { id: requestId },
      select: { ownerId: true, title: true, status: true, progressStatus: true, updatedAt: true },
    });
    if (!existing) throw notFound("Request not found");
    if (existing.ownerId !== ownerId) {
      throw forbidden("Only the post owner can update request status");
    }
    if (
      data.status === ServiceRequestStatus.COMPLETED &&
      existing.status !== ServiceRequestStatus.IN_PROGRESS
    ) {
      throw badRequest("Only in-progress requests can be completed");
    }
    if (
      data.status === ServiceRequestStatus.COMPLETED &&
      existing.progressStatus !== JobProgressStatus.PROVIDER_DONE
    ) {
      throw badRequest("Owner can complete only after the provider marks the job done");
    }
    if (
      data.status === ServiceRequestStatus.CANCELLED &&
      existing.status === ServiceRequestStatus.COMPLETED
    ) {
      throw badRequest("Completed requests cannot be cancelled");
    }
    if (existing.status === ServiceRequestStatus.CANCELLED) {
      throw badRequest("Request is already cancelled");
    }
    const now = new Date();
    const request = await this.prisma.$transaction(async (transaction) => {
      if (data.status === ServiceRequestStatus.CANCELLED) {
        await transaction.offer.updateMany({
          where: { requestId, status: OfferStatus.PENDING },
          data: { status: OfferStatus.DECLINED },
        });
      }
      const changed = await transaction.serviceRequest.updateMany({
        where:
          data.status === ServiceRequestStatus.COMPLETED
            ? {
                id: requestId,
                status: ServiceRequestStatus.IN_PROGRESS,
                progressStatus: JobProgressStatus.PROVIDER_DONE,
              }
            : {
                id: requestId,
                status: { not: ServiceRequestStatus.COMPLETED },
                NOT: { status: ServiceRequestStatus.CANCELLED },
              },
        data:
          data.status === ServiceRequestStatus.COMPLETED
            ? {
                status: data.status,
                progressStatus: JobProgressStatus.OWNER_CONFIRMED,
                progressUpdatedAt: now,
                completedAt: now,
                updatedAt: existing.updatedAt,
              }
            : {
                status: data.status,
                progressUpdatedAt: now,
                cancelledAt: now,
                updatedAt: existing.updatedAt,
              },
      });
      if (!changed.count) {
        throw badRequest(
          data.status === ServiceRequestStatus.COMPLETED
            ? "Request is not ready to complete"
            : "Request cannot be cancelled",
        );
      }
      if (data.status === ServiceRequestStatus.COMPLETED) {
        await transaction.jobProgressEvent.create({
          data: {
            requestId,
            status: JobProgressStatus.OWNER_CONFIRMED,
            createdAt: now,
          },
        });
      }
      return transaction.serviceRequest.findUniqueOrThrow({
        where: { id: requestId },
        include: {
          ...requestDetailInclude,
          offers: {
            where: { status: OfferStatus.ACCEPTED },
            include: { offerer: true },
          },
        },
      });
    });
    const acceptedOffer = request.offers[0];
    if (acceptedOffer) {
      await this.prisma.notification.create({
        data: {
          userId: acceptedOffer.offererId,
          kind:
            data.status === ServiceRequestStatus.COMPLETED
              ? NotificationKind.JOB_COMPLETED
              : NotificationKind.REMINDER,
          title: data.status === ServiceRequestStatus.COMPLETED ? "Job completed" : "Job cancelled",
          body:
            data.status === ServiceRequestStatus.COMPLETED
              ? "The owner confirmed the job is done."
              : "The owner cancelled this job.",
          contextTag: existing.title,
          payload: { requestId },
        },
      });
    }
    const serializedRequest = serializeRequest(request, ownerId);
    this.realtime.requestUpdated({
      requestId,
      ownerId,
      interestedUserIds: acceptedOffer ? [acceptedOffer.offererId] : undefined,
      request: serializedRequest as Record<string, unknown>,
      reason:
        data.status === ServiceRequestStatus.COMPLETED ? "completed" : "cancelled",
    });
    if (data.status === ServiceRequestStatus.COMPLETED && acceptedOffer) {
      this.realtime.jobProgress({
        requestId,
        ownerId,
        providerId: acceptedOffer.offererId,
        progress: {
          status: JobProgressStatus.OWNER_CONFIRMED,
          requestId,
        },
      });
    }
    return serializedRequest;
  }

  async updateProgress(requestId: string, providerId: string, data: UpdateProgressDto) {
    const acceptedOffer = await this.prisma.offer.findFirst({
      where: { requestId, offererId: providerId, status: OfferStatus.ACCEPTED },
      include: {
        request: {
          select: {
            title: true,
            ownerId: true,
            status: true,
            progressStatus: true,
            updatedAt: true,
          },
        },
        offerer: true,
      },
    });
    if (!acceptedOffer) throw forbidden("Only the accepted provider can update progress");
    if (acceptedOffer.request.status !== ServiceRequestStatus.IN_PROGRESS) {
      throw badRequest("Only in-progress jobs can be updated by the provider");
    }
    const currentProgress = acceptedOffer.request.progressStatus ?? JobProgressStatus.ACCEPTED;
    const currentIndex = providerProgressOrder.indexOf(
      currentProgress as (typeof providerProgressOrder)[number],
    );
    if (providerProgressOrder.indexOf(data.status) !== currentIndex + 1) {
      throw badRequest("Progress can only advance one step at a time");
    }
    const now = new Date();
    const request = await this.prisma.$transaction(async (transaction) => {
      const changed = await transaction.serviceRequest.updateMany({
        where: {
          id: requestId,
          status: ServiceRequestStatus.IN_PROGRESS,
          progressStatus: currentProgress,
        },
        data: {
          progressStatus: data.status,
          progressUpdatedAt: now,
          updatedAt: acceptedOffer.request.updatedAt,
        },
      });
      if (!changed.count) {
        throw badRequest("Progress was updated concurrently; refresh and try again");
      }
      await transaction.jobProgressEvent.create({
        data: {
          requestId,
          status: data.status,
          createdAt: now,
        },
      });
      return transaction.serviceRequest.findUniqueOrThrow({
        where: { id: requestId },
        include: {
          ...requestDetailInclude,
          offers: {
            where: { status: OfferStatus.ACCEPTED },
            include: { offerer: true },
          },
        },
      });
    });
    const providerName = profileName(acceptedOffer.offerer);
    const progressBody =
      data.status === JobProgressStatus.ON_THE_WAY
        ? `${providerName} is on the way.`
        : data.status === JobProgressStatus.STARTED
          ? `${providerName} started the job.`
          : `${providerName} marked the job ready for confirmation.`;
    await this.prisma.notification.create({
      data: {
        userId: acceptedOffer.request.ownerId,
        kind:
          data.status === JobProgressStatus.PROVIDER_DONE
            ? NotificationKind.JOB_COMPLETED
            : NotificationKind.REMINDER,
        title: "Job progress updated",
        body: progressBody,
        contextTag: acceptedOffer.request.title,
        payload: { requestId, progressStatus: data.status },
      },
    });
    const serializedRequest = serializeRequest(request, providerId);
    this.realtime.requestUpdated({
      requestId,
      ownerId: acceptedOffer.request.ownerId,
      interestedUserIds: [providerId],
      request: serializedRequest as Record<string, unknown>,
      reason: "progress.updated",
    });
    this.realtime.jobProgress({
      requestId,
      ownerId: acceptedOffer.request.ownerId,
      providerId,
      progress: {
        status: data.status,
        requestId,
      },
    });
    return serializedRequest;
  }

  async review(requestId: string, authorId: string, data: CreateReviewDto) {
    const request = await this.prisma.serviceRequest.findUnique({
      where: { id: requestId },
      include: {
        offers: {
          where: { status: OfferStatus.ACCEPTED },
          include: { offerer: true },
        },
        owner: true,
      },
    });
    if (!request) throw notFound("Request not found");
    if (request.status !== ServiceRequestStatus.COMPLETED) {
      throw badRequest("Reviews can only be left after the job is completed");
    }
    const acceptedOffer = request.offers[0];
    if (!acceptedOffer) throw badRequest("Completed job has no accepted provider");
    const subjectId =
      authorId === request.ownerId
        ? acceptedOffer.offererId
        : authorId === acceptedOffer.offererId
          ? request.ownerId
          : undefined;
    if (!subjectId) throw forbidden("Only the owner and accepted provider can review this job");
    const body = data.body?.trim();
    let review;
    try {
      review = await this.prisma.$transaction(async (transaction) => {
        const created = await transaction.review.create({
          data: {
            authorId,
            subjectId,
            requestId,
            rating: data.rating,
            body: body || undefined,
          },
          include: { author: true, request: true },
        });
        await refreshUserRating(transaction, subjectId);
        return created;
      });
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        (error as { code: string }).code === "P2002"
      ) {
        throw conflict("You already reviewed this job");
      }
      throw error;
    }
    await this.prisma.notification.create({
      data: {
        userId: subjectId,
        kind: NotificationKind.REVIEW,
        title: "New review",
        body: `${profileName(review.author)} left you a ${data.rating}-star review.`,
        contextTag: request.title,
        payload: { requestId, reviewId: review.id },
      },
    });
    const refreshedRequest = await this.prisma.serviceRequest.findUniqueOrThrow({
      where: { id: requestId },
      include: {
        category: true,
        owner: true,
        photos: true,
        progressEvents: { orderBy: { createdAt: "asc" } },
        offers: {
          where: { status: OfferStatus.ACCEPTED },
          include: { offerer: true },
        },
        _count: { select: { offers: true } },
      },
    });
    this.realtime.requestUpdated({
      requestId,
      ownerId: request.ownerId,
      interestedUserIds: [acceptedOffer.offererId],
      request: serializeRequest(refreshedRequest, authorId) as Record<string, unknown>,
      reason: "review.created",
    });
    return serializeReview(review);
  }

  async conversation(requestId: string, userId: string, peerUserId?: string) {
    let resolvedPeer = peerUserId;
    if (!resolvedPeer) {
      const request = await this.prisma.serviceRequest.findUnique({
        where: { id: requestId },
        select: {
          ownerId: true,
          offers: {
            where: { status: OfferStatus.ACCEPTED },
            select: { offererId: true },
            take: 1,
          },
        },
      });
      if (!request) throw notFound("Request not found");
      resolvedPeer =
        request.ownerId === userId ? request.offers[0]?.offererId : request.ownerId;
    }
    const conversation = await this.findUserConversation(requestId, userId, resolvedPeer);
    if (!conversation) return { id: null, messages: [] };
    const messages = [...conversation.messages].reverse();
    return {
      id: conversation.id,
      messages: messages.map((message) =>
        serializeMessage(message, userId, conversation.participants),
      ),
    };
  }

  async openConversation(requestId: string, userId: string, peerUserId?: string) {
    const { request, peerUserId: peer } = await this.assertCanOpenRequestChat(
      requestId,
      userId,
      peerUserId,
    );
    await this.ensureConversation(request.id, userId, peer);
    const conversation = await this.findUserConversation(request.id, userId, peer);
    if (!conversation) throw notFound("Conversation not found");
    const messages = [...conversation.messages].reverse();
    return {
      id: conversation.id,
      messages: messages.map((message) =>
        serializeMessage(message, userId, conversation.participants),
      ),
    };
  }

  async createOffer(requestId: string, offererId: string, data: CreateOfferDto) {
    const request = await this.prisma.serviceRequest.findUnique({
      where: { id: requestId },
      select: { status: true, ownerId: true, pricingMode: true, title: true },
    });
    if (!request) throw notFound("Request not found");
    if (request.status !== ServiceRequestStatus.OPEN) {
      throw badRequest("Request is not open for offers");
    }
    if (request.ownerId === offererId) throw badRequest("Cannot offer on your own request");
    const isFixedPrice = request.pricingMode === RequestPricingMode.OWNER_FIXED_PRICE;
    if (isFixedPrice && data.priceCents != null) {
      throw badRequest("Fixed-price requests only accept interest");
    }
    if (!isFixedPrice && data.priceCents == null) throw badRequest("Price is required");

    const existing = await this.prisma.offer.findUnique({
      where: { requestId_offererId: { requestId, offererId } },
    });
    if (existing?.status === OfferStatus.PENDING) {
      throw conflict("You already have a pending offer on this request");
    }
    if (existing?.status === OfferStatus.ACCEPTED) {
      throw conflict("You already have an accepted offer on this request");
    }

    let offer;
    try {
      if (existing && (existing.status === OfferStatus.WITHDRAWN || existing.status === OfferStatus.DECLINED)) {
        offer = await this.prisma.offer.update({
          where: { id: existing.id },
          data: {
            status: OfferStatus.PENDING,
            priceCents: isFixedPrice ? null : data.priceCents,
            message: data.message,
          },
          include: { offerer: true },
        });
      } else {
        offer = await this.prisma.offer.create({
          data: {
            requestId,
            offererId,
            priceCents: isFixedPrice ? null : data.priceCents,
            message: data.message,
          },
          include: { offerer: true },
        });
      }
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        (error as { code: string }).code === "P2002"
      ) {
        throw conflict("You already have a pending offer on this request");
      }
      throw error;
    }

    await this.prisma.notification.create({
      data: {
        userId: request.ownerId,
        kind: NotificationKind.NEW_OFFER,
        title: isFixedPrice ? "New interest on your request" : "New offer on your request",
        body: isFixedPrice
          ? `${profileName(offer.offerer)} is interested.`
          : `${profileName(offer.offerer)} offered €${(data.priceCents! / 100).toFixed(0)}.`,
        contextTag: request.title,
        payload: { requestId, offerId: offer.id },
      },
    });
    const serializedOffer = serializeOffer(offer);
    this.realtime.offerCreated({
      requestId,
      ownerId: request.ownerId,
      providerId: offererId,
      offer: serializedOffer as Record<string, unknown>,
    });
    return serializedOffer;
  }

  async sendMessage(requestId: string, senderId: string, data: SendRequestMessageDto) {
    const { request, peerUserId } = await this.assertCanOpenRequestChat(requestId, senderId);
    const conversation = await this.ensureConversation(request.id, senderId, peerUserId);
    const message = await this.prisma.$transaction(async (transaction) => {
      const created = await transaction.message.create({
        data: { conversationId: conversation.id, senderId, body: data.body },
        include: { sender: true },
      });
      await transaction.conversation.update({
        where: { id: conversation.id },
        data: { updatedAt: new Date() },
      });
      return created;
    });
    const notification = await this.prisma.notification.create({
      data: {
        userId: peerUserId,
        kind: NotificationKind.NEW_MESSAGE,
        title: `${profileName(message.sender)} sent you a message`,
        body: data.body.length > 120 ? `${data.body.slice(0, 117)}...` : data.body,
        contextTag: request.title,
        payload: {
          requestId: request.id,
          conversationId: conversation.id,
          messageId: message.id,
        },
      },
    });
    const participantIds = [senderId, peerUserId];
    const serializedMessage = serializeMessage(message);
    this.realtime.messageCreated({
      conversationId: conversation.id,
      participantIds,
      message: serializedMessage as Record<string, unknown>,
    });
    this.realtime.notificationCreated(
      peerUserId,
      serializeNotification(notification) as Record<string, unknown>,
    );
    this.realtime.unreadUpdated(peerUserId, { conversationId: conversation.id });
    return serializedMessage;
  }
}
