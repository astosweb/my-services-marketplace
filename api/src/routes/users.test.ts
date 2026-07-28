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
    const body = (await res.json()) as {
      error: { message: string; code: string; requestId?: string };
    };
    expect(body.error.message).toBe("Not found");
    expect(body.error.code).toBe("NOT_FOUND");
  });
});
