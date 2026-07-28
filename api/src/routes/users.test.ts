import { describe, expect, it } from "vitest";
import { app } from "../app.js";

describe("user routes", () => {
  it("POST /users returns 404 (passwordless create removed)", async () => {
    const res = await app.request("/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "squatter@example.com",
        displayName: "Squatter",
      }),
    });

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({
      error: { message: "Not found", code: "NOT_FOUND" },
    });
  });
});
