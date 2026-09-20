import { Fragment, useMemo } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import { Page } from '@/components/chrome/Page'
import { Reveal } from '@/components/motion'
import { ENTRY_PAGES } from '@/content/entries'
import styles from './EntryPage.module.css'

/**
 * Split a string on TeX delimiters and render the math segments with
 * KaTeX, leaving prose as plain text nodes.
 *
 * Only the math is passed to dangerouslySetInnerHTML, and only after
 * KaTeX has produced it — the surrounding prose stays escaped, so a
 * stray "<" in the copy can never become markup.
 */
function MathText({ text }: { text: string }) {
  const parts = useMemo(() => {
    // Display \[ ... \] first, then inline \( ... \).
    const segments = text.split(/(\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\))/g)

    return segments.filter(Boolean).map((segment) => {
      const display = segment.startsWith('\\[')
      const inline = segment.startsWith('\\(')
      if (!display && !inline) return { kind: 'text' as const, value: segment }

      const tex = segment.slice(2, -2)
      try {
        return {
          kind: 'math' as const,
          value: katex.renderToString(tex, { displayMode: display, throwOnError: false }),
        }
      } catch {
        // Never let a malformed formula blank the whole page.
        return { kind: 'text' as const, value: tex }
      }
    })
  }, [text])

  return (
    <>
      {parts.map((part, i) =>
        part.kind === 'math' ? (
          <span key={i} dangerouslySetInnerHTML={{ __html: part.value }} />
        ) : (
          <Fragment key={i}>{part.value}</Fragment>
        ),
      )}
    </>
  )
}

export default function EntryPage() {
  const { slug } = useParams<{ slug: string }>()
  const data = slug ? ENTRY_PAGES[slug] : undefined

  if (!data) return <Navigate to="/" replace />

  return (
    <Page title={data.title} kicker={data.kicker} lede={data.lede}>
      <Link to="/" className={styles.back}>
        ← back to timeline
      </Link>

      <div className={styles.links}>
        {data.links.map((link) => (
          <a
            key={link.url}
            className={styles.link}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            {link.label} ↗
          </a>
        ))}
      </div>

      <div className={styles.body}>
        {data.blocks.map((block, i) => (
          <Reveal key={i} delay={Math.min(i, 5) * 0.05}>
            {block.type === 'h2' && <h2>{block.text}</h2>}
            {block.type === 'p' && (
              <p>
                <MathText text={block.text} />
              </p>
            )}
            {block.type === 'ul' && (
              <ul className={styles.list}>
                {block.items.map((item) => (
                  <li key={item.slice(0, 32)} className={styles.item}>
                    <MathText text={item} />
                  </li>
                ))}
              </ul>
            )}
          </Reveal>
        ))}
      </div>
    </Page>
  )
}
