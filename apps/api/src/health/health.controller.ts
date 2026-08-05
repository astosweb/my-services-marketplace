import { Controller, Get } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { ApiStandardErrors } from "../common/decorators/api-standard-errors.decorator.js";
import { env } from "../lib/env.js";
import { serviceUnavailable } from "../lib/errors.js";
import { getRateLimitStore, RedisRateLimitStore } from "../middleware/rate-limit.js";
import { PrismaService } from "../prisma/prisma.service.js";

@ApiTags("Health")
@ApiStandardErrors()
@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: "Liveness check" })
  @ApiOkResponse({ description: "API process is healthy" })
  live() {
    return { ok: true, service: "bidy-api" };
  }

  @Get("ready")
  @ApiOperation({ summary: "Readiness check" })
  @ApiOkResponse({ description: "Database (and Redis when configured) are reachable" })
  async ready() {
    await this.prisma.$queryRaw`SELECT 1`;

    let redis: "connected" | "skipped" | "error" = "skipped";
    if (env.REDIS_URL) {
      try {
        const store = getRateLimitStore();
        if (store instanceof RedisRateLimitStore) {
          const pong = await store.getClient().ping();
          redis = pong === "PONG" ? "connected" : "error";
        } else {
          redis = "error";
        }
      } catch {
        redis = "error";
      }
      if (redis === "error") {
        throw serviceUnavailable("Redis is unavailable");
      }
    }

    return { ok: true, database: "connected", redis };
  }
}
