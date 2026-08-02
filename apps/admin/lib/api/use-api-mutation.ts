"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

type MutationOptions<TInput, TOutput> = {
  mutationFn: (input: TInput) => Promise<TOutput>;
  successMessage: string | ((output: TOutput, input: TInput) => string);
  /** Query keys to refetch once the mutation settles. */
  invalidate?: ReadonlyArray<readonly unknown[]>;
};

/**
 * Wraps a mutation with the feedback and cache invalidation every admin form
 * needs, replacing the per-page try/catch + toast + manual refetch pattern.
 */
export function useApiMutation<TInput, TOutput>({
  mutationFn,
  successMessage,
  invalidate = [],
}: MutationOptions<TInput, TOutput>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: async (output, input) => {
      toast.success(
        typeof successMessage === "function"
          ? successMessage(output, input)
          : successMessage,
      );
      await Promise.all(
        invalidate.map((queryKey) =>
          queryClient.invalidateQueries({ queryKey: [...queryKey] }),
        ),
      );
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : "Request failed");
    },
  });
}
