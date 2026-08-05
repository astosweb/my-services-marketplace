import { UserRole } from "../generated/prisma/client.js";

/**
 * Permission catalog returned to admin clients for UI gating.
 * Server authorization remains binary ADMIN via AdminGuard until fine-grained
 * RBAC is implemented end-to-end. Do not treat these strings as enforced ACLs.
 */
export const ADMIN_PERMISSIONS = [
  "dashboard:read",
  "users:read",
  "users:write",
  "users:delete",
  "requests:read",
  "requests:write",
  "requests:delete",
  "offers:read",
  "offers:write",
  "offers:delete",
  "reviews:read",
  "reviews:delete",
  "categories:read",
  "categories:write",
  "conversations:read",
  "notifications:read",
  "settings:read",
  "settings:write",
  "health:read",
  "roles:read",
  "support:read",
  "support:write",
  "support:delete",
  "support:assign",
] as const;

export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number];

export function permissionsForRole(role: UserRole): string[] {
  return role === UserRole.ADMIN ? [...ADMIN_PERMISSIONS] : [];
}
