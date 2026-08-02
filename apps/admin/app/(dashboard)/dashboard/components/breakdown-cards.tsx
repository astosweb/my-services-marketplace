"use client";

import type { DashboardResponse } from "@monorepo/shared";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

function toTitleCase(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

export function BreakdownCards({ data }: { data: DashboardResponse }) {
  const entries = Object.entries(data.breakdown?.requestsByStatus ?? {});
  const total = entries.reduce((sum, [, count]) => sum + count, 0);

  return (
    <div className="grid gap-4 lg:grid-cols-1">
      <Card>
        <CardHeader>
          <CardTitle>Requests by status</CardTitle>
          <CardDescription>Live marketplace pipeline</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {entries.length === 0 ? (
            <p className="text-muted-foreground text-sm">No data yet</p>
          ) : (
            entries.map(([key, count]) => (
              <div key={key} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span>{toTitleCase(key)}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {count}
                  </span>
                </div>
                <Progress
                  value={total > 0 ? (count / total) * 100 : 0}
                  aria-label={`${key}: ${count} of ${total}`}
                />
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
