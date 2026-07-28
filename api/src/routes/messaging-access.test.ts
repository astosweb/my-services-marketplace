import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { signAccessToken } from "../lib/auth.js";
import { localUploadPath } from "../lib/storage.js";
import { onError } from "../middleware/on-error.js";

const mocks = vi.hoisted(() => ({
  serviceRequestFindUnique: vi.fn(),
  conversationFindFirst: vi.fn(),
  conversationCreate: vi.fn(),
  messageCreate: vi.fn(),
  conversationUpdate: vi.fn(),
  notificationCreate: vi.fn(),
  messageFindFirst: vi.fn(),
}));

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    serviceRequest: { findUnique: mocks.serviceRequestFindUnique },
    conversation: {
      findFirst: mocks.conversationFindFirst,
      create: mocks.conversationCreate,
      update: mocks.conversationUpdate,
    },
    message: {
      create: mocks.messageCreate,
      findFirst: mocks.messageFindFirst,
    },
    notification: { create: mocks.notificationCreate },
  },
}));

import { app } from "../app.js";
import { requestRoutes } from "./requests.js";

const messagingApp = new Hono();
messagingApp.onError(onError);
messagingApp.route("/requests", requestRoutes);

describe("messaging access policy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects unrelated users from opening a request conversation", async () => {
    mocks.serviceRequestFindUnique.mockResolvedValue({
      id: "req_1",
      title: "Fix sink",
      ownerId: "owner_1",
      offers: [],
    });

    const token = await signAccessToken("stranger_1");
    const res = await messagingApp.request("/requests/req_1/conversation", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toMatchObject({
      error: { code: "FORBIDDEN" },
    });
    expect(mocks.conversationCreate).not.toHaveBeenCalled();
  });

  it("allows a pending offerer to open a conversation", async () => {
    mocks.serviceRequestFindUnique.mockResolvedValue({
      id: "req_1",
      title: "Fix sink",
      ownerId: "owner_1",
      offers: [{ offererId: "provider_1", status: "PENDING" }],
    });
    mocks.conversationFindFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "conv_1",
        messages: [],
        participants: [
          { userId: "owner_1", lastReadAt: null },
          { userId: "provider_1", lastReadAt: null },
        ],
      });
    mocks.conversationCreate.mockResolvedValue({ id: "conv_1" });

    const token = await signAccessToken("provider_1");
    const res = await messagingApp.request("/requests/req_1/conversation", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(200);
    expect(mocks.conversationCreate).toHaveBeenCalled();
  });

  it("rejects messages from users without an offer", async () => {
    mocks.serviceRequestFindUnique.mockResolvedValue({
      id: "req_1",
      title: "Fix sink",
      ownerId: "owner_1",
      offers: [],
    });

    const token = await signAccessToken("stranger_1");
    const res = await messagingApp.request("/requests/req_1/messages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ body: "hi" }),
    });

    expect(res.status).toBe(403);
    expect(mocks.messageCreate).not.toHaveBeenCalled();
  });
});

describe("private upload access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.messageFindFirst.mockResolvedValue(null);
  });

  it("rejects anonymous access to message attachments", async () => {
    const key = "messages/user_1/secret.pdf";
    const filePath = localUploadPath(key);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, "secret-bytes");

    const res = await app.request(`/uploads/${key}`);
    expect(res.status).toBe(401);
  });

  it("serves private uploads with a valid signed token", async () => {
    const key = "messages/user_1/secret.pdf";
    const filePath = localUploadPath(key);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, "%PDF-private");

    const { signedPrivateUploadUrl } = await import("../lib/upload-access.js");
    const url = signedPrivateUploadUrl(key);
    const pathAndQuery = url.replace(/^https?:\/\/[^/]+/, "");

    const res = await app.request(pathAndQuery);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    await expect(res.text()).resolves.toBe("%PDF-private");
  });
});
