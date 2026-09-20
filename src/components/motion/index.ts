/**
 * The site's complete motion vocabulary. Components compose these rather
 * than hand-rolling animations, which is what keeps a new widget feeling
 * like the rest of the site without anyone re-deriving timings.
 *
 *   <Bob>        continuous  — "this is alive"       (mascot, portrait)
 *   <Glow>       hover/focus — "you can touch this"  (cards)
 *   <Reveal>     on scroll   — arrival               (lists, sections)
 *   <Expandable> on toggle   — disclosure            (timeline detail)
 */
export { Bob } from './Bob'
export type { BobProps } from './Bob'

export { Glow } from './Glow'
export type { GlowProps } from './Glow'

export { Reveal } from './Reveal'
export type { RevealProps } from './Reveal'

export { Expandable } from './Expandable'
export type { ExpandableProps } from './Expandable'
