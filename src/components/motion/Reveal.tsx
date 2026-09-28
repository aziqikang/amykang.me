import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import styles from './Reveal.module.css'

export type RevealProps = {
  children: ReactNode
  /** Seconds of delay — pass index * 0.06 to stagger a list. */
  delay?: number
  /** Rise distance in px. */
  distance?: number
  className?: string
}

/**
 * Fade and rise as the element scrolls into view, once.
 *
 * ── Why this is CSS and an observer, not Motion's whileInView ──
 *
 * The previous version drove opacity from JS. That makes "invisible" the
 * value the element holds until an animation runs, and anything that stops
 * the animation running leaves the content invisible FOREVER while still
 * occupying its full height. On the timeline that showed up as a gap under a
 * card you had just collapsed: the row beneath was there, full size, at
 * opacity 0, so the next card you could actually see looked pushed down.
 *
 * Here the revealed state is a plain CSS rule. If the transition never plays
 * — reduced motion, a backgrounded tab, a missed frame — the element simply
 * appears. The animation is decoration on top of a correct end state rather
 * than the thing that produces it.
 *
 * The observer is disconnected after the first hit: re-animating every time
 * something re-enters the viewport makes a long timeline feel twitchy on the
 * way back up.
 */
export function Reveal({ children, delay = 0, distance = 14, className }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [shown, setShown] = useState(false)
  const [observing, setObserving] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node) return
    if (typeof IntersectionObserver === 'undefined') {
      setShown(true)
      return
    }
    setObserving(true)

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          setShown(true)
          observer.disconnect()
        }
      },
      // A small negative bottom margin so the rise finishes by the time the
      // row is properly readable — but nothing like enough to leave a row
      // sitting in plain view still waiting to be triggered.
      { rootMargin: '0px 0px -5% 0px' },
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className={className ? `${styles.reveal} ${className}` : styles.reveal}
      data-observing={observing || undefined}
      data-shown={shown || undefined}
      style={
        { '--reveal-delay': `${delay}s`, '--reveal-distance': `${distance}px` } as CSSProperties
      }
    >
      {children}
    </div>
  )
}
