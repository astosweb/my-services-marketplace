"use client";

import { useState } from "react";
import Link from "next/link";
import { RequestCard } from "@/components/marketplace/request-card";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useMeStats, useMyRequests } from "@/lib/api/hooks";
import { useOptionalUser } from "@/hooks/use-session";
import { cn } from "@/lib/utils";

export default function DashboardPage() {
  const [role, setRole] = useState<"owner" | "provider">("owner");
  const { user } = useOptionalUser();
  const statsQuery = useMeStats();
  const requestsQuery = useMyRequests(role);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-bold tracking-tight">
            Dashboard
          </h1>
          <p className="mt-2 text-muted-foreground">
            Hello{user?.displayName ? `, ${user.displayName}` : ""}. Manage your
            posts and jobs.
          </p>
        </div>
        <Button asChild variant="accent">
          <Link href="/requests/new">Post a request</Link>
        </Button>
      </div>

      {statsQuery.isLoading ? (
        <div className="mb-10 grid gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-24 rounded-2xl" />
          ))}
        </div>
      ) : statsQuery.isError ? (
        <div className="mb-10">
          <ErrorState
            description="Stats failed to load."
            onRetry={() => void statsQuery.refetch()}
          />
        </div>
      ) : statsQuery.data ? (
        <div className="mb-10 grid gap-3 sm:grid-cols-3">
          <Stat label="Posted" value={statsQuery.data.postedCount} />
          <Stat label="Completed" value={statsQuery.data.completedCount} />
          <Stat label="Reviews" value={statsQuery.data.reviewCount} />
        </div>
      ) : null}

      <div className="mb-6 flex gap-2">
        <TabButton
          active={role === "owner"}
          onClick={() => setRole("owner")}
          label="My requests"
        />
        <TabButton
          active={role === "provider"}
          onClick={() => setRole("provider")}
          label="My jobs"
        />
      </div>

      {requestsQuery.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-40 rounded-2xl" />
          ))}
        </div>
      ) : requestsQuery.isError ? (
        <ErrorState
          description="Your requests failed to load."
          onRetry={() => void requestsQuery.refetch()}
        />
      ) : !requestsQuery.data?.items.length ? (
        <EmptyState
          title={role === "owner" ? "No requests yet" : "No jobs yet"}
          description={
            role === "owner"
              ? "Post something neighbors can help with."
              : "Browse open requests and send an offer."
          }
          actionLabel={role === "owner" ? "Post a request" : "Browse requests"}
          actionHref={role === "owner" ? "/requests/new" : "/requests"}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {requestsQuery.data.items.map((request) => (
            <RequestCard key={request.id} request={request} />
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border/80 bg-white/70 px-5 py-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-3xl font-bold text-primary">{value}</p>
    </div>
  );
}

function TabButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-lg px-4 py-2 text-sm font-semibold transition",
        active
          ? "bg-primary text-primary-foreground"
          : "bg-secondary text-secondary-foreground hover:bg-secondary/80",
      )}
    >
      {label}
    </button>
  );
}
