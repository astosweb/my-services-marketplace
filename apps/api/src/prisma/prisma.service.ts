import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";
import { env } from "../lib/env.js";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      adapter: new PrismaPg({
        connectionString: env.DATABASE_URL,
        ...(env.DATABASE_SSL_REJECT_UNAUTHORIZED === "false"
          ? { ssl: { rejectUnauthorized: false } }
          : {}),
      }),
      log: env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    });
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log("Database connected");
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
