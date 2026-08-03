import Link from "next/link";
import type { CategoryDto } from "@monorepo/shared";
import { CategoryIcon } from "@/lib/site";

export function CategoryTile({ category }: { category: CategoryDto }) {
  return (
    <Link
      href={`/categories/${category.id}`}
      className="group flex flex-col items-start gap-3 rounded-2xl border border-border/70 bg-white/70 px-4 py-5 transition hover:border-primary/40 hover:bg-white"
    >
      <span className="flex size-11 items-center justify-center rounded-2xl bg-secondary text-primary transition group-hover:bg-primary group-hover:text-primary-foreground">
        <CategoryIcon categoryId={category.id} className="size-5" />
      </span>
      <div>
        <p className="font-display text-base font-semibold tracking-tight">
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
