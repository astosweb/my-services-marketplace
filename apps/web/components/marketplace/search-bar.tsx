"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Search } from "lucide-react";
import {
  CITY_LABELS,
  ESTONIAN_CITIES,
  type CategoryDto,
  type EstonianCity,
} from "@monorepo/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type SearchBarProps = {
  categories?: CategoryDto[];
  defaultQuery?: string;
  defaultCity?: string;
  defaultCategoryId?: string;
  className?: string;
  compact?: boolean;
};

export function SearchBar({
  categories = [],
  defaultQuery = "",
  defaultCity = "",
  defaultCategoryId = "",
  className,
  compact = false,
}: SearchBarProps) {
  const router = useRouter();
  const [q, setQ] = useState(defaultQuery);
  const [city, setCity] = useState(defaultCity);
  const [categoryId, setCategoryId] = useState(defaultCategoryId);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (city) params.set("city", city);
    if (categoryId) params.set("categoryId", categoryId);
    const query = params.toString();
    router.push(query ? `/search?${query}` : "/search");
  }

  return (
    <form
      onSubmit={onSubmit}
      className={cn(
        "flex w-full flex-col gap-2 sm:flex-row sm:items-center",
        compact ? "rounded-xl bg-white/95 p-2 shadow-sm" : "rounded-2xl bg-white p-2 shadow-lg shadow-primary/10",
        className,
      )}
    >
      <div className="relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder="What do you need help with?"
          className="border-0 bg-transparent pl-9 shadow-none focus-visible:ring-0"
          aria-label="Search requests"
        />
      </div>
      <select
        value={city}
        onChange={(event) => setCity(event.target.value)}
        aria-label="City"
        className="h-10 rounded-lg border-0 bg-transparent px-3 text-sm text-foreground outline-none"
      >
        <option value="">All cities</option>
        {ESTONIAN_CITIES.map((value) => (
          <option key={value} value={value}>
            {CITY_LABELS[value as EstonianCity]}
          </option>
        ))}
      </select>
      {categories.length > 0 ? (
        <select
          value={categoryId}
          onChange={(event) => setCategoryId(event.target.value)}
          aria-label="Category"
          className="h-10 max-w-full rounded-lg border-0 bg-transparent px-3 text-sm text-foreground outline-none sm:max-w-[11rem]"
        >
          <option value="">All categories</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      ) : null}
      <Button type="submit" size={compact ? "default" : "lg"} className="shrink-0">
        Search
      </Button>
    </form>
  );
}
