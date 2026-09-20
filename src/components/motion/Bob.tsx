import { motion } from 'motion/react'
import type { ReactNode } from 'react'

export type BobProps = {
  children: ReactNode
  /** Seconds for one full up-and-down cycle. */
  duration?: number
  /** Travel in px. Keep it small — this should read as breathing, not floating away. */
  distance?: number
  /** Offset so multiple bobbing things don't move in lockstep. */
  delay?: number
  className?: string
}

/**
 * Continuous, gentle vertical oscillation.
 *
 * Deliberately reserved for the mascot (Phase 4). The portrait used to bob
 * too and no longer does, so this currently has no caller — it stays
 * because it is one of the four motion primitives the design system is
 * built on, and the mascot's mount point is already reserved in App.tsx.
 * Bobbing is this site's signal for "this thing is alive" —
 * if hover states bobbed as well, the signal would stop meaning anything
 * and the page would read as noisy rather than charming. Hover uses
 * <Glow> instead.
 *
 * Reduced motion is handled globally by <MotionConfig reducedMotion="user">
 * in App.tsx, which suppresses transform animations like this one.
 */
export function Bob({
  children,
  duration = 3.4,
  distance = 6,
  delay = 0,
  className,
}: BobProps) {
  return (
    <motion.div
      className={className}
      animate={{ y: [0, -distance, 0] }}
      transition={{ duration, delay, repeat: Infinity, ease: 'easeInOut' }}
    >
      {children}
    </motion.div>
  )
}
