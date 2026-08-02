import { UserDetailPageClient } from "./user-detail-page-client";

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <UserDetailPageClient userId={id} />;
}
