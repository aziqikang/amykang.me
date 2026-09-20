import { motion } from 'motion/react'
import type { ReactNode } from 'react'

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
 * `once: true` matters: re-animating every time something re-enters the
 * viewport makes a long timeline feel twitchy on scroll-up. The negative
 * bottom margin starts the animation slightly before the element reaches
 * the fold, so it has finished by the time it is properly readable.
 */
export function Reveal({ children, delay = 0, distance = 14, className }: RevealProps) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: distance }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -10% 0px' }}
      transition={{ duration: 0.5, delay, ease: [0.22, 0.61, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}
