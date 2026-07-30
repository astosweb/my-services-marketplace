"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiFetch, ApiError } from "@/lib/api";
import type { AdminReview, ListMeta } from "@/lib/types";
import { formatDate } from "@/lib/utils";

export default function ReviewsPage() {
  const [q, setQ] = useState("");
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [meta, setMeta] = useState<ListMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const limit = 25;

  const load = useCallback(async () => {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (q.trim()) params.set("q", q.trim());
    try {
      const response = await apiFetch<{ data: AdminReview[]; meta: ListMeta }>(
        `/admin/reviews?${params.toString()}`,
      );
      setReviews(response.data);
      setMeta(response.meta);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load reviews");
    }
  }, [q, offset]);

  useEffect(() => {
    void load();
  }, [load]);

  async function remove(id: string) {
    if (!window.confirm("Delete this review and recalc the subject rating?")) return;
    try {
      await apiFetch(`/admin/reviews/${id}`, { method: "DELETE" });
      setMessage("Review deleted");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Delete failed");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Reviews</h1>
        <p className="text-sm text-zinc-500">Remove abusive reviews; ratings recalculate automatically.</p>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <Input
          placeholder="Search review body or names…"
          value={q}
          onChange={(event) => {
            setOffset(0);
            setQ(event.target.value);
          }}
        />
      </div>

      {message ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      ) : null}

      <div className="rounded-xl border border-zinc-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Review</TableHead>
              <TableHead>Author → Subject</TableHead>
              <TableHead>Rating</TableHead>
              <TableHead>Created</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {reviews.map((review) => (
              <TableRow key={review.id}>
                <TableCell>
                  <div className="max-w-md">{review.body || "No written review"}</div>
                  {review.request ? (
                    <div className="text-xs text-zinc-500">{review.request.title}</div>
                  ) : null}
                </TableCell>
                <TableCell className="text-sm">
                  {review.author.profileName}
                  <span className="text-zinc-400"> → </span>
                  {review.subject.displayName}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{review.rating}/5</Badge>
                </TableCell>
                <TableCell>{formatDate(review.createdAt)}</TableCell>
                <TableCell className="text-right">
                  <Button variant="destructive" size="sm" onClick={() => void remove(review.id)}>
                    Delete
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {reviews.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-zinc-500">
                  No reviews found
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>

      {meta ? (
        <div className="flex items-center justify-between text-sm text-zinc-500">
          <span>
            Showing {reviews.length} of {meta.total}
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
