"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Error({
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
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="mx-auto max-w-md space-y-4 text-center">
        <h1 className="text-2xl font-semibold">Page failed to load</h1>
        <p className="text-muted-foreground text-sm">
          Please try again. If the problem continues, contact support.
        </p>
        <div className="flex justify-center gap-2">
          <Button onClick={reset}>Try again</Button>
          <Button asChild variant="outline">
            <Link href="/dashboard">Back to dashboard</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
