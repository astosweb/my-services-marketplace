import Link from "next/link";
import { SiteLogo } from "@/components/brand/logo";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/site";

const columns = [
  {
    title: "Marketplace",
    links: [
      { href: "/explore", label: "Explore" },
      { href: "/categories", label: "Categories" },
      { href: "/requests", label: "Open requests" },
      { href: "/search", label: "Search" },
    ],
  },
  {
    title: "Account",
    links: [
      { href: "/login", label: "Log in" },
      { href: "/register", label: "Sign up" },
      { href: "/dashboard", label: "Dashboard" },
      { href: "/requests/new", label: "Post a request" },
    ],
  },
  {
    title: "Help",
    links: [
      { href: "/#how-it-works", label: "How it works" },
      { href: "/#faq", label: "FAQ" },
      { href: "/#testimonials", label: "Stories" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border bg-primary text-primary-foreground">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-4">
        <div>
          <SiteLogo inverse />
          <p className="mt-3 max-w-xs text-sm text-primary-foreground/75">
            {SITE_TAGLINE}. Trusted local help across Tallinn, Tartu, Pärnu &
            Narva.
          </p>
        </div>
        {columns.map((column) => (
          <div key={column.title}>
            <p className="text-sm font-semibold tracking-wide uppercase opacity-80">
              {column.title}
            </p>
            <ul className="mt-3 space-y-2">
              {column.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-primary-foreground/80 transition hover:text-accent"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-5 text-xs text-primary-foreground/60 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>© {new Date().getFullYear()} {SITE_NAME}. All rights reserved.</p>
          <p>Built for neighbors who get things done.</p>
        </div>
      </div>
    </footer>
  );
}
