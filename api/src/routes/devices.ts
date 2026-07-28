import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { parseOrThrow } from "../lib/validate.js";
import type { AuthVariables } from "../middleware/auth.js";
import { requireAuth } from "../middleware/auth.js";

const registerSchema = z.object({
  token: z.string().min(8).max(512),
  platform: z.enum(["ios", "android", "web"]).default("ios"),
});

export const deviceRoutes = new Hono<{ Variables: AuthVariables }>();

deviceRoutes.use("*", requireAuth);

deviceRoutes.post("/", async (c) => {
  const userId = c.get("userId");
  const parsed = parseOrThrow(registerSchema, await c.req.json());

  const device = await prisma.deviceToken.upsert({
    where: { token: parsed.token },
    create: {
      userId,
      token: parsed.token,
      platform: parsed.platform,
    },
    update: {
      userId,
      platform: parsed.platform,
    },
  });

  return c.json({
    data: {
      id: device.id,
      token: device.token,
      platform: device.platform,
      createdAt: device.createdAt.toISOString(),
    },
  });
});

deviceRoutes.delete("/:token", async (c) => {
  const userId = c.get("userId");
  const token = decodeURIComponent(c.req.param("token"));

  await prisma.deviceToken.deleteMany({
    where: { token, userId },
  });

  return c.json({ data: { ok: true } });
});
