import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { createClient } from "redis";
import { ApiStandardErrors } from "../common/decorators/api-standard-errors.decorator.js";
import { env } from "../lib/env.js";
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
      const client = createClient({ url: env.REDIS_URL });
      try {
        await client.connect();
        const pong = await client.ping();
        redis = pong === "PONG" ? "connected" : "error";
      } catch {
        redis = "error";
      } finally {
        await client.quit().catch(() => undefined);
      }
      if (redis === "error") {
        throw new ServiceUnavailableException({
          ok: false,
          database: "connected",
          redis: "error",
        });
      }
    }

    return { ok: true, database: "connected", redis };
  }
}
