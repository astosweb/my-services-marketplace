import { redirect } from "next/navigation";

/** Billing is not part of the Bidy admin product surface yet. */
export default function BillingSettingsRedirect() {
  redirect("/settings/account");
}
