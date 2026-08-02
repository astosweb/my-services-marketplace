"use client";

import { useQuery } from "@tanstack/react-query";
import type {
  BulkUserActionInput,
  Paginated,
  UpdateUserInput,
  UserDto,
  UsersQuery,
} from "@monorepo/shared";
import { api, apiQuery, downloadCsv } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/keys";
import { useApiMutation } from "@/lib/api/use-api-mutation";

export type UserListParams = Partial<
  Pick<
    UsersQuery,
    "limit" | "offset" | "search" | "sortBy" | "sortOrder" | "role"
  > & { page?: number }
>;

function toOffsetParams(params: UserListParams) {
  const limit = params.limit ?? 20;
  const page = params.page ?? 1;
  return {
    limit,
    offset: params.offset ?? (page - 1) * limit,
    search: params.search,
    sortBy: params.sortBy,
    sortOrder: params.sortOrder,
    role: params.role,
  };
}

export function useUsers(params: UserListParams) {
  const query = toOffsetParams(params);
  return useQuery({
    queryKey: queryKeys.users(query),
    queryFn: () =>
      api.get<Paginated<UserDto>>(`/admin/users${apiQuery(query)}`),
    placeholderData: (previous) => previous,
  });
}

export function useUpdateUser() {
  return useApiMutation({
    mutationFn: ({ id, ...input }: UpdateUserInput & { id: string }) =>
      api.patch<UserDto>(`/admin/users/${id}`, input),
    successMessage: "User updated",
    invalidate: [queryKeys.users(), queryKeys.dashboard],
  });
}

export function useDeleteUser() {
  return useApiMutation({
    mutationFn: (id: string) =>
      api.delete<{ deleted: true }>(`/admin/users/${id}`),
    successMessage: "User deleted",
    invalidate: [queryKeys.users(), queryKeys.dashboard],
  });
}

export function useBulkUserAction() {
  return useApiMutation({
    mutationFn: (input: BulkUserActionInput) =>
      api.post<{ affected: number }>("/admin/users/bulk", {
        ids: input.ids,
        action: "delete",
      }),
    successMessage: (result) =>
      `${result.affected} user${result.affected === 1 ? "" : "s"} deleted`,
    invalidate: [queryKeys.users(), queryKeys.dashboard],
  });
}

export function exportUsers(params: UserListParams) {
  return downloadCsv(
    `/admin/users/export${apiQuery(toOffsetParams(params))}`,
    "users.csv",
  );
}
