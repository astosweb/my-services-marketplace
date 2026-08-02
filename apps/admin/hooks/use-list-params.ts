"use client";

import { useEffect, useMemo, useState } from "react";

const SEARCH_DEBOUNCE_MS = 300;

type Filters = Record<string, string | undefined>;

type ListParamsState<TFilters extends Filters> = {
  page: number;
  limit: number;
  search: string;
  filters: TFilters;
};

/**
 * Shared list state for server-paginated tables: debounces the search box and
 * resets to the first page whenever the query changes.
 */
export function useListParams<TFilters extends Filters>(
  initialFilters: TFilters,
  initialLimit = 20,
) {
  const [state, setState] = useState<ListParamsState<TFilters>>({
    page: 1,
    limit: initialLimit,
    search: "",
    filters: initialFilters,
  });
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(
      () => setDebouncedSearch(state.search),
      SEARCH_DEBOUNCE_MS,
    );
    return () => clearTimeout(timer);
  }, [state.search]);

  const query = useMemo(
    () => ({
      page: state.page,
      limit: state.limit,
      search: debouncedSearch || undefined,
      ...state.filters,
    }),
    [state.page, state.limit, state.filters, debouncedSearch],
  );

  return {
    search: state.search,
    filters: state.filters,
    query,
    setSearch: (search: string) =>
      setState((previous) => ({ ...previous, search, page: 1 })),
    setFilter: <TKey extends keyof TFilters>(
      key: TKey,
      value: TFilters[TKey],
    ) =>
      setState((previous) => ({
        ...previous,
        page: 1,
        filters: { ...previous.filters, [key]: value },
      })),
    setPage: (page: number) => setState((previous) => ({ ...previous, page })),
    setLimit: (limit: number) =>
      setState((previous) => ({ ...previous, limit, page: 1 })),
  };
}
