import { Hono } from "hono";
import { z } from "zod";
import { OfferStatus, ServiceRequestStatus } from "../generated/prisma/client.js";
import {
  createPasswordResetToken,
  createRefreshTokenValue,
  hashPasswordResetToken,
  hashPassword,
  hashRefreshToken,
  passwordResetTokenExpiresAt,
  refreshTokenExpiresAt,
  signAccessToken,
  verifyPassword,
} from "../lib/auth.js";
import { env } from "../lib/env.js";
import { badRequest, conflict, notFound, unauthorized } from "../lib/errors.js";
import { assertOwnedObjectKey } from "../lib/owned-keys.js";
import { prisma } from "../lib/prisma.js";
import { serializeMe } from "../lib/serializers.js";
import { parseOrThrow } from "../lib/validate.js";
import type { AuthVariables } from "../middleware/auth.js";
import { requireAuth } from "../middleware/auth.js";

const registerSchema = z.object({
  email: z.email(),
  password: z.string().min(8).max(128),
  displayName: z.string().min(1).max(100),
});

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

const logoutSchema = z.object({
  refreshToken: z.string().min(1),
});

const forgotPasswordSchema = z.object({
  email: z.email(),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8).max(128),
});

const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  bio: z.string().max(1000).nullable().optional(),
  avatarKey: z.string().min(1).nullable().optional(),
});

async function issueTokens(userId: string) {
  const refreshToken = createRefreshTokenValue();
  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: hashRefreshToken(refreshToken),
      expiresAt: refreshTokenExpiresAt(),
    },
  });
  return {
    accessToken: await signAccessToken(userId),
    refreshToken,
  };
}

function authPayload(
  user: Awaited<ReturnType<typeof prisma.user.findUniqueOrThrow>>,
  tokens: Awaited<ReturnType<typeof issueTokens>>,
) {
  return {
    user: serializeMe(user),
    ...tokens,
  };
}

export const authRoutes = new Hono<{ Variables: AuthVariables }>();

authRoutes.post("/register", async (c) => {
  const parsed = parseOrThrow(registerSchema, await c.req.json());

  const existing = await prisma.user.findUnique({ where: { email: parsed.email } });
  if (existing) throw conflict("Email already registered");

  const passwordHash = await hashPassword(parsed.password);
  const user = await prisma.user.create({
    data: {
      email: parsed.email,
      displayName: parsed.displayName,
      passwordHash,
    },
  });

  const tokens = await issueTokens(user.id);
  return c.json({ data: authPayload(user, tokens) }, 201);
});

authRoutes.post("/login", async (c) => {
  const parsed = parseOrThrow(loginSchema, await c.req.json());

  const user = await prisma.user.findUnique({ where: { email: parsed.email } });
  if (!user?.passwordHash) throw unauthorized("Invalid email or password");

  const valid = await verifyPassword(parsed.password, user.passwordHash);
  if (!valid) throw unauthorized("Invalid email or password");

  const tokens = await issueTokens(user.id);
  return c.json({ data: authPayload(user, tokens) });
});

authRoutes.post("/refresh", async (c) => {
  const parsed = parseOrThrow(refreshSchema, await c.req.json());

  const tokenHash = hashRefreshToken(parsed.refreshToken);
  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!stored || stored.expiresAt < new Date()) {
    if (stored) {
      await prisma.refreshToken.delete({ where: { id: stored.id } });
    }
    throw unauthorized("Invalid or expired refresh token");
  }

  await prisma.refreshToken.delete({ where: { id: stored.id } });
  const tokens = await issueTokens(stored.userId);
  return c.json({ data: authPayload(stored.user, tokens) });
});

authRoutes.post("/logout", async (c) => {
  const parsed = parseOrThrow(logoutSchema, await c.req.json());

  const tokenHash = hashRefreshToken(parsed.refreshToken);
  await prisma.refreshToken.deleteMany({ where: { tokenHash } });
  return c.json({ data: { ok: true } });
});

authRoutes.post("/forgot-password", async (c) => {
  const parsed = parseOrThrow(forgotPasswordSchema, await c.req.json());
  const user = await prisma.user.findUnique({ where: { email: parsed.email } });
  const response: {
    message: string;
    token?: string;
    resetLink?: string;
  } = {
    message: "If an account exists for that email, a password reset link has been created.",
  };

  if (user?.passwordHash) {
    const token = createPasswordResetToken();
    await prisma.$transaction([
      prisma.passwordResetToken.deleteMany({ where: { userId: user.id } }),
      prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: hashPasswordResetToken(token),
          expiresAt: passwordResetTokenExpiresAt(),
        },
      }),
    ]);

    if (env.NODE_ENV !== "production") {
      const resetUrl = new URL(env.PASSWORD_RESET_URL);
      resetUrl.searchParams.set("token", token);
      response.token = token;
      response.resetLink = resetUrl.toString();
    }
  }

  return c.json({ data: response });
});

authRoutes.post("/reset-password", async (c) => {
  const parsed = parseOrThrow(resetPasswordSchema, await c.req.json());
  const tokenHash = hashPasswordResetToken(parsed.token);
  const passwordHash = await hashPassword(parsed.password);

  await prisma.$transaction(async (tx) => {
    const stored = await tx.passwordResetToken.findUnique({ where: { tokenHash } });
    if (!stored) throw unauthorized("Invalid or expired password reset token");

    const consumed = await tx.passwordResetToken.deleteMany({
      where: {
        id: stored.id,
        expiresAt: { gt: new Date() },
      },
    });
    if (consumed.count !== 1) throw unauthorized("Invalid or expired password reset token");

    await tx.user.update({
      where: { id: stored.userId },
      data: { passwordHash },
    });
    await tx.refreshToken.deleteMany({ where: { userId: stored.userId } });
    await tx.passwordResetToken.deleteMany({ where: { userId: stored.userId } });
  });

  return c.json({ data: { ok: true } });
});

authRoutes.get("/me/stats", requireAuth, async (c) => {
  const userId = c.get("userId");

  const [postedCount, completedCount, user] = await Promise.all([
    prisma.serviceRequest.count({ where: { ownerId: userId } }),
    prisma.serviceRequest.count({
      where: {
        status: ServiceRequestStatus.COMPLETED,
        OR: [
          { ownerId: userId },
          { offers: { some: { offererId: userId, status: OfferStatus.ACCEPTED } } },
        ],
      },
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { reviewCount: true } }),
  ]);

  if (!user) throw notFound("User not found");

  return c.json({
    data: {
      postedCount,
      completedCount,
      reviewCount: user.reviewCount,
    },
  });
});

authRoutes.get("/me", requireAuth, async (c) => {
  const user = await prisma.user.findUnique({ where: { id: c.get("userId") } });
  if (!user) throw notFound("User not found");
  return c.json({ data: serializeMe(user) });
});

authRoutes.patch("/me", requireAuth, async (c) => {
  const parsed = parseOrThrow(updateProfileSchema, await c.req.json());

  if (Object.keys(parsed).length === 0) {
    throw badRequest("No fields to update");
  }

  if (parsed.avatarKey) {
    assertOwnedObjectKey(parsed.avatarKey, c.get("userId"), "avatars");
  }

  const user = await prisma.user.update({
    where: { id: c.get("userId") },
    data: parsed,
  });
  return c.json({ data: serializeMe(user) });
});
