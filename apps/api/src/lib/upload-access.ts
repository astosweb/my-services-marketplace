import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "./env.js";

const PRIVATE_UPLOAD_TTL_SEC = 15 * 60;

export function isPrivateUploadKey(key: string) {
  return key.startsWith("messages/") || key.startsWith("support/");
}

function sign(key: string, exp: number) {
  const secret = env.UPLOAD_SIGNING_SECRET ?? env.JWT_SECRET;
  return createHmac("sha256", secret).update(`${key}:${exp}`).digest("hex");
}

/** Short-lived API URL for private uploads (works with clients that cannot send Bearer on media). */
export function signedPrivateUploadUrl(key: string) {
  const exp = Math.floor(Date.now() / 1000) + PRIVATE_UPLOAD_TTL_SEC;
  const token = sign(key, exp);
  const base = (env.API_PUBLIC_URL ?? `http://127.0.0.1:${env.PORT}`).replace(/\/$/, "");
  const encodedKey = key
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${base}/uploads/${encodedKey}?exp=${exp}&token=${token}`;
}

export function verifyPrivateUploadToken(
  key: string,
  token: string | undefined,
  expRaw: string | undefined,
) {
  if (!token || !expRaw) return false;
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return false;
  const expected = sign(key, exp);
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
