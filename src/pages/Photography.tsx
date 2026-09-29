import { AlbumGrid } from '@/components/art/AlbumGrid'
import albumData from '@/content/photos.json'
import dimsData from '@/content/photo-dims.json'
import manifestData from '@/content/photo-manifest.json'
import type { Album, PhotoDims, PhotoManifest } from '@/content/types'

const albums = albumData as Album[]
const dims = dimsData as PhotoDims
const manifest = manifestData as PhotoManifest

/** The album index. Its frame — heading and sub-tabs — lives in Art.tsx. */
export default function Photography() {
  return <AlbumGrid albums={albums} manifest={manifest} dims={dims} />
}
