import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { AllExceptionsFilter } from "../common/filters/all-exceptions.filter.js";
import { RequestIdMiddleware } from "../common/middleware/request-id.middleware.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { HealthController } from "./health.controller.js";

describe("HealthController", () => {
  let app: INestApplication;
  const queryRaw = vi.fn().mockResolvedValue([{ "?column?": 1 }]);

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: PrismaService, useValue: { $queryRaw: queryRaw } }],
    }).compile();
    app = module.createNestApplication();
    const requestId = new RequestIdMiddleware();
    app.use(requestId.use.bind(requestId));
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
  });

  afterAll(async () => app.close());

  it("reports liveness", async () => {
    await request(app.getHttpServer())
      .get("/health")
      .expect(200)
      .expect({ ok: true, service: "hero-api" });
  });

  it("reports database readiness", async () => {
    await request(app.getHttpServer())
      .get("/health/ready")
      .expect(200)
      .expect({ ok: true, database: "connected" });
    expect(queryRaw).toHaveBeenCalledOnce();
  });

  it("preserves the error envelope and request id", async () => {
    const response = await request(app.getHttpServer()).get("/missing").expect(404);
    expect(response.headers["x-request-id"]).toBeTruthy();
    expect(response.body).toEqual({
      error: {
        message: "Not found",
        code: "NOT_FOUND",
        requestId: response.headers["x-request-id"],
      },
    });
  });
});
