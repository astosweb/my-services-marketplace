export const PERMISSIONS = {
  DASHBOARD_READ: "dashboard:read",
  USERS_READ: "users:read",
  USERS_WRITE: "users:write",
  USERS_DELETE: "users:delete",
  REQUESTS_READ: "requests:read",
  REQUESTS_WRITE: "requests:write",
  REQUESTS_DELETE: "requests:delete",
  OFFERS_READ: "offers:read",
  OFFERS_WRITE: "offers:write",
  OFFERS_DELETE: "offers:delete",
  REVIEWS_READ: "reviews:read",
  REVIEWS_DELETE: "reviews:delete",
  CATEGORIES_READ: "categories:read",
  CATEGORIES_WRITE: "categories:write",
  CONVERSATIONS_READ: "conversations:read",
  NOTIFICATIONS_READ: "notifications:read",
  SETTINGS_READ: "settings:read",
  SETTINGS_WRITE: "settings:write",
  HEALTH_READ: "health:read",
  ROLES_READ: "roles:read",
} as const;

export type PermissionName = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export type PermissionDefinition = {
  name: PermissionName;
  label: string;
  description: string;
};

export const PERMISSION_DEFINITIONS: PermissionDefinition[] = Object.values(
  PERMISSIONS,
).map((name) => {
  const [resource, action] = name.split(":");
  return {
    name,
    label: `${resource} ${action}`,
    description: `Allows ${action} on ${resource}`,
  };
});

export const SUPER_ADMIN_ROLE_NAME = "ADMIN";
export const DEFAULT_ROLE_NAME = "USER";

export const DEFAULT_ROLE_DEFINITIONS = [
  {
    name: "ADMIN" as const,
    permissions: Object.values(PERMISSIONS) as PermissionName[],
  },
  {
    name: "USER" as const,
    permissions: [] as PermissionName[],
  },
];

export function getDefaultPermissionsForRole(
  roleName: string,
): PermissionName[] {
  if (roleName === "ADMIN") return Object.values(PERMISSIONS);
  return [];
}
