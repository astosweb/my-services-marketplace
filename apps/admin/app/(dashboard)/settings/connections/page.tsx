import { redirect } from "next/navigation";

/** Connections scaffold removed — no integrations API. */
export default function ConnectionsSettingsRedirect() {
  redirect("/settings/account");
}
