import { describe, expect, it } from "vitest";
import { resolveMediaUrl } from "@/lib/media-url";

describe("resolveMediaUrl", () => {
  it("returns undefined for empty values", () => {
    expect(resolveMediaUrl(null)).toBeUndefined();
    expect(resolveMediaUrl(undefined)).toBeUndefined();
    expect(resolveMediaUrl("")).toBeUndefined();
  });

  it("rewrites absolute API upload URLs through the BFF", () => {
    expect(
      resolveMediaUrl(
        "http://127.0.0.1:3000/uploads/requests/user_1/photo.jpg",
      ),
    ).toBe("/api/uploads/requests/user_1/photo.jpg");
  });

  it("rewrites CDN object paths onto /api/uploads", () => {
    expect(
      resolveMediaUrl(
        "https://cdn.example.com/requests/user_1/photo.jpg",
      ),
    ).toBe("/api/uploads/requests/user_1/photo.jpg");
  });

  it("preserves signed query params for private uploads", () => {
    expect(
      resolveMediaUrl(
        "http://127.0.0.1:3000/uploads/support/user_1/file.pdf?exp=123&token=abc",
      ),
    ).toBe("/api/uploads/support/user_1/file.pdf?exp=123&token=abc");
  });

  it("leaves already-proxied and unrelated URLs alone", () => {
    expect(resolveMediaUrl("/api/uploads/avatars/x.jpg")).toBe(
      "/api/uploads/avatars/x.jpg",
    );
    expect(resolveMediaUrl("/uploads/avatars/x.jpg")).toBe(
      "/api/uploads/avatars/x.jpg",
    );
    expect(resolveMediaUrl("https://ui.shadcn.com/avatar.png")).toBe(
      "https://ui.shadcn.com/avatar.png",
    );
  });
});
