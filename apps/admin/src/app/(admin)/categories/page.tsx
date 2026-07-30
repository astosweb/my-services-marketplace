"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiFetch, ApiError } from "@/lib/api";
import type { AdminCategory } from "@/lib/types";

export default function CategoriesPage() {
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await apiFetch<{ data: AdminCategory[] }>("/admin/categories");
      setCategories(response.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load categories");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      await apiFetch("/admin/categories", {
        method: "POST",
        body: JSON.stringify({ id, name, symbol }),
      });
      setId("");
      setName("");
      setSymbol("");
      setMessage("Category created");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  async function saveCategory(category: AdminCategory) {
    setBusy(true);
    setMessage(null);
    try {
      await apiFetch(`/admin/categories/${category.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: category.name, symbol: category.symbol }),
      });
      setMessage("Category updated");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove(category: AdminCategory) {
    if (!window.confirm(`Delete category ${category.name}?`)) return;
    setBusy(true);
    try {
      await apiFetch(`/admin/categories/${category.id}`, { method: "DELETE" });
      setMessage("Category deleted");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Categories</h1>
        <p className="text-sm text-zinc-500">Manage service category catalog used by the iOS app.</p>
      </div>

      {message ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Add category</CardTitle>
          <CardDescription>Id becomes the stable key (lowercase_snake).</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 md:grid-cols-4" onSubmit={onCreate}>
            <Input placeholder="id" value={id} onChange={(event) => setId(event.target.value)} required />
            <Input placeholder="Name" value={name} onChange={(event) => setName(event.target.value)} required />
            <Input
              placeholder="SF Symbol"
              value={symbol}
              onChange={(event) => setSymbol(event.target.value)}
              required
            />
            <Button type="submit" disabled={busy}>
              Create
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="rounded-xl border border-zinc-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Id</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Symbol</TableHead>
              <TableHead>Requests</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.map((category) => (
              <TableRow key={category.id}>
                <TableCell className="font-mono text-xs">{category.id}</TableCell>
                <TableCell>
                  <Input
                    value={category.name}
                    onChange={(event) =>
                      setCategories((current) =>
                        current.map((item) =>
                          item.id === category.id ? { ...item, name: event.target.value } : item,
                        ),
                      )
                    }
                  />
                </TableCell>
                <TableCell>
                  <Input
                    value={category.symbol}
                    onChange={(event) =>
                      setCategories((current) =>
                        current.map((item) =>
                          item.id === category.id ? { ...item, symbol: event.target.value } : item,
                        ),
                      )
                    }
                  />
                </TableCell>
                <TableCell className="tabular-nums">{category.requestCount}</TableCell>
                <TableCell className="space-x-2 text-right">
                  <Button variant="outline" size="sm" disabled={busy} onClick={() => void saveCategory(category)}>
                    Save
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={busy || category.requestCount > 0}
                    onClick={() => void remove(category)}
                  >
                    Delete
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
