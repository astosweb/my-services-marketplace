import type { Metadata } from "next";
import { RolesPageClient } from "./roles-page-client";

export const metadata: Metadata = {
  title: "Roles & Permissions",
  description: "System roles returned by the API",
};

export default function RolesPage() {
  return (
    <>
      <div className="px-4 lg:px-6">
        <h1 className="text-2xl font-bold tracking-tight">Roles & Permissions</h1>
        <p className="text-muted-foreground">
          Read-only catalog from the API — custom roles are not supported yet
        </p>
      </div>
      <RolesPageClient />
    </>
  );
}
