import { useEffect, useMemo, useState, type RefObject } from 'react'

/** Narrowest a column may get before dropping one. */
const MIN_COLUMN = 260

/** Most columns, at any width. More than three and the images get tiny. */
const MAX_COLUMNS = 3

/**
 * How many columns fit, measured from the container rather than the viewport.
 *
 * A media query would be wrong here: these grids appear inside the page
 * measure, inside an album, and potentially inside narrower containers, so
 * what matters is the space the grid actually has.
 */
export function useColumnCount(ref: RefObject<HTMLDivElement | null>) {
  const [count, setCount] = useState(MAX_COLUMNS)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return
      const width = entry.contentRect.width
      setCount(Math.max(1, Math.min(MAX_COLUMNS, Math.floor(width / MIN_COLUMN))))
    })

    observer.observe(element)
    return () => observer.disconnect()
  }, [ref])

  return count
}

/**
 * Deal items into columns round-robin.
 *
 * Round-robin rather than into-the-shortest-column on purpose: it keeps
 * left-to-right reading order intact, which matters because these lists are
 * ordered newest-first and balancing by height would scatter the chronology.
 * With varied aspect ratios the columns still come out close to even.
 */
export function useColumns<T>(items: T[], count: number) {
  return useMemo(() => {
    const out: T[][] = Array.from({ length: count }, () => [])
    items.forEach((item, i) => out[i % count]?.push(item))
    return out
  }, [items, count])
}
