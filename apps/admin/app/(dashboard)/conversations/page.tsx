import type { Metadata } from "next";
import { ConversationsPageClient } from "./conversations-page-client";

export const metadata: Metadata = {
  title: "Conversations",
  description: "Moderation view of marketplace conversations",
};

export default function Page() {
  return <ConversationsPageClient />;
}
