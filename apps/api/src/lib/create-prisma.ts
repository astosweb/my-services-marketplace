import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";

export function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required");
  }

  return new PrismaClient({
    adapter: new PrismaPg({
      connectionString,
      ...(process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === "false"
        ? { ssl: { rejectUnauthorized: false } }
        : {}),
    }),
  });
}
