import Link from "next/link";
import { SITE_NAME } from "@/lib/site";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col justify-center px-4 py-12 sm:px-6">
      <Link
        href="/"
        className="mb-8 text-center font-display text-3xl font-bold tracking-tight text-primary"
      >
        {SITE_NAME}
      </Link>
      <div className="rounded-3xl border border-border/80 bg-white/80 p-6 shadow-sm sm:p-8">
        {children}
      </div>
    </div>
  );
}
