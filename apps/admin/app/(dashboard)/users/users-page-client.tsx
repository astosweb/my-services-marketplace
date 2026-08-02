"use client";

import * as React from "react";
import { formatDistanceToNow } from "date-fns";
import { AlertTriangle, Download, Edit2, Trash2, Users } from "lucide-react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { UserRole } from "@monorepo/shared";

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
import { PERMISSIONS } from "@/lib/auth/permissions";
import {
  exportUsers,
  useBulkUserAction,
  useDeleteUser,
  useUpdateUser,
  useUsers,
} from "@/lib/api/users";

const editUserSchema = z.object({
  profileName: z.string().min(2, "Name must be at least 2 characters"),
  role: z.enum(["USER", "ADMIN"]),
  status: z.enum(["ACTIVE", "SUSPENDED", "DELETED"]),
});

type EditUserFormValues = z.infer<typeof editUserSchema>;

export function UsersPageClient() {
  const { permissions } = useSession();
  const canWrite = permissions.includes(PERMISSIONS.USERS_WRITE);
  const canDelete = permissions.includes(PERMISSIONS.USERS_DELETE);

  const { search, filters, query, setSearch, setFilter, setPage, setLimit } =
    useListParams<{ role?: string; status?: string }>({});

  const { data, isLoading, error } = useUsers({
    ...query,
    role:
      filters.role === "USER" || filters.role === "ADMIN"
        ? filters.role
        : undefined,
  });

  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();
  const bulkAction = useBulkUserAction();

  // Selection & Modal States
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [deleteTarget, setDeleteTarget] = React.useState<{
    id: string;
    email: string;
  } | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = React.useState(false);
  const [editingUser, setEditingUser] = React.useState<{
    id: string;
    profileName: string;
    role: UserRole;
    status: "ACTIVE" | "SUSPENDED" | "DELETED";
  } | null>(null);

  const items = data?.items ?? [];

  const form = useForm<EditUserFormValues>({
    resolver: zodResolver(editUserSchema),
    defaultValues: {
      profileName: "",
      role: "USER",
      status: "ACTIVE",
    },
  });

  React.useEffect(() => {
    if (editingUser) {
      form.reset({
        profileName: editingUser.profileName,
        role: editingUser.role,
        status: editingUser.status,
      });
    }
  }, [editingUser, form]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(items.map((item) => item.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds((prev) => [...prev, id]);
    } else {
      setSelectedIds((prev) => prev.filter((item) => item !== id));
    }
  };

  const handleEditSubmit = async (values: EditUserFormValues) => {
    if (!editingUser) return;
    await updateUser.mutateAsync({
      id: editingUser.id,
      displayName: values.profileName,
      role: values.role as UserRole,
    });
    setEditingUser(null);
  };

  const handleSingleDelete = async () => {
    if (!deleteTarget) return;
    await deleteUser.mutateAsync(deleteTarget.id);
    setSelectedIds((prev) => prev.filter((id) => id !== deleteTarget.id));
    setDeleteTarget(null);
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    await bulkAction.mutateAsync({
      ids: selectedIds,
      action: "delete",
    });
    setSelectedIds([]);
    setBulkDeleteOpen(false);
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
          title="Could not load users"
          description={error instanceof Error ? error.message : "Unknown error"}
        />
      </div>
    );
  }

  const allSelected =
    items.length > 0 && items.every((item) => selectedIds.includes(item.id));

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Users"
        description="View and manage user accounts, permissions, and status"
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              void exportUsers({
                ...query,
                role:
                  filters.role === "USER" || filters.role === "ADMIN"
                    ? filters.role
                    : undefined,
              }).catch(() => null)
            }
          >
            <Download className="mr-2 size-4" />
            Export CSV
          </Button>
        }
      />

      <div className="flex flex-col gap-3 px-4 lg:px-6 sm:flex-row sm:items-center">
        <Input
          placeholder="Search email or name…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="max-w-sm"
        />
        <Select
          value={filters.role ?? "all"}
          onValueChange={(value) =>
            setFilter("role", value === "all" ? undefined : value)
          }
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            <SelectItem value="USER">USER</SelectItem>
            <SelectItem value="ADMIN">ADMIN</SelectItem>
          </SelectContent>
        </Select>

        {canDelete && selectedIds.length > 0 ? (
          <Button
            variant="destructive"
            size="sm"
            className="sm:ml-auto"
            onClick={() => setBulkDeleteOpen(true)}
          >
            <Trash2 className="mr-2 size-4" />
            Delete Selected ({selectedIds.length})
          </Button>
        ) : null}
      </div>

      {items.length === 0 ? (
        <div className="px-4 lg:px-6">
          <EmptyState
            icon={Users}
            title="No users found"
            description="Nothing matches your active filters."
          />
        </div>
      ) : (
        <div className="px-4 lg:px-6">
          <div className="overflow-hidden rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  {canDelete ? (
                    <TableHead className="w-12">
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={handleSelectAll}
                        aria-label="Select all users"
                      />
                    </TableHead>
                  ) : null}
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Rating</TableHead>
                  <TableHead>Requests</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="w-24 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((user) => {
                  const isSelected = selectedIds.includes(user.id);
                  return (
                    <TableRow key={user.id} data-state={isSelected ? "selected" : undefined}>
                      {canDelete ? (
                        <TableCell>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(checked) =>
                              handleSelectOne(user.id, Boolean(checked))
                            }
                            aria-label={`Select ${user.email}`}
                          />
                        </TableCell>
                      ) : null}
                      <TableCell className="font-medium">
                        <Link
                          href={`/users/${user.id}`}
                          className="hover:underline hover:text-primary transition-colors"
                        >
                          {user.profileName}
                        </Link>
                      </TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{user.role}</Badge>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={user.status} />
                      </TableCell>
                      <TableCell className="tabular-nums">
                        ⭐ {user.rating.toFixed(1)} ({user.reviewCount})
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {user.requestCount ?? 0}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDistanceToNow(new Date(user.createdAt), {
                          addSuffix: true,
                        })}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {canWrite ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Edit ${user.email}`}
                              onClick={() =>
                                setEditingUser({
                                  id: user.id,
                                  profileName: user.profileName,
                                  role: user.role,
                                  status: user.status as "ACTIVE" | "SUSPENDED" | "DELETED",
                                })
                              }
                            >
                              <Edit2 className="size-4 text-muted-foreground" />
                            </Button>
                          ) : null}
                          {canDelete ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Delete ${user.email}`}
                              onClick={() =>
                                setDeleteTarget({
                                  id: user.id,
                                  email: user.email,
                                })
                              }
                            >
                              <Trash2 className="size-4 text-destructive" />
                            </Button>
                          ) : null}
                        </div>
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

      {/* Single Delete Confirmation */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete User Account"
        description={`Are you sure you want to delete user "${deleteTarget?.email}"? This action will archive user data and cannot be undone.`}
        confirmText="Delete Account"
        isLoading={deleteUser.isPending}
        onConfirm={handleSingleDelete}
      />

      {/* Bulk Delete Confirmation */}
      <ConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        title="Delete Multiple Users"
        description={`Are you sure you want to delete ${selectedIds.length} selected users? This action cannot be undone.`}
        confirmText={`Delete ${selectedIds.length} Users`}
        isLoading={bulkAction.isPending}
        onConfirm={handleBulkDelete}
      />

      {/* User Edit Modal */}
      <Dialog
        open={Boolean(editingUser)}
        onOpenChange={(open) => !open && setEditingUser(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User Profile</DialogTitle>
            <DialogDescription>
              Update display name, assigned system role, and access status.
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleEditSubmit)}
              className="space-y-4 pt-2"
            >
              <FormField
                control={form.control}
                name="profileName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Display Name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="USER">USER</SelectItem>
                        <SelectItem value="ADMIN">ADMIN</SelectItem>
                      </SelectContent>
                    </Select>
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
                        <SelectItem value="ACTIVE">ACTIVE</SelectItem>
                        <SelectItem value="SUSPENDED">SUSPENDED</SelectItem>
                        <SelectItem value="DELETED">DELETED</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter className="pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingUser(null)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={updateUser.isPending}>
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
