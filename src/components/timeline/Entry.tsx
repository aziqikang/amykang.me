import { useCallback, useId, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { Expandable, Glow } from '@/components/motion'
import type { TimelineEntry } from '@/content/types'
import styles from './Entry.module.css'

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className={open ? `${styles.chevron} ${styles.chevronOpen}` : styles.chevron}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

export type EntryProps = {
  entry: TimelineEntry
  /** Click-driven expansion. <Track> keeps it to one card at a time. */
  open: boolean
  /** Scroll-driven emphasis. Changes no geometry — colour only. */
  active: boolean
  /** True when this card's change is happening off-screen: no animation,
      so the height lands in one pass for the scroll correction to read. */
  instant?: boolean
  onToggle: (id: string) => void
  /** Lets the scroll spy measure this row's position. */
  registerRef: (id: string, node: HTMLElement | null) => void
}

export function Entry({ entry, open, active, instant, onToggle, registerRef }: EntryProps) {
  const detailId = `entry-detail-${useId().replace(/:/g, '')}`

  // Stable identity, or React would tear the ref down and re-attach it on
  // every render, thrashing the spy's node registry.
  const setNode = useCallback(
    (node: HTMLDivElement | null) => registerRef(entry.id, node),
    [registerRef, entry.id],
  )

  // `page` deliberately not counted: it is its own link now, outside the
  // button, so an entry carrying only a page would otherwise offer an
  // expand that reveals an empty panel.
  const hasDetail = Boolean(entry.detail?.length || entry.links?.length)

  // Every kind-colored surface in this card reads from this one custom
  // property, so a new category means adding a token — never editing CSS.
  // Washes are derived with color-mix at the point of use rather than
  // stored as separate tokens, which halves what a new kind has to define.
  const kindVars = { '--kind': `var(--kind-${entry.kind})` } as CSSProperties

  const header = (
    <>
      <span className={styles.dateInline}>{entry.dateLabel}</span>
      <span className={styles.titleRow}>
        <span>
          <span className={styles.title}>{entry.title}</span>
          {entry.org && <span className={styles.org}>{entry.org}</span>}
        </span>
        {hasDetail && <Chevron open={open} />}
      </span>
      {entry.summary && <span className={styles.summary}>{entry.summary}</span>}
    </>
  )

  return (
    /* A div with role, not an <li> — <Reveal> wraps each row, so a real
       <li> would no longer be a direct child of its list. */
    <div
      ref={setNode}
      role="listitem"
      className={styles.entry}
      style={kindVars}
      // Emphasised when the reader is looking at it, and while it is open
      // — an expanded card the scroll has moved past should not go dim.
      data-active={active || open || undefined}
    >
      <div className={styles.date}>
        {entry.dateLabel}
        {entry.status && <span className={styles.status}>{entry.status}</span>}
      </div>

      <div className={styles.node} aria-hidden="true">
        <span className={styles.dot} />
      </div>

      <div className={styles.cardCell}>
        {/* radius must equal .card's border-radius or the bloom traces a
            different outline than the card and reads as smeared. */}
        <Glow tint="var(--kind)" radius="var(--radius-lg)">
          <article className={styles.card}>
            {/* Only interactive when there is something to reveal — a
                button that expands nothing is a dead end for keyboard
                users and a lie to screen readers. */}
            {hasDetail ? (
              <button
                type="button"
                className={styles.head}
                aria-expanded={open}
                aria-controls={detailId}
                onClick={() => onToggle(entry.id)}
              >
                {header}
              </button>
            ) : (
              <div className={styles.head}>{header}</div>
            )}

            {/* A sibling of the button, never a child: a link nested inside
                a button is invalid, and browsers disagree about which one
                a click belongs to. Right-aligned because the whole timeline
                is left-bound, so this is the one thing on the far side. */}
            {entry.page && (
              <div className={styles.pageRow}>
                <Link className={styles.pageLink} to={`/e/${entry.page}`}>
                  {entry.pageLabel ?? 'project page'}
                  <span aria-hidden="true">↗</span>
                </Link>
              </div>
            )}

            <Expandable open={open} id={detailId} instant={instant}>
              <div className={styles.detail}>
                <div className={styles.rule} />

                {entry.detail && (
                  <ul className={styles.bullets}>
                    {entry.detail.map((line) => (
                      <li key={line} className={styles.bullet}>
                        {line}
                      </li>
                    ))}
                  </ul>
                )}

                {entry.tags && (
                  <ul className={styles.tags}>
                    {entry.tags.map((tag) => (
                      <li key={tag} className={styles.tag}>
                        {tag}
                      </li>
                    ))}
                  </ul>
                )}

                {entry.links && (
                  <div className={styles.links}>
                    {entry.links.map((link) => (
                      <a
                        key={link.url}
                        className={styles.more}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {link.label} ↗
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </Expandable>
          </article>
        </Glow>
      </div>
    </div>
  )
}
