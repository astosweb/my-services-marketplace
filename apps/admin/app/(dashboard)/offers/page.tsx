import type { Metadata } from "next";
import { OffersPageClient } from "./offers-page-client";

export const metadata: Metadata = {
  title: "Offers",
  description: "Moderate marketplace offers",
};

export default function Page() {
  return (
    <>
      <div className="px-4 lg:px-6">
        <h1 className="text-2xl font-bold tracking-tight">Offers</h1>
        <p className="text-muted-foreground">Provider bids on service requests</p>
      </div>
      <OffersPageClient />
    </>
  );
}
