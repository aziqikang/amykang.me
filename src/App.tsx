import { Suspense, lazy, useEffect, type ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AnimatePresence, MotionConfig, motion } from 'motion/react'
import { NAV } from '@/content/nav'
import { Nav } from '@/components/chrome/Nav'
import { GlazeField } from '@/components/chrome/GlazeField'
import { ScrollTop } from '@/components/chrome/ScrollTop'
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

/** Cross-fade wrapper shared by every route. */
function Transition({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.22, ease: [0.22, 0.61, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
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
          <AnimatePresence mode="wait">
            <Routes location={location} key={location.pathname}>
              {NAV.map(({ path, Component }) => (
                <Route
                  key={path}
                  path={path}
                  element={
                    <Transition>
                      <Component />
                    </Transition>
                  }
                />
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

              {/* /about was this page's address before it became contact.
                  Anything already linking there keeps working. */}
              <Route path="/about" element={<Navigate to="/contact" replace />} />

              {/* GitHub Pages serves 404.html (a copy of index.html) for
                  unknown paths, so a genuinely bad URL arrives here. */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AnimatePresence>
        </main>

        {/* Outside <Routes>, so it is identical on every page and does not
            re-enter on a tab change. */}
        <Footer />

        <ScrollTop />

        {/* Phase 4: <Mascot /> mounts here — outside <Routes> so it survives
            tab changes and the tour can drive navigation while staying
            alive. That persistence is why this is an SPA and not an MPA. */}
      </EggProvider>
    </MotionConfig>
  )
}
