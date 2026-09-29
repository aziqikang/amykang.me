import { Outlet, useLocation } from 'react-router-dom'
import { ArtTabs } from '@/components/chrome/ArtTabs'
import { Page } from '@/components/chrome/Page'

/**
 * The frame shared by both art views.
 *
 * Fine art and photography are two views of one page, not two pages, so
 * this is a layout route: the heading and the sub-tab row are rendered
 * once and stay mounted while <Outlet/> swaps the grid beneath them.
 * Rendering the frame inside each view instead would tear it down and
 * rebuild it on every sub-tab click.
 */
export default function Art() {
  const photography = useLocation().pathname === '/art/photography'

  return (
    <Page
      title="Art"
      kicker={photography ? 'Photography' : 'Oil · Watercolor'}
      documentTitle={photography ? 'Photography' : 'Art'}
    >
      <ArtTabs />
      <Outlet />
    </Page>
  )
}
