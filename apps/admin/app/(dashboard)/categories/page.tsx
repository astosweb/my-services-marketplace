import type { Metadata } from "next";
import { CategoriesPageClient } from "./categories-page-client";

export const metadata: Metadata = {
  title: "Categories",
  description: "Service category catalog",
};

export default function Page() {
  return <CategoriesPageClient />;
}
