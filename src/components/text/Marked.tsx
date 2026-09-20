import { Fragment } from 'react'
import { useEggs } from '@/features/eggs/EggProvider'
import { NorthStar } from '@/features/eggs/NorthStar'
import styles from './Marked.module.css'

/**
 * `*phrase*` for emphasis, `*phrase|eggId*` for emphasis that also sets off
 * an easter egg.
 */
const MARKER = /\*([^*]+)\*/g

/** The phrase whose egg keeps the full proximity bloom — see <Phrase>. */
const FLAGSHIP = 'north-star'

type Marks = { text: string; egg?: string }

function parse(source: string): (string | Marks)[] {
  const parts: (string | Marks)[] = []
  let cursor = 0

  for (const match of source.matchAll(MARKER)) {
    const at = match.index ?? 0
    if (at > cursor) parts.push(source.slice(cursor, at))
    const [text, egg] = match[1]!.split('|')
    parts.push({ text: text!, egg })
    cursor = at + match[0].length
  }

  if (cursor < source.length) parts.push(source.slice(cursor))
  return parts
}

/**
 * A phrase the reader's eye is meant to land on.
 *
 * Colour, never weight. Bolding was the obvious idea and does not work here:
 * the display face ships a single weight, so `bold` on the heading is the
 * browser smearing glyphs rather than a real cut; and in the body face a real
 * bold widens a phrase by 3.5–4.8%, which shifts every word after it, can
 * rewrap a full line under the cursor, and — worst — can move the phrase out
 * from under the pointer at its trailing edge, unhovering it, shrinking it
 * back, and flickering. Colour changes no metrics at all.
 */
export function Phrase({ text, egg, heading = false }: Marks & { heading?: boolean }) {
  const { fire } = useEggs()

  // The bloom and sparks stay with the north star alone. It is the flagship
  // egg and the effect is worth finding; four phrases throwing sparks across
  // one short intro would just be noise.
  if (egg === FLAGSHIP) return <NorthStar>{text}</NorthStar>

  // In the heading there is no resting tint to inherit — every word there
  // lights up only under the pointer. Without this the one marked word sits
  // permanently in a different colour from the four beside it, which reads
  // as a mistake rather than as a hint.
  const base = heading ? styles.word : styles.phrase

  if (!egg) return <span className={base}>{text}</span>

  return (
    <span className={`${base} ${styles.egg}`} onClick={() => fire(egg)}>
      {text}
    </span>
  )
}

/** Renders a content string, expanding its markers. */
export function Marked({ text }: { text: string }) {
  return (
    <>
      {parse(text).map((part, i) =>
        typeof part === 'string' ? (
          <Fragment key={i}>{part}</Fragment>
        ) : (
          <Phrase key={i} text={part.text} egg={part.egg} />
        ),
      )}
    </>
  )
}

/**
 * The same, but every word responds — used for the page's opening line.
 *
 * No resting tint here, unlike <Marked>: the heading is already where the eye
 * lands, so tinting all of it would recolour the line and guide nobody. It
 * lights up word by word under the pointer instead.
 *
 * Spaces are re-emitted explicitly. Splitting on whitespace and rendering the
 * pieces adjacent is how the sentence silently loses its gaps.
 */
export function Words({ text }: { text: string }) {
  const chunks = parse(text)

  return (
    <>
      {chunks.map((part, i) => {
        if (typeof part !== 'string') {
          return <Phrase key={i} text={part.text} egg={part.egg} heading />
        }

        // split(/(\s+)/) keeps the separators, so whitespace survives intact.
        return part.split(/(\s+)/).map((piece, j) =>
          /^\s+$/.test(piece) || piece === '' ? (
            <Fragment key={`${i}-${j}`}>{piece}</Fragment>
          ) : (
            <span key={`${i}-${j}`} className={styles.word}>
              {piece}
            </span>
          ),
        )
      })}
    </>
  )
}
