"use client";

import { formatDistanceToNow } from "date-fns";
import { History } from "lucide-react";
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
      <CardHeader>
        <CardTitle>Recent activity</CardTitle>
        <CardDescription>
          Latest marketplace events from the live API
        </CardDescription>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <EmptyState
            icon={History}
            title="Nothing has happened yet"
            description="New users and requests will show up here."
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
