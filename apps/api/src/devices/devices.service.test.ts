import { describe, expect, it, vi } from "vitest";
import { DevicesService } from "./devices.service.js";

describe("DevicesService", () => {
  it("does not transfer a registered device token to another account", async () => {
    const findUnique = vi.fn().mockResolvedValue({ id: "device-id", userId: "owner-id" });
    const update = vi.fn();
    const create = vi.fn();
    const prisma = {
      $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          deviceToken: { findUnique, update, create },
        }),
      ),
    };
    const service = new DevicesService(prisma as never);

    await expect(
      service.register("another-user-id", { token: "push-token", platform: "ios" }),
    ).rejects.toMatchObject({
      message: "This device is already registered to another account",
      status: 403,
    });
    expect(update).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it("updates metadata without changing the owning account", async () => {
    const findUnique = vi.fn().mockResolvedValue({ id: "device-id", userId: "user-id" });
    const update = vi.fn().mockResolvedValue({
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
    });
    const create = vi.fn();
    const prisma = {
      $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          deviceToken: { findUnique, update, create },
        }),
      ),
    };
    const service = new DevicesService(prisma as never);

    await service.register("user-id", { token: "push-token", platform: "ios" });

    expect(update).toHaveBeenCalledWith({
      where: { id: "device-id" },
      data: { platform: "ios", isActive: true },
    });
    expect(create).not.toHaveBeenCalled();
  });
});
