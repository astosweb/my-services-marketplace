"use client"

import * as React from "react"
import { useCustomizerPreferences } from "@/contexts/customizer-preferences-context"
import { useTheme } from "@/hooks/use-theme"
import { colorThemes, tweakcnThemes } from "@/config/theme-data"

function applyCssVars(styles: Record<string, string>) {
  const root = document.documentElement
  // Clear previous inline theme vars, then apply the active set.
  for (let i = root.style.length - 1; i >= 0; i--) {
    const property = root.style[i]
    if (property.startsWith("--") && property !== "--x" && property !== "--y") {
      root.style.removeProperty(property)
    }
  }
  Object.entries(styles).forEach(([key, value]) => {
    root.style.setProperty(key.startsWith("--") ? key : `--${key}`, value)
  })
}

/**
 * Applies persisted customizer theme styles without touching React state,
 * so hydration cannot trigger update-depth loops.
 */
export function CustomizerThemeSync() {
  const { preferences } = useCustomizerPreferences()
  const { theme } = useTheme()

  const isDarkMode = React.useMemo(() => {
    if (theme === "dark") return true
    if (theme === "light") return false
    return (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
    )
  }, [theme])

  const {
    selectedTheme,
    selectedTweakcnTheme,
    selectedRadius,
    importedTheme,
    brandColorsValues,
  } = preferences

  const importedThemeKey = JSON.stringify(importedTheme)
  const brandColorsKey = JSON.stringify(brandColorsValues)

  React.useEffect(() => {
    if (importedTheme) {
      applyCssVars(isDarkMode ? importedTheme.dark : importedTheme.light)
    } else if (selectedTheme) {
      const preset = colorThemes.find((t) => t.value === selectedTheme)?.preset
      if (preset) {
        applyCssVars(isDarkMode ? preset.styles.dark : preset.styles.light)
      }
    } else if (selectedTweakcnTheme) {
      const preset = tweakcnThemes.find(
        (t) => t.value === selectedTweakcnTheme,
      )?.preset
      if (preset) {
        applyCssVars(isDarkMode ? preset.styles.dark : preset.styles.light)
      }
    }

    document.documentElement.style.setProperty("--radius", selectedRadius)

    Object.entries(brandColorsValues).forEach(([cssVar, value]) => {
      document.documentElement.style.setProperty(cssVar, value)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by serialized preference payloads
  }, [
    isDarkMode,
    selectedTheme,
    selectedTweakcnTheme,
    selectedRadius,
    importedThemeKey,
    brandColorsKey,
  ])

  return null
}
