import { describe, expect, it } from "vitest";
import {
  PERMISSIONS,
  getDefaultPermissionsForRole,
} from "@/lib/auth/permissions";

describe("permissions", () => {
  it("ADMIN receives the full catalog", () => {
    const permissions = getDefaultPermissionsForRole("ADMIN");
    expect(permissions).toContain(PERMISSIONS.DASHBOARD_READ);
    expect(permissions).toContain(PERMISSIONS.USERS_READ);
    expect(permissions).toContain(PERMISSIONS.ROLES_READ);
  });

  it("USER receives none", () => {
    expect(getDefaultPermissionsForRole("USER")).toEqual([]);
  });
});
