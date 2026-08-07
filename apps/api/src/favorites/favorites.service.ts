import { Injectable } from "@nestjs/common";
import { Prisma } from "../generated/prisma/client.js";
import { badRequest, notFound } from "../lib/errors.js";
import { serializeRequest } from "../lib/serializers.js";
import { PrismaService } from "../prisma/prisma.service.js";
import type { AddFavoriteDto, SyncFavoritesDto } from "./favorites.dto.js";

const favoriteRequestInclude = {
  category: true,
  owner: true,
  photos: true,
  _count: { select: { offers: true } },
} as const;

@Injectable()
export class FavoritesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    const favorites = await this.prisma.favorite.findMany({
      where: { userId },
      include: { request: { include: favoriteRequestInclude } },
      orderBy: { createdAt: "desc" },
    });

    return {
      ids: favorites.map((favorite) => favorite.requestId),
      items: favorites.map((favorite) => ({
        id: favorite.id,
        requestId: favorite.requestId,
        createdAt: favorite.createdAt.toISOString(),
        request: serializeRequest(favorite.request),
      })),
    };
  }

  async add(userId: string, data: AddFavoriteDto) {
    const request = await this.prisma.serviceRequest.findUnique({
      where: { id: data.requestId },
      select: { id: true },
    });
    if (!request) throw notFound("Request not found");

    try {
      const favorite = await this.prisma.favorite.create({
        data: { userId, requestId: data.requestId },
        include: { request: { include: favoriteRequestInclude } },
      });
      return {
        id: favorite.id,
        requestId: favorite.requestId,
        createdAt: favorite.createdAt.toISOString(),
        request: serializeRequest(favorite.request),
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const existing = await this.prisma.favorite.findUnique({
          where: {
            userId_requestId: { userId, requestId: data.requestId },
          },
          include: { request: { include: favoriteRequestInclude } },
        });
        if (!existing) throw badRequest("Could not add favorite");
        return {
          id: existing.id,
          requestId: existing.requestId,
          createdAt: existing.createdAt.toISOString(),
          request: serializeRequest(existing.request),
        };
      }
      throw error;
    }
  }

  async remove(userId: string, requestId: string) {
    const result = await this.prisma.favorite.deleteMany({
      where: { userId, requestId },
    });
    if (result.count === 0) throw notFound("Favorite not found");
    return { removed: true as const, requestId };
  }

  async sync(userId: string, data: SyncFavoritesDto) {
    const uniqueIds = [...new Set(data.requestIds)];
    if (uniqueIds.length === 0) {
      return this.list(userId);
    }

    const existingRequests = await this.prisma.serviceRequest.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true },
    });
    const validIds = existingRequests.map((request) => request.id);
    if (validIds.length > 0) {
      await this.prisma.favorite.createMany({
        data: validIds.map((requestId) => ({ userId, requestId })),
        skipDuplicates: true,
      });
    }

    return this.list(userId);
  }
}
