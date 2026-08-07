"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Heart, Menu, MessageCircle, Search, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useOptionalUser } from "@/hooks/use-session";
import { SITE_NAME } from "@/lib/site";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api/client";
import { useConversations } from "@/lib/api/hooks";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/api/keys";
import { useRouter } from "next/navigation";

const nav = [
  { href: "/explore", label: "Explore" },
  { href: "/requests", label: "Requests" },
  { href: "/categories", label: "Categories" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const { user, isLoading } = useOptionalUser();
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const queryClient = useQueryClient();
  const conversations = useConversations(false, Boolean(user));
  const unreadMessages = conversations.data?.meta.unreadCount ?? 0;

  async function logout() {
    await api.post("/auth/logout");
    await queryClient.invalidateQueries({ queryKey: queryKeys.session });
    router.push("/");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          href="/"
          className="font-display text-2xl font-bold tracking-tight text-primary"
        >
          {SITE_NAME}
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                pathname.startsWith(item.href)
                  ? "bg-secondary text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Button variant="ghost" size="icon" asChild aria-label="Search">
            <Link href="/search">
              <Search />
            </Link>
          </Button>
          {!isLoading && user ? (
            <>
              <Button variant="ghost" size="icon" asChild aria-label="Favorites">
                <Link href="/favorites">
                  <Heart />
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                asChild
                aria-label={
                  unreadMessages > 0
                    ? `Messages, ${unreadMessages} unread`
                    : "Messages"
                }
                className="relative"
              >
                <Link href="/messages">
                  <MessageCircle />
                  {unreadMessages > 0 ? (
                    <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-foreground">
                      {unreadMessages > 99 ? "99+" : unreadMessages}
                    </span>
                  ) : null}
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                asChild
                aria-label="Notifications"
              >
                <Link href="/notifications">
                  <Bell />
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/dashboard">Dashboard</Link>
              </Button>
              <Button variant="ghost" onClick={logout}>
                Log out
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" asChild>
                <Link href="/login">Log in</Link>
              </Button>
              <Button asChild>
                <Link href="/register">Join Gobid</Link>
              </Button>
            </>
          )}
          <Button variant="accent" asChild>
            <Link href="/requests/new">Post a request</Link>
          </Button>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {open ? <X /> : <Menu />}
        </Button>
      </div>

      {open ? (
        <div className="border-t border-border bg-background px-4 py-4 md:hidden">
          <div className="flex flex-col gap-1">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-secondary"
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/search"
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-secondary"
            >
              Search
            </Link>
            {user ? (
              <>
                <Link
                  href="/dashboard"
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-secondary"
                >
                  Dashboard
                </Link>
                <Link
                  href="/messages"
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-secondary"
                >
                  Messages
                  {unreadMessages > 0 ? ` (${unreadMessages})` : ""}
                </Link>
                <Link
                  href="/favorites"
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-secondary"
                >
                  Favorites
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    void logout();
                  }}
                  className="rounded-lg px-3 py-2.5 text-left text-sm font-medium hover:bg-secondary"
                >
                  Log out
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-secondary"
                >
                  Log in
                </Link>
                <Link
                  href="/register"
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-secondary"
                >
                  Join Gobid
                </Link>
              </>
            )}
            <Button asChild className="mt-2" variant="accent">
              <Link href="/requests/new" onClick={() => setOpen(false)}>
                Post a request
              </Link>
            </Button>
          </div>
        </div>
      ) : null}
    </header>
  );
}
