import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

describe("password hashing", () => {
  it("hashes and verifies passwords correctly", async () => {
    const password = "SecurePass123!";
    const hash = await hashPassword(password);
    expect(hash).not.toBe(password);
    expect(await verifyPassword(password, hash)).toBe(true);
    expect(await verifyPassword("wrong", hash)).toBe(false);
  });
});
