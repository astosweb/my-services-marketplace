import { describe, expect, it } from "vitest";
import {
  createPasswordResetToken,
  hashPasswordResetToken,
  hashPassword,
  passwordResetTokenExpiresAt,
  verifyPassword,
} from "./auth.js";

describe("password reset token helpers", () => {
  it("creates high-entropy URL-safe tokens", () => {
    const first = createPasswordResetToken();
    const second = createPasswordResetToken();

    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(second).not.toBe(first);
  });

  it("hashes tokens deterministically without retaining the raw value", () => {
    const token = createPasswordResetToken();
    const tokenHash = hashPasswordResetToken(token);

    expect(tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(tokenHash).toBe(hashPasswordResetToken(token));
    expect(tokenHash).not.toContain(token);
  });

  it("expires tokens one hour after creation", () => {
    const now = new Date("2026-07-28T12:00:00.000Z");
    expect(passwordResetTokenExpiresAt(now)).toEqual(new Date("2026-07-28T13:00:00.000Z"));
  });
});

describe("password hashing", () => {
  it("hashes and verifies a replacement password", async () => {
    const passwordHash = await hashPassword("new-password");

    await expect(verifyPassword("new-password", passwordHash)).resolves.toBe(true);
    await expect(verifyPassword("wrong-password", passwordHash)).resolves.toBe(false);
  });
});
