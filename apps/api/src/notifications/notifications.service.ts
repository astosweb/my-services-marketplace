import { Injectable } from "@nestjs/common";
import { RealtimeServerEvent } from "@monorepo/shared";
import { badRequest, notFound } from "../lib/errors.js";
import { categoryCatalog } from "../lib/category-catalog.js";
import { serializeCategory, serializeNotification } from "../lib/serializers.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { RealtimePublisher } from "../realtime/realtime.publisher.js";
import type {
  NotificationListQueryDto,
  UpdateNotificationPreferencesDto,
} from "./notifications.dto.js";

const MAX_NOTIFICATION_CATEGORIES = 3;
const knownCategoryIds = new Set<string>(categoryCatalog.map((category) => category.id));

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimePublisher,
  ) {}

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
    const updated = await this.prisma.notification.update({
      where: { id: notification.id },
      data: { isRead: true },
    });
    const serialized = serializeNotification(updated);
    this.realtime.emitToUser(userId, RealtimeServerEvent.NOTIFICATION_UPDATED, {
      notification: serialized,
    });
    this.realtime.unreadUpdated(userId, {});
    return serialized;
  }

  async readAll(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
    this.realtime.emitToUser(userId, RealtimeServerEvent.NOTIFICATION_UPDATED, { allRead: true });
    this.realtime.unreadUpdated(userId, { notificationsUnread: 0 });
    return { ok: true };
  }

  async getPreferences(userId: string) {
    const preferences = await this.prisma.notificationPreference.findMany({
      where: { userId },
      include: { category: true },
      orderBy: { createdAt: "asc" },
    });
    return {
      categoryIds: preferences.map((preference) => preference.categoryId),
      categories: preferences.map((preference) => serializeCategory(preference.category)),
      maxSelections: MAX_NOTIFICATION_CATEGORIES,
    };
  }

  async updatePreferences(userId: string, data: UpdateNotificationPreferencesDto) {
    const categoryIds = [...new Set(data.categoryIds.map((id) => id.trim()).filter(Boolean))];
    if (categoryIds.length > MAX_NOTIFICATION_CATEGORIES) {
      throw badRequest("You can select at most 3 notification categories");
    }

    const unknown = categoryIds.filter((id) => !knownCategoryIds.has(id));
    if (unknown.length > 0) {
      throw badRequest(`Unknown category id(s): ${unknown.join(", ")}`);
    }

    const existingCategories = await this.prisma.category.findMany({
      where: { id: { in: categoryIds } },
      select: { id: true },
    });
    if (existingCategories.length !== categoryIds.length) {
      const found = new Set(existingCategories.map((category) => category.id));
      const missing = categoryIds.filter((id) => !found.has(id));
      throw badRequest(`Unknown category id(s): ${missing.join(", ")}`);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.notificationPreference.deleteMany({ where: { userId } });
      if (categoryIds.length > 0) {
        await tx.notificationPreference.createMany({
          data: categoryIds.map((categoryId) => ({ userId, categoryId })),
        });
      }
    });

    return this.getPreferences(userId);
  }
}
