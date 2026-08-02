"use client";

import {
  ClipboardList,
  Handshake,
  Star,
  Users,
} from "lucide-react";
import type { DashboardMetrics } from "@monorepo/shared";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type MetricCardsProps = {
  metrics: DashboardMetrics;
};

export function MetricCards({ metrics }: MetricCardsProps) {
  const cards = [
    {
      label: "Users",
      value: metrics.totalUsers,
      badge: "Registered",
      footer: "Marketplace accounts",
      icon: Users,
    },
    {
      label: "Requests",
      value: metrics.totalRequests,
      badge: `${metrics.openRequests} open`,
      footer: `${metrics.completedRequests} completed`,
      icon: ClipboardList,
    },
    {
      label: "Offers",
      value: metrics.totalOffers,
      badge: "All time",
      footer: "Provider bids on requests",
      icon: Handshake,
    },
    {
      label: "Reviews",
      value: metrics.totalReviews,
      badge: `${metrics.totalConversations} chats`,
      footer: `${metrics.unreadNotifications} unread notifications`,
      icon: Star,
    },
  ];

  return (
    <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid gap-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.label} className="@container/card">
          <CardHeader>
            <CardDescription>{card.label}</CardDescription>
            <CardTitle className="@[250px]/card:text-3xl text-2xl font-semibold tabular-nums">
              {card.value.toLocaleString()}
            </CardTitle>
            <CardAction>
              <Badge variant="outline">
                <card.icon className="size-3.5" />
                {card.badge}
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="text-muted-foreground text-sm">
            {card.footer}
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
