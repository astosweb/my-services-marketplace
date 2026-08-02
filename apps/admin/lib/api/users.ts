"use client";

import { useQuery } from "@tanstack/react-query";
import type {
  BulkUserActionInput,
  Paginated,
  UpdateUserInput,
  UserDetailDto,
  UserDto,
  UsersQuery,
} from "@monorepo/shared";
import { api, apiQuery, downloadCsv } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/keys";
import { useApiMutation } from "@/lib/api/use-api-mutation";

export type UserListParams = Partial<
  Pick<
    UsersQuery,
    "limit" | "offset" | "search" | "sortBy" | "sortOrder" | "role" | "status"
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
    status: params.status,
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

export function useUser(id: string) {
  return useQuery({
    queryKey: queryKeys.user(id),
    queryFn: () => api.get<UserDetailDto>(`/admin/users/${id}`),
    enabled: Boolean(id),
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

export function useBanUser() {
  return useApiMutation({
    mutationFn: (id: string) =>
      api.patch<UserDto>(`/admin/users/${id}`, { status: "BANNED" }),
    successMessage: "User banned",
    invalidate: [queryKeys.users(), queryKeys.dashboard],
  });
}

export function useUnbanUser() {
  return useApiMutation({
    mutationFn: (id: string) =>
      api.patch<UserDto>(`/admin/users/${id}`, { status: "ACTIVE" }),
    successMessage: "User unbanned",
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

export function useRevokeUserSession(userId: string) {
  return useApiMutation({
    mutationFn: (sessionId: string) =>
      api.delete<{ revoked: true; sessionId: string }>(
        `/admin/users/${userId}/sessions/${sessionId}`,
      ),
    successMessage: "Session revoked",
    invalidate: [queryKeys.user(userId)],
  });
}

export function useRevokeAllUserSessions(userId: string) {
  return useApiMutation({
    mutationFn: (_?: void) =>
      api.delete<{ revoked: number }>(`/admin/users/${userId}/sessions`),
    successMessage: (result) =>
      `${result.revoked} session${result.revoked === 1 ? "" : "s"} revoked`,
    invalidate: [queryKeys.user(userId)],
  });
}

export function useRevokeUserDevice(userId: string) {
  return useApiMutation({
    mutationFn: (deviceId: string) =>
      api.delete<{ revoked: true; deviceId: string }>(
        `/admin/users/${userId}/devices/${deviceId}`,
      ),
    successMessage: "Device revoked",
    invalidate: [queryKeys.user(userId)],
  });
}

export function useRevokeAllUserDevices(userId: string) {
  return useApiMutation({
    mutationFn: (_?: void) =>
      api.delete<{ revoked: number }>(`/admin/users/${userId}/devices`),
    successMessage: (result) =>
      `${result.revoked} device${result.revoked === 1 ? "" : "s"} revoked`,
    invalidate: [queryKeys.user(userId)],
  });
}

export function useBulkUserAction() {
  return useApiMutation({
    mutationFn: (input: BulkUserActionInput) =>
      api.post<{ affected: number }>("/admin/users/bulk", input),
    successMessage: (result, input) => {
      const noun = result.affected === 1 ? "user" : "users";
      if (input.action === "ban") return `${result.affected} ${noun} banned`;
      if (input.action === "unban") return `${result.affected} ${noun} unbanned`;
      return `${result.affected} ${noun} deleted`;
    },
    invalidate: [queryKeys.users(), queryKeys.dashboard],
  });
}

export function exportUsers(params: UserListParams) {
  return downloadCsv(
    `/admin/users/export${apiQuery(toOffsetParams(params))}`,
    "users.csv",
  );
}
