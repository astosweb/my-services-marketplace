import { describe, expect, it } from "vitest";
import {
  isPrivateUploadKey,
  signedPrivateUploadUrl,
  verifyPrivateUploadToken,
} from "./upload-access.js";

describe("upload-access", () => {
  it("marks messages keys as private", () => {
    expect(isPrivateUploadKey("messages/user/a.pdf")).toBe(true);
    expect(isPrivateUploadKey("requests/user/a.jpg")).toBe(false);
    expect(isPrivateUploadKey("avatars/user/a.jpg")).toBe(false);
  });

  it("creates a verifiable signed URL", () => {
    const key = "messages/user_1/file.pdf";
    const url = new URL(signedPrivateUploadUrl(key));
    expect(url.pathname.endsWith("/uploads/messages/user_1/file.pdf")).toBe(true);
    expect(
      verifyPrivateUploadToken(
        key,
        url.searchParams.get("token") ?? undefined,
        url.searchParams.get("exp") ?? undefined,
      ),
    ).toBe(true);
    expect(
      verifyPrivateUploadToken(key, "deadbeef", url.searchParams.get("exp") ?? undefined),
    ).toBe(false);
  });
});
