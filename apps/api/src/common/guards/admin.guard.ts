import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import type { Request } from "express";
import { UserRole } from "../../generated/prisma/client.js";
import { forbidden, unauthorized } from "../../lib/errors.js";
import { PrismaService } from "../../prisma/prisma.service.js";

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request & { user?: { id: string } }>();
    const userId = request.user?.id;
    if (!userId) throw unauthorized("Authentication required");

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, isDisabled: true },
    });
    if (!user || user.isDisabled) throw unauthorized("Authentication required");
    if (user.role !== UserRole.ADMIN) throw forbidden("Admin access required");
    return true;
  }
}
