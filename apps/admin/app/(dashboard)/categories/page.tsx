import type { Metadata } from "next";
import { CategoriesPageClient } from "./categories-page-client";

export const metadata: Metadata = {
  title: "Categories",
  description: "Service category catalog",
};

export default function Page() {
  return (
    <>
      <div className="px-4 lg:px-6">
        <h1 className="text-2xl font-bold tracking-tight">Categories</h1>
        <p className="text-muted-foreground">Fixed marketplace category catalog</p>
      </div>
      <CategoriesPageClient />
    </>
  );
}
