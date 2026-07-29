import { badRequest } from "./errors.js";

/**
 * Ensure an object storage key was produced by this user's upload endpoints.
 * Keys are shaped as `{namespace}/{userId}/{uuid}.{ext}`.
 */
export function assertOwnedObjectKey(
  key: string,
  userId: string,
  namespace: "requests" | "messages" | "avatars",
) {
  const prefix = `${namespace}/${userId}/`;
  if (!key.startsWith(prefix) || key.includes("..") || key.includes("//")) {
    throw badRequest(`Invalid ${namespace} object key`);
  }
}

export function assertOwnedObjectKeys(
  keys: string[],
  userId: string,
  namespace: "requests" | "messages" | "avatars",
) {
  for (const key of keys) {
    assertOwnedObjectKey(key, userId, namespace);
  }
}
