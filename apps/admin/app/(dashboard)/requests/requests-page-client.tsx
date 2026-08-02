"use client";

import * as React from "react";
import { formatDistanceToNow } from "date-fns";
import { AlertTriangle, ClipboardList, Edit2, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { ServiceRequestStatus } from "@monorepo/shared";

import { DataPagination } from "@/components/data-pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { Switch } from "@/components/ui/switch";
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
import {
  useDeleteRequest,
  useRequests,
  useUpdateRequest,
} from "@/lib/api/marketplace";

const STATUSES: ServiceRequestStatus[] = [
  "OPEN",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
];

const editRequestSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  status: z.enum(["OPEN", "IN_PROGRESS", "COMPLETED", "CANCELLED"]),
  isPremium: z.boolean(),
});

type EditRequestFormValues = z.infer<typeof editRequestSchema>;

export function RequestsPageClient() {
  const { search, filters, query, setSearch, setFilter, setPage, setLimit } =
    useListParams<{ status?: string }>({});
  const { data, isLoading, error } = useRequests(query);
  const updateRequest = useUpdateRequest();
  const deleteRequest = useDeleteRequest();

  const [deleteTarget, setDeleteTarget] = React.useState<{
    id: string;
    title: string;
  } | null>(null);

  const [editingRequest, setEditingRequest] = React.useState<{
    id: string;
    title: string;
    status: ServiceRequestStatus;
    isPremium: boolean;
  } | null>(null);

  const form = useForm<EditRequestFormValues>({
    resolver: zodResolver(editRequestSchema),
    defaultValues: {
      title: "",
      status: "OPEN",
      isPremium: false,
    },
  });

  React.useEffect(() => {
    if (editingRequest) {
      form.reset({
        title: editingRequest.title,
        status: editingRequest.status,
        isPremium: editingRequest.isPremium,
      });
    }
  }, [editingRequest, form]);

  const handleEditSubmit = async (values: EditRequestFormValues) => {
    if (!editingRequest) return;
    await updateRequest.mutateAsync({
      id: editingRequest.id,
      title: values.title,
      status: values.status as ServiceRequestStatus,
      isPremium: values.isPremium,
    });
    setEditingRequest(null);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    await deleteRequest.mutateAsync(deleteTarget.id);
    setDeleteTarget(null);
  };

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
          title="Could not load requests"
          description={error instanceof Error ? error.message : "Unknown error"}
        />
      </div>
    );
  }

  const items = data?.items ?? [];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Service Requests"
        description="Monitor, update, and manage all posted service requests across the platform."
      />

      <div className="flex flex-col gap-3 px-4 lg:px-6 sm:flex-row sm:items-center">
        <Input
          placeholder="Search title or description…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="max-w-sm"
        />
        <Select
          value={filters.status ?? "all"}
          onValueChange={(value) =>
            setFilter("status", value === "all" ? undefined : value)
          }
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {status}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {items.length === 0 ? (
        <div className="px-4 lg:px-6">
          <EmptyState
            icon={ClipboardList}
            title="No service requests"
            description="Nothing matches your current filter criteria."
          />
        </div>
      ) : (
        <div className="px-4 lg:px-6">
          <div className="overflow-hidden rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Offers</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-24 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell className="max-w-56 truncate font-medium">
                      {request.title}
                      {request.isPremium ? (
                        <Badge variant="secondary" className="ml-2">
                          Premium
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell>{request.categoryName}</TableCell>
                    <TableCell>{request.city}</TableCell>
                    <TableCell>
                      <StatusBadge status={request.status} />
                    </TableCell>
                    <TableCell>{request.requester.profileName}</TableCell>
                    <TableCell className="tabular-nums">
                      {request.offerCount}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDistanceToNow(new Date(request.createdAt), {
                        addSuffix: true,
                      })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Edit ${request.title}`}
                          onClick={() =>
                            setEditingRequest({
                              id: request.id,
                              title: request.title,
                              status: request.status,
                              isPremium: request.isPremium,
                            })
                          }
                        >
                          <Edit2 className="size-4 text-muted-foreground" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Delete ${request.title}`}
                          onClick={() =>
                            setDeleteTarget({
                              id: request.id,
                              title: request.title,
                            })
                          }
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
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

      {/* Single Delete Confirmation */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Service Request"
        description={`Are you sure you want to delete "${deleteTarget?.title}"? All associated offers will also be updated.`}
        confirmText="Delete Request"
        isLoading={deleteRequest.isPending}
        onConfirm={handleDeleteConfirm}
      />

      {/* Request Edit Modal */}
      <Dialog
        open={Boolean(editingRequest)}
        onOpenChange={(open) => !open && setEditingRequest(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Service Request</DialogTitle>
            <DialogDescription>
              Update request details, listing status, and premium status.
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleEditSubmit)}
              className="space-y-4 pt-2"
            >
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {STATUSES.map((status) => (
                          <SelectItem key={status} value={status}>
                            {status}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="isPremium"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>Premium Listing</FormLabel>
                      <p className="text-muted-foreground text-xs">
                        Promote this request to featured placement
                      </p>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <DialogFooter className="pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingRequest(null)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={updateRequest.isPending}>
                  Save Changes
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
