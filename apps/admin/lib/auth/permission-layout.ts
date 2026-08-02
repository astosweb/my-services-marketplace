import { requirePermission } from "@/lib/auth/guards";

export function createPermissionLayout(permission: string) {
  return async function PermissionLayout({
    children,
  }: {
    children: React.ReactNode;
  }) {
    await requirePermission(permission);
    return children;
  };
}
