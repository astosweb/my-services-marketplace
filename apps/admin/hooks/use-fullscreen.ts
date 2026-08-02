"use client"

import { useCallback, useSyncExternalStore } from "react"

function subscribe(onChange: () => void) {
  document.addEventListener("fullscreenchange", onChange)
  return () => document.removeEventListener("fullscreenchange", onChange)
}

export function useFullscreen() {
  const isFullscreen = useSyncExternalStore(
    subscribe,
    () => Boolean(document.fullscreenElement),
    () => false,
  )

  const enterFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(console.error)
    }
  }, [])

  const exitFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(console.error)
    }
  }, [])

  const toggleFullscreen = useCallback(() => {
    if (isFullscreen) {
      void exitFullscreen()
    } else {
      void enterFullscreen()
    }
  }, [isFullscreen, enterFullscreen, exitFullscreen])

  return {
    isFullscreen,
    enterFullscreen,
    exitFullscreen,
    toggleFullscreen,
  }
}
