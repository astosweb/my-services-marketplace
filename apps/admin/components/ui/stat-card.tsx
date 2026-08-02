import type { ComponentType } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type StatCardProps = {
  label: string;
  value: number | string;
  icon: ComponentType<{ className?: string }>;
  /** Share of a total, rendered as a signed percentage next to the value. */
  trendPercent?: number;
  trendTone?: "positive" | "warning";
};

export function StatCard({
  label,
  value,
  icon: Icon,
  trendPercent,
  trendTone = "positive",
}: StatCardProps) {
  const TrendIcon = trendTone === "positive" ? ArrowUp : ArrowDown;

  return (
    <Card>
      <CardContent>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-muted-foreground truncate text-sm font-medium">
              {label}
            </p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-bold">{value}</span>
              {trendPercent === undefined ? null : (
                <span
                  className={cn(
                    "flex items-center gap-0.5 text-sm",
                    trendTone === "positive"
                      ? "text-green-600 dark:text-green-500"
                      : "text-orange-600 dark:text-orange-500",
                  )}
                >
                  <TrendIcon className="size-3.5" />
                  {trendPercent}%
                </span>
              )}
            </div>
          </div>
          <div className="bg-secondary shrink-0 rounded-lg p-3">
            <Icon className="size-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
