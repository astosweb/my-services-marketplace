import { serve } from "@hono/node-server";
import { app } from "./app.js";
import { env } from "./lib/env.js";
import { initRateLimitStore } from "./middleware/rate-limit.js";

await initRateLimitStore();

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.info(`hero-api listening on http://localhost:${info.port}`);
});
