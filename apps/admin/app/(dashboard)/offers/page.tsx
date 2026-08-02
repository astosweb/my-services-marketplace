import type { Metadata } from "next";
import { OffersPageClient } from "./offers-page-client";

export const metadata: Metadata = {
  title: "Offers",
  description: "Moderate marketplace offers",
};

export default function Page() {
  return <OffersPageClient />;
}
