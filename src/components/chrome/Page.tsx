import { useEffect, type ReactNode } from 'react'
import styles from './Page.module.css'

export type PageProps = {
  title: string
  /** Small uppercase label above the title. */
  kicker?: string
  /** Optional intro paragraph under the title. */
  lede?: string
  /** Browser tab title. Falls back to the page title. */
  documentTitle?: string
  /**
   * Hide the heading block visually while leaving it in the accessibility
   * tree. A page with no <h1> at all gives screen-reader users nothing to
   * navigate to, so this hides rather than omits.
   */
  hideHeading?: boolean
  children?: ReactNode
}

/**
 * Shared page frame: max width, rhythm, and heading block.
 *
 * Also owns the document title. In an SPA nothing updates <title> on
 * navigation for free, so without this every tab would read "Amy Kang"
 * in browser history and bookmarks.
 */
export function Page({
  title,
  kicker,
  lede,
  documentTitle,
  hideHeading,
  children,
}: PageProps) {
  useEffect(() => {
    const name = documentTitle ?? title
    document.title = name === 'Amy Kang' ? name : `${name} · Amy Kang`
  }, [title, documentTitle])

  return (
    <div className="page">
      <header className={hideHeading ? 'visually-hidden' : styles.head}>
        {kicker && <p className={styles.kicker}>{kicker}</p>}
        <h1 className={styles.title}>{title}</h1>
        {lede && <p className={styles.lede}>{lede}</p>}
      </header>
      {children}
    </div>
  )
}
