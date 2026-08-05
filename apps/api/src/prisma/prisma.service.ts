import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";
import { env } from "../lib/env.js";

import pg from "pg";
const { Pool } = pg;

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private readonly pool: pg.Pool;

  constructor() {
    const databaseHost = new URL(env.DATABASE_URL).hostname;
    const usesLocalDatabase = ["localhost", "127.0.0.1", "::1", "postgres"].includes(databaseHost);
    const pool = new Pool({
      connectionString: env.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30_000,
      ...(env.DATABASE_SSL_REJECT_UNAUTHORIZED === "false"
        ? { ssl: { rejectUnauthorized: false } }
        : env.NODE_ENV === "production" && !usesLocalDatabase
          ? { ssl: { rejectUnauthorized: true } }
        : {}),
    });
    super({
      adapter: new PrismaPg(pool),
      log: env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    });
    this.pool = pool;
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log("Database connected");
  }

  async onModuleDestroy() {
    await this.$disconnect();
    await this.pool.end();
  }
}
