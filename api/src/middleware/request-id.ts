import { randomUUID } from "node:crypto";
import { createMiddleware } from "hono/factory";

export const REQUEST_ID_HEADER = "x-request-id";

export const requestId = createMiddleware(async (c, next) => {
  const incoming = c.req.header(REQUEST_ID_HEADER)?.trim();
  const id = incoming && incoming.length > 0 ? incoming.slice(0, 128) : randomUUID();
  c.set("requestId" as never, id);
  c.header(REQUEST_ID_HEADER, id);
  await next();
});

export function getRequestId(c: { req: { header: (name: string) => string | undefined }; res: { headers: Headers } }) {
  return c.res.headers.get(REQUEST_ID_HEADER) ?? c.req.header(REQUEST_ID_HEADER) ?? undefined;
}
