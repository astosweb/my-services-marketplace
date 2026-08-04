"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CreateCannedResponseInput,
  CreateSupportNoteInput,
  MergeSupportTicketsInput,
  Paginated,
  SendSupportMessageInput,
  SupportBulkActionInput,
  SupportCannedResponseDto,
  SupportInternalNoteDto,
  SupportMessageDto,
  SupportStatsDto,
  SupportTicketDetailDto,
  SupportTicketDto,
  SupportTicketsQuery,
  UpdateSupportTicketInput,
} from "@monorepo/shared";

import { ApiError, api, apiQuery, downloadCsv } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/keys";
import { useApiMutation } from "@/lib/api/use-api-mutation";

export type SupportTicketListParams = Partial<
  SupportTicketsQuery & { page: number }
>;

export type UpdateCannedResponseInput = Partial<CreateCannedResponseInput> & {
  id: string;
};

export type UploadedSupportAttachment = {
  key: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
};

function toOffsetParams(params: SupportTicketListParams) {
  const limit = params.limit ?? 20;
  const page = params.page ?? 1;

  return {
    limit,
    offset: params.offset ?? (page - 1) * limit,
    search: params.search,
    status: params.status,
    category: params.category,
    priority: params.priority,
    assignedAdminId: params.assignedAdminId,
    createdById: params.createdById,
    caseNumber: params.caseNumber,
    tag: params.tag,
    from: params.from,
    to: params.to,
    unassigned: params.unassigned,
    slaBreached: params.slaBreached,
    sortBy: params.sortBy,
    sortOrder: params.sortOrder,
  };
}

function ticketInvalidation(ticketId?: string) {
  return [
    queryKeys.supportTickets(),
    queryKeys.supportStats,
    ...(ticketId ? [queryKeys.supportTicket(ticketId)] : []),
  ];
}

export function useSupportStats() {
  return useQuery({
    queryKey: queryKeys.supportStats,
    queryFn: () => api.get<SupportStatsDto>("/admin/support/stats"),
  });
}

export function useSupportTickets(params: SupportTicketListParams) {
  const query = toOffsetParams(params);

  return useQuery({
    queryKey: queryKeys.supportTickets(query),
    queryFn: () =>
      api.get<Paginated<SupportTicketDto>>(
        `/admin/support/tickets${apiQuery(query)}`,
      ),
    placeholderData: (previous) => previous,
  });
}

export function useSupportTicket(id: string) {
  return useQuery({
    queryKey: queryKeys.supportTicket(id),
    queryFn: () =>
      api.get<SupportTicketDetailDto>(`/admin/support/tickets/${id}`),
    enabled: Boolean(id),
  });
}

export function useUpdateSupportTicket(ticketId?: string) {
  return useApiMutation({
    mutationFn: ({ id, ...input }: UpdateSupportTicketInput & { id: string }) =>
      api.patch<SupportTicketDetailDto>(`/admin/support/tickets/${id}`, input),
    successMessage: "Ticket updated",
    invalidate: ticketInvalidation(ticketId),
  });
}

export function useSendSupportMessage(ticketId: string) {
  return useApiMutation({
    mutationFn: (input: SendSupportMessageInput) =>
      api.post<SupportMessageDto>(
        `/admin/support/tickets/${ticketId}/messages`,
        input,
      ),
    successMessage: "Reply sent",
    invalidate: ticketInvalidation(ticketId),
  });
}

export function useCreateSupportNote(ticketId: string) {
  return useApiMutation({
    mutationFn: (input: CreateSupportNoteInput) =>
      api.post<SupportInternalNoteDto>(
        `/admin/support/tickets/${ticketId}/notes`,
        input,
      ),
    successMessage: "Internal note added",
    invalidate: [queryKeys.supportTicket(ticketId)],
  });
}

export function useUpdateSupportNote(ticketId: string) {
  return useApiMutation({
    mutationFn: ({
      noteId,
      ...input
    }: CreateSupportNoteInput & { noteId: string }) =>
      api.patch<SupportInternalNoteDto>(
        `/admin/support/tickets/${ticketId}/notes/${noteId}`,
        input,
      ),
    successMessage: "Internal note updated",
    invalidate: [queryKeys.supportTicket(ticketId)],
  });
}

export function useDeleteSupportNote(ticketId: string) {
  return useApiMutation({
    mutationFn: (noteId: string) =>
      api.delete<{ deleted: true }>(
        `/admin/support/tickets/${ticketId}/notes/${noteId}`,
      ),
    successMessage: "Internal note deleted",
    invalidate: [queryKeys.supportTicket(ticketId)],
  });
}

export function useMarkSupportTicketRead(ticketId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      api.post<{ read: true }>(`/admin/support/tickets/${ticketId}/read`),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.supportTicket(ticketId),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.supportTickets(),
        }),
      ]);
    },
  });
}

export function useReopenSupportTicket(ticketId?: string) {
  return useApiMutation({
    mutationFn: (id: string) =>
      api.post<SupportTicketDetailDto>(`/admin/support/tickets/${id}/reopen`),
    successMessage: "Ticket reopened",
    invalidate: ticketInvalidation(ticketId),
  });
}

export function useMergeSupportTickets(ticketId: string) {
  return useApiMutation({
    mutationFn: (input: MergeSupportTicketsInput) =>
      api.post<SupportTicketDetailDto>(
        `/admin/support/tickets/${ticketId}/merge`,
        input,
      ),
    successMessage: "Tickets merged",
    invalidate: ticketInvalidation(ticketId),
  });
}

export function useBulkSupportAction() {
  return useApiMutation({
    mutationFn: (input: SupportBulkActionInput) =>
      api.post<{ updated: number; total: number }>(
        "/admin/support/tickets/bulk",
        input,
      ),
    successMessage: ({ updated, total }) =>
      `${updated} of ${total} ticket${total === 1 ? "" : "s"} updated`,
    invalidate: [queryKeys.supportTickets(), queryKeys.supportStats],
  });
}

export function useSupportCannedResponses() {
  return useQuery({
    queryKey: queryKeys.supportCannedResponses,
    queryFn: () =>
      api.get<SupportCannedResponseDto[]>("/admin/support/canned-responses"),
  });
}

export function useCreateCannedResponse() {
  return useApiMutation({
    mutationFn: (input: CreateCannedResponseInput) =>
      api.post<SupportCannedResponseDto>(
        "/admin/support/canned-responses",
        input,
      ),
    successMessage: "Canned response created",
    invalidate: [queryKeys.supportCannedResponses],
  });
}

export function useUpdateCannedResponse() {
  return useApiMutation({
    mutationFn: ({ id, ...input }: UpdateCannedResponseInput) =>
      api.patch<SupportCannedResponseDto>(
        `/admin/support/canned-responses/${id}`,
        input,
      ),
    successMessage: "Canned response updated",
    invalidate: [queryKeys.supportCannedResponses],
  });
}

export function useDeleteCannedResponse() {
  return useApiMutation({
    mutationFn: (id: string) =>
      api.delete<{ deleted: true }>(`/admin/support/canned-responses/${id}`),
    successMessage: "Canned response deleted",
    invalidate: [queryKeys.supportCannedResponses],
  });
}

export function exportSupportTickets(params: SupportTicketListParams) {
  return downloadCsv(
    `/admin/support/tickets/export${apiQuery(toOffsetParams(params))}`,
    "support-tickets.csv",
  );
}

export async function uploadSupportAttachments(
  files: File[],
): Promise<UploadedSupportAttachment[]> {
  const formData = new FormData();
  for (const file of files) formData.append("files", file);

  const response = await fetch("/api/uploads/support-attachments", {
    method: "POST",
    body: formData,
    credentials: "same-origin",
  });
  const payload = (await response.json().catch(() => null)) as {
    data?: { files?: UploadedSupportAttachment[] };
    error?: string | { message?: string };
  } | null;

  if (!response.ok) {
    const message =
      typeof payload?.error === "string"
        ? payload.error
        : (payload?.error?.message ?? "Attachment upload failed");
    throw new ApiError(message, response.status);
  }

  return payload?.data?.files ?? [];
}
