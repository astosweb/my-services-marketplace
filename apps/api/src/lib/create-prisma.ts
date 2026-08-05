import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";
import { databaseSslOptions } from "./database-ssl.js";

export function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required");
  }

  return new PrismaClient({
    adapter: new PrismaPg({
      connectionString,
      ...databaseSslOptions(connectionString),
    }),
  });
}
