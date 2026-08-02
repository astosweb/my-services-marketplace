import { Skeleton } from "@/components/ui/skeleton";

type TableSkeletonProps = {
  rows?: number;
  /** Renders a row of stat cards above the table. */
  statCards?: number;
};

export function TableSkeleton({ rows = 8, statCards = 0 }: TableSkeletonProps) {
  return (
    <div className="flex flex-col gap-4">
      {statCards > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: statCards }).map((_, index) => (
            <Skeleton key={index} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : null}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="space-y-2 rounded-xl border p-4">
          {Array.from({ length: rows }).map((_, index) => (
            <Skeleton key={index} className="h-10 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
