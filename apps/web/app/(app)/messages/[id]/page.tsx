"use client";

import { use, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { sendMessageSchema } from "@/lib/validations";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useOptionalUser } from "@/hooks/use-session";
import { api, ApiError } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/keys";
import { useMessages } from "@/lib/api/hooks";
import { cn, formatRelativeTime } from "@/lib/utils";
import { toast } from "sonner";

export default function MessageThreadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { user } = useOptionalUser();
  const query = useMessages(id);
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [query.data]);

  const send = useMutation({
    mutationFn: async () => {
      const parsed = sendMessageSchema.safeParse({ body: body.trim() });
      if (!parsed.success || !parsed.data.body) {
        throw new Error("Message can’t be empty");
      }
      return api.post(`/conversations/${id}/messages`, {
        body: parsed.data.body,
      });
    },
    onSuccess: async () => {
      setBody("");
      await queryClient.invalidateQueries({ queryKey: queryKeys.messages(id) });
      await queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
    onError: (error) => {
      toast.error(
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Could not send",
      );
    },
  });

  return (
    <div className="mx-auto flex max-w-3xl flex-col px-4 py-10 sm:px-6">
      <div className="mb-6">
        <Link
          href="/messages"
          className="text-sm text-muted-foreground hover:text-primary"
        >
          ← Inbox
        </Link>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">
          Conversation
        </h1>
      </div>

      {query.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-16 rounded-2xl" />
          ))}
        </div>
      ) : query.isError ? (
        <ErrorState
          description="Messages failed to load."
          onRetry={() => void query.refetch()}
        />
      ) : !query.data?.length ? (
        <EmptyState
          title="No messages yet"
          description="Say hello to start the conversation."
        />
      ) : (
        <ul className="space-y-3">
          {query.data.map((message) => {
            const mine = message.sender.id === user?.id;
            return (
              <li
                key={message.id}
                className={cn("flex", mine ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-4 py-3 text-sm",
                    mine
                      ? "bg-primary text-primary-foreground"
                      : "border border-border bg-white",
                  )}
                >
                  {!mine ? (
                    <p className="mb-1 text-xs font-medium opacity-70">
                      {message.sender.profileName}
                    </p>
                  ) : null}
                  <p className="whitespace-pre-wrap">{message.body}</p>
                  {message.attachment ? (
                    <a
                      href={message.attachment.url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 block text-xs underline"
                    >
                      {message.attachment.name}
                    </a>
                  ) : null}
                  <p
                    className={cn(
                      "mt-1 text-[11px]",
                      mine ? "text-primary-foreground/70" : "text-muted-foreground",
                    )}
                  >
                    {formatRelativeTime(message.createdAt)}
                  </p>
                </div>
              </li>
            );
          })}
          <div ref={bottomRef} />
        </ul>
      )}

      <form
        className="sticky bottom-4 mt-6 flex gap-2 rounded-2xl border border-border bg-white p-2 shadow-sm"
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          send.mutate();
        }}
      >
        <Input
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Write a message…"
          className="border-0 shadow-none focus-visible:ring-0"
        />
        <Button type="submit" disabled={send.isPending || !body.trim()}>
          Send
        </Button>
      </form>
    </div>
  );
}
