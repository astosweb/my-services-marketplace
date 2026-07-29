"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { RequestList } from "@/components/request-list";
import { demoRequests, listCategories, listRequests } from "@/lib/api";
import { ESTONIAN_CITIES, cityToApi } from "@/lib/format";
import type { Category, ServiceRequest } from "@/lib/types";

export default function ExplorePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const city = searchParams.get("city") ?? "TALLINN";
  const [categoryId, setCategoryId] = useState<string>("");
  const [query, setQuery] = useState("");
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fromDemo, setFromDemo] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [cats, listed] = await Promise.all([
          listCategories().catch(() => []),
          listRequests({ city, categoryId: categoryId || undefined, status: "OPEN", limit: 50 }),
        ]);
        if (cancelled) return;
        setCategories(cats);
        if (listed.requests.length === 0) {
          setRequests(demoRequests.filter((r) => cityToApi(r.city) === city));
          setFromDemo(true);
        } else {
          setRequests(listed.requests);
          setFromDemo(false);
        }
      } catch (err) {
        if (cancelled) return;
        setRequests(demoRequests.filter((r) => cityToApi(r.city) === city));
        setFromDemo(true);
        setError(err instanceof Error ? err.message : "Could not reach API");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [city, categoryId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return requests;
    return requests.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        r.categoryName.toLowerCase().includes(q) ||
        r.location.toLowerCase().includes(q),
    );
  }, [requests, query]);

  return (
    <>
      <SiteHeader />
      <main className="page-shell">
        <h1 className="page-title">Explore</h1>
        <p className="page-lede">Browse open service requests across Estonia and send an offer from the app.</p>

        <div className="filter-bar">
          <select
            className="select"
            value={city}
            onChange={(e) => router.replace(`/explore?city=${e.target.value}`)}
            aria-label="City"
          >
            {ESTONIAN_CITIES.map((c) => (
              <option key={c.api} value={c.api}>
                {c.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            className={`chip${categoryId === "" ? " chip--active" : ""}`}
            onClick={() => setCategoryId("")}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              className={`chip${categoryId === cat.id ? " chip--active" : ""}`}
              onClick={() => setCategoryId(cat.id)}
            >
              {cat.name}
            </button>
          ))}

          <input
            className="field"
            style={{ maxWidth: 260, borderRadius: 999 }}
            placeholder="Search requests"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search requests"
          />
        </div>

        {fromDemo ? (
          <p className="demo-note">
            {error ? `${error}. ` : ""}Showing sample requests until the API is connected.
          </p>
        ) : null}

        {loading ? <p className="empty-state">Loading requests…</p> : <RequestList requests={filtered} />}
      </main>
    </>
  );
}
