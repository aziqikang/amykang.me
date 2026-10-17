import type { Card } from '@/features/cabo/engine'
import { isRed, RANK_LABEL, SUIT_GLYPH } from '@/features/cabo/engine'
import { Star } from '@/components/chrome/Star'
import styles from './PlayingCard.module.css'

export type PlayingCardProps = {
  /** null draws the back. */
  card: Card | null
  size?: 'sm' | 'md' | 'lg'
  /** Clickable right now — glows and becomes a button. */
  active?: boolean
  selected?: boolean
  /** Restarts the "something happened here" pulse whenever it changes. */
  flash?: 'swap' | 'look' | 'replace' | 'penalty' | null
  /** Shown under a face that only this viewer can see. */
  privateLook?: boolean
  label?: string
  onClick?: () => void
}

export function PlayingCard({
  card,
  size = 'md',
  active,
  selected,
  flash,
  privateLook,
  label,
  onClick,
}: PlayingCardProps) {
  const cls = [
    styles.card,
    styles[size],
    card ? styles.face : styles.back,
    card && isRed(card) ? styles.red : '',
    active ? styles.active : '',
    selected ? styles.selected : '',
    flash ? styles[`flash_${flash}`] : '',
    privateLook ? styles.private : '',
  ]
    .filter(Boolean)
    .join(' ')

  const body = card ? (
    <>
      <span className={styles.corner}>
        {RANK_LABEL[card.rank]}
        <span>{SUIT_GLYPH[card.suit]}</span>
      </span>
      <span className={styles.pip}>{SUIT_GLYPH[card.suit]}</span>
      <span className={`${styles.corner} ${styles.cornerFlip}`}>
        {RANK_LABEL[card.rank]}
        <span>{SUIT_GLYPH[card.suit]}</span>
      </span>
    </>
  ) : (
    <Star size={size === 'sm' ? 12 : 20} className={styles.backStar} />
  )

  if (onClick && active) {
    return (
      <button type="button" className={cls} onClick={onClick} aria-label={label} aria-pressed={selected}>
        {body}
      </button>
    )
  }
  return (
    <div className={cls} role="img" aria-label={label}>
      {body}
    </div>
  )
}

/** An empty hand position, kept so the remaining cards do not shift. */
export function EmptySlot({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  return <div className={`${styles.card} ${styles[size]} ${styles.empty}`} aria-hidden />
}
