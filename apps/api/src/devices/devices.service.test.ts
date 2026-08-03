import { describe, expect, it, vi } from "vitest";
import { DevicesService } from "./devices.service.js";

describe("DevicesService", () => {
  it("does not transfer a registered device token to another account", async () => {
    const prisma = {
      deviceToken: {
        findUnique: vi.fn().mockResolvedValue({ userId: "owner-id" }),
        upsert: vi.fn(),
      },
    };
    const service = new DevicesService(prisma as never);

    await expect(
      service.register("another-user-id", { token: "push-token", platform: "ios" }),
    ).rejects.toMatchObject({
      message: "This device is already registered to another account",
      status: 403,
    });
    expect(prisma.deviceToken.upsert).not.toHaveBeenCalled();
  });

  it("updates metadata without changing the owning account", async () => {
    const prisma = {
      deviceToken: {
        findUnique: vi.fn().mockResolvedValue({ userId: "user-id" }),
        upsert: vi.fn().mockResolvedValue({
          id: "device-id",
          token: "push-token",
          platform: "ios",
          name: null,
          systemVersion: null,
          appVersion: null,
          ipAddress: null,
          userAgent: null,
          isActive: true,
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        }),
      },
    };
    const service = new DevicesService(prisma as never);

    await service.register("user-id", { token: "push-token", platform: "ios" });

    expect(prisma.deviceToken.upsert).toHaveBeenCalledWith(
      {
        where: { token: "push-token" },
        create: {
          userId: "user-id",
          token: "push-token",
          platform: "ios",
          name: null,
          systemVersion: null,
          appVersion: null,
          ipAddress: null,
          userAgent: null,
          isActive: true,
        },
        update: { platform: "ios", isActive: true },
      },
    );
  });
});
