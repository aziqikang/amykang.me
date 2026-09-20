import { constellation, starRise } from './effects'

export type EggTrigger =
  /** Keys pressed in order, anywhere on the page. */
  | { type: 'sequence'; keys: string[] }
  /**
   * Fired by its host component via useEggs().fire(id). The component
   * owns the gesture — a click, a hover, a long enough linger — so this
   * carries no condition of its own.
   */
  | { type: 'manual' }
  /**
   * One key, but only while nothing is focused — see EggProvider. Enter
   * and Space are how a keyboard user activates whatever they have tabbed
   * to, so an egg on one must never swallow that.
   */
  | { type: 'press'; key: string }

export type Egg = {
  id: string
  /** Shown in the toast when it's found. */
  label: string
  trigger: EggTrigger
  effect: () => void
}

/**
 * Every easter egg on the site.
 *
 * Adding one is a single object here — no page or component needs to
 * change, unless it's a click egg, which needs its host to call
 * `fire(id)` (see Logo for the pattern).
 */
export const EGGS: Egg[] = [
  {
    id: 'stars',
    label: 'a sky full of stars',
    // Was Enter, which nobody found and which had to fight keyboard
    // activation to exist. The page's own name is the thing people
    // actually poke at.
    trigger: { type: 'manual' },
    effect: starRise,
  },
  {
    id: 'north-star',
    label: 'polaris',
    // Fired by <NorthStar> on a click or a long enough hover.
    trigger: { type: 'manual' },
    effect: constellation,
  },
]

export const SEQUENCE_EGGS = EGGS.filter(
  (egg): egg is Egg & { trigger: Extract<EggTrigger, { type: 'sequence' }> } =>
    egg.trigger.type === 'sequence',
)

export const PRESS_EGGS = EGGS.filter(
  (egg): egg is Egg & { trigger: Extract<EggTrigger, { type: 'press' }> } =>
    egg.trigger.type === 'press',
)

/**
 * Longest sequence we need to keep in the keystroke buffer.
 *
 * Guarded for the empty case: Math.max() of nothing is -Infinity, and
 * slice(-(-Infinity)) silently empties the buffer on every keystroke.
 */
export const MAX_SEQUENCE = SEQUENCE_EGGS.length
  ? Math.max(...SEQUENCE_EGGS.map((e) => e.trigger.keys.length))
  : 0
