import type { ReactNode } from 'react'
import styles from './Expandable.module.css'

export type ExpandableProps = {
  open: boolean
  children: ReactNode
  /** Wire to aria-controls on the trigger so screen readers follow along. */
  id?: string
  /**
   * Apply the change in one commit, with no animation.
   *
   * The timeline opens cards as you scroll, and any height change that
   * happens off-screen has to be corrected with a compensating scroll or the
   * visible part of the page lurches. That correction can only be measured
   * once, immediately after the DOM settles — so the height has to land in a
   * single layout pass.
   */
  instant?: boolean
}

/**
 * Height reveal for the timeline's expanding cards.
 *
 * ── Why this is CSS grid and not an animated height ──
 *
 * This used to animate `height: 0 → auto` with Motion, which measures the
 * content and animates to a pixel value. On iOS that left a gap: close a
 * card and the space beneath it stayed, pushing the next card down. An
 * animated height only reaches zero if the animation RUNS TO COMPLETION, and
 * an interruption — a re-render mid-exit, a scroll, a dropped frame — strands
 * it partway with the element still mounted at whatever height it had.
 *
 * `grid-template-rows: 0fr → 1fr` has no such failure mode. The closed state
 * is a declared CSS value, not the endpoint of a running animation, so an
 * interrupted transition still lands on exactly zero. It also needs no
 * measurement, so there is nothing to re-measure when the content reflows.
 *
 * The child stays mounted rather than being unmounted on close. That keeps
 * the `aria-controls` target alive (a trigger pointing at nothing is a
 * broken relationship assistive tech reports on every collapsed card), and
 * `inert` keeps the hidden content out of the tab order so a collapsed card
 * cannot swallow keyboard focus.
 */
export function Expandable({ open, children, id, instant = false }: ExpandableProps) {
  return (
    <div
      id={id}
      data-expandable=""
      data-open={open || undefined}
      className={instant ? `${styles.wrap} ${styles.instant}` : styles.wrap}
    >
      <div className={styles.inner} inert={!open}>
        {children}
      </div>
    </div>
  )
}
