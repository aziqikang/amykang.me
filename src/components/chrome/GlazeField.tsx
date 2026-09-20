import { useCallback, useState, type CSSProperties } from 'react'
import { GlazeCanvas } from './GlazeCanvas'
import styles from './GlazeField.module.css'

/**
 * Sparkle placements.
 *
 * Hand-authored rather than generated with Math.random(), for two
 * reasons: random positions would jump on every re-render, and a real
 * random scatter clumps badly — these are spaced by eye so no two land
 * on top of each other, and they avoid the centre column where the
 * timeline cards sit.
 *
 * [left%, top%, size px, duration s, delay s, tint]
 */
const SPARKLES: [number, number, number, number, number, string][] = [
  [6, 14, 20, 8, 0, 'var(--glaze-edge)'],
  [14, 62, 14, 9.5, 2.4, 'var(--periwinkle)'],
  [4, 84, 17, 11, 5.1, 'var(--glaze-edge)'],
  [22, 31, 12, 8.5, 3.7, 'var(--lavender)'],
  [27, 91, 15, 10, 1.2, 'var(--glaze-edge)'],
  [18, 8, 13, 9, 6.6, 'var(--periwinkle)'],
  [72, 9, 18, 9, 4.3, 'var(--periwinkle)'],
  [81, 44, 13, 10.5, 0.8, 'var(--glaze-edge)'],
  [91, 71, 21, 8, 6.2, 'var(--lavender)'],
  [86, 22, 14, 12, 2.9, 'var(--glaze-edge)'],
  [95, 52, 12, 9.5, 7.4, 'var(--periwinkle)'],
  [67, 88, 17, 11.5, 3.1, 'var(--glaze-edge)'],
  [77, 66, 13, 8.5, 5.8, 'var(--lavender)'],
  [58, 40, 12, 10, 8.1, 'var(--periwinkle)'],
]

/**
 * The page's living background: light moving over wet glaze.
 *
 * All texture lives in CSS as pre-baked bitmaps — see the note at the
 * top of GlazeField.module.css for why nothing here may use a live SVG
 * filter or an animated blur.
 *
 * Mounted once in App.tsx, outside the router, so it never remounts on
 * navigation — a background that restarted its animation on every tab
 * change would draw attention to itself, which is the opposite of what
 * ambient texture is for.
 */
export function GlazeField() {
  // The CSS gradient field is the fallback, not the default. It stays
  // mounted until WebGL confirms it came up, so a machine without it (or
  // a visitor who asked for reduced motion) still gets a glaze.
  const [webgl, setWebgl] = useState(false)
  const handleStatus = useCallback((active: boolean) => setWebgl(active), [])

  return (
    <div className={styles.field} aria-hidden="true">
      <GlazeCanvas onStatus={handleStatus} />

      {!webgl && (
        <>
          <div className={`${styles.sheet} ${styles.sheetA}`} />
          <div className={`${styles.sheet} ${styles.sheetB}`} />
          <div className={styles.highlight} />
        </>
      )}

      {/* Speckle and sparkles sit above the canvas either way — the clay
          flecks and catches of light belong on top of the glaze. */}
      <div className={styles.speckle} />

      {SPARKLES.map(([left, top, size, dur, delay, tint], i) => (
        <span
          key={i}
          className={styles.sparkle}
          style={
            {
              left: `${left}%`,
              top: `${top}%`,
              '--size': `${size}px`,
              '--dur': `${dur}s`,
              '--delay': `${delay}s`,
              '--tint': tint,
            } as CSSProperties
          }
        />
      ))}
    </div>
  )
}
