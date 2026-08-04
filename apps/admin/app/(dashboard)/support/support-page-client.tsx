"use client";

import * as React from "react";
import { formatDistanceToNow } from "date-fns";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CheckCircle2,
  CircleDot,
  Clock3,
  Download,
  FileText,
  Inbox,
  LifeBuoy,
  ListChecks,
  MessagesSquare,
  RotateCcw,
  Search,
  ShieldAlert,
  UserCheck,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import type {
  SupportBulkActionInput,
  SupportTicketCategory,
  SupportTicketPriority,
  SupportTicketStatus,
} from "@monorepo/shared";

import { DataPagination } from "@/components/data-pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import {
  RowActionsItem,
  RowActionsMenu,
} from "@/components/ui/row-actions-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
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
import { useSession } from "@/hooks/use-session";
import {
  exportSupportTickets,
  useBulkSupportAction,
  useSupportStats,
  useSupportTickets,
} from "@/lib/api/support";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { cn } from "@/lib/utils";

import { SupportMacrosDialog } from "./support-macros-dialog";

const STATUSES: SupportTicketStatus[] = [
  "OPEN",
  "WAITING_FOR_USER",
  "IN_PROGRESS",
  "RESOLVED",
  "CLOSED",
];

const CATEGORIES: SupportTicketCategory[] = [
  "BUG",
  "FEATURE_REQUEST",
  "PAYMENT",
  "ACCOUNT",
  "VERIFICATION",
  "ABUSE",
  "OTHER",
];

const PRIORITIES: SupportTicketPriority[] = ["LOW", "NORMAL", "HIGH", "URGENT"];

type SupportFilters = {
  status?: string;
  category?: string;
  priority?: string;
  assignedAdminId?: string;
  from?: string;
  to?: string;
  unassigned?: string;
  slaBreached?: string;
  sortBy?: string;
  sortOrder?: string;
};

type SortField =
  | "caseNumber"
  | "priority"
  | "status"
  | "updatedAt"
  | "createdAt"
  | "lastMessageAt";

function label(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function includesValue<T extends string>(
  values: readonly T[],
  value: string | undefined,
): value is T {
  return value !== undefined && values.includes(value as T);
}

function SortableHeader({
  field,
  activeField,
  order,
  onSort,
  children,
}: {
  field: SortField;
  activeField: string;
  order: string;
  onSort: (field: SortField) => void;
  children: React.ReactNode;
}) {
  const active = activeField === field;
  const Icon = active ? (order === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;

  return (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-2 h-8 px-2"
      onClick={() => onSort(field)}
    >
      {children}
      <Icon className={cn("size-3.5", !active && "opacity-45")} />
    </Button>
  );
}

export function SupportPageClient() {
  const { permissions } = useSession();
  const canWrite = permissions.includes(PERMISSIONS.SUPPORT_WRITE);
  const canAssign = permissions.includes(PERMISSIONS.SUPPORT_ASSIGN);
  const canDelete = permissions.includes(PERMISSIONS.SUPPORT_DELETE);
  const canSelect = canWrite || canAssign;

  const { search, filters, query, setSearch, setFilter, setPage, setLimit } =
    useListParams<SupportFilters>({});

  const ticketQuery = {
    ...query,
    status: includesValue(STATUSES, filters.status)
      ? filters.status
      : undefined,
    category: includesValue(CATEGORIES, filters.category)
      ? filters.category
      : undefined,
    priority: includesValue(PRIORITIES, filters.priority)
      ? filters.priority
      : undefined,
    assignedAdminId: filters.assignedAdminId || undefined,
    from: filters.from || undefined,
    to: filters.to || undefined,
    unassigned:
      filters.unassigned === "true"
        ? true
        : filters.unassigned === "false"
          ? false
          : undefined,
    slaBreached:
      filters.slaBreached === "true"
        ? true
        : filters.slaBreached === "false"
          ? false
          : undefined,
    sortBy: filters.sortBy ?? "updatedAt",
    sortOrder: filters.sortOrder === "asc" ? "asc" : "desc",
  } as const;

  const { data, isLoading, error } = useSupportTickets(ticketQuery);
  const statsQuery = useSupportStats();
  const bulkAction = useBulkSupportAction();

  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [bulkDialog, setBulkDialog] = React.useState<
    "assign" | "status" | null
  >(null);
  const [confirmBulk, setConfirmBulk] = React.useState<
    "close" | "reopen" | null
  >(null);
  const [bulkAssigneeId, setBulkAssigneeId] = React.useState("");
  const [bulkStatus, setBulkStatus] =
    React.useState<SupportTicketStatus>("IN_PROGRESS");
  const [macrosOpen, setMacrosOpen] = React.useState(false);

  const items = data?.items ?? [];
  const visibleSelectedIds = selectedIds.filter((id) =>
    items.some((ticket) => ticket.id === id),
  );
  const allSelected =
    items.length > 0 &&
    items.every((ticket) => visibleSelectedIds.includes(ticket.id));

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds((previous) => [
        ...new Set([...previous, ...items.map((ticket) => ticket.id)]),
      ]);
    } else {
      const itemIds = new Set(items.map((ticket) => ticket.id));
      setSelectedIds((previous) => previous.filter((id) => !itemIds.has(id)));
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    setSelectedIds((previous) =>
      checked
        ? [...new Set([...previous, id])]
        : previous.filter((selectedId) => selectedId !== id),
    );
  };

  const handleSort = (field: SortField) => {
    const nextOrder =
      filters.sortBy === field && filters.sortOrder === "desc" ? "asc" : "desc";
    setFilter("sortBy", field);
    setFilter("sortOrder", nextOrder);
  };

  const runBulk = async (
    input: Omit<SupportBulkActionInput, "ids">,
    ids = visibleSelectedIds,
  ) => {
    if (ids.length === 0) return;
    await bulkAction.mutateAsync({ ids, ...input });
    setSelectedIds((previous) => previous.filter((id) => !ids.includes(id)));
  };

  const hasFilters = Boolean(
    search ||
    filters.status ||
    filters.category ||
    filters.priority ||
    filters.assignedAdminId ||
    filters.from ||
    filters.to ||
    filters.unassigned ||
    filters.slaBreached,
  );

  const stats = statsQuery.data;
  const statCards = [
    { label: "Open", value: stats?.open ?? "—", icon: Inbox },
    {
      label: "Waiting for User",
      value: stats?.waitingForUser ?? "—",
      icon: Clock3,
    },
    {
      label: "In Progress",
      value: stats?.inProgress ?? "—",
      icon: CircleDot,
    },
    {
      label: "Resolved",
      value: stats?.resolved ?? "—",
      icon: CheckCircle2,
    },
    {
      label: "Closed",
      value: stats?.closed ?? "—",
      icon: ListChecks,
    },
    {
      label: "Urgent",
      value: stats?.urgent ?? "—",
      icon: ShieldAlert,
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Support"
        description="Manage customer tickets, conversations, and service levels"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMacrosOpen(true)}
            >
              <FileText className="size-4" />
              Canned responses
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void exportSupportTickets(ticketQuery)
                  .then(() => toast.success("Support tickets exported"))
                  .catch((exportError: unknown) =>
                    toast.error(
                      exportError instanceof Error
                        ? exportError.message
                        : "Export failed",
                    ),
                  );
              }}
            >
              <Download className="size-4" />
              Export CSV
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 px-4 md:grid-cols-3 lg:px-6 xl:grid-cols-6">
        {statCards.map((card) => (
          <StatCard key={card.label} {...card} />
        ))}
      </div>

      <div className="flex flex-col gap-3 px-4 lg:px-6">
        <div className="flex flex-col gap-3 xl:flex-row xl:flex-wrap xl:items-center">
          <div className="relative min-w-64 flex-1">
            <Search className="text-muted-foreground absolute top-2.5 left-3 size-4" />
            <Input
              placeholder="Search subject, message, user, or case number…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="pl-9"
            />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <Select
              value={filters.status ?? "all"}
              onValueChange={(value) =>
                setFilter("status", value === "all" ? undefined : value)
              }
            >
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {label(status)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={filters.category ?? "all"}
              onValueChange={(value) =>
                setFilter("category", value === "all" ? undefined : value)
              }
            >
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {CATEGORIES.map((category) => (
                  <SelectItem key={category} value={category}>
                    {label(category)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={filters.priority ?? "all"}
              onValueChange={(value) =>
                setFilter("priority", value === "all" ? undefined : value)
              }
            >
              <SelectTrigger className="w-full sm:w-36">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All priorities</SelectItem>
                {PRIORITIES.map((priority) => (
                  <SelectItem key={priority} value={priority}>
                    {label(priority)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={
                filters.unassigned === "true"
                  ? "unassigned"
                  : filters.slaBreached === "true"
                    ? "breached"
                    : "all"
              }
              onValueChange={(value) => {
                setFilter(
                  "unassigned",
                  value === "unassigned" ? "true" : undefined,
                );
                setFilter(
                  "slaBreached",
                  value === "breached" ? "true" : undefined,
                );
              }}
            >
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Queue" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Entire queue</SelectItem>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                <SelectItem value="breached">SLA breached</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-3 lg:max-w-3xl">
          <Input
            aria-label="Assigned admin ID"
            placeholder="Assigned admin ID"
            value={filters.assignedAdminId ?? ""}
            onChange={(event) =>
              setFilter("assignedAdminId", event.target.value || undefined)
            }
          />
          <Input
            type="date"
            aria-label="Created from"
            value={filters.from ?? ""}
            onChange={(event) =>
              setFilter("from", event.target.value || undefined)
            }
          />
          <Input
            type="date"
            aria-label="Created to"
            value={filters.to ?? ""}
            onChange={(event) =>
              setFilter("to", event.target.value || undefined)
            }
          />
        </div>

        <div className="flex min-h-8 flex-wrap items-center gap-2">
          {hasFilters ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch("");
                setFilter("status", undefined);
                setFilter("category", undefined);
                setFilter("priority", undefined);
                setFilter("assignedAdminId", undefined);
                setFilter("from", undefined);
                setFilter("to", undefined);
                setFilter("unassigned", undefined);
                setFilter("slaBreached", undefined);
              }}
            >
              <RotateCcw className="size-3.5" />
              Reset filters
            </Button>
          ) : null}

          {visibleSelectedIds.length > 0 ? (
            <div className="bg-muted/40 ml-auto flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2">
              <span className="text-muted-foreground text-sm">
                {visibleSelectedIds.length} selected
              </span>
              {canAssign ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setBulkDialog("assign")}
                >
                  <UserCheck className="size-4" />
                  Assign
                </Button>
              ) : null}
              {canWrite ? (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setBulkDialog("status")}
                  >
                    Set status
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setConfirmBulk("reopen")}
                  >
                    Reopen
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => setConfirmBulk("close")}
                  >
                    Close
                  </Button>
                </>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {isLoading ? (
        <div className="px-4 lg:px-6">
          <TableSkeleton rows={8} />
        </div>
      ) : error ? (
        <div className="px-4 lg:px-6">
          <EmptyState
            icon={AlertTriangle}
            title="Could not load support tickets"
            description={
              error instanceof Error ? error.message : "Unknown error"
            }
          />
        </div>
      ) : items.length === 0 ? (
        <div className="px-4 lg:px-6">
          <EmptyState
            icon={LifeBuoy}
            title="No support tickets found"
            description="No tickets match the active search and filters."
          />
        </div>
      ) : (
        <div className="px-4 lg:px-6">
          <div className="overflow-x-auto rounded-lg border bg-card">
            <Table className="min-w-[1100px]">
              <TableHeader>
                <TableRow>
                  {canSelect ? (
                    <TableHead className="w-12">
                      <Checkbox
                        checked={
                          allSelected
                            ? true
                            : visibleSelectedIds.length > 0
                              ? "indeterminate"
                              : false
                        }
                        onCheckedChange={(checked) =>
                          handleSelectAll(Boolean(checked))
                        }
                        aria-label="Select all visible tickets"
                      />
                    </TableHead>
                  ) : null}
                  <TableHead>
                    <SortableHeader
                      field="caseNumber"
                      activeField={ticketQuery.sortBy}
                      order={ticketQuery.sortOrder}
                      onSort={handleSort}
                    >
                      Case
                    </SortableHeader>
                  </TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>
                    <SortableHeader
                      field="priority"
                      activeField={ticketQuery.sortBy}
                      order={ticketQuery.sortOrder}
                      onSort={handleSort}
                    >
                      Priority
                    </SortableHeader>
                  </TableHead>
                  <TableHead>
                    <SortableHeader
                      field="status"
                      activeField={ticketQuery.sortBy}
                      order={ticketQuery.sortOrder}
                      onSort={handleSort}
                    >
                      Status
                    </SortableHeader>
                  </TableHead>
                  <TableHead>Assignee</TableHead>
                  <TableHead>SLA</TableHead>
                  <TableHead>
                    <SortableHeader
                      field="updatedAt"
                      activeField={ticketQuery.sortBy}
                      order={ticketQuery.sortOrder}
                      onSort={handleSort}
                    >
                      Updated
                    </SortableHeader>
                  </TableHead>
                  <TableHead className="w-12 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((ticket) => {
                  const selected = visibleSelectedIds.includes(ticket.id);
                  return (
                    <TableRow
                      key={ticket.id}
                      data-state={selected ? "selected" : undefined}
                    >
                      {canSelect ? (
                        <TableCell>
                          <Checkbox
                            checked={selected}
                            onCheckedChange={(checked) =>
                              handleSelectOne(ticket.id, Boolean(checked))
                            }
                            aria-label={`Select ${ticket.caseNumber}`}
                          />
                        </TableCell>
                      ) : null}
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/support/${ticket.id}`}
                            className="font-mono text-sm font-semibold hover:underline"
                          >
                            {ticket.caseNumber}
                          </Link>
                          {ticket.unreadCount > 0 ? (
                            <Badge
                              variant="default"
                              className="size-5 rounded-full p-0 text-[10px]"
                            >
                              {ticket.unreadCount > 9
                                ? "9+"
                                : ticket.unreadCount}
                            </Badge>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-72">
                        <Link
                          href={`/support/${ticket.id}`}
                          className="block truncate font-medium hover:underline"
                        >
                          {ticket.subject}
                        </Link>
                        {ticket.tags.length > 0 ? (
                          <div className="mt-1 flex max-w-64 gap-1 overflow-hidden">
                            {ticket.tags.slice(0, 2).map((tag) => (
                              <Badge
                                key={tag}
                                variant="secondary"
                                className="text-[10px]"
                              >
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell className="max-w-52">
                        <p className="truncate text-sm font-medium">
                          {ticket.createdBy.profileName}
                        </p>
                        <p className="text-muted-foreground truncate text-xs">
                          {ticket.createdBy.email}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {label(ticket.category)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={ticket.priority} />
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={label(ticket.status)} />
                      </TableCell>
                      <TableCell className="max-w-44">
                        {ticket.assignedAdmin ? (
                          <div>
                            <p className="truncate text-sm font-medium">
                              {ticket.assignedAdmin.profileName}
                            </p>
                            <p className="text-muted-foreground truncate text-xs">
                              {ticket.assignedAdmin.email}
                            </p>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">
                            Unassigned
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {ticket.slaBreached ? (
                          <Badge variant="destructive">
                            <ShieldAlert />
                            Breached
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
                          >
                            On track
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground whitespace-nowrap text-sm">
                        {formatDistanceToNow(new Date(ticket.updatedAt), {
                          addSuffix: true,
                        })}
                      </TableCell>
                      <TableCell className="text-right">
                        <RowActionsMenu
                          label={`Actions for ${ticket.caseNumber}`}
                        >
                          <RowActionsItem asChild>
                            <Link href={`/support/${ticket.id}`}>
                              <MessagesSquare />
                              Open ticket
                            </Link>
                          </RowActionsItem>
                          {canWrite &&
                          (ticket.status === "CLOSED" ||
                            ticket.status === "RESOLVED") ? (
                            <RowActionsItem
                              onClick={() => {
                                void runBulk({ action: "reopen" }, [
                                  ticket.id,
                                ]).catch(() => undefined);
                              }}
                            >
                              Reopen ticket
                            </RowActionsItem>
                          ) : null}
                          {canWrite && ticket.status !== "CLOSED" ? (
                            <RowActionsItem
                              variant="destructive"
                              onClick={() => {
                                void runBulk({ action: "close" }, [
                                  ticket.id,
                                ]).catch(() => undefined);
                              }}
                            >
                              Close ticket
                            </RowActionsItem>
                          ) : null}
                        </RowActionsMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {data?.meta ? (
        <div className="px-4 lg:px-6">
          <DataPagination
            pagination={data.meta}
            onPageChange={setPage}
            onLimitChange={setLimit}
          />
        </div>
      ) : null}

      <Dialog
        open={Boolean(bulkDialog)}
        onOpenChange={(nextOpen) => !nextOpen && setBulkDialog(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {bulkDialog === "assign"
                ? "Assign selected tickets"
                : "Update selected tickets"}
            </DialogTitle>
            <DialogDescription>
              This action applies to {visibleSelectedIds.length} selected ticket
              {visibleSelectedIds.length === 1 ? "" : "s"}.
            </DialogDescription>
          </DialogHeader>
          {bulkDialog === "assign" ? (
            <div className="space-y-2">
              <label htmlFor="bulk-assignee" className="text-sm font-medium">
                Admin ID
              </label>
              <Input
                id="bulk-assignee"
                placeholder="Leave blank to unassign"
                value={bulkAssigneeId}
                onChange={(event) => setBulkAssigneeId(event.target.value)}
              />
            </div>
          ) : (
            <div className="space-y-2">
              <label htmlFor="bulk-status" className="text-sm font-medium">
                Status
              </label>
              <Select
                value={bulkStatus}
                onValueChange={(value) =>
                  setBulkStatus(value as SupportTicketStatus)
                }
              >
                <SelectTrigger id="bulk-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {label(status)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDialog(null)}>
              Cancel
            </Button>
            <Button
              disabled={bulkAction.isPending}
              onClick={() => {
                const input: Omit<SupportBulkActionInput, "ids"> =
                  bulkDialog === "assign"
                    ? {
                        action: "assign",
                        assignedAdminId: bulkAssigneeId.trim() || null,
                      }
                    : { action: "status", status: bulkStatus };
                void runBulk(input)
                  .then(() => setBulkDialog(null))
                  .catch(() => undefined);
              }}
            >
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(confirmBulk)}
        onOpenChange={(nextOpen) => !nextOpen && setConfirmBulk(null)}
        title={
          confirmBulk === "close"
            ? "Close selected tickets"
            : "Reopen selected tickets"
        }
        description={`${confirmBulk === "close" ? "Close" : "Reopen"} ${visibleSelectedIds.length} selected ticket${visibleSelectedIds.length === 1 ? "" : "s"}?`}
        confirmText={
          confirmBulk === "close" ? "Close tickets" : "Reopen tickets"
        }
        variant={confirmBulk === "close" ? "destructive" : "default"}
        isLoading={bulkAction.isPending}
        onConfirm={async () => {
          if (!confirmBulk) return;
          await runBulk({ action: confirmBulk });
          setConfirmBulk(null);
        }}
      />

      <SupportMacrosDialog
        open={macrosOpen}
        onOpenChange={setMacrosOpen}
        canWrite={canWrite}
        canDelete={canDelete}
      />
    </div>
  );
}
