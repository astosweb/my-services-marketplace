import Link from "next/link";
import { Button } from "@/components/ui/button";

export function CtaBanner() {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
      <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-primary via-primary to-[#163f3a] px-8 py-14 text-primary-foreground sm:px-12">
        <div
          className="pointer-events-none absolute -right-16 -bottom-20 size-72 rounded-full bg-accent/25 blur-3xl"
          aria-hidden
        />
        <div className="relative max-w-xl">
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Ready when you are.
          </h2>
          <p className="mt-3 text-primary-foreground/80">
            Join Bidy to post a request or offer your skills to neighbors nearby.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
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
