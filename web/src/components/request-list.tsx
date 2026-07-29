import Link from "next/link";
import type { ServiceRequest } from "@/lib/types";
import { categoryShort, relativeTime, statusLabel } from "@/lib/format";

export function RequestRow({
  request,
  index = 0,
}: {
  request: ServiceRequest;
  index?: number;
}) {
  const href = request.id.startsWith("demo_") ? "/explore" : `/requests/${request.id}`;

  return (
    <Link
      href={href}
      className="request-row"
      style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}
    >
      <div className="request-row__glyph" aria-hidden>
        {categoryShort(request.categoryName)}
      </div>
      <div className="request-row__body">
        <div className="request-row__meta">
          <span>{request.categoryName}</span>
          <span aria-hidden>·</span>
          <span>{request.location || request.city}</span>
          {request.isPremium ? <span className="request-row__boost">Boosted</span> : null}
        </div>
        <h3 className="request-row__title">{request.title}</h3>
        <p className="request-row__desc">{request.description}</p>
      </div>
      <div className="request-row__aside">
        <span className={`status-dot status-dot--${request.status.toLowerCase()}`}>
          {statusLabel(request.status)}
        </span>
        <strong className="request-row__budget">{request.budget ?? "Open offers"}</strong>
        <span className="request-row__stats">
          {request.offerCount} offers · {relativeTime(request.createdAt)}
        </span>
      </div>
    </Link>
  );
}

export function RequestList({
  requests,
  emptyLabel = "No open requests right now.",
}: {
  requests: ServiceRequest[];
  emptyLabel?: string;
}) {
  if (requests.length === 0) {
    return <p className="empty-state">{emptyLabel}</p>;
  }

  return (
    <ul className="request-list">
      {requests.map((request, index) => (
        <li key={request.id}>
          <RequestRow request={request} index={index} />
        </li>
      ))}
    </ul>
  );
}
