import { type CanActivate, type ExecutionContext, Injectable } from "@nestjs/common";
import type { Request } from "express";
import { UserRole } from "../../generated/prisma/client.js";
import { forbidden, unauthorized } from "../../lib/errors.js";
import { PrismaService } from "../../prisma/prisma.service.js";

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext) {
    const userId = context.switchToHttp().getRequest<Request & { user?: { id: string } }>()
      .user?.id;
    if (!userId) throw unauthorized("Authentication required");
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, status: true },
    });
    if (!user) throw unauthorized("Authentication required");
    if (user.status === "BANNED") throw forbidden("This account has been banned");
    if (user.role !== UserRole.ADMIN) throw forbidden("Admin access required");
    return true;
  }
}
