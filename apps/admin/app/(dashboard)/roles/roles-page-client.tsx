"use client";

import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { usePermissionsCatalog, useRoles } from "@/lib/api/marketplace";

export function RolesPageClient() {
  const roles = useRoles();
  const permissions = usePermissionsCatalog();

  if (roles.isLoading || permissions.isLoading) {
    return (
      <div className="grid gap-4 px-4 lg:px-6 lg:grid-cols-2">
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
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
    <div className="grid gap-4 px-4 lg:px-6 lg:grid-cols-2">
      {(roles.data ?? []).map((role) => (
        <Card key={role.name}>
          <CardHeader>
            <CardTitle>{role.name}</CardTitle>
            <CardDescription>
              System role — permissions are assigned by the API
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {role.permissions.length === 0 ? (
              <p className="text-muted-foreground text-sm">No admin permissions</p>
            ) : (
              role.permissions.map((permission) => (
                <Badge key={permission} variant="outline">
                  {permission}
                </Badge>
              ))
            )}
          </CardContent>
        </Card>
      ))}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Permission catalog</CardTitle>
          <CardDescription>All permissions the API can grant</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {(permissions.data ?? []).map((permission) => (
            <Badge key={permission.name} variant="secondary">
              {permission.name}
            </Badge>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
