import { useEffect, useMemo, useRef, useState, type PointerEvent, type ReactNode, type RefObject } from 'react'
import {
  cardLabel,
  INITIAL_PEEKS,
  LIMIT,
  powerOf,
  type Action,
  type Card,
  type Power,
  type PlayerView,
  type Ref,
  type View,
} from '@/features/cabo/engine'
import { typingIn, useHelp } from './Help'
import { EmptySlot, PlayingCard, type CardSize } from './PlayingCard'
import styles from './Cabo.module.css'

/** How long a peek stays face up during play. Long enough to read, short
 *  enough that it still has to be remembered. */
const LOOK_MS = 5000
/** Two taps closer together than this are a double-tap (stack). */
const DOUBLE_TAP_MS = 280

const POWER_TEXT: Record<Power, string> = {
  peek: 'peek at one of yours',
  spy: 'spy on someone',
  swap: 'blind swap',
  look: 'look at two, maybe swap',
}

type Props = {
  view: View
  send: (a: Action) => void
  error: { message: string; at: number } | null
  logOpen: boolean
  toggleLog: () => void
}

/** One on-screen action. The same list drives the buttons and the keyboard. */
type Btn = {
  label: string
  run: () => void
  /** Shown on the button; keys[0] lowercased is what triggers it. */
  kbd?: string
  keys?: string[]
  tone?: 'primary' | 'secondary' | 'cabo'
  disabled?: boolean
}

export function Table({ view, send, error, logOpen, toggleLog }: Props) {
  const help = useHelp()
  const me = view.players.find((p) => p.id === view.me)!
  const isHost = view.me === view.hostId
  const myTurn = view.turn === view.me
  const stage = view.stage
  const showAll = view.phase === 'roundEnd' || view.phase === 'gameOver'
  const current = view.players.find((p) => p.id === view.turn) ?? null
  const owe = view.pendingGive[view.me] ?? null
  const iHaveCards = me.hand.some((c) => c !== null)
  const pileRef = useRef<HTMLDivElement>(null)

  // Hands are laid out in columns of two, but number keys read like a
  // page: 1 2 across the top, then 3 4 along the bottom.
  const cols = Math.ceil(me.hand.length / 2)
  const keyOf = (slot: number) => (slot % 2 === 0 ? slot / 2 : cols + (slot - 1) / 2) + 1
  const slotOfKey = (n: number) => me.hand.findIndex((_, i) => keyOf(i) === n)
  const hovered = useRef<Ref | null>(null)

  // ── Selection, reset whenever the move being made changes ──
  const [sel, setSel] = useState<number[]>([])
  const [target, setTarget] = useState<Ref | null>(null)
  const moveKey = `${view.round}|${view.turn}|${stage.kind}`
  useEffect(() => {
    setSel([])
    setTarget(null)
  }, [moveKey])

  // Calling Cabo from the keyboard takes two presses of C.
  const [caboArmed, setCaboArmed] = useState(false)
  useEffect(() => {
    if (!caboArmed) return
    const t = setTimeout(() => setCaboArmed(false), 2500)
    return () => clearTimeout(t)
  }, [caboArmed])

  // ── Private looks fade after a few seconds during play ──
  const [faded, setFaded] = useState<Set<string>>(() => new Set())
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  const holdLooks = view.phase === 'peek' || (myTurn && stage.kind === 'lookDecide')
  useEffect(() => {
    if (showAll || holdLooks) return
    for (const p of view.players) {
      p.hand.forEach((slot, i) => {
        if (!slot?.card) return
        const key = `${p.id}:${i}:${slot.card.id}`
        if (timers.current.has(key)) return
        timers.current.set(
          key,
          setTimeout(() => setFaded((f) => new Set(f).add(key)), LOOK_MS),
        )
      })
    }
  }, [view, showAll, holdLooks])
  useEffect(() => {
    const t = timers.current
    return () => t.forEach(clearTimeout)
  }, [])

  const faceOf = (p: PlayerView, slot: number): Card | null => {
    const c = p.hand[slot]?.card ?? null
    if (!c || showAll || holdLooks) return c
    return faded.has(`${p.id}:${slot}:${c.id}`) ? null : c
  }

  // ── What each card does when tapped ──
  const power = stage.kind === 'power' ? stage.power : null

  const ownTap = (slot: number): (() => void) | undefined => {
    if (!me.hand[slot]) return undefined
    if (owe) return () => send({ type: 'give', slot })
    if (view.phase === 'peek') {
      if (me.ready || me.peeked >= INITIAL_PEEKS || me.hand[slot]!.card) return undefined
      return () => send({ type: 'initialPeek', slot })
    }
    if (!myTurn) return undefined
    if (stage.kind === 'drawn')
      return () => setSel((s) => (s.includes(slot) ? s.filter((x) => x !== slot) : [...s, slot]))
    if (power === 'peek') return () => send({ type: 'usePeek', slot })
    if (power === 'swap' || power === 'look') return () => setSel((s) => (s[0] === slot ? [] : [slot]))
    return undefined
  }

  const otherTap = (p: PlayerView, slot: number): (() => void) | undefined => {
    if (!myTurn || !p.hand[slot] || p.id === view.caboCaller || owe) return undefined
    const ref = { player: p.id, slot }
    if (power === 'spy') return () => send({ type: 'useSpy', target: ref })
    if (power === 'swap' || power === 'look')
      return () => setTarget((t) => (t && t.player === ref.player && t.slot === ref.slot ? null : ref))
    return undefined
  }

  const stackFor = (ref: Ref): (() => void) | undefined => {
    const top = view.discardTop
    const owner = view.players.find((p) => p.id === ref.player)
    if (view.phase !== 'turn' || !top || owe || !owner?.hand[ref.slot]) return undefined
    if (view.me === view.caboCaller || ref.player === view.caboCaller) return undefined
    if (ref.player !== view.me && !iHaveCards) return undefined
    return () => send({ type: 'stack', target: ref, expectTop: top.id })
  }

  const flashFor = (player: string, slot: number) =>
    view.flash?.refs.some((r) => r.player === player && r.slot === slot) ? view.flash.kind : null

  // Seat everyone else in turn order, starting from whoever sits after you.
  const others = useMemo(() => {
    const i = view.players.findIndex((p) => p.id === view.me)
    return [...view.players.slice(i + 1), ...view.players.slice(0, i)]
  }, [view.players, view.me])

  const drawn = stage.kind === 'drawn' ? stage : null
  const drawnPower = drawn?.card && drawn.from === 'deck' ? powerOf(drawn.card) : null

  // ── The action list ──
  const buttons: Btn[] = []
  if (showAll) {
    if (isHost && view.phase === 'roundEnd') {
      buttons.push({ label: 'deal next round', kbd: 'Enter', keys: ['enter'], run: () => send({ type: 'nextRound' }) })
      buttons.push({ label: 'end game', tone: 'secondary', run: () => send({ type: 'newGame' }) })
    } else if (isHost) {
      buttons.push({ label: 'new game', kbd: 'Enter', keys: ['enter'], run: () => send({ type: 'newGame' }) })
    }
  } else if (view.phase === 'peek' && !me.ready) {
    buttons.push({
      label: 'i’ve memorised them',
      kbd: 'Enter',
      keys: ['enter'],
      disabled: me.peeked < INITIAL_PEEKS,
      run: () => send({ type: 'ready' }),
    })
  } else if (myTurn && !owe) {
    if (stage.kind === 'start') {
      buttons.push({ label: 'draw', kbd: 'D', keys: ['d'], run: () => send({ type: 'drawDeck' }) })
      buttons.push({
        label: 'take discard',
        kbd: 'T',
        keys: ['t'],
        tone: 'secondary',
        disabled: !view.discardTop || !iHaveCards,
        run: () => send({ type: 'drawDiscard' }),
      })
      if (!view.caboCaller) {
        buttons.push({
          label: caboArmed ? 'press C again — cabo!' : 'call cabo',
          kbd: 'C',
          keys: ['c'],
          tone: 'cabo',
          run: () => send({ type: 'callCabo' }),
        })
      }
    } else if (drawn) {
      if (!iHaveCards) {
        buttons.push({ label: 'take it', kbd: 'Enter', keys: ['enter'], run: () => send({ type: 'replace', slots: [] }) })
      } else {
        buttons.push({
          label: sel.length > 1 ? `swap in for those ${sel.length}` : 'swap it in',
          kbd: 'Enter',
          keys: ['enter'],
          disabled: sel.length === 0,
          run: () => send({ type: 'replace', slots: sel }),
        })
      }
      if (drawn.from === 'deck') {
        buttons.push({
          label: drawnPower ? `discard · ${POWER_TEXT[drawnPower]}` : 'discard',
          kbd: 'X',
          keys: ['x'],
          tone: 'secondary',
          run: () => send({ type: 'discardDrawn' }),
        })
      }
    } else if (power) {
      if (power === 'swap' || power === 'look') {
        buttons.push({
          label: power === 'swap' ? 'swap them' : 'look at them',
          kbd: 'Enter',
          keys: ['enter'],
          disabled: sel.length !== 1 || !target,
          run: () => {
            const own = sel[0]
            if (own === undefined || !target) return
            send(power === 'swap' ? { type: 'useSwap', own, target } : { type: 'useLook', own, target })
          },
        })
      }
      buttons.push({ label: 'skip power', kbd: 'Esc', keys: ['escape'], tone: 'secondary', run: () => send({ type: 'skipPower' }) })
    } else if (stage.kind === 'lookDecide') {
      buttons.push({ label: 'swap them', kbd: 'Y', keys: ['y'], run: () => send({ type: 'lookDecide', swap: true }) })
      buttons.push({ label: 'leave them', kbd: 'N', keys: ['n'], tone: 'secondary', run: () => send({ type: 'lookDecide', swap: false }) })
    }
  }
  if (isHost && current && !current.connected && view.phase === 'turn') {
    buttons.push({ label: `skip ${current.name}’s turn`, tone: 'secondary', run: () => send({ type: 'skipTurn' }) })
  }

  // ── Keyboard ──
  const latest = useRef({ buttons, ownTap, stackFor, slotOfKey, caboArmed, toggleLog, help, setSel, setTarget })
  latest.current = { buttons, ownTap, stackFor, slotOfKey, caboArmed, toggleLog, help, setSel, setTarget }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const l = latest.current
      if (l.help.isOpen || typingIn(e) || e.metaKey || e.ctrlKey || e.altKey) return
      const key = e.key.toLowerCase()
      // Enter on a focused button already clicks it.
      if (key === 'enter' && (e.target as HTMLElement).tagName === 'BUTTON') return

      if (/^[1-9]$/.test(key)) {
        const slot = l.slotOfKey(Number(key))
        const tap = slot >= 0 ? l.ownTap(slot) : undefined
        if (tap) {
          e.preventDefault()
          tap()
        }
        return
      }
      if (key === 's') {
        const stack = hovered.current && l.stackFor(hovered.current)
        if (stack) {
          e.preventDefault()
          stack()
        }
        return
      }
      if (key === 'l') {
        e.preventDefault()
        l.toggleLog()
        return
      }
      const btn = l.buttons.find((b) => b.keys?.includes(key) && !b.disabled)
      if (btn) {
        e.preventDefault()
        if (key === 'c' && !l.caboArmed) setCaboArmed(true)
        else btn.run()
        return
      }
      if (key === 'escape') {
        l.setSel([])
        l.setTarget(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const stackTitle = 'double-click, drag to the pile, or hover + S to stack'

  return (
    <div className={styles.tableWrap}>
      <ErrorToast error={error} />

      <div className={`${styles.felt} ${styles.table}`}>
        <div className={styles.opponents}>
          {others.map((p) => (
            <Seat key={p.id} player={p} view={view}>
              <Hand>
                {p.hand.map((slot, i) => {
                  if (slot === null)
                    return <EmptySlot key={i} size="sm" label={gapLabel(view, p.id, i)} />
                  const ref = { player: p.id, slot: i }
                  const face = faceOf(p, i)
                  return (
                    <TableCard
                      key={`${i}-${view.flash?.seq ?? 0}`}
                      size="sm"
                      card={face}
                      privateLook={!showAll && !!face}
                      active={!!otherTap(p, i)}
                      selected={target?.player === p.id && target.slot === i}
                      flash={flashFor(p.id, i)}
                      label={`${p.name}'s card ${i + 1}`}
                      title={stackFor(ref) ? stackTitle : undefined}
                      onTap={otherTap(p, i)}
                      onStack={stackFor(ref)}
                      onHover={(on) => (hovered.current = on ? ref : null)}
                      pileRef={pileRef}
                    />
                  )
                })}
              </Hand>
            </Seat>
          ))}
        </div>

        <div className={styles.middle}>
          {showAll ? (
            <Results view={view} />
          ) : (
            <div className={styles.piles}>
              <Pile label={`deck · ${view.deckCount}`}>
                <PlayingCard
                  card={null}
                  size="md"
                  active={myTurn && stage.kind === 'start' && !owe}
                  label="Draw from the deck"
                  title="Draw (D)"
                  onClick={myTurn && stage.kind === 'start' && !owe ? () => send({ type: 'drawDeck' }) : undefined}
                />
              </Pile>
              <Pile label="discard" pileRef={pileRef} hint={view.phase === 'turn' ? 'stack here' : undefined}>
                {view.discardTop ? (
                  <PlayingCard
                    key={view.discardTop.id}
                    className={styles.landed}
                    card={view.discardTop}
                    size="md"
                    active={myTurn && stage.kind === 'start' && !owe && iHaveCards}
                    label={`Discard pile: ${cardLabel(view.discardTop)}`}
                    title="Take the discard (T)"
                    onClick={
                      myTurn && stage.kind === 'start' && !owe && iHaveCards
                        ? () => send({ type: 'drawDiscard' })
                        : undefined
                    }
                  />
                ) : (
                  <EmptySlot size="md" />
                )}
              </Pile>
              {drawn && (
                <Pile label={drawn.from === 'deck' ? `${current?.name ?? ''} drew` : `${current?.name ?? ''} took`} accent>
                  <PlayingCard card={drawn.card} size="md" />
                </Pile>
              )}
            </div>
          )}

          <div className={styles.prompt} aria-live="polite">
            <p className={styles.promptText}>
              {showAll
                ? view.result?.note
                  ? `${view.result.note}.`
                  : ''
                : promptText(view, me, current, sel.length, !!target)}
            </p>
            {buttons.length > 0 && (
              <div className={styles.actions}>
                {buttons.map((b) => (
                  <button
                    key={b.label}
                    type="button"
                    className={styles[b.tone ?? 'primary']}
                    disabled={b.disabled}
                    onClick={b.run}
                    title={b.kbd ? `${b.label} (${b.kbd})` : undefined}
                  >
                    {b.label}
                    {b.kbd && <kbd>{b.kbd}</kbd>}
                  </button>
                ))}
              </div>
            )}
            {showAll && !isHost && (
              <p className={styles.muted}>Waiting for the host{view.phase === 'roundEnd' ? ' to deal' : ''}…</p>
            )}
            {!showAll && view.log.length > 0 && <p className={styles.ticker}>{view.log.at(-1)!.text}</p>}
          </div>
        </div>

        <div className={styles.mine}>
          <Seat player={me} view={view} you>
            <Hand big>
              {me.hand.map((slot, i) => {
                if (slot === null) return <EmptySlot key={i} size="lg" label={gapLabel(view, me.id, i)} />
                const ref = { player: me.id, slot: i }
                const face = faceOf(me, i)
                const tap = ownTap(i)
                const stack = stackFor(ref)
                return (
                  <TableCard
                    key={`${i}-${view.flash?.seq ?? 0}`}
                    size="lg"
                    card={face}
                    privateLook={!showAll && !!face}
                    active={!!tap && !(stage.kind === 'drawn' && sel.includes(i))}
                    selected={sel.includes(i)}
                    flash={flashFor(me.id, i)}
                    label={`Your card ${i + 1}`}
                    badge={keyOf(i) <= 9 ? String(keyOf(i)) : undefined}
                    title={[tap ? `press ${keyOf(i)}` : '', stack ? stackTitle : ''].filter(Boolean).join(' · ') || undefined}
                    onTap={tap}
                    onStack={stack}
                    onHover={(on) => (hovered.current = on ? ref : null)}
                    pileRef={pileRef}
                  />
                )
              })}
            </Hand>
          </Seat>
        </div>
      </div>

      {logOpen && (
        <aside className={styles.log} aria-label="Game log">
          <div className={styles.logHead}>
            <h2>log</h2>
            <button type="button" className={styles.iconButton} onClick={toggleLog} aria-label="Close log" title="Close (L)">
              ✕
            </button>
          </div>
          <ol>
            {view.log
              .slice()
              .reverse()
              .map((e) => (
                <li key={e.seq}>{e.text}</li>
              ))}
          </ol>
        </aside>
      )}
    </div>
  )
}

/** Names the gap a stacked card left, while its new card is still owed. */
function gapLabel(view: View, player: string, slot: number) {
  for (const [giver, gap] of Object.entries(view.pendingGive)) {
    if (gap.player === player && gap.slot === slot) {
      return `from ${view.players.find((p) => p.id === giver)?.name ?? '…'}`
    }
  }
  return undefined
}

function promptText(
  view: View,
  me: PlayerView,
  current: PlayerView | null,
  selected: number,
  hasTarget: boolean,
): string {
  const owe = view.pendingGive[view.me]
  if (owe) {
    const to = view.players.find((p) => p.id === owe.player)?.name ?? 'them'
    return `Nice stack! Now tap one of your cards to give to ${to}.`
  }

  if (view.phase === 'peek') {
    if (me.ready) {
      const waiting = view.players.filter((p) => !p.ready && p.connected).map((p) => p.name)
      return `Waiting for ${waiting.join(', ')} to finish peeking…`
    }
    const left = INITIAL_PEEKS - me.peeked
    return left > 0
      ? `Tap ${left === INITIAL_PEEKS ? 'two' : 'one more'} of your cards to peek. Remember them!`
      : 'Got them? They go face down once you’re ready.'
  }

  const stage = view.stage
  const name = current?.name ?? 'someone'

  if (view.turn !== view.me) {
    if (current && !current.connected) return `${name} has lost connection.`
    switch (stage.kind) {
      case 'start':
        return `${name}’s turn.`
      case 'drawn':
        return stage.card ? `${name} took the ${cardLabel(stage.card)}…` : `${name} drew a card…`
      case 'power':
        return `${name} is using a power: ${POWER_TEXT[stage.power]}.`
      case 'lookDecide':
        return `${name} is deciding whether to swap…`
    }
  }

  const last = view.caboCaller && view.caboCaller !== view.me ? ' Last turn!' : ''
  switch (stage.kind) {
    case 'start':
      return `Your turn — draw, or take the discard.${last}`
    case 'drawn':
      if (selected === 0)
        return stage.from === 'deck'
          ? 'Pick a card to swap out (or several that match), or discard it.'
          : 'Pick a card to swap out (or several that match).'
      return selected > 1 ? 'They must all match, or it’s a penalty card.' : 'Swap it in?'
    case 'power':
      switch (stage.power) {
        case 'peek':
          return 'Tap one of your cards to peek at it.'
        case 'spy':
          return 'Tap someone else’s card to spy on it.'
        case 'swap':
        case 'look':
          return selected === 1 && hasTarget ? 'Ready.' : 'Pick one of yours and one of theirs.'
      }
    case 'lookDecide':
      return 'There they are. Swap them, or leave them?'
  }
}

// ── Cards that can be tapped, double-tapped and thrown ──

type TableCardProps = {
  card: Card | null
  size: CardSize
  active: boolean
  selected: boolean
  flash: 'swap' | 'look' | 'replace' | 'penalty' | null
  privateLook: boolean
  label: string
  title?: string
  badge?: string
  onTap?: () => void
  onStack?: () => void
  onHover: (on: boolean) => void
  pileRef: RefObject<HTMLDivElement | null>
}

/**
 * A card in a hand. One tap does whatever the card does right now;
 * a double-tap, a drag onto the pile, or a flick toward it stacks it.
 *
 * When a card can be stacked, a single tap waits out the double-tap
 * window before acting, so the two never both fire.
 */
function TableCard(props: TableCardProps) {
  const { onTap, onStack, pileRef, onHover, badge, ...card } = props
  const [offset, setOffset] = useState<{ x: number; y: number } | null>(null)
  const g = useRef({
    start: null as { x: number; y: number; id: number } | null,
    dragging: false,
    suppress: false,
    lastTap: 0,
    timer: null as ReturnType<typeof setTimeout> | null,
  })
  useEffect(() => {
    const s = g.current
    return () => {
      if (s.timer) clearTimeout(s.timer)
    }
  }, [])

  const reset = () => {
    g.current.start = null
    g.current.dragging = false
    setOffset(null)
  }

  const handlers = {
    onPointerDown: (e: PointerEvent<HTMLDivElement>) => {
      if (e.button > 0) return
      g.current.start = { x: e.clientX, y: e.clientY, id: e.pointerId }
      g.current.dragging = false
      g.current.suppress = false
    },
    onPointerMove: (e: PointerEvent<HTMLDivElement>) => {
      const s = g.current.start
      if (!s || s.id !== e.pointerId || !onStack) return
      const x = e.clientX - s.x
      const y = e.clientY - s.y
      if (!g.current.dragging && Math.hypot(x, y) > 10) {
        g.current.dragging = true
        e.currentTarget.setPointerCapture(e.pointerId)
      }
      if (g.current.dragging) setOffset({ x, y })
    },
    onPointerUp: (e: PointerEvent<HTMLDivElement>) => {
      const s = g.current.start
      const wasDragging = g.current.dragging
      reset()
      if (!s || !wasDragging) return
      g.current.suppress = true
      const pile = pileRef.current?.getBoundingClientRect()
      if (!pile || !onStack) return
      const pad = 36
      const dropped =
        e.clientX > pile.left - pad &&
        e.clientX < pile.right + pad &&
        e.clientY > pile.top - pad &&
        e.clientY < pile.bottom + pad
      // A flick: a decisive move pointing roughly at the pile.
      const mx = e.clientX - s.x
      const my = e.clientY - s.y
      const tx = pile.left + pile.width / 2 - s.x
      const ty = pile.top + pile.height / 2 - s.y
      const moved = Math.hypot(mx, my)
      const angle = Math.acos((mx * tx + my * ty) / (moved * Math.hypot(tx, ty) || 1))
      const flicked = moved > 45 && angle < 0.6
      if (dropped || flicked) onStack()
    },
    onPointerCancel: reset,
    onClick: () => {
      if (g.current.suppress) {
        g.current.suppress = false
        return
      }
      if (!onStack) return onTap?.()
      const now = Date.now()
      if (now - g.current.lastTap < DOUBLE_TAP_MS) {
        if (g.current.timer) clearTimeout(g.current.timer)
        g.current.timer = null
        g.current.lastTap = 0
        onStack()
        return
      }
      g.current.lastTap = now
      if (onTap) {
        const tap = onTap
        g.current.timer = setTimeout(() => {
          g.current.timer = null
          tap()
        }, DOUBLE_TAP_MS)
      }
    },
    onPointerEnter: () => onHover(true),
    onPointerLeave: () => onHover(false),
  }

  const interactive = !!(onTap || onStack)
  return (
    <div
      className={`${styles.slot} ${onStack ? styles.throwable : ''} ${offset ? styles.dragging : ''}`}
      style={offset ? { transform: `translate(${offset.x}px, ${offset.y}px) rotate(${offset.x / 30}deg)` } : undefined}
    >
      <PlayingCard
        {...card}
        {...(interactive ? handlers : { onPointerEnter: handlers.onPointerEnter, onPointerLeave: handlers.onPointerLeave })}
        onKeyDown={
          interactive
            ? (e) => {
                if (e.key === ' ' || e.key === 'Enter') {
                  e.preventDefault()
                  e.stopPropagation()
                  onTap?.()
                }
              }
            : undefined
        }
      />
      {badge && <kbd className={styles.slotKey}>{badge}</kbd>}
    </div>
  )
}

function Seat({
  player,
  view,
  you,
  children,
}: {
  player: PlayerView
  view: View
  you?: boolean
  children: ReactNode
}) {
  const turn = view.turn === player.id
  const delta = view.result?.delta[player.id]
  const owes = view.pendingGive[player.id]
  return (
    <section
      className={`${styles.seat} ${you ? styles.seatMine : ''}`}
      data-turn={turn}
      aria-label={you ? 'Your hand' : `${player.name}'s hand`}
    >
      {children}
      <header className={styles.plate}>
        <span className={styles.dot} data-on={player.connected} />
        <span className={styles.plateName}>{you ? `${player.name} (you)` : player.name}</span>
        <span className={styles.score}>
          {player.score}
          {delta !== undefined && <span className={styles.delta}> +{delta}</span>}
        </span>
        {view.caboCaller === player.id && <span className={styles.chipHot}>cabo · locked</span>}
        {view.phase === 'peek' && player.ready && <span className={styles.chip}>ready</span>}
        {owes && !you && (
          <span className={styles.chip}>owes {view.players.find((p) => p.id === owes.player)?.name}</span>
        )}
        {showSum(view, player.id)}
        {!player.connected && <span className={styles.chipWarn}>offline</span>}
      </header>
    </section>
  )
}

function showSum(view: View, id: string) {
  const sum = view.result?.sums[id]
  return sum === undefined ? null : <span className={styles.chip}>hand {sum}</span>
}

function Hand({ big, children }: { big?: boolean; children: ReactNode }) {
  return <div className={`${styles.hand} ${big ? styles.handBig : ''}`}>{children}</div>
}

function Pile({
  label,
  accent,
  hint,
  pileRef,
  children,
}: {
  label: string
  accent?: boolean
  hint?: string
  pileRef?: RefObject<HTMLDivElement | null>
  children: ReactNode
}) {
  return (
    <div className={styles.pile} data-accent={accent}>
      <div ref={pileRef} className={styles.pileTarget} data-hint={hint}>
        {children}
      </div>
      <span>{label}</span>
    </div>
  )
}

function Results({ view }: { view: View }) {
  const r = view.result
  if (!r) return null
  const ranked = [...view.players].sort((a, b) => a.score - b.score)
  const over = view.phase === 'gameOver'
  return (
    <div className={styles.results}>
      <h2>{over ? `${ranked[0]!.name} wins!` : `round ${view.round}`}</h2>
      <table>
        <thead>
          <tr>
            <th scope="col">player</th>
            <th scope="col">hand</th>
            <th scope="col">+</th>
            <th scope="col">total</th>
          </tr>
        </thead>
        <tbody>
          {ranked.map((p) => (
            <tr key={p.id} data-out={p.score > LIMIT}>
              <th scope="row">{p.name}</th>
              <td>{r.sums[p.id]}</td>
              <td>{r.delta[p.id]}</td>
              <td>{p.score}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ErrorToast({ error }: { error: Props['error'] }) {
  const [shown, setShown] = useState<Props['error']>(null)
  useEffect(() => {
    if (!error) return
    setShown(error)
    const t = setTimeout(() => setShown(null), 3200)
    return () => clearTimeout(t)
  }, [error])
  if (!shown) return null
  return (
    <div className={styles.toast} role="alert" key={shown.at}>
      {shown.message}
    </div>
  )
}
