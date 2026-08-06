import Link from "next/link";
import { SiteLogo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

export default function SessionExpiredPage() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 py-16 text-center sm:px-6">
      <SiteLogo />
      <h1 className="mt-4 font-display text-3xl font-bold tracking-tight">
        Session expired
      </h1>
      <p className="mt-3 text-sm text-muted-foreground">
        For your security, please log in again to continue.
      </p>
      <Button asChild className="mt-8" size="lg">
        <Link href="/login">Log in</Link>
      </Button>
    </div>
  );
}
