import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { Glow, Reveal } from '@/components/motion'
import type { Album, PhotoDims, PhotoManifest } from '@/content/types'
import { useColumnCount, useColumns } from './masonry'
import styles from './Gallery.module.css'

/**
 * The photography index: one card per album, showing its cover.
 *
 * Cards are links rather than lightbox triggers — an album opens a page, not
 * an overlay — so this shares the masonry but none of the viewer machinery.
 */
export function AlbumGrid({
  albums,
  manifest,
  dims,
}: {
  albums: Album[]
  manifest: PhotoManifest
  dims: PhotoDims
}) {
  const gridRef = useRef<HTMLDivElement>(null)
  const columnCount = useColumnCount(gridRef)
  const columns = useColumns(albums, columnCount)

  if (!albums.length) {
    return <p className={styles.empty}>no albums yet.</p>
  }

  return (
    <div ref={gridRef} className={styles.columns}>
      {columns.map((column, columnIndex) => (
        <div className={styles.column} key={columnIndex}>
          {column.map((album) => {
            const photos = manifest[album.id] ?? []
            // Falls back to the first photo, so `cover` is optional content.
            const cover = album.cover ?? photos[0]
            const size = cover ? dims[`${album.id}/${cover}`] : undefined
            const index = albums.indexOf(album)

            return (
              <Reveal key={album.id} delay={Math.min(index, 8) * 0.04}>
                <Glow tint="var(--sea)" radius="var(--radius-lg)" lift={5}>
                  <Link className={styles.card} to={`/art/photography/${album.id}`}>
                    <div
                      className={styles.frame}
                      style={{ aspectRatio: size ? `${size.w} / ${size.h}` : '4 / 3' }}
                    >
                      {cover ? (
                        <img
                          className={styles.image}
                          src={`/photos/${album.id}/${cover}-thumb.webp`}
                          alt=""
                          width={size?.w}
                          height={size?.h}
                          loading="lazy"
                          decoding="async"
                        />
                      ) : (
                        // An album whose folder has not been filled yet still
                        // renders a card rather than a broken image.
                        <div className={styles.coverFallback} aria-hidden="true" />
                      )}
                    </div>

                    <div className={styles.caption}>
                      <span className={styles.title}>{album.title}</span>
                      <span className={styles.meta}>
                        {album.date}
                        {photos.length ? ` · ${photos.length} photos` : ''}
                      </span>
                    </div>
                  </Link>
                </Glow>
              </Reveal>
            )
          })}
        </div>
      ))}
    </div>
  )
}
