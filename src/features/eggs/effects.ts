/**
 * Visual payloads for easter eggs.
 *
 * Each effect is self-contained and self-cleaning: it appends what it
 * needs, schedules its own removal, and touches nothing permanent. They
 * are plain DOM rather than React because they are transient decoration
 * — putting them in the component tree would mean re-rendering the page
 * to show confetti.
 *
 * All of them no-op under prefers-reduced-motion.
 */

const REDUCED = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

const STAR =
  'M10 1 L12.23 6.93 L18.56 7.22 L13.61 11.17 L15.29 17.28 L10 13.8 ' +
  'L4.71 17.28 L6.39 11.17 L1.44 7.22 L7.77 6.93 Z'

const TINTS = ['var(--rust)', 'var(--sea)', 'var(--indigo)', 'var(--plum)']

/** A slow drift of stars UP the page, in the site's own palette. */
export function starRise(count = 28) {
  if (REDUCED()) return

  const layer = document.createElement('div')
  layer.style.cssText =
    'position:fixed;inset:0;z-index:150;pointer-events:none;overflow:hidden'
  document.body.appendChild(layer)

  for (let i = 0; i < count; i++) {
    const star = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    star.setAttribute('viewBox', '0 0 20 20')
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    path.setAttribute('d', STAR)
    path.setAttribute('fill', TINTS[i % TINTS.length] ?? 'var(--glaze)')
    star.appendChild(path)

    const size = 10 + Math.random() * 20
    const drift = (Math.random() - 0.5) * 160
    const duration = 2600 + Math.random() * 2400

    const tint = TINTS[i % TINTS.length] ?? 'var(--rust)'
    star.style.cssText =
      `position:absolute;bottom:-40px;left:${Math.random() * 100}%;` +
      `width:${size}px;height:${size}px;opacity:0;` +
      // Each star carries its own bloom, matching the site's glow language.
      `filter:drop-shadow(0 0 ${size * 0.5}px color-mix(in srgb, ${tint} 70%, transparent))`
    layer.appendChild(star)

    star.animate(
      [
        { transform: 'translate(0,0) rotate(0deg)', opacity: 0 },
        { opacity: 0.9, offset: 0.12 },
        {
          transform: `translate(${drift}px, ${-(window.innerHeight + 80)}px) rotate(${
            Math.random() * 540 - 270
          }deg)`,
          opacity: 0,
        },
      ],
      { duration, delay: Math.random() * 1200, easing: 'cubic-bezier(.22,.61,.36,1)' },
    )
  }

  window.setTimeout(() => layer.remove(), 6500)
}

/* ── Constellation ──────────────────────────────────────────────────
   Ursa Minor, drawn over the page. */

const SVG_NS = 'http://www.w3.org/2000/svg'

/**
 * The Little Dipper, handle first — tilted 51° from how it is usually
 * drawn and renormalised so x runs 0–1.
 *
 * The tilt is what lets the figure be as wide as the reading column
 * without being as TALL as the reading column: upright it is very nearly
 * square (2.8:1 tilted, 1.1:1 upright), so at column width it sprawled
 * down over the whole page instead of sitting behind the introduction.
 * Rotation is rigid, so the constellation is not distorted by this — and
 * a constellation turns through exactly this range over a night anyway.
 *
 * Index 0 is Polaris — the point of the whole thing, so it is drawn
 * largest and lit first. Indices 3–6 are the bowl.
 */
const DIPPER: [number, number][] = [
  [1.0, 0.353], // Polaris
  [0.725, 0.344],
  [0.482, 0.308],
  [0.284, 0.219],
  [0.268, 0.0],
  [0.0, 0.11],
  [0.043, 0.361],
]

/** Handle down to the bowl, then around the bowl to close it. */
const EDGES: [number, number][] = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [4, 5],
  [5, 6],
  [6, 3],
]

/**
 * The dipper's bounding box in the 0–100 space above, padded out by
 * roughly a star's radius so no glyph is clipped at the edge.
 */
const VIEW = { x: -3, y: -3.5, w: 106, h: 43 }

let aim: { x: number; y: number } | null = null

/**
 * Point the next constellation at something — in practice, at the words
 * "north star" that summoned it.
 *
 * A module-level aim rather than an argument so that `Egg.effect` stays a
 * plain `() => void` and the registry needs no special case for the one
 * effect that cares where it lands.
 */
export function aimConstellation(x: number, y: number) {
  aim = { x, y }
}

export function constellation() {
  if (REDUCED()) return

  // Sized to the reading column, not to a fixed cap: the figure is a
  // backdrop for the introduction, so it should be about as wide as the
  // words it sits behind. The height cap keeps the bowl on screen on
  // short windows, where the column is wider than the page is tall.
  const page = document.querySelector('.page')
  let colLeft = 0
  let colWidth = window.innerWidth
  if (page) {
    const rect = page.getBoundingClientRect()
    const style = getComputedStyle(page)
    colLeft = rect.left + Number.parseFloat(style.paddingLeft)
    colWidth = rect.width - Number.parseFloat(style.paddingLeft) - Number.parseFloat(style.paddingRight)
  }

  const width = Math.min(colWidth * 0.96, (window.innerHeight - 120) * (VIEW.w / VIEW.h))
  const height = width * (VIEW.h / VIEW.w)

  const target = aim ?? { x: window.innerWidth / 2, y: window.innerHeight / 2 }
  const left = colLeft + (colWidth - width) / 2
  // Centred on whatever aimed us, so the band of sky sits across the
  // introduction rather than below it — and never up under the header.
  const top = Math.max(
    64,
    Math.min(target.y - height * 0.5, window.innerHeight - height - 12),
  )

  const svg = document.createElementNS(SVG_NS, 'svg')
  // The viewBox IS the figure's bounding box, so `width` above means the
  // width of what you actually see rather than of an invisible unit
  // square the dipper only partly fills.
  svg.setAttribute('viewBox', `${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`)
  svg.setAttribute('aria-hidden', 'true')

  // Both themes want this faint, for opposite reasons: on the pale ground
  // a solid figure competes with the text over it, and on the dark ground
  // anything light glows far harder than the same value does in light
  // mode. Dark also dims --constellation itself toward the ground.
  const dark = document.documentElement.dataset.theme === 'dark'
  const peak = dark ? 0.45 : 0.5

  svg.style.cssText =
    `position:fixed;left:${left}px;top:${top}px;width:${width}px;height:${height}px;` +
    // Behind the copy, not over it: .page sits at z-index 2 and the glaze
    // field at 0, so 1 puts the figure in the sky between them.
    `z-index:1;opacity:${peak};pointer-events:none;overflow:visible`
  document.body.appendChild(svg)

  const STEP = 150
  const LINE_MS = 420

  EDGES.forEach(([from, to], i) => {
    const a = DIPPER[from]!
    const b = DIPPER[to]!
    const line = document.createElementNS(SVG_NS, 'line')
    line.setAttribute('x1', String(a[0] * 100))
    line.setAttribute('y1', String(a[1] * 100))
    line.setAttribute('x2', String(b[0] * 100))
    line.setAttribute('y2', String(b[1] * 100))
    line.setAttribute('stroke', 'color-mix(in srgb, var(--constellation) 75%, transparent)')
    line.setAttribute('stroke-width', '0.2')
    line.setAttribute('stroke-linecap', 'round')
    svg.appendChild(line)

    // Drawn on rather than faded in, so the figure reads as being traced
    // between the stars in order.
    const length = Math.hypot((b[0] - a[0]) * 100, (b[1] - a[1]) * 100)
    line.style.strokeDasharray = String(length)
    line.style.strokeDashoffset = String(length)
    line.animate([{ strokeDashoffset: length }, { strokeDashoffset: 0 }], {
      duration: LINE_MS,
      delay: i * STEP,
      easing: 'cubic-bezier(.22,.61,.36,1)',
      fill: 'forwards',
    })
  })

  DIPPER.forEach(([x, y], i) => {
    const polaris = i === 0
    // User units, so these are relative to VIEW rather than to pixels —
    // the figure keeps its proportions at every column width.
    const scale = (polaris ? 0.24 : 0.13) * (polaris ? 1 : 0.85 + Math.random() * 0.3)

    const group = document.createElementNS(SVG_NS, 'g')
    group.setAttribute('transform', `translate(${x * 100} ${y * 100}) scale(${scale})`)

    const path = document.createElementNS(SVG_NS, 'path')
    path.setAttribute('d', STAR)
    path.setAttribute('transform', 'translate(-10 -10)')
    path.setAttribute('fill', 'var(--constellation)')
    // A faint coloured halo around a white star: without it, white on the
    // pale ground has no edge at all and the points stop reading as stars.
    path.style.filter = `drop-shadow(0 0 ${
      polaris ? 2.2 : 1.4
    }px color-mix(in srgb, var(--star-2) 40%, transparent))`
    group.appendChild(path)
    svg.appendChild(group)

    group.animate(
      [
        { opacity: 0, transform: `translate(${x * 100}px, ${y * 100}px) scale(0)` },
        {
          opacity: 1,
          transform: `translate(${x * 100}px, ${y * 100}px) scale(${scale * 1.35})`,
          offset: 0.45,
        },
        { opacity: 0.92, transform: `translate(${x * 100}px, ${y * 100}px) scale(${scale})` },
      ],
      {
        duration: 620,
        // Polaris lights first, then the rest follow the traced line.
        delay: polaris ? 0 : i * STEP,
        easing: 'cubic-bezier(.16,1,.3,1)',
        fill: 'backwards',
      },
    )
  })

  // No dwell at all: the fade begins the instant the last segment lands,
  // so the figure is already leaving as it finishes arriving.
  const hold = EDGES.length * STEP + LINE_MS
  const fade = svg.animate([{ opacity: peak }, { opacity: 0 }], {
    duration: 400,
    delay: hold,
    easing: 'ease-in',
    fill: 'forwards',
  })
  fade.addEventListener('finish', () => svg.remove())
}
