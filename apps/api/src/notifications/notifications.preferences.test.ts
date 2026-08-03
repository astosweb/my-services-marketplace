import { describe, expect, it, vi, beforeEach } from "vitest";
import type { AppError } from "../lib/errors.js";
import { NotificationsService } from "./notifications.service.js";

describe("NotificationsService.updatePreferences", () => {
  const prisma = {
    category: {
      findMany: vi.fn(),
    },
    notificationPreference: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    $transaction: vi.fn(),
  };

  const service = new NotificationsService(prisma as never);

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.$transaction.mockImplementation(async (fn: (tx: typeof prisma) => Promise<unknown>) =>
      fn(prisma),
    );
    prisma.notificationPreference.findMany.mockResolvedValue([]);
  });

  it("rejects more than three categories", async () => {
    await expect(
      service.updatePreferences("user-1", {
        categoryIds: ["plumbing", "cleaning", "moving", "hvac"],
      }),
    ).rejects.toMatchObject({
      status: 400,
      message: "You can select at most 3 notification categories",
    } satisfies Partial<AppError>);
  });

  it("rejects unknown category ids", async () => {
    await expect(
      service.updatePreferences("user-1", {
        categoryIds: ["not_a_real_category"],
      }),
    ).rejects.toMatchObject({
      status: 400,
    });
  });

  it("replaces preferences with up to three valid categories", async () => {
    prisma.category.findMany.mockResolvedValue([
      { id: "plumbing" },
      { id: "cleaning" },
    ]);
    prisma.notificationPreference.findMany.mockResolvedValue([
      {
        categoryId: "plumbing",
        category: { id: "plumbing", name: "Plumbing", symbol: "drop.fill" },
      },
      {
        categoryId: "cleaning",
        category: { id: "cleaning", name: "Cleaning", symbol: "sparkles" },
      },
    ]);

    const result = await service.updatePreferences("user-1", {
      categoryIds: ["plumbing", "cleaning", "plumbing"],
    });

    expect(prisma.notificationPreference.deleteMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
    });
    expect(prisma.notificationPreference.createMany).toHaveBeenCalledWith({
      data: [
        { userId: "user-1", categoryId: "plumbing" },
        { userId: "user-1", categoryId: "cleaning" },
      ],
    });
    expect(result.categoryIds).toEqual(["plumbing", "cleaning"]);
    expect(result.maxSelections).toBe(3);
  });
});
