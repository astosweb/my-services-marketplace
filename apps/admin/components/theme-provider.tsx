"use client"

import * as React from "react"
import { ThemeProviderContext } from "@/contexts/theme-context"
import { useCustomizerPreferences } from "@/contexts/customizer-preferences-context"
import type { ThemeMode } from "@/types/customizer-preferences"

type Theme = ThemeMode

type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: Theme
}

export function ThemeProvider({
  children,
  defaultTheme = "system",
  ...props
}: ThemeProviderProps) {
  const { preferences, updatePreferences } = useCustomizerPreferences()
  const theme = preferences.mode ?? defaultTheme

  React.useEffect(() => {
    if (typeof window === "undefined") return

    const root = window.document.documentElement

    root.classList.remove("light", "dark")

    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
        .matches
        ? "dark"
        : "light"

      root.classList.add(systemTheme)
      return
    }

    root.classList.add(theme)
  }, [theme])

  const value = {
    theme,
    setTheme: (nextTheme: Theme) => {
      updatePreferences({ mode: nextTheme })
    },
  }

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  )
}
