import { afterEach, describe, expect, it, vi } from "vitest";

import { uploadSupportAttachments } from "@/lib/api/support";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("uploadSupportAttachments", () => {
  it("posts FormData without overriding the multipart content type", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          data: {
            files: [
              {
                key: "support/admin/file.txt",
                name: "file.txt",
                mimeType: "text/plain",
                sizeBytes: 5,
              },
            ],
          },
        }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const file = new File(["hello"], "file.txt", { type: "text/plain" });
    await expect(uploadSupportAttachments([file])).resolves.toEqual([
      {
        key: "support/admin/file.txt",
        name: "file.txt",
        mimeType: "text/plain",
        sizeBytes: 5,
      },
    ]);

    const [path, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(path).toBe("/api/uploads/support-attachments");
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("same-origin");
    expect(init.headers).toBeUndefined();
    expect(init.body).toBeInstanceOf(FormData);
    expect((init.body as FormData).getAll("files")).toEqual([file]);
  });
});
