import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotificationKind } from "../generated/prisma/client.js";
import { PushService } from "./push.service.js";

describe("PushService.notifyCategorySubscribersOfApprovedRequest", () => {
  const prisma = {
    notificationPreference: {
      findMany: vi.fn(),
    },
    notification: {
      createMany: vi.fn(),
    },
    deviceToken: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
  };

  const realtime = {
    notificationCreated: vi.fn(),
    unreadUpdated: vi.fn(),
  };

  const service = new PushService(prisma as never, realtime as never);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates in-app notifications only for subscribed users excluding the owner", async () => {
    prisma.notificationPreference.findMany.mockResolvedValue([
      { userId: "user-a" },
      { userId: "user-b" },
      { userId: "user-a" },
    ]);
    prisma.deviceToken.findMany.mockResolvedValue([]);

    const result = await service.notifyCategorySubscribersOfApprovedRequest({
      requestId: "req-1",
      categoryId: "plumbing",
      categoryName: "Plumbing",
      title: "Fix a leak",
      ownerId: "owner-1",
    });

    expect(prisma.notificationPreference.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- vitest asymmetric matcher
        where: expect.objectContaining({
          categoryId: "plumbing",
          userId: { not: "owner-1" },
        }),
      }),
    );
    expect(prisma.notification.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          userId: "user-a",
          kind: NotificationKind.NEW_REQUEST,
          title: "New Plumbing request",
          body: "Fix a leak",
        }),
        expect.objectContaining({
          userId: "user-b",
          kind: NotificationKind.NEW_REQUEST,
        }),
      ],
    });
    expect(result.notifiedUsers).toBe(2);
    expect(result.pushAttempted).toBe(0);
  });

  it("skips work when nobody subscribed to the category", async () => {
    prisma.notificationPreference.findMany.mockResolvedValue([]);

    const result = await service.notifyCategorySubscribersOfApprovedRequest({
      requestId: "req-1",
      categoryId: "cleaning",
      categoryName: "Cleaning",
      title: "Deep clean",
      ownerId: "owner-1",
    });

    expect(prisma.notification.createMany).not.toHaveBeenCalled();
    expect(prisma.deviceToken.findMany).not.toHaveBeenCalled();
    expect(result).toEqual({ notifiedUsers: 0, pushAttempted: 0, pushDelivered: 0 });
  });
});
