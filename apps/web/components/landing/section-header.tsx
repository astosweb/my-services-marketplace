import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SectionHeaderProps = {
  id?: string;
  title: string;
  description?: string;
  actionHref?: string;
  actionLabel?: string;
  actionVariant?: "outline" | "ghost" | "link";
  tone?: "default" | "inverted";
  className?: string;
  children?: ReactNode;
};

export function SectionHeader({
  id,
  title,
  description,
  actionHref,
  actionLabel,
  actionVariant = "outline",
  tone = "default",
  className,
  children,
}: SectionHeaderProps) {
  return (
    <div
      className={cn(
        "mb-6 flex flex-wrap items-end justify-between gap-3 sm:mb-7",
        className,
      )}
    >
      <div className="min-w-0 max-w-xl">
        <h2
          id={id}
          className={cn(
            "font-display text-2xl font-bold tracking-tight sm:text-[1.75rem]",
            tone === "inverted" && "text-primary-foreground",
          )}
        >
          {title}
        </h2>
        {description ? (
          <p
            className={cn(
              "mt-1.5 text-sm leading-relaxed sm:text-[0.9375rem]",
              tone === "inverted"
                ? "text-primary-foreground/75"
                : "text-muted-foreground",
            )}
          >
            {description}
          </p>
        ) : null}
        {children}
      </div>
      {actionHref && actionLabel ? (
        <Button
          asChild
          variant={actionVariant}
          size="sm"
          className={cn(
            tone === "inverted" &&
              actionVariant === "outline" &&
              "border-white/35 bg-transparent text-primary-foreground hover:bg-white/10",
            tone === "inverted" &&
              actionVariant === "ghost" &&
              "text-primary-foreground hover:bg-white/10",
          )}
        >
          <Link href={actionHref}>{actionLabel}</Link>
        </Button>
      ) : null}
    </div>
  );
}
