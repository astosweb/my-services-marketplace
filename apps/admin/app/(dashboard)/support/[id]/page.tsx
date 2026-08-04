import { SupportTicketDetailClient } from "./support-ticket-detail-client";

export default async function SupportTicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <SupportTicketDetailClient ticketId={id} />;
}
