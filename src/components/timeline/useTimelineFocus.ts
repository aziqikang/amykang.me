import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { isAutoScrolling, jumpScroll } from '@/lib/scroll'

/** Where down the viewport the "reading line" sits. */
const READING_LINE = 0.38

/** Small deadband so the highlight doesn't flicker at the exact midpoint. */
const HYSTERESIS_PX = 28

/** Deadband around the line, so jitter at the boundary cannot flip the card. */
const SWITCH_MARGIN = 24

type Row = { id: string; node: HTMLElement; rect: DOMRect }

type OpenState = {
  /** Exactly one card, or none. */
  openId: string | null
  /** The card on its way out, which closes in one frame rather than animating. */
  instantId: string | null
}

const CLOSED: OpenState = { openId: null, instantId: null }

/**
 * Drives the timeline as the reader scrolls: which card is emphasised, and
 * which single card is expanded.
 *
 * ── The rule, and why it cannot oscillate ──
 *
 * The open card is the LAST row whose top has crossed the reading line.
 * That is the whole rule. It matters that it is not "the row nearest the
 * line": a nearest-distance metric is what sank the first attempt. Closing
 * card k (~210px, above the line) and compensating for it pushed k back
 * down to roughly L+40 while k+1 sat at L+160, so k measured as nearest
 * again and reopened — a real two-state loop.
 *
 * Under "last row past the line" that cannot happen. Compensation shifts
 * the rows above the line downward, and a later row that has already
 * crossed stays the last one to have crossed, whatever happens above it.
 * Simulated over the real page at every scroll speed from 5px to 340px per
 * tick, and over 400 random layouts: exactly one card open throughout, and
 * not a single non-monotone transition in either direction.
 *
 * ── What it costs ──
 *
 * One card in means another card out, and ~210-270px of detail has to go
 * somewhere. It goes ABOVE the line: the incoming card's top is anchored,
 * so the reading line and everything below it hold still, and the
 * displacement lands in the strip overhead. The outgoing card closes
 * instantly rather than animating, because the correction can only be
 * measured once, right after the DOM settles — an animated close would
 * need the page scrolled on every frame of it, which is exactly what made
 * the first version fight the reader.
 *
 * Desktop-only. iOS cancels momentum when a programmatic scroll lands
 * mid-flick, and tapping to expand is the better gesture there anyway.
 */
export function useTimelineScroll(enabled = true) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [state, setState] = useState<OpenState>(CLOSED)
  const [canOpen, setCanOpen] = useState(false)

  const nodes = useRef(new Map<string, HTMLElement>())
  const activeRef = useRef<string | null>(null)
  const openRef = useRef<string | null>(null)
  const anchor = useRef<{ node: HTMLElement; top: number } | null>(null)

  activeRef.current = activeId
  openRef.current = state.openId

  const register = useCallback((id: string, node: HTMLElement | null) => {
    if (node) nodes.current.set(id, node)
    else nodes.current.delete(id)
  }, [])

  // A fine pointer means a mouse or trackpad, where a one-frame scroll
  // correction is invisible. Reduced motion opts out of the whole thing.
  useEffect(() => {
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)')
    const still = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setCanOpen(fine.matches && !still.matches)

    update()
    fine.addEventListener('change', update)
    still.addEventListener('change', update)
    return () => {
      fine.removeEventListener('change', update)
      still.removeEventListener('change', update)
    }
  }, [])

  // The correction. Runs before paint, against the layout the commit just
  // produced, so the reader never sees the intermediate frame.
  useLayoutEffect(() => {
    const pending = anchor.current
    anchor.current = null
    if (!pending) return

    const delta = pending.node.getBoundingClientRect().top - pending.top
    if (Math.abs(delta) > 0.5) jumpScroll(window.scrollY + delta)
  }, [state])

  useEffect(() => {
    if (!enabled) {
      setActiveId(null)
      setState(CLOSED)
      return
    }

    let frame = 0

    const measure = () => {
      frame = 0

      const viewport = window.innerHeight
      const line = viewport * READING_LINE

      // One consistent snapshot, then decide everything against it. Reading
      // positions back as the decision is made mixes two layouts in a
      // single pass and invents instability that isn't there.
      const rows: Row[] = []
      for (const [id, node] of nodes.current) {
        rows.push({ id, node, rect: node.getBoundingClientRect() })
      }
      if (!rows.length) return
      rows.sort((a, b) => a.rect.top - b.rect.top)

      // ── Emphasis, only when nothing expands ────────────────
      // With scroll-open running, the open card IS the emphasised one —
      // see the return below. Deciding emphasis separately, by nearest
      // distance, let two cards light up while only one was expanded,
      // because the two rules disagree near the line.
      if (canOpen) return measureOpen(rows, line)

      let best: string | null = null
      let bestDist = Infinity
      for (const row of rows) {
        const d = Math.abs(row.rect.top - line)
        if (d < bestDist) {
          bestDist = d
          best = row.id
        }
      }

      if (best && best !== activeRef.current) {
        const currentNode = activeRef.current ? nodes.current.get(activeRef.current) : undefined
        const currentDist = currentNode
          ? Math.abs(currentNode.getBoundingClientRect().top - line)
          : Infinity
        if (bestDist < currentDist - HYSTERESIS_PX) setActiveId(best)
      }
    }

    // ── Expansion: the last row to have crossed the line ─────
    const measureOpen = (rows: Row[], line: number) => {
      // Stand down while the page is gliding somewhere on its own. Opening
      // a card here would trigger a compensating scroll, and that cancels
      // the glide outright — which is how the back-to-top button ended up
      // stopping halfway up the page.
      if (isAutoScrolling()) return

      const current = openRef.current
      const currentRow = current ? rows.find((row) => row.id === current) : undefined

      let next: Row | null = null
      for (const row of rows) if (row.rect.top <= line) next = row

      if ((next?.id ?? null) === current) return

      // A deadband, applied in whichever direction the swap goes, so a card
      // sitting on the line cannot be flipped back and forth by jitter.
      // Scrolling ON means the incoming card sits LOWER than the outgoing
      // one — it has only just come up past the line.
      if (currentRow) {
        const movingOn = next !== null && next.rect.top > currentRow.rect.top
        if (movingOn && next!.rect.top > line - SWITCH_MARGIN) return
        if (!movingOn && currentRow.rect.top <= line + SWITCH_MARGIN) return
      }

      // Anchor the incoming card's top. Everything from the line down then
      // holds still across the swap; only the strip above it moves.
      const hold = next ?? rows.find((row) => row.id === current)
      anchor.current = hold ? { node: hold.node, top: hold.rect.top } : null

      setState({ openId: next?.id ?? null, instantId: current })
    }

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure)
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    onScroll()

    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [enabled, canOpen])

  return {
    // One source of truth for "the card you are on". When scroll-open is
    // running the two were computed by different rules and could name
    // different cards, lighting up two at once.
    activeId: canOpen ? state.openId : activeId,
    openId: state.openId,
    instantId: state.instantId,
    canOpen,
    register,
  }
}
