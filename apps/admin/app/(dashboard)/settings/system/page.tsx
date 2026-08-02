"use client";

import * as React from "react";
import { AlertTriangle, CheckCircle2, Cpu, Database, RefreshCw, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { useSystemStatus } from "@/lib/api/marketplace";

export default function SystemSettingsPage() {
  const { data, isLoading, error, refetch, isRefetching } = useSystemStatus();

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title="System Status" description="Checking health endpoints…" />
        <div className="grid gap-4 px-4 sm:grid-cols-2 lg:px-6">
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
        </div>
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
            error instanceof Error ? error.message : "Could not reach the NestJS API server"
          }
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="System Status"
        description="Live operational telemetry and backend health"
        actions={
          <Button
            variant="outline"
            size="sm"
            disabled={isRefetching}
            onClick={() => void refetch()}
          >
            <RefreshCw className={`mr-2 size-4 ${isRefetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        }
      />

      <div className="grid gap-4 px-4 lg:px-6 sm:grid-cols-2">
        <Card className="shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardDescription className="font-medium text-xs uppercase tracking-wider">
              API Microservice
            </CardDescription>
            <Cpu className="size-5 text-muted-foreground" />
          </CardHeader>
          <CardContent className="pt-2">
            <div className="flex items-center gap-2">
              {data.api ? (
                <>
                  <CheckCircle2 className="size-6 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-xl font-bold text-foreground">Operational</span>
                </>
              ) : (
                <>
                  <XCircle className="size-6 text-rose-600 dark:text-rose-400" />
                  <span className="text-xl font-bold text-foreground">Degraded</span>
                </>
              )}
            </div>
            <p className="text-muted-foreground text-xs pt-2">
              HTTP Gateway endpoint reachable on port 3000
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardDescription className="font-medium text-xs uppercase tracking-wider">
              PostgreSQL Database
            </CardDescription>
            <Database className="size-5 text-muted-foreground" />
          </CardHeader>
          <CardContent className="pt-2">
            <div className="flex items-center gap-2">
              {data.database ? (
                <>
                  <CheckCircle2 className="size-6 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-xl font-bold text-foreground">Connected</span>
                </>
              ) : (
                <>
                  <XCircle className="size-6 text-rose-600 dark:text-rose-400" />
                  <span className="text-xl font-bold text-foreground">Disconnected</span>
                </>
              )}
            </div>
            <p className="text-muted-foreground text-xs pt-2">
              Prisma ORM connection pool active
            </p>
          </CardContent>
        </Card>

        <Card className="sm:col-span-2 shadow-xs">
          <CardHeader>
            <CardTitle className="text-base">Environment Telemetry</CardTitle>
            <CardDescription>
              Current deployment configuration and system info
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Framework:</span>
              <Badge variant="outline">Next.js 16 (App Router)</Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Backend API:</span>
              <Badge variant="outline">NestJS 11 + Prisma 7</Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Auto Health Poll:</span>
              <Badge variant="secondary">Every 30s</Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
