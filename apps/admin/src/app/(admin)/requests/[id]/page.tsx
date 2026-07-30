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
import type { AdminRequest } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

export default function RequestDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [request, setRequest] = useState<AdminRequest | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<AdminRequest["status"]>("OPEN");
  const [isPremium, setIsPremium] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await apiFetch<{ data: AdminRequest }>(`/admin/requests/${params.id}`);
      setRequest(response.data);
      setTitle(response.data.title);
      setDescription(response.data.description);
      setStatus(response.data.status);
      setIsPremium(response.data.isPremium);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load request");
    }
  }, [params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    if (!request) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await apiFetch<{ data: AdminRequest }>(`/admin/requests/${request.id}`, {
        method: "PATCH",
        body: JSON.stringify({ title, description, status, isPremium }),
      });
      setRequest(response.data);
      setMessage("Request updated");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!request) return;
    if (!window.confirm("Permanently delete this request?")) return;
    setBusy(true);
    try {
      await apiFetch(`/admin/requests/${request.id}`, { method: "DELETE" });
      router.push("/requests");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Delete failed");
      setBusy(false);
    }
  }

  if (error && !request) {
    return <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>;
  }
  if (!request) return <div className="text-sm text-zinc-500">Loading request…</div>;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/requests" className="text-sm text-zinc-500 hover:text-zinc-900">
          ← Requests
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{request.title}</h1>
        <p className="text-sm text-zinc-500">
          {request.categoryName} · {request.location} · created {formatDateTime(request.createdAt)}
        </p>
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
            <CardTitle>Moderate</CardTitle>
            <CardDescription>Edit content, status, and premium flag</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Title</label>
              <Input value={title} onChange={(event) => setTitle(event.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <textarea
                className="min-h-32 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Status</label>
                <Select
                  value={status}
                  onChange={(event) => setStatus(event.target.value as AdminRequest["status"])}
                >
                  <option value="OPEN">OPEN</option>
                  <option value="IN_PROGRESS">IN_PROGRESS</option>
                  <option value="COMPLETED">COMPLETED</option>
                  <option value="CANCELLED">CANCELLED</option>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Premium</label>
                <Select
                  value={isPremium ? "true" : "false"}
                  onChange={(event) => setIsPremium(event.target.value === "true")}
                >
                  <option value="false">Standard</option>
                  <option value="true">Premium</option>
                </Select>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void save()} disabled={busy}>
                Save changes
              </Button>
              <Button variant="destructive" onClick={() => void remove()} disabled={busy}>
                Delete request
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-zinc-500">Owner</span>
              <Link className="text-right font-medium hover:underline" href={`/users/${request.requester.id}`}>
                {request.requester.profileName}
              </Link>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Status</span>
              <Badge>{request.status}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Budget</span>
              <span>{request.budget ?? "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Offers</span>
              <span className="tabular-nums">{request.offerCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Views</span>
              <span className="tabular-nums">{request.viewCount}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
