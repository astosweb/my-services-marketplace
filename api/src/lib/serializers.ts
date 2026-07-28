import type {
  Category,
  Conversation,
  ConversationParticipant,
  Message,
  Notification,
  Offer,
  Review,
  RequestPhoto,
  ServiceRequest,
  User,
} from "../generated/prisma/client.js";
import { OfferStatus } from "../generated/prisma/client.js";
import { spacesPublicUrl } from "./env.js";

type RequestWithRelations = ServiceRequest & {
  category: Category;
  owner: User;
  photos: RequestPhoto[];
  offers?: (Offer & { offerer: User })[];
  _count?: { offers: number };
};

const cityLabels: Record<string, string> = {
  TALLINN: "Tallinn",
  TARTU: "Tartu",
  PARNU: "Pärnu",
  NARVA: "Narva",
};

export function serializeUser(user: User) {
  return {
    id: user.id,
    displayName: user.displayName,
    bio: user.bio,
    avatarUrl: user.avatarKey ? spacesPublicUrl(user.avatarKey) : null,
    rating: user.rating,
    reviewCount: user.reviewCount,
    memberSince: user.createdAt.toISOString(),
  };
}

export function serializeMe(user: User) {
  return {
    ...serializeUser(user),
    email: user.email,
  };
}

export function serializeCategory(category: Category) {
  return {
    id: category.id,
    name: category.name,
    symbol: category.symbol,
  };
}

export function serializeRequest(request: RequestWithRelations, viewerUserId?: string) {
  const acceptedOffer = request.offers?.find((offer) => offer.status === OfferStatus.ACCEPTED);
  const viewerOffer = viewerUserId
    ? request.offers?.find((offer) => offer.offererId === viewerUserId)
    : undefined;
  const canSeeAcceptedOffer =
    acceptedOffer && viewerUserId
      ? request.ownerId === viewerUserId || acceptedOffer.offererId === viewerUserId
      : false;
  const serializedAcceptedOffer =
    canSeeAcceptedOffer && acceptedOffer
      ? {
          id: acceptedOffer.id,
          priceCents: acceptedOffer.priceCents,
          message: acceptedOffer.message,
          createdAt: acceptedOffer.createdAt.toISOString(),
          provider: serializeUser(acceptedOffer.offerer),
        }
      : null;
  const serializedViewerOffer = viewerOffer
    ? {
        id: viewerOffer.id,
        requestId: viewerOffer.requestId,
        priceCents: viewerOffer.priceCents,
        message: viewerOffer.message,
        status: viewerOffer.status,
        createdAt: viewerOffer.createdAt.toISOString(),
        offerer: serializeUser(viewerOffer.offerer),
      }
    : null;

  return {
    id: request.id,
    categoryId: request.categoryId,
    categoryName: request.category.name,
    categorySymbol: request.category.symbol,
    title: request.title,
    description: request.description,
    city: cityLabels[request.city] ?? request.city,
    latitude: request.latitude,
    longitude: request.longitude,
    location: request.location,
    budgetCents: request.budgetCents,
    budget:
      request.budgetLabel ??
      (request.budgetCents != null ? `€${(request.budgetCents / 100).toFixed(0)}` : null),
    scheduledAt: request.scheduledAt?.toISOString() ?? null,
    pricingMode: request.pricingMode,
    status: request.status,
    progressStatus: request.progressStatus,
    progressUpdatedAt: request.progressUpdatedAt?.toISOString() ?? null,
    completedAt: request.completedAt?.toISOString() ?? null,
    cancelledAt: request.cancelledAt?.toISOString() ?? null,
    isPremium: request.isPremium,
    offerCount: request._count?.offers ?? 0,
    viewCount: request.viewCount,
    createdAt: request.createdAt.toISOString(),
    updatedAt: request.updatedAt.toISOString(),
    photos: request.photos
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((p) => ({
        id: p.id,
        url: spacesPublicUrl(p.spacesKey),
        sortOrder: p.sortOrder,
      })),
    requester: serializeUser(request.owner),
    acceptedOffer: serializedAcceptedOffer,
    viewerOffer: serializedViewerOffer,
  };
}

export function serializeOffer(offer: Offer & { offerer: User }) {
  return {
    id: offer.id,
    requestId: offer.requestId,
    priceCents: offer.priceCents,
    message: offer.message,
    status: offer.status,
    createdAt: offer.createdAt.toISOString(),
    offerer: serializeUser(offer.offerer),
  };
}

export function serializeReview(
  review: Review & { author: User; request?: ServiceRequest | null },
) {
  return {
    id: review.id,
    rating: review.rating,
    body: review.body,
    createdAt: review.createdAt.toISOString(),
    author: serializeUser(review.author),
    request: review.request
      ? {
          id: review.request.id,
          title: review.request.title,
        }
      : null,
  };
}

export function messagePreviewText(
  message: Pick<Message, "body" | "attachmentKey" | "attachmentName" | "attachmentMimeType">,
) {
  const text = message.body.trim();
  if (text) return text;
  if (!message.attachmentKey) return "";
  if (message.attachmentMimeType?.startsWith("image/")) return "Photo";
  return message.attachmentName ?? "Attachment";
}

type MessageReadState = {
  userId: string;
  lastReadAt: Date | null;
};

export function serializeMessage(
  message: Message & { sender: User },
  viewerUserId?: string,
  readStates?: MessageReadState[],
) {
  const otherParticipants =
    viewerUserId && message.senderId === viewerUserId
      ? readStates?.filter((participant) => participant.userId !== viewerUserId)
      : undefined;
  const status = otherParticipants?.some(
    (participant) => participant.lastReadAt && participant.lastReadAt >= message.createdAt,
  )
    ? "READ"
    : otherParticipants && otherParticipants.length > 0
      ? "DELIVERED"
      : message.status;

  return {
    id: message.id,
    conversationId: message.conversationId,
    body: message.body,
    status,
    createdAt: message.createdAt.toISOString(),
    sender: serializeUser(message.sender),
    attachment: message.attachmentKey
      ? {
          url: spacesPublicUrl(message.attachmentKey),
          name: message.attachmentName ?? "Attachment",
          mimeType: message.attachmentMimeType ?? "application/octet-stream",
        }
      : null,
  };
}

type ConversationWithRelations = Conversation & {
  request: ServiceRequest & { category: Category; owner: User };
  messages: (Message & { sender: User })[];
  participants: { userId: string; user: User }[];
};

function resolveOtherParticipant(conversation: ConversationWithRelations, userId: string): User {
  const others = conversation.participants.filter((p) => p.userId !== userId);
  const lastMessage = conversation.messages[0];
  if (lastMessage && lastMessage.senderId !== userId) {
    return lastMessage.sender;
  }
  if (others.length === 1) return others[0]!.user;
  if (others.length > 1) {
    const nonOwner = others.find((p) => p.userId !== conversation.request.ownerId);
    return nonOwner?.user ?? others[0]!.user;
  }
  return conversation.request.ownerId === userId
    ? conversation.request.owner
    : conversation.request.owner;
}

export function serializeConversationInbox(
  conversation: ConversationWithRelations,
  membership: ConversationParticipant,
  userId: string,
  unreadCount: number,
) {
  const lastMessage = conversation.messages[0];
  const otherParticipant = resolveOtherParticipant(conversation, userId);

  return {
    id: conversation.id,
    requestId: conversation.requestId,
    requestTitle: conversation.request.title,
    categoryId: conversation.request.categoryId,
    categoryName: conversation.request.category.name,
    categorySymbol: conversation.request.category.symbol,
    participant: serializeUser(otherParticipant),
    lastMessage: lastMessage
      ? {
          body: messagePreviewText(lastMessage),
          createdAt: lastMessage.createdAt.toISOString(),
          senderId: lastMessage.senderId,
        }
      : null,
    updatedAt: conversation.updatedAt.toISOString(),
    unreadCount,
    isPinned: membership.isPinned,
    isArchived: membership.isArchived,
  };
}

export function serializeNotification(notification: Notification) {
  return {
    id: notification.id,
    kind: notification.kind,
    title: notification.title,
    body: notification.body,
    contextTag: notification.contextTag,
    payload: notification.payload,
    isRead: notification.isRead,
    createdAt: notification.createdAt.toISOString(),
  };
}
