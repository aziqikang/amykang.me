import type { CSSProperties, ReactNode } from 'react'
import styles from './Glow.module.css'

export type GlowProps = {
  children: ReactNode
  /** Colour of the bloom. Defaults to glaze cyan. */
  tint?: string
  /** How far the element rises on hover, in px. */
  lift?: number
  /**
   * Corner radius of the bloom. MUST match the child card's radius —
   * a mismatch is what makes a glow look smeared instead of lit.
   */
  radius?: string
  className?: string
}

/**
 * Hover/focus affordance: a coloured bloom behind the element plus a
 * small rise. Paired with <Bob> this is the site's whole motion
 * vocabulary — bobbing means "alive", glowing means "you can touch me".
 *
 * Implemented in CSS rather than with Motion on purpose: the bloom is
 * built from CSS custom properties, which JS animation cannot
 * interpolate, and a compositor-driven transition is cheaper than a
 * React re-render on every pointer enter.
 */
export function Glow({ children, tint, lift, radius, className }: GlowProps) {
  return (
    <div
      className={className ? `${styles.glow} ${className}` : styles.glow}
      style={
        {
          ...(tint ? { '--halo-tint': tint } : {}),
          ...(lift !== undefined ? { '--glow-lift': `${lift}px` } : {}),
          ...(radius ? { '--glow-radius': radius } : {}),
        } as CSSProperties
      }
    >
      {children}
    </div>
  )
}
