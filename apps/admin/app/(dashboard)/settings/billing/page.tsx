import { redirect } from "next/navigation";

/** Billing is not part of the Gobid admin product surface yet. */
export default function BillingSettingsRedirect() {
  redirect("/settings/account");
}
