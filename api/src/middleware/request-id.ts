import { randomUUID } from "node:crypto";
import { createMiddleware } from "hono/factory";

export const REQUEST_ID_HEADER = "x-request-id";

export const requestId = createMiddleware(async (c, next) => {
  const incoming = c.req.header(REQUEST_ID_HEADER)?.trim();
  const id = incoming && incoming.length > 0 ? incoming.slice(0, 128) : randomUUID();
  c.header(REQUEST_ID_HEADER, id);
  await next();
});
