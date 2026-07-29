import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { demoRequests, getRequest } from "@/lib/api";
import { relativeTime, statusLabel } from "@/lib/format";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  try {
    const request = await getRequest(id);
    return { title: request.title };
  } catch {
    const demo = demoRequests.find((r) => r.id === id);
    return { title: demo?.title ?? "Request" };
  }
}

export default async function RequestDetailPage({ params }: Props) {
  const { id } = await params;
  let request = demoRequests.find((r) => r.id === id) ?? null;
  let fromDemo = Boolean(request);

  if (!id.startsWith("demo_")) {
    try {
      request = await getRequest(id);
      fromDemo = false;
    } catch {
      if (!request) notFound();
    }
  }

  if (!request) notFound();

  return (
    <>
      <SiteHeader />
      <main className="page-shell">
        <p style={{ marginBottom: "1rem" }}>
          <Link href="/explore" style={{ color: "var(--sea)", fontWeight: 600 }}>
            ← Back to explore
          </Link>
        </p>

        {fromDemo ? (
          <p className="demo-note">Sample request — connect the API for live details.</p>
        ) : null}

        <div className="detail-grid">
          <article>
            <div className="detail-kicker">
              <span>{request.categoryName}</span>
              <span aria-hidden>·</span>
              <span>{request.location || request.city}</span>
              <span aria-hidden>·</span>
              <span className={`status-dot status-dot--${request.status.toLowerCase()}`}>
                {statusLabel(request.status)}
              </span>
              {request.isPremium ? <span className="request-row__boost">Boosted</span> : null}
            </div>
            <h1 className="detail-title">{request.title}</h1>
            <p className="detail-desc">{request.description}</p>

            <div className="requester">
              <div className="avatar" aria-hidden>
                {request.requester.displayName.slice(0, 1)}
              </div>
              <div>
                <strong>{request.requester.displayName}</strong>
                <div style={{ color: "var(--ink-soft)", fontSize: "0.9rem" }}>
                  {request.requester.rating.toFixed(1)} · {request.requester.reviewCount} reviews
                </div>
              </div>
            </div>
          </article>

          <aside className="detail-panel">
            <div className="stat-stack">
              <div className="stat">
                <span>Budget</span>
                <strong>{request.budget ?? "Open offers"}</strong>
              </div>
              <div className="stat">
                <span>Offers</span>
                <strong>{request.offerCount}</strong>
              </div>
              <div className="stat">
                <span>Views</span>
                <strong>{request.viewCount}</strong>
              </div>
              <div className="stat">
                <span>Posted</span>
                <strong>{relativeTime(request.createdAt)}</strong>
              </div>
              <div className="stat">
                <span>Pricing</span>
                <strong>
                  {request.pricingMode === "OWNER_FIXED_PRICE" ? "Fixed price" : "Providers offer"}
                </strong>
              </div>
            </div>
            <div style={{ marginTop: "1.35rem", display: "grid", gap: "0.65rem" }}>
              <Link href="/register" className="btn btn--solid" style={{ width: "100%" }}>
                Sign up to offer help
              </Link>
              <Link href="/new" className="btn btn--outline" style={{ width: "100%" }}>
                Post your own request
              </Link>
            </div>
          </aside>
        </div>
      </main>
    </>
  );
}
