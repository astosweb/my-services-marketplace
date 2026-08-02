"use client";

import * as React from "react";
import { AlertTriangle, FolderTree } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
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
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Categories"
        description="Fixed marketplace category catalog"
      />

      {items.length === 0 ? (
        <div className="px-4 lg:px-6">
          <EmptyState
            icon={FolderTree}
            title="No categories"
            description="Catalog is currently empty."
          />
        </div>
      ) : (
        <div className="px-4 lg:px-6">
          <div className="overflow-hidden rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Symbol</TableHead>
                  <TableHead>Category Name</TableHead>
                  <TableHead>Category Identifier</TableHead>
                  <TableHead className="text-right">Total Requests</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((category) => (
                  <TableRow key={category.id}>
                    <TableCell className="text-xl">{category.symbol}</TableCell>
                    <TableCell className="font-semibold text-base">
                      {category.name}
                    </TableCell>
                    <TableCell className="text-muted-foreground font-mono text-xs">
                      {category.id}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <Badge variant="secondary" className="px-2.5 py-1">
                        {category.requestCount ?? 0} request{category.requestCount === 1 ? "" : "s"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
