"use client";

import { use, useState, type FormEvent } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SupportTicketDetailDto } from "@monorepo/shared";
import { ErrorState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError } from "@/lib/api/client";
import { formatRelativeTime } from "@/lib/utils";
import { toast } from "sonner";

export default function SupportTicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");

  const ticket = useQuery({
    queryKey: ["support", "tickets", id],
    queryFn: () => api.get<SupportTicketDetailDto>(`/support/tickets/${id}`),
    enabled: Boolean(id),
  });

  const replyMutation = useMutation({
    mutationFn: () =>
      api.post(`/support/tickets/${id}/messages`, { body: body.trim() }),
    onSuccess: async () => {
      setBody("");
      toast.success("Reply sent");
      await queryClient.invalidateQueries({
        queryKey: ["support", "tickets", id],
      });
    },
    onError: (error) =>
      toast.error(
        error instanceof ApiError ? error.message : "Could not send reply",
      ),
  });

  if (ticket.isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-10 sm:px-6">
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (ticket.isError || !ticket.data) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <ErrorState
          description="Ticket could not be loaded."
          onRetry={() => void ticket.refetch()}
        />
        <Button asChild className="mt-4" variant="outline">
          <Link href="/support">Back</Link>
        </Button>
      </div>
    );
  }

  const data = ticket.data;

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-10 sm:px-6">
      <div>
        <Link
          href="/support"
          className="text-sm text-primary underline-offset-2 hover:underline"
        >
          ← All tickets
        </Link>
        <h1 className="mt-3 font-display text-3xl font-bold tracking-tight">
          {data.subject}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {data.caseNumber} · {data.status.replaceAll("_", " ")} ·{" "}
          {data.category.replaceAll("_", " ")}
        </p>
      </div>

      <div className="space-y-3">
        {(data.messages ?? []).map((message) => (
          <div
            key={message.id}
            className="rounded-2xl border border-border bg-white/80 p-4"
          >
            <div className="flex justify-between gap-2 text-xs text-muted-foreground">
              <span>
                {message.isStaff ? "Support" : message.sender.profileName}
              </span>
              <span>{formatRelativeTime(message.createdAt)}</span>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm">{message.body}</p>
          </div>
        ))}
      </div>

      {data.status !== "CLOSED" ? (
        <form
          className="space-y-3 rounded-2xl border border-border bg-white p-5"
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            if (!body.trim()) return;
            replyMutation.mutate();
          }}
        >
          <Textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Write a reply…"
            required
          />
          <Button type="submit" disabled={replyMutation.isPending}>
            {replyMutation.isPending ? "Sending…" : "Send reply"}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
