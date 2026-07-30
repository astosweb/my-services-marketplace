"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { apiFetch, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { AdminUser } from "@/lib/types";
import { formatDate } from "@/lib/utils";

export default function UserDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user: me } = useAuth();
  const [user, setUser] = useState<AdminUser | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<"USER" | "ADMIN">("USER");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await apiFetch<{ data: AdminUser }>(`/admin/users/${params.id}`);
      setUser(response.data);
      setDisplayName(response.data.displayName);
      setRole(response.data.role);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load user");
    }
  }, [params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    if (!user) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await apiFetch<{ data: AdminUser }>(`/admin/users/${user.id}`, {
        method: "PATCH",
        body: JSON.stringify({ displayName, role }),
      });
      setUser(response.data);
      setMessage("User updated");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  async function toggleDisabled() {
    if (!user) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await apiFetch<{ data: AdminUser }>(`/admin/users/${user.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isDisabled: !user.isDisabled }),
      });
      setUser(response.data);
      setMessage(response.data.isDisabled ? "User disabled" : "User re-enabled");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  async function revokeSessions() {
    if (!user) return;
    setBusy(true);
    try {
      const response = await apiFetch<{ data: { revoked: number } }>(
        `/admin/users/${user.id}/revoke-sessions`,
        { method: "POST" },
      );
      setMessage(`Revoked ${response.data.revoked} session(s)`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Revoke failed");
    } finally {
      setBusy(false);
    }
  }

  async function removeUser() {
    if (!user) return;
    if (!window.confirm(`Permanently delete ${user.email}?`)) return;
    setBusy(true);
    try {
      await apiFetch(`/admin/users/${user.id}`, { method: "DELETE" });
      router.push("/users");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Delete failed");
      setBusy(false);
    }
  }

  if (error && !user) {
    return <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>;
  }

  if (!user) return <div className="text-sm text-zinc-500">Loading user…</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/users" className="text-sm text-zinc-500 hover:text-zinc-900">
            ← Users
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">{user.displayName}</h1>
          <p className="text-sm text-zinc-500">{user.email}</p>
        </div>
        <div className="flex gap-2">
          <Badge variant={user.role === "ADMIN" ? "default" : "secondary"}>{user.role}</Badge>
          <Badge variant={user.isDisabled ? "destructive" : "success"}>
            {user.isDisabled ? "Disabled" : "Active"}
          </Badge>
        </div>
      </div>

      {message ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>Update display name and role</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Display name</label>
              <Input value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Role</label>
              <Select
                value={role}
                onChange={(event) => setRole(event.target.value as "USER" | "ADMIN")}
                disabled={user.id === me?.id}
              >
                <option value="USER">USER</option>
                <option value="ADMIN">ADMIN</option>
              </Select>
            </div>
            <Button onClick={() => void save()} disabled={busy}>
              Save changes
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Stats</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-zinc-500">Requests</span>
              <span className="tabular-nums">{user.stats?.requestCount ?? 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Offers</span>
              <span className="tabular-nums">{user.stats?.offerCount ?? 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Reviews received</span>
              <span className="tabular-nums">{user.stats?.reviewCount ?? 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Joined</span>
              <span>{formatDate(user.memberSince)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Moderation</CardTitle>
          <CardDescription>Disable accounts, force logout, or delete</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="secondary" disabled={busy || user.id === me?.id} onClick={() => void toggleDisabled()}>
            {user.isDisabled ? "Re-enable account" : "Disable account"}
          </Button>
          <Button variant="outline" disabled={busy} onClick={() => void revokeSessions()}>
            Revoke sessions
          </Button>
          <Button
            variant="destructive"
            disabled={busy || user.id === me?.id}
            onClick={() => void removeUser()}
          >
            Delete user
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
