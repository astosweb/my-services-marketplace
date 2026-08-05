import type { Metadata } from "next";
import { AuditLogsPageClient } from "./audit-logs-page-client";

export const metadata: Metadata = {
  title: "Audit Logs",
  description: "Administrative actions across the marketplace",
};

export default function Page() {
  return <AuditLogsPageClient />;
}
