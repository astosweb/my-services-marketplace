import { Hono } from "hono";
import { z } from "zod";
import { badRequest, forbidden, notFound } from "../lib/errors.js";
import { assertOwnedObjectKey } from "../lib/owned-keys.js";
import { prisma } from "../lib/prisma.js";
import { serializeMe, serializeReview, serializeUser } from "../lib/serializers.js";
import { parseOrThrow } from "../lib/validate.js";
import type { AuthVariables } from "../middleware/auth.js";
import { requireAuth } from "../middleware/auth.js";

const updateUserSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  bio: z.string().max(1000).nullable().optional(),
  avatarKey: z.string().min(1).nullable().optional(),
});

export const userRoutes = new Hono<{ Variables: AuthVariables }>();

userRoutes.get("/:id", async (c) => {
  const user = await prisma.user.findUnique({ where: { id: c.req.param("id") } });
  if (!user) throw notFound("User not found");
  return c.json({ data: serializeUser(user) });
});

userRoutes.get("/:id/reviews", async (c) => {
  const user = await prisma.user.findUnique({
    where: { id: c.req.param("id") },
    select: { id: true },
  });
  if (!user) throw notFound("User not found");

  const reviews = await prisma.review.findMany({
    where: { subjectId: user.id },
    include: { author: true, request: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return c.json({ data: reviews.map(serializeReview) });
});

userRoutes.patch("/:id", requireAuth, async (c) => {
  if (c.req.param("id") !== c.get("userId")) {
    throw forbidden("You can only update your own profile");
  }

  const parsed = parseOrThrow(updateUserSchema, await c.req.json());

  if (Object.keys(parsed).length === 0) {
    throw badRequest("No fields to update");
  }

  if (parsed.avatarKey) {
    assertOwnedObjectKey(parsed.avatarKey, c.get("userId"), "avatars");
  }

  try {
    const user = await prisma.user.update({
      where: { id: c.req.param("id") },
      data: parsed,
    });
    return c.json({ data: serializeMe(user) });
  } catch {
    throw notFound("User not found");
  }
});
