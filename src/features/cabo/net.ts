import type { Action, View } from './engine'
import type { ToGuest, ToHost } from './protocol'

/**
 * Talks to the Cabo game server (server/ in this repo, a Cloudflare
 * Worker). Each join word is a room on the server; every player — host
 * included — connects to it over one WebSocket, sends moves, and gets back
 * a view of the table with everything they may not see stripped out.
 */

/** The deployed game server. Set VITE_CABO_SERVER to override. */
const PROD_SERVER = ''

function serverUrl(): string {
  const env = import.meta.env.VITE_CABO_SERVER as string | undefined
  if (env) return env.replace(/\/$/, '')
  // `npm run dev` in server/ listens here; using the page's own hostname
  // lets a phone on the same Wi-Fi reach it too.
  if (import.meta.env.DEV) return `ws://${location.hostname}:8787`
  return PROD_SERVER
}

/** Give up on a first connection after this long, rather than spin forever. */
const CONNECT_TIMEOUT_MS = 12_000
const PING_MS = 25_000

export type FailReason = 'not-found' | 'taken' | 'rejected' | 'replaced' | 'unreachable'

export type Status =
  | { kind: 'connecting' }
  | { kind: 'open' }
  | { kind: 'reconnecting' }
  /** Terminal: nothing more will happen without the player acting. */
  | { kind: 'failed'; reason: FailReason; message: string }

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
    return ((window as { __caboId?: string }).__caboId ??= crypto.randomUUID())
  }
}

export class Room {
  private snap: Snapshot = { status: { kind: 'connecting' }, view: null, error: null }
  private listeners = new Set<(s: Snapshot) => void>()
  private ws: WebSocket | null = null
  private closed = false
  private connected = false
  private attempts = 0
  private timers: ReturnType<typeof setTimeout>[] = []
  private ping: ReturnType<typeof setInterval> | null = null

  constructor(
    readonly code: string,
    readonly me: string,
    readonly name: string,
    /** Open the room if it does not exist yet, rather than failing. */
    private create: boolean,
  ) {
    if (!serverUrl()) {
      this.fail('unreachable', 'The game server hasn’t been set up yet.')
      return
    }
    this.timers.push(
      setTimeout(() => {
        if (!this.connected && !this.closed) {
          this.fail('unreachable', 'Couldn’t reach the game server. Check your connection and try again.')
        }
      }, CONNECT_TIMEOUT_MS),
    )
    this.dial()
  }

  subscribe(fn: (s: Snapshot) => void) {
    this.listeners.add(fn)
    fn(this.snap)
    return () => void this.listeners.delete(fn)
  }

  send(action: Action) {
    if (this.ws?.readyState === WebSocket.OPEN) this.post({ t: 'action', action })
    else this.set({ error: { message: 'Not connected — hang on a moment.', at: Date.now() } })
  }

  close() {
    this.closed = true
    this.stop()
    this.listeners.clear()
  }

  private dial() {
    if (this.closed || this.failed) return
    const params = new URLSearchParams({ id: this.me, name: this.name })
    // Only the very first connection may open a room. A reconnect must
    // never quietly start an empty table under the same word.
    if (this.create && !this.connected) params.set('create', '1')
    const ws = new WebSocket(`${serverUrl()}/room/${this.code}?${params}`)
    this.ws = ws

    ws.onmessage = (ev) => {
      let msg: ToGuest
      try {
        msg = JSON.parse(String(ev.data)) as ToGuest
      } catch {
        return
      }
      switch (msg.t) {
        case 'state':
          this.connected = true
          this.attempts = 0
          this.set({ status: { kind: 'open' }, view: msg.view })
          break
        case 'error':
          this.set({ error: { message: msg.message, at: Date.now() } })
          break
        case 'rejected':
          this.fail(msg.reason, msg.message)
          break
        case 'replaced':
          this.fail('replaced', 'This table is now open in another tab or window.')
          break
      }
    }

    ws.onopen = () => {
      if (this.ping) clearInterval(this.ping)
      // Idle sockets get dropped by proxies; a small heartbeat keeps the
      // connection alive through a long think.
      this.ping = setInterval(() => this.post({ t: 'ping' }), PING_MS)
    }

    ws.onclose = () => {
      if (this.ws !== ws || this.closed || this.failed) return
      if (this.ping) clearInterval(this.ping)
      if (this.connected) this.set({ status: { kind: 'reconnecting' } })
      // Back off 0.5s, 1s, 2s … up to 8s; the first-connection timeout
      // above still bounds how long a brand-new join can take.
      const delay = Math.min(8000, 500 * 2 ** this.attempts++)
      this.timers.push(setTimeout(() => this.dial(), delay))
    }
  }

  private post(msg: ToHost) {
    try {
      this.ws?.send(JSON.stringify(msg))
    } catch {
      // Closing; onclose takes it from here.
    }
  }

  private get failed() {
    return this.snap.status.kind === 'failed'
  }

  private fail(reason: FailReason, message: string) {
    this.set({ status: { kind: 'failed', reason, message } })
    this.stop()
  }

  private stop() {
    this.timers.forEach(clearTimeout)
    this.timers = []
    if (this.ping) clearInterval(this.ping)
    const ws = this.ws
    this.ws = null
    ws?.close()
  }

  private set(patch: Partial<Snapshot>) {
    this.snap = { ...this.snap, ...patch }
    for (const fn of this.listeners) fn(this.snap)
  }
}
