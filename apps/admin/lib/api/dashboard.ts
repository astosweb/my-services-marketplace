"use client";

import { useQuery } from "@tanstack/react-query";
import type { DashboardResponse } from "@monorepo/shared";
import { api } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/keys";

export function useDashboardStats() {
  return useQuery({
    queryKey: queryKeys.dashboard,
    queryFn: () => api.get<DashboardResponse>("/admin/dashboard/stats"),
  });
}
