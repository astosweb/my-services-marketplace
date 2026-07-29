import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { RequestList } from "@/components/request-list";
import { listRequestsSafe } from "@/lib/api";
import { ESTONIAN_CITIES } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { requests, fromDemo } = await listRequestsSafe({ limit: 8 });

  return (
    <>
      <SiteHeader transparent />
      <main>
        <section className="hero" aria-label="Hero">
          <div className="hero__media" aria-hidden />
          <div className="hero__content">
            <p className="hero__brand">Hero</p>
            <h1 className="hero__headline">Local help when you need it.</h1>
            <p className="hero__support">
              Post a job in Tallinn, Tartu, Pärnu, or Narva — skilled people nearby send offers.
            </p>
            <div className="hero__actions">
              <Link href="/new" className="btn btn--primary">
                Post a request
              </Link>
              <Link href="/explore" className="btn btn--ghost">
                Browse open jobs
              </Link>
            </div>
          </div>
        </section>

        <section className="section" id="requests" aria-labelledby="requests-heading">
          <div className="section__head">
            <div>
              <span className="section__eyebrow">Live marketplace</span>
              <h2 id="requests-heading" className="section__title">
                Open requests nearby
              </h2>
              <p className="section__lede">
                Real jobs from people who need a hand — plumbing, cleaning, moving, and more.
              </p>
            </div>
            <Link href="/explore" className="btn btn--outline">
              View all
            </Link>
          </div>

          {fromDemo ? (
            <p className="demo-note">Showing sample requests until the API is connected.</p>
          ) : null}

          <RequestList requests={requests} />

          <div className="cities" aria-label="Cities">
            {ESTONIAN_CITIES.map((city) => (
              <Link
                key={city.api}
                href={`/explore?city=${city.api}`}
                className="city-link"
              >
                {city.label}
              </Link>
            ))}
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="site-footer__inner">
          <div>
            <strong>Hero</strong>
            <p style={{ margin: "0.35rem 0 0" }}>Services marketplace for Estonia.</p>
          </div>
          <div style={{ display: "flex", gap: "1.25rem" }}>
            <Link href="/explore">Explore</Link>
            <Link href="/login">Log in</Link>
            <Link href="/register">Sign up</Link>
          </div>
        </div>
      </footer>
    </>
  );
}
