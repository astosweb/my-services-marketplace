import { Injectable } from "@nestjs/common";
import type { UpdateProfileDto } from "../auth/auth.dto.js";
import { badRequest, forbidden, notFound } from "../lib/errors.js";
import { assertOwnedObjectKey } from "../lib/owned-keys.js";
import { serializeMe, serializeReview, serializeUser } from "../lib/serializers.js";
import { PrismaService } from "../prisma/prisma.service.js";

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async get(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw notFound("User not found");
    return serializeUser(user);
  }

  async reviews(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!user) throw notFound("User not found");
    return (
      await this.prisma.review.findMany({
        where: { subjectId: id },
        include: { author: true, request: true },
        orderBy: { createdAt: "desc" },
        take: 50,
      })
    ).map(serializeReview);
  }

  async update(id: string, userId: string, data: UpdateProfileDto) {
    if (id !== userId) throw forbidden("You can only update your own profile");
    if (Object.keys(data).length === 0) throw badRequest("No fields to update");
    if (data.avatarKey) assertOwnedObjectKey(data.avatarKey, userId, "avatars");
    try {
      return serializeMe(await this.prisma.user.update({ where: { id }, data }));
    } catch {
      throw notFound("User not found");
    }
  }
}
