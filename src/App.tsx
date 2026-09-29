import { Suspense, lazy, useEffect, type ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { MotionConfig, motion } from 'motion/react'
import { NAV } from '@/content/nav'
import { Nav } from '@/components/chrome/Nav'
import { GlazeField } from '@/components/chrome/GlazeField'
import { ScrollTop } from '@/components/chrome/ScrollTop'
import { DebugPanel } from '@/features/debug/DebugPanel'
import { Footer } from '@/components/chrome/Footer'
import { EggProvider } from '@/features/eggs/EggProvider'
import { jumpScroll } from '@/lib/scroll'
import { useSystemThemeSync } from '@/features/theme/theme'

/**
 * Lazy because EntryPage pulls in KaTeX and its font files — roughly
 * 300kB that only matters on a project page. Loading it eagerly would
 * make every visitor pay for math they will probably never see.
 */
const EntryPage = lazy(() => import('@/pages/EntryPage'))

// Photography sits under the art tab rather than in NAV: the sub-tab row
// inside the page switches between them, so these are destinations.
//
// Eager, unlike EntryPage. These share every dependency with the fine art
// gallery that is already in the bundle, so a chunk of their own buys a
// few kB and costs a blank <main> on the first click through — long enough
// for the footer to ride up into the gap before the grid arrives.
import Album from '@/pages/Album'
import FineArt from '@/pages/FineArt'
import Photography from '@/pages/Photography'

/**
 * A browser restores scroll position on history navigation, but a fresh
 * push to a new route keeps the old offset — landing you mid-page on a
 * page you have never seen. scroll-behavior:smooth is suspended for the
 * jump so it happens instantly instead of visibly scrubbing upward.
 */
function ScrollToTop() {
  const { pathname } = useLocation()

  useEffect(() => {
    jumpScroll(0, 0)
  }, [pathname])

  return null
}

/**
 * Fade-in wrapper shared by every route.
 *
 * Deliberately has no exit animation. An exit means AnimatePresence must
 * hold the outgoing page, unmount it, and only then mount the incoming one
 * — and for those ~220ms <main> is empty, so the footer (which sits outside
 * it) slides up the height of the page and drops back down. Mounting the
 * new page in the same commit as the old one leaves no gap to fall into.
 */
function Transition({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.22, 0.61, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}

/**
 * Which routes count as "the same page" for the purposes of that fade.
 *
 * Changing this key remounts the route subtree and replays the fade; an
 * unchanged key lets React swap what is inside the frame while the frame
 * itself stays mounted. Fine art and photography share one, so clicking
 * between the sub-tabs leaves the heading and tab row untouched and moves
 * only the grid.
 */
function transitionKey(pathname: string) {
  return pathname === '/art' || pathname === '/art/photography' ? 'art' : pathname
}

/** Sub-views rendered inside a tab's own layout, keyed by that tab's path. */
const SUBROUTES: Record<string, ReactNode> = {
  '/art': (
    <>
      <Route index element={<FineArt />} />
      <Route path="photography" element={<Photography />} />
    </>
  ),
}

export default function App() {
  const location = useLocation()

  // Keep following the OS palette until the visitor flips it themselves.
  useSystemThemeSync()

  return (
    /* reducedMotion="user" makes every Motion animation in the app honor
       prefers-reduced-motion in one place. base.css covers CSS animation,
       so together they cover the whole site. */
    <MotionConfig reducedMotion="user">
      <EggProvider>
        <a className="skip-link" href="#main">
          Skip to content
        </a>

        {/* Outside the router, so the background never remounts and
            restarts its animation on a tab change. */}
        <GlazeField />

        <Nav />
        <ScrollToTop />

        <main id="main">
          <Routes key={transitionKey(location.pathname)}>
            {NAV.map(({ path, Component }) => (
              <Route
                key={path}
                path={path}
                element={
                  <Transition>
                    <Component />
                  </Transition>
                }
              >
                {SUBROUTES[path]}
              </Route>
            ))}

            {/* Long-form pages for timeline entries that opt in with a
                `page` slug. Not in NAV because they are destinations,
                not tabs. */}
            <Route
              path="/e/:slug"
              element={
                <Transition>
                  <Suspense fallback={null}>
                    <EntryPage />
                  </Suspense>
                </Transition>
              }
            />

            {/* An album carries its own title, so it is a destination
                rather than a third view inside the art frame. */}
            <Route
              path="/art/photography/:album"
              element={
                <Transition>
                  <Album />
                </Transition>
              }
            />

            {/* /about was this page's address before it became contact.
                Anything already linking there keeps working. */}
            <Route path="/about" element={<Navigate to="/contact" replace />} />

            {/* GitHub Pages serves 404.html (a copy of index.html) for
                unknown paths, so a genuinely bad URL arrives here. */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>

        {/* Outside <Routes>, so it is identical on every page and does not
            re-enter on a tab change. */}
        <Footer />

        <ScrollTop />

        {/* Diagnostics for mobile layout bugs; see DebugPanel. */}
        {typeof window !== 'undefined' &&
          new URLSearchParams(window.location.search).has('debug') && <DebugPanel />}

        {/* Phase 4: <Mascot /> mounts here — outside <Routes> so it survives
            tab changes and the tour can drive navigation while staying
            alive. That persistence is why this is an SPA and not an MPA. */}
      </EggProvider>
    </MotionConfig>
  )
}
