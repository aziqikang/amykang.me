/**
 * Cabo, played with a standard 52-card deck.
 *
 * Pure and deterministic apart from the shuffle: the host holds a
 * GameState, feeds every player's Action through `apply`, and sends each
 * player `viewFor(state, theirId)` — a copy with every card they are not
 * entitled to see blanked out. Guests never receive the deck or anyone's
 * face-down cards, so there is nothing to cheat with in devtools.
 *
 * Card values: A = 1, 2–10 face value, J = 11, Q = 12, black K = 13,
 * red K = −1. Powers fire only when a card drawn from the DECK is
 * discarded straight away:
 *   7, 8      peek   — look at one of your own cards
 *   9, 10     spy    — look at one card of another player's
 *   J, Q      swap   — blindly swap one of yours with one of theirs
 *   black K   look   — look at one of yours and one of theirs, then
 *                      decide whether to swap them
 */

export type Suit = 'S' | 'H' | 'D' | 'C'
export type Card = { id: number; rank: number; suit: Suit }

export type Power = 'peek' | 'spy' | 'swap' | 'look'

/** A hand position. Slots keep their place when cards leave a hand. */
export type Ref = { player: string; slot: number }

export const MIN_PLAYERS = 2
export const MAX_PLAYERS = 5
export const HAND_SIZE = 4
export const INITIAL_PEEKS = 2
export const CABO_PENALTY = 10
export const KAMIKAZE_PENALTY = 50
export const LIMIT = 100
const LOG_LENGTH = 40

export const isRed = (c: Card) => c.suit === 'H' || c.suit === 'D'

export function value(c: Card): number {
  if (c.rank === 13 && isRed(c)) return -1
  return c.rank
}

export function powerOf(c: Card): Power | null {
  if (c.rank === 7 || c.rank === 8) return 'peek'
  if (c.rank === 9 || c.rank === 10) return 'spy'
  if (c.rank === 11 || c.rank === 12) return 'swap'
  if (c.rank === 13 && !isRed(c)) return 'look'
  return null
}

export const RANK_LABEL = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
export const SUIT_GLYPH: Record<Suit, string> = { S: '♠', H: '♥', D: '♦', C: '♣' }
export const cardLabel = (c: Card) => `${RANK_LABEL[c.rank]}${SUIT_GLYPH[c.suit]}`

export type Player = {
  id: string
  name: string
  hand: (Card | null)[]
  score: number
  connected: boolean
  /** Opening-peek slots chosen so far. */
  peeked: number[]
  ready: boolean
}

export type Stage =
  | { kind: 'start' }
  | { kind: 'drawn'; card: Card; from: 'deck' | 'discard' }
  | { kind: 'power'; power: Power }
  | { kind: 'lookDecide'; own: Ref; other: Ref }

export type LogEntry = { seq: number; text: string }

/** Something every player should notice: cards that just moved or were looked at. */
export type Flash = { seq: number; refs: Ref[]; kind: 'swap' | 'look' | 'replace' | 'penalty' }

/** A card a player is privately looking at. Keyed to the card id so it
 *  stops showing the moment that card moves. */
export type Reveal = { ref: Ref; card: Card }

export type RoundResult = {
  hands: Record<string, Card[]>
  sums: Record<string, number>
  delta: Record<string, number>
  caller: string | null
  kamikaze: string | null
  note: string
}

export type Phase = 'lobby' | 'peek' | 'turn' | 'roundEnd' | 'gameOver'

export type GameState = {
  code: string
  hostId: string
  players: Player[]
  phase: Phase
  deck: Card[]
  discard: Card[]
  turn: number
  stage: Stage
  caboCaller: string | null
  round: number
  /** Who leads off this round; rotates each round. */
  starter: number
  log: LogEntry[]
  flash: Flash | null
  reveals: Record<string, Reveal[]>
  result: RoundResult | null
  seq: number
}

export type Action =
  | { type: 'start' }
  | { type: 'kick'; player: string }
  | { type: 'initialPeek'; slot: number }
  | { type: 'ready' }
  | { type: 'drawDeck' }
  | { type: 'drawDiscard' }
  | { type: 'callCabo' }
  | { type: 'replace'; slots: number[] }
  | { type: 'discardDrawn' }
  | { type: 'usePeek'; slot: number }
  | { type: 'useSpy'; target: Ref }
  | { type: 'useSwap'; own: number; target: Ref }
  | { type: 'useLook'; own: number; target: Ref }
  | { type: 'lookDecide'; swap: boolean }
  | { type: 'skipPower' }
  | { type: 'skipTurn' }
  | { type: 'nextRound' }
  | { type: 'newGame' }

export class RuleError extends Error {}

function fail(msg: string): never {
  throw new RuleError(msg)
}

// ── Setup ────────────────────────────────────────────────

export function newDeck(): Card[] {
  const cards: Card[] = []
  let id = 0
  for (const suit of ['S', 'H', 'D', 'C'] as Suit[]) {
    for (let rank = 1; rank <= 13; rank++) cards.push({ id: id++, rank, suit })
  }
  return shuffle(cards)
}

function shuffle<T>(items: T[]): T[] {
  const a = items.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j]!, a[i]!]
  }
  return a
}

export function createGame(code: string, hostId: string, hostName: string): GameState {
  return {
    code,
    hostId,
    players: [blankPlayer(hostId, hostName)],
    phase: 'lobby',
    deck: [],
    discard: [],
    turn: 0,
    stage: { kind: 'start' },
    caboCaller: null,
    round: 0,
    starter: 0,
    log: [],
    flash: null,
    reveals: {},
    result: null,
    seq: 0,
  }
}

function blankPlayer(id: string, name: string): Player {
  return { id, name, hand: [], score: 0, connected: true, peeked: [], ready: false }
}

/** Adds a player in the lobby, or marks a returning one as connected. */
export function join(s: GameState, id: string, name: string): GameState {
  const existing = s.players.find((p) => p.id === id)
  if (existing) {
    const next = clone(s)
    const p = next.players.find((q) => q.id === id)!
    p.connected = true
    return next
  }
  if (s.phase !== 'lobby') fail('That game has already started.')
  if (s.players.length >= MAX_PLAYERS) fail(`That room is full (${MAX_PLAYERS} players).`)
  const next = clone(s)
  next.players.push(blankPlayer(id, uniqueName(next, name)))
  say(next, `${next.players.at(-1)!.name} joined`)
  return next
}

export function setConnected(s: GameState, id: string, connected: boolean): GameState {
  const next = clone(s)
  const p = next.players.find((q) => q.id === id)
  if (!p || p.connected === connected) return s
  p.connected = connected
  // Leaving the lobby means leaving: nobody should be dealt in absent.
  if (!connected && next.phase === 'lobby') {
    next.players = next.players.filter((q) => q.id !== id)
    say(next, `${p.name} left`)
  } else {
    say(next, connected ? `${p.name} reconnected` : `${p.name} lost connection`)
    if (next.phase === 'peek') maybeBeginTurns(next)
  }
  return next
}

function uniqueName(s: GameState, raw: string) {
  const base = raw.trim().slice(0, 16) || 'player'
  let name = base
  for (let n = 2; s.players.some((p) => p.name === name); n++) name = `${base} ${n}`
  return name
}

function deal(s: GameState) {
  s.deck = newDeck()
  s.discard = []
  for (const p of s.players) {
    p.hand = s.deck.splice(0, HAND_SIZE)
    p.peeked = []
    p.ready = false
  }
  s.discard.push(s.deck.pop()!)
  s.caboCaller = null
  s.result = null
  s.flash = null
  s.reveals = {}
  s.stage = { kind: 'start' }
  s.round += 1
  s.phase = 'peek'
  say(s, `Round ${s.round} dealt — everyone peek at two of your cards`)
}

// ── Actions ──────────────────────────────────────────────

/** Applies one player's action. Throws RuleError when it is not allowed. */
export function apply(prev: GameState, by: string, action: Action): GameState {
  const s = clone(prev)
  const me = s.players.find((p) => p.id === by) ?? fail('You are not in this game.')
  const isHost = by === s.hostId

  // A private look lasts until your next move.
  if (action.type !== 'initialPeek') delete s.reveals[by]

  switch (action.type) {
    case 'start': {
      if (!isHost) fail('Only the host can start.')
      if (s.phase !== 'lobby') fail('Already started.')
      if (s.players.length < MIN_PLAYERS) fail(`Need at least ${MIN_PLAYERS} players.`)
      s.starter = Math.floor(Math.random() * s.players.length)
      deal(s)
      return s
    }

    case 'kick': {
      if (!isHost) fail('Only the host can remove players.')
      if (s.phase !== 'lobby') fail('Players can only be removed in the lobby.')
      if (action.player === s.hostId) fail('The host cannot leave their own room.')
      const p = s.players.find((q) => q.id === action.player)
      if (!p) return prev
      s.players = s.players.filter((q) => q.id !== action.player)
      say(s, `${p.name} was removed`)
      return s
    }

    case 'initialPeek': {
      if (s.phase !== 'peek') fail('The opening peek is over.')
      if (me.ready) fail('You already finished peeking.')
      if (me.peeked.includes(action.slot)) return prev
      if (me.peeked.length >= INITIAL_PEEKS) fail(`You only get ${INITIAL_PEEKS} peeks.`)
      const card = me.hand[action.slot] ?? fail('No card there.')
      me.peeked.push(action.slot)
      ;(s.reveals[by] ??= []).push({ ref: { player: by, slot: action.slot }, card })
      return s
    }

    case 'ready': {
      if (s.phase !== 'peek') fail('Not in the peek phase.')
      if (me.peeked.length < INITIAL_PEEKS) fail(`Peek at ${INITIAL_PEEKS} cards first.`)
      me.ready = true
      maybeBeginTurns(s)
      return s
    }

    case 'nextRound': {
      if (!isHost) fail('Only the host can deal.')
      if (s.phase !== 'roundEnd') fail('The round is not over.')
      s.starter = (s.starter + 1) % s.players.length
      deal(s)
      return s
    }

    case 'newGame': {
      if (!isHost) fail('Only the host can restart.')
      if (s.phase !== 'gameOver' && s.phase !== 'roundEnd') fail('The game is still going.')
      // Players who dropped out mid-game do not carry into the next one.
      s.players = s.players.filter((p) => p.connected)
      for (const p of s.players) {
        p.score = 0
        p.hand = []
        p.peeked = []
        p.ready = false
      }
      s.round = 0
      s.phase = 'lobby'
      s.result = null
      s.flash = null
      s.deck = []
      s.discard = []
      say(s, 'New game — back in the lobby')
      return s
    }

    case 'skipTurn': {
      if (!isHost) fail('Only the host can skip a turn.')
      if (s.phase !== 'turn') fail('No turn to skip.')
      const current = s.players[s.turn]!
      if (current.connected) fail(`${current.name} is still here.`)
      if (s.stage.kind === 'drawn') s.discard.push(s.stage.card)
      say(s, `${current.name}'s turn was skipped`)
      endTurn(s)
      return s
    }
  }

  // Everything below is a move on your own turn.
  if (s.phase !== 'turn') fail('Not now.')
  if (s.players[s.turn]!.id !== by) fail("It isn't your turn.")
  const stage = s.stage

  switch (action.type) {
    case 'callCabo': {
      if (stage.kind !== 'start') fail('Cabo must be called instead of drawing.')
      if (s.caboCaller) fail('Cabo has already been called.')
      s.caboCaller = by
      say(s, `${me.name} called CABO! Everyone else gets one more turn`)
      endTurn(s)
      return s
    }

    case 'drawDeck': {
      if (stage.kind !== 'start') fail('You already drew.')
      const card = drawFromDeck(s)
      s.stage = { kind: 'drawn', card, from: 'deck' }
      say(s, `${me.name} drew from the deck`)
      return s
    }

    case 'drawDiscard': {
      if (stage.kind !== 'start') fail('You already drew.')
      const card = s.discard.pop() ?? fail('The discard pile is empty.')
      s.stage = { kind: 'drawn', card, from: 'discard' }
      say(s, `${me.name} took the ${cardLabel(card)} from the discard pile`)
      return s
    }

    case 'replace': {
      if (stage.kind !== 'drawn') fail('Draw a card first.')
      const slots = [...new Set(action.slots)].sort((a, b) => a - b)
      if (slots.length === 0) fail('Choose at least one of your cards.')
      const chosen = slots.map((i) => me.hand[i] ?? fail('No card there.'))

      if (chosen.length === 1 || chosen.every((c) => value(c) === value(chosen[0]!))) {
        // A clean exchange: the chosen cards go out face up, the drawn
        // card takes the first of their places, the rest close up as gaps.
        for (const c of chosen) s.discard.push(c)
        me.hand[slots[0]!] = stage.card
        for (const i of slots.slice(1)) me.hand[i] = null
        const out = chosen.map(cardLabel).join(', ')
        say(
          s,
          chosen.length === 1
            ? `${me.name} swapped a card in, discarding the ${out}`
            : `${me.name} matched ${chosen.length} cards (${out}) and replaced them with one`,
        )
        s.flash = flash(s, 'replace', slots.map((slot) => ({ player: by, slot })))
      } else {
        // A failed match is public: the attempt is shown, the cards stay
        // put, and the drawn card joins the hand as a penalty.
        me.hand.push(stage.card)
        say(
          s,
          `${me.name} tried to match ${chosen.map(cardLabel).join(', ')} — no match, so they keep them and take the drawn card as a penalty`,
        )
        s.flash = flash(s, 'penalty', [{ player: by, slot: me.hand.length - 1 }])
      }
      endTurn(s)
      return s
    }

    case 'discardDrawn': {
      if (stage.kind !== 'drawn') fail('Draw a card first.')
      if (stage.from === 'discard') fail('A card taken from the discard pile has to be swapped in.')
      s.discard.push(stage.card)
      const power = powerOf(stage.card)
      say(s, `${me.name} discarded the ${cardLabel(stage.card)}`)
      if (power && othersTargetable(s, by).length === 0 && power !== 'peek') {
        endTurn(s)
      } else if (power) {
        s.stage = { kind: 'power', power }
      } else {
        endTurn(s)
      }
      return s
    }

    case 'skipPower': {
      if (stage.kind !== 'power') fail('No power to skip.')
      endTurn(s)
      return s
    }

    case 'usePeek': {
      if (stage.kind !== 'power' || stage.power !== 'peek') fail('That power is not available.')
      const card = me.hand[action.slot] ?? fail('No card there.')
      s.reveals[by] = [{ ref: { player: by, slot: action.slot }, card }]
      s.flash = flash(s, 'look', [{ player: by, slot: action.slot }])
      say(s, `${me.name} peeked at one of their own cards`)
      endTurn(s)
      return s
    }

    case 'useSpy': {
      if (stage.kind !== 'power' || stage.power !== 'spy') fail('That power is not available.')
      const { player, card } = target(s, by, action.target)
      s.reveals[by] = [{ ref: action.target, card }]
      s.flash = flash(s, 'look', [action.target])
      say(s, `${me.name} spied on one of ${player.name}'s cards`)
      endTurn(s)
      return s
    }

    case 'useSwap': {
      if (stage.kind !== 'power' || stage.power !== 'swap') fail('That power is not available.')
      const mine = me.hand[action.own] ?? fail('No card there.')
      const { player, card } = target(s, by, action.target)
      me.hand[action.own] = card
      player.hand[action.target.slot] = mine
      s.flash = flash(s, 'swap', [{ player: by, slot: action.own }, action.target])
      say(s, `${me.name} blindly swapped a card with ${player.name}`)
      endTurn(s)
      return s
    }

    case 'useLook': {
      if (stage.kind !== 'power' || stage.power !== 'look') fail('That power is not available.')
      const mine = me.hand[action.own] ?? fail('No card there.')
      const { player, card } = target(s, by, action.target)
      const own = { player: by, slot: action.own }
      s.reveals[by] = [
        { ref: own, card: mine },
        { ref: action.target, card },
      ]
      s.stage = { kind: 'lookDecide', own, other: action.target }
      s.flash = flash(s, 'look', [own, action.target])
      say(s, `${me.name} is looking at one of their cards and one of ${player.name}'s`)
      return s
    }

    case 'lookDecide': {
      if (stage.kind !== 'lookDecide') fail('Nothing to decide.')
      const other = s.players.find((p) => p.id === stage.other.player)!
      if (action.swap) {
        const mine = me.hand[stage.own.slot]!
        me.hand[stage.own.slot] = other.hand[stage.other.slot] ?? null
        other.hand[stage.other.slot] = mine
        s.flash = flash(s, 'swap', [stage.own, stage.other])
        say(s, `${me.name} swapped those two cards`)
      } else {
        say(s, `${me.name} left both cards where they were`)
      }
      endTurn(s)
      return s
    }
  }

  return fail('Unknown move.')
}

function target(s: GameState, by: string, ref: Ref) {
  if (ref.player === by) fail('Pick a card in someone else’s hand.')
  if (ref.player === s.caboCaller) fail('The Cabo caller’s cards are locked.')
  const player = s.players.find((p) => p.id === ref.player) ?? fail('No such player.')
  const card = player.hand[ref.slot] ?? fail('No card there.')
  return { player, card }
}

function othersTargetable(s: GameState, by: string) {
  return s.players.filter(
    (p) => p.id !== by && p.id !== s.caboCaller && p.hand.some((c) => c !== null),
  )
}

function drawFromDeck(s: GameState): Card {
  if (s.deck.length === 0) {
    // Reshuffle everything under the top discard back into the deck.
    const top = s.discard.pop()
    s.deck = shuffle(s.discard)
    s.discard = top ? [top] : []
    say(s, 'The deck ran out — the discard pile was reshuffled')
  }
  return s.deck.pop() ?? fail('No cards left to draw.')
}

function maybeBeginTurns(s: GameState) {
  if (s.phase !== 'peek') return
  if (!s.players.every((p) => p.ready || !p.connected)) return
  s.phase = 'turn'
  s.turn = s.starter
  s.stage = { kind: 'start' }
  s.reveals = {}
  say(s, `${s.players[s.turn]!.name} goes first`)
}

function endTurn(s: GameState) {
  s.stage = { kind: 'start' }
  // Enough penalty cards can leave nothing to draw at all; nobody could
  // move again, so the hands are turned over as if Cabo had been called.
  if (s.deck.length === 0 && s.discard.length === 0) {
    say(s, 'No cards left to draw — hands are turned over')
    endRound(s)
    return
  }
  const next = (s.turn + 1) % s.players.length
  if (s.caboCaller && s.players[next]!.id === s.caboCaller) {
    endRound(s)
    return
  }
  s.turn = next
}

function endRound(s: GameState) {
  const hands: Record<string, Card[]> = {}
  const sums: Record<string, number> = {}
  for (const p of s.players) {
    hands[p.id] = p.hand.filter((c): c is Card => c !== null)
    sums[p.id] = hands[p.id]!.reduce((t, c) => t + value(c), 0)
  }

  const delta: Record<string, number> = {}
  const kamikaze = s.players.find((p) => isKamikaze(hands[p.id]!))?.id ?? null
  const caller = s.caboCaller
  let note: string

  if (kamikaze) {
    for (const p of s.players) delta[p.id] = p.id === kamikaze ? 0 : KAMIKAZE_PENALTY
    note = `Kamikaze! ${nameOf(s, kamikaze)} held Q Q K K — everyone else takes ${KAMIKAZE_PENALTY}`
  } else {
    const low = Math.min(...Object.values(sums))
    const callerWins = caller !== null && sums[caller] === low
    for (const p of s.players) {
      if (p.id === caller) delta[p.id] = callerWins ? 0 : sums[p.id]! + CABO_PENALTY
      else if (sums[p.id] === low && !callerWins) delta[p.id] = 0
      else delta[p.id] = sums[p.id]!
    }
    const lowest = s.players.filter((p) => sums[p.id] === low).map((p) => p.name)
    note = callerWins
      ? `${nameOf(s, caller!)} called it and had the lowest hand`
      : caller
        ? `${nameOf(s, caller)} called Cabo but ${lowest.join(' & ')} had less — +${CABO_PENALTY}`
        : `${lowest.join(' & ')} had the lowest hand`
  }

  const resets: string[] = []
  for (const p of s.players) {
    p.score += delta[p.id]!
    // Landing exactly on the limit is lucky: it knocks you back to half.
    if (p.score === LIMIT) {
      p.score = LIMIT / 2
      resets.push(p.name)
    }
  }
  if (resets.length) note += `. ${resets.join(' & ')} hit exactly ${LIMIT} and drop to ${LIMIT / 2}`

  s.result = { hands, sums, delta, caller, kamikaze, note }
  s.phase = s.players.some((p) => p.score > LIMIT) ? 'gameOver' : 'roundEnd'
  s.flash = null
  s.reveals = {}
  say(s, `Round ${s.round} over: ${note}`)
}

function isKamikaze(hand: Card[]) {
  if (hand.length !== 4) return false
  const v = hand.map(value).sort((a, b) => a - b)
  return v[0] === 12 && v[1] === 12 && v[2] === 13 && v[3] === 13
}

const nameOf = (s: GameState, id: string) => s.players.find((p) => p.id === id)?.name ?? '?'

function say(s: GameState, text: string) {
  s.seq += 1
  s.log.push({ seq: s.seq, text })
  if (s.log.length > LOG_LENGTH) s.log.splice(0, s.log.length - LOG_LENGTH)
}

function flash(s: GameState, kind: Flash['kind'], refs: Ref[]): Flash {
  return { seq: s.seq + 1, refs, kind }
}

function clone<T>(v: T): T {
  return structuredClone(v)
}

// ── Views ────────────────────────────────────────────────

/** A slot as a given viewer sees it: a face, a face-down card, or a gap. */
export type SlotView = { card: Card | null } | null

export type PlayerView = {
  id: string
  name: string
  score: number
  connected: boolean
  ready: boolean
  peeked: number
  hand: SlotView[]
}

export type StageView =
  | { kind: 'start' }
  | { kind: 'drawn'; from: 'deck' | 'discard'; card: Card | null }
  | { kind: 'power'; power: Power }
  | { kind: 'lookDecide'; own: Ref; other: Ref }

export type View = {
  code: string
  me: string
  hostId: string
  phase: Phase
  players: PlayerView[]
  deckCount: number
  discardTop: Card | null
  turn: string | null
  stage: StageView
  caboCaller: string | null
  round: number
  log: LogEntry[]
  flash: Flash | null
  result: RoundResult | null
}

export function viewFor(s: GameState, viewer: string): View {
  const showAll = s.phase === 'roundEnd' || s.phase === 'gameOver'
  // Only show a private look while the same card is still in that slot.
  const visible = new Set(
    (s.reveals[viewer] ?? [])
      .filter((r) => s.players.find((p) => p.id === r.ref.player)?.hand[r.ref.slot]?.id === r.card.id)
      .map((r) => `${r.ref.player}:${r.ref.slot}`),
  )

  const stage: StageView =
    s.stage.kind === 'drawn'
      ? {
          kind: 'drawn',
          from: s.stage.from,
          // A card taken from the discard pile was face up — everyone saw it.
          card:
            s.players[s.turn]?.id === viewer || s.stage.from === 'discard' ? s.stage.card : null,
        }
      : s.stage

  return {
    code: s.code,
    me: viewer,
    hostId: s.hostId,
    phase: s.phase,
    players: s.players.map((p) => ({
      id: p.id,
      name: p.name,
      score: p.score,
      connected: p.connected,
      ready: p.ready,
      peeked: p.peeked.length,
      hand: p.hand.map((c, slot) =>
        c === null
          ? null
          : { card: showAll || visible.has(`${p.id}:${slot}`) ? c : null },
      ),
    })),
    deckCount: s.deck.length,
    discardTop: s.discard.at(-1) ?? null,
    turn: s.phase === 'turn' ? s.players[s.turn]!.id : null,
    stage,
    caboCaller: s.caboCaller,
    round: s.round,
    log: s.log,
    flash: s.flash,
    result: s.result,
  }
}
