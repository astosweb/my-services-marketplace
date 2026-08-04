"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type StatusBadgeProps = {
  status: string;
  className?: string;
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const normalized = status.toUpperCase();

  let variantClass = "bg-muted text-muted-foreground border-transparent";

  if (
    ["OPEN", "ACTIVE", "ACCEPTED", "COMPLETED", "ADMIN", "SUCCESS"].includes(
      normalized,
    )
  ) {
    variantClass =
      "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30";
  } else if (
    [
      "PENDING",
      "PENDING_REVIEW",
      "WAITING_FOR_USER",
      "IN_PROGRESS",
      "HIGH",
      "WARNING",
      "MODERATED",
    ].includes(normalized)
  ) {
    variantClass =
      "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30";
  } else if (
    [
      "CANCELLED",
      "DECLINED",
      "DELETED",
      "SUSPENDED",
      "BANNED",
      "URGENT",
      "ERROR",
    ].includes(normalized)
  ) {
    variantClass =
      "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30";
  } else if (
    ["WITHDRAWN", "RESOLVED", "CLOSED", "USER", "INFO"].includes(normalized)
  ) {
    variantClass =
      "bg-slate-500/15 text-slate-700 dark:text-slate-400 border-slate-500/30";
  }

  return (
    <Badge
      variant="outline"
      className={cn(
        "font-medium tracking-wide text-xs px-2 py-0.5",
        variantClass,
        className,
      )}
    >
      {status.replaceAll("_", " ")}
    </Badge>
  );
}
