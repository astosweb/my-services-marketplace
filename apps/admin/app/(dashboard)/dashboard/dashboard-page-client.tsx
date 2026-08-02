"use client";

import { AlertTriangle } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/ui/table-skeleton";
import { useDashboardStats } from "@/lib/api/dashboard";
import { BreakdownCards } from "./components/breakdown-cards";
import { MetricCards } from "./components/metric-cards";
import { RecentActivityCard } from "./components/recent-activity-card";
import { TrendChart } from "./components/trend-chart";

export function DashboardPageClient() {
  const { data, isLoading, error } = useDashboardStats();

  if (isLoading) {
    return (
      <div className="px-4 lg:px-6">
        <TableSkeleton statCards={4} rows={6} />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="px-4 lg:px-6">
        <EmptyState
          icon={AlertTriangle}
          title="Dashboard data unavailable"
          description={
            error instanceof Error
              ? error.message
              : "The API did not return any metrics."
          }
        />
      </div>
    );
  }

  return (
    <div className="@container/main flex flex-col gap-6 px-4 lg:px-6">
      <MetricCards metrics={data.metrics} />
      <TrendChart trend={data.trend} />
      <BreakdownCards data={data} />
      <RecentActivityCard items={data.recentActivity} />
    </div>
  );
}
