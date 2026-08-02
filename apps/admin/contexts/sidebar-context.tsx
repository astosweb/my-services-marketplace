"use client"

import * as React from "react"
import { useCustomizerPreferences } from "@/contexts/customizer-preferences-context"
import type { CustomizerSidebarPreferences } from "@/types/customizer-preferences"

export type SidebarConfig = CustomizerSidebarPreferences

export interface SidebarContextValue {
  config: SidebarConfig
  updateConfig: (config: Partial<SidebarConfig>) => void
}

export const SidebarContext = React.createContext<SidebarContextValue | null>(null)

export function SidebarConfigProvider({ children }: { children: React.ReactNode }) {
  const { preferences, updatePreferences } = useCustomizerPreferences()

  const updateConfig = React.useCallback(
    (newConfig: Partial<SidebarConfig>) => {
      updatePreferences({
        sidebar: {
          ...preferences.sidebar,
          ...newConfig,
        },
      })
    },
    [preferences.sidebar, updatePreferences],
  )

  const value = React.useMemo(
    () => ({
      config: preferences.sidebar,
      updateConfig,
    }),
    [preferences.sidebar, updateConfig],
  )

  return (
    <SidebarContext.Provider value={value}>
      {children}
    </SidebarContext.Provider>
  )
}

export function useSidebarConfig() {
  const context = React.useContext(SidebarContext)
  if (!context) {
    throw new Error("useSidebarConfig must be used within a SidebarConfigProvider")
  }
  return context
}
