import Peer, { type DataConnection, type PeerOptions } from 'peerjs'
import {
  apply,
  createGame,
  join,
  RuleError,
  setConnected,
  viewFor,
  type Action,
  type GameState,
  type View,
} from './engine'

/**
 * Networking for a static site: there is no game server. The host's
 * browser IS the server — it claims a PeerJS id derived from the join
 * word, holds the only full GameState, and sends each guest a view with
 * everything they may not see stripped out. PeerJS's public broker only
 * introduces the browsers; the game itself runs over WebRTC between them.
 */

const PREFIX = 'amykang-cabo-'
const peerIdFor = (code: string) => PREFIX + code

/** Lets a local PeerServer stand in for the public one during development. */
function peerOptions(): PeerOptions {
  const env = import.meta.env
  if (!env.VITE_PEER_HOST) return { debug: 1 }
  return {
    host: env.VITE_PEER_HOST,
    port: Number(env.VITE_PEER_PORT ?? 9000),
    path: env.VITE_PEER_PATH ?? '/',
    secure: env.VITE_PEER_SECURE === 'true',
    debug: 1,
  }
}

type ToHost = { t: 'hello'; id: string; name: string } | { t: 'action'; action: Action }
type ToGuest =
  | { t: 'state'; view: View }
  | { t: 'error'; message: string }
  | { t: 'rejected'; message: string }

export type Status =
  | { kind: 'connecting' }
  | { kind: 'open' }
  | { kind: 'reconnecting' }
  /** Terminal: the room does not exist, refused us, or the code is taken. */
  | { kind: 'failed'; reason: 'not-found' | 'rejected' | 'taken' | 'error'; message: string }

export type Snapshot = { status: Status; view: View | null; error: { message: string; at: number } | null }

/** The stable identity this browser plays under, so a reload rejoins the same seat. */
export function playerId(): string {
  const key = 'amykang.cabo.id'
  try {
    let id = localStorage.getItem(key)
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem(key, id)
    }
    return id
  } catch {
    return (window as { __caboId?: string }).__caboId ??= crypto.randomUUID()
  }
}

const hostKey = (code: string) => `amykang.cabo.host.${code}`

/** A saved game this tab was hosting, if the host reloaded mid-game. */
export function savedHostGame(code: string): GameState | null {
  try {
    const raw = sessionStorage.getItem(hostKey(code))
    return raw ? (JSON.parse(raw) as GameState) : null
  } catch {
    return null
  }
}

function saveHostGame(s: GameState | null, code: string) {
  try {
    if (s) sessionStorage.setItem(hostKey(code), JSON.stringify(s))
    else sessionStorage.removeItem(hostKey(code))
  } catch {
    // Storage is a convenience: without it a reload just ends the room.
  }
}

abstract class Room {
  protected snap: Snapshot = { status: { kind: 'connecting' }, view: null, error: null }
  private listeners = new Set<(s: Snapshot) => void>()
  protected peer: Peer | null = null
  protected closed = false

  constructor(readonly code: string, readonly me: string, readonly name: string) {}

  subscribe(fn: (s: Snapshot) => void) {
    this.listeners.add(fn)
    fn(this.snap)
    return () => void this.listeners.delete(fn)
  }

  get snapshot() {
    return this.snap
  }

  protected set(patch: Partial<Snapshot>) {
    this.snap = { ...this.snap, ...patch }
    for (const fn of this.listeners) fn(this.snap)
  }

  protected fail(reason: Extract<Status, { kind: 'failed' }>['reason'], message: string) {
    this.set({ status: { kind: 'failed', reason, message } })
    this.peer?.destroy()
  }

  abstract send(action: Action): void

  close() {
    this.closed = true
    this.peer?.destroy()
    this.listeners.clear()
  }
}

// ── Host ─────────────────────────────────────────────────

export class HostRoom extends Room {
  private state: GameState
  private conns = new Map<string, DataConnection>()
  private claimAttempts = 0
  private readonly resumed: boolean

  constructor(code: string, me: string, name: string, resume: GameState | null) {
    super(code, me, name)
    this.resumed = resume !== null
    this.state = resume ?? createGame(code, me, name)
    // Everyone else is offline until they reconnect to the new peer.
    if (resume) {
      for (const p of this.state.players) p.connected = p.id === me
    }
    this.set({ view: viewFor(this.state, me) })
    this.claim()
  }

  private claim() {
    const peer = new Peer(peerIdFor(this.code), peerOptions())
    this.peer = peer

    peer.on('open', () => {
      this.claimAttempts = 0
      this.set({ status: { kind: 'open' } })
      saveHostGame(this.state, this.code)
    })

    peer.on('connection', (conn) => this.accept(conn))

    peer.on('disconnected', () => {
      // Lost the broker, not the players: open data channels keep working,
      // but nobody new can find the room until this reconnects.
      setTimeout(() => {
        if (!this.closed && !peer.destroyed && peer.disconnected) peer.reconnect()
      }, 1500)
    })

    peer.on('error', (err) => {
      if (this.closed) return
      if (err.type === 'unavailable-id') {
        // After a reload the broker can hold the old id for a few seconds,
        // so a resuming host keeps trying. A brand-new room just needs a
        // different word.
        peer.destroy()
        if (this.resumed && ++this.claimAttempts < 20) {
          this.set({ status: { kind: 'reconnecting' } })
          setTimeout(() => !this.closed && this.claim(), 2000)
          return
        }
        this.fail('taken', 'That room word is already in use.')
      } else if (err.type === 'network' || err.type === 'server-error' || err.type === 'socket-error') {
        this.set({ status: { kind: 'reconnecting' } })
      } else if (err.type === 'browser-incompatible') {
        this.fail('error', 'This browser does not support WebRTC, which the game needs.')
      }
    })
  }

  private accept(conn: DataConnection) {
    let id: string | null = null

    conn.on('data', (raw) => {
      const msg = raw as ToHost
      if (msg.t === 'hello') {
        if (typeof msg.id !== 'string' || msg.id === this.me) {
          conn.send({ t: 'rejected', message: 'Could not join.' } satisfies ToGuest)
          return
        }
        try {
          this.commit(join(this.state, msg.id, String(msg.name ?? '')))
        } catch (e) {
          conn.send({ t: 'rejected', message: messageOf(e) } satisfies ToGuest)
          setTimeout(() => conn.close(), 500)
          return
        }
        id = msg.id
        // A reconnect replaces the stale connection rather than adding one.
        const old = this.conns.get(id)
        this.conns.set(id, conn)
        if (old && old !== conn) old.close()
        this.broadcast()
      } else if (msg.t === 'action' && id) {
        this.act(id, msg.action, conn)
      }
    })

    conn.on('close', () => {
      if (!id || this.conns.get(id) !== conn || this.closed) return
      this.conns.delete(id)
      this.commit(setConnected(this.state, id, false))
      this.broadcast()
    })
  }

  private act(by: string, action: Action, conn: DataConnection | null) {
    try {
      const next = apply(this.state, by, action)
      // Removed players are told, then dropped.
      if (action.type === 'kick') {
        const gone = this.conns.get(action.player)
        gone?.send({ t: 'rejected', message: 'The host removed you from the room.' } satisfies ToGuest)
        this.conns.delete(action.player)
        setTimeout(() => gone?.close(), 500)
      }
      this.commit(next)
      this.broadcast()
    } catch (e) {
      if (!(e instanceof RuleError)) console.error(e)
      const message = messageOf(e)
      if (conn) conn.send({ t: 'error', message } satisfies ToGuest)
      else this.set({ error: { message, at: Date.now() } })
    }
  }

  private commit(next: GameState) {
    this.state = next
    saveHostGame(next, this.code)
  }

  private broadcast() {
    for (const [id, conn] of this.conns) {
      if (conn.open) conn.send({ t: 'state', view: viewFor(this.state, id) } satisfies ToGuest)
    }
    this.set({ view: viewFor(this.state, this.me) })
  }

  send(action: Action) {
    this.act(this.me, action, null)
  }

  /** Leaving for good, as opposed to a reload. */
  end() {
    saveHostGame(null, this.code)
    this.close()
  }
}

// ── Guest ────────────────────────────────────────────────

export class GuestRoom extends Room {
  private conn: DataConnection | null = null
  private everConnected = false
  private retry: ReturnType<typeof setTimeout> | null = null

  constructor(code: string, me: string, name: string) {
    super(code, me, name)
    const peer = new Peer(peerOptions())
    this.peer = peer

    peer.on('open', () => this.dial())
    peer.on('disconnected', () => {
      setTimeout(() => {
        if (!this.closed && !peer.destroyed && peer.disconnected) peer.reconnect()
      }, 1500)
    })
    peer.on('error', (err) => {
      if (this.closed) return
      if (err.type === 'peer-unavailable') {
        if (this.everConnected) this.redial()
        else this.fail('not-found', `No room called “${code}” is open right now.`)
      } else if (err.type === 'browser-incompatible') {
        this.fail('error', 'This browser does not support WebRTC, which the game needs.')
      } else if (err.type === 'network' || err.type === 'server-error' || err.type === 'socket-error') {
        this.set({ status: { kind: 'reconnecting' } })
        this.redial()
      }
    })
  }

  private dial() {
    if (this.closed || !this.peer || this.peer.destroyed) return
    if (this.peer.disconnected) return this.redial()
    const conn = this.peer.connect(peerIdFor(this.code), { reliable: true, serialization: 'json' })
    this.conn = conn

    conn.on('open', () => {
      conn.send({ t: 'hello', id: this.me, name: this.name } satisfies ToHost)
    })

    conn.on('data', (raw) => {
      const msg = raw as ToGuest
      if (msg.t === 'state') {
        this.everConnected = true
        this.set({ status: { kind: 'open' }, view: msg.view })
      } else if (msg.t === 'error') {
        this.set({ error: { message: msg.message, at: Date.now() } })
      } else if (msg.t === 'rejected') {
        this.fail('rejected', msg.message)
      }
    })

    conn.on('close', () => {
      if (this.conn !== conn || this.closed || this.snap.status.kind === 'failed') return
      this.set({ status: { kind: 'reconnecting' } })
      this.redial()
    })
  }

  private redial() {
    if (this.retry || this.closed) return
    this.retry = setTimeout(() => {
      this.retry = null
      this.dial()
    }, 2000)
  }

  send(action: Action) {
    if (this.conn?.open) this.conn.send({ t: 'action', action } satisfies ToHost)
    else this.set({ error: { message: 'Not connected — hang on a moment.', at: Date.now() } })
  }

  close() {
    if (this.retry) clearTimeout(this.retry)
    super.close()
  }
}

function messageOf(e: unknown) {
  return e instanceof Error ? e.message : 'Something went wrong.'
}
