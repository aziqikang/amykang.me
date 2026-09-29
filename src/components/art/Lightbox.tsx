import { useEffect, useRef, type ReactNode } from 'react'
import { motion } from 'motion/react'
import styles from './Gallery.module.css'

export type LightboxImage = { src: string; alt: string; w?: number; h?: number }

export type LightboxProps<T> = {
  items: T[]
  index: number
  onClose: () => void
  onNavigate: (index: number) => void
  /** Where the full-size file lives, and its intrinsic size if known. */
  image: (item: T) => LightboxImage
  /** Accessible name for the dialog. */
  label: (item: T) => string
  /** Optional caption above the image. */
  head?: (item: T) => ReactNode
  /** Optional caption below it. */
  body?: (item: T) => ReactNode
  /**
   * Drop the matte plate, leaving the image and the counter on the backdrop.
   * For photographs, where a framed presentation fights the picture.
   */
  bare?: boolean
}

/**
 * Modal image viewer, generic over whatever it is showing.
 *
 * Generic rather than duplicated: the parts that matter here are the focus
 * trap, the key handling and the paging, and those are worth writing once.
 * A painting supplies a title, year, medium and description; a photograph
 * supplies nothing at all. That difference is the caller's to express, via
 * `head`/`body`, and is the only thing that varies.
 */
export function Lightbox<T>({
  items,
  index,
  onClose,
  onNavigate,
  image,
  label,
  head,
  body,
  bare = false,
}: LightboxProps<T>) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  const item = items[index]

  useEffect(() => {
    closeRef.current?.focus()
  }, [])

  // Escape closes, arrows page through, Tab is trapped inside the dialog.
  // Without the trap, tabbing walks into the grid behind the backdrop —
  // invisible focus, which is worse than no keyboard support at all.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }

      if (event.key === 'ArrowRight') {
        onNavigate((index + 1) % items.length)
        return
      }

      if (event.key === 'ArrowLeft') {
        onNavigate((index - 1 + items.length) % items.length)
        return
      }

      if (event.key !== 'Tab' || !dialogRef.current) return

      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      )
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (!first || !last) return

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [index, items.length, onClose, onNavigate])

  // NOTE: the scroll lock deliberately lives in useLightbox, not here. This
  // component unmounts only after its exit animation finishes, so a close
  // that gets interrupted — tab backgrounded mid-animation — would leave the
  // page permanently unscrollable.

  if (!item) return null

  const picture = image(item)
  const headContent = head?.(item)
  const bodyContent = body?.(item)

  return (
    <motion.div
      className={styles.overlay}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
    >
      <div className={styles.backdrop} onClick={onClose} aria-hidden="true" />

      <motion.div
        ref={dialogRef}
        className={bare ? `${styles.dialog} ${styles.dialogBare}` : styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-label={label(item)}
        initial={{ opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: 4 }}
        transition={{ duration: 0.22, ease: [0.22, 0.61, 0.36, 1] }}
      >
        <button
          ref={closeRef}
          type="button"
          className={styles.close}
          onClick={onClose}
          aria-label="Close"
        >
          ✕
        </button>

        {headContent && <header className={styles.dialogHead}>{headContent}</header>}

        <img
          className={styles.dialogImage}
          src={picture.src}
          alt={picture.alt}
          width={picture.w}
          height={picture.h}
        />

        {bodyContent && <div className={styles.dialogBody}>{bodyContent}</div>}

        {/* Paging lives in its own full-width row at the foot of the dialog
            rather than trailing the caption — otherwise its position jumps
            between items as the description length changes, and the control
            you are repeatedly clicking should not move. */}
        <div className={styles.footer}>
          <button
            type="button"
            className={styles.navButton}
            onClick={() => onNavigate((index - 1 + items.length) % items.length)}
          >
            ← prev
          </button>
          <p className={styles.counter}>
            {index + 1} / {items.length}
          </p>
          <button
            type="button"
            className={styles.navButton}
            onClick={() => onNavigate((index + 1) % items.length)}
          >
            next →
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
