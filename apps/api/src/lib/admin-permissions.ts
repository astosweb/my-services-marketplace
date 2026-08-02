import { UserRole } from "../generated/prisma/client.js";

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
] as const;

export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number];

export function permissionsForRole(role: UserRole): string[] {
  return role === UserRole.ADMIN ? [...ADMIN_PERMISSIONS] : [];
}
