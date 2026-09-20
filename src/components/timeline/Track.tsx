import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Reveal } from '@/components/motion'
import type { TimelineEntry, TimelineKind } from '@/content/types'
import { Entry } from './Entry'
import { useTimelineScroll } from './useTimelineFocus'
import styles from './Track.module.css'

const KIND_LABEL: Record<TimelineKind, string> = {
  experience: 'experience',
  education: 'education',
  project: 'projects',
  travel: 'travel',
}

/** Purely decorative, so each is hidden from assistive tech — a screen
    reader announces the word beside it, not "woman technologist". */
const KIND_EMOJI: Record<TimelineKind, string> = {
  experience: '\u{1F469}\u{200D}\u{1F4BB}',
  education: '\u{1F4DA}',
  project: '\u{1F4AB}',
  travel: '\u{1F30E}',
}

/* Fixed order, and every category is offered whether or not it currently
   holds entries — a section Amy has declared but not yet filled should
   still be visible as a place things will go. The empty state below is
   what makes that honest rather than a dead button. */
const KIND_ORDER: TimelineKind[] = ['education', 'experience', 'project', 'travel']

type Filter = TimelineKind | 'all'

export function Track({ entries }: { entries: TimelineEntry[] }) {
  const [filter, setFilter] = useState<Filter>('all')

  // Scroll drives both emphasis and expansion; a click overrides the
  // scroll's opinion for one card until the two agree again.
  const { activeId, openId, instantId, canOpen, register } = useTimelineScroll()
  const [manual, setManual] = useState<ReadonlyMap<string, boolean>>(() => new Map())

  const isOpen = useCallback(
    (id: string) => (manual.has(id) ? manual.get(id)! : openId === id),
    [manual, openId],
  )

  const toggle = useCallback(
    (id: string) => {
      const wanted = !isOpen(id)
      setManual((current) => new Map(current).set(id, wanted))
    },
    [isOpen],
  )

  // Hand a card back to the scroll once the scroll's opinion matches the
  // override — otherwise one click would pin a card for the rest of the
  // session, and scrolling past it would quietly stop working.
  useEffect(() => {
    setManual((current) => {
      if (!current.size) return current
      const next = new Map(current)
      for (const [id, wanted] of current) if ((openId === id) === wanted) next.delete(id)
      return next.size === current.size ? current : next
    })
  }, [openId])

  // Sorting on `start` rather than the display label is the whole reason
  // the two fields are separate — "Nov 2024 – May 2025" cannot be sorted.
  const sorted = useMemo(
    () => [...entries].sort((a, b) => b.start.localeCompare(a.start)),
    [entries],
  )

  const visible = filter === 'all' ? sorted : sorted.filter((e) => e.kind === filter)

  // Filtering unmounts rows, so whatever was open is probably gone.
  useEffect(() => {
    setManual(new Map())
  }, [filter])

  // Interleave year markers. Derived from `start`, so they stay correct
  // under filtering — a year with no visible entries never appears.
  const rows = useMemo(() => {
    const out: ({ kind: 'year'; year: string } | { kind: 'entry'; entry: TimelineEntry })[] = []
    let lastYear = ''
    for (const entry of visible) {
      const year = entry.start.slice(0, 4)
      if (year !== lastYear) {
        out.push({ kind: 'year', year })
        lastYear = year
      }
      out.push({ kind: 'entry', entry })
    }
    return out
  }, [visible])

  return (
    <>
      <div className={styles.filters} role="group" aria-label="Filter timeline by category">
        <button
          type="button"
          className={filter === 'all' ? `${styles.filter} ${styles.filterActive}` : styles.filter}
          style={{ '--chip': 'var(--ink)' } as CSSProperties}
          aria-pressed={filter === 'all'}
          onClick={() => setFilter('all')}
        >
          EVERYTHING
        </button>

        {KIND_ORDER.map((kind) => (
          <button
            key={kind}
            type="button"
            className={filter === kind ? `${styles.filter} ${styles.filterActive}` : styles.filter}
            style={{ '--chip': `var(--kind-${kind})` } as CSSProperties}
            aria-pressed={filter === kind}
            onClick={() => setFilter(filter === kind ? 'all' : kind)}
          >
            <span className={styles.chipEmoji} aria-hidden="true">
              {KIND_EMOJI[kind]}
            </span>
            {KIND_LABEL[kind]}
          </button>
        ))}
      </div>

      <div
        className={visible.length === 0 ? `${styles.track} ${styles.trackEmpty}` : styles.track}
        data-scroll-open={canOpen || undefined}
      >
        <div className={styles.list} role="list">
          {rows.map((row, i) =>
            row.kind === 'year' ? (
              <div key={`year-${row.year}`} className={styles.year} aria-hidden="true">
                <span className={styles.yearLabel}>{row.year}</span>
                <span className={styles.yearRule} />
              </div>
            ) : (
              <Reveal key={row.entry.id} delay={Math.min(i, 6) * 0.05}>
                <Entry
                  entry={row.entry}
                  open={isOpen(row.entry.id)}
                  active={activeId === row.entry.id}
                  // A click always animates; only the scroll's own
                  // off-screen changes skip it.
                  instant={!manual.has(row.entry.id) && instantId === row.entry.id}
                  onToggle={toggle}
                  registerRef={register}
                />
              </Reveal>
            ),
          )}
        </div>

        {visible.length === 0 && <p className={styles.empty}>nothing here yet.</p>}
      </div>
    </>
  )
}
