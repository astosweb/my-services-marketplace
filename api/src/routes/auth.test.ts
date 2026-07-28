import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { onError } from "../middleware/on-error.js";

type PasswordResetCreateArgs = {
  data: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  };
};

const mocks = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  userCreate: vi.fn(),
  userDelete: vi.fn(),
  passwordResetDeleteMany: vi.fn(),
  passwordResetCreate: vi.fn<(args: PasswordResetCreateArgs) => Promise<unknown>>(),
  refreshTokenCreate: vi.fn(),
  refreshTokenFindUnique: vi.fn(),
  refreshTokenDelete: vi.fn(),
  refreshTokenDeleteMany: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    user: {
      findUnique: mocks.userFindUnique,
      create: mocks.userCreate,
      delete: mocks.userDelete,
    },
    passwordResetToken: {
      deleteMany: mocks.passwordResetDeleteMany,
      create: mocks.passwordResetCreate,
    },
    refreshToken: {
      create: mocks.refreshTokenCreate,
      findUnique: mocks.refreshTokenFindUnique,
      delete: mocks.refreshTokenDelete,
      deleteMany: mocks.refreshTokenDeleteMany,
    },
    $transaction: mocks.transaction,
  },
}));

import { env } from "../lib/env.js";
import { hashPassword, signAccessToken, verifyPassword } from "../lib/auth.js";
import { MemoryRateLimitStore, setRateLimitStoreForTests } from "../middleware/rate-limit.js";
import { authRoutes } from "./auth.js";

const app = new Hono();
app.onError(onError);
app.route("/auth", authRoutes);

const rateLimitStore = new MemoryRateLimitStore();

describe.sequential("password reset routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rateLimitStore.clear();
    setRateLimitStoreForTests(rateLimitStore);
    env.NODE_ENV = "development";
    mocks.passwordResetDeleteMany.mockResolvedValue({ count: 0 });
    mocks.passwordResetCreate.mockResolvedValue({});
    mocks.transaction.mockImplementation(async (operationsOrCallback) => {
      if (Array.isArray(operationsOrCallback)) return Promise.all(operationsOrCallback);
      throw new Error("Transaction callback not configured");
    });
  });

  it("returns the same generic forgot-password response for an unknown email", async () => {
    mocks.userFindUnique.mockResolvedValue(null);

    const response = await app.request("/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "missing@example.com" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: {
        message: "If an account exists for that email, a password reset link has been created.",
      },
    });
    expect(mocks.passwordResetCreate).not.toHaveBeenCalled();
  });

  it("stores only a token hash and exposes the raw token in development", async () => {
    mocks.userFindUnique.mockResolvedValue({
      id: "user_1",
      passwordHash: "existing-hash",
    });

    const response = await app.request("/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "user@example.com" }),
    });
    const body = (await response.json()) as {
      data: { token: string; resetLink: string };
    };

    expect(response.status).toBe(200);
    expect(body.data.resetLink).toContain(encodeURIComponent(body.data.token));
    const createArgs = mocks.passwordResetCreate.mock.calls[0]?.[0];
    expect(createArgs?.data.userId).toBe("user_1");
    expect(createArgs?.data.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(createArgs?.data.expiresAt).toBeInstanceOf(Date);
    expect(createArgs?.data.tokenHash).not.toBe(body.data.token);
  });

  it("never exposes reset credentials in production", async () => {
    env.NODE_ENV = "production";
    mocks.userFindUnique.mockResolvedValue({
      id: "user_1",
      passwordHash: "existing-hash",
    });

    const response = await app.request("/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "user@example.com" }),
    });

    await expect(response.json()).resolves.toEqual({
      data: {
        message: "If an account exists for that email, a password reset link has been created.",
      },
    });
  });

  it("atomically replaces the password and revokes refresh tokens", async () => {
    const tx = {
      passwordResetToken: {
        findUnique: vi.fn().mockResolvedValue({
          id: "reset_1",
          userId: "user_1",
        }),
        deleteMany: vi
          .fn<
            (args: {
              where: { id?: string; userId?: string; expiresAt?: { gt: Date } };
            }) => Promise<{ count: number }>
          >()
          .mockResolvedValue({ count: 1 }),
      },
      user: {
        update: vi
          .fn<
            (args: { where: { id: string }; data: { passwordHash: string } }) => Promise<unknown>
          >()
          .mockResolvedValue({}),
      },
      refreshToken: {
        deleteMany: vi.fn().mockResolvedValue({ count: 2 }),
      },
    };
    mocks.transaction.mockImplementation(
      async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx),
    );

    const response = await app.request("/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: "valid-token", password: "replacement-password" }),
    });

    expect(response.status).toBe(200);
    const consumeArgs = tx.passwordResetToken.deleteMany.mock.calls[0]?.[0];
    expect(consumeArgs?.where.id).toBe("reset_1");
    expect(consumeArgs?.where.expiresAt?.gt).toBeInstanceOf(Date);
    expect(tx.refreshToken.deleteMany).toHaveBeenCalledWith({ where: { userId: "user_1" } });
    expect(tx.passwordResetToken.deleteMany).toHaveBeenNthCalledWith(2, {
      where: { userId: "user_1" },
    });
    const updatedPasswordHash = tx.user.update.mock.calls[0]?.[0].data.passwordHash;
    expect(updatedPasswordHash).toBeDefined();
    if (!updatedPasswordHash) throw new Error("Password hash was not updated");
    await expect(verifyPassword("replacement-password", updatedPasswordHash)).resolves.toBe(true);
  });

  it("rejects missing, expired, and already-consumed tokens without changing credentials", async () => {
    const tx = {
      passwordResetToken: {
        findUnique: vi.fn().mockResolvedValue({
          id: "reset_1",
          userId: "user_1",
        }),
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      user: {
        update: vi.fn(),
      },
      refreshToken: {
        deleteMany: vi.fn(),
      },
    };
    mocks.transaction.mockImplementation(
      async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx),
    );

    const response = await app.request("/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: "expired-token", password: "replacement-password" }),
    });

    expect(response.status).toBe(401);
    expect(tx.user.update).not.toHaveBeenCalled();
    expect(tx.refreshToken.deleteMany).not.toHaveBeenCalled();
  });

  it("enforces the reset password length", async () => {
    const response = await app.request("/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: "valid-token", password: "short" }),
    });

    expect(response.status).toBe(400);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});

describe.sequential("core auth routes", () => {
  const sampleUser = {
    id: "user_1",
    email: "user@example.com",
    passwordHash: "",
    displayName: "User",
    bio: null,
    avatarKey: null,
    rating: 0,
    reviewCount: 0,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    rateLimitStore.clear();
    setRateLimitStoreForTests(rateLimitStore);
    env.NODE_ENV = "development";
    sampleUser.passwordHash = await hashPassword("password123");
    mocks.refreshTokenCreate.mockResolvedValue({});
    mocks.transaction.mockImplementation(async (operationsOrCallback) => {
      if (Array.isArray(operationsOrCallback)) return Promise.all(operationsOrCallback);
      if (typeof operationsOrCallback === "function") {
        const tx = {
          refreshToken: {
            findUnique: mocks.refreshTokenFindUnique,
            deleteMany: mocks.refreshTokenDeleteMany,
            create: mocks.refreshTokenCreate,
          },
          user: {
            findUnique: mocks.userFindUnique,
            create: mocks.userCreate,
            delete: mocks.userDelete,
            update: vi.fn(),
          },
          passwordResetToken: {
            findUnique: vi.fn(),
            deleteMany: mocks.passwordResetDeleteMany,
          },
        };
        return (operationsOrCallback as (client: typeof tx) => Promise<unknown>)(tx);
      }
      throw new Error("Transaction callback not configured");
    });
  });

  it("registers a new account", async () => {
    mocks.userFindUnique.mockResolvedValue(null);
    mocks.userCreate.mockResolvedValue({ ...sampleUser, email: "new@example.com" });

    const response = await app.request("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "new@example.com",
        password: "password123",
        displayName: "New User",
      }),
    });
    const body = (await response.json()) as {
      data: { accessToken: string; refreshToken: string; user: { email: string } };
    };

    expect(response.status).toBe(201);
    expect(body.data.user.email).toBe("new@example.com");
    expect(body.data.accessToken).toBeTruthy();
    expect(body.data.refreshToken).toBeTruthy();
  });

  it("rejects duplicate registration", async () => {
    mocks.userFindUnique.mockResolvedValue(sampleUser);

    const response = await app.request("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "user@example.com",
        password: "password123",
        displayName: "User",
      }),
    });

    expect(response.status).toBe(409);
  });

  it("logs in with valid credentials", async () => {
    mocks.userFindUnique.mockResolvedValue(sampleUser);

    const response = await app.request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "user@example.com", password: "password123" }),
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as { data: { accessToken: string } };
    expect(body.data.accessToken).toBeTruthy();
  });

  it("rejects invalid login credentials", async () => {
    mocks.userFindUnique.mockResolvedValue(sampleUser);

    const response = await app.request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "user@example.com", password: "wrong-password" }),
    });

    expect(response.status).toBe(401);
  });

  it("rotates refresh tokens", async () => {
    mocks.refreshTokenFindUnique.mockResolvedValue({
      id: "refresh_1",
      userId: sampleUser.id,
      expiresAt: new Date(Date.now() + 60_000),
      user: sampleUser,
    });
    mocks.refreshTokenDeleteMany.mockResolvedValue({ count: 1 });

    const response = await app.request("/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: "old-refresh-token" }),
    });
    const body = (await response.json()) as {
      data: { refreshToken: string; accessToken: string };
    };

    expect(response.status).toBe(200);
    expect(mocks.refreshTokenDeleteMany).toHaveBeenCalledWith({ where: { id: "refresh_1" } });
    expect(body.data.refreshToken).toBeTruthy();
    expect(body.data.accessToken).toBeTruthy();
  });

  it("revokes all refresh tokens on reuse of a rotated token", async () => {
    mocks.refreshTokenFindUnique.mockResolvedValue({
      id: "refresh_1",
      userId: sampleUser.id,
      expiresAt: new Date(Date.now() + 60_000),
      user: sampleUser,
    });
    mocks.refreshTokenDeleteMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 2 });

    const response = await app.request("/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: "already-rotated-token" }),
    });

    expect(response.status).toBe(401);
    expect(mocks.refreshTokenDeleteMany).toHaveBeenCalledWith({
      where: { userId: sampleUser.id },
    });
  });

  it("normalizes email case on login", async () => {
    mocks.userFindUnique.mockResolvedValue(sampleUser);

    const response = await app.request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "User@Example.com", password: "password123" }),
    });

    expect(response.status).toBe(200);
    expect(mocks.userFindUnique).toHaveBeenCalledWith({
      where: { email: "user@example.com" },
    });
  });

  it("logs out by revoking the refresh token", async () => {
    mocks.refreshTokenDeleteMany.mockResolvedValue({ count: 1 });

    const response = await app.request("/auth/logout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: "active-refresh-token" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ data: { ok: true } });
    expect(mocks.refreshTokenDeleteMany).toHaveBeenCalled();
  });

  it("deletes the authenticated account after password confirmation", async () => {
    mocks.userFindUnique.mockResolvedValue(sampleUser);
    mocks.userDelete.mockResolvedValue(sampleUser);

    const token = await signAccessToken(sampleUser.id);
    const response = await app.request("/auth/me", {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ password: "password123" }),
    });

    expect(response.status).toBe(204);
    expect(mocks.userDelete).toHaveBeenCalledWith({ where: { id: sampleUser.id } });
  });

  it("rejects account deletion without auth", async () => {
    const response = await app.request("/auth/me", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "password123" }),
    });

    expect(response.status).toBe(401);
    expect(mocks.userDelete).not.toHaveBeenCalled();
  });

  it("rejects account deletion with wrong password", async () => {
    mocks.userFindUnique.mockResolvedValue(sampleUser);

    const token = await signAccessToken(sampleUser.id);
    const response = await app.request("/auth/me", {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ password: "wrong-password" }),
    });

    expect(response.status).toBe(401);
    expect(mocks.userDelete).not.toHaveBeenCalled();
  });
});
