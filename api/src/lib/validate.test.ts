import { describe, expect, it } from "vitest";
import { z } from "zod";
import { AppError } from "./errors.js";
import { assertOwnedObjectKey, assertOwnedObjectKeys } from "./owned-keys.js";
import { formatZodError, parseOrThrow } from "./validate.js";

describe("formatZodError", () => {
  it("includes field-level messages", () => {
    const schema = z.object({ email: z.email(), name: z.string().min(1) });
    const result = schema.safeParse({ email: "nope", name: "" });
    expect(result.success).toBe(false);
    if (result.success) return;
    const message = formatZodError(result.error);
    expect(message).toContain("email:");
    expect(message).toContain("name:");
  });
});

describe("parseOrThrow", () => {
  it("returns parsed data", () => {
    const schema = z.object({ n: z.number().int() });
    expect(parseOrThrow(schema, { n: 3 })).toEqual({ n: 3 });
  });

  it("throws AppError on invalid input", () => {
    const schema = z.object({ n: z.number() });
    expect(() => parseOrThrow(schema, { n: "x" })).toThrow(AppError);
  });
});

describe("assertOwnedObjectKey", () => {
  it("accepts keys under the user namespace", () => {
    expect(() =>
      assertOwnedObjectKey("requests/user_1/abc.jpg", "user_1", "requests"),
    ).not.toThrow();
  });

  it("rejects foreign or traversal keys", () => {
    expect(() => assertOwnedObjectKey("requests/other/abc.jpg", "user_1", "requests")).toThrow(
      AppError,
    );
    expect(() =>
      assertOwnedObjectKey("requests/user_1/../secret.jpg", "user_1", "requests"),
    ).toThrow(AppError);
  });

  it("validates arrays", () => {
    expect(() =>
      assertOwnedObjectKeys(
        ["messages/user_1/a.pdf", "messages/user_1/b.png"],
        "user_1",
        "messages",
      ),
    ).not.toThrow();
  });
});
