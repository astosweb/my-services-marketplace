import { beforeEach, describe, expect, it, vi } from "vitest";
import { FavoritesService } from "./favorites.service.js";

describe("FavoritesService", () => {
  const prisma = {
    favorite: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    serviceRequest: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
  };

  const service = new FavoritesService(prisma as never);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists favorite request ids and items", async () => {
    const createdAt = new Date("2026-01-01T00:00:00.000Z");
    prisma.favorite.findMany.mockResolvedValue([
      {
        id: "fav-1",
        requestId: "req-1",
        createdAt,
        request: {
          id: "req-1",
          categoryId: "cleaning",
          title: "Clean apartment",
          description: "Need a deep clean",
          city: "TALLINN",
          latitude: 59.4,
          longitude: 24.7,
          location: "Old Town",
          budgetCents: 10000,
          budgetLabel: null,
          scheduledAt: null,
          pricingMode: "PROVIDER_OFFERS",
          status: "OPEN",
          progressStatus: null,
          progressUpdatedAt: null,
          completedAt: null,
          cancelledAt: null,
          rejectionReason: null,
          isPremium: false,
          viewCount: 2,
          createdAt,
          updatedAt: createdAt,
          category: { id: "cleaning", name: "Cleaning", symbol: "🧹" },
          owner: {
            id: "owner-1",
            displayName: "Owner",
            businessName: null,
            preferBusinessName: true,
            bio: null,
            avatarKey: null,
            rating: 5,
            reviewCount: 1,
            role: "USER",
            status: "ACTIVE",
            createdAt,
          },
          photos: [],
          _count: { offers: 0 },
        },
      },
    ]);

    const result = await service.list("user-1");
    expect(result.ids).toEqual(["req-1"]);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.requestId).toBe("req-1");
    expect(result.items[0]?.request.title).toBe("Clean apartment");
  });

  it("adds a favorite for an existing request", async () => {
    const createdAt = new Date("2026-01-02T00:00:00.000Z");
    prisma.serviceRequest.findUnique.mockResolvedValue({ id: "req-2" });
    prisma.favorite.create.mockResolvedValue({
      id: "fav-2",
      requestId: "req-2",
      createdAt,
      request: {
        id: "req-2",
        categoryId: "cleaning",
        title: "Window wash",
        description: "Windows need washing",
        city: "TARTU",
        latitude: 58.3,
        longitude: 26.7,
        location: "Centre",
        budgetCents: null,
        budgetLabel: null,
        scheduledAt: null,
        pricingMode: "PROVIDER_OFFERS",
        status: "OPEN",
        progressStatus: null,
        progressUpdatedAt: null,
        completedAt: null,
        cancelledAt: null,
        rejectionReason: null,
        isPremium: false,
        viewCount: 0,
        createdAt,
        updatedAt: createdAt,
        category: { id: "cleaning", name: "Cleaning", symbol: "🧹" },
        owner: {
          id: "owner-2",
          displayName: "Owner Two",
          businessName: null,
          preferBusinessName: true,
          bio: null,
          avatarKey: null,
          rating: 0,
          reviewCount: 0,
          role: "USER",
          status: "ACTIVE",
          createdAt,
        },
        photos: [],
        _count: { offers: 1 },
      },
    });

    const result = await service.add("user-1", { requestId: "req-2" });
    expect(result.requestId).toBe("req-2");
    expect(prisma.favorite.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { userId: "user-1", requestId: "req-2" },
      }),
    );
  });

  it("removes a favorite", async () => {
    prisma.favorite.deleteMany.mockResolvedValue({ count: 1 });
    await expect(service.remove("user-1", "req-1")).resolves.toEqual({
      removed: true,
      requestId: "req-1",
    });
  });

  it("syncs valid local ids and skips missing requests", async () => {
    prisma.serviceRequest.findMany.mockResolvedValue([{ id: "req-1" }]);
    prisma.favorite.createMany.mockResolvedValue({ count: 1 });
    prisma.favorite.findMany.mockResolvedValue([]);

    await service.sync("user-1", { requestIds: ["req-1", "missing"] });

    expect(prisma.favorite.createMany).toHaveBeenCalledWith({
      data: [{ userId: "user-1", requestId: "req-1" }],
      skipDuplicates: true,
    });
  });
});
