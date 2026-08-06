import Link from "next/link";
import type { CategoryDto } from "@monorepo/shared";
import { CategoryIcon } from "@/lib/site";
import { cn } from "@/lib/utils";

export function CategoryTile({
  category,
  compact = false,
}: {
  category: CategoryDto;
  compact?: boolean;
}) {
  return (
    <Link
      href={`/categories/${category.id}`}
      className={cn(
        "group flex h-full flex-col items-start rounded-xl border border-border/70 bg-white/80 transition hover:border-primary/40 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        compact ? "gap-2.5 px-3.5 py-3.5" : "gap-3 px-4 py-5",
      )}
    >
      <span
        className={cn(
          "flex items-center justify-center rounded-xl bg-secondary text-primary transition group-hover:bg-primary group-hover:text-primary-foreground",
          compact ? "size-9" : "size-11 rounded-2xl",
        )}
      >
        <CategoryIcon
          categoryId={category.id}
          className={compact ? "size-4" : "size-5"}
        />
      </span>
      <div className="min-w-0">
        <p
          className={cn(
            "font-display font-semibold tracking-tight",
            compact ? "text-sm" : "text-base",
          )}
        >
          {category.name}
        </p>
        {typeof category.requestCount === "number" ? (
          <p className="mt-0.5 text-xs text-muted-foreground">
            {category.requestCount} open
          </p>
        ) : (
          <p className="mt-0.5 text-xs text-muted-foreground">Browse jobs</p>
        )}
      </div>
    </Link>
  );
}
