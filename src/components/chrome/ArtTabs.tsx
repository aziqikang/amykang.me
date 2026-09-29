import { NavLink } from 'react-router-dom'
import styles from './ArtTabs.module.css'

/**
 * Sub-navigation inside the art tab.
 *
 * `end` on the fine art link matters: without it the route would also match
 * /art/photography, and both tabs would read as active at once.
 */
export function ArtTabs() {
  return (
    <nav className={styles.tabs} aria-label="Art sections">
      <NavLink
        end
        to="/art"
        className={({ isActive }) => (isActive ? `${styles.tab} ${styles.active}` : styles.tab)}
      >
        fine art
      </NavLink>
      <NavLink
        to="/art/photography"
        className={({ isActive }) => (isActive ? `${styles.tab} ${styles.active}` : styles.tab)}
      >
        photography
      </NavLink>
    </nav>
  )
}
