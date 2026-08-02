import type { Metadata } from "next";
import "./globals.css";

import { AppProviders } from "@/components/app-providers";
import { getCustomizerPreferencesAction } from "@/actions/customizer-preferences";
import { getSessionUser } from "@/lib/auth/session";
import { inter } from "@/lib/fonts";

export const metadata: Metadata = {
  title: {
    default: "Hero Admin",
    template: "%s | Hero Admin",
  },
  description: "Marketplace operations admin for Hero",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sessionUser, initialPreferences] = await Promise.all([
    getSessionUser(),
    getCustomizerPreferencesAction(),
  ]);

  return (
    <html
      lang="en"
      className={`${inter.variable} antialiased`}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <body className={inter.className}>
        <AppProviders
          initialPreferences={initialPreferences}
          isAuthenticated={Boolean(sessionUser)}
        >
          {children}
        </AppProviders>
      </body>
    </html>
  );
}
