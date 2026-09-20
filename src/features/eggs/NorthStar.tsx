import { useCallback, useEffect, useRef, type ReactNode } from 'react'
import { aimConstellation } from './effects'
import { useEggs } from './EggProvider'
import styles from './NorthStar.module.css'

/** How far away the cursor can be and still light the phrase up, in px. */
const REACH = 190

/** Inside this distance the phrase starts throwing sparks. */
const SPARK_RANGE = 78

/** Minimum gap between sparks, so a slow drag doesn't become a firehose. */
const SPARK_EVERY = 110

/** Hovering this long is the second way in, for anyone who doesn't click. */
const LINGER_MS = 1300

const TINTS = ['var(--star-2)', 'var(--star-3)', 'var(--ochre)']

/** The same four-point catch of light the glaze field twinkles with. */
const SPARK_CLIP =
  'polygon(50% 0%, 58% 42%, 100% 50%, 58% 58%, 50% 100%, 42% 58%, 0% 50%, 42% 42%)'

function emitSpark(x: number, y: number, tint: string) {
  const size = 5 + Math.random() * 7
  const el = document.createElement('span')
  el.style.cssText =
    `position:fixed;left:${x}px;top:${y}px;width:${size}px;height:${size}px;` +
    `margin:${-size / 2}px 0 0 ${-size / 2}px;z-index:120;pointer-events:none;` +
    `background:${tint};clip-path:${SPARK_CLIP};` +
    `filter:drop-shadow(0 0 5px color-mix(in srgb, ${tint} 80%, transparent))`
  document.body.appendChild(el)

  const animation = el.animate(
    [
      { transform: 'scale(0.3) rotate(0deg)', opacity: 0 },
      { transform: 'scale(1) rotate(40deg)', opacity: 0.95, offset: 0.3 },
      {
        transform: `translate(${(Math.random() - 0.5) * 46}px, ${
          -18 - Math.random() * 30
        }px) scale(0.2) rotate(140deg)`,
        opacity: 0,
      },
    ],
    { duration: 620 + Math.random() * 380, easing: 'cubic-bezier(.22,.61,.36,1)' },
  )

  // onfinish rather than the .finished promise: a cancelled animation
  // rejects that promise, and an unhandled rejection over an easter egg
  // would be an absurd way to spam someone's console.
  animation.onfinish = () => el.remove()
  // onfinish never fires for a cancelled animation, and one that is
  // running when the tab is backgrounded is simply frozen — either way
  // the node would sit in the DOM forever. A timer guarantees the sweep.
  window.setTimeout(() => el.remove(), 2000)
}

/**
 * The phrase "north star", which knows where your cursor is.
 *
 * It brightens as the star cursor approaches, sparks at close range, and
 * on a click — or a long enough hover, for anyone who doesn't think to
 * click a sentence — draws the Little Dipper across the page.
 *
 * The pointer tracking deliberately never touches React state. At a
 * couple of hundred pointermove events a second, re-rendering the page to
 * change a glow would be indefensible; instead it writes one CSS custom
 * property straight to the node, which only ever repaints this span.
 */
export function NorthStar({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null)
  const box = useRef<DOMRect | null>(null)
  const lastSpark = useRef(0)
  const lingerTimer = useRef<number | undefined>(undefined)
  const { fire: fireEgg } = useEggs()

  const fire = useCallback(() => {
    const rect = ref.current?.getBoundingClientRect()
    if (rect) aimConstellation(rect.left + rect.width / 2, rect.top + rect.height / 2)
    fireEgg('north-star')
  }, [fireEgg])

  useEffect(() => {
    const el = ref.current
    if (!el) return

    // The glow is ambient decoration and the sparks are motion; someone
    // who asked for neither gets the plain sentence. Clicking still works.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    // Cached because reading it per pointermove would force layout on
    // every mouse event. Scroll and resize are the only things that can
    // move an inline span, so those are the only invalidations needed.
    const measure = () => {
      box.current = el.getBoundingClientRect()
    }
    measure()

    const onPointerMove = (event: PointerEvent) => {
      const rect = box.current
      if (!rect) return

      // Distance to the nearest point of the phrase, not to its centre —
      // otherwise the long end of a wide span never feels close.
      const dx = Math.max(rect.left - event.clientX, 0, event.clientX - rect.right)
      const dy = Math.max(rect.top - event.clientY, 0, event.clientY - rect.bottom)
      const distance = Math.hypot(dx, dy)

      const near = Math.max(0, 1 - distance / REACH)
      el.style.setProperty('--near', near.toFixed(3))

      if (distance > SPARK_RANGE) return
      const now = performance.now()
      if (now - lastSpark.current < SPARK_EVERY) return
      lastSpark.current = now
      emitSpark(
        event.clientX + (Math.random() - 0.5) * 16,
        event.clientY + (Math.random() - 0.5) * 16,
        TINTS[Math.floor(Math.random() * TINTS.length)] ?? TINTS[0]!,
      )
    }

    // The pointer can leave through the edge of the window without ever
    // passing far enough away to fade the glow out on its own.
    const onLeave = () => el.style.setProperty('--near', '0')

    window.addEventListener('pointermove', onPointerMove, { passive: true })
    window.addEventListener('scroll', measure, { passive: true })
    window.addEventListener('resize', measure)
    document.addEventListener('pointerleave', onLeave)

    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('scroll', measure)
      window.removeEventListener('resize', measure)
      document.removeEventListener('pointerleave', onLeave)
    }
  }, [])

  return (
    <span
      ref={ref}
      className={styles.phrase}
      onClick={fire}
      onPointerEnter={() => {
        lingerTimer.current = window.setTimeout(fire, LINGER_MS)
      }}
      onPointerLeave={() => window.clearTimeout(lingerTimer.current)}
    >
      {children}
    </span>
  )
}
