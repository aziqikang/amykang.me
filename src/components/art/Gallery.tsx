import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence } from 'motion/react'
import { Glow, Reveal } from '@/components/motion'
import type { ArtDims, ArtPiece } from '@/content/types'
import { Lightbox } from './Lightbox'
import { jumpScroll } from '@/lib/scroll'
import styles from './Gallery.module.css'

/** Narrowest a column may get before dropping one. */
const MIN_COLUMN = 260

function useColumnCount(ref: React.RefObject<HTMLDivElement | null>) {
  const [count, setCount] = useState(3)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return
      const width = entry.contentRect.width
      setCount(Math.max(1, Math.min(3, Math.floor(width / MIN_COLUMN))))
    })

    observer.observe(element)
    return () => observer.disconnect()
  }, [ref])

  return count
}

export function Gallery({ pieces, dims }: { pieces: ArtPiece[]; dims: ArtDims }) {
  const gridRef = useRef<HTMLDivElement>(null)
  const columnCount = useColumnCount(gridRef)
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  // Remember which card opened the lightbox so focus can go home. Losing
  // focus to <body> on close strands keyboard users at the top of the page.
  const triggerRef = useRef<HTMLButtonElement | null>(null)

  /**
   * Masonry by distributing into columns round-robin rather than into the
   * shortest column. Round-robin keeps left-to-right reading order intact,
   * which matters because the pieces are ordered newest-first; balancing
   * by height would scatter the years. With varied aspect ratios the
   * columns still come out close to even.
   */
  const columns = useMemo(() => {
    const out: ArtPiece[][] = Array.from({ length: columnCount }, () => [])
    pieces.forEach((piece, i) => out[i % columnCount]?.push(piece))
    return out
  }, [pieces, columnCount])

  /**
   * Lock the page while a lightbox is open.
   *
   * Pinning <body> at a negative offset rather than setting overflow:
   * hidden. Overflow alone did not actually hold here — the wheel still
   * scrolled the gallery behind the overlay — and it has never worked on
   * iOS Safari. Taking the body out of flow is the version that does,
   * with the scroll position restored exactly on close.
   *
   * Keyed on the open state, not on the Lightbox's lifecycle: that
   * component unmounts only once its exit animation finishes, so a close
   * interrupted mid-animation would strand the page locked.
   */
  useEffect(() => {
    if (openIndex === null) return

    const { body } = document
    const scrollY = window.scrollY
    const saved = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
    }

    body.style.position = 'fixed'
    body.style.top = `-${scrollY}px`
    body.style.left = '0'
    body.style.right = '0'
    body.style.width = '100%'

    return () => {
      Object.assign(body.style, saved)
      // Jump, don't glide — html has scroll-behavior: smooth, which would
      // otherwise animate the restore and look like the page fell over.
      jumpScroll(scrollY, 0)
    }
  }, [openIndex])

  const close = useCallback(() => {
    setOpenIndex(null)
    triggerRef.current?.focus()
  }, [])

  return (
    <>
      <div ref={gridRef} className={styles.columns}>
        {columns.map((column, columnIndex) => (
          <div className={styles.column} key={columnIndex}>
            {column.map((piece) => {
              const index = pieces.indexOf(piece)
              const size = dims[piece.id]
              const isCjk = /[一-鿿]/.test(piece.title)

              return (
                <Reveal key={piece.id} delay={Math.min(index, 8) * 0.04}>
                  {/* radius must equal .card's border-radius, or the bloom
                      traces a different outline than the card. */}
                  <Glow tint="var(--sea)" radius="var(--radius-lg)" lift={5}>
                    <button
                      type="button"
                      className={styles.card}
                      onClick={(event) => {
                        triggerRef.current = event.currentTarget
                        setOpenIndex(index)
                      }}
                      aria-label={`View ${piece.title}, ${piece.year}`}
                    >
                      <div
                        className={styles.frame}
                        style={{ aspectRatio: size ? `${size.w} / ${size.h}` : '4 / 5' }}
                      >
                        <img
                          className={styles.image}
                          src={`/art/${piece.id}-thumb.webp`}
                          alt={piece.title}
                          width={size?.w}
                          height={size?.h}
                          loading="lazy"
                          decoding="async"
                        />
                      </div>

                      <div className={styles.caption}>
                        <span className={styles.title} lang={isCjk ? 'zh' : undefined}>
                          {piece.title}
                        </span>
                        <span className={styles.meta}>
                          {piece.year} · {piece.medium}
                        </span>
                        {piece.award && <span className={styles.award}>{piece.award}</span>}
                      </div>
                    </button>
                  </Glow>
                </Reveal>
              )
            })}
          </div>
        ))}
      </div>

      {/* Portalled to <body> on purpose.
          The overlay is position:fixed, but a transformed ancestor
          becomes the containing block for fixed descendants — and the
          route-transition wrapper in App.tsx animates a transform. Open
          the lightbox during that 0.22s and the overlay sized itself to
          the page wrapper instead of the viewport, putting the dialog
          off-screen. A portal puts it beyond the reach of any ancestor's
          transform, filter or will-change. */}
      {createPortal(
        <AnimatePresence>
          {openIndex !== null && (
            <Lightbox
              pieces={pieces}
              index={openIndex}
              dims={dims}
              onClose={close}
              onNavigate={setOpenIndex}
            />
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  )
}
