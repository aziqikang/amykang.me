import { useEffect, useRef } from 'react'
import { motion } from 'motion/react'
import type { ArtDims, ArtPiece } from '@/content/types'
import styles from './Gallery.module.css'

type LightboxProps = {
  pieces: ArtPiece[]
  index: number
  dims: ArtDims
  onClose: () => void
  onNavigate: (index: number) => void
}

export function Lightbox({ pieces, index, dims, onClose, onNavigate }: LightboxProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  const piece = pieces[index]
  const size = piece ? dims[piece.id] : undefined

  useEffect(() => {
    closeRef.current?.focus()
  }, [])

  // Escape closes, arrows page through, Tab is trapped inside the dialog.
  // Without the trap, tabbing walks into the gallery behind the backdrop —
  // invisible focus, which is worse than no keyboard support at all.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }

      if (event.key === 'ArrowRight') {
        onNavigate((index + 1) % pieces.length)
        return
      }

      if (event.key === 'ArrowLeft') {
        onNavigate((index - 1 + pieces.length) % pieces.length)
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
  }, [index, pieces.length, onClose, onNavigate])

  // NOTE: the scroll lock deliberately lives in Gallery, not here. This
  // component unmounts only after its exit animation finishes, so a close
  // that gets interrupted — tab backgrounded mid-animation — would leave
  // the page permanently unscrollable.

  if (!piece) return null

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
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-label={`${piece.title}, ${piece.year}`}
        initial={{ opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: 4 }}
        transition={{ duration: 0.22, ease: [0.22, 0.61, 0.36, 1] }}
      >
        <button ref={closeRef} type="button" className={styles.close} onClick={onClose} aria-label="Close">
          ✕
        </button>

        <header className={styles.dialogHead}>
          <h2 className={styles.dialogTitle} lang={/[一-鿿]/.test(piece.title) ? 'zh' : undefined}>
            {piece.title}
          </h2>
          <p className={styles.dialogMeta}>
            {piece.year} · {piece.medium}
          </p>
        </header>

        <img
          className={styles.dialogImage}
          src={`/art/${piece.id}.webp`}
          alt={piece.title}
          width={size?.w}
          height={size?.h}
        />

        {(piece.award || piece.description) && (
          <div className={styles.dialogBody}>
            {piece.award && <span className={styles.award}>{piece.award}</span>}
            {piece.description && <p className={styles.dialogDesc}>{piece.description}</p>}
          </div>
        )}

        {/* Paging lives in its own full-width row at the foot of the
            dialog rather than trailing the caption — otherwise its
            position jumps between pieces as the description length
            changes, and the control you are repeatedly clicking should
            not move. */}
        <div className={styles.footer}>
          <button
            type="button"
            className={styles.navButton}
            onClick={() => onNavigate((index - 1 + pieces.length) % pieces.length)}
          >
            ← prev
          </button>
          <p className={styles.counter}>
            {index + 1} / {pieces.length}
          </p>
          <button
            type="button"
            className={styles.navButton}
            onClick={() => onNavigate((index + 1) % pieces.length)}
          >
            next →
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
