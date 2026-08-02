"use client";

import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useSystemStatus } from "@/lib/api/marketplace";

export default function SystemSettingsPage() {
  const { data, isLoading, error } = useSystemStatus();

  if (isLoading) {
    return (
      <div className="grid gap-4 px-4 sm:grid-cols-2 lg:px-6">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="px-4 lg:px-6">
        <EmptyState
          icon={AlertTriangle}
          title="System status unavailable"
          description={
            error instanceof Error ? error.message : "Could not reach the API"
          }
        />
      </div>
    );
  }

  const rows = [
    { label: "API", ok: data.api },
    { label: "Database", ok: data.database },
  ];

  return (
    <div className="flex flex-col gap-4 px-4 lg:px-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">System status</h1>
        <p className="text-muted-foreground">
          Live health from GET /admin/system/status
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {rows.map((row) => (
          <Card key={row.label}>
            <CardHeader>
              <CardDescription>{row.label}</CardDescription>
              <CardTitle className="flex items-center gap-2 text-xl">
                {row.ok ? (
                  <>
                    <CheckCircle2 className="size-5 text-green-600" />
                    Healthy
                  </>
                ) : (
                  <>
                    <XCircle className="size-5 text-red-600" />
                    Unhealthy
                  </>
                )}
              </CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}
