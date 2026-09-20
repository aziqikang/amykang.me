import { LINK_ICONS } from '@/components/chrome/LinkIcons'
import { Page } from '@/components/chrome/Page'
import { Portrait } from '@/components/chrome/Portrait'
import { Reveal } from '@/components/motion'
import aboutData from '@/content/about.json'
import type { AboutData } from '@/content/types'
import { Marked } from '@/components/text/Marked'
import styles from './About.module.css'

const about = aboutData as AboutData

export default function Contact() {
  return (
    <Page title="Contact" hideHeading>
      <div className={styles.layout}>
        <Reveal>
          <div className={styles.portraitStack}>
            <Portrait size="17rem" swap={false} />
          </div>
        </Reveal>

        <Reveal delay={0.08}>
          <div className={styles.prose}>
            {about.paragraphs.map((text) => (
              <p key={text.slice(0, 32)}>
                <Marked text={text} />
              </p>
            ))}

            {/* The visible "Find me" heading is gone, so the group needs
                an accessible name of its own — otherwise it is just a run
                of unlabelled links to a screen reader. */}
            <nav className={styles.links} aria-label="Contact and profiles">
              {about.links.map((link) => {
                const isResume = link.icon === 'resume'
                const external = link.url.startsWith('http')

                return (
                  <a
                    key={link.url}
                    className={isResume ? `${styles.link} ${styles.resume}` : styles.link}
                    href={link.url}
                    {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                    {...(isResume ? { target: '_blank', rel: 'noopener' } : {})}
                  >
                    {LINK_ICONS[link.icon]}
                    {link.label}
                  </a>
                )
              })}
            </nav>
          </div>
        </Reveal>
      </div>
    </Page>
  )
}
