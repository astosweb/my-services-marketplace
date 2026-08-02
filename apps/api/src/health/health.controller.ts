import { Controller, Get } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { ApiStandardErrors } from "../common/decorators/api-standard-errors.decorator.js";
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
  @ApiOkResponse({ description: "Database is reachable" })
  async ready() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { ok: true, database: "connected" };
  }
}
