import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
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
import { EmptySlot, PlayingCard } from './PlayingCard'
import styles from './Cabo.module.css'

/** How long a peek stays face up during play. Long enough to read, short
 *  enough that it still has to be remembered. */
const LOOK_MS = 5000

const POWER_TEXT: Record<Power, string> = {
  peek: 'peek at one of your cards',
  spy: 'spy on someone else’s card',
  swap: 'blind swap with someone',
  look: 'look at two cards, then maybe swap',
}

type Props = {
  view: View
  send: (a: Action) => void
  error: { message: string; at: number } | null
}

export function Table({ view, send, error }: Props) {
  const me = view.players.find((p) => p.id === view.me)!
  const isHost = view.me === view.hostId
  const myTurn = view.turn === view.me
  const stage = view.stage
  const showAll = view.phase === 'roundEnd' || view.phase === 'gameOver'
  const current = view.players.find((p) => p.id === view.turn) ?? null

  // ── Selection, reset whenever the move being made changes ──
  const [sel, setSel] = useState<number[]>([])
  const [target, setTarget] = useState<Ref | null>(null)
  const moveKey = `${view.round}|${view.turn}|${stage.kind}`
  useEffect(() => {
    setSel([])
    setTarget(null)
  }, [moveKey])

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

  // ── What can be clicked right now ──
  const power = stage.kind === 'power' ? stage.power : null
  const ownClickable = (slot: number) => {
    if (!me.hand[slot]) return false
    if (view.phase === 'peek') return !me.ready && me.peeked < INITIAL_PEEKS && !me.hand[slot]!.card
    if (!myTurn) return false
    return stage.kind === 'drawn' || power === 'peek' || power === 'swap' || power === 'look'
  }
  const otherClickable = (p: PlayerView, slot: number) =>
    myTurn &&
    !!p.hand[slot] &&
    p.id !== view.caboCaller &&
    (power === 'spy' || power === 'swap' || power === 'look')

  const clickOwn = (slot: number) => {
    if (view.phase === 'peek') return send({ type: 'initialPeek', slot })
    if (stage.kind === 'drawn') {
      return setSel((s) => (s.includes(slot) ? s.filter((x) => x !== slot) : [...s, slot]))
    }
    if (power === 'peek') return send({ type: 'usePeek', slot })
    setSel((s) => (s[0] === slot ? [] : [slot]))
  }
  const clickOther = (ref: Ref) => {
    if (power === 'spy') return send({ type: 'useSpy', target: ref })
    setTarget((t) => (t && t.player === ref.player && t.slot === ref.slot ? null : ref))
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

  return (
    <div className={styles.table}>
      <ErrorToast error={error} />

      <div className={styles.opponents}>
        {others.map((p) => (
          <Seat key={p.id} player={p} view={view}>
            <Hand size="sm">
              {p.hand.map((slot, i) =>
                slot === null ? (
                  <EmptySlot key={i} size="sm" />
                ) : (
                  <PlayingCard
                    key={`${i}-${view.flash?.seq ?? 0}`}
                    size="sm"
                    card={faceOf(p, i)}
                    privateLook={!showAll && !!faceOf(p, i)}
                    active={otherClickable(p, i)}
                    selected={target?.player === p.id && target.slot === i}
                    flash={flashFor(p.id, i)}
                    label={`${p.name}'s card ${i + 1}`}
                    onClick={() => clickOther({ player: p.id, slot: i })}
                  />
                ),
              )}
            </Hand>
          </Seat>
        ))}
      </div>

      <div className={styles.middle}>
        <div className={styles.piles}>
          <Pile label={`deck · ${view.deckCount}`}>
            <PlayingCard
              card={null}
              active={myTurn && stage.kind === 'start'}
              label="Draw from the deck"
              onClick={() => send({ type: 'drawDeck' })}
            />
          </Pile>
          <Pile label="discard">
            {view.discardTop ? (
              <PlayingCard
                card={view.discardTop}
                active={myTurn && stage.kind === 'start'}
                label={`Take the ${cardLabel(view.discardTop)} from the discard pile`}
                onClick={() => send({ type: 'drawDiscard' })}
              />
            ) : (
              <EmptySlot />
            )}
          </Pile>
          {drawn && (
            <Pile label={drawn.from === 'deck' ? 'drawn' : 'taken'} accent>
              <PlayingCard card={drawn.card} />
            </Pile>
          )}
        </div>

        <div className={styles.prompt} aria-live="polite">
          {showAll ? (
            <Results view={view} isHost={isHost} send={send} />
          ) : (
            <>
              <p className={styles.promptText}>{promptText(view, me, current, sel.length, !!target)}</p>
              <div className={styles.actions}>
                {view.phase === 'peek' && !me.ready && (
                  <button
                    type="button"
                    className={styles.primary}
                    disabled={me.peeked < INITIAL_PEEKS}
                    onClick={() => send({ type: 'ready' })}
                  >
                    i’ve memorised them
                  </button>
                )}

                {myTurn && stage.kind === 'start' && !view.caboCaller && (
                  <button type="button" className={styles.cabo} onClick={() => send({ type: 'callCabo' })}>
                    call cabo!
                  </button>
                )}

                {myTurn && drawn && (
                  <>
                    <button
                      type="button"
                      className={styles.primary}
                      disabled={sel.length === 0}
                      onClick={() => send({ type: 'replace', slots: sel })}
                    >
                      {sel.length > 1 ? `swap in for those ${sel.length}` : 'swap it in'}
                    </button>
                    {drawn.from === 'deck' && (
                      <button
                        type="button"
                        className={styles.secondary}
                        onClick={() => send({ type: 'discardDrawn' })}
                      >
                        {drawnPower ? `discard & ${POWER_TEXT[drawnPower]}` : 'discard it'}
                      </button>
                    )}
                  </>
                )}

                {myTurn && (power === 'swap' || power === 'look') && (
                  <button
                    type="button"
                    className={styles.primary}
                    disabled={sel.length !== 1 || !target}
                    onClick={() => {
                      const own = sel[0]
                      if (own === undefined || !target) return
                      send(power === 'swap' ? { type: 'useSwap', own, target } : { type: 'useLook', own, target })
                    }}
                  >
                    {power === 'swap' ? 'swap them' : 'look at them'}
                  </button>
                )}
                {myTurn && power && (
                  <button type="button" className={styles.secondary} onClick={() => send({ type: 'skipPower' })}>
                    skip power
                  </button>
                )}

                {myTurn && stage.kind === 'lookDecide' && (
                  <>
                    <button
                      type="button"
                      className={styles.primary}
                      onClick={() => send({ type: 'lookDecide', swap: true })}
                    >
                      swap them
                    </button>
                    <button
                      type="button"
                      className={styles.secondary}
                      onClick={() => send({ type: 'lookDecide', swap: false })}
                    >
                      leave them
                    </button>
                  </>
                )}

                {isHost && current && !current.connected && (
                  <button type="button" className={styles.secondary} onClick={() => send({ type: 'skipTurn' })}>
                    skip {current.name}’s turn
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <div className={styles.mine}>
        <Seat player={me} view={view} you>
          <Hand size="lg">
            {me.hand.map((slot, i) =>
              slot === null ? (
                <EmptySlot key={i} size="lg" />
              ) : (
                <PlayingCard
                  key={`${i}-${view.flash?.seq ?? 0}`}
                  size="lg"
                  card={faceOf(me, i)}
                  privateLook={!showAll && !!faceOf(me, i)}
                  active={ownClickable(i)}
                  selected={sel.includes(i)}
                  flash={flashFor(me.id, i)}
                  label={`Your card ${i + 1}`}
                  onClick={() => clickOwn(i)}
                />
              ),
            )}
          </Hand>
        </Seat>
      </div>

      <details className={styles.log} open>
        <summary>what’s happened</summary>
        <ol>
          {view.log
            .slice(-8)
            .reverse()
            .map((e) => (
              <li key={e.seq}>{e.text}</li>
            ))}
        </ol>
      </details>
    </div>
  )
}

function promptText(
  view: View,
  me: PlayerView,
  current: PlayerView | null,
  selected: number,
  hasTarget: boolean,
): string {
  if (view.phase === 'peek') {
    if (me.ready) {
      const waiting = view.players.filter((p) => !p.ready && p.connected).map((p) => p.name)
      return `Waiting for ${waiting.join(', ')} to finish peeking…`
    }
    const left = INITIAL_PEEKS - me.peeked
    return left > 0
      ? `Tap ${left === INITIAL_PEEKS ? 'two' : 'one more'} of your cards to peek. Remember them!`
      : 'Got them? They’ll go face down once you’re ready.'
  }

  const stage = view.stage
  const name = current?.name ?? 'someone'

  if (view.turn !== view.me) {
    if (current && !current.connected) return `${name} has lost connection.`
    switch (stage.kind) {
      case 'start':
        return `${name}’s turn.`
      case 'drawn':
        return stage.card
          ? `${name} took the ${cardLabel(stage.card)} and is swapping it in…`
          : `${name} drew a card and is deciding…`
      case 'power':
        return `${name} is using a power: ${POWER_TEXT[stage.power]}.`
      case 'lookDecide':
        return `${name} is deciding whether to swap…`
    }
  }

  const last = view.caboCaller && view.caboCaller !== view.me ? ' This is your last turn!' : ''
  switch (stage.kind) {
    case 'start':
      return `Your turn — draw from the deck or take the discard.${view.caboCaller ? last : ' Or call Cabo.'}`
    case 'drawn':
      if (selected === 0)
        return stage.from === 'deck'
          ? 'Tap one of your cards to swap it out (or several that match), or discard the drawn card.'
          : 'Tap one of your cards to swap it out (or several that match).'
      return selected > 1
        ? 'They must all be the same value — otherwise it’s a penalty card.'
        : 'Swap it in?'
    case 'power':
      switch (stage.power) {
        case 'peek':
          return 'Tap one of your cards to peek at it.'
        case 'spy':
          return 'Tap someone else’s card to spy on it.'
        case 'swap':
        case 'look':
          return selected === 1 && hasTarget
            ? 'Ready.'
            : 'Pick one of your cards and one of someone else’s.'
      }
    case 'lookDecide':
      return 'There they are. Swap them, or leave them?'
  }
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
  return (
    <section className={styles.seat} data-turn={turn} aria-label={you ? 'Your hand' : `${player.name}'s hand`}>
      <header className={styles.seatHead}>
        <span className={styles.dot} data-on={player.connected} />
        <span className={styles.seatName}>{you ? `${player.name} (you)` : player.name}</span>
        <span className={styles.score}>
          {player.score} pts
          {delta !== undefined && <span className={styles.delta}> (+{delta})</span>}
        </span>
        {view.caboCaller === player.id && <span className={styles.badgeHot}>cabo · locked</span>}
        {view.phase === 'peek' && player.ready && <span className={styles.badge}>ready</span>}
        {!player.connected && <span className={styles.badgeWarn}>offline</span>}
      </header>
      {children}
    </section>
  )
}

function Hand({ size, children }: { size: 'sm' | 'lg'; children: ReactNode }) {
  return <div className={`${styles.hand} ${size === 'sm' ? styles.handSm : ''}`}>{children}</div>
}

function Pile({ label, accent, children }: { label: string; accent?: boolean; children: ReactNode }) {
  return (
    <div className={styles.pile} data-accent={accent}>
      {children}
      <span>{label}</span>
    </div>
  )
}

function Results({ view, isHost, send }: { view: View; isHost: boolean; send: (a: Action) => void }) {
  const r = view.result
  if (!r) return null
  const ranked = [...view.players].sort((a, b) => a.score - b.score)
  const over = view.phase === 'gameOver'
  return (
    <div className={styles.results}>
      <h2>{over ? `${ranked[0]!.name} wins!` : `round ${view.round} done`}</h2>
      <p className={styles.muted}>{r.note}.</p>
      <table>
        <thead>
          <tr>
            <th scope="col">player</th>
            <th scope="col">hand</th>
            <th scope="col">round</th>
            <th scope="col">total</th>
          </tr>
        </thead>
        <tbody>
          {ranked.map((p) => (
            <tr key={p.id} data-out={p.score > LIMIT}>
              <th scope="row">{p.name}</th>
              <td>{r.sums[p.id]}</td>
              <td>+{r.delta[p.id]}</td>
              <td>{p.score}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className={styles.actions}>
        {isHost ? (
          over ? (
            <button type="button" className={styles.primary} onClick={() => send({ type: 'newGame' })}>
              new game
            </button>
          ) : (
            <>
              <button type="button" className={styles.primary} onClick={() => send({ type: 'nextRound' })}>
                deal next round
              </button>
              <button type="button" className={styles.textButton} onClick={() => send({ type: 'newGame' })}>
                end game
              </button>
            </>
          )
        ) : (
          <p className={styles.muted}>{over ? 'Waiting for the host…' : 'Waiting for the host to deal…'}</p>
        )}
      </div>
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
