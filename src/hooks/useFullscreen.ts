import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Wraps the browser's native Fullscreen API around one element (the map
 * area, toolbar included) — a GM/player fiddling with a small embedded grid
 * inside the page's max-w-5xl column is exactly the kind of thing that
 * wants to go edge-to-edge on demand.
 */
export function useFullscreen<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    function onChange() {
      setIsFullscreen(document.fullscreenElement === ref.current)
    }
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  const toggle = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {})
    } else {
      ref.current?.requestFullscreen().catch(() => {})
    }
  }, [])

  return { ref, isFullscreen, toggle }
}
