import { Hono } from "hono";
import { z } from "zod";
import { notFound } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { serializeNotification } from "../lib/serializers.js";
import { parseOrThrow } from "../lib/validate.js";
import type { AuthVariables } from "../middleware/auth.js";
import { requireAuth } from "../middleware/auth.js";

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const markReadSchema = z.object({
  isRead: z.literal(true),
});

export const notificationRoutes = new Hono<{ Variables: AuthVariables }>();

notificationRoutes.get("/", requireAuth, async (c) => {
  const parsed = parseOrThrow(listQuerySchema, c.req.query());

  const userId = c.get("userId");
  const { limit, offset } = parsed;

  const [notifications, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.notification.count({ where: { userId } }),
    prisma.notification.count({ where: { userId, isRead: false } }),
  ]);

  return c.json({
    data: notifications.map(serializeNotification),
    meta: { total, limit, offset, unreadCount },
  });
});

notificationRoutes.patch("/:id", requireAuth, async (c) => {
  const userId = c.get("userId");
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    body = {};
  }
  parseOrThrow(markReadSchema, body);

  const notification = await prisma.notification.findFirst({
    where: { id: c.req.param("id"), userId },
  });
  if (!notification) throw notFound("Notification not found");

  const updated = await prisma.notification.update({
    where: { id: notification.id },
    data: { isRead: true },
  });

  return c.json({ data: serializeNotification(updated) });
});

notificationRoutes.post("/read-all", requireAuth, async (c) => {
  const userId = c.get("userId");

  await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });

  return c.json({ data: { ok: true } });
});
