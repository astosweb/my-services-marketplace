"use client"

import { ThemeProvider } from "@/components/theme-provider"
import { Providers } from "@/components/providers"

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <Providers>{children}</Providers>
    </ThemeProvider>
  )
}
