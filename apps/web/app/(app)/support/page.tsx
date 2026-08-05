"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CreateSupportTicketInput,
  Paginated,
  SupportTicketDto,
} from "@monorepo/shared";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError, apiQuery } from "@/lib/api/client";
import { formatRelativeTime } from "@/lib/utils";
import { toast } from "sonner";

const CATEGORIES = [
  "BUG",
  "FEATURE_REQUEST",
  "PAYMENT",
  "ACCOUNT",
  "VERIFICATION",
  "ABUSE",
  "OTHER",
] as const;

export default function SupportPage() {
  const queryClient = useQueryClient();
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] =
    useState<(typeof CATEGORIES)[number]>("OTHER");

  const tickets = useQuery({
    queryKey: ["support", "tickets"],
    queryFn: () =>
      api.get<Paginated<SupportTicketDto>>(
        `/support/tickets${apiQuery({ limit: 50 })}`,
      ),
  });

  const createMutation = useMutation({
    mutationFn: (input: CreateSupportTicketInput) =>
      api.post<SupportTicketDto>("/support/tickets", input),
    onSuccess: async () => {
      toast.success("Ticket created");
      setSubject("");
      setDescription("");
      await queryClient.invalidateQueries({ queryKey: ["support", "tickets"] });
    },
    onError: (error) => {
      toast.error(
        error instanceof ApiError ? error.message : "Could not create ticket",
      );
    },
  });

  const list = tickets.data?.items ?? [];

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-10 sm:px-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">
          Help & support
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Open a ticket and our team will follow up in the admin help desk.
        </p>
      </div>

      <form
        className="space-y-4 rounded-2xl border border-border bg-white p-5"
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          createMutation.mutate({ subject, description, category });
        }}
      >
        <h2 className="font-display text-lg font-semibold">New ticket</h2>
        <div className="space-y-2">
          <Label htmlFor="subject">Subject</Label>
          <Input
            id="subject"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            required
            minLength={3}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="category">Category</Label>
          <select
            id="category"
            className="flex h-10 w-full rounded-lg border border-input bg-white px-3 text-sm"
            value={category}
            onChange={(event) =>
              setCategory(event.target.value as (typeof CATEGORIES)[number])
            }
          >
            {CATEGORIES.map((value) => (
              <option key={value} value={value}>
                {value.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            required
            minLength={10}
          />
        </div>
        <Button type="submit" disabled={createMutation.isPending}>
          {createMutation.isPending ? "Submitting…" : "Submit ticket"}
        </Button>
      </form>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Your tickets</h2>
        {tickets.isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : tickets.isError ? (
          <ErrorState
            description="Could not load tickets."
            onRetry={() => void tickets.refetch()}
          />
        ) : list.length === 0 ? (
          <EmptyState title="No tickets yet" description="Submit one above if you need help." />
        ) : (
          <ul className="space-y-3">
            {list.map((ticket) => (
              <li
                key={ticket.id}
                className="rounded-2xl border border-border bg-white/80 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{ticket.subject}</p>
                  <span className="text-xs text-muted-foreground">
                    {ticket.caseNumber} · {ticket.status.replaceAll("_", " ")}
                  </span>
                </div>
                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                  {ticket.description}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Updated {formatRelativeTime(ticket.updatedAt)}
                </p>
                <Link
                  href={`/support/${ticket.id}`}
                  className="mt-3 inline-block text-sm text-primary underline-offset-2 hover:underline"
                >
                  View thread
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
