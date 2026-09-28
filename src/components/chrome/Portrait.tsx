import { useCallback, useRef, useState, type CSSProperties, type MouseEvent, type PointerEvent } from 'react'
import aboutData from '@/content/about.json'
import type { AboutData } from '@/content/types'
import { Star } from './Star'
import styles from './Portrait.module.css'

const { portrait, portraitAlt } = aboutData as AboutData

export type PortraitProps = {
  /** Diameter, as any CSS length. */
  size?: string
  /**
   * Render the theme-swapping pair that trades places on hover.
   *
   * Off on About, which keeps the single original photo: that page is
   * already where the writing does the talking, and a portrait that
   * changes under the cursor pulls attention away from it.
   */
  swap?: boolean
}

/**
 * Amy's headshot: one photo per theme, the other blooming in on hover.
 *
 * Both images are always mounted and occupy exactly the same circle. Which
 * one sits on top is decided in CSS from `data-theme`, so the pair follows
 * the theme with no flash and no JavaScript in the path. The one on top
 * carries a radial mask that grows from wherever the pointer crossed the
 * edge, which is the only thing this component needs JS for.
 *
 * Shared by the home page and About rather than duplicated: both read the
 * same `about.json` entry, so swapping a photo is one line of content.
 */
export function Portrait({ size = '17rem', swap = true }: PortraitProps) {
  const [failed, setFailed] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const frame = useRef<HTMLDivElement>(null)

  /**
   * Point the bloom at the pointer.
   *
   * Called on the way in AND on the way out, so the reveal grows from where
   * you arrived and drains toward where you left.
   *
   * CLAMPED TO THE FRAME, which is load-bearing. A pointerleave fires at
   * wherever the pointer had got to, which is outside the element — leaving
   * briskly measured -42%, -21% here. Two things then go wrong: the gradient
   * is sized to its farthest corner, so an origin outside the box lengthens
   * that ray and `118%` stops meaning "just covers", and the first chunk of
   * the animation renders nothing at all because the circle has not reached
   * the frame yet. The effect reads as broken — it appears to do nothing,
   * then wipes in from off-screen. Clamping keeps the origin on the edge you
   * actually crossed.
   */
  const aim = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const node = frame.current
    if (!node) return
    const rect = node.getBoundingClientRect()
    const pin = (value: number) => Math.min(100, Math.max(0, value))
    node.style.setProperty('--px', `${pin(((event.clientX - rect.left) / rect.width) * 100)}%`)
    node.style.setProperty('--py', `${pin(((event.clientY - rect.top) / rect.height) * 100)}%`)
  }, [])

  if (failed) {
    return (
      <div className={styles.frame} style={{ '--size': size } as CSSProperties}>
        <div className={styles.fallback}>
          <Star size={96} title={portraitAlt} />
        </div>
      </div>
    )
  }

  if (!swap) {
    // Both mounted, one shown per theme, and deliberately the INVERSE of the
    // home page pairing: the dusk shot in light, the daylight close-up in
    // dark. Nothing swaps on hover here — this page is where the writing does
    // the talking.
    return (
      <div className={styles.frame} style={{ '--size': size } as CSSProperties}>
        <img
          className={`${styles.layer} ${styles.soloDusk}`}
          style={{ objectPosition: portrait.dark.focus }}
          src={portrait.dark.src}
          alt={portraitAlt}
          onError={() => setFailed(true)}
        />
        <img
          className={`${styles.layer} ${styles.soloDay}`}
          style={{ objectPosition: portrait.light.focus }}
          src={portrait.light.src}
          alt=""
          aria-hidden="true"
        />
      </div>
    )
  }

  /**
   * Touch has no hover, and leaning on :hover gave the worst of both: the
   * first tap latched the photo over and it only came back when you tapped
   * somewhere else entirely. A tap is a toggle instead, blooming from
   * wherever the finger landed. The CSS keeps the two apart — :hover only
   * applies to fine pointers, this only applies to coarse ones — so a mouse
   * click cannot leave the photo stuck on the wrong image.
   */
  const tap = useCallback((event: MouseEvent<HTMLDivElement>) => {
    const node = frame.current
    if (!node) return
    const rect = node.getBoundingClientRect()
    const pin = (value: number) => Math.min(100, Math.max(0, value))
    node.style.setProperty('--px', `${pin(((event.clientX - rect.left) / rect.width) * 100)}%`)
    node.style.setProperty('--py', `${pin(((event.clientY - rect.top) / rect.height) * 100)}%`)
    setRevealed((current) => !current)
  }, [])

  return (
    <div
      ref={frame}
      className={styles.frame}
      style={{ '--size': size } as CSSProperties}
      data-revealed={revealed || undefined}
      onPointerEnter={aim}
      onPointerLeave={aim}
      onClick={tap}
    >
      <img
        className={`${styles.layer} ${styles.daylight}`}
        style={{ objectPosition: portrait.light.focus }}
        src={portrait.light.src}
        alt={portraitAlt}
        onError={() => setFailed(true)}
      />
      {/* Decorative: the pair is one portrait, and announcing the same
          person twice would just be noise. */}
      <img
        className={`${styles.layer} ${styles.dusk}`}
        style={{ objectPosition: portrait.dark.focus }}
        src={portrait.dark.src}
        alt=""
        aria-hidden="true"
      />
    </div>
  )
}
