import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { ErrorHandler } from "hono";
import { AppError } from "../lib/errors.js";

export const onError: ErrorHandler = (err, c) => {
  if (err instanceof AppError) {
    return c.json(
      { error: { message: err.message, code: err.code } },
      err.status as ContentfulStatusCode,
    );
  }

  console.error(err);
  return c.json({ error: { message: "Internal server error", code: "INTERNAL" } }, 500);
};
