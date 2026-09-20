import aboutData from '@/content/about.json'
import type { AboutData } from '@/content/types'
import { LINK_ICONS } from './LinkIcons'
import styles from './Footer.module.css'

const { links } = aboutData as AboutData

/**
 * Site footer: the contact links, on every page.
 *
 * Reads the same `about.json` the About page does, so there is one list of
 * where to find Amy and adding a profile is still a single line of JSON.
 * Deliberately quieter than About's version — smaller, muted, behind a
 * hairline — because on /about the two sit on the same page and should not
 * read as the same element printed twice.
 */
export function Footer() {
  return (
    <footer className={styles.footer}>
      <nav className={styles.links} aria-label="Contact and profiles">
        {links.map((link) => {
          // mailto: must stay in place; everything else opens away from the
          // site, and the résumé is a PDF the browser hands to a viewer.
          const away = link.url.startsWith('http') || link.icon === 'resume'

          return (
            <a
              key={link.url}
              className={styles.link}
              href={link.url}
              {...(away ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            >
              {LINK_ICONS[link.icon]}
              {link.label}
            </a>
          )
        })}
      </nav>
    </footer>
  )
}
