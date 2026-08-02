import { redirect } from "next/navigation";

/** Temporary: demo route retired — marketplace admin uses live API pages. */
export default function RetiredDemoPage() {
  redirect("/dashboard");
}
