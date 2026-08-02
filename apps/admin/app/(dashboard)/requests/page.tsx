import type { Metadata } from "next";
import { RequestsPageClient } from "./requests-page-client";

export const metadata: Metadata = {
  title: "Requests",
  description: "Moderate marketplace service requests",
};

export default function Page() {
  return (
    <>
      <div className="px-4 lg:px-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-tight">Requests</h1>
          <p className="text-muted-foreground">
            Service requests across the marketplace
          </p>
        </div>
      </div>
      <RequestsPageClient />
    </>
  );
}
