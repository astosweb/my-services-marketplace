"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import type { PaginationMeta } from "@monorepo/shared";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const PAGE_SIZES = [10, 20, 50, 100];

type DataPaginationProps = {
  pagination: PaginationMeta;
  onPageChange: (page: number) => void;
  onLimitChange?: (limit: number) => void;
};

export function DataPagination({
  pagination,
  onPageChange,
  onLimitChange,
}: DataPaginationProps) {
  const firstRow = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1;
  const lastRow = Math.min(pagination.page * pagination.limit, pagination.total);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-muted-foreground text-sm" aria-live="polite">
        {pagination.total === 0
          ? "No records"
          : `Showing ${firstRow}–${lastRow} of ${pagination.total}`}
      </p>
      <div className="flex items-center gap-4">
        {onLimitChange ? (
          <div className="flex items-center gap-2">
            <Label htmlFor="page-size" className="text-sm font-medium">
              Rows
            </Label>
            <Select
              value={String(pagination.limit)}
              onValueChange={(value) => onLimitChange(Number(value))}
            >
              <SelectTrigger className="w-20 cursor-pointer" id="page-size">
                <SelectValue />
              </SelectTrigger>
              <SelectContent side="top">
                {PAGE_SIZES.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="cursor-pointer"
            aria-label="Previous page"
            disabled={!pagination.hasPreviousPage}
            onClick={() => onPageChange(pagination.page - 1)}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="cursor-pointer"
            aria-label="Next page"
            disabled={!pagination.hasNextPage}
            onClick={() => onPageChange(pagination.page + 1)}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
