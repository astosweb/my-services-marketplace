import { redirect } from "next/navigation";

/** Missing API: feature flags are not implemented in @gobid/api yet. */
export default function FeatureFlagsPage() {
  redirect("/settings/system");
}
