"use client";

import { format, formatDistanceToNow } from "date-fns";
import {
  AlertTriangle,
  ArrowLeft,
  Briefcase,
  FileText,
  HandCoins,
  Mail,
  Star,
  User,
} from "lucide-react";
import Link from "next/link";

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
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
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
import { useUser } from "@/lib/api/users";

function formatPrice(cents: number | null) {
  if (cents == null) return "—";
  return `€${(cents / 100).toFixed(0)}`;
}

export function UserDetailPageClient({ userId }: { userId: string }) {
  const { data: user, isLoading, error } = useUser(userId);

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
          <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2 gap-1.5">
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
              error instanceof Error ? error.message : "This user does not exist or was deleted."
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
                <span className="font-medium">
                  {user.rating.toFixed(1)}
                </span>
                <span className="text-muted-foreground text-xs">
                  ({user.reviewCount} reviews)
                </span>
              </div>
              <div className="pt-2 border-t space-y-2 text-xs">
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Display name</span>
                  <span className="font-medium text-right">{user.displayName}</span>
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
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{user.bio}</p>
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
                          <StatusBadge status={offer.status} />
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[240px] truncate">
                          {offer.message ?? "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                          {formatDistanceToNow(new Date(offer.createdAt), {
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
    </div>
  );
}
