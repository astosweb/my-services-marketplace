"use client"

import * as React from "react"
import { updateCustomizerPreferencesAction } from "@/actions/customizer-preferences"
import {
  mergeCustomizerPreferences,
} from "@/lib/customizer-preferences"
import {
  DEFAULT_CUSTOMIZER_PREFERENCES,
  type CustomizerPreferences,
} from "@/types/customizer-preferences"

export type CustomizerPreferencesPatch = Partial<
  Omit<CustomizerPreferences, "sidebar"> & {
    sidebar?: Partial<CustomizerPreferences["sidebar"]>
  }
>

type CustomizerPreferencesContextValue = {
  preferences: CustomizerPreferences
  isAuthenticated: boolean
  updatePreferences: (patch: CustomizerPreferencesPatch) => void
  replacePreferences: (preferences: CustomizerPreferences) => void
}

const CustomizerPreferencesContext =
  React.createContext<CustomizerPreferencesContextValue | null>(null)

const SAVE_DEBOUNCE_MS = 400

export function CustomizerPreferencesProvider({
  children,
  initialPreferences,
  isAuthenticated,
}: {
  children: React.ReactNode
  initialPreferences: CustomizerPreferences
  isAuthenticated: boolean
}) {
  const [preferences, setPreferences] =
    React.useState<CustomizerPreferences>(initialPreferences)
  const saveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingRef = React.useRef<CustomizerPreferences | null>(null)
  const isAuthenticatedRef = React.useRef(isAuthenticated)

  React.useEffect(() => {
    isAuthenticatedRef.current = isAuthenticated
  }, [isAuthenticated])

  React.useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
      }
    }
  }, [])

  const persist = React.useCallback((next: CustomizerPreferences) => {
    if (!isAuthenticatedRef.current) return

    pendingRef.current = next
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
    }

    saveTimerRef.current = setTimeout(() => {
      const payload = pendingRef.current
      pendingRef.current = null
      if (!payload) return

      void updateCustomizerPreferencesAction(payload).catch(() => {
        // Keep local UI state even if persistence fails.
      })
    }, SAVE_DEBOUNCE_MS)
  }, [])

  const updatePreferences = React.useCallback(
    (patch: CustomizerPreferencesPatch) => {
      setPreferences((current) => {
        const next = mergeCustomizerPreferences(current, patch)
        persist(next)
        return next
      })
    },
    [persist],
  )

  const replacePreferences = React.useCallback(
    (next: CustomizerPreferences) => {
      const normalized = mergeCustomizerPreferences(
        DEFAULT_CUSTOMIZER_PREFERENCES,
        next,
      )
      setPreferences(normalized)
      persist(normalized)
    },
    [persist],
  )

  const value = React.useMemo(
    () => ({
      preferences,
      isAuthenticated,
      updatePreferences,
      replacePreferences,
    }),
    [preferences, isAuthenticated, updatePreferences, replacePreferences],
  )

  return (
    <CustomizerPreferencesContext.Provider value={value}>
      {children}
    </CustomizerPreferencesContext.Provider>
  )
}

export function useCustomizerPreferences() {
  const context = React.useContext(CustomizerPreferencesContext)
  if (!context) {
    throw new Error(
      "useCustomizerPreferences must be used within a CustomizerPreferencesProvider",
    )
  }
  return context
}
