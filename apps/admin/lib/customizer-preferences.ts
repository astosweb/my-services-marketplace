import { z } from "zod"
import {
  DEFAULT_CUSTOMIZER_PREFERENCES,
  type CustomizerPreferences,
} from "@/types/customizer-preferences"

const cssVarRecordSchema = z.record(z.string(), z.string())

export const customizerPreferencesSchema = z.object({
  version: z.literal(1).default(1),
  mode: z.enum(["dark", "light", "system"]).default("system"),
  selectedTheme: z.string().default("default"),
  selectedTweakcnTheme: z.string().default(""),
  selectedRadius: z.string().default("0.5rem"),
  importedTheme: z
    .object({
      light: cssVarRecordSchema,
      dark: cssVarRecordSchema,
    })
    .nullable()
    .default(null),
  brandColorsValues: cssVarRecordSchema.default({}),
  sidebar: z
    .object({
      variant: z.enum(["sidebar", "floating", "inset"]).default("inset"),
      collapsible: z.enum(["offcanvas", "icon", "none"]).default("offcanvas"),
      side: z.enum(["left", "right"]).default("left"),
    })
    .default(DEFAULT_CUSTOMIZER_PREFERENCES.sidebar),
})

export type CustomizerPreferencesInput = z.infer<
  typeof customizerPreferencesSchema
>

export function parseCustomizerPreferences(
  value: unknown,
): CustomizerPreferences {
  const parsed = customizerPreferencesSchema.safeParse(value ?? {})
  if (!parsed.success) {
    return { ...DEFAULT_CUSTOMIZER_PREFERENCES }
  }

  return {
    version: 1,
    mode: parsed.data.mode,
    selectedTheme: parsed.data.selectedTheme,
    selectedTweakcnTheme: parsed.data.selectedTweakcnTheme,
    selectedRadius: parsed.data.selectedRadius,
    importedTheme: parsed.data.importedTheme,
    brandColorsValues: parsed.data.brandColorsValues,
    sidebar: parsed.data.sidebar,
  }
}

export function mergeCustomizerPreferences(
  current: CustomizerPreferences,
  patch: Partial<
    Omit<CustomizerPreferences, "sidebar"> & {
      sidebar?: Partial<CustomizerPreferences["sidebar"]>
    }
  >,
): CustomizerPreferences {
  return {
    ...current,
    ...patch,
    version: 1,
    sidebar: patch.sidebar
      ? { ...current.sidebar, ...patch.sidebar }
      : current.sidebar,
    brandColorsValues: patch.brandColorsValues
      ? { ...patch.brandColorsValues }
      : current.brandColorsValues,
    importedTheme:
      patch.importedTheme === undefined
        ? current.importedTheme
        : patch.importedTheme,
  }
}
