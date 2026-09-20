/**
 * Scroll without the glide.
 *
 * `html` carries `scroll-behavior: smooth` (base.css), which turns every
 * programmatic scroll into an animation. That is right for the "back to
 * top" button and wrong for everything else here — restoring a position,
 * or correcting a layout shift, where an animated jump reads as the page
 * falling over rather than as nothing having happened.
 *
 * Suspending the property around the call is the approach already used in
 * three places; this is that, written once.
 */
export function jumpScroll(top: number, left = window.scrollX) {
  const html = document.documentElement
  const previous = html.style.scrollBehavior
  html.style.scrollBehavior = 'auto'
  window.scrollTo(left, top)
  html.style.scrollBehavior = previous
}

/**
 * True while a programmatic smooth scroll is still travelling.
 *
 * Anything that corrects the scroll position must stand down while this
 * holds: a `scrollTo` cancels an in-flight smooth scroll outright, so a
 * layout correction landing mid-glide stops the page dead partway. That is
 * exactly what broke the back-to-top button once the timeline started
 * compensating for cards opening and closing.
 */
let gliding = false

export function isAutoScrolling() {
  return gliding
}

/** Scroll smoothly, and let the rest of the app know to keep its hands off. */
export function glideScroll(top: number) {
  gliding = false
  let backstop = 0

  const stop = () => {
    gliding = false
    window.clearTimeout(backstop)
    for (const event of ['wheel', 'touchstart', 'keydown'] as const) {
      window.removeEventListener(event, stop)
    }
  }

  // The settle loop below runs on rAF, which is suspended in a background
  // tab. Switching away mid-glide would otherwise leave this stuck on and
  // the timeline inert on return, so a plain timer ends it regardless.
  backstop = window.setTimeout(stop, 2500)

  // Any real input means the reader has taken over; the browser cancels the
  // glide itself, and holding the flag past that would leave the timeline
  // inert for the rest of the gesture.
  for (const event of ['wheel', 'touchstart', 'keydown'] as const) {
    window.addEventListener(event, stop, { once: true, passive: true })
  }

  gliding = true
  window.scrollTo({ top, behavior: 'smooth' })

  const started = performance.now()
  const settle = () => {
    if (!gliding) return
    // Arrived, or the browser has stopped moving and is never going to.
    if (Math.abs(window.scrollY - top) <= 2 || performance.now() - started > 2000) {
      stop()
      return
    }
    requestAnimationFrame(settle)
  }
  requestAnimationFrame(settle)
}
