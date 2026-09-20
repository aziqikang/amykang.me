import { NavLink } from 'react-router-dom'
import { motion } from 'motion/react'
import { NAV } from '@/content/nav'
import { Logo } from './Logo'
import styles from './Nav.module.css'

/**
 * Tab bar. Renders whatever NAV contains — it never hardcodes a route, so
 * a new tab appears here automatically.
 *
 * The bar is a top row on every breakpoint rather than a bottom bar on
 * mobile, because the mascot occupies the bottom-left corner (Phase 4)
 * and the two would collide on a narrow screen.
 */
export function Nav() {
  return (
    <header className={styles.bar}>
      <div className={styles.inner}>
        <Logo />

        <nav className={styles.tabs} aria-label="Sections">
          {NAV.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              // Without `end`, "/" would match every route and the home
              // tab would read as active on /art and /about.
              end={item.path === '/'}
              id={item.tourId}
              className={({ isActive }) =>
                isActive ? `${styles.tab} ${styles.tabActive}` : styles.tab
              }
            >
              {({ isActive }) => (
                <>
                  {item.label}
                  {isActive && (
                    <motion.span
                      layoutId="nav-underline"
                      className={styles.underline}
                      transition={{ duration: 0.3, ease: [0.22, 0.61, 0.36, 1] }}
                    />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  )
}
