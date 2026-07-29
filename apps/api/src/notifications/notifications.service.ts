import { Injectable } from "@nestjs/common";
import { notFound } from "../lib/errors.js";
import { serializeNotification } from "../lib/serializers.js";
import { PrismaService } from "../prisma/prisma.service.js";
import type { NotificationListQueryDto } from "./notifications.dto.js";

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, query: NotificationListQueryDto) {
    const [notifications, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: query.limit,
        skip: query.offset,
      }),
      this.prisma.notification.count({ where: { userId } }),
      this.prisma.notification.count({ where: { userId, isRead: false } }),
    ]);
    return {
      data: notifications.map(serializeNotification),
      meta: { total, limit: query.limit, offset: query.offset, unreadCount },
    };
  }

  async markRead(userId: string, id: string) {
    const notification = await this.prisma.notification.findFirst({ where: { id, userId } });
    if (!notification) throw notFound("Notification not found");
    return serializeNotification(
      await this.prisma.notification.update({
        where: { id: notification.id },
        data: { isRead: true },
      }),
    );
  }

  async readAll(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
    return { ok: true };
  }
}
