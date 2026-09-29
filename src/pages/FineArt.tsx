import { Gallery } from '@/components/art/Gallery'
import artData from '@/content/art.json'
import dimsData from '@/content/art-dims.json'
import type { ArtDims, ArtPiece } from '@/content/types'

const pieces = artData as ArtPiece[]
const dims = dimsData as ArtDims

/** The default view of the art tab. Its frame lives in Art.tsx. */
export default function FineArt() {
  return <Gallery pieces={pieces} dims={dims} />
}
