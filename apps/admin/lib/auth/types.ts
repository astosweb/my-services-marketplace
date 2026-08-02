import type { SessionUser, UserStatus } from "@monorepo/shared";

export type { SessionUser, UserStatus };

export type SessionUserWithPermissions = SessionUser & {
  permissions?: string[];
};

export function formatRole(role: string): string {
  return role
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

export function formatStatus(status: UserStatus): string {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

export function getInitials(
  name: string | null | undefined,
  email: string,
): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }
  return email.substring(0, 2).toUpperCase();
}
