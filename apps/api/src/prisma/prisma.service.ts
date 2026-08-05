import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";
import { databaseSslOptions } from "../lib/database-ssl.js";
import { env } from "../lib/env.js";

import pg from "pg";
const { Pool } = pg;

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const pool = new Pool({
      connectionString: env.DATABASE_URL,
      ...databaseSslOptions(env.DATABASE_URL),
    });
    super({
      adapter: new PrismaPg(pool),
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
