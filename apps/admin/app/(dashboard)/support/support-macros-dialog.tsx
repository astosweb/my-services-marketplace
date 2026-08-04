"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Edit2, FileText, Plus, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type {
  SupportCannedResponseDto,
  SupportTicketCategory,
} from "@monorepo/shared";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  useCreateCannedResponse,
  useDeleteCannedResponse,
  useSupportCannedResponses,
  useUpdateCannedResponse,
} from "@/lib/api/support";

const CATEGORIES: SupportTicketCategory[] = [
  "BUG",
  "FEATURE_REQUEST",
  "PAYMENT",
  "ACCOUNT",
  "VERIFICATION",
  "ABUSE",
  "OTHER",
];

const macroSchema = z.object({
  title: z.string().min(2, "Title must be at least 2 characters"),
  body: z.string().min(1, "Response body is required"),
  category: z.enum([
    "NONE",
    "BUG",
    "FEATURE_REQUEST",
    "PAYMENT",
    "ACCOUNT",
    "VERIFICATION",
    "ABUSE",
    "OTHER",
  ]),
  shortcut: z.string(),
});

type MacroFormValues = z.infer<typeof macroSchema>;

function categoryLabel(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

export function SupportMacrosDialog({
  open,
  onOpenChange,
  canWrite,
  canDelete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canWrite: boolean;
  canDelete: boolean;
}) {
  const { data: responses = [], isLoading } = useSupportCannedResponses();
  const createResponse = useCreateCannedResponse();
  const updateResponse = useUpdateCannedResponse();
  const deleteResponse = useDeleteCannedResponse();

  const [editorOpen, setEditorOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<SupportCannedResponseDto | null>(
    null,
  );
  const [deleteTarget, setDeleteTarget] =
    React.useState<SupportCannedResponseDto | null>(null);

  const form = useForm<MacroFormValues>({
    resolver: zodResolver(macroSchema),
    defaultValues: {
      title: "",
      body: "",
      category: "NONE",
      shortcut: "",
    },
  });

  const openEditor = (response?: SupportCannedResponseDto) => {
    setEditing(response ?? null);
    form.reset({
      title: response?.title ?? "",
      body: response?.body ?? "",
      category: response?.category ?? "NONE",
      shortcut: response?.shortcut ?? "",
    });
    setEditorOpen(true);
  };

  const handleSubmit = async (values: MacroFormValues) => {
    const input = {
      title: values.title,
      body: values.body,
      category:
        values.category === "NONE"
          ? null
          : (values.category as SupportTicketCategory),
      shortcut: values.shortcut.trim() || null,
    };

    if (editing) {
      await updateResponse.mutateAsync({ id: editing.id, ...input });
    } else {
      await createResponse.mutateAsync(input);
    }
    setEditorOpen(false);
    setEditing(null);
    form.reset();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <div className="flex items-start justify-between gap-4 pr-8">
              <div>
                <DialogTitle>Canned responses</DialogTitle>
                <DialogDescription className="mt-1">
                  Reusable replies for common support questions.
                </DialogDescription>
              </div>
              {canWrite ? (
                <Button size="sm" onClick={() => openEditor()}>
                  <Plus className="size-4" />
                  New response
                </Button>
              ) : null}
            </div>
          </DialogHeader>

          {isLoading ? (
            <div className="space-y-3 py-2">
              {Array.from({ length: 3 }, (_, index) => (
                <div
                  key={index}
                  className="bg-muted/50 h-24 animate-pulse rounded-lg border"
                />
              ))}
            </div>
          ) : responses.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No canned responses"
              description="Create a reusable reply for your support team."
              action={
                canWrite ? (
                  <Button size="sm" onClick={() => openEditor()}>
                    Create response
                  </Button>
                ) : null
              }
            />
          ) : (
            <div className="grid gap-3 py-2 sm:grid-cols-2">
              {responses.map((response) => (
                <div
                  key={response.id}
                  className="bg-card flex min-w-0 flex-col gap-3 rounded-lg border p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{response.title}</p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {response.category ? (
                          <Badge variant="outline">
                            {categoryLabel(response.category)}
                          </Badge>
                        ) : null}
                        {response.shortcut ? (
                          <Badge variant="secondary">
                            /{response.shortcut}
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center">
                      {canWrite ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Edit ${response.title}`}
                          onClick={() => openEditor(response)}
                        >
                          <Edit2 className="size-4" />
                        </Button>
                      ) : null}
                      {canDelete ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          aria-label={`Delete ${response.title}`}
                          onClick={() => setDeleteTarget(response)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  <p className="text-muted-foreground line-clamp-3 whitespace-pre-wrap text-sm">
                    {response.body}
                  </p>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={editorOpen}
        onOpenChange={(nextOpen) => {
          setEditorOpen(nextOpen);
          if (!nextOpen) setEditing(null);
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit canned response" : "New canned response"}
            </DialogTitle>
            <DialogDescription>
              Team members can insert this response into any ticket reply.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form
              className="space-y-4"
              onSubmit={form.handleSubmit(handleSubmit)}
            >
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input placeholder="Password reset steps" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="body"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Response</FormLabel>
                    <FormControl>
                      <Textarea rows={7} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="NONE">Any category</SelectItem>
                          {CATEGORIES.map((category) => (
                            <SelectItem key={category} value={category}>
                              {categoryLabel(category)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="shortcut"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Shortcut</FormLabel>
                      <FormControl>
                        <Input placeholder="reset-password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditorOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={
                    createResponse.isPending || updateResponse.isPending
                  }
                >
                  {editing ? "Save changes" : "Create response"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(nextOpen) => !nextOpen && setDeleteTarget(null)}
        title="Delete canned response"
        description={`Delete "${deleteTarget?.title}"? This cannot be undone.`}
        confirmText="Delete response"
        isLoading={deleteResponse.isPending}
        onConfirm={async () => {
          if (!deleteTarget) return;
          await deleteResponse.mutateAsync(deleteTarget.id);
          setDeleteTarget(null);
        }}
      />
    </>
  );
}
