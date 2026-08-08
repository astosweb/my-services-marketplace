import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center px-4 py-16 text-center">
      <h1 className="font-display text-3xl font-bold tracking-tight">
        Page not found
      </h1>
      <p className="mt-3 text-muted-foreground">
        That page does not exist or may have been moved.
      </p>
      <Button asChild className="mt-8">
        <Link href="/">Back home</Link>
      </Button>
    </div>
  );
}
