import type { Metadata } from "next";
import { RequestsPageClient } from "./requests-page-client";

export const metadata: Metadata = {
  title: "Requests",
  description: "Moderate marketplace service requests",
};

export default function Page() {
  return <RequestsPageClient />;
}
