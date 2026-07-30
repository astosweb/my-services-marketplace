"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ClipboardList,
  FolderTree,
  HandCoins,
  MessageSquareQuote,
  Users,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch } from "@/lib/api";
import type { DashboardStats } from "@/lib/types";

function StatCard({
  title,
  value,
  hint,
  href,
}: {
  title: string;
  value: number | string;
  hint: string;
  href?: string;
}) {
  const content = (
    <Card className="transition-colors hover:border-zinc-300">
      <CardHeader className="pb-2">
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-3xl tabular-nums">{value}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-zinc-500">{hint}</p>
      </CardContent>
    </Card>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ data: DashboardStats }>("/admin/dashboard")
      .then((response) => setStats(response.data))
      .catch((err: Error) => setError(err.message));
  }, []);

  if (error) {
    return <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>;
  }

  if (!stats) {
    return <div className="text-sm text-zinc-500">Loading dashboard…</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-zinc-500">Marketplace overview and moderation entry points.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Users"
          value={stats.users.total}
          hint={`${stats.users.new7d} new · ${stats.users.disabled} disabled · ${stats.users.admins} admins`}
          href="/users"
        />
        <StatCard
          title="Requests"
          value={stats.requests.total}
          hint={`${stats.requests.open} open · ${stats.requests.inProgress} in progress · ${stats.requests.new7d} new`}
          href="/requests"
        />
        <StatCard
          title="Offers"
          value={stats.offers.total}
          hint={`${stats.offers.pending} pending`}
          href="/offers"
        />
        <StatCard
          title="Reviews"
          value={stats.reviews.total}
          hint={`${stats.categories.total} categories · ${stats.messaging.messages} messages`}
          href="/reviews"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Request status</CardTitle>
            <CardDescription>Current pipeline distribution</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg bg-zinc-50 p-3">
              <div className="text-zinc-500">Open</div>
              <div className="text-xl font-semibold tabular-nums">{stats.requests.open}</div>
            </div>
            <div className="rounded-lg bg-zinc-50 p-3">
              <div className="text-zinc-500">In progress</div>
              <div className="text-xl font-semibold tabular-nums">{stats.requests.inProgress}</div>
            </div>
            <div className="rounded-lg bg-zinc-50 p-3">
              <div className="text-zinc-500">Completed</div>
              <div className="text-xl font-semibold tabular-nums">{stats.requests.completed}</div>
            </div>
            <div className="rounded-lg bg-zinc-50 p-3">
              <div className="text-zinc-500">Cancelled</div>
              <div className="text-xl font-semibold tabular-nums">{stats.requests.cancelled}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick links</CardTitle>
            <CardDescription>Jump into moderation queues</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            {[
              { href: "/users", label: "Manage users", icon: Users },
              { href: "/requests", label: "Moderate requests", icon: ClipboardList },
              { href: "/offers", label: "Inspect offers", icon: HandCoins },
              { href: "/reviews", label: "Moderate reviews", icon: MessageSquareQuote },
              { href: "/categories", label: "Edit categories", icon: FolderTree },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-2 rounded-md border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50"
                >
                  <Icon className="h-4 w-4 text-zinc-500" />
                  {item.label}
                </Link>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
