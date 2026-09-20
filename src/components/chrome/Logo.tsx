import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion } from 'motion/react'
import { toggleTheme } from '@/features/theme/theme'
import { Star } from './Star'
import styles from './Logo.module.css'

/** Accent tokens, resolved per theme, so the star always fits the palette. */
const TINTS = [
  'var(--star-1)',
  'var(--star-2)',
  'var(--star-3)',
  'var(--star-4)',
  'var(--star-5)',
  'var(--star-6)',
]

/** Idle spin cadence. Long enough to be a surprise, not a metronome. */
const IDLE_MS = 9000


export function Logo() {
  const { pathname } = useLocation()
  const [turns, setTurns] = useState(0)


  const spin = useCallback(() => setTurns((t) => t + 1), [])

  // Ambient spin.
  useEffect(() => {
    const id = window.setInterval(spin, IDLE_MS)
    return () => window.clearInterval(id)
  }, [spin])

  // And one on every tab change. Fires on mount too, which gives the
  // page a small piece of life the moment it loads.
  useEffect(() => {
    spin()
  }, [pathname, spin])

  return (
    <Link
      to="/"
      className={styles.link}
      aria-label="Amy Kang — home"
      // The easter egg: clicking the mark flips the colour scheme. It is
      // still the home link, so this rides along with that navigation.
      onClick={() => {
        toggleTheme()
        spin()
      }}
    >
      <motion.span
        className={styles.starWrap}
        animate={{ rotate: turns * 360 }}
        transition={{ duration: 1.1, ease: [0.22, 0.61, 0.36, 1] }}
        // A CSS custom property, not a Motion-animated colour: Motion
        // cannot interpolate `var(...)`, but CSS transitions happily
        // interpolate the *computed* colours those vars resolve to — and
        // that keeps the tints theme-aware for free.
        style={{ color: TINTS[turns % TINTS.length] }}
      >
        <Star size={34} />
      </motion.span>
      <span className={styles.name}>Amy Kang</span>
    </Link>
  )
}
