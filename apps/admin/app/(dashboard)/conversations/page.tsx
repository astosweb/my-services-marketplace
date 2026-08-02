import type { Metadata } from "next";
import { ConversationsPageClient } from "./conversations-page-client";

export const metadata: Metadata = {
  title: "Conversations",
  description: "Moderation view of marketplace conversations",
};

export default function Page() {
  return (
    <>
      <div className="px-4 lg:px-6">
        <h1 className="text-2xl font-bold tracking-tight">Conversations</h1>
        <p className="text-muted-foreground">
          Request-scoped messaging for moderation
        </p>
      </div>
      <ConversationsPageClient />
    </>
  );
}
