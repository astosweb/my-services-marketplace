import Link from "next/link";
import { Button } from "@/components/ui/button";

export function CtaBanner() {
  return (
    <section
      aria-labelledby="cta-heading"
      className="mx-auto max-w-6xl px-4 pb-14 sm:px-6 sm:pb-16"
    >
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary to-[#163f3a] px-6 py-10 text-primary-foreground sm:px-10 sm:py-12">
        <div
          className="pointer-events-none absolute -right-16 -bottom-20 size-64 rounded-full bg-accent/20 blur-3xl"
          aria-hidden
        />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-lg">
            <h2
              id="cta-heading"
              className="font-display text-2xl font-bold tracking-tight sm:text-3xl"
            >
              Ready when you are
            </h2>
            <p className="mt-2 text-sm text-primary-foreground/80 sm:text-base">
              Join Bidy to post a request or offer your skills to neighbors
              nearby.
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <Button asChild variant="accent" size="lg">
              <Link href="/register">Join Bidy</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-white/30 bg-transparent text-white hover:bg-white/10"
            >
              <Link href="/requests/new">Post a request</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
