import type { HTMLAttributes, Ref } from 'react'
import type { Card } from '@/features/cabo/engine'
import { isRed, RANK_LABEL, SUIT_GLYPH } from '@/features/cabo/engine'
import styles from './PlayingCard.module.css'

export type CardSize = 'xs' | 'sm' | 'md' | 'lg'

export type PlayingCardProps = {
  /** null draws the back. */
  card: Card | null
  size?: CardSize
  /** Has something to do right now — gets the glow ring. */
  active?: boolean
  selected?: boolean
  /** Restarts the "something happened here" pulse whenever it changes. */
  flash?: 'swap' | 'look' | 'replace' | 'penalty' | null
  /** Marks a face that only this viewer can see. */
  privateLook?: boolean
  label?: string
  className?: string
  ref?: Ref<HTMLDivElement>
} & Omit<HTMLAttributes<HTMLDivElement>, 'children'>

/**
 * A flat playing card. Purely presentational: whatever handles taps,
 * double-taps and drags wraps it and passes the handlers through.
 */
export function PlayingCard({
  card,
  size = 'md',
  active,
  selected,
  flash,
  privateLook,
  label,
  className,
  ref,
  ...rest
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
    rest.onClick ? styles.clickable : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      ref={ref}
      className={cls}
      aria-label={label}
      role={rest.onClick ? 'button' : 'img'}
      tabIndex={rest.onClick && active ? 0 : undefined}
      aria-pressed={rest.onClick ? !!selected : undefined}
      {...rest}
    >
      {card ? <Face card={card} /> : <span className={styles.lattice} />}
    </div>
  )
}

function Face({ card }: { card: Card }) {
  const rank = RANK_LABEL[card.rank]
  const suit = SUIT_GLYPH[card.suit]
  const court = card.rank === 1 || card.rank > 10
  return (
    <>
      <span className={styles.corner}>
        {rank}
        <span>{suit}</span>
      </span>
      <span className={court ? styles.court : styles.pip}>{court ? rank : suit}</span>
      <span className={`${styles.corner} ${styles.cornerFlip}`}>
        {rank}
        <span>{suit}</span>
      </span>
    </>
  )
}

/** An empty hand position, kept so the remaining cards do not shift. */
export function EmptySlot({ size = 'md', label }: { size?: CardSize; label?: string }) {
  return (
    <div className={`${styles.card} ${styles[size]} ${styles.empty}`} aria-hidden={!label}>
      {label && <span className={styles.emptyLabel}>{label}</span>}
    </div>
  )
}
