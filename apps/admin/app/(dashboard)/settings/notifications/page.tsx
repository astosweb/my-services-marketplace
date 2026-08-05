import { redirect } from "next/navigation";

/** Admin notification preference UI was scaffold-only; use account for now. */
export default function NotificationsSettingsRedirect() {
  redirect("/settings/account");
}
