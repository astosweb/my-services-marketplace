import { Injectable } from "@nestjs/common";
import type { UpdateProfileDto } from "../auth/auth.dto.js";
import type { UserReviewsQueryDto } from "./users.dto.js";
import { Prisma, UserStatus } from "../generated/prisma/client.js";
import { badRequest, forbidden, notFound } from "../lib/errors.js";
import { assertOwnedObjectKey } from "../lib/owned-keys.js";
import { serializeMe, serializeReview, serializeUser } from "../lib/serializers.js";
import { PrismaService } from "../prisma/prisma.service.js";

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async get(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user || user.status === UserStatus.BANNED) throw notFound("User not found");
    return serializeUser(user);
  }

  async reviews(id: string, query: UserReviewsQueryDto) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!user || user.status === UserStatus.BANNED) throw notFound("User not found");
    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where: { subjectId: id },
        include: { author: true, request: true },
        orderBy: { createdAt: "desc" },
        take: query.limit,
        skip: query.offset,
      }),
      this.prisma.review.count({ where: { subjectId: id } }),
    ]);
    return {
      data: reviews.map(serializeReview),
      meta: { total, limit: query.limit, offset: query.offset },
    };
  }

  async update(id: string, userId: string, data: UpdateProfileDto) {
    if (id !== userId) throw forbidden("You can only update your own profile");
    if (Object.keys(data).length === 0) throw badRequest("No fields to update");
    if (data.avatarKey) assertOwnedObjectKey(data.avatarKey, userId, "avatars");
    try {
      return serializeMe(await this.prisma.user.update({ where: { id }, data }));
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
        throw notFound("User not found");
      }
      throw error;
    }
  }
}
