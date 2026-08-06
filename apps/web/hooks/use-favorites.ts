"use client";

import { useCallback, useSyncExternalStore } from "react";

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
  const snapshot = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );
  const ids = JSON.parse(snapshot) as string[];

  const toggle = useCallback((id: string) => {
    const current = readIds();
    writeIds(
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  }, []);

  const has = useCallback((id: string) => ids.includes(id), [ids]);

  return { ids, toggle, has, count: ids.length };
}
