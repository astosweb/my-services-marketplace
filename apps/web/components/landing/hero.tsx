import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { GobidMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/site";

export function LandingHero() {
  return (
    <section
      aria-labelledby="hero-heading"
      className="relative isolate min-h-[min(92vh,52rem)] overflow-hidden"
    >
      <Image
        src="/brand/hero-bg.jpg"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover object-[center_40%]"
      />
      <div
        className="absolute inset-0 bg-gradient-to-r from-[#0f1c1a]/85 via-[#0f4a44]/58 to-transparent"
        aria-hidden
      />
      <div
        className="absolute inset-0 bg-gradient-to-t from-[#0f1c1a]/55 via-transparent to-[#0f1c1a]/25"
        aria-hidden
      />

      <div className="relative mx-auto flex min-h-[min(92vh,52rem)] max-w-6xl flex-col justify-end px-4 pb-12 pt-24 sm:px-6 sm:pb-16 sm:pt-28">
        <div className="max-w-xl text-white">
          <div className="animate-rise flex items-center gap-3.5">
            <GobidMark size={72} priority className="shadow-lg shadow-black/25" />
            <p className="font-display text-4xl font-bold tracking-tight sm:text-5xl">
              {SITE_NAME}
            </p>
          </div>

          <h1
            id="hero-heading"
            className="animate-rise delay-1 mt-7 font-display text-3xl font-bold tracking-tight text-balance sm:text-4xl md:text-[2.75rem] md:leading-tight"
          >
            {SITE_TAGLINE}
          </h1>

          <p className="animate-rise delay-2 mt-4 max-w-md text-base text-white/85 sm:text-lg">
            Trusted neighbors across Tallinn, Tartu, Pärnu &amp; Narva.
          </p>

          <div className="animate-rise delay-3 mt-8 flex flex-wrap gap-3">
            <Button asChild variant="accent" size="lg">
              <Link href="/requests/new">Post a request</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-white/35 bg-white/10 text-white backdrop-blur-sm hover:bg-white/20 hover:text-white"
            >
              <Link href="/explore">
                Explore
                <ArrowUpRight className="size-4" aria-hidden />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
