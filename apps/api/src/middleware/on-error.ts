import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { ErrorHandler } from "hono";
import { Prisma } from "../generated/prisma/client.js";
import { AppError } from "../lib/errors.js";
import { REQUEST_ID_HEADER } from "./request-id.js";

function requestIdFrom(c: Parameters<ErrorHandler>[1]) {
  return c.res.headers.get(REQUEST_ID_HEADER) ?? c.req.header(REQUEST_ID_HEADER) ?? undefined;
}

export const onError: ErrorHandler = (err, c) => {
  const requestId = requestIdFrom(c);

  if (err instanceof AppError) {
    return c.json(
      { error: { message: err.message, code: err.code, requestId } },
      err.status as ContentfulStatusCode,
    );
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      return c.json(
        { error: { message: "Resource already exists", code: "CONFLICT", requestId } },
        409,
      );
    }
    if (err.code === "P2025") {
      return c.json(
        { error: { message: "Resource not found", code: "NOT_FOUND", requestId } },
        404,
      );
    }
  }

  if (err instanceof SyntaxError && /JSON/i.test(err.message)) {
    return c.json(
      { error: { message: "Invalid JSON body", code: "BAD_REQUEST", requestId } },
      400,
    );
  }

  console.error(JSON.stringify({ err: String(err), stack: err instanceof Error ? err.stack : undefined, requestId }));
  return c.json({ error: { message: "Internal server error", code: "INTERNAL", requestId } }, 500);
};
