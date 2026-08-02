import type { Metadata } from "next";
import { DashboardPageClient } from "./dashboard-page-client";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Live platform metrics, growth trend and recent activity",
};

export default function Page() {
  return (
    <>
      <div className="px-4 lg:px-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Live metrics from your database — no placeholder data
          </p>
        </div>
      </div>
      <DashboardPageClient />
    </>
  );
}
