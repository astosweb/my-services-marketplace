"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  adminLogin,
  adminLogout,
  apiFetch,
  clearSession,
  loadSession,
  saveSession,
} from "./api";
import type { AdminUser, AuthSession } from "./types";

type AuthContextValue = {
  user: AdminUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const session = loadSession();
    if (!session || session.user.role !== "ADMIN") {
      clearSession();
      setUser(null);
      setLoading(false);
      return;
    }
    setUser(session.user);
    apiFetch<{ data: AdminUser }>("/admin/me")
      .then((response) => {
        const next: AuthSession = {
          ...session,
          user: response.data,
        };
        saveSession(next);
        setUser(response.data);
      })
      .catch(() => {
        clearSession();
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const session = await adminLogin(email, password);
      setUser(session.user);
      router.replace("/");
    },
    [router],
  );

  const logout = useCallback(async () => {
    await adminLogout();
    setUser(null);
    router.replace("/login");
  }, [router]);

  const refreshMe = useCallback(async () => {
    const response = await apiFetch<{ data: AdminUser }>("/admin/me");
    const session = loadSession();
    if (session) {
      saveSession({ ...session, user: response.data });
    }
    setUser(response.data);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, logout, refreshMe }),
    [user, loading, login, logout, refreshMe],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
