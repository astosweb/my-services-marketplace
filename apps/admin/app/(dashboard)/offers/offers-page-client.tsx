"use client";

import * as React from "react";
import { formatDistanceToNow } from "date-fns";
import { AlertTriangle, Handshake, Trash2 } from "lucide-react";
import type { OfferStatus } from "@monorepo/shared";

import { DataPagination } from "@/components/data-pagination";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import {
  RowActionsItem,
  RowActionsMenu,
} from "@/components/ui/row-actions-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TableSkeleton } from "@/components/ui/table-skeleton";
import { useListParams } from "@/hooks/use-list-params";
import {
  useDeleteOffer,
  useOffers,
  useUpdateOffer,
} from "@/lib/api/marketplace";

const STATUSES: OfferStatus[] = ["PENDING", "ACCEPTED", "DECLINED", "WITHDRAWN"];

function formatEuro(cents: number | null) {
  return cents != null ? `€${(cents / 100).toFixed(0)}` : "—";
}

export function OffersPageClient() {
  const { search, filters, query, setSearch, setFilter, setPage, setLimit } =
    useListParams<{ status?: string }>({});
  const { data, isLoading, error } = useOffers(query);
  const updateOffer = useUpdateOffer();
  const deleteOffer = useDeleteOffer();

  const [deleteTargetId, setDeleteTargetId] = React.useState<string | null>(null);

  const handleDeleteConfirm = async () => {
    if (!deleteTargetId) return;
    await deleteOffer.mutateAsync(deleteTargetId);
    setDeleteTargetId(null);
  };

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
          title="Could not load offers"
          description={error instanceof Error ? error.message : "Unknown error"}
        />
      </div>
    );
  }

  const items = data?.items ?? [];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Offers"
        description="Provider bids on service requests"
      />

      <div className="flex flex-col gap-3 px-4 lg:px-6 sm:flex-row sm:items-center">
        <Input
          placeholder="Search by provider or request…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="max-w-sm"
        />
        <Select
          value={filters.status ?? "all"}
          onValueChange={(value) =>
            setFilter("status", value === "all" ? undefined : value)
          }
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {status}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {items.length === 0 ? (
        <div className="px-4 lg:px-6">
          <EmptyState
            icon={Handshake}
            title="No offers found"
            description="Nothing matches your current query."
          />
        </div>
      ) : (
        <div className="px-4 lg:px-6">
          <div className="overflow-hidden rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Request</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-12 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((offer) => (
                  <TableRow key={offer.id}>
                    <TableCell className="max-w-56 truncate font-medium">
                      {offer.request?.title ?? offer.requestId}
                    </TableCell>
                    <TableCell>{offer.offerer.profileName}</TableCell>
                    <TableCell className="font-semibold">
                      {formatEuro(offer.priceCents)}
                    </TableCell>
                    <TableCell>
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
                          {STATUSES.map((status) => (
                            <SelectItem key={status} value={status}>
                              {status}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDistanceToNow(new Date(offer.createdAt), {
                        addSuffix: true,
                      })}
                    </TableCell>
                    <TableCell className="text-right">
                      <RowActionsMenu label="Offer actions">
                        <RowActionsItem
                          variant="destructive"
                          onClick={() => setDeleteTargetId(offer.id)}
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

      <ConfirmDialog
        open={Boolean(deleteTargetId)}
        onOpenChange={(open) => !open && setDeleteTargetId(null)}
        title="Delete Offer"
        description="Are you sure you want to delete this offer? This cannot be undone."
        confirmText="Delete Offer"
        isLoading={deleteOffer.isPending}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
