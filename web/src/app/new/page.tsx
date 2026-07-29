"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { useAuth } from "@/components/auth-provider";
import { ApiError, createRequest, listCategories } from "@/lib/api";
import { ESTONIAN_CITIES } from "@/lib/format";
import type { Category } from "@/lib/types";

export default function NewRequestPage() {
  const router = useRouter();
  const { accessToken, ready, user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [city, setCity] = useState("TALLINN");
  const [location, setLocation] = useState("Tallinn");
  const [budgetLabel, setBudgetLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    listCategories()
      .then((cats) => {
        setCategories(cats);
        if (cats[0]) setCategoryId(cats[0].id);
      })
      .catch(() => {
        setCategories([
          { id: "plumbing", name: "Plumbing", symbol: "drop.fill" },
          { id: "electrical", name: "Electrical", symbol: "bolt.fill" },
          { id: "cleaning", name: "Cleaning", symbol: "sparkles" },
          { id: "handyman", name: "Handyman", symbol: "screwdriver.fill" },
        ]);
        setCategoryId("plumbing");
      });
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!accessToken) {
      router.push("/login");
      return;
    }
    const selected = ESTONIAN_CITIES.find((c) => c.api === city) ?? ESTONIAN_CITIES[0];
    setPending(true);
    setError(null);
    try {
      const created = await createRequest(accessToken, {
        categoryId,
        title: title.trim(),
        description: description.trim(),
        city,
        latitude: selected.lat,
        longitude: selected.lng,
        location: location.trim() || selected.label,
        budgetLabel: budgetLabel.trim() || undefined,
        pricingMode: "PROVIDER_OFFERS",
      });
      router.push(`/requests/${created.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create request");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <SiteHeader />
      <main className="page-shell" style={{ maxWidth: 640 }}>
        <h1 className="page-title">Post a request</h1>
        <p className="page-lede">
          Describe what you need. Providers nearby will send offers — same flow as the iOS app.
        </p>

        {ready && !user ? (
          <p className="demo-note">
            You need an account to publish. <Link href="/login">Log in</Link> or{" "}
            <Link href="/register">sign up</Link>.
          </p>
        ) : null}

        <form className="form" onSubmit={onSubmit}>
          <label>
            Category
            <select
              className="select"
              style={{ width: "100%", borderRadius: 12 }}
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              required
            >
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Title
            <input
              className="field"
              required
              minLength={3}
              maxLength={200}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Fix leaking kitchen tap"
            />
          </label>
          <label>
            Description
            <textarea
              className="field field--area"
              required
              minLength={10}
              maxLength={5000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What needs doing, access notes, timing…"
            />
          </label>
          <label>
            City
            <select
              className="select"
              style={{ width: "100%", borderRadius: 12 }}
              value={city}
              onChange={(e) => {
                const next = e.target.value;
                setCity(next);
                const match = ESTONIAN_CITIES.find((c) => c.api === next);
                if (match) setLocation(match.label);
              }}
            >
              {ESTONIAN_CITIES.map((c) => (
                <option key={c.api} value={c.api}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Neighbourhood / address hint
            <input
              className="field"
              required
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </label>
          <label>
            Budget label (optional)
            <input
              className="field"
              value={budgetLabel}
              onChange={(e) => setBudgetLabel(e.target.value)}
              placeholder="€40–80"
            />
          </label>
          {error ? <p className="form-error">{error}</p> : null}
          <button className="btn btn--solid" type="submit" disabled={pending || !ready}>
            {pending ? "Publishing…" : user ? "Publish request" : "Log in to publish"}
          </button>
        </form>
      </main>
    </>
  );
}
