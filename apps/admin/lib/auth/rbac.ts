import "server-only";

import { getDefaultPermissionsForRole } from "@monorepo/shared";

/** Permissions come from the API role catalog — no local Prisma RBAC. */
export async function getPermissionsForRoleId(
  _roleId: string,
): Promise<string[]> {
  return getDefaultPermissionsForRole("ADMIN");
}

export async function getPermissionsForRoleName(
  roleName: string,
): Promise<string[]> {
  return getDefaultPermissionsForRole(roleName);
}

export async function roleHasPermission(
  roleIdOrName: string,
  permission: string,
): Promise<boolean> {
  const permissions = await getPermissionsForRoleName(
    roleIdOrName === "USER" || roleIdOrName === "ADMIN"
      ? roleIdOrName
      : "ADMIN",
  );
  return permissions.includes(permission);
}

export async function getDefaultRoleId(): Promise<string> {
  return "USER";
}

export function invalidateRbacCache(): void {
  // no-op — permissions are derived from API role, not cached DB rows
}
