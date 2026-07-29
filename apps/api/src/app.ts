import path from "node:path";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";
import { handle } from "hono/vercel";
import { corsOrigins, assertProductionCors } from "./lib/env.js";
import { forbidden, notFound, unauthorized } from "./lib/errors.js";
import { readUploadObject } from "./lib/storage.js";
import {
  isPrivateUploadKey,
  verifyPrivateUploadToken,
} from "./lib/upload-access.js";
import { verifyAccessToken } from "./lib/auth.js";
import { prisma } from "./lib/prisma.js";
import { onError } from "./middleware/on-error.js";
import { requestId } from "./middleware/request-id.js";
import { authRoutes } from "./routes/auth.js";
import { categoryRoutes } from "./routes/categories.js";
import { conversationRoutes } from "./routes/conversations.js";
import { deviceRoutes } from "./routes/devices.js";
import { healthRoutes } from "./routes/health.js";
import { notificationRoutes } from "./routes/notifications.js";
import { requestRoutes } from "./routes/requests.js";
import { uploadRoutes } from "./routes/uploads.js";
import { userRoutes } from "./routes/users.js";

assertProductionCors();

export const app = new Hono();

app.onError(onError);
app.use("*", requestId);
app.use("*", logger());
app.use("*", secureHeaders());
app.use(
  "*",
  bodyLimit({
    maxSize: 80 * 1024 * 1024,
    onError: (c) =>
      c.json({ error: { message: "Request body too large", code: "PAYLOAD_TOO_LARGE" } }, 413),
  }),
);
app.use(
  "*",
  cors({
    origin: corsOrigins(),
    allowMethods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  }),
);

app.route("/health", healthRoutes);
app.route("/auth", authRoutes);
app.route("/categories", categoryRoutes);
app.route("/requests", requestRoutes);
app.route("/conversations", conversationRoutes);
app.route("/notifications", notificationRoutes);
app.route("/uploads", uploadRoutes);
app.route("/users", userRoutes);
app.route("/devices", deviceRoutes);

async function assertCanReadPrivateUpload(key: string, authHeader: string | undefined) {
  if (!authHeader?.startsWith("Bearer ")) {
    throw unauthorized("Authentication required for private uploads");
  }
  const userId = await verifyAccessToken(authHeader.slice(7));
  if (!userId) throw unauthorized("Authentication required for private uploads");

  const ownerPrefix = `messages/${userId}/`;
  if (key.startsWith(ownerPrefix)) return;

  const message = await prisma.message.findFirst({
    where: { attachmentKey: key },
    select: {
      conversation: {
        select: { participants: { select: { userId: true } } },
      },
    },
  });
  const allowed = message?.conversation.participants.some((p) => p.userId === userId);
  if (!allowed) throw forbidden("You do not have access to this file");
}

app.get("/uploads/*", async (c) => {
  const key = decodeURIComponent(c.req.path.replace(/^\/uploads\//, ""));
  if (!key || key.includes("..") || path.isAbsolute(key)) throw notFound("File not found");

  if (isPrivateUploadKey(key)) {
    const tokenOk = verifyPrivateUploadToken(
      key,
      c.req.query("token"),
      c.req.query("exp"),
    );
    if (!tokenOk) {
      await assertCanReadPrivateUpload(key, c.req.header("Authorization"));
    }
  }

  const object = await readUploadObject(key);
  if (!object) throw notFound("File not found");

  return c.body(object.data, 200, {
    "Content-Type": object.contentType,
    "Cache-Control": isPrivateUploadKey(key)
      ? "private, max-age=60"
      : "public, max-age=86400",
  });
});

app.notFound((c) =>
  c.json(
    {
      error: {
        message: "Not found",
        code: "NOT_FOUND",
        requestId: c.res.headers.get("x-request-id") ?? c.req.header("x-request-id") ?? undefined,
      },
    },
    404,
  ),
);

export default handle(app);
