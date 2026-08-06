import Link from "next/link";
import { SiteLogo } from "@/components/brand/logo";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col justify-center px-4 py-12 sm:px-6">
      <Link
        href="/"
        className="mb-8 flex justify-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <SiteLogo markSize={40} />
      </Link>
      <div className="rounded-3xl border border-border/80 bg-white/80 p-6 shadow-sm sm:p-8">
        {children}
      </div>
    </div>
  );
}
