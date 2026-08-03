"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/keys";
import type { MeUser } from "@monorepo/shared";

export function useSession() {
  return useQuery({
    queryKey: queryKeys.session,
    queryFn: async () => {
      try {
        return await api.get<{ user: MeUser }>("/auth/session");
      } catch {
        return null;
      }
    },
    staleTime: 60_000,
    retry: false,
  });
}

export function useOptionalUser() {
  const { data, isLoading } = useSession();
  return { user: data?.user ?? null, isLoading };
}
