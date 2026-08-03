import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SearchBar } from "@/components/marketplace/search-bar";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/site";

const HERO_IMAGE =
  "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=2400&q=80";

export function LandingHero() {
  return (
    <section className="relative isolate min-h-[88vh] overflow-hidden text-white">
      <Image
        src={HERO_IMAGE}
        alt="Local home service professional at work"
        fill
        priority
        sizes="100vw"
        className="object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-primary/95 via-primary/80 to-primary/35" />
      <div className="absolute inset-0 bg-gradient-to-t from-primary/70 via-transparent to-primary/20" />

      <div className="relative mx-auto flex min-h-[88vh] max-w-6xl flex-col justify-center px-4 py-24 sm:px-6">
        <p className="animate-rise font-display text-5xl font-bold tracking-tight sm:text-7xl md:text-8xl">
          {SITE_NAME}
        </p>
        <h1 className="animate-rise delay-1 mt-4 max-w-xl font-display text-2xl font-semibold leading-tight text-white/95 sm:text-3xl">
          Local help across Estonia, without the runaround.
        </h1>
        <p className="animate-rise delay-2 mt-4 max-w-lg text-base text-white/80 sm:text-lg">
          {SITE_TAGLINE} — post a request in Tallinn, Tartu, Pärnu, or Narva and
          get offers from people nearby.
        </p>
        <div className="animate-rise delay-3 mt-8 max-w-3xl">
          <SearchBar className="border border-white/20" />
        </div>
        <div className="animate-rise delay-4 mt-5 flex flex-wrap gap-3">
          <Button asChild variant="accent" size="lg">
            <Link href="/requests/new">Post a request</Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="border-white/40 bg-white/10 text-white hover:bg-white/20"
          >
            <Link href="/explore">Explore jobs</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
