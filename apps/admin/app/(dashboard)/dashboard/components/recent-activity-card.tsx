"use client";

import { formatDistanceToNow } from "date-fns";
import { History } from "lucide-react";
import Link from "next/link";
import type { ActivityLogDto } from "@monorepo/shared";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export function RecentActivityCard({ items }: { items: ActivityLogDto[] }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
        <div className="space-y-1.5">
          <CardTitle>Recent activity</CardTitle>
          <CardDescription>
            Latest admin audit events, or recent marketplace activity when none exist yet
          </CardDescription>
        </div>
        <Link
          href="/audit-logs"
          className="text-sm text-primary hover:underline shrink-0"
        >
          View all
        </Link>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <EmptyState
            icon={History}
            title="Nothing has happened yet"
            description="Admin actions and new users or requests will show up here."
          />
        ) : (
          <ul className="divide-y">
            {items.map((log) => (
              <li
                key={log.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm"
              >
                <span className="flex items-center gap-2">
                  <Badge variant="outline">{log.action}</Badge>
                  <span className="font-medium">{log.title ?? log.resource}</span>
                  <span className="text-muted-foreground">
                    by {log.actorName ?? "System"}
                  </span>
                </span>
                <span className="text-muted-foreground">
                  {formatDistanceToNow(new Date(log.createdAt), {
                    addSuffix: true,
                  })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
