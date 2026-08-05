"use client";

import * as React from "react";
import { format, formatDistanceToNow } from "date-fns";
import { AlertTriangle, Eye, ScrollText } from "lucide-react";
import type { AuditLogDto } from "@monorepo/shared";

import { DataPagination } from "@/components/data-pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TableSkeleton } from "@/components/ui/table-skeleton";
import { useListParams } from "@/hooks/use-list-params";
import { useAuditLogs } from "@/lib/api/audit-logs";
import { formatAuditAction, formatAuditTarget } from "@/lib/audit";

const RESOURCE_OPTIONS = [
  "user",
  "request",
  "offer",
  "review",
  "category",
  "conversation",
] as const;

export function AuditLogsPageClient() {
  const { search, filters, query, setSearch, setFilter, setPage, setLimit } =
    useListParams<{ resource?: string; action?: string }>({});
  const { data, isLoading, error } = useAuditLogs(query);
  const [selected, setSelected] = React.useState<AuditLogDto | null>(null);

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
          title="Could not load audit logs"
          description={error instanceof Error ? error.message : "Unknown error"}
        />
      </div>
    );
  }

  const items = data?.items ?? [];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Audit Logs"
        description="Administrative actions recorded for security and accountability"
      />

      <div className="flex flex-col gap-3 px-4 lg:px-6 sm:flex-row sm:items-center">
        <Input
          placeholder="Search action, resource, actor…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="max-w-sm"
        />
        <Select
          value={filters.resource ?? "all"}
          onValueChange={(value) =>
            setFilter("resource", value === "all" ? undefined : value)
          }
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Resource" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All resources</SelectItem>
            {RESOURCE_OPTIONS.map((resource) => (
              <SelectItem key={resource} value={resource}>
                {resource}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          placeholder="Exact action (e.g. USER_UPDATED)"
          value={filters.action ?? ""}
          onChange={(event) =>
            setFilter("action", event.target.value.trim() || undefined)
          }
          className="max-w-xs"
        />
      </div>

      {items.length === 0 ? (
        <div className="px-4 lg:px-6">
          <EmptyState
            icon={ScrollText}
            title="No audit logs yet"
            description="Admin changes to users, requests, offers, and reviews will appear here."
          />
        </div>
      ) : (
        <div className="px-4 lg:px-6">
          <div className="overflow-hidden rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Action</TableHead>
                  <TableHead>Resource</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>When</TableHead>
                  <TableHead className="w-12 text-right">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-[11px]">
                        {log.action}
                      </Badge>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatAuditAction(log.action)}
                      </p>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {formatAuditTarget(log.resource, log.resourceId)}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-medium">{log.actorName}</div>
                      {log.actorEmail ? (
                        <div className="text-xs text-muted-foreground">
                          {log.actorEmail}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(log.createdAt), {
                        addSuffix: true,
                      })}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setSelected(log)}
                        aria-label="View audit log details"
                      >
                        <Eye className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {data?.meta ? (
            <DataPagination
              pagination={data.meta}
              onPageChange={setPage}
              onLimitChange={setLimit}
            />
          ) : null}
        </div>
      )}

      <Sheet open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          {selected ? (
            <>
              <SheetHeader>
                <SheetTitle>{formatAuditAction(selected.action)}</SheetTitle>
                <SheetDescription>
                  {format(new Date(selected.createdAt), "PPP p")}
                </SheetDescription>
              </SheetHeader>
              <div className="mt-2 space-y-4 px-4 pb-4 text-sm">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Action</p>
                  <Badge variant="outline" className="mt-1 font-mono">
                    {selected.action}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Target</p>
                  <p className="mt-1 font-mono text-xs">
                    {formatAuditTarget(selected.resource, selected.resourceId)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Actor</p>
                  <p className="mt-1 font-medium">{selected.actorName}</p>
                  {selected.actorEmail ? (
                    <p className="text-muted-foreground">{selected.actorEmail}</p>
                  ) : null}
                  {selected.actorId ? (
                    <p className="font-mono text-[11px] text-muted-foreground">
                      {selected.actorId}
                    </p>
                  ) : null}
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Details</p>
                  {selected.details && Object.keys(selected.details).length > 0 ? (
                    <pre className="mt-1 overflow-x-auto rounded-md bg-muted p-3 font-mono text-[11px]">
                      {JSON.stringify(selected.details, null, 2)}
                    </pre>
                  ) : (
                    <p className="mt-1 text-muted-foreground italic">No extra details</p>
                  )}
                </div>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
