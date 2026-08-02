"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center p-6">
        <div className="mx-auto max-w-md space-y-4 text-center">
          <h1 className="text-2xl font-semibold">Something went wrong</h1>
          <p className="text-muted-foreground text-sm">
            An unexpected error occurred. You can try again or return to the
            dashboard.
          </p>
          <div className="flex justify-center gap-2">
            <Button onClick={reset}>Try again</Button>
            <Button asChild variant="outline">
              <Link href="/dashboard">Dashboard</Link>
            </Button>
          </div>
        </div>
      </body>
    </html>
  );
}
