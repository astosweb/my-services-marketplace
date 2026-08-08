import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Prefer unpooled Neon URL for schema push / migrate (PgBouncer breaks some DDL).
    url: process.env.DATABASE_URL_UNPOOLED || env("DATABASE_URL"),
  },
});
