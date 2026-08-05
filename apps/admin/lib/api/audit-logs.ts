"use client";

import { useQuery } from "@tanstack/react-query";
import type { AuditLogDto, Paginated } from "@monorepo/shared";
import { api, apiQuery } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/keys";

export type AuditLogsListParams = {
  page?: number;
  limit?: number;
  search?: string;
  action?: string;
  resource?: string;
  actorId?: string;
  from?: string;
  to?: string;
};

function toQuery(params: AuditLogsListParams) {
  const limit = params.limit ?? 20;
  const page = params.page ?? 1;
  return {
    limit,
    offset: (page - 1) * limit,
    search: params.search,
    action: params.action,
    resource: params.resource,
    actorId: params.actorId,
    from: params.from,
    to: params.to,
  };
}

export function useAuditLogs(params: AuditLogsListParams) {
  const query = toQuery(params);
  return useQuery({
    queryKey: queryKeys.auditLogs(query),
    queryFn: () =>
      api.get<Paginated<AuditLogDto>>(`/admin/audit-logs${apiQuery(query)}`),
    placeholderData: (previous) => previous,
  });
}
