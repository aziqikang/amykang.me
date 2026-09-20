import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Bob } from '@/components/motion'
import { glideScroll } from '@/lib/scroll'
import styles from './ScrollTop.module.css'

/** Appear once roughly a screen has gone by — sooner than that and it
 *  would be offering to scroll somewhere you can already see. */
const THRESHOLD = 0.9

/**
 * Back-to-top button. Bobs while idle, to read as something you can
 * press rather than a static badge.
 *
 * Sits bottom-RIGHT deliberately: the mascot claims bottom-left in
 * Phase 4, and two floating controls in one corner would collide.
 */
export function ScrollTop() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const update = () => setVisible(window.scrollY > window.innerHeight * THRESHOLD)
    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update, { passive: true })
    return () => {
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [])

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className={styles.holder}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 14 }}
          transition={{ duration: 0.24, ease: [0.22, 0.61, 0.36, 1] }}
        >
          <Bob duration={2.9} distance={5}>
            <button
              type="button"
              className={styles.button}
              aria-label="Back to top"
              onClick={() => glideScroll(0)}
            >
              <svg
                className={styles.icon}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="m6 15 6-6 6 6" />
              </svg>
            </button>
          </Bob>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
