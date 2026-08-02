"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import type { DashboardTrendPoint } from "@monorepo/shared";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

const chartConfig = {
  users: { label: "New users", color: "var(--chart-1)" },
  tasks: { label: "New tasks", color: "var(--chart-2)" },
} satisfies ChartConfig;

function formatDay(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function TrendChart({ trend }: { trend: DashboardTrendPoint[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Growth</CardTitle>
        <CardDescription>
          Users and tasks created over the last 30 days
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="aspect-auto h-64 w-full">
          <AreaChart data={trend}>
            <defs>
              <linearGradient id="fill-users" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-users)" stopOpacity={0.8} />
                <stop offset="95%" stopColor="var(--color-users)" stopOpacity={0.1} />
              </linearGradient>
              <linearGradient id="fill-tasks" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-tasks)" stopOpacity={0.8} />
                <stop offset="95%" stopColor="var(--color-tasks)" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={24}
              tickFormatter={formatDay}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={32}
              allowDecimals={false}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent labelFormatter={(value) => formatDay(String(value))} />
              }
            />
            <Area
              dataKey="users"
              type="monotone"
              stroke="var(--color-users)"
              fill="url(#fill-users)"
              stackId="a"
            />
            <Area
              dataKey="tasks"
              type="monotone"
              stroke="var(--color-tasks)"
              fill="url(#fill-tasks)"
              stackId="a"
            />
            <ChartLegend content={<ChartLegendContent />} />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
