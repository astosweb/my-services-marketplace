import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DATABASE_URL: z.string().min(1),
  /** Set to "false" for managed Postgres (e.g. DigitalOcean) if SSL cert validation fails. */
  DATABASE_SSL_REJECT_UNAUTHORIZED: z.enum(["true", "false"]).optional(),
  SPACES_ENDPOINT: z.url().optional(),
  SPACES_REGION: z.string().optional(),
  SPACES_BUCKET: z.string().optional(),
  SPACES_ACCESS_KEY_ID: z.string().optional(),
  SPACES_SECRET_ACCESS_KEY: z.string().optional(),
  SPACES_CDN_URL: z.url().optional(),
  /** `auto` uses local disk in development and Spaces in production when configured. */
  UPLOAD_STORAGE: z.enum(["local", "spaces", "auto"]).default("auto"),
  /** Public API base URL for locally stored uploads (defaults to http://127.0.0.1:PORT). */
  API_PUBLIC_URL: z.url().optional(),
  /**
   * Comma-separated CORS origins, or `*` (default) for any origin.
   * Production deployments should set explicit origins.
   */
  CORS_ORIGIN: z.string().default("*"),
  JWT_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_DAYS: z.coerce.number().int().positive().default(30),
  PASSWORD_RESET_URL: z.url().default("http://localhost:3001/reset-password"),
});

export const env = envSchema.parse(process.env);

export function corsOrigins(): string | string[] {
  if (env.CORS_ORIGIN.trim() === "*") return "*";
  return env.CORS_ORIGIN.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function spacesCredentialsConfigured() {
  return Boolean(
    env.SPACES_ENDPOINT &&
    env.SPACES_REGION &&
    env.SPACES_BUCKET &&
    env.SPACES_ACCESS_KEY_ID &&
    env.SPACES_SECRET_ACCESS_KEY,
  );
}

/** Whether uploads are stored in DigitalOcean Spaces (vs local `.data/uploads`). */
export function uploadUsesSpaces() {
  if (env.UPLOAD_STORAGE === "local") return false;
  if (env.UPLOAD_STORAGE === "spaces") return spacesCredentialsConfigured();
  // auto: local disk in development; Spaces in production when credentials exist
  if (env.NODE_ENV === "development") return false;
  return spacesCredentialsConfigured();
}

export function spacesPublicUrl(key: string): string | null {
  if (uploadUsesSpaces() && env.SPACES_CDN_URL) {
    return `${env.SPACES_CDN_URL.replace(/\/$/, "")}/${key}`;
  }
  const base = env.API_PUBLIC_URL ?? `http://127.0.0.1:${env.PORT}`;
  return `${base.replace(/\/$/, "")}/uploads/${key}`;
}
