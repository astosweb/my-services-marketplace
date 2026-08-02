"use client";

import * as React from "react";
import { format, formatDistanceToNow } from "date-fns";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  Briefcase,
  Edit2,
  FileText,
  HandCoins,
  Mail,
  Star,
  Trash2,
  User,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type {
  OfferStatus,
  ServiceRequestStatus,
  UserDetailRequestDto,
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
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
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
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TableSkeleton } from "@/components/ui/table-skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/hooks/use-session";
import {
  useCategories,
  useDeleteOffer,
  useDeleteRequest,
  useRejectRequest,
  useUpdateOffer,
  useUpdateRequest,
} from "@/lib/api/marketplace";
import { useUser } from "@/lib/api/users";
import { PERMISSIONS } from "@/lib/auth/permissions";

const CITIES = [
  { value: "TALLINN", label: "Tallinn" },
  { value: "TARTU", label: "Tartu" },
  { value: "PARNU", label: "Pärnu" },
  { value: "NARVA", label: "Narva" },
] as const;

const REQUEST_STATUSES: { value: ServiceRequestStatus; label: string }[] = [
  { value: "PENDING_REVIEW", label: "Pending Review" },
  { value: "OPEN", label: "Open" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled / Rejected" },
];

const OFFER_STATUSES: OfferStatus[] = [
  "PENDING",
  "ACCEPTED",
  "DECLINED",
  "WITHDRAWN",
];

const editRequestSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  categoryId: z.string().min(1, "Category is required"),
  city: z.enum(["TALLINN", "TARTU", "PARNU", "NARVA"]),
  location: z.string().min(2, "Location is required"),
  budgetEuros: z.string().optional(),
  pricingMode: z.enum(["PROVIDER_OFFERS", "OWNER_FIXED_PRICE"]),
  status: z.enum([
    "PENDING_REVIEW",
    "OPEN",
    "IN_PROGRESS",
    "COMPLETED",
    "CANCELLED",
  ]),
  isPremium: z.boolean(),
  scheduledAt: z.string().optional(),
});

type EditRequestFormValues = z.infer<typeof editRequestSchema>;

const rejectSchema = z.object({
  reason: z.string().min(3, "Please provide a rejection reason"),
});

type RejectFormValues = z.infer<typeof rejectSchema>;

function formatPrice(cents: number | null) {
  if (cents == null) return "—";
  return `€${(cents / 100).toFixed(0)}`;
}

export function UserDetailPageClient({ userId }: { userId: string }) {
  const { permissions } = useSession();
  const canWriteRequests = permissions.includes(PERMISSIONS.REQUESTS_WRITE);
  const canDeleteRequests = permissions.includes(PERMISSIONS.REQUESTS_DELETE);
  const canWriteOffers = permissions.includes(PERMISSIONS.OFFERS_WRITE);
  const canDeleteOffers = permissions.includes(PERMISSIONS.OFFERS_DELETE);

  const { data: user, isLoading, error } = useUser(userId);
  const categoriesQuery = useCategories();
  const updateRequest = useUpdateRequest();
  const rejectRequest = useRejectRequest();
  const deleteRequest = useDeleteRequest();
  const updateOffer = useUpdateOffer();
  const deleteOffer = useDeleteOffer();

  const [editingRequest, setEditingRequest] =
    React.useState<UserDetailRequestDto | null>(null);
  const [rejectTarget, setRejectTarget] = React.useState<{
    id: string;
    title: string;
  } | null>(null);
  const [cancelTarget, setCancelTarget] = React.useState<{
    id: string;
    title: string;
  } | null>(null);
  const [deleteRequestTarget, setDeleteRequestTarget] = React.useState<{
    id: string;
    title: string;
  } | null>(null);
  const [deleteOfferTargetId, setDeleteOfferTargetId] = React.useState<
    string | null
  >(null);

  const editForm = useForm<EditRequestFormValues>({
    resolver: zodResolver(editRequestSchema),
    defaultValues: {
      title: "",
      description: "",
      categoryId: "",
      city: "TALLINN",
      location: "",
      budgetEuros: "",
      pricingMode: "PROVIDER_OFFERS",
      status: "OPEN",
      isPremium: false,
      scheduledAt: "",
    },
  });

  const rejectForm = useForm<RejectFormValues>({
    resolver: zodResolver(rejectSchema),
    defaultValues: { reason: "" },
  });

  React.useEffect(() => {
    if (!editingRequest) return;
    editForm.reset({
      title: editingRequest.title,
      description: editingRequest.description,
      categoryId: editingRequest.categoryId,
      city: (["TALLINN", "TARTU", "PARNU", "NARVA"].includes(editingRequest.city)
        ? editingRequest.city
        : "TALLINN") as EditRequestFormValues["city"],
      location: editingRequest.location,
      budgetEuros:
        editingRequest.budgetCents != null
          ? (editingRequest.budgetCents / 100).toString()
          : "",
      pricingMode: editingRequest.pricingMode,
      status: editingRequest.status as EditRequestFormValues["status"],
      isPremium: editingRequest.isPremium,
      scheduledAt: editingRequest.scheduledAt
        ? editingRequest.scheduledAt.slice(0, 16)
        : "",
    });
  }, [editingRequest, editForm]);

  const handleEditSubmit = async (values: EditRequestFormValues) => {
    if (!editingRequest) return;
    const budgetCents = values.budgetEuros
      ? Math.round(parseFloat(values.budgetEuros) * 100)
      : undefined;
    await updateRequest.mutateAsync({
      id: editingRequest.id,
      title: values.title,
      description: values.description,
      categoryId: values.categoryId,
      city: values.city,
      location: values.location,
      budgetCents,
      budgetLabel: budgetCents
        ? `€${(budgetCents / 100).toFixed(2)}`
        : undefined,
      pricingMode: values.pricingMode,
      status: values.status as ServiceRequestStatus,
      isPremium: values.isPremium,
      scheduledAt: values.scheduledAt
        ? new Date(values.scheduledAt).toISOString()
        : undefined,
    });
    setEditingRequest(null);
  };

  const handleRejectConfirm = async (values: RejectFormValues) => {
    if (!rejectTarget) return;
    await rejectRequest.mutateAsync({
      id: rejectTarget.id,
      reason: values.reason,
    });
    setRejectTarget(null);
    rejectForm.reset();
  };

  const handleCancelConfirm = async () => {
    if (!cancelTarget) return;
    await updateRequest.mutateAsync({
      id: cancelTarget.id,
      status: "CANCELLED",
    });
    setCancelTarget(null);
  };

  const handleDeleteRequestConfirm = async () => {
    if (!deleteRequestTarget) return;
    await deleteRequest.mutateAsync(deleteRequestTarget.id);
    setDeleteRequestTarget(null);
  };

  const handleDeleteOfferConfirm = async () => {
    if (!deleteOfferTargetId) return;
    await deleteOffer.mutateAsync(deleteOfferTargetId);
    setDeleteOfferTargetId(null);
  };

  const categories = categoriesQuery.data ?? [];

  if (isLoading) {
    return (
      <div className="px-4 lg:px-6">
        <TableSkeleton rows={8} />
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="flex flex-col gap-4">
        <div className="px-4 lg:px-6">
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="mb-2 -ml-2 gap-1.5"
          >
            <Link href="/users">
              <ArrowLeft className="size-4" /> Back to users
            </Link>
          </Button>
        </div>
        <div className="px-4 lg:px-6">
          <EmptyState
            icon={AlertTriangle}
            title="User not found"
            description={
              error instanceof Error
                ? error.message
                : "This user does not exist or was deleted."
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="px-4 lg:px-6">
        <Button variant="ghost" size="sm" asChild className="-ml-2 gap-1.5">
          <Link href="/users">
            <ArrowLeft className="size-4" /> Back to users
          </Link>
        </Button>
      </div>

      <PageHeader
        title={user.profileName}
        description={user.email}
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="outline">{user.role}</Badge>
            <StatusBadge status={user.status} />
          </div>
        }
      />

      <div className="grid gap-4 px-4 lg:px-6 lg:grid-cols-[320px_1fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader className="items-center text-center pb-3">
              <Avatar className="size-20 mx-auto">
                <AvatarImage src={user.avatarUrl ?? undefined} />
                <AvatarFallback className="text-lg">
                  {user.profileName.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <CardTitle className="text-lg pt-2">{user.profileName}</CardTitle>
              {user.businessName ? (
                <CardDescription className="flex items-center justify-center gap-1">
                  <Briefcase className="size-3.5" />
                  {user.businessName}
                </CardDescription>
              ) : null}
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="size-3.5 shrink-0" />
                <span className="truncate">{user.email}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <User className="size-3.5 shrink-0" />
                <span className="font-mono text-xs truncate">{user.id}</span>
              </div>
              <div className="flex items-center gap-2">
                <Star className="size-3.5 fill-amber-400 text-amber-400 shrink-0" />
                <span className="font-medium">{user.rating.toFixed(1)}</span>
                <span className="text-muted-foreground text-xs">
                  ({user.reviewCount} reviews)
                </span>
              </div>
              <div className="pt-2 border-t space-y-2 text-xs">
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Display name</span>
                  <span className="font-medium text-right">
                    {user.displayName}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Joined</span>
                  <span className="font-medium text-right">
                    {format(new Date(user.createdAt), "PPP")}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Last updated</span>
                  <span className="font-medium text-right">
                    {formatDistanceToNow(new Date(user.updatedAt), {
                      addSuffix: true,
                    })}
                  </span>
                </div>
              </div>
              {user.bio ? (
                <div className="pt-2 border-t">
                  <p className="text-muted-foreground text-xs mb-1">Bio</p>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">
                    {user.bio}
                  </p>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg border p-3 text-center space-y-1">
              <FileText className="size-4 mx-auto text-muted-foreground" />
              <p className="text-lg font-semibold tabular-nums">
                {user.requestCount ?? 0}
              </p>
              <p className="text-[11px] text-muted-foreground">Requests</p>
            </div>
            <div className="rounded-lg border p-3 text-center space-y-1">
              <HandCoins className="size-4 mx-auto text-muted-foreground" />
              <p className="text-lg font-semibold tabular-nums">
                {user.offerCount ?? 0}
              </p>
              <p className="text-[11px] text-muted-foreground">Offers</p>
            </div>
            <div className="rounded-lg border p-3 text-center space-y-1">
              <Star className="size-4 mx-auto text-muted-foreground" />
              <p className="text-lg font-semibold tabular-nums">
                {user.reviewsReceivedCount ?? user.reviewCount}
              </p>
              <p className="text-[11px] text-muted-foreground">Reviews</p>
            </div>
          </div>
        </div>

        <Tabs defaultValue="requests" className="w-full min-w-0">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="requests">
              Requests ({user.requests.length})
            </TabsTrigger>
            <TabsTrigger value="offers">
              Offers ({user.offers.length})
            </TabsTrigger>
            <TabsTrigger value="received">
              Received ({user.reviewsReceived.length})
            </TabsTrigger>
            <TabsTrigger value="given">
              Given ({user.reviewsGiven.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="requests" className="pt-3">
            {user.requests.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="No requests"
                description="This user has not created any service requests."
              />
            ) : (
              <div className="overflow-hidden rounded-lg border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>City</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Budget</TableHead>
                      <TableHead>Offers</TableHead>
                      <TableHead>Created</TableHead>
                      {canWriteRequests || canDeleteRequests ? (
                        <TableHead className="w-36 text-right">
                          Actions
                        </TableHead>
                      ) : null}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {user.requests.map((request) => (
                      <TableRow key={request.id}>
                        <TableCell className="font-medium max-w-[220px]">
                          <Link
                            href={`/requests?search=${encodeURIComponent(request.title)}`}
                            className="hover:underline truncate block"
                          >
                            {request.title}
                          </Link>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm">
                          <span className="mr-1">{request.categorySymbol}</span>
                          {request.categoryName}
                        </TableCell>
                        <TableCell className="text-sm">{request.city}</TableCell>
                        <TableCell>
                          <StatusBadge status={request.status} />
                        </TableCell>
                        <TableCell className="text-sm tabular-nums">
                          {request.budget ?? "Flexible"}
                        </TableCell>
                        <TableCell className="tabular-nums text-sm">
                          {request.offerCount}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                          {formatDistanceToNow(new Date(request.createdAt), {
                            addSuffix: true,
                          })}
                        </TableCell>
                        {canWriteRequests || canDeleteRequests ? (
                          <TableCell className="text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1">
                              {canWriteRequests &&
                              request.status !== "CANCELLED" &&
                              request.status !== "COMPLETED" ? (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="Reject request"
                                  onClick={() =>
                                    setRejectTarget({
                                      id: request.id,
                                      title: request.title,
                                    })
                                  }
                                >
                                  <XCircle className="size-4 text-amber-600 dark:text-amber-400" />
                                </Button>
                              ) : null}
                              {canWriteRequests &&
                              request.status !== "CANCELLED" &&
                              request.status !== "COMPLETED" ? (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="Cancel request"
                                  onClick={() =>
                                    setCancelTarget({
                                      id: request.id,
                                      title: request.title,
                                    })
                                  }
                                >
                                  <Ban className="size-4 text-muted-foreground" />
                                </Button>
                              ) : null}
                              {canWriteRequests ? (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="Edit request"
                                  onClick={() => setEditingRequest(request)}
                                >
                                  <Edit2 className="size-4 text-muted-foreground" />
                                </Button>
                              ) : null}
                              {canDeleteRequests ? (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="Delete request"
                                  onClick={() =>
                                    setDeleteRequestTarget({
                                      id: request.id,
                                      title: request.title,
                                    })
                                  }
                                >
                                  <Trash2 className="size-4 text-destructive" />
                                </Button>
                              ) : null}
                            </div>
                          </TableCell>
                        ) : null}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="offers" className="pt-3">
            {user.offers.length === 0 ? (
              <EmptyState
                icon={HandCoins}
                title="No offers"
                description="This user has not submitted any offers."
              />
            ) : (
              <div className="overflow-hidden rounded-lg border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Request</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Message</TableHead>
                      <TableHead>Created</TableHead>
                      {canDeleteOffers ? (
                        <TableHead className="w-24 text-right">
                          Actions
                        </TableHead>
                      ) : null}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {user.offers.map((offer) => (
                      <TableRow key={offer.id}>
                        <TableCell className="font-medium max-w-[220px]">
                          <Link
                            href={`/requests?search=${encodeURIComponent(offer.request.title)}`}
                            className="hover:underline truncate block"
                          >
                            {offer.request.title}
                          </Link>
                        </TableCell>
                        <TableCell className="tabular-nums text-sm">
                          {formatPrice(offer.priceCents)}
                        </TableCell>
                        <TableCell>
                          {canWriteOffers ? (
                            <Select
                              value={offer.status}
                              onValueChange={(status) =>
                                void updateOffer.mutateAsync({
                                  id: offer.id,
                                  status: status as OfferStatus,
                                })
                              }
                            >
                              <SelectTrigger className="h-8 w-32 border-none p-0 focus:ring-0">
                                <StatusBadge status={offer.status} />
                              </SelectTrigger>
                              <SelectContent>
                                {OFFER_STATUSES.map((status) => (
                                  <SelectItem key={status} value={status}>
                                    {status}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <StatusBadge status={offer.status} />
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[240px] truncate">
                          {offer.message ?? "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                          {formatDistanceToNow(new Date(offer.createdAt), {
                            addSuffix: true,
                          })}
                        </TableCell>
                        {canDeleteOffers ? (
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Delete offer"
                              onClick={() => setDeleteOfferTargetId(offer.id)}
                            >
                              <Trash2 className="size-4 text-destructive" />
                            </Button>
                          </TableCell>
                        ) : null}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="received" className="pt-3">
            {user.reviewsReceived.length === 0 ? (
              <EmptyState
                icon={Star}
                title="No reviews received"
                description="Nobody has reviewed this user yet."
              />
            ) : (
              <div className="overflow-hidden rounded-lg border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>From</TableHead>
                      <TableHead>Rating</TableHead>
                      <TableHead>Comment</TableHead>
                      <TableHead>Request</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {user.reviewsReceived.map((review) => (
                      <TableRow key={review.id}>
                        <TableCell className="font-medium">
                          {review.author.profileName}
                        </TableCell>
                        <TableCell className="tabular-nums whitespace-nowrap">
                          ⭐ {review.rating}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[280px] truncate">
                          {review.body ?? "—"}
                        </TableCell>
                        <TableCell className="text-sm max-w-[180px] truncate">
                          {review.request?.title ?? "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                          {formatDistanceToNow(new Date(review.createdAt), {
                            addSuffix: true,
                          })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="given" className="pt-3">
            {user.reviewsGiven.length === 0 ? (
              <EmptyState
                icon={Star}
                title="No reviews given"
                description="This user has not left any reviews."
              />
            ) : (
              <div className="overflow-hidden rounded-lg border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>To</TableHead>
                      <TableHead>Rating</TableHead>
                      <TableHead>Comment</TableHead>
                      <TableHead>Request</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {user.reviewsGiven.map((review) => (
                      <TableRow key={review.id}>
                        <TableCell className="font-medium">
                          <Link
                            href={`/users/${review.subject.id}`}
                            className="hover:underline"
                          >
                            {review.subject.profileName}
                          </Link>
                        </TableCell>
                        <TableCell className="tabular-nums whitespace-nowrap">
                          ⭐ {review.rating}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[280px] truncate">
                          {review.body ?? "—"}
                        </TableCell>
                        <TableCell className="text-sm max-w-[180px] truncate">
                          {review.request?.title ?? "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                          {formatDistanceToNow(new Date(review.createdAt), {
                            addSuffix: true,
                          })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <Dialog
        open={Boolean(editingRequest)}
        onOpenChange={(open) => !open && setEditingRequest(null)}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Edit Service Request</DialogTitle>
            <DialogDescription>
              Modify details and status for &quot;{editingRequest?.title}&quot;.
            </DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form
              onSubmit={editForm.handleSubmit(handleEditSubmit)}
              className="space-y-4 pt-2"
            >
              <FormField
                control={editForm.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea rows={3} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={editForm.control}
                  name="categoryId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {categories.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.symbol} {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="City" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {CITIES.map((c) => (
                            <SelectItem key={c.value} value={c.value}>
                              {c.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={editForm.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address / Specific Location</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={editForm.control}
                  name="budgetEuros"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Budget (€ EUR)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="e.g. 100.00"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {REQUEST_STATUSES.map((s) => (
                            <SelectItem key={s.value} value={s.value}>
                              {s.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={editForm.control}
                name="pricingMode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pricing Mode</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="PROVIDER_OFFERS">
                          Provider Offers
                        </SelectItem>
                        <SelectItem value="OWNER_FIXED_PRICE">
                          Owner Fixed Price
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="scheduledAt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Scheduled Date & Time</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="isPremium"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>Premium Listing</FormLabel>
                      <FormDescription>
                        Featured placement on main feeds
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingRequest(null)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={updateRequest.isPending}>
                  Save Changes
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(rejectTarget)}
        onOpenChange={(open) => !open && setRejectTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="size-5" />
              Reject Request
            </DialogTitle>
            <DialogDescription>
              Rejecting &quot;{rejectTarget?.title}&quot; will hide it from the
              public feed and show your rejection reason to the request owner.
            </DialogDescription>
          </DialogHeader>
          <Form {...rejectForm}>
            <form
              onSubmit={rejectForm.handleSubmit(handleRejectConfirm)}
              className="space-y-4 pt-2"
            >
              <FormField
                control={rejectForm.control}
                name="reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rejection reason</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="State why this post is rejected..."
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setRejectTarget(null)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={rejectRequest.isPending}>
                  Reject Request
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(cancelTarget)}
        onOpenChange={(open) => !open && setCancelTarget(null)}
        title="Cancel Request"
        description={`Set "${cancelTarget?.title}" status to CANCELLED? The owner will no longer see it as active.`}
        confirmText="Cancel Request"
        isLoading={updateRequest.isPending}
        onConfirm={handleCancelConfirm}
      />

      <ConfirmDialog
        open={Boolean(deleteRequestTarget)}
        onOpenChange={(open) => !open && setDeleteRequestTarget(null)}
        title="Delete Request"
        description={`Permanently delete "${deleteRequestTarget?.title}"? Associated offers, photos, and messages will be removed.`}
        confirmText="Delete Request"
        isLoading={deleteRequest.isPending}
        onConfirm={handleDeleteRequestConfirm}
      />

      <ConfirmDialog
        open={Boolean(deleteOfferTargetId)}
        onOpenChange={(open) => !open && setDeleteOfferTargetId(null)}
        title="Delete Offer"
        description="Are you sure you want to delete this offer? This cannot be undone."
        confirmText="Delete Offer"
        isLoading={deleteOffer.isPending}
        onConfirm={handleDeleteOfferConfirm}
      />
    </div>
  );
}
