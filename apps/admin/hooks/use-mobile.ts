import * as React from "react"

const MOBILE_BREAKPOINT = 768
const QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(QUERY)
  mql.addEventListener("change", onChange)
  return () => mql.removeEventListener("change", onChange)
}

export function useIsMobile() {
  // useSyncExternalStore reads the media query during render instead of
  // synchronising it through an effect, so there is no extra render pass.
  return React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  )
}
