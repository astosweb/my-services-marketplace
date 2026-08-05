import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ConnectionOptions } from "node:tls";

type PgSslOption = boolean | ConnectionOptions;

/**
 * Build `pg` SSL options from env.
 * Prefer DATABASE_SSL_CA (DigitalOcean managed CA) over disabling verification.
 */
export function databaseSslOptions(
  connectionString = process.env.DATABASE_URL ?? "",
): { ssl: PgSslOption } | Record<string, never> {
  const caPath = process.env.DATABASE_SSL_CA?.trim();
  if (caPath) {
    return {
      ssl: {
        rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false",
        ca: readFileSync(resolve(caPath), "utf8"),
      },
    };
  }

  if (process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === "false") {
    return { ssl: { rejectUnauthorized: false } };
  }

  try {
    const host = new URL(connectionString).hostname;
    const usesLocalDatabase = ["localhost", "127.0.0.1", "::1", "postgres"].includes(host);
    if (process.env.NODE_ENV === "production" && !usesLocalDatabase) {
      return { ssl: { rejectUnauthorized: true } };
    }
  } catch {
    // Invalid URL — leave SSL to the connection string (sslmode=…).
  }

  return {};
}
