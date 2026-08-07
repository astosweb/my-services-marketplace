"use client";

import { useEffect, useRef, useCallback, useSyncExternalStore } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { FavoritesListResponse } from "@monorepo/shared";
import { useOptionalUser } from "@/hooks/use-session";
import { api } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/keys";

const STORAGE_KEY = "gobid_favorites";

type Listener = () => void;
const listeners = new Set<Listener>();

function readIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === "string")
      : [];
  } catch {
    return [];
  }
}

function writeIds(ids: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  listeners.forEach((listener) => listener());
}

function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return JSON.stringify(readIds());
}

function getServerSnapshot() {
  return "[]";
}

export function useFavorites() {
  const { user, isLoading: sessionLoading } = useOptionalUser();
  const queryClient = useQueryClient();
  const syncedUserIdRef = useRef<string | null>(null);
  const localSnapshot = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );
  const localIds = JSON.parse(localSnapshot) as string[];

  const favoritesQuery = useQuery({
    queryKey: queryKeys.favorites,
    queryFn: () => api.get<FavoritesListResponse>("/favorites"),
    enabled: Boolean(user),
    staleTime: 30_000,
  });

  const syncMutation = useMutation({
    mutationFn: (requestIds: string[]) =>
      api.put<FavoritesListResponse>("/favorites/sync", { requestIds }),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.favorites, data);
      writeIds([]);
    },
  });
  const syncFavorites = syncMutation.mutate;

  useEffect(() => {
    if (!user) {
      syncedUserIdRef.current = null;
      return;
    }
    if (sessionLoading || favoritesQuery.isLoading) return;
    if (syncedUserIdRef.current === user.id) return;

    const pendingLocalIds = readIds();
    syncedUserIdRef.current = user.id;
    if (pendingLocalIds.length === 0) return;
    syncFavorites(pendingLocalIds);
  }, [user, sessionLoading, favoritesQuery.isLoading, syncFavorites]);

  const addMutation = useMutation({
    mutationFn: (requestId: string) => api.post("/favorites", { requestId }),
    onMutate: async (requestId) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.favorites });
      const previous = queryClient.getQueryData<FavoritesListResponse>(
        queryKeys.favorites,
      );
      if (previous && !previous.ids.includes(requestId)) {
        queryClient.setQueryData<FavoritesListResponse>(queryKeys.favorites, {
          ...previous,
          ids: [requestId, ...previous.ids],
        });
      }
      return { previous };
    },
    onError: (_error, _requestId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.favorites, context.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.favorites });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (requestId: string) =>
      api.delete(`/favorites/${encodeURIComponent(requestId)}`),
    onMutate: async (requestId) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.favorites });
      const previous = queryClient.getQueryData<FavoritesListResponse>(
        queryKeys.favorites,
      );
      if (previous) {
        queryClient.setQueryData<FavoritesListResponse>(queryKeys.favorites, {
          ...previous,
          ids: previous.ids.filter((id) => id !== requestId),
          items: previous.items.filter((item) => item.requestId !== requestId),
        });
      }
      return { previous };
    },
    onError: (_error, _requestId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.favorites, context.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.favorites });
    },
  });

  const serverIds = favoritesQuery.data?.ids ?? [];
  const ids = user ? serverIds : localIds;

  const toggle = useCallback(
    (id: string) => {
      if (user) {
        if (serverIds.includes(id)) {
          removeMutation.mutate(id);
        } else {
          addMutation.mutate(id);
        }
        return;
      }
      const current = readIds();
      writeIds(
        current.includes(id)
          ? current.filter((item) => item !== id)
          : [...current, id],
      );
    },
    [user, serverIds, addMutation, removeMutation],
  );

  const has = useCallback((id: string) => ids.includes(id), [ids]);

  return {
    ids,
    items: user ? (favoritesQuery.data?.items ?? []) : [],
    toggle,
    has,
    count: ids.length,
    isLoading: Boolean(user) && favoritesQuery.isLoading,
  };
}
