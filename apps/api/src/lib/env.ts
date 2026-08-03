import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  DATABASE_URL: z.string().min(1),
  /** Set to "false" for managed Postgres (e.g. DigitalOcean) if SSL cert validation fails. */
  DATABASE_SSL_REJECT_UNAUTHORIZED: z.enum(["true", "false"]).optional(),
  SPACES_ENDPOINT: z.url().optional(),
  SPACES_REGION: z.string().optional(),
  SPACES_BUCKET: z.string().optional(),
  SPACES_ACCESS_KEY_ID: z.string().optional(),
  SPACES_SECRET_ACCESS_KEY: z.string().optional(),
  SPACES_CDN_URL: z.url().optional(),
  /**
   * When true, photo/avatar URLs use SPACES_CDN_URL directly.
   * Requires anonymous GetObject on the Space (bucket policy). Default false —
   * API proxies reads so ACL-disabled Spaces still work.
   */
  SPACES_CDN_PUBLIC: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
  /** `auto` uses local disk in development and Spaces in production when configured. */
  UPLOAD_STORAGE: z.enum(["local", "spaces", "auto"]).default("auto"),
  /** Public API base URL for upload links (defaults to http://127.0.0.1:PORT). */
  API_PUBLIC_URL: z.url().optional(),
  /** Explicitly expose Swagger in production. Disabled there by default. */
  ENABLE_SWAGGER: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
  /**
   * Comma-separated CORS origins, or `*` (default) for any origin.
   * Production deployments should set explicit origins.
   */
  CORS_ORIGIN: z.string().default("*"),
  JWT_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_DAYS: z.coerce.number().int().positive().default(30),
  PASSWORD_RESET_URL: z.url().default("http://localhost:3001/reset-password"),
  RESEND_API_KEY: z.string().min(1).optional(),
  /** Plain email or Resend display form: `Name <email@domain.com>`. */
  EMAIL_FROM: z
    .string()
    .refine((value) => {
      const angled = /^(.+)<([^>]+)>$/.exec(value.trim());
      const email = (angled?.[2] ?? value).trim();
      return z.string().email().safeParse(email).success;
    }, { message: 'Invalid EMAIL_FROM (use email or "Name <email>")' })
    .optional(),

  /** Redis for rate limiting. Required in production unless RATE_LIMIT_ALLOW_MEMORY=true. */
  REDIS_URL: z.string().optional(),
  /**
   * Allow in-memory rate limits in production (single-node only).
   * Prefer REDIS_URL so limits are shared across instances.
   */
  RATE_LIMIT_ALLOW_MEMORY: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
});

export type Environment = z.infer<typeof envSchema>;

export function validateEnvironment(config: Record<string, unknown>): Environment {
  return envSchema.parse(config);
}

export const env = validateEnvironment(process.env);

export function corsOrigins(): string | string[] {
  if (env.CORS_ORIGIN.trim() === "*") return "*";
  return env.CORS_ORIGIN.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

/** Production must not use CORS_ORIGIN=* (fail closed at boot). */
export function assertProductionCors() {
  if (env.NODE_ENV === "production" && env.CORS_ORIGIN.trim() === "*") {
    throw new Error(
      "CORS_ORIGIN=* is not allowed in production. Set an explicit comma-separated allowlist (or a single origin).",
    );
  }
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

/** Fail at boot rather than falling back to unsafe production defaults. */
export function assertProductionConfiguration() {
  if (env.NODE_ENV !== "production") return;

  if (env.JWT_SECRET.includes("change-me-to-a-long-random-secret")) {
    throw new Error("JWT_SECRET must not use the example value in production.");
  }
  if (!env.REDIS_URL && !env.RATE_LIMIT_ALLOW_MEMORY) {
    throw new Error(
      "REDIS_URL is required in production. Set RATE_LIMIT_ALLOW_MEMORY=true only for a single-node deployment.",
    );
  }
  if (!spacesCredentialsConfigured()) {
    throw new Error("Spaces credentials are required for uploads in production.");
  }
  if (env.UPLOAD_STORAGE === "local") {
    throw new Error("UPLOAD_STORAGE=local is not allowed in production.");
  }
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) {
    throw new Error("RESEND_API_KEY and EMAIL_FROM are required for password-reset emails.");
  }
}

/** Whether uploads are stored in DigitalOcean Spaces (vs local `.data/uploads`). */
export function uploadUsesSpaces() {
  if (env.UPLOAD_STORAGE === "local") return false;
  if (env.UPLOAD_STORAGE === "spaces") {
    if (!spacesCredentialsConfigured()) {
      throw new Error("UPLOAD_STORAGE=spaces requires complete Spaces credentials.");
    }
    return true;
  }
  // auto: local disk in development; Spaces in production when credentials exist
  if (env.NODE_ENV === "development") return false;
  return spacesCredentialsConfigured();
}

export function spacesPublicUrl(key: string): string | null {
  const encodedKey = key
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  if (uploadUsesSpaces() && env.SPACES_CDN_URL && env.SPACES_CDN_PUBLIC) {
    return `${env.SPACES_CDN_URL.replace(/\/$/, "")}/${encodedKey}`;
  }

  const base = env.API_PUBLIC_URL ?? `http://127.0.0.1:${env.PORT}`;
  return `${base.replace(/\/$/, "")}/uploads/${encodedKey}`;
}
