import { Injectable } from "@nestjs/common";
import {
  JobProgressStatus,
  NotificationKind,
  OfferStatus,
  RequestPricingMode,
  ServiceRequestStatus,
} from "../generated/prisma/client.js";
import { ensureCategoryCatalog } from "../lib/category-catalog.js";
import { badRequest, conflict, forbidden, notFound } from "../lib/errors.js";
import { assertOwnedObjectKeys } from "../lib/owned-keys.js";
import {
  profileName,
  serializeMessage,
  serializeOffer,
  serializeRequest,
  serializeReview,
} from "../lib/serializers.js";
import { PrismaService } from "../prisma/prisma.service.js";
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
  constructor(private readonly prisma: PrismaService) {}

  private async ensureConversation(requestId: string, userA: string, userB: string) {
    if (userA === userB) throw badRequest("Cannot message yourself");
    const existing = await this.prisma.conversation.findFirst({
      where: {
        requestId,
        AND: [
          { participants: { some: { userId: userA } } },
          { participants: { some: { userId: userB } } },
        ],
      },
    });
    if (existing) return existing;
    return this.prisma.conversation.create({
      data: {
        requestId,
        participants: { create: [{ userId: userA }, { userId: userB }] },
      },
    });
  }

  private async assertCanOpenRequestChat(
    requestId: string,
    userId: string,
    peerUserId?: string,
  ) {
    const request = await this.prisma.serviceRequest.findUnique({
      where: { id: requestId },
      select: { id: true, title: true, ownerId: true },
    });
    if (!request) throw notFound("Request not found");

    const peer = peerUserId ?? (request.ownerId === userId ? undefined : request.ownerId);
    if (!peer) throw badRequest("peerUserId is required");
    if (peer === userId) throw badRequest("Cannot message yourself");

    const peerUser = await this.prisma.user.findUnique({
      where: { id: peer },
      select: { id: true },
    });
    if (!peerUser) throw notFound("User not found");

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
          orderBy: { createdAt: "asc" },
        },
        participants: { select: { userId: true, lastReadAt: true } },
      },
      orderBy: { updatedAt: "desc" },
    });
  }

  private async refreshUserRating(userId: string) {
    const aggregate = await this.prisma.review.aggregate({
      where: { subjectId: userId },
      _avg: { rating: true },
      _count: { _all: true },
    });
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        rating: aggregate._avg.rating ?? 0,
        reviewCount: aggregate._count._all,
      },
    });
  }

  async list(query: RequestListQueryDto) {
    const where = {
      city: query.city,
      categoryId: query.categoryId,
      status: query.status ?? ServiceRequestStatus.OPEN,
    };
    const [requests, total] = await Promise.all([
      this.prisma.serviceRequest.findMany({
        where,
        include: {
          category: true,
          owner: true,
          photos: true,
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
    return serializeRequest(request, viewerUserId);
  }

  async view(id: string, viewerUserId?: string) {
    const existing = await this.prisma.serviceRequest.findUnique({
      where: { id },
      select: { ownerId: true, updatedAt: true },
    });
    if (!existing) throw notFound("Request not found");
    if (viewerUserId !== existing.ownerId) {
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
    await ensureCategoryCatalog(this.prisma);
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
        isPremium: data.isPremium ?? false,
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
    return serializeRequest(request);
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
    if (existing.status !== ServiceRequestStatus.OPEN) {
      throw badRequest("Only open requests can be edited");
    }
    if (existing._count.offers > 0) {
      throw conflict("Cannot edit a request that already has offers");
    }
    await ensureCategoryCatalog(this.prisma);
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
          isPremium: data.isPremium ?? false,
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
      return serializeOffer(
        await this.prisma.offer.update({
          where: { id: offer.id },
          data: { status: OfferStatus.WITHDRAWN },
          include: { offerer: true },
        }),
      );
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
    return serializeOffer(updated);
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
      await transaction.serviceRequest.update({
        where: { id: requestId },
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
    return serializeRequest(request, ownerId);
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
      await transaction.serviceRequest.update({
        where: { id: requestId },
        data: {
          progressStatus: data.status,
          progressUpdatedAt: now,
          updatedAt: acceptedOffer.request.updatedAt,
        },
      });
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
    return serializeRequest(request, providerId);
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
    if (await this.prisma.review.findFirst({ where: { authorId, requestId } })) {
      throw conflict("You already reviewed this job");
    }
    const body = data.body?.trim();
    const review = await this.prisma.review.create({
      data: {
        authorId,
        subjectId,
        requestId,
        rating: data.rating,
        body: body || undefined,
      },
      include: { author: true, request: true },
    });
    await this.refreshUserRating(subjectId);
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
    return {
      id: conversation.id,
      messages: conversation.messages.map((message) =>
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
    return {
      id: conversation.id,
      messages: conversation.messages.map((message) =>
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
    if (
      await this.prisma.offer.findFirst({
        where: { requestId, offererId, status: OfferStatus.PENDING },
      })
    ) {
      throw conflict("You already have a pending offer on this request");
    }
    const isFixedPrice = request.pricingMode === RequestPricingMode.OWNER_FIXED_PRICE;
    if (isFixedPrice && data.priceCents != null) {
      throw badRequest("Fixed-price requests only accept interest");
    }
    if (!isFixedPrice && data.priceCents == null) throw badRequest("Price is required");
    const offer = await this.prisma.offer.create({
      data: {
        requestId,
        offererId,
        priceCents: isFixedPrice ? null : data.priceCents,
        message: data.message,
      },
      include: { offerer: true },
    });
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
    return serializeOffer(offer);
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
    await this.prisma.notification.create({
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
    return serializeMessage(message);
  }
}
