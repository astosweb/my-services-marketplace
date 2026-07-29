import type { ServiceRequestStatus } from "./types";

const cityApiValues: Record<string, string> = {
  Tallinn: "TALLINN",
  Tartu: "TARTU",
  Pärnu: "PARNU",
  Narva: "NARVA",
  TALLINN: "TALLINN",
  TARTU: "TARTU",
  PARNU: "PARNU",
  NARVA: "NARVA",
};

export const ESTONIAN_CITIES = [
  { api: "TALLINN", label: "Tallinn", lat: 59.437, lng: 24.7536 },
  { api: "TARTU", label: "Tartu", lat: 58.378, lng: 26.729 },
  { api: "PARNU", label: "Pärnu", lat: 58.3859, lng: 24.4971 },
  { api: "NARVA", label: "Narva", lat: 59.3797, lng: 28.1791 },
] as const;

export function cityToApi(value: string) {
  return cityApiValues[value] ?? value.toUpperCase();
}

export function statusLabel(status: ServiceRequestStatus) {
  switch (status) {
    case "OPEN":
      return "Open";
    case "IN_PROGRESS":
      return "In progress";
    case "COMPLETED":
      return "Completed";
    case "CANCELLED":
      return "Cancelled";
  }
}

export function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function categoryShort(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
