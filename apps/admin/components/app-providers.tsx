"use client"

import { CustomizerPreferencesProvider } from "@/contexts/customizer-preferences-context"
import { ThemeProvider } from "@/components/theme-provider"
import { SidebarConfigProvider } from "@/contexts/sidebar-context"
import { Providers } from "@/components/providers"
import type { CustomizerPreferences } from "@/types/customizer-preferences"

export function AppProviders({
  children,
  initialPreferences,
  isAuthenticated,
}: {
  children: React.ReactNode
  initialPreferences: CustomizerPreferences
  isAuthenticated: boolean
}) {
  return (
    <CustomizerPreferencesProvider
      initialPreferences={initialPreferences}
      isAuthenticated={isAuthenticated}
    >
      <ThemeProvider defaultTheme={initialPreferences.mode}>
        <Providers>
          <SidebarConfigProvider>
            {children}
          </SidebarConfigProvider>
        </Providers>
      </ThemeProvider>
    </CustomizerPreferencesProvider>
  )
}
