import { useEffect } from 'react'
import { Portrait } from '@/components/chrome/Portrait'
import { Track } from '@/components/timeline/Track'
import { Marked, Words } from '@/components/text/Marked'
import homeData from '@/content/home.json'
import timelineData from '@/content/timeline.json'
import type { HomeData, TimelineEntry } from '@/content/types'
import styles from './Home.module.css'

const timeline = timelineData as TimelineEntry[]
const { intro } = homeData as HomeData

export default function Home() {
  useEffect(() => {
    document.title = 'Amy Kang'
  }, [])

  // The opening line carries the page's heading. Making it the real <h1>
  // rather than a paragraph plus a hidden heading keeps the document
  // outline honest — this genuinely is what the page leads with.
  // intro is never empty, but the index signature says it could be.
  const [greeting = '', ...rest] = intro

  return (
    <div className="page">
      <section className={styles.intro}>
        <div className={styles.introText}>
          {/* The egg now lives on the word "amy!" alone, marked in the
              content — the whole heading used to fire it, which meant
              clicking anywhere near the title set off a star shower. */}
          <h1 className={styles.greeting}>
            <Words text={greeting} />
          </h1>
          {rest.map((line) => (
            <p key={line.slice(0, 40)}>
              <Marked text={line} />
            </p>
          ))}
        </div>

        {/* After the text in the DOM, so a screen reader reaches the words
            first; CSS puts it alongside. */}
        <div className={styles.introPortrait}>
          <Portrait size="12rem" />
        </div>
      </section>

      {/* Heading kept for the document outline but not shown — the
          filters and the dated spine already make it obvious what this
          is, and a screen reader still needs a section to land on. */}
      <h2 className="visually-hidden">Timeline</h2>

      <Track entries={timeline} />
    </div>
  )
}
