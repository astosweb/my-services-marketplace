import { describe, expect, it } from "vitest"
import {
  mergeCustomizerPreferences,
  parseCustomizerPreferences,
} from "@/lib/customizer-preferences"
import { DEFAULT_CUSTOMIZER_PREFERENCES } from "@/types/customizer-preferences"

describe("parseCustomizerPreferences", () => {
  it("returns defaults for null or invalid input", () => {
    expect(parseCustomizerPreferences(null)).toEqual(
      DEFAULT_CUSTOMIZER_PREFERENCES,
    )
    expect(parseCustomizerPreferences({ mode: "neon" })).toEqual(
      DEFAULT_CUSTOMIZER_PREFERENCES,
    )
  })

  it("parses a valid preferences payload", () => {
    const parsed = parseCustomizerPreferences({
      version: 1,
      mode: "dark",
      selectedTheme: "blue",
      selectedTweakcnTheme: "",
      selectedRadius: "1rem",
      importedTheme: null,
      brandColorsValues: { "--primary": "oklch(0.5 0.1 200)" },
      sidebar: {
        variant: "floating",
        collapsible: "icon",
        side: "right",
      },
    })

    expect(parsed.mode).toBe("dark")
    expect(parsed.selectedTheme).toBe("blue")
    expect(parsed.selectedRadius).toBe("1rem")
    expect(parsed.sidebar).toEqual({
      variant: "floating",
      collapsible: "icon",
      side: "right",
    })
    expect(parsed.brandColorsValues["--primary"]).toBe("oklch(0.5 0.1 200)")
  })
})

describe("mergeCustomizerPreferences", () => {
  it("merges sidebar and replaces brand colors", () => {
    const merged = mergeCustomizerPreferences(DEFAULT_CUSTOMIZER_PREFERENCES, {
      mode: "light",
      sidebar: { side: "right" },
      brandColorsValues: { "--primary": "red" },
    })

    expect(merged.mode).toBe("light")
    expect(merged.sidebar).toEqual({
      variant: "inset",
      collapsible: "offcanvas",
      side: "right",
    })
    expect(merged.brandColorsValues).toEqual({ "--primary": "red" })
  })
})
