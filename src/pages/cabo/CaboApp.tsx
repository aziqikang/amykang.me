import { useEffect } from 'react'
import { Route, Routes } from 'react-router-dom'
import { HelpProvider } from './Help'
import PlayCabo from './PlayCabo'
import CaboRoom from './CaboRoom'
import styles from './Cabo.module.css'

/** The room colour, outside the table. Also what the browser bars use. */
const ROOM = '#14191c'

/**
 * Cabo's own little app: a full-screen card table that borrows the site's
 * fonts and nothing else — no nav, no footer, no glaze background.
 */
export default function CaboApp() {
  useEffect(() => {
    const body = document.body.style
    const prev = { background: body.background }
    body.background = ROOM
    const metas = [...document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')]
    const before = metas.map((m) => m.content)
    for (const m of metas) m.content = ROOM
    return () => {
      body.background = prev.background
      metas.forEach((m, i) => (m.content = before[i] ?? m.content))
    }
  }, [])

  return (
    <div className={styles.app}>
      <HelpProvider>
        <Routes>
          <Route path="/play-cabo" element={<PlayCabo />} />
          <Route path="/play-cabo/:code" element={<CaboRoom />} />
        </Routes>
      </HelpProvider>
    </div>
  )
}
