import { Hono } from "hono";
import { prisma } from "../lib/prisma.js";

export const healthRoutes = new Hono();

healthRoutes.get("/", (c) => c.json({ ok: true, service: "hero-api" }));

healthRoutes.get("/ready", async (c) => {
  await prisma.$queryRaw`SELECT 1`;
  return c.json({ ok: true, database: "connected" });
});
