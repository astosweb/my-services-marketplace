"use client";

import * as React from "react";
import { format, formatDistanceToNow } from "date-fns";
import {
  Activity,
  AlertTriangle,
  AppWindow,
  ArrowLeft,
  CalendarClock,
  Clock3,
  Edit2,
  ExternalLink,
  FileText,
  GitMerge,
  History,
  Mail,
  MessageSquare,
  MonitorSmartphone,
  Paperclip,
  RotateCcw,
  Send,
  ShieldAlert,
  Smartphone,
  Tag,
  Trash2,
  User,
  UserCheck,
  X,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import type {
  SupportAttachmentDto,
  SupportInternalNoteDto,
  SupportTicketCategory,
  SupportTicketPriority,
  SupportTicketStatus,
  UpdateSupportTicketInput,
} from "@monorepo/shared";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TableSkeleton } from "@/components/ui/table-skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/hooks/use-session";
import {
  uploadSupportAttachments,
  useCreateSupportNote,
  useDeleteSupportNote,
  useMarkSupportTicketRead,
  useMergeSupportTickets,
  useReopenSupportTicket,
  useSendSupportMessage,
  useSupportCannedResponses,
  useSupportTicket,
  useUpdateSupportNote,
  useUpdateSupportTicket,
} from "@/lib/api/support";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { cn } from "@/lib/utils";

const STATUSES: SupportTicketStatus[] = [
  "OPEN",
  "WAITING_FOR_USER",
  "IN_PROGRESS",
  "RESOLVED",
  "CLOSED",
];

const PRIORITIES: SupportTicketPriority[] = ["LOW", "NORMAL", "HIGH", "URGENT"];

const CATEGORIES: SupportTicketCategory[] = [
  "BUG",
  "FEATURE_REQUEST",
  "PAYMENT",
  "ACCOUNT",
  "VERIFICATION",
  "ABUSE",
  "OTHER",
];

function label(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function Deadline({
  label: deadlineLabel,
  dueAt,
  completedAt,
  now,
}: {
  label: string;
  dueAt: string | null;
  completedAt: string | null;
  now: number;
}) {
  if (!dueAt) {
    return (
      <div className="rounded-lg border p-3">
        <p className="text-muted-foreground text-xs">{deadlineLabel}</p>
        <p className="mt-1 text-sm font-medium">Not set</p>
      </div>
    );
  }

  const due = new Date(dueAt);
  const completed = completedAt ? new Date(completedAt) : null;
  const overdue = !completed && due.getTime() < now;

  return (
    <div
      className={cn(
        "rounded-lg border p-3",
        overdue && "border-destructive/40 bg-destructive/5",
      )}
    >
      <p className="text-muted-foreground text-xs">{deadlineLabel}</p>
      <p
        className={cn(
          "mt-1 flex items-center gap-1.5 text-sm font-medium",
          overdue && "text-destructive",
        )}
      >
        {overdue ? (
          <ShieldAlert className="size-3.5" />
        ) : (
          <Clock3 className="size-3.5" />
        )}
        {completed
          ? `Completed ${formatDistanceToNow(completed, { addSuffix: true })}`
          : `${overdue ? "Overdue" : "Due"} ${formatDistanceToNow(due, {
              addSuffix: true,
            })}`}
      </p>
      <p className="text-muted-foreground mt-1 text-xs">
        {format(due, "PPP p")}
      </p>
    </div>
  );
}

function AttachmentLink({ attachment }: { attachment: SupportAttachmentDto }) {
  return (
    <a
      href={attachment.url}
      target="_blank"
      rel="noreferrer"
      className="bg-background hover:bg-accent flex min-w-0 items-center gap-2 rounded-md border px-3 py-2 text-xs transition-colors"
    >
      <Paperclip className="size-3.5 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{attachment.fileName}</span>
      <span className="text-muted-foreground shrink-0">
        {formatBytes(attachment.sizeBytes)}
      </span>
      <ExternalLink className="size-3 shrink-0" />
    </a>
  );
}

export function SupportTicketDetailClient({ ticketId }: { ticketId: string }) {
  const { permissions } = useSession();
  const canWrite = permissions.includes(PERMISSIONS.SUPPORT_WRITE);
  const canAssign = permissions.includes(PERMISSIONS.SUPPORT_ASSIGN);
  const canDelete = permissions.includes(PERMISSIONS.SUPPORT_DELETE);

  const { data: ticket, isLoading, error } = useSupportTicket(ticketId);
  const updateTicket = useUpdateSupportTicket(ticketId);
  const sendMessage = useSendSupportMessage(ticketId);
  const createNote = useCreateSupportNote(ticketId);
  const updateNote = useUpdateSupportNote(ticketId);
  const deleteNote = useDeleteSupportNote(ticketId);
  const reopenTicket = useReopenSupportTicket(ticketId);
  const mergeTickets = useMergeSupportTickets(ticketId);
  const markRead = useMarkSupportTicketRead(ticketId);
  const { data: cannedResponses = [] } = useSupportCannedResponses();

  const [reply, setReply] = React.useState("");
  const [replyFiles, setReplyFiles] = React.useState<File[]>([]);
  const [uploading, setUploading] = React.useState(false);
  const [newNote, setNewNote] = React.useState("");
  const [editingNote, setEditingNote] =
    React.useState<SupportInternalNoteDto | null>(null);
  const [deleteNoteTarget, setDeleteNoteTarget] =
    React.useState<SupportInternalNoteDto | null>(null);
  const [assigneeId, setAssigneeId] = React.useState<string | null>(null);
  const [tags, setTags] = React.useState<string | null>(null);
  const [mergeOpen, setMergeOpen] = React.useState(false);
  const [mergeSourceId, setMergeSourceId] = React.useState("");
  const [renderedAt] = React.useState(() => Date.now());
  const markedReadRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (
      ticket?.unreadCount &&
      ticket.unreadCount > 0 &&
      markedReadRef.current !== ticket.id
    ) {
      markedReadRef.current = ticket.id;
      markRead.mutate(undefined);
    }
  }, [markRead, ticket]);

  const applyUpdate = async (input: UpdateSupportTicketInput) => {
    await updateTicket.mutateAsync({ id: ticketId, ...input });
  };

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    const nextFiles = [...replyFiles, ...Array.from(fileList)].slice(0, 9);
    const oversized = nextFiles.find((file) => file.size > 15 * 1024 * 1024);
    if (oversized) {
      toast.error(`${oversized.name} is larger than 15 MB`);
      return;
    }
    setReplyFiles(nextFiles);
  };

  const handleReply = async () => {
    const body = reply.trim();
    if (!body && replyFiles.length === 0) return;

    setUploading(replyFiles.length > 0);
    try {
      const uploaded =
        replyFiles.length > 0 ? await uploadSupportAttachments(replyFiles) : [];
      await sendMessage.mutateAsync({
        body: body || undefined,
        attachmentKeys: uploaded.map((file) => file.key),
      });
      setReply("");
      setReplyFiles([]);
    } catch (replyError) {
      if (!(replyError instanceof Error)) {
        toast.error("Could not send reply");
      } else if (replyFiles.length > 0) {
        toast.error(replyError.message);
      }
    } finally {
      setUploading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="px-4 lg:px-6">
        <TableSkeleton rows={8} />
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="flex flex-col gap-4">
        <div className="px-4 lg:px-6">
          <Button variant="ghost" size="sm" asChild className="-ml-2">
            <Link href="/support">
              <ArrowLeft className="size-4" />
              Back to support
            </Link>
          </Button>
        </div>
        <div className="px-4 lg:px-6">
          <EmptyState
            icon={AlertTriangle}
            title="Ticket not found"
            description={
              error instanceof Error
                ? error.message
                : "This support ticket is unavailable."
            }
          />
        </div>
      </div>
    );
  }

  const availableCannedResponses = cannedResponses.filter(
    (response) =>
      response.category === null || response.category === ticket.category,
  );
  const responseCompletedAt = ticket.firstResponseAt;
  const resolutionCompletedAt = ticket.resolvedAt ?? ticket.closedAt;

  return (
    <div className="flex flex-col gap-5">
      <div className="px-4 lg:px-6">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link href="/support">
            <ArrowLeft className="size-4" />
            Back to support
          </Link>
        </Button>
      </div>

      <PageHeader
        title={ticket.subject}
        description={`${ticket.caseNumber} · Opened ${formatDistanceToNow(
          new Date(ticket.createdAt),
          { addSuffix: true },
        )}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={ticket.priority} />
            <StatusBadge status={ticket.status} />
            {canWrite &&
            (ticket.status === "CLOSED" || ticket.status === "RESOLVED") ? (
              <Button
                variant="outline"
                size="sm"
                disabled={reopenTicket.isPending}
                onClick={() => {
                  void reopenTicket
                    .mutateAsync(ticketId)
                    .catch(() => undefined);
                }}
              >
                <RotateCcw className="size-4" />
                Reopen
              </Button>
            ) : null}
            {canWrite ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMergeOpen(true)}
              >
                <GitMerge className="size-4" />
                Merge
              </Button>
            ) : null}
          </div>
        }
      />

      {ticket.mergedIntoId ? (
        <div className="mx-4 flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm lg:mx-6">
          <GitMerge className="size-4 text-amber-600 dark:text-amber-400" />
          This ticket was merged into ticket{" "}
          <Link
            href={`/support/${ticket.mergedIntoId}`}
            className="font-mono font-medium underline"
          >
            {ticket.mergedIntoId}
          </Link>
          .
        </div>
      ) : null}

      <div className="grid gap-3 px-4 sm:grid-cols-2 lg:px-6">
        <Deadline
          label="First response SLA"
          dueAt={ticket.responseDueAt}
          completedAt={responseCompletedAt}
          now={renderedAt}
        />
        <Deadline
          label="Resolution SLA"
          dueAt={ticket.resolveDueAt}
          completedAt={resolutionCompletedAt}
          now={renderedAt}
        />
      </div>

      <div className="grid min-w-0 gap-5 px-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:px-6">
        <Tabs defaultValue="conversation" className="min-w-0">
          <TabsList className="h-auto w-full justify-start overflow-x-auto">
            <TabsTrigger value="conversation">
              <MessageSquare />
              Conversation ({ticket.messages.length})
            </TabsTrigger>
            <TabsTrigger value="notes">
              <FileText />
              Internal notes ({ticket.internalNotes.length})
            </TabsTrigger>
            <TabsTrigger value="history">
              <History />
              Status history
            </TabsTrigger>
            <TabsTrigger value="activity">
              <Activity />
              Activity
            </TabsTrigger>
          </TabsList>

          <TabsContent value="conversation" className="space-y-4 pt-2">
            <Card className="gap-0 py-0">
              <CardHeader className="border-b py-4">
                <CardTitle className="text-base">Conversation</CardTitle>
                <CardDescription>
                  Messages are visible to the customer.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 py-5">
                {ticket.messages.map((message, index) => (
                  <div
                    key={message.id}
                    className={cn(
                      "flex gap-3",
                      message.isStaff && "flex-row-reverse",
                    )}
                  >
                    <Avatar className="size-9">
                      <AvatarImage
                        src={message.sender.avatarUrl ?? undefined}
                      />
                      <AvatarFallback>
                        {initials(message.sender.profileName)}
                      </AvatarFallback>
                    </Avatar>
                    <div
                      className={cn(
                        "min-w-0 max-w-[85%]",
                        message.isStaff && "text-right",
                      )}
                    >
                      <div
                        className={cn(
                          "flex flex-wrap items-center gap-2",
                          message.isStaff && "justify-end",
                        )}
                      >
                        <p className="text-sm font-medium">
                          {message.sender.profileName}
                        </p>
                        {index === 0 && !message.isStaff ? (
                          <Badge variant="outline">Ticket opened</Badge>
                        ) : null}
                        {message.isStaff ? (
                          <Badge variant="secondary">Staff</Badge>
                        ) : null}
                        <span className="text-muted-foreground text-xs">
                          {format(new Date(message.createdAt), "PPP p")}
                        </span>
                      </div>
                      <div
                        className={cn(
                          "mt-2 rounded-lg border p-4 text-left",
                          message.isStaff
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-muted/40",
                        )}
                      >
                        {message.body ? (
                          <p className="whitespace-pre-wrap text-sm leading-relaxed">
                            {message.body}
                          </p>
                        ) : null}
                        {message.attachments.length > 0 ? (
                          <div className="mt-3 space-y-2">
                            {message.attachments.map((attachment) => (
                              <AttachmentLink
                                key={attachment.id}
                                attachment={attachment}
                              />
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}

                {ticket.messages.length === 0 ? (
                  <div className="bg-muted/40 rounded-lg border p-4">
                    <Badge variant="outline" className="mb-2">
                      Ticket opened
                    </Badge>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">
                      {ticket.description}
                    </p>
                  </div>
                ) : null}
              </CardContent>
            </Card>

            {canWrite ? (
              <Card className="gap-4">
                <CardHeader>
                  <CardTitle className="text-base">Reply to customer</CardTitle>
                  <CardDescription>
                    Attach up to 9 files, 15 MB each.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {availableCannedResponses.length > 0 ? (
                    <Select
                      onValueChange={(responseId) => {
                        const response = availableCannedResponses.find(
                          (item) => item.id === responseId,
                        );
                        if (response) setReply(response.body);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Insert a canned response…" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableCannedResponses.map((response) => (
                          <SelectItem key={response.id} value={response.id}>
                            {response.title}
                            {response.shortcut
                              ? ` (/${response.shortcut})`
                              : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : null}
                  <Textarea
                    value={reply}
                    onChange={(event) => setReply(event.target.value)}
                    rows={7}
                    placeholder="Write a reply…"
                  />
                  {replyFiles.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {replyFiles.map((file, index) => (
                        <Badge
                          key={`${file.name}-${index}`}
                          variant="secondary"
                          className="max-w-full gap-1.5"
                        >
                          <Paperclip />
                          <span className="max-w-52 truncate">{file.name}</span>
                          <button
                            type="button"
                            aria-label={`Remove ${file.name}`}
                            onClick={() =>
                              setReplyFiles((previous) =>
                                previous.filter(
                                  (_, fileIndex) => fileIndex !== index,
                                ),
                              )
                            }
                          >
                            <X className="size-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                  <div className="flex flex-wrap justify-between gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <label>
                        <Paperclip className="size-4" />
                        Add attachments
                        <input
                          type="file"
                          className="hidden"
                          multiple
                          accept="image/*,.pdf,.txt,.doc,.docx,.xls,.xlsx"
                          onChange={(event) => {
                            handleFiles(event.target.files);
                            event.target.value = "";
                          }}
                        />
                      </label>
                    </Button>
                    <Button
                      disabled={
                        (!reply.trim() && replyFiles.length === 0) ||
                        uploading ||
                        sendMessage.isPending
                      }
                      onClick={() => void handleReply()}
                    >
                      <Send className="size-4" />
                      {uploading ? "Uploading…" : "Send reply"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </TabsContent>

          <TabsContent value="notes" className="space-y-4 pt-2">
            {canWrite ? (
              <Card className="gap-4">
                <CardHeader>
                  <CardTitle className="text-base">
                    {editingNote ? "Edit internal note" : "Add internal note"}
                  </CardTitle>
                  <CardDescription>
                    Internal notes are only visible to administrators.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Textarea
                    value={editingNote ? editingNote.body : newNote}
                    onChange={(event) => {
                      if (editingNote) {
                        setEditingNote({
                          ...editingNote,
                          body: event.target.value,
                        });
                      } else {
                        setNewNote(event.target.value);
                      }
                    }}
                    rows={5}
                    placeholder="Add context for other support admins…"
                  />
                  <div className="flex justify-end gap-2">
                    {editingNote ? (
                      <Button
                        variant="outline"
                        onClick={() => setEditingNote(null)}
                      >
                        Cancel
                      </Button>
                    ) : null}
                    <Button
                      disabled={
                        !(editingNote?.body.trim() || newNote.trim()) ||
                        createNote.isPending ||
                        updateNote.isPending
                      }
                      onClick={() => {
                        if (editingNote) {
                          void updateNote
                            .mutateAsync({
                              noteId: editingNote.id,
                              body: editingNote.body.trim(),
                            })
                            .then(() => setEditingNote(null))
                            .catch(() => undefined);
                        } else {
                          void createNote
                            .mutateAsync({ body: newNote.trim() })
                            .then(() => setNewNote(""))
                            .catch(() => undefined);
                        }
                      }}
                    >
                      {editingNote ? "Save note" : "Add note"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : null}

            {ticket.internalNotes.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="No internal notes"
                description="Admins have not added private context to this ticket."
              />
            ) : (
              <div className="space-y-3">
                {ticket.internalNotes.map((note) => (
                  <Card key={note.id} className="gap-3 py-4">
                    <CardContent className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <Avatar className="size-7">
                            <AvatarImage
                              src={note.author.avatarUrl ?? undefined}
                            />
                            <AvatarFallback className="text-[10px]">
                              {initials(note.author.profileName)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">
                              {note.author.profileName}
                            </p>
                            <p className="text-muted-foreground text-xs">
                              {format(new Date(note.createdAt), "PPP p")}
                              {note.updatedAt !== note.createdAt
                                ? " · edited"
                                : ""}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center">
                          {canWrite ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Edit note"
                              onClick={() => setEditingNote(note)}
                            >
                              <Edit2 className="size-4" />
                            </Button>
                          ) : null}
                          {canDelete ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive"
                              aria-label="Delete note"
                              onClick={() => setDeleteNoteTarget(note)}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          ) : null}
                        </div>
                      </div>
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">
                        {note.body}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="history" className="pt-2">
            {ticket.statusHistory.length === 0 ? (
              <EmptyState
                icon={History}
                title="No status changes"
                description="This ticket has not changed status yet."
              />
            ) : (
              <Card className="gap-0 py-0">
                <CardContent className="divide-y p-0">
                  {ticket.statusHistory.map((item) => (
                    <div key={item.id} className="flex gap-3 px-5 py-4">
                      <div className="bg-muted mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full">
                        <History className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          <span className="font-medium">
                            {item.changedBy.profileName}
                          </span>
                          <span className="text-muted-foreground">changed</span>
                          {item.fromStatus ? (
                            <>
                              <StatusBadge status={item.fromStatus} />
                              <span className="text-muted-foreground">to</span>
                            </>
                          ) : null}
                          <StatusBadge status={item.toStatus} />
                        </div>
                        {item.note ? (
                          <p className="text-muted-foreground mt-1 text-sm">
                            {item.note}
                          </p>
                        ) : null}
                        <p className="text-muted-foreground mt-1 text-xs">
                          {format(new Date(item.createdAt), "PPP p")}
                        </p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="activity" className="pt-2">
            {ticket.activities.length === 0 ? (
              <EmptyState
                icon={Activity}
                title="No activity"
                description="No audit events have been recorded."
              />
            ) : (
              <Card className="gap-0 py-0">
                <CardContent className="divide-y p-0">
                  {ticket.activities.map((item) => (
                    <div key={item.id} className="flex gap-3 px-5 py-4">
                      <div className="bg-muted mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full">
                        <Activity className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">{label(item.type)}</Badge>
                          <span className="text-sm font-medium">
                            {item.actor.profileName}
                          </span>
                        </div>
                        {item.details &&
                        Object.keys(item.details).length > 0 ? (
                          <pre className="bg-muted/50 mt-2 overflow-x-auto rounded-md p-2 text-xs">
                            {JSON.stringify(item.details, null, 2)}
                          </pre>
                        ) : null}
                        <p className="text-muted-foreground mt-1 text-xs">
                          {format(new Date(item.createdAt), "PPP p")}
                        </p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        <aside className="space-y-4">
          <Card className="gap-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="size-4" />
                Customer
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Avatar className="size-11">
                  <AvatarImage src={ticket.createdBy.avatarUrl ?? undefined} />
                  <AvatarFallback>
                    {initials(ticket.createdBy.profileName)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <Link
                    href={`/users/${ticket.createdBy.id}`}
                    className="block truncate font-medium hover:underline"
                  >
                    {ticket.createdBy.profileName}
                  </Link>
                  <p className="text-muted-foreground truncate text-sm">
                    {ticket.createdBy.email}
                  </p>
                </div>
              </div>
              <div className="space-y-2 border-t pt-3 text-sm">
                <div className="flex items-center gap-2">
                  <Mail className="text-muted-foreground size-3.5" />
                  <span className="min-w-0 truncate">
                    {ticket.createdBy.email}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <User className="text-muted-foreground size-3.5" />
                  <span>{ticket.createdBy.role}</span>
                </div>
                {ticket.createdBy.memberSince ? (
                  <div className="flex items-center gap-2">
                    <CalendarClock className="text-muted-foreground size-3.5" />
                    <span>
                      Member since{" "}
                      {format(
                        new Date(ticket.createdBy.memberSince),
                        "MMM yyyy",
                      )}
                    </span>
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card className="gap-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <UserCheck className="size-4" />
                Ticket controls
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Status</label>
                <Select
                  value={ticket.status}
                  disabled={!canWrite || updateTicket.isPending}
                  onValueChange={(status) => {
                    void applyUpdate({
                      status: status as SupportTicketStatus,
                    }).catch(() => undefined);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {label(status)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Priority</label>
                  <Select
                    value={ticket.priority}
                    disabled={!canWrite || updateTicket.isPending}
                    onValueChange={(priority) => {
                      void applyUpdate({
                        priority: priority as SupportTicketPriority,
                      }).catch(() => undefined);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITIES.map((priority) => (
                        <SelectItem key={priority} value={priority}>
                          {label(priority)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Category</label>
                  <Select
                    value={ticket.category}
                    disabled={!canWrite || updateTicket.isPending}
                    onValueChange={(category) => {
                      void applyUpdate({
                        category: category as SupportTicketCategory,
                      }).catch(() => undefined);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((category) => (
                        <SelectItem key={category} value={category}>
                          {label(category)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="assignee-id" className="text-sm font-medium">
                  Assigned admin ID
                </label>
                <div className="flex gap-2">
                  <Input
                    id="assignee-id"
                    value={assigneeId ?? ticket.assignedAdmin?.id ?? ""}
                    disabled={!canAssign}
                    placeholder="Unassigned"
                    onChange={(event) => setAssigneeId(event.target.value)}
                  />
                  {canAssign ? (
                    <Button
                      variant="outline"
                      disabled={updateTicket.isPending}
                      onClick={() => {
                        void applyUpdate({
                          assignedAdminId: assigneeId?.trim() || null,
                        })
                          .then(() => setAssigneeId(null))
                          .catch(() => undefined);
                      }}
                    >
                      Save
                    </Button>
                  ) : null}
                </div>
                {ticket.assignedAdmin ? (
                  <p className="text-muted-foreground text-xs">
                    {ticket.assignedAdmin.profileName} ·{" "}
                    {ticket.assignedAdmin.email}
                  </p>
                ) : null}
              </div>
              <div className="space-y-1.5">
                <label htmlFor="ticket-tags" className="text-sm font-medium">
                  Tags
                </label>
                <div className="flex gap-2">
                  <Input
                    id="ticket-tags"
                    value={tags ?? ticket.tags.join(", ")}
                    disabled={!canWrite}
                    placeholder="billing, follow-up"
                    onChange={(event) => setTags(event.target.value)}
                  />
                  {canWrite ? (
                    <Button
                      variant="outline"
                      disabled={updateTicket.isPending}
                      onClick={() => {
                        void applyUpdate({
                          tags:
                            tags
                              ?.split(",")
                              .map((tagValue) => tagValue.trim())
                              .filter(Boolean) ?? [],
                        })
                          .then(() => setTags(null))
                          .catch(() => undefined);
                      }}
                    >
                      <Tag className="size-4" />
                    </Button>
                  ) : null}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="gap-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <MonitorSmartphone className="size-4" />
                Device & app
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground flex items-center gap-2">
                  <Smartphone className="size-3.5" />
                  Device
                </span>
                <span className="text-right font-medium">
                  {ticket.deviceName ?? "—"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Platform</span>
                <span className="text-right font-medium">
                  {[ticket.platform, ticket.systemVersion]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground flex items-center gap-2">
                  <AppWindow className="size-3.5" />
                  App version
                </span>
                <span className="font-medium">{ticket.appVersion ?? "—"}</span>
              </div>
              <div className="border-t pt-3">
                <p className="text-muted-foreground mb-1 text-xs">User agent</p>
                <p className="break-words font-mono text-xs">
                  {ticket.userAgent ?? "—"}
                </p>
              </div>
              {ticket.devices && ticket.devices.length > 0 ? (
                <div className="space-y-2 border-t pt-3">
                  <p className="text-muted-foreground text-xs">
                    Recent registered devices
                  </p>
                  {ticket.devices.slice(0, 3).map((device) => (
                    <div key={device.id} className="rounded-md border p-2">
                      <p className="text-xs font-medium">
                        {device.name ?? device.platform}
                      </p>
                      <p className="text-muted-foreground mt-0.5 text-xs">
                        {[device.systemVersion, device.appVersion]
                          .filter(Boolean)
                          .join(" · ") || "No version data"}
                      </p>
                    </div>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="gap-4">
            <CardHeader>
              <CardTitle className="text-base">Ticket details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Case number</span>
                <span className="font-mono">{ticket.caseNumber}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Created</span>
                <span className="text-right">
                  {format(new Date(ticket.createdAt), "PPP p")}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Updated</span>
                <span className="text-right">
                  {format(new Date(ticket.updatedAt), "PPP p")}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Messages</span>
                <span>{ticket.messageCount ?? ticket.messages.length}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Attachments</span>
                <span>
                  {ticket.attachmentCount ?? ticket.attachments.length}
                </span>
              </div>
              {ticket.slaBreached ? (
                <Badge variant="destructive" className="mt-2">
                  <ShieldAlert />
                  SLA breached
                </Badge>
              ) : null}
            </CardContent>
          </Card>

          {ticket.attachments.length > 0 ? (
            <Card className="gap-4">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Paperclip className="size-4" />
                  All attachments
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {ticket.attachments.map((attachment) => (
                  <AttachmentLink key={attachment.id} attachment={attachment} />
                ))}
              </CardContent>
            </Card>
          ) : null}
        </aside>
      </div>

      <Dialog open={mergeOpen} onOpenChange={setMergeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Merge another ticket</DialogTitle>
            <DialogDescription>
              Messages, notes, and attachments from the source ticket will move
              into {ticket.caseNumber}. The source ticket will be closed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label htmlFor="merge-source" className="text-sm font-medium">
              Source ticket ID
            </label>
            <Input
              id="merge-source"
              value={mergeSourceId}
              onChange={(event) => setMergeSourceId(event.target.value)}
              placeholder="Ticket UUID"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMergeOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!mergeSourceId.trim() || mergeTickets.isPending}
              onClick={() => {
                void mergeTickets
                  .mutateAsync({ sourceTicketId: mergeSourceId.trim() })
                  .then(() => {
                    setMergeOpen(false);
                    setMergeSourceId("");
                  })
                  .catch(() => undefined);
              }}
            >
              <GitMerge className="size-4" />
              Merge tickets
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteNoteTarget)}
        onOpenChange={(nextOpen) => !nextOpen && setDeleteNoteTarget(null)}
        title="Delete internal note"
        description="Delete this internal note? This cannot be undone."
        confirmText="Delete note"
        isLoading={deleteNote.isPending}
        onConfirm={async () => {
          if (!deleteNoteTarget) return;
          await deleteNote.mutateAsync(deleteNoteTarget.id);
          setDeleteNoteTarget(null);
        }}
      />
    </div>
  );
}
