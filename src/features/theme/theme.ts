import { useEffect } from 'react'

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'amykang.theme'

/**
 * Fired whenever the palette changes, so non-React consumers can react —
 * the WebGL background reads its colours from CSS custom properties and
 * has to re-upload them as uniforms.
 */
export const THEME_EVENT = 'amykang:themechange'

function systemTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function currentTheme(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
}

function apply(theme: Theme) {
  document.documentElement.dataset.theme = theme
  window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: theme }))
}

/**
 * Flip the palette and remember the choice.
 *
 * Writing to storage is what makes this an override: from here on the
 * visitor's pick wins over their OS setting, which is the behaviour
 * people expect once they have deliberately chosen.
 */
export function toggleTheme(): Theme {
  const next: Theme = currentTheme() === 'dark' ? 'light' : 'dark'
  apply(next)
  try {
    localStorage.setItem(STORAGE_KEY, next)
  } catch {
    // Private browsing. The theme still flips for this session.
  }
  return next
}

/**
 * Keep following the OS setting — but only until the visitor overrides
 * it. Once they have, their choice sticks and system changes are ignored.
 */
export function useSystemThemeSync() {
  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)')

    const sync = () => {
      let overridden = false
      try {
        overridden = localStorage.getItem(STORAGE_KEY) !== null
      } catch {
        overridden = false
      }
      if (!overridden) apply(systemTheme())
    }

    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [])
}
