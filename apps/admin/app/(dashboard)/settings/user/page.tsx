import { redirect } from "next/navigation";

/** Mock template removed — account settings are the live surface. */
export default function UserSettingsRedirect() {
  redirect("/settings/account");
}
