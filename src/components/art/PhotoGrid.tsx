import { useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence } from 'motion/react'
import { Glow, Reveal } from '@/components/motion'
import type { PhotoDims } from '@/content/types'
import { Lightbox } from './Lightbox'
import { useColumnCount, useColumns } from './masonry'
import { useLightbox } from './useLightbox'
import styles from './Gallery.module.css'

type Photo = { id: string; key: string; alt: string }

/**
 * The photographs inside one album.
 *
 * Same masonry as the fine art grid, but the cards carry no caption and the
 * viewer is `bare`: a photograph does not want a title block and a matte
 * around it the way a painting does.
 */
export function PhotoGrid({
  album,
  photos,
  dims,
  albumTitle,
  captions,
}: {
  album: string
  photos: string[]
  dims: PhotoDims
  albumTitle: string
  captions?: Record<string, string>
}) {
  const gridRef = useRef<HTMLDivElement>(null)
  const columnCount = useColumnCount(gridRef)
  const { openIndex, open, close, navigate } = useLightbox()

  const items = useMemo<Photo[]>(
    () =>
      photos.map((id, i) => ({
        id,
        key: `${album}/${id}`,
        // Photographs here are not individually captioned, so the album name
        // plus a position is the most honest alt text available. Better than
        // a filename, and better than an empty string on a link target.
        alt: `${albumTitle}, photo ${i + 1} of ${photos.length}`,
      })),
    [photos, album, albumTitle],
  )

  const columns = useColumns(items, columnCount)

  if (!photos.length) {
    return <p className={styles.empty}>no photos in this album yet.</p>
  }

  return (
    <>
      <div ref={gridRef} className={styles.columns}>
        {columns.map((column, columnIndex) => (
          <div className={styles.column} key={columnIndex}>
            {column.map((photo) => {
              const index = items.indexOf(photo)
              const size = dims[photo.key]

              return (
                <Reveal key={photo.key} delay={Math.min(index, 8) * 0.04}>
                  <Glow tint="var(--sea)" radius="var(--radius-lg)" lift={5}>
                    <button
                      type="button"
                      className={`${styles.card} ${styles.photoCard}`}
                      onClick={(event) => open(index, event.currentTarget)}
                      aria-label={`View ${photo.alt}`}
                    >
                      <div
                        className={styles.frame}
                        style={{ aspectRatio: size ? `${size.w} / ${size.h}` : '4 / 3' }}
                      >
                        <img
                          className={styles.image}
                          src={`/photos/${photo.key}-thumb.webp`}
                          alt={photo.alt}
                          width={size?.w}
                          height={size?.h}
                          loading="lazy"
                          decoding="async"
                        />
                      </div>
                    </button>
                  </Glow>
                </Reveal>
              )
            })}
          </div>
        ))}
      </div>

      {/* Portalled for the same reason as the fine art grid — see Gallery. */}
      {createPortal(
        <AnimatePresence>
          {openIndex !== null && (
            <Lightbox
              bare
              items={items}
              index={openIndex}
              onClose={close}
              onNavigate={navigate}
              image={(photo) => ({
                src: `/photos/${photo.key}.webp`,
                alt: photo.alt,
                w: dims[photo.key]?.w,
                h: dims[photo.key]?.h,
              })}
              label={(photo) => captions?.[photo.id] ?? photo.alt}
              // Centred under the image and above the paging row, which is
              // pinned to the foot of the dialog — so a long caption pushes
              // nothing around and the controls stay where they were.
              body={(photo) =>
                captions?.[photo.id] ? (
                  <p className={styles.photoCaption}>{captions[photo.id]}</p>
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
