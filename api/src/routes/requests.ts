import { Hono } from "hono";
import { z } from "zod";
import {
  EstonianCity,
  JobProgressStatus,
  NotificationKind,
  OfferStatus,
  RequestPricingMode,
  ServiceRequestStatus,
} from "../generated/prisma/client.js";
import { verifyAccessToken } from "../lib/auth.js";
import { ensureCategoryCatalog } from "../lib/category-catalog.js";
import { badRequest, conflict, forbidden, notFound } from "../lib/errors.js";
import { assertOwnedObjectKeys } from "../lib/owned-keys.js";
import { prisma } from "../lib/prisma.js";
import {
  serializeMessage,
  serializeOffer,
  serializeRequest,
  serializeReview,
} from "../lib/serializers.js";
import { parseOrThrow } from "../lib/validate.js";
import type { AuthVariables } from "../middleware/auth.js";
import { requireAuth } from "../middleware/auth.js";
import { viewRateLimit } from "../middleware/rate-limit.js";

const citySchema = z.enum(EstonianCity);

const listQuerySchema = z.object({
  city: citySchema.optional(),
  categoryId: z.string().optional(),
  status: z.enum(ServiceRequestStatus).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const mineQuerySchema = z.object({
  role: z.enum(["owner", "provider"]).default("owner"),
  limit: z.coerce.number().int().min(1).max(100).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

const createRequestSchema = z.object({
  categoryId: z.string().min(1),
  title: z.string().min(3).max(200),
  description: z.string().min(10).max(5000),
  city: citySchema,
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  location: z.string().min(1).max(500),
  budgetCents: z.number().int().positive().optional(),
  budgetLabel: z.string().max(50).optional(),
  scheduledAt: z.iso.datetime().optional(),
  pricingMode: z.enum(RequestPricingMode).optional(),
  isPremium: z.boolean().optional(),
  photoKeys: z.array(z.string().min(1)).max(9).optional(),
});

const createOfferSchema = z.object({
  priceCents: z.number().int().positive().nullish(),
  message: z.string().max(2000).optional(),
});

const sendMessageSchema = z.object({
  body: z.string().min(1).max(5000),
});

const updateOfferStatusSchema = z.object({
  status: z.enum([OfferStatus.ACCEPTED, OfferStatus.DECLINED, OfferStatus.WITHDRAWN]),
});

const updateRequestStatusSchema = z.object({
  status: z.enum([ServiceRequestStatus.COMPLETED, ServiceRequestStatus.CANCELLED]),
});

const updateProgressSchema = z.object({
  status: z.enum([
    JobProgressStatus.ON_THE_WAY,
    JobProgressStatus.STARTED,
    JobProgressStatus.PROVIDER_DONE,
  ]),
});

const createReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  body: z.string().max(1000).optional(),
});

const providerProgressOrder = [
  JobProgressStatus.ACCEPTED,
  JobProgressStatus.ON_THE_WAY,
  JobProgressStatus.STARTED,
  JobProgressStatus.PROVIDER_DONE,
] as const;

async function optionalUserId(authHeader: string | null | undefined) {
  if (!authHeader?.startsWith("Bearer ")) return undefined;
  return (await verifyAccessToken(authHeader.slice(7))) ?? undefined;
}

async function ensureConversation(requestId: string, ownerId: string, participantId: string) {
  const existing = await prisma.conversation.findFirst({
    where: {
      requestId,
      AND: [
        { participants: { some: { userId: ownerId } } },
        { participants: { some: { userId: participantId } } },
      ],
    },
  });
  if (existing) return existing;

  return prisma.conversation.create({
    data: {
      requestId,
      participants: {
        create: [{ userId: ownerId }, { userId: participantId }],
      },
    },
  });
}

/**
 * Messaging policy: thread only if
 * (a) user is request owner chatting with accepted provider, or
 * (b) user has a pending/accepted offer on the request.
 */
async function assertCanOpenRequestChat(requestId: string, userId: string) {
  const request = await prisma.serviceRequest.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      title: true,
      ownerId: true,
      offers: {
        where: {
          OR: [
            { status: OfferStatus.ACCEPTED },
            { offererId: userId, status: { in: [OfferStatus.PENDING, OfferStatus.ACCEPTED] } },
          ],
        },
        select: { offererId: true, status: true },
      },
    },
  });
  if (!request) throw notFound("Request not found");

  if (request.ownerId === userId) {
    const accepted = request.offers.find((o) => o.status === OfferStatus.ACCEPTED);
    if (!accepted) throw badRequest("No accepted provider to chat with");
    return { request, peerUserId: accepted.offererId };
  }

  const ownOffer = request.offers.find(
    (o) =>
      o.offererId === userId &&
      (o.status === OfferStatus.PENDING || o.status === OfferStatus.ACCEPTED),
  );
  if (!ownOffer) {
    throw forbidden("Only users with a pending or accepted offer can message the request owner");
  }
  return { request, peerUserId: request.ownerId };
}

async function findUserConversation(requestId: string, userId: string, peerUserId?: string) {
  return prisma.conversation.findFirst({
    where: {
      requestId,
      participants: { some: { userId } },
      ...(peerUserId
        ? { AND: [{ participants: { some: { userId: peerUserId } } }] }
        : {}),
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

async function refreshUserRating(userId: string) {
  const aggregate = await prisma.review.aggregate({
    where: { subjectId: userId },
    _avg: { rating: true },
    _count: { _all: true },
  });

  await prisma.user.update({
    where: { id: userId },
    data: {
      rating: aggregate._avg.rating ?? 0,
      reviewCount: aggregate._count._all,
    },
  });
}

export const requestRoutes = new Hono<{ Variables: AuthVariables }>();

requestRoutes.get("/", async (c) => {
  const { city, categoryId, status, limit, offset } = parseOrThrow(listQuerySchema, c.req.query());

  const [requests, total] = await Promise.all([
    prisma.serviceRequest.findMany({
      where: { city, categoryId, status: status ?? ServiceRequestStatus.OPEN },
      include: {
        category: true,
        owner: true,
        photos: true,
        offers: { where: { status: OfferStatus.ACCEPTED }, include: { offerer: true } },
        _count: { select: { offers: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.serviceRequest.count({
      where: { city, categoryId, status: status ?? ServiceRequestStatus.OPEN },
    }),
  ]);

  return c.json({
    data: requests.map((request) => serializeRequest(request)),
    meta: { total, limit, offset },
  });
});

requestRoutes.get("/mine", requireAuth, async (c) => {
  const userId = c.get("userId");
  const { role, limit, offset } = parseOrThrow(mineQuerySchema, c.req.query());
  const where =
    role === "owner" ? { ownerId: userId } : { offers: { some: { offererId: userId } } };

  const [requests, total] = await Promise.all([
    prisma.serviceRequest.findMany({
      where,
      include: {
        category: true,
        owner: true,
        photos: true,
        offers: {
          where:
            role === "owner"
              ? { status: OfferStatus.ACCEPTED }
              : { OR: [{ offererId: userId }, { status: OfferStatus.ACCEPTED }] },
          include: { offerer: true },
          orderBy: { createdAt: "desc" },
        },
        _count: { select: { offers: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.serviceRequest.count({ where }),
  ]);

  return c.json({
    data: requests.map((request) => serializeRequest(request, userId)),
    meta: { total, limit, offset },
  });
});

requestRoutes.get("/:id", async (c) => {
  const viewerUserId = await optionalUserId(c.req.header("Authorization"));
  const request = await prisma.serviceRequest.findUnique({
    where: { id: c.req.param("id") },
    include: {
      category: true,
      owner: true,
      photos: true,
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
  return c.json({ data: serializeRequest(request, viewerUserId) });
});

requestRoutes.post("/:id/views", viewRateLimit, async (c) => {
  const requestId = c.req.param("id");
  const viewerUserId = await optionalUserId(c.req.header("Authorization"));
  const existingRequest = await prisma.serviceRequest.findUnique({
    where: { id: requestId },
    select: { id: true, ownerId: true, updatedAt: true },
  });
  if (!existingRequest) throw notFound("Request not found");

  // Avoid update+include: adapter-pg runs parallel relation queries on one tx client (pg deprecation).
  if (viewerUserId !== existingRequest.ownerId) {
    await prisma.serviceRequest.update({
      where: { id: requestId },
      // Preserve updatedAt — view increments aren't content edits.
      data: { viewCount: { increment: 1 }, updatedAt: existingRequest.updatedAt },
    });
  }

  const request = await prisma.serviceRequest.findUniqueOrThrow({
    where: { id: requestId },
    include: {
      category: true,
      owner: true,
      photos: true,
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

  return c.json({ data: serializeRequest(request, viewerUserId) });
});

requestRoutes.post("/", requireAuth, async (c) => {
  const data = parseOrThrow(createRequestSchema, await c.req.json());
  const ownerId = c.get("userId");
  const pricingMode = data.pricingMode ?? RequestPricingMode.PROVIDER_OFFERS;

  if (pricingMode === RequestPricingMode.OWNER_FIXED_PRICE && data.budgetCents == null) {
    throw badRequest("Fixed price is required");
  }

  if (data.photoKeys?.length) {
    assertOwnedObjectKeys(data.photoKeys, ownerId, "requests");
  }

  await ensureCategoryCatalog(prisma);
  const category = await prisma.category.findUnique({ where: { id: data.categoryId } });
  if (!category) throw badRequest("Category not found");

  const request = await prisma.serviceRequest.create({
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
            create: data.photoKeys.map((spacesKey, index) => ({
              spacesKey,
              sortOrder: index,
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

  return c.json({ data: serializeRequest(request) }, 201);
});

requestRoutes.patch("/:id", requireAuth, async (c) => {
  const data = parseOrThrow(createRequestSchema, await c.req.json());
  const userId = c.get("userId");
  const requestId = c.req.param("id");
  const pricingMode = data.pricingMode ?? RequestPricingMode.PROVIDER_OFFERS;

  if (pricingMode === RequestPricingMode.OWNER_FIXED_PRICE && data.budgetCents == null) {
    throw badRequest("Fixed price is required");
  }

  if (data.photoKeys?.length) {
    assertOwnedObjectKeys(data.photoKeys, userId, "requests");
  }

  const existing = await prisma.serviceRequest.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      ownerId: true,
      status: true,
      _count: { select: { offers: true } },
    },
  });
  if (!existing) throw notFound("Request not found");
  if (existing.ownerId !== userId) {
    throw forbidden("Only the post owner can edit this request");
  }
  if (existing.status !== ServiceRequestStatus.OPEN) {
    throw badRequest("Only open requests can be edited");
  }
  if (existing._count.offers > 0) {
    throw conflict("Cannot edit a request that already has offers");
  }

  await ensureCategoryCatalog(prisma);
  const category = await prisma.category.findUnique({ where: { id: data.categoryId } });
  if (!category) throw badRequest("Category not found");

  const request = await prisma.$transaction(async (tx) => {
    if (data.photoKeys) {
      await tx.requestPhoto.deleteMany({ where: { requestId } });
      if (data.photoKeys.length > 0) {
        await tx.requestPhoto.createMany({
          data: data.photoKeys.map((spacesKey, index) => ({
            requestId,
            spacesKey,
            sortOrder: index,
          })),
        });
      }
    }

    return tx.serviceRequest.update({
      where: { id: requestId },
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

  return c.json({ data: serializeRequest(request) });
});

requestRoutes.get("/:id/offers", requireAuth, async (c) => {
  const userId = c.get("userId");

  const request = await prisma.serviceRequest.findUnique({
    where: { id: c.req.param("id") },
    select: { id: true, ownerId: true },
  });
  if (!request) throw notFound("Request not found");
  if (request.ownerId !== userId) {
    throw forbidden("Only the post owner can view offers");
  }

  const offers = await prisma.offer.findMany({
    where: { requestId: request.id },
    include: { offerer: true },
    orderBy: { createdAt: "desc" },
  });

  return c.json({ data: offers.map(serializeOffer) });
});

requestRoutes.patch("/:id/offers/:offerId", requireAuth, async (c) => {
  const parsed = parseOrThrow(updateOfferStatusSchema, await c.req.json());

  const userId = c.get("userId");
  const requestId = c.req.param("id");
  const offerId = c.req.param("offerId");

  const offer = await prisma.offer.findFirst({
    where: { id: offerId, requestId },
    include: {
      offerer: true,
      request: { select: { id: true, ownerId: true, title: true, status: true } },
    },
  });
  if (!offer) throw notFound("Offer not found");
  if (offer.status !== OfferStatus.PENDING) {
    throw badRequest("Only pending offers can be updated");
  }

  if (parsed.status === OfferStatus.WITHDRAWN) {
    if (offer.offererId !== userId) {
      throw forbidden("Only the offer author can withdraw an offer");
    }
    const withdrawn = await prisma.offer.update({
      where: { id: offer.id },
      data: { status: OfferStatus.WITHDRAWN },
      include: { offerer: true },
    });
    return c.json({ data: serializeOffer(withdrawn) });
  }

  if (offer.request.ownerId !== userId) {
    throw forbidden("Only the post owner can respond to offers");
  }
  if (
    parsed.status === OfferStatus.ACCEPTED &&
    offer.request.status !== ServiceRequestStatus.OPEN
  ) {
    throw badRequest("Request is not open for offers");
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (parsed.status === OfferStatus.ACCEPTED) {
      const requestUpdate = await tx.serviceRequest.updateMany({
        where: { id: requestId, status: ServiceRequestStatus.OPEN },
        data: {
          status: ServiceRequestStatus.IN_PROGRESS,
          progressStatus: JobProgressStatus.ACCEPTED,
          progressUpdatedAt: new Date(),
          cancelledAt: null,
          completedAt: null,
        },
      });
      if (requestUpdate.count === 0) {
        throw badRequest("Request is not open for offers");
      }
    }

    const next = await tx.offer.update({
      where: { id: offer.id },
      data: { status: parsed.status },
      include: { offerer: true },
    });

    if (parsed.status === OfferStatus.ACCEPTED) {
      await tx.offer.updateMany({
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
  if (parsed.status === OfferStatus.ACCEPTED) {
    await ensureConversation(requestId, userId, offer.offererId);
    await prisma.notification.create({
      data: {
        userId: offer.offererId,
        kind: NotificationKind.OFFER_ACCEPTED,
        title: offer.priceCents == null ? "Your interest was accepted" : "Your offer was accepted",
        body: `The owner accepted your ${responseLabel}.`,
        contextTag: offer.request.title,
        payload: { requestId, offerId: offer.id },
      },
    });
  } else {
    await prisma.notification.create({
      data: {
        userId: offer.offererId,
        kind: NotificationKind.OFFER_DECLINED,
        title: offer.priceCents == null ? "Interest declined" : "Offer declined",
        body: `Your ${responseLabel} was declined.`,
        contextTag: offer.request.title,
        payload: { requestId, offerId: offer.id },
      },
    });
  }

  return c.json({ data: serializeOffer(updated) });
});

requestRoutes.patch("/:id/status", requireAuth, async (c) => {
  const parsed = parseOrThrow(updateRequestStatusSchema, await c.req.json());

  const ownerId = c.get("userId");
  const requestId = c.req.param("id");

  const existing = await prisma.serviceRequest.findUnique({
    where: { id: requestId },
    select: { id: true, ownerId: true, title: true, status: true, progressStatus: true },
  });
  if (!existing) throw notFound("Request not found");
  if (existing.ownerId !== ownerId) {
    throw forbidden("Only the post owner can update request status");
  }

  if (
    parsed.status === ServiceRequestStatus.COMPLETED &&
    existing.status !== ServiceRequestStatus.IN_PROGRESS
  ) {
    throw badRequest("Only in-progress requests can be completed");
  }
  if (
    parsed.status === ServiceRequestStatus.COMPLETED &&
    existing.progressStatus !== JobProgressStatus.PROVIDER_DONE
  ) {
    throw badRequest("Owner can complete only after the provider marks the job done");
  }
  if (
    parsed.status === ServiceRequestStatus.CANCELLED &&
    existing.status === ServiceRequestStatus.COMPLETED
  ) {
    throw badRequest("Completed requests cannot be cancelled");
  }
  if (existing.status === ServiceRequestStatus.CANCELLED) {
    throw badRequest("Request is already cancelled");
  }

  const now = new Date();
  const request = await prisma.$transaction(async (tx) => {
    if (parsed.status === ServiceRequestStatus.CANCELLED) {
      await tx.offer.updateMany({
        where: {
          requestId,
          status: OfferStatus.PENDING,
        },
        data: { status: OfferStatus.DECLINED },
      });
    }

    return tx.serviceRequest.update({
      where: { id: requestId },
      data:
        parsed.status === ServiceRequestStatus.COMPLETED
          ? {
              status: parsed.status,
              progressStatus: JobProgressStatus.OWNER_CONFIRMED,
              progressUpdatedAt: now,
              completedAt: now,
            }
          : {
              status: parsed.status,
              progressUpdatedAt: now,
              cancelledAt: now,
            },
      include: {
        category: true,
        owner: true,
        photos: true,
        offers: { where: { status: OfferStatus.ACCEPTED }, include: { offerer: true } },
        _count: { select: { offers: true } },
      },
    });
  });

  const acceptedOffer = request.offers[0];
  if (acceptedOffer) {
    await prisma.notification.create({
      data: {
        userId: acceptedOffer.offererId,
        kind:
          parsed.status === ServiceRequestStatus.COMPLETED
            ? NotificationKind.JOB_COMPLETED
            : NotificationKind.REMINDER,
        title: parsed.status === ServiceRequestStatus.COMPLETED ? "Job completed" : "Job cancelled",
        body:
          parsed.status === ServiceRequestStatus.COMPLETED
            ? "The owner confirmed the job is done."
            : "The owner cancelled this job.",
        contextTag: existing.title,
        payload: { requestId },
      },
    });
  }

  return c.json({ data: serializeRequest(request, ownerId) });
});

requestRoutes.patch("/:id/progress", requireAuth, async (c) => {
  const parsed = parseOrThrow(updateProgressSchema, await c.req.json());

  const providerId = c.get("userId");
  const requestId = c.req.param("id");

  const acceptedOffer = await prisma.offer.findFirst({
    where: { requestId, offererId: providerId, status: OfferStatus.ACCEPTED },
    include: {
      request: {
        select: { id: true, title: true, ownerId: true, status: true, progressStatus: true },
      },
      offerer: true,
    },
  });
  if (!acceptedOffer) {
    throw forbidden("Only the accepted provider can update progress");
  }
  if (acceptedOffer.request.status !== ServiceRequestStatus.IN_PROGRESS) {
    throw badRequest("Only in-progress jobs can be updated by the provider");
  }

  const currentProgress = acceptedOffer.request.progressStatus ?? JobProgressStatus.ACCEPTED;
  const currentIndex = providerProgressOrder.indexOf(
    currentProgress as (typeof providerProgressOrder)[number],
  );
  const nextIndex = providerProgressOrder.indexOf(parsed.status);
  if (nextIndex !== currentIndex + 1) {
    throw badRequest("Progress can only advance one step at a time");
  }

  const now = new Date();
  const request = await prisma.serviceRequest.update({
    where: { id: requestId },
    data: {
      progressStatus: parsed.status,
      progressUpdatedAt: now,
    },
    include: {
      category: true,
      owner: true,
      photos: true,
      offers: { where: { status: OfferStatus.ACCEPTED }, include: { offerer: true } },
      _count: { select: { offers: true } },
    },
  });

  const progressBody = (() => {
    switch (parsed.status) {
      case JobProgressStatus.ON_THE_WAY:
        return `${acceptedOffer.offerer.displayName} is on the way.`;
      case JobProgressStatus.STARTED:
        return `${acceptedOffer.offerer.displayName} started the job.`;
      case JobProgressStatus.PROVIDER_DONE:
        return `${acceptedOffer.offerer.displayName} marked the job ready for confirmation.`;
      default:
        return `${acceptedOffer.offerer.displayName} updated the job progress.`;
    }
  })();

  await prisma.notification.create({
    data: {
      userId: acceptedOffer.request.ownerId,
      kind:
        parsed.status === JobProgressStatus.PROVIDER_DONE
          ? NotificationKind.JOB_COMPLETED
          : NotificationKind.REMINDER,
      title: "Job progress updated",
      body: progressBody,
      contextTag: acceptedOffer.request.title,
      payload: { requestId, progressStatus: parsed.status },
    },
  });

  return c.json({ data: serializeRequest(request, providerId) });
});

requestRoutes.post("/:id/reviews", requireAuth, async (c) => {
  const parsed = parseOrThrow(createReviewSchema, await c.req.json());

  const authorId = c.get("userId");
  const requestId = c.req.param("id");

  const request = await prisma.serviceRequest.findUnique({
    where: { id: requestId },
    include: {
      offers: { where: { status: OfferStatus.ACCEPTED }, include: { offerer: true } },
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
  if (!subjectId) {
    throw forbidden("Only the owner and accepted provider can review this job");
  }

  const existingReview = await prisma.review.findFirst({
    where: { authorId, requestId },
  });
  if (existingReview) {
    throw conflict("You already reviewed this job");
  }

  const body = parsed.body?.trim();
  const review = await prisma.review.create({
    data: {
      authorId,
      subjectId,
      requestId,
      rating: parsed.rating,
      body: body ? body : undefined,
    },
    include: { author: true, request: true },
  });

  await refreshUserRating(subjectId);

  await prisma.notification.create({
    data: {
      userId: subjectId,
      kind: NotificationKind.REVIEW,
      title: "New review",
      body: `${review.author.displayName} left you a ${parsed.rating}-star review.`,
      contextTag: request.title,
      payload: { requestId, reviewId: review.id },
    },
  });

  return c.json({ data: serializeReview(review) }, 201);
});

requestRoutes.get("/:id/conversation", requireAuth, async (c) => {
  const userId = c.get("userId");

  const request = await prisma.serviceRequest.findUnique({
    where: { id: c.req.param("id") },
    select: {
      id: true,
      ownerId: true,
      offers: {
        where: { status: OfferStatus.ACCEPTED },
        select: { offererId: true },
        take: 1,
      },
    },
  });
  if (!request) throw notFound("Request not found");

  const peerUserId =
    request.ownerId === userId ? request.offers[0]?.offererId : request.ownerId;

  const conversation = await findUserConversation(request.id, userId, peerUserId);

  if (!conversation) {
    return c.json({ data: { id: null, messages: [] } });
  }

  return c.json({
    data: {
      id: conversation.id,
      messages: conversation.messages.map((message) =>
        serializeMessage(message, userId, conversation.participants),
      ),
    },
  });
});

requestRoutes.post("/:id/conversation", requireAuth, async (c) => {
  const userId = c.get("userId");
  const { request, peerUserId } = await assertCanOpenRequestChat(c.req.param("id"), userId);

  const otherParticipantId = request.ownerId === userId ? peerUserId : userId;
  await ensureConversation(request.id, request.ownerId, otherParticipantId);

  const conversation = await findUserConversation(request.id, userId, peerUserId);
  if (!conversation) throw notFound("Conversation not found");

  return c.json({
    data: {
      id: conversation.id,
      messages: conversation.messages.map((message) =>
        serializeMessage(message, userId, conversation.participants),
      ),
    },
  });
});

requestRoutes.post("/:id/offers", requireAuth, async (c) => {
  const parsed = parseOrThrow(createOfferSchema, await c.req.json());

  const offererId = c.get("userId");

  const request = await prisma.serviceRequest.findUnique({
    where: { id: c.req.param("id") },
    select: { id: true, status: true, ownerId: true, pricingMode: true, title: true },
  });
  if (!request) throw notFound("Request not found");
  if (request.status !== ServiceRequestStatus.OPEN) {
    throw badRequest("Request is not open for offers");
  }
  if (request.ownerId === offererId) {
    throw badRequest("Cannot offer on your own request");
  }

  const existingOffer = await prisma.offer.findFirst({
    where: {
      requestId: request.id,
      offererId,
      status: OfferStatus.PENDING,
    },
  });
  if (existingOffer) {
    throw conflict("You already have a pending offer on this request");
  }

  const isFixedPriceRequest = request.pricingMode === RequestPricingMode.OWNER_FIXED_PRICE;
  if (isFixedPriceRequest && parsed.priceCents != null) {
    throw badRequest("Fixed-price requests only accept interest");
  }
  if (!isFixedPriceRequest && parsed.priceCents == null) {
    throw badRequest("Price is required");
  }

  const offer = await prisma.offer.create({
    data: {
      requestId: request.id,
      offererId,
      priceCents: isFixedPriceRequest ? null : parsed.priceCents,
      message: parsed.message,
    },
    include: { offerer: true },
  });

  const offerer = await prisma.user.findUnique({ where: { id: offererId } });
  if (offerer) {
    await prisma.notification.create({
      data: {
        userId: request.ownerId,
        kind: NotificationKind.NEW_OFFER,
        title: isFixedPriceRequest ? "New interest on your request" : "New offer on your request",
        body: isFixedPriceRequest
          ? `${offerer.displayName} is interested.`
          : `${offerer.displayName} offered €${(parsed.priceCents! / 100).toFixed(0)}.`,
        contextTag: request.title,
        payload: { requestId: request.id, offerId: offer.id },
      },
    });
  }

  return c.json({ data: serializeOffer(offer) }, 201);
});

requestRoutes.post("/:id/messages", requireAuth, async (c) => {
  const parsed = parseOrThrow(sendMessageSchema, await c.req.json());

  const senderId = c.get("userId");
  const { request, peerUserId } = await assertCanOpenRequestChat(c.req.param("id"), senderId);

  if (request.ownerId === senderId) {
    throw badRequest("Owners should message via the accepted-provider conversation");
  }

  const conversation = await ensureConversation(request.id, request.ownerId, senderId);

  const message = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      senderId,
      body: parsed.body,
    },
    include: { sender: true },
  });

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { updatedAt: new Date() },
  });

  const sender = message.sender;
  await prisma.notification.create({
    data: {
      userId: peerUserId,
      kind: NotificationKind.NEW_MESSAGE,
      title: `${sender.displayName} sent you a message`,
      body: parsed.body.length > 120 ? `${parsed.body.slice(0, 117)}...` : parsed.body,
      contextTag: request.title,
      payload: { requestId: request.id, conversationId: conversation.id, messageId: message.id },
    },
  });

  return c.json({ data: serializeMessage(message) }, 201);
});
