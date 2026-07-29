import Link from "next/link";
import { SiteHeaderAuth } from "./site-header-auth";

export function SiteHeader({ transparent = false }: { transparent?: boolean }) {
  return (
    <header className={`site-header${transparent ? " site-header--transparent" : ""}`}>
      <div className="site-header__inner">
        <Link href="/" className="brand-mark" aria-label="Hero home">
          Hero
        </Link>
        <nav className="site-nav" aria-label="Primary">
          <Link href="/explore">Explore</Link>
          <Link href="/new">Post a request</Link>
          <SiteHeaderAuth />
        </nav>
      </div>
    </header>
  );
}
