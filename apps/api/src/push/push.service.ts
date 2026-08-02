import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { NotificationKind, UserStatus } from "../generated/prisma/client.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { ApnsClient } from "./apns.client.js";

export type CategoryRequestPushInput = {
  requestId: string;
  categoryId: string;
  categoryName: string;
  title: string;
  ownerId: string;
};

@Injectable()
export class PushService implements OnModuleDestroy {
  private readonly logger = new Logger(PushService.name);
  private readonly apns = new ApnsClient();

  constructor(private readonly prisma: PrismaService) {}

  onModuleDestroy() {
    this.apns.close();
  }

  /**
   * Notify users subscribed to the request's category after admin approval.
   * Creates in-app notifications and sends APNs to active iOS tokens only.
   */
  async notifyCategorySubscribersOfApprovedRequest(input: CategoryRequestPushInput) {
    const subscribers = await this.prisma.notificationPreference.findMany({
      where: {
        categoryId: input.categoryId,
        userId: { not: input.ownerId },
        user: { status: UserStatus.ACTIVE },
      },
      select: { userId: true },
    });

    const userIds = [...new Set(subscribers.map((row) => row.userId))];
    if (userIds.length === 0) {
      this.logger.debug(`No category subscribers for ${input.categoryId}`);
      return { notifiedUsers: 0, pushAttempted: 0, pushDelivered: 0 };
    }

    const notificationTitle = `New ${input.categoryName} request`;
    const notificationBody = input.title;

    await this.prisma.notification.createMany({
      data: userIds.map((userId) => ({
        userId,
        kind: NotificationKind.NEW_REQUEST,
        title: notificationTitle,
        body: notificationBody,
        contextTag: "request",
        payload: {
          requestId: input.requestId,
          categoryId: input.categoryId,
          action: "APPROVED_PUBLIC",
        },
      })),
    });

    const devices = await this.prisma.deviceToken.findMany({
      where: {
        userId: { in: userIds },
        isActive: true,
        platform: "ios",
        NOT: { token: { startsWith: "idfv-" } },
      },
      select: { id: true, token: true, userId: true },
    });

    if (!this.apns.isConfigured()) {
      this.logger.warn("APNs is not configured; skipped push delivery");
      return { notifiedUsers: userIds.length, pushAttempted: 0, pushDelivered: 0 };
    }

    let pushDelivered = 0;
    const inactiveIds: string[] = [];

    await Promise.all(
      devices.map(async (device) => {
        const result = await this.apns.send(device.token, {
          aps: {
            alert: {
              title: notificationTitle,
              body: notificationBody,
            },
            sound: "default",
          },
          requestId: input.requestId,
          categoryId: input.categoryId,
          kind: NotificationKind.NEW_REQUEST,
        });

        if (result.ok) {
          pushDelivered += 1;
          return;
        }
        this.logger.warn(
          `APNs failed for device ${device.id}: ${result.reason} (status ${result.status})`,
        );
        if (result.shouldInvalidateToken) {
          inactiveIds.push(device.id);
        }
      }),
    );

    if (inactiveIds.length > 0) {
      await this.prisma.deviceToken.updateMany({
        where: { id: { in: inactiveIds } },
        data: { isActive: false },
      });
      this.logger.log(`Marked ${inactiveIds.length} APNs token(s) inactive`);
    }

    return {
      notifiedUsers: userIds.length,
      pushAttempted: devices.length,
      pushDelivered,
    };
  }
}
