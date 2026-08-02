import type { Metadata } from "next";
import { RolesPageClient } from "./roles-page-client";

export const metadata: Metadata = {
  title: "Roles & Permissions",
  description: "System roles returned by the API",
};

export default function RolesPage() {
  return <RolesPageClient />;
}
