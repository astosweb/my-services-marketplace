"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiFetch } from "@/lib/api";
import type { AdminRequest, ListMeta } from "@/lib/types";
import { formatDate } from "@/lib/utils";

function statusVariant(status: AdminRequest["status"]) {
  if (status === "OPEN") return "success" as const;
  if (status === "IN_PROGRESS") return "warning" as const;
  if (status === "COMPLETED") return "secondary" as const;
  return "destructive" as const;
}

export default function RequestsPage() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [isPremium, setIsPremium] = useState("");
  const [requests, setRequests] = useState<AdminRequest[]>([]);
  const [meta, setMeta] = useState<ListMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const limit = 25;

  const load = useCallback(async () => {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (q.trim()) params.set("q", q.trim());
    if (status) params.set("status", status);
    if (isPremium) params.set("isPremium", isPremium);
    try {
      const response = await apiFetch<{ data: AdminRequest[]; meta: ListMeta }>(
        `/admin/requests?${params.toString()}`,
      );
      setRequests(response.data);
      setMeta(response.meta);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load requests");
    }
  }, [q, status, isPremium, offset]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Requests</h1>
        <p className="text-sm text-zinc-500">Moderate service posts, premium flags, and status.</p>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 md:flex-row">
        <Input
          placeholder="Search title or location…"
          value={q}
          onChange={(event) => {
            setOffset(0);
            setQ(event.target.value);
          }}
        />
        <Select
          value={status}
          onChange={(event) => {
            setOffset(0);
            setStatus(event.target.value);
          }}
          className="md:w-44"
        >
          <option value="">All statuses</option>
          <option value="OPEN">Open</option>
          <option value="IN_PROGRESS">In progress</option>
          <option value="COMPLETED">Completed</option>
          <option value="CANCELLED">Cancelled</option>
        </Select>
        <Select
          value={isPremium}
          onChange={(event) => {
            setOffset(0);
            setIsPremium(event.target.value);
          }}
          className="md:w-40"
        >
          <option value="">Any boost</option>
          <option value="true">Premium</option>
          <option value="false">Standard</option>
        </Select>
      </div>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      ) : null}

      <div className="rounded-xl border border-zinc-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Request</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Offers</TableHead>
              <TableHead>Created</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests.map((request) => (
              <TableRow key={request.id}>
                <TableCell>
                  <div className="font-medium">{request.title}</div>
                  <div className="text-xs text-zinc-500">
                    {request.categoryName} · {request.city}
                    {request.isPremium ? " · Premium" : ""}
                  </div>
                </TableCell>
                <TableCell>{request.requester.profileName}</TableCell>
                <TableCell>
                  <Badge variant={statusVariant(request.status)}>{request.status}</Badge>
                </TableCell>
                <TableCell className="tabular-nums">{request.offerCount}</TableCell>
                <TableCell>{formatDate(request.createdAt)}</TableCell>
                <TableCell className="text-right">
                  <Link
                    href={`/requests/${request.id}`}
                    className="inline-flex h-8 items-center rounded-md border border-zinc-200 px-3 text-xs font-medium hover:bg-zinc-50"
                  >
                    Moderate
                  </Link>
                </TableCell>
              </TableRow>
            ))}
            {requests.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-zinc-500">
                  No requests found
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>

      {meta ? (
        <div className="flex items-center justify-between text-sm text-zinc-500">
          <span>
            Showing {requests.length} of {meta.total}
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
