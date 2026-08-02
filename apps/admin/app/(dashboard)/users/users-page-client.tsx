"use client";

import { formatDistanceToNow } from "date-fns";
import { AlertTriangle, Download, Trash2 } from "lucide-react";
import type { UserRole } from "@monorepo/shared";
import { DataPagination } from "@/components/data-pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  useDeleteUser,
  useUpdateUser,
  useUsers,
} from "@/lib/api/users";

export function UsersPageClient() {
  const { permissions } = useSession();
  const canWrite = permissions.includes(PERMISSIONS.USERS_WRITE);
  const canDelete = permissions.includes(PERMISSIONS.USERS_DELETE);

  const { search, filters, query, setSearch, setFilter, setPage, setLimit } =
    useListParams<{ role?: string }>({});
  const { data, isLoading, error } = useUsers({
    ...query,
    role:
      filters.role === "USER" || filters.role === "ADMIN"
        ? filters.role
        : undefined,
  });
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();

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

  const items = data?.items ?? [];

  return (
    <div className="flex flex-col gap-4 px-4 lg:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
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
        <Button
          variant="outline"
          className="sm:ml-auto"
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
      </div>

      {items.length === 0 ? (
        <EmptyState title="No users" description="Nothing matches these filters." />
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead>Requests</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="w-28" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">
                    {user.profileName}
                    <Badge variant="outline" className="ml-2">
                      {user.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    {canWrite ? (
                      <Select
                        value={user.role}
                        onValueChange={(role) =>
                          void updateUser.mutateAsync({
                            id: user.id,
                            role: role as UserRole,
                          })
                        }
                      >
                        <SelectTrigger className="h-8 w-28">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="USER">USER</SelectItem>
                          <SelectItem value="ADMIN">ADMIN</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      user.role
                    )}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {user.rating.toFixed(1)} ({user.reviewCount})
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {user.requestCount ?? 0}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatDistanceToNow(new Date(user.createdAt), {
                      addSuffix: true,
                    })}
                  </TableCell>
                  <TableCell>
                    {canDelete ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete ${user.email}`}
                        onClick={() => {
                          if (
                            window.confirm(
                              `Delete ${user.email}? This cannot be undone.`,
                            )
                          ) {
                            void deleteUser.mutateAsync(user.id);
                          }
                        }}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {data?.meta ? (
        <DataPagination
          pagination={data.meta}
          onPageChange={setPage}
          onLimitChange={setLimit}
        />
      ) : null}
    </div>
  );
}
