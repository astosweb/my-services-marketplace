import { ServiceRequestStatus } from "../generated/prisma/client.js";
import { describe, expect, it, vi } from "vitest";
import { RequestsService } from "./requests.service.js";

describe("RequestsService", () => {
  it.each([
    ServiceRequestStatus.IN_PROGRESS,
    ServiceRequestStatus.COMPLETED,
    ServiceRequestStatus.CANCELLED,
  ])("does not expose %s requests in the public listing", async (status) => {
    const service = new RequestsService({} as never);

    await expect(service.list({ limit: 50, offset: 0, status })).rejects.toMatchObject({
      message: "Only open and pending review requests are publicly listed",
      status: 400,
    });
  });

  it("lists open and pending review requests by default", async () => {
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
          status: {
            in: [ServiceRequestStatus.OPEN, ServiceRequestStatus.PENDING_REVIEW],
          },
        },
      }),
    );
  });

  it("allows filtering public list to pending review", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const count = vi.fn().mockResolvedValue(0);
    const service = new RequestsService({
      serviceRequest: { findMany, count },
    } as never);

    await service.list({ limit: 50, offset: 0, status: ServiceRequestStatus.PENDING_REVIEW });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- vitest asymmetric matcher
        where: expect.objectContaining({
          status: ServiceRequestStatus.PENDING_REVIEW,
        }),
      }),
    );
  });
});
