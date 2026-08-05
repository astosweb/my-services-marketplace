import { ServiceRequestStatus } from "../generated/prisma/client.js";
import { describe, expect, it, vi } from "vitest";
import { RequestsService } from "./requests.service.js";

describe("RequestsService", () => {
  it.each([
    ServiceRequestStatus.PENDING_REVIEW,
    ServiceRequestStatus.IN_PROGRESS,
    ServiceRequestStatus.COMPLETED,
    ServiceRequestStatus.CANCELLED,
  ])("does not expose %s requests in the public listing", async (status) => {
    const service = new RequestsService({} as never);

    await expect(service.list({ limit: 50, offset: 0, status })).rejects.toMatchObject({
      message: "Only open requests are publicly listed",
      status: 400,
    });
  });

  it("lists only open requests from active owners by default", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const count = vi.fn().mockResolvedValue(0);
    const service = new RequestsService({
      serviceRequest: { findMany, count },
    } as never);

    await service.list({ limit: 50, offset: 0 });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          city: undefined,
          categoryId: undefined,
          status: ServiceRequestStatus.OPEN,
          owner: { status: "ACTIVE" },
        },
      }),
    );
  });

  it("rejects chat when users are unrelated to the request", async () => {
    const service = new RequestsService({
      serviceRequest: {
        findUnique: vi.fn().mockResolvedValue({
          id: "req-1",
          title: "Help",
          ownerId: "owner-1",
          status: ServiceRequestStatus.OPEN,
          offers: [],
        }),
      },
      user: { findUnique: vi.fn() },
    } as never);

    await expect(
      service["assertCanOpenRequestChat"]("req-1", "stranger-1", "owner-1"),
    ).rejects.toMatchObject({
      status: 403,
      message: "You can only message participants related to this request",
    });
  });
});
