import { createPermissionLayout } from "@/lib/auth/permission-layout";
import { PERMISSIONS } from "@/lib/auth/permissions";

export default createPermissionLayout(PERMISSIONS.DASHBOARD_READ);
