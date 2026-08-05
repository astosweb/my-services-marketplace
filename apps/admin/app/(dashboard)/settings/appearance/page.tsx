import { redirect } from "next/navigation";

/** Appearance preferences are client-side via theme toggle; no API yet. */
export default function AppearanceSettingsRedirect() {
  redirect("/settings/account");
}
