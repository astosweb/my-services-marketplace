"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiFetch } from "@/lib/api";
import type { AdminUser, ListMeta } from "@/lib/types";
import { formatDate } from "@/lib/utils";

export default function UsersPage() {
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [isDisabled, setIsDisabled] = useState("");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [meta, setMeta] = useState<ListMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const limit = 25;

  const load = useCallback(async () => {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (q.trim()) params.set("q", q.trim());
    if (role) params.set("role", role);
    if (isDisabled) params.set("isDisabled", isDisabled);
    try {
      const response = await apiFetch<{ data: AdminUser[]; meta: ListMeta }>(
        `/admin/users?${params.toString()}`,
      );
      setUsers(response.data);
      setMeta(response.meta);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users");
    }
  }, [q, role, isDisabled, offset]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
        <p className="text-sm text-zinc-500">Search accounts, disable abusers, manage admin roles.</p>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 md:flex-row">
        <Input
          placeholder="Search email or name…"
          value={q}
          onChange={(event) => {
            setOffset(0);
            setQ(event.target.value);
          }}
        />
        <Select
          value={role}
          onChange={(event) => {
            setOffset(0);
            setRole(event.target.value);
          }}
          className="md:w-40"
        >
          <option value="">All roles</option>
          <option value="USER">User</option>
          <option value="ADMIN">Admin</option>
        </Select>
        <Select
          value={isDisabled}
          onChange={(event) => {
            setOffset(0);
            setIsDisabled(event.target.value);
          }}
          className="md:w-44"
        >
          <option value="">Any status</option>
          <option value="false">Active</option>
          <option value="true">Disabled</option>
        </Select>
      </div>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      ) : null}

      <div className="rounded-xl border border-zinc-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Rating</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell>
                  <div className="font-medium">{user.displayName}</div>
                  <div className="text-xs text-zinc-500">{user.email}</div>
                </TableCell>
                <TableCell>
                  <Badge variant={user.role === "ADMIN" ? "default" : "secondary"}>{user.role}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={user.isDisabled ? "destructive" : "success"}>
                    {user.isDisabled ? "Disabled" : "Active"}
                  </Badge>
                </TableCell>
                <TableCell className="tabular-nums">
                  {user.rating.toFixed(1)} ({user.reviewCount})
                </TableCell>
                <TableCell>{formatDate(user.memberSince)}</TableCell>
                <TableCell className="text-right">
                  <Link
                    href={`/users/${user.id}`}
                    className="inline-flex h-8 items-center rounded-md border border-zinc-200 px-3 text-xs font-medium hover:bg-zinc-50"
                  >
                    Manage
                  </Link>
                </TableCell>
              </TableRow>
            ))}
            {users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-zinc-500">
                  No users found
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>

      {meta ? (
        <div className="flex items-center justify-between text-sm text-zinc-500">
          <span>
            Showing {users.length} of {meta.total}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - limit))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={offset + limit >= meta.total}
              onClick={() => setOffset(offset + limit)}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
