import type { ImportedTheme } from "@/types/theme-customizer"

export type ThemeMode = "dark" | "light" | "system"

export interface CustomizerSidebarPreferences {
  variant: "sidebar" | "floating" | "inset"
  collapsible: "offcanvas" | "icon" | "none"
  side: "left" | "right"
}

export interface CustomizerPreferences {
  version: 1
  mode: ThemeMode
  selectedTheme: string
  selectedTweakcnTheme: string
  selectedRadius: string
  importedTheme: ImportedTheme | null
  brandColorsValues: Record<string, string>
  sidebar: CustomizerSidebarPreferences
}

export const DEFAULT_CUSTOMIZER_PREFERENCES: CustomizerPreferences = {
  version: 1,
  mode: "system",
  selectedTheme: "default",
  selectedTweakcnTheme: "",
  selectedRadius: "0.5rem",
  importedTheme: null,
  brandColorsValues: {},
  sidebar: {
    variant: "inset",
    collapsible: "offcanvas",
    side: "left",
  },
}
