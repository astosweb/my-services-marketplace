import { createMiddleware } from "hono/factory";
import { verifyAccessToken } from "../lib/auth.js";
import { unauthorized } from "../lib/errors.js";

export type AuthVariables = {
  userId: string;
};

export const requireAuth = createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
  const header = c.req.header("Authorization");
  if (!header?.startsWith("Bearer ")) throw unauthorized();

  const userId = await verifyAccessToken(header.slice(7));
  if (!userId) throw unauthorized("Invalid or expired token");

  c.set("userId", userId);
  await next();
});
