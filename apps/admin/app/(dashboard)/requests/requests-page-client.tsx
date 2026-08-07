"use client";

import * as React from "react";
import { format, formatDistanceToNow } from "date-fns";
import Link from "next/link";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ClipboardList,
  DollarSign,
  Edit2,
  Eye,
  Filter,
  History,
  Image as ImageIcon,
  MapPin,
  MessagesSquare,
  Plus,
  RotateCcw,
  Search,
  ShieldAlert,
  Star,
  Tag,
  Trash2,
  User,
  XCircle,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  CITY_LABELS,
  ESTONIAN_CITIES,
  type EstonianCity,
  type ServiceRequestStatus,
} from "@monorepo/shared";

import { DataPagination } from "@/components/data-pagination";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  RowActionsItem,
  RowActionsMenu,
  RowActionsSeparator,
} from "@/components/ui/row-actions-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
import { TableSkeleton } from "@/components/ui/table-skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useListParams } from "@/hooks/use-list-params";
import {
  useApproveRequest,
  useCategories,
  useCreateRequest,
  useDeleteRequest,
  useRejectRequest,
  useRequestDetails,
  useRequests,
  useUpdateRequest,
} from "@/lib/api/marketplace";
import { useUsers } from "@/lib/api/users";
import { resolveMediaUrl } from "@/lib/media-url";

const CITIES = ESTONIAN_CITIES.map((value) => ({
  value,
  label: CITY_LABELS[value],
}));

function resolveCityEnum(city: string | null | undefined): EstonianCity {
  if (!city) return "TALLINN";
  if ((ESTONIAN_CITIES as readonly string[]).includes(city)) {
    return city as EstonianCity;
  }
  const byLabel = (Object.entries(CITY_LABELS) as [EstonianCity, string][]).find(
    ([, label]) => label.toLowerCase() === city.toLowerCase(),
  );
  return byLabel?.[0] ?? "TALLINN";
}

function cityLabel(city: string) {
  return CITY_LABELS[city as EstonianCity] ?? city;
}

const STATUSES: { value: ServiceRequestStatus; label: string }[] = [
  { value: "PENDING_REVIEW", label: "Pending Review" },
  { value: "OPEN", label: "Open" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled / Rejected" },
];

const createRequestSchema = z.object({
  ownerId: z.string().min(1, "Please select an owner user"),
  categoryId: z.string().min(1, "Please select a category"),
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  city: z.enum(["TALLINN", "TARTU", "PARNU", "NARVA"]),
  location: z.string().min(2, "Street address/location is required"),
  budgetEuros: z.string().optional(),
  pricingMode: z.enum(["PROVIDER_OFFERS", "OWNER_FIXED_PRICE"]),
  status: z.enum(["PENDING_REVIEW", "OPEN", "IN_PROGRESS", "COMPLETED", "CANCELLED"]),
  isPremium: z.boolean(),
  scheduledAt: z.string().optional(),
});

type CreateRequestFormValues = z.infer<typeof createRequestSchema>;

const editRequestSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  categoryId: z.string().min(1, "Category is required"),
  city: z.enum(["TALLINN", "TARTU", "PARNU", "NARVA"]),
  location: z.string().min(2, "Location is required"),
  budgetEuros: z.string().optional(),
  pricingMode: z.enum(["PROVIDER_OFFERS", "OWNER_FIXED_PRICE"]),
  status: z.enum(["PENDING_REVIEW", "OPEN", "IN_PROGRESS", "COMPLETED", "CANCELLED"]),
  isPremium: z.boolean(),
  scheduledAt: z.string().optional(),
});

type EditRequestFormValues = z.infer<typeof editRequestSchema>;

const approveSchema = z.object({
  note: z.string().optional(),
});

type ApproveFormValues = z.infer<typeof approveSchema>;

const rejectSchema = z.object({
  reason: z.string().min(3, "Please provide a rejection reason"),
});

type RejectFormValues = z.infer<typeof rejectSchema>;

export function RequestsPageClient() {
  const { search, filters, query, setSearch, setFilter, setPage, setLimit } =
    useListParams<{
      status?: string;
      city?: string;
      categoryId?: string;
      isPremium?: string;
      sortBy?: string;
    }>({});

  const requestsQuery = {
    ...query,
    status: filters.status,
    city: filters.city,
    categoryId: filters.categoryId,
    isPremium: filters.isPremium === "true" ? true : filters.isPremium === "false" ? false : undefined,
    sortBy: filters.sortBy ?? "createdAt",
  };

  const { data, isLoading, error } = useRequests(requestsQuery);
  const categoriesQuery = useCategories();
  const usersQuery = useUsers({ limit: 100 });

  const createRequest = useCreateRequest();
  const updateRequest = useUpdateRequest();
  const approveRequest = useApproveRequest();
  const rejectRequest = useRejectRequest();
  const deleteRequest = useDeleteRequest();

  // Dialog States
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [detailId, setDetailId] = React.useState<string | null>(null);
  const { data: requestDetail, isLoading: isDetailLoading } = useRequestDetails(detailId);

  const [editingRequest, setEditingRequest] = React.useState<any | null>(null);
  const [approveTarget, setApproveTarget] = React.useState<{ id: string; title: string } | null>(null);
  const [rejectTarget, setRejectTarget] = React.useState<{ id: string; title: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<{ id: string; title: string } | null>(null);

  // Forms
  const createForm = useForm<CreateRequestFormValues>({
    resolver: zodResolver(createRequestSchema),
    defaultValues: {
      ownerId: "",
      categoryId: "",
      title: "",
      description: "",
      city: "TALLINN",
      location: "",
      budgetEuros: "",
      pricingMode: "PROVIDER_OFFERS",
      status: "OPEN",
      isPremium: false,
      scheduledAt: "",
    },
  });

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

  const approveForm = useForm<ApproveFormValues>({
    resolver: zodResolver(approveSchema),
    defaultValues: { note: "" },
  });

  const rejectForm = useForm<RejectFormValues>({
    resolver: zodResolver(rejectSchema),
    defaultValues: { reason: "" },
  });

  // Load edit values
  React.useEffect(() => {
    if (editingRequest) {
      editForm.reset({
        title: editingRequest.title,
        description: editingRequest.description ?? "",
        categoryId: editingRequest.categoryId ?? "",
        city: resolveCityEnum(editingRequest.city),
        location: editingRequest.location ?? "",
        budgetEuros: editingRequest.budgetCents ? (editingRequest.budgetCents / 100).toString() : "",
        pricingMode: editingRequest.pricingMode ?? "PROVIDER_OFFERS",
        status: editingRequest.status ?? "OPEN",
        isPremium: editingRequest.isPremium ?? false,
        scheduledAt: editingRequest.scheduledAt ? editingRequest.scheduledAt.slice(0, 16) : "",
      });
    }
  }, [editingRequest, editForm]);

  const handleCreateSubmit = async (values: CreateRequestFormValues) => {
    const budgetCents = values.budgetEuros ? Math.round(parseFloat(values.budgetEuros) * 100) : undefined;
    await createRequest.mutateAsync({
      ownerId: values.ownerId,
      categoryId: values.categoryId,
      title: values.title,
      description: values.description,
      city: values.city,
      location: values.location,
      budgetCents,
      budgetLabel: budgetCents ? `€${(budgetCents / 100).toFixed(2)}` : undefined,
      pricingMode: values.pricingMode,
      status: values.status as ServiceRequestStatus,
      isPremium: values.isPremium,
      scheduledAt: values.scheduledAt ? new Date(values.scheduledAt).toISOString() : undefined,
    });
    setIsCreateOpen(false);
    createForm.reset();
  };

  const handleEditSubmit = async (values: EditRequestFormValues) => {
    if (!editingRequest) return;
    const budgetCents = values.budgetEuros ? Math.round(parseFloat(values.budgetEuros) * 100) : undefined;
    await updateRequest.mutateAsync({
      id: editingRequest.id,
      title: values.title,
      description: values.description,
      categoryId: values.categoryId,
      city: values.city,
      location: values.location,
      budgetCents,
      budgetLabel: budgetCents ? `€${(budgetCents / 100).toFixed(2)}` : undefined,
      pricingMode: values.pricingMode,
      status: values.status as ServiceRequestStatus,
      isPremium: values.isPremium,
      scheduledAt: values.scheduledAt ? new Date(values.scheduledAt).toISOString() : undefined,
    });
    setEditingRequest(null);
  };

  const handleApproveConfirm = async (values: ApproveFormValues) => {
    if (!approveTarget) return;
    await approveRequest.mutateAsync({ id: approveTarget.id, note: values.note });
    setApproveTarget(null);
    approveForm.reset();
  };

  const handleRejectConfirm = async (values: RejectFormValues) => {
    if (!rejectTarget) return;
    await rejectRequest.mutateAsync({ id: rejectTarget.id, reason: values.reason });
    setRejectTarget(null);
    rejectForm.reset();
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    await deleteRequest.mutateAsync(deleteTarget.id);
    setDeleteTarget(null);
  };

  const categories = categoriesQuery.data ?? [];
  const users = usersQuery.data?.items ?? [];

  if (isLoading) {
    return (
      <div className="px-4 lg:px-6">
        <TableSkeleton rows={8} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 lg:px-6">
        <EmptyState
          icon={AlertTriangle}
          title="Could not load requests"
          description={error instanceof Error ? error.message : "Unknown error"}
        />
      </div>
    );
  }

  const items = data?.items ?? [];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Requests"
        description="Service requests across the marketplace"
        actions={
          <Button onClick={() => setIsCreateOpen(true)} className="gap-2">
            <Plus className="size-4" />
            Create Request
          </Button>
        }
      />

      {/* Filters & Search Toolbar */}
      <div className="flex flex-col gap-3 px-4 lg:px-6 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative min-w-64 flex-1">
          <Search className="text-muted-foreground absolute left-3 top-2.5 size-4" />
          <Input
            placeholder="Search title, description, location, owner…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="pl-9"
          />
        </div>

        {/* Status Filter */}
        <Select
          value={filters.status ?? "all"}
          onValueChange={(val) => setFilter("status", val === "all" ? undefined : val)}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* City Filter */}
        <Select
          value={filters.city ?? "all"}
          onValueChange={(val) => setFilter("city", val === "all" ? undefined : val)}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="City" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Cities</SelectItem>
            {CITIES.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Category Filter */}
        <Select
          value={filters.categoryId ?? "all"}
          onValueChange={(val) => setFilter("categoryId", val === "all" ? undefined : val)}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                {cat.symbol} {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Premium Filter */}
        <Select
          value={filters.isPremium ?? "all"}
          onValueChange={(val) => setFilter("isPremium", val === "all" ? undefined : val)}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Listing Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Listings</SelectItem>
            <SelectItem value="true">Premium Only</SelectItem>
            <SelectItem value="false">Regular Only</SelectItem>
          </SelectContent>
        </Select>

        {/* Sort Field Filter */}
        <Select
          value={filters.sortBy ?? "createdAt"}
          onValueChange={(val) => setFilter("sortBy", val)}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Sort By" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="createdAt">Date Created</SelectItem>
            <SelectItem value="title">Title</SelectItem>
            <SelectItem value="viewCount">Views</SelectItem>
            <SelectItem value="budgetCents">Budget</SelectItem>
          </SelectContent>
        </Select>

        {(search || filters.status || filters.city || filters.categoryId || filters.isPremium || filters.sortBy) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch("");
              setFilter("status", undefined);
              setFilter("city", undefined);
              setFilter("categoryId", undefined);
              setFilter("isPremium", undefined);
              setFilter("sortBy", undefined);
            }}
            className="gap-1 text-xs"
          >
            <RotateCcw className="size-3.5" /> Reset
          </Button>
        )}
      </div>

      {/* Table Content */}
      {items.length === 0 ? (
        <div className="px-4 lg:px-6">
          <EmptyState
            icon={ClipboardList}
            title="No service requests found"
            description="No requests match your current search and filter criteria."
          />
        </div>
      ) : (
        <div className="px-4 lg:px-6">
          <div className="overflow-hidden rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title & Type</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Budget</TableHead>
                  <TableHead className="text-center">Offers</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-12 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((request) => (
                  <TableRow key={request.id} className="hover:bg-muted/50">
                    <TableCell className="max-w-64 font-medium">
                      <div className="flex flex-col gap-1">
                        <span
                          className="hover:text-primary cursor-pointer truncate font-semibold"
                          onClick={() => setDetailId(request.id)}
                        >
                          {request.title}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {request.isPremium ? (
                            <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px]">
                              ★ Premium
                            </Badge>
                          ) : null}
                          <span className="text-muted-foreground text-[11px] font-normal">
                            {request.viewCount} views
                          </span>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell className="whitespace-nowrap text-sm">
                      <span className="mr-1">{request.categorySymbol}</span>
                      {request.categoryName}
                    </TableCell>

                    <TableCell className="whitespace-nowrap text-sm">
                      <div className="flex items-center gap-1 text-xs">
                        <MapPin className="text-muted-foreground size-3" />
                        <span>{cityLabel(request.city)}</span>
                      </div>
                    </TableCell>

                    <TableCell className="whitespace-nowrap">
                      <StatusBadge status={request.status} />
                    </TableCell>

                    <TableCell className="whitespace-nowrap text-sm">
                      <div className="flex items-center gap-2">
                        <Avatar className="size-6">
                          <AvatarImage src={resolveMediaUrl(request.requester.avatarUrl)} />
                          <AvatarFallback className="text-[10px]">
                            {request.requester.profileName.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span>{request.requester.profileName}</span>
                      </div>
                    </TableCell>

                    <TableCell className="whitespace-nowrap tabular-nums text-sm font-medium">
                      {request.budget ?? "Flexible"}
                    </TableCell>

                    <TableCell className="text-center whitespace-nowrap tabular-nums text-sm">
                      <Badge variant="outline">{request.offerCount}</Badge>
                    </TableCell>

                    <TableCell className="text-muted-foreground whitespace-nowrap text-xs">
                      {formatDistanceToNow(new Date(request.createdAt), { addSuffix: true })}
                    </TableCell>

                    <TableCell className="text-right whitespace-nowrap">
                      <RowActionsMenu label={`Actions for ${request.title}`}>
                        <RowActionsItem onClick={() => setDetailId(request.id)}>
                          <Eye />
                          View details
                        </RowActionsItem>
                        {(request.status === "PENDING_REVIEW" ||
                          request.status === "CANCELLED") && (
                          <RowActionsItem
                            onClick={() =>
                              setApproveTarget({
                                id: request.id,
                                title: request.title,
                              })
                            }
                          >
                            <CheckCircle2 className="text-emerald-600 dark:text-emerald-400" />
                            Approve
                          </RowActionsItem>
                        )}
                        {request.status !== "CANCELLED" &&
                          request.status !== "COMPLETED" && (
                            <RowActionsItem
                              onClick={() =>
                                setRejectTarget({
                                  id: request.id,
                                  title: request.title,
                                })
                              }
                            >
                              <XCircle className="text-amber-600 dark:text-amber-400" />
                              Reject
                            </RowActionsItem>
                          )}
                        <RowActionsSeparator />
                        <RowActionsItem
                          onClick={() => setEditingRequest(request)}
                        >
                          <Edit2 />
                          Edit
                        </RowActionsItem>
                        <RowActionsItem
                          variant="destructive"
                          onClick={() =>
                            setDeleteTarget({
                              id: request.id,
                              title: request.title,
                            })
                          }
                        >
                          <Trash2 />
                          Delete
                        </RowActionsItem>
                      </RowActionsMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {data?.meta ? (
        <div className="px-4 lg:px-6">
          <DataPagination
            pagination={data.meta}
            onPageChange={setPage}
            onLimitChange={setLimit}
          />
        </div>
      ) : null}

      {/* CREATE REQUEST MODAL */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Create New Service Request</DialogTitle>
            <DialogDescription>
              Post a service request directly as an administrator on behalf of a user.
            </DialogDescription>
          </DialogHeader>

          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit(handleCreateSubmit)} className="space-y-4 pt-2">
              <FormField
                control={createForm.control}
                name="ownerId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Request Creator / Owner</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select user owner" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="max-h-60">
                        {users.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.displayName} ({u.email})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={createForm.control}
                  name="categoryId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select category" />
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
                  control={createForm.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select city" />
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
                control={createForm.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Deep cleaning for 3-bedroom apartment" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={createForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Detailed description of work required, tools needed, timeframe..."
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={createForm.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address / Specific Location</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Viru Keskus 4, Tallinn" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={createForm.control}
                  name="budgetEuros"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Budget (€ EUR)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" placeholder="e.g. 75.00" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={createForm.control}
                  name="pricingMode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pricing Mode</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Pricing mode" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="PROVIDER_OFFERS">Provider Offers (Bidding)</SelectItem>
                          <SelectItem value="OWNER_FIXED_PRICE">Fixed Price</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={createForm.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {STATUSES.map((s) => (
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

                <FormField
                  control={createForm.control}
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
              </div>

              <FormField
                control={createForm.control}
                name="isPremium"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>Premium Featured Listing</FormLabel>
                      <FormDescription>
                        Give this request boosted placement on platform
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createRequest.isPending}>
                  Create Request
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* EDIT REQUEST MODAL */}
      <Dialog open={Boolean(editingRequest)} onOpenChange={(open) => !open && setEditingRequest(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Edit Service Request</DialogTitle>
            <DialogDescription>
              Modify details, category, location, pricing, and moderation status for &quot;{editingRequest?.title}&quot;.
            </DialogDescription>
          </DialogHeader>

          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(handleEditSubmit)} className="space-y-4 pt-2">
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
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="w-full">
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
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="w-full">
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
                        <Input type="number" step="0.01" placeholder="e.g. 100.00" {...field} />
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
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {STATUSES.map((s) => (
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

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={editForm.control}
                  name="pricingMode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pricing Mode</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Pricing mode" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="PROVIDER_OFFERS">Provider Offers (Bidding)</SelectItem>
                          <SelectItem value="OWNER_FIXED_PRICE">Fixed Price</SelectItem>
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
              </div>

              <FormField
                control={editForm.control}
                name="isPremium"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>Premium Listing</FormLabel>
                      <FormDescription>Featured placement on main feeds</FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={() => setEditingRequest(null)}>
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

      {/* APPROVE DIALOG */}
      <Dialog open={Boolean(approveTarget)} onOpenChange={(open) => !open && setApproveTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="size-5" />
              Approve Request
            </DialogTitle>
            <DialogDescription>
              Confirm approval for &quot;{approveTarget?.title}&quot;. This will publish the request as OPEN and notify the owner.
            </DialogDescription>
          </DialogHeader>

          <Form {...approveForm}>
            <form onSubmit={approveForm.handleSubmit(handleApproveConfirm)} className="space-y-4 pt-2">
              <FormField
                control={approveForm.control}
                name="note"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Approval Note (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Add a note to be logged in the audit trail and sent to the owner..."
                        rows={2}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setApproveTarget(null)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={approveRequest.isPending}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  Approve Request
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* REJECT DIALOG */}
      <Dialog open={Boolean(rejectTarget)} onOpenChange={(open) => !open && setRejectTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <XCircle className="size-5" />
              Reject Service Request
            </DialogTitle>
            <DialogDescription>
              Rejecting &quot;{rejectTarget?.title}&quot; will hide it from the public feed and show your rejection reason to the request owner.
            </DialogDescription>
          </DialogHeader>

          <Form {...rejectForm}>
            <form onSubmit={rejectForm.handleSubmit(handleRejectConfirm)} className="space-y-4 pt-2">
              <FormField
                control={rejectForm.control}
                name="reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rejection Reason *</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="State why this post is rejected (e.g. violating guidelines, incomplete details)..."
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setRejectTarget(null)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={rejectRequest.isPending}
                  variant="destructive"
                >
                  Reject Post
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* DELETE CONFIRMATION DIALOG */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Service Request"
        description={`Are you sure you want to permanently delete "${deleteTarget?.title}"? All associated offers, photos, and messages will be removed. This action cannot be undone.`}
        confirmText="Delete Permanently"
        isLoading={deleteRequest.isPending}
        onConfirm={handleDeleteConfirm}
      />

      {/* FULL REQUEST DETAILS SHEET */}
      <Sheet open={Boolean(detailId)} onOpenChange={(open) => !open && setDetailId(null)}>
        <SheetContent className="w-full max-w-3xl overflow-y-auto p-6 sm:max-w-2xl">
          {isDetailLoading ? (
            <div className="flex h-96 items-center justify-center">
              <TableSkeleton rows={6} />
            </div>
          ) : !requestDetail ? (
            <EmptyState
              icon={AlertTriangle}
              title="Request details not found"
              description="Could not load request detail data."
            />
          ) : (
            <div className="space-y-6">
              {/* Sheet Header */}
              <SheetHeader className="p-0 pr-6">
                <div className="flex items-center gap-2">
                  <StatusBadge status={requestDetail.status} />
                  {requestDetail.isPremium && (
                    <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-xs">
                      ★ Premium
                    </Badge>
                  )}
                  <span className="text-muted-foreground text-xs font-mono ml-auto">
                    ID: {requestDetail.id}
                  </span>
                </div>
                <SheetTitle className="text-xl font-bold pt-1">{requestDetail.title}</SheetTitle>
                <SheetDescription className="flex items-center gap-4 text-xs">
                  <span className="flex items-center gap-1">
                    <Tag className="size-3.5" /> {requestDetail.categorySymbol} {requestDetail.categoryName}
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin className="size-3.5" /> {cityLabel(requestDetail.city)} — {requestDetail.location}
                  </span>
                </SheetDescription>
              </SheetHeader>

              {/* Action Toolbar */}
              <div className="flex flex-wrap items-center gap-2 rounded-lg border p-2 bg-muted/30">
                {(requestDetail.status === "PENDING_REVIEW" ||
                  requestDetail.status === "CANCELLED") && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-emerald-600 border-emerald-600/30 hover:bg-emerald-50 dark:hover:bg-emerald-950"
                    onClick={() =>
                      setApproveTarget({ id: requestDetail.id, title: requestDetail.title })
                    }
                  >
                    <CheckCircle2 className="size-4" /> Approve
                  </Button>
                )}

                {requestDetail.status !== "CANCELLED" &&
                  requestDetail.status !== "COMPLETED" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-amber-600 border-amber-600/30 hover:bg-amber-50 dark:hover:bg-amber-950"
                    onClick={() =>
                      setRejectTarget({ id: requestDetail.id, title: requestDetail.title })
                    }
                  >
                    <XCircle className="size-4" /> Reject
                  </Button>
                )}

                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => setEditingRequest(requestDetail)}
                >
                  <Edit2 className="size-4" /> Edit
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-destructive border-destructive/30"
                  onClick={() =>
                    setDeleteTarget({ id: requestDetail.id, title: requestDetail.title })
                  }
                >
                  <Trash2 className="size-4" /> Delete
                </Button>

                <Button
                  size="sm"
                  variant="ghost"
                  asChild
                  className="ml-auto gap-1 text-xs"
                >
                  <Link href={`/conversations?search=${encodeURIComponent(requestDetail.title)}`}>
                    <MessagesSquare className="size-3.5 text-primary" /> View Messages
                  </Link>
                </Button>
              </div>

              {/* Tabbed Content */}
              <Tabs defaultValue="overview" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="owner">Creator</TabsTrigger>
                  <TabsTrigger value="audit">Audit & History</TabsTrigger>
                  <TabsTrigger value="offers">
                    Offers ({requestDetail.offers.length})
                  </TabsTrigger>
                </TabsList>

                {/* OVERVIEW TAB */}
                <TabsContent value="overview" className="space-y-4 pt-3">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-semibold">Description</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
                      {requestDetail.description}
                    </CardContent>
                  </Card>

                  {requestDetail.rejectionReason ? (
                    <Card className="border-amber-500/30 bg-amber-500/5">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                          Rejection Reason
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="text-sm leading-relaxed">
                        {requestDetail.rejectionReason}
                      </CardContent>
                    </Card>
                  ) : null}

                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <div className="rounded-lg border p-3 space-y-1">
                      <span className="text-muted-foreground text-xs flex items-center gap-1">
                        <DollarSign className="size-3.5" /> Budget
                      </span>
                      <p className="font-semibold text-sm">{requestDetail.budget ?? "Flexible"}</p>
                    </div>

                    <div className="rounded-lg border p-3 space-y-1">
                      <span className="text-muted-foreground text-xs flex items-center gap-1">
                        <Tag className="size-3.5" /> Pricing Mode
                      </span>
                      <p className="font-medium text-xs">
                        {requestDetail.pricingMode === "PROVIDER_OFFERS"
                          ? "Provider Offers"
                          : "Owner Fixed Price"}
                      </p>
                    </div>

                    <div className="rounded-lg border p-3 space-y-1">
                      <span className="text-muted-foreground text-xs flex items-center gap-1">
                        <Calendar className="size-3.5" /> Created Date
                      </span>
                      <p className="font-medium text-xs">
                        {format(new Date(requestDetail.createdAt), "PPP p")}
                      </p>
                    </div>

                    {requestDetail.scheduledAt && (
                      <div className="rounded-lg border p-3 space-y-1">
                        <span className="text-muted-foreground text-xs flex items-center gap-1">
                          <Calendar className="size-3.5" /> Scheduled For
                        </span>
                        <p className="font-medium text-xs">
                          {format(new Date(requestDetail.scheduledAt), "PPP p")}
                        </p>
                      </div>
                    )}

                    {requestDetail.completedAt && (
                      <div className="rounded-lg border p-3 space-y-1">
                        <span className="text-muted-foreground text-xs flex items-center gap-1 text-emerald-600">
                          <CheckCircle2 className="size-3.5" /> Completed At
                        </span>
                        <p className="font-medium text-xs">
                          {format(new Date(requestDetail.completedAt), "PPP p")}
                        </p>
                      </div>
                    )}

                    {requestDetail.cancelledAt && (
                      <div className="rounded-lg border p-3 space-y-1">
                        <span className="text-muted-foreground text-xs flex items-center gap-1 text-amber-600">
                          <XCircle className="size-3.5" /> Cancelled At
                        </span>
                        <p className="font-medium text-xs">
                          {format(new Date(requestDetail.cancelledAt), "PPP p")}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Photos */}
                  {requestDetail.photos.length > 0 && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                          <ImageIcon className="size-4" /> Attached Photos
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-wrap gap-2">
                          {requestDetail.photos.map((photo) => {
                            const src = resolveMediaUrl(photo.url) ?? photo.url;
                            return (
                              <a
                                key={photo.id}
                                href={src}
                                target="_blank"
                                rel="noreferrer"
                                className="group relative overflow-hidden rounded-md border size-20"
                              >
                                <img
                                  src={src}
                                  alt="Request photo"
                                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                                />
                              </a>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                {/* OWNER TAB */}
                <TabsContent value="owner" className="pt-3">
                  <Card>
                    <CardHeader>
                      <div className="flex items-center gap-3">
                        <Avatar className="size-12">
                          <AvatarImage src={resolveMediaUrl(requestDetail.owner.avatarUrl)} />
                          <AvatarFallback>
                            {requestDetail.owner.profileName.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <CardTitle className="text-base">
                            <Link
                              href={`/users/${requestDetail.owner.id}`}
                              className="hover:underline hover:text-primary transition-colors"
                            >
                              {requestDetail.owner.displayName}
                            </Link>
                          </CardTitle>
                          <CardDescription className="text-xs">
                            {requestDetail.owner.email} • Role: {requestDetail.owner.role}
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
                        <div>
                          <span className="text-muted-foreground">User ID</span>
                          <p className="font-mono">{requestDetail.owner.id}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Rating</span>
                          <p className="flex items-center gap-1 font-medium">
                            <Star className="size-3.5 fill-amber-400 text-amber-400" />
                            {requestDetail.owner.rating.toFixed(1)} ({requestDetail.owner.reviewCount} reviews)
                          </p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Business Name</span>
                          <p className="font-medium">{requestDetail.owner.businessName ?? "N/A"}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Joined</span>
                          <p className="font-medium">
                            {format(new Date(requestDetail.owner.createdAt), "PPP")}
                          </p>
                        </div>
                      </div>

                      <div className="pt-2">
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/users/${requestDetail.owner.id}`}>
                            <User className="size-3.5 mr-1.5" /> View User Profile
                          </Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* AUDIT & HISTORY TAB */}
                <TabsContent value="audit" className="space-y-4 pt-3">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                        <ShieldAlert className="size-4 text-primary" /> Admin Audit Trail
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Administrative actions logged for security and accountability.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {requestDetail.auditLogs.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic py-2">
                          No administrative actions recorded yet.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {requestDetail.auditLogs.map((log) => (
                            <div key={log.id} className="rounded-md border p-2.5 text-xs space-y-1 bg-muted/20">
                              <div className="flex items-center justify-between">
                                <Badge variant="outline" className="font-mono text-[10px]">
                                  {log.action}
                                </Badge>
                                <span className="text-muted-foreground text-[11px]">
                                  {format(new Date(log.createdAt), "PPP p")}
                                </span>
                              </div>
                              <p className="text-muted-foreground">
                                By <span className="font-medium text-foreground">{log.actorName}</span>
                                {log.actorEmail ? ` (${log.actorEmail})` : null}
                              </p>
                              {log.details && Object.keys(log.details).length > 0 && (
                                <pre className="mt-1 rounded bg-muted p-1.5 font-mono text-[10px] overflow-x-auto">
                                  {JSON.stringify(log.details, null, 2)}
                                </pre>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Job Progress Events */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                        <History className="size-4" /> Job Progress Events
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {requestDetail.progressEvents.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic py-2">
                          No provider job events logged yet.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {requestDetail.progressEvents.map((evt) => (
                            <div key={evt.id} className="flex items-center justify-between rounded border p-2 text-xs">
                              <Badge variant="secondary">{evt.status}</Badge>
                              <span className="text-muted-foreground">
                                {format(new Date(evt.createdAt), "PPP p")}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* OFFERS TAB */}
                <TabsContent value="offers" className="pt-3">
                  {requestDetail.offers.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic py-4 text-center">
                      No offers submitted for this request yet.
                    </p>
                  ) : (
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Offerer</TableHead>
                            <TableHead>Price</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Message</TableHead>
                            <TableHead>Date</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {requestDetail.offers.map((offer) => (
                            <TableRow key={offer.id}>
                              <TableCell className="font-medium text-xs">
                                {offer.offerer.profileName}
                              </TableCell>
                              <TableCell className="tabular-nums text-xs">
                                {offer.priceCents ? `€${(offer.priceCents / 100).toFixed(2)}` : "Flexible"}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-[10px]">
                                  {offer.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="max-w-44 truncate text-xs text-muted-foreground">
                                {offer.message ?? "No message"}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                {format(new Date(offer.createdAt), "PP")}
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
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
