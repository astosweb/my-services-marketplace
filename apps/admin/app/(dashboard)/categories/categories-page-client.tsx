"use client";

import { AlertTriangle } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TableSkeleton } from "@/components/ui/table-skeleton";
import { useCategories } from "@/lib/api/marketplace";

export function CategoriesPageClient() {
  const { data, isLoading, error } = useCategories();

  if (isLoading) {
    return (
      <div className="px-4 lg:px-6">
        <TableSkeleton rows={8} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 lg:px-6">
        <EmptyState
          icon={AlertTriangle}
          title="Could not load categories"
          description={error instanceof Error ? error.message : "Unknown error"}
        />
      </div>
    );
  }

  const items = data ?? [];

  return (
    <div className="px-4 lg:px-6">
      {items.length === 0 ? (
        <EmptyState title="No categories" description="Catalog is empty." />
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Symbol</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>ID</TableHead>
                <TableHead>Requests</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((category) => (
                <TableRow key={category.id}>
                  <TableCell className="text-lg">{category.symbol}</TableCell>
                  <TableCell className="font-medium">{category.name}</TableCell>
                  <TableCell className="text-muted-foreground font-mono text-sm">
                    {category.id}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {category.requestCount ?? 0}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
