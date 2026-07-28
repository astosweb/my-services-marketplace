import { readFile } from "node:fs/promises";
import path from "node:path";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";
import { handle } from "hono/vercel";
import { corsOrigins } from "./lib/env.js";
import { notFound } from "./lib/errors.js";
import { localUploadPath } from "./lib/storage.js";
import { onError } from "./middleware/on-error.js";
import { authRoutes } from "./routes/auth.js";
import { categoryRoutes } from "./routes/categories.js";
import { conversationRoutes } from "./routes/conversations.js";
import { deviceRoutes } from "./routes/devices.js";
import { healthRoutes } from "./routes/health.js";
import { notificationRoutes } from "./routes/notifications.js";
import { requestRoutes } from "./routes/requests.js";
import { uploadRoutes } from "./routes/uploads.js";
import { userRoutes } from "./routes/users.js";

export const app = new Hono();

app.onError(onError);
app.use("*", logger());
app.use("*", secureHeaders());
app.use(
  "*",
  bodyLimit({
    maxSize: 20 * 1024 * 1024,
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

app.get("/uploads/*", async (c) => {
  const key = c.req.path.replace(/^\/uploads\//, "");
  if (!key || key.includes("..") || path.isAbsolute(key)) throw notFound("File not found");

  const filePath = localUploadPath(key);
  const resolvedRoot = path.resolve(process.cwd(), ".data/uploads");
  if (!filePath.startsWith(resolvedRoot + path.sep) && filePath !== resolvedRoot) {
    throw notFound("File not found");
  }

  try {
    const data = await readFile(filePath);
    const ext = path.extname(key).toLowerCase();
    const type = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
    return c.body(data, 200, {
      "Content-Type": type,
      "Cache-Control": "public, max-age=86400",
    });
  } catch {
    throw notFound("File not found");
  }
});

app.notFound((c) => c.json({ error: { message: "Not found", code: "NOT_FOUND" } }, 404));

export default handle(app);
