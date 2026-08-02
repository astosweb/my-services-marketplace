"use client";

import { formatDistanceToNow } from "date-fns";
import { AlertTriangle, Trash2 } from "lucide-react";
import type { OfferStatus } from "@monorepo/shared";
import { DataPagination } from "@/components/data-pagination";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  const { filters, query, setFilter, setPage, setLimit } = useListParams<{
    status?: string;
  }>({});
  const { data, isLoading, error } = useOffers(query);
  const updateOffer = useUpdateOffer();
  const deleteOffer = useDeleteOffer();

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
    <div className="flex flex-col gap-4 px-4 lg:px-6">
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

      {items.length === 0 ? (
        <EmptyState title="No offers" description="Nothing to show yet." />
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Request</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-28" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((offer) => (
                <TableRow key={offer.id}>
                  <TableCell className="max-w-56 truncate font-medium">
                    {offer.request?.title ?? offer.requestId}
                  </TableCell>
                  <TableCell>{offer.offerer.profileName}</TableCell>
                  <TableCell>{formatEuro(offer.priceCents)}</TableCell>
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
                      <SelectTrigger className="h-8 w-36">
                        <SelectValue />
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
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Delete offer"
                      onClick={() => {
                        if (window.confirm("Delete this offer?")) {
                          void deleteOffer.mutateAsync(offer.id);
                        }
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {data?.meta ? (
        <DataPagination
          pagination={data.meta}
          onPageChange={setPage}
          onLimitChange={setLimit}
        />
      ) : null}
    </div>
  );
}
