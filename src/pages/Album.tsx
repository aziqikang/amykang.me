import { Link, useParams } from 'react-router-dom'
import { PhotoGrid } from '@/components/art/PhotoGrid'
import { ArtTabs } from '@/components/chrome/ArtTabs'
import { Page } from '@/components/chrome/Page'
import albumData from '@/content/photos.json'
import dimsData from '@/content/photo-dims.json'
import manifestData from '@/content/photo-manifest.json'
import type { Album as AlbumType, PhotoDims, PhotoManifest } from '@/content/types'
import styles from './Album.module.css'

const albums = albumData as AlbumType[]
const dims = dimsData as PhotoDims
const manifest = manifestData as PhotoManifest

export default function Album() {
  const { album: slug } = useParams()
  const album = albums.find((entry) => entry.id === slug)

  // A stale or mistyped slug lands here. Better than redirecting away —
  // it says what happened and offers the way back.
  if (!album) {
    return (
      <Page title="Art" kicker="Photography" documentTitle="Photography">
        <ArtTabs />
        <p className={styles.missing}>
          no album called “{slug}”. <Link to="/art/photography">see all albums →</Link>
        </p>
      </Page>
    )
  }

  return (
    <Page title={album.title} kicker={album.date} documentTitle={album.title}>
      <ArtTabs />
      <p className={styles.back}>
        <Link to="/art/photography">← all albums</Link>
      </p>
      <PhotoGrid
        album={album.id}
        albumTitle={album.title}
        photos={manifest[album.id] ?? []}
        dims={dims}
        captions={album.captions}
      />
    </Page>
  )
}
