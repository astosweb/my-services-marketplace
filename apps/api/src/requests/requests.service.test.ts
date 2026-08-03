import { ServiceRequestStatus } from "../generated/prisma/client.js";
import { describe, expect, it } from "vitest";
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
});
