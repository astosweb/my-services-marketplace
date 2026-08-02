"use client";

import { useQuery } from "@tanstack/react-query";
import type { SessionResponse } from "@monorepo/shared";
import { api } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/keys";

const EMPTY_PERMISSIONS: string[] = [];

export function useSession() {
  const query = useQuery({
    queryKey: queryKeys.session,
    queryFn: () => api.get<SessionResponse>("/auth/session"),
    retry: false,
    staleTime: 60_000,
  });

  return {
    user: query.data?.user ?? null,
    permissions: query.data?.permissions ?? EMPTY_PERMISSIONS,
    isLoading: query.isLoading,
    isAuthenticated: Boolean(query.data?.user),
    error: query.error,
    mutate: query.refetch,
  };
}
