import { Page } from '@/components/chrome/Page'
import { Gallery } from '@/components/art/Gallery'
import artData from '@/content/art.json'
import dimsData from '@/content/art-dims.json'
import type { ArtDims, ArtPiece } from '@/content/types'

const pieces = artData as ArtPiece[]
const dims = dimsData as ArtDims

export default function Art() {
  return (
    <Page title="Art" kicker="Oil · Watercolor">
      <Gallery pieces={pieces} dims={dims} />
    </Page>
  )
}
