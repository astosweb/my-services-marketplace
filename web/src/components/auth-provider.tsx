"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { AuthPayload, User } from "@/lib/types";

const STORAGE_KEY = "hero.auth";

type AuthState = {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  ready: boolean;
  setSession: (payload: AuthPayload) => void;
  clearSession: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

function subscribe(onStoreChange: () => void) {
  const handler = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === null) onStoreChange();
  };
  window.addEventListener("storage", handler);
  window.addEventListener("hero-auth", onStoreChange);
  return () => {
    window.removeEventListener("storage", handler);
    window.removeEventListener("hero-auth", onStoreChange);
  };
}

function getSnapshot() {
  return localStorage.getItem(STORAGE_KEY);
}

function getServerSnapshot() {
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const parsed = useMemo(() => {
    if (!raw) return null;
    try {
      return JSON.parse(raw) as AuthPayload;
    } catch {
      return null;
    }
  }, [raw]);

  const setSession = useCallback((payload: AuthPayload) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    window.dispatchEvent(new Event("hero-auth"));
  }, []);

  const clearSession = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event("hero-auth"));
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user: parsed?.user ?? null,
      accessToken: parsed?.accessToken ?? null,
      refreshToken: parsed?.refreshToken ?? null,
      ready: typeof window !== "undefined",
      setSession,
      clearSession,
    }),
    [parsed, setSession, clearSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
