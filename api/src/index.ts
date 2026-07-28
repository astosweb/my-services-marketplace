import { serve } from "@hono/node-server";
import { app } from "./app.js";
import { env } from "./lib/env.js";
import { prisma } from "./lib/prisma.js";
import { getRateLimitStore, initRateLimitStore } from "./middleware/rate-limit.js";

await initRateLimitStore();

const server = serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.info(`hero-api listening on http://localhost:${info.port}`);
});

const SHUTDOWN_TIMEOUT_MS = 10_000;

async function shutdown(signal: string) {
  console.info(`Received ${signal}, shutting down…`);
  const force = setTimeout(() => {
    console.error("Shutdown timed out; exiting");
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  force.unref();

  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  }).catch((err) => {
    console.error("Error closing HTTP server:", err);
  });

  try {
    await getRateLimitStore().close?.();
  } catch (err) {
    console.error("Error closing rate-limit store:", err);
  }

  try {
    await prisma.$disconnect();
  } catch (err) {
    console.error("Error disconnecting Prisma:", err);
  }

  process.exit(0);
}

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});
process.on("SIGINT", () => {
  void shutdown("SIGINT");
});
