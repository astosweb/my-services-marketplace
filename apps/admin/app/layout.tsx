import type { Metadata } from "next";
import "./globals.css";

import { AppProviders } from "@/components/app-providers";
import { inter } from "@/lib/fonts";

export const metadata: Metadata = {
  title: {
    default: "Gobid Admin",
    template: "%s | Gobid Admin",
  },
  description: "Marketplace operations admin for Gobid",
  robots: {
    index: false,
    follow: false,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} antialiased`}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <body className={inter.className}>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
