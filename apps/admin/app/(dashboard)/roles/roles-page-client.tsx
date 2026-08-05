"use client";

import * as React from "react";
import { AlertTriangle, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { usePermissionsCatalog, useRoles } from "@/lib/api/marketplace";

export function RolesPageClient() {
  const roles = useRoles();
  const permissions = usePermissionsCatalog();

  if (roles.isLoading || permissions.isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader
          title="Roles & Permissions"
          description="Binary roles from the API — ADMIN has full access; USER has none. Custom roles are not supported."
        />
        <div className="grid gap-4 px-4 lg:px-6 lg:grid-cols-2">
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
      </div>
    );
  }

  if (roles.error || permissions.error) {
    return (
      <div className="px-4 lg:px-6">
        <EmptyState
          icon={AlertTriangle}
          title="Could not load roles"
          description={
            roles.error instanceof Error
              ? roles.error.message
              : "Unknown error"
          }
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Roles & Permissions"
        description="Binary roles from the API — ADMIN has full access; USER has none. Custom roles are not supported."
      />

      <div className="grid gap-4 px-4 lg:px-6 lg:grid-cols-2">
        {(roles.data ?? []).map((role) => (
          <Card key={role.name} className="shadow-xs">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <ShieldCheck className="size-5 text-emerald-600 dark:text-emerald-400" />
                  Role: {role.name}
                </CardTitle>
                <CardDescription className="pt-1">
                  {role.name === "ADMIN"
                    ? "API AdminGuard requires this role for /admin routes. Permission strings gate the UI only."
                    : "Marketplace end-user — no admin API access."}
                </CardDescription>
              </div>
              <Badge variant="secondary" className="font-mono text-xs">
                {role.permissions.length} PERMISSIONS
              </Badge>
            </CardHeader>
            <CardContent className="pt-4 flex flex-wrap gap-1.5">
              {role.permissions.length === 0 ? (
                <p className="text-muted-foreground text-sm">No admin permissions granted</p>
              ) : (
                role.permissions.map((permission) => (
                  <Badge key={permission} variant="outline" className="font-mono text-xs">
                    {permission}
                  </Badge>
                ))
              )}
            </CardContent>
          </Card>
        ))}

        <Card className="lg:col-span-2 shadow-xs">
          <CardHeader>
            <CardTitle>Permission Catalog</CardTitle>
            <CardDescription>
              UI navigation labels returned by the API. Server authorization is role-based (ADMIN vs USER), not per-permission.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {(permissions.data ?? []).map((permission) => (
              <Badge key={permission.name} variant="secondary" className="font-mono text-xs py-1 px-2.5">
                {permission.name}
              </Badge>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
