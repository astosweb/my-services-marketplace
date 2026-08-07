"use client";

import {
  use,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  conversationRoom,
  RealtimeServerEvent,
  type ConversationMessage,
  type InboxConversation,
} from "@monorepo/shared";
import { ImagePlus, Paperclip, SendHorizontal, X } from "lucide-react";
import { sendMessageSchema } from "@/lib/validations";
import { MessageStatusTicks } from "@/components/messages/message-status";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useOptionalUser } from "@/hooks/use-session";
import { api, ApiError } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/keys";
import { useConversations, useMessages } from "@/lib/api/hooks";
import { formatMessageTime } from "@/lib/format-time";
import { useRealtime } from "@/lib/realtime/provider";
import { cn, initials } from "@/lib/utils";
import { toast } from "sonner";

type UploadAttachmentResponse = {
  key: string;
  name: string;
  mimeType: string;
};

export default function MessageThreadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { user } = useOptionalUser();
  const query = useMessages(id);
  const inbox = useConversations(false);
  const archived = useConversations(true);
  const queryClient = useQueryClient();
  const realtime = useRealtime();
  const [body, setBody] = useState("");
  const [peerTyping, setPeerTyping] = useState(false);
  const [fullscreenUrl, setFullscreenUrl] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const peerTypingClear = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const deliveredRef = useRef(new Set<string>());

  const conversation: InboxConversation | undefined =
    inbox.data?.items.find((item) => item.id === id) ??
    archived.data?.items.find((item) => item.id === id);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [query.data, peerTyping]);

  useEffect(() => {
    realtime.joinConversation(id);
    // Prefer socket read receipt; HTTP mark-read is a fallback when offline.
    // GET /messages also marks read when unread exists (idempotent thereafter).
    if (realtime.connected) {
      realtime.markRead(id);
    } else {
      void api.post(`/conversations/${id}/read`).catch(() => undefined);
    }
    return () => {
      realtime.setTyping(conversationRoom(id), false);
      realtime.leaveConversation(id);
    };
  }, [id, realtime]);

  useEffect(() => {
    if (!realtime.connected) return;

    return realtime.subscribe(RealtimeServerEvent.TYPING_UPDATE, (envelope) => {
      const room = envelope.data.room;
      const typingUserId = envelope.data.userId;
      const isTyping = envelope.data.isTyping;
      if (room !== conversationRoom(id)) return;
      if (typeof typingUserId !== "string" || typingUserId === user?.id) return;
      if (peerTypingClear.current) clearTimeout(peerTypingClear.current);
      setPeerTyping(Boolean(isTyping));
      if (isTyping) {
        peerTypingClear.current = setTimeout(() => setPeerTyping(false), 8_000);
      }
    });
  }, [id, realtime, user?.id]);

  useEffect(() => {
    if (!query.data?.length || !user?.id) return;
    for (const message of query.data) {
      if (message.sender.id === user.id) continue;
      if (deliveredRef.current.has(message.id)) continue;
      deliveredRef.current.add(message.id);
      realtime.markDelivered(id, message.id);
    }
  }, [id, query.data, realtime, user?.id]);

  const notifyTyping = (isTyping: boolean) => {
    realtime.setTyping(conversationRoom(id), isTyping);
  };

  const send = useMutation({
    mutationFn: async (payload: {
      body?: string;
      attachmentKey?: string;
      attachmentName?: string;
      attachmentMimeType?: string;
    }) => {
      const parsed = sendMessageSchema.safeParse(payload);
      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message ?? "Invalid message");
      }
      if (!parsed.data.body && !parsed.data.attachmentKey) {
        throw new Error("Message can’t be empty");
      }
      return api.post<ConversationMessage>(`/conversations/${id}/messages`, parsed.data);
    },
    onSuccess: async () => {
      setBody("");
      notifyTyping(false);
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

  const uploadAndSend = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      const uploaded = await api.upload<UploadAttachmentResponse>(
        "/uploads/message-attachments",
        form,
      );
      const caption = body.trim();
      return api.post<ConversationMessage>(`/conversations/${id}/messages`, {
        body: caption || undefined,
        attachmentKey: uploaded.key,
        attachmentName: uploaded.name,
        attachmentMimeType: uploaded.mimeType,
      });
    },
    onSuccess: async () => {
      setBody("");
      notifyTyping(false);
      await queryClient.invalidateQueries({ queryKey: queryKeys.messages(id) });
      await queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
    onError: (error) => {
      toast.error(
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Could not send attachment",
      );
    },
  });

  const busy = send.isPending || uploadAndSend.isPending;
  const messages = query.data ?? [];

  return (
    <div className="mx-auto flex max-w-3xl flex-col px-4 py-6 sm:px-6 sm:py-10">
      <div className="mb-4">
        <Link
          href="/messages"
          className="text-sm text-muted-foreground hover:text-primary"
        >
          ← Inbox
        </Link>
      </div>

      {conversation ? (
        <div className="mb-4 flex items-center gap-3 rounded-2xl border border-border/70 bg-white/80 px-4 py-3">
          {conversation.participant.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={conversation.participant.avatarUrl}
              alt=""
              className="size-10 rounded-full object-cover"
            />
          ) : (
            <span className="flex size-10 items-center justify-center rounded-full bg-secondary font-display text-sm font-semibold text-primary">
              {initials(conversation.participant.profileName)}
            </span>
          )}
          <div className="min-w-0">
            <h1 className="truncate font-display text-lg font-bold tracking-tight">
              {conversation.participant.profileName}
            </h1>
            <Link
              href={`/requests/${conversation.requestId}`}
              className="truncate text-sm text-muted-foreground hover:text-primary"
            >
              {conversation.requestTitle}
            </Link>
          </div>
        </div>
      ) : (
        <h1 className="mb-4 font-display text-3xl font-bold tracking-tight">
          Conversation
        </h1>
      )}

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
      ) : !messages.length ? (
        <EmptyState
          title="No messages yet"
          description={
            conversation
              ? `Say hello to ${conversation.participant.profileName}.`
              : "Say hello to start the conversation."
          }
        />
      ) : (
        <ul className="space-y-1">
          {messages.map((message, index) => {
            const mine = message.sender.id === user?.id;
            const prev = messages[index - 1];
            const next = messages[index + 1];
            const showSenderName =
              !mine && (!prev || prev.sender.id !== message.sender.id);
            const groupedWithNext = Boolean(
              next && next.sender.id === message.sender.id,
            );
            return (
              <li
                key={message.id}
                className={cn(
                  "flex",
                  mine ? "justify-end" : "justify-start",
                  showSenderName && index > 0 ? "mt-3" : undefined,
                )}
              >
                <div
                  className={cn(
                    "flex max-w-[85%] items-end gap-2",
                    mine ? "flex-row-reverse" : "flex-row",
                  )}
                >
                  {!mine ? (
                    groupedWithNext ? (
                      <span className="size-7 shrink-0" aria-hidden />
                    ) : message.sender.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={message.sender.avatarUrl}
                        alt=""
                        className="size-7 shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-[10px] font-semibold text-primary">
                        {initials(message.sender.profileName)}
                      </span>
                    )
                  ) : null}
                  <div className={cn(mine ? "items-end" : "items-start", "flex flex-col")}>
                    {showSenderName ? (
                      <p className="mb-1 px-1 text-xs font-medium text-muted-foreground">
                        {message.sender.profileName}
                      </p>
                    ) : null}
                    <div
                      className={cn(
                        "px-3.5 py-2.5 text-sm",
                        mine
                          ? "rounded-2xl rounded-br-md bg-primary text-primary-foreground"
                          : "rounded-2xl rounded-bl-md border border-border bg-white",
                        groupedWithNext && mine && "rounded-br-2xl",
                        groupedWithNext && !mine && "rounded-bl-2xl",
                      )}
                    >
                      {message.attachment ? (
                        message.attachment.mimeType.startsWith("image/") ? (
                          <button
                            type="button"
                            className="mb-1 block overflow-hidden rounded-xl"
                            onClick={() =>
                              setFullscreenUrl(message.attachment!.url)
                            }
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={message.attachment.url}
                              alt={message.attachment.name}
                              className="max-h-60 max-w-full object-contain"
                            />
                          </button>
                        ) : (
                          <a
                            href={message.attachment.url}
                            target="_blank"
                            rel="noreferrer"
                            className="mb-1 inline-flex items-center gap-1.5 text-xs underline"
                          >
                            <Paperclip className="size-3.5" />
                            {message.attachment.name}
                          </a>
                        )
                      ) : null}
                      {message.body ? (
                        <p className="whitespace-pre-wrap">{message.body}</p>
                      ) : null}
                    </div>
                    <div
                      className={cn(
                        "mt-1 flex items-center gap-1 px-1 text-[11px] text-muted-foreground",
                        mine && "flex-row-reverse",
                      )}
                    >
                      <span>{formatMessageTime(message.createdAt)}</span>
                      {mine ? (
                        <MessageStatusTicks status={message.status} />
                      ) : null}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
          {peerTyping ? (
            <li className="mt-2 text-xs text-muted-foreground">
              {conversation?.participant.profileName ?? "Someone"} is typing…
            </li>
          ) : null}
          <div ref={bottomRef} />
        </ul>
      )}

      <form
        className="sticky bottom-4 mt-6 flex items-end gap-2 rounded-2xl border border-border bg-white p-2 shadow-sm"
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          const trimmed = body.trim();
          if (!trimmed || busy) return;
          send.mutate({ body: trimmed });
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf,.txt,.doc,.docx,.xls,.xlsx"
          className="hidden"
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file || busy) return;
            uploadAndSend.mutate(file);
          }}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="shrink-0"
          disabled={busy}
          aria-label="Attach file"
          onClick={() => fileInputRef.current?.click()}
        >
          <ImagePlus className="size-5" />
        </Button>
        <Input
          value={body}
          onChange={(event) => {
            const value = event.target.value;
            setBody(value);
            notifyTyping(true);
            if (typingTimer.current) clearTimeout(typingTimer.current);
            typingTimer.current = setTimeout(() => notifyTyping(false), 1_500);
          }}
          placeholder="Write a message…"
          className="border-0 shadow-none focus-visible:ring-0"
          disabled={busy}
        />
        <Button
          type="submit"
          size="icon"
          disabled={busy || !body.trim()}
          aria-label="Send message"
        >
          <SendHorizontal className="size-4" />
        </Button>
      </form>

      {fullscreenUrl ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Image preview"
          onClick={() => setFullscreenUrl(null)}
        >
          <button
            type="button"
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            aria-label="Close"
            onClick={() => setFullscreenUrl(null)}
          >
            <X className="size-5" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={fullscreenUrl}
            alt=""
            className="max-h-full max-w-full object-contain"
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      ) : null}
    </div>
  );
}
