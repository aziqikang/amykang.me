import { useRef } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence } from 'motion/react'
import { Glow, Reveal } from '@/components/motion'
import type { ArtDims, ArtPiece } from '@/content/types'
import { Lightbox } from './Lightbox'
import { useColumnCount, useColumns } from './masonry'
import { useLightbox } from './useLightbox'
import styles from './Gallery.module.css'

const isCjk = (text: string) => /[一-鿿]/.test(text)

/** The fine art grid: paintings, with their titles and media on the card. */
export function Gallery({ pieces, dims }: { pieces: ArtPiece[]; dims: ArtDims }) {
  const gridRef = useRef<HTMLDivElement>(null)
  const columnCount = useColumnCount(gridRef)
  const columns = useColumns(pieces, columnCount)
  const { openIndex, open, close, navigate } = useLightbox()

  return (
    <>
      <div ref={gridRef} className={styles.columns}>
        {columns.map((column, columnIndex) => (
          <div className={styles.column} key={columnIndex}>
            {column.map((piece) => {
              const index = pieces.indexOf(piece)
              const size = dims[piece.id]

              return (
                <Reveal key={piece.id} delay={Math.min(index, 8) * 0.04}>
                  {/* radius must equal .card's border-radius, or the bloom
                      traces a different outline than the card. */}
                  <Glow tint="var(--sea)" radius="var(--radius-lg)" lift={5}>
                    <button
                      type="button"
                      className={styles.card}
                      onClick={(event) => open(index, event.currentTarget)}
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
                        <span
                          className={styles.title}
                          lang={isCjk(piece.title) ? 'zh' : undefined}
                        >
                          {piece.title}
                        </span>
                        <span className={styles.meta}>
                          {piece.year} · {piece.medium}
                        </span>
                        {piece.award && (
                          <span className={styles.award}>
                            {/* Decorative: the award's name is right beside
                                it, exactly as on the timeline chip, so a
                                screen reader announcing "trophy" adds
                                nothing. */}
                            <span aria-hidden="true">🏆</span>
                            {piece.award}
                          </span>
                        )}
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
          The overlay is position:fixed, but a transformed ancestor becomes
          the containing block for fixed descendants — and the
          route-transition wrapper in App.tsx animates a transform. Open the
          lightbox during that 0.22s and the overlay sized itself to the page
          wrapper instead of the viewport, putting the dialog off-screen. A
          portal puts it beyond the reach of any ancestor's transform, filter
          or will-change. */}
      {createPortal(
        <AnimatePresence>
          {openIndex !== null && (
            <Lightbox
              items={pieces}
              index={openIndex}
              onClose={close}
              onNavigate={navigate}
              image={(piece) => ({
                src: `/art/${piece.id}.webp`,
                alt: piece.title,
                w: dims[piece.id]?.w,
                h: dims[piece.id]?.h,
              })}
              label={(piece) => `${piece.title}, ${piece.year}`}
              head={(piece) => (
                <>
                  <h2
                    className={styles.dialogTitle}
                    lang={isCjk(piece.title) ? 'zh' : undefined}
                  >
                    {piece.title}
                  </h2>
                  <p className={styles.dialogMeta}>
                    {piece.year} · {piece.medium}
                  </p>
                </>
              )}
              body={(piece) =>
                piece.award || piece.description ? (
                  <>
                    {piece.award && (
                      <span className={styles.award}>
                        <span aria-hidden="true">🏆</span>
                        {piece.award}
                      </span>
                    )}
                    {piece.description && (
                      <p className={styles.dialogDesc}>{piece.description}</p>
                    )}
                  </>
                ) : null
              }
            />
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  )
}
