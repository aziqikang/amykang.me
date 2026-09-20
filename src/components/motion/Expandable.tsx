import { AnimatePresence, motion } from 'motion/react'
import type { ReactNode } from 'react'

export type ExpandableProps = {
  open: boolean
  children: ReactNode
  /** Wire to aria-controls on the trigger so screen readers follow along. */
  id?: string
  /**
   * Apply the change in one commit, with no animation.
   *
   * The timeline opens cards as you scroll, and any height change that
   * happens off-screen has to be corrected with a compensating scroll or
   * the visible part of the page lurches. That correction can only be
   * measured once, immediately after the DOM settles — so the height has
   * to land in a single layout pass. An animated off-screen change would
   * need the page scrolled on every frame of it, which is precisely what
   * made the first attempt fight the reader's own scrolling.
   */
  instant?: boolean
}

/**
 * Animated height reveal for the timeline's expanding cards.
 *
 * The outer element carrying `id` is ALWAYS rendered, even while
 * collapsed. AnimatePresence removes the inner content on close, and if
 * the id lived on that inner node the trigger's aria-controls would point
 * at nothing whenever the card was shut — a broken relationship that
 * assistive tech reports on every collapsed card on the page.
 *
 * `data-expandable` marks this node for the scroll hook, which measures it
 * to know how much height a card is about to give back when it closes.
 */
export function Expandable({ open, children, id, instant = false }: ExpandableProps) {
  return (
    <div id={id} data-expandable="">
      {instant ? (
        open && <div>{children}</div>
      ) : (
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              key="expandable"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{
                // Height animates to 'auto' rather than a measured pixel
                // value, so a card whose content reflows still lands right.
                // Opacity runs faster so the text has settled before the box
                // stops growing.
                height: { duration: 0.3, ease: [0.22, 0.61, 0.36, 1] },
                opacity: { duration: 0.2, ease: 'easeOut' },
              }}
              style={{ overflow: 'hidden' }}
            >
              {children}
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  )
}
