"use client";

import { use, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supportRoom, RealtimeServerEvent, type SupportTicketDetailDto } from "@monorepo/shared";
import { ErrorState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError } from "@/lib/api/client";
import { useRealtime } from "@/lib/realtime/provider";
import { formatRelativeTime } from "@/lib/utils";
import { toast } from "sonner";

export default function SupportTicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const queryClient = useQueryClient();
  const realtime = useRealtime();
  const [body, setBody] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [peerTyping, setPeerTyping] = useState(false);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const peerTypingClear = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    realtime.joinSupport(id);
    const unsubscribe = realtime.subscribe(
      RealtimeServerEvent.SUPPORT_TYPING,
      (envelope) => {
      const data = envelope.data as {
        ticketId?: string;
        userId?: string;
        isTyping?: boolean;
      };
      if (data.ticketId && data.ticketId !== id) return;
      if (peerTypingClear.current) clearTimeout(peerTypingClear.current);
      setPeerTyping(Boolean(data.isTyping));
      if (data.isTyping) {
        peerTypingClear.current = setTimeout(() => setPeerTyping(false), 8_000);
      }
    });
    return () => {
      realtime.setTyping(supportRoom(id), false);
      realtime.leaveSupport(id);
      unsubscribe();
    };
  }, [id, realtime]);

  const ticket = useQuery({
    queryKey: ["support", "tickets", id],
    queryFn: () => api.get<SupportTicketDetailDto>(`/support/tickets/${id}`),
    enabled: Boolean(id),
  });

  useEffect(() => {
    if (!ticket.data) return;
    void api.post(`/support/tickets/${id}/read`).catch(() => undefined);
  }, [id, ticket.data?.updatedAt]);

  const replyMutation = useMutation({
    mutationFn: async () => {
      let attachmentKeys: string[] | undefined;
      if (attachment) {
        const form = new FormData();
        form.append("files", attachment);
        const uploaded = await api.upload<{
          files: Array<{ key: string }>;
        }>("/uploads/support-attachments", form);
        attachmentKeys = uploaded.files.map((file) => file.key);
      }
      return api.post(`/support/tickets/${id}/messages`, {
        body: body.trim() || undefined,
        attachmentKeys,
      });
    },
    onSuccess: async () => {
      setBody("");
      setAttachment(null);
      realtime.setTyping(supportRoom(id), false);
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

  const reopenMutation = useMutation({
    mutationFn: () => api.post(`/support/tickets/${id}/reopen`),
    onSuccess: async () => {
      toast.success("Ticket reopened");
      await queryClient.invalidateQueries({
        queryKey: ["support", "tickets", id],
      });
    },
    onError: (error) =>
      toast.error(
        error instanceof ApiError ? error.message : "Could not reopen ticket",
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
  const canReply = data.status !== "CLOSED";
  const canReopen = data.status === "CLOSED";

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
            {message.body ? (
              <p className="mt-2 whitespace-pre-wrap text-sm">{message.body}</p>
            ) : null}
            {message.attachments?.length ? (
              <ul className="mt-3 space-y-1 text-sm">
                {message.attachments.map((file) => (
                  <li key={file.id}>
                    <a
                      href={file.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary underline-offset-2 hover:underline"
                    >
                      {file.fileName}
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ))}
      </div>

      {peerTyping ? (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          Support is typing…
        </p>
      ) : null}

      {canReopen ? (
        <Button
          variant="outline"
          disabled={reopenMutation.isPending}
          onClick={() => reopenMutation.mutate()}
        >
          {reopenMutation.isPending ? "Reopening…" : "Reopen ticket"}
        </Button>
      ) : null}

      {canReply ? (
        <form
          className="space-y-3 rounded-2xl border border-border bg-white p-5"
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            if (!body.trim() && !attachment) return;
            replyMutation.mutate();
          }}
        >
          <Textarea
            value={body}
            onChange={(event) => {
              const value = event.target.value;
              setBody(value);
              realtime.setTyping(supportRoom(id), true);
              if (typingTimer.current) clearTimeout(typingTimer.current);
              typingTimer.current = setTimeout(
                () => realtime.setTyping(supportRoom(id), false),
                1_500,
              );
            }}
            placeholder="Write a reply…"
          />
          <input
            type="file"
            onChange={(event) => setAttachment(event.target.files?.[0] ?? null)}
          />
          <Button
            type="submit"
            disabled={replyMutation.isPending || (!body.trim() && !attachment)}
          >
            {replyMutation.isPending ? "Sending…" : "Send reply"}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
