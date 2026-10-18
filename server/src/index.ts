import { DurableObject } from 'cloudflare:workers'
import {
  apply,
  createGame,
  join,
  RuleError,
  setConnected,
  viewFor,
  type Action,
  type GameState,
} from '../../src/features/cabo/engine'
import type { ToGuest, ToHost } from '../../src/features/cabo/protocol'

/**
 * The Cabo game server.
 *
 * Each join word is its own Durable Object: a single-threaded little
 * server that holds the room's GameState, runs every move through the same
 * rules engine the client uses, and sends each player only what they may
 * see. Players connect to it with an ordinary WebSocket, which works on
 * any network — no peer-to-peer links to fail.
 */

type Env = { ROOMS: DurableObjectNamespace<Room> }

/** A dropped player keeps their seat this long, so a reload or a blip in
 *  the connection is invisible to everyone else. */
const GRACE_MS = 10_000
/** A room nobody has touched for this long is deleted. */
const IDLE_MS = 6 * 60 * 60 * 1000
const MAX_MESSAGE = 4096

const ORIGIN_OK =
  /^(https:\/\/(www\.)?amykang\.me|http:\/\/(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?)$/

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url)
    if (url.pathname === '/') return new Response('cabo server\n')

    const match = url.pathname.match(/^\/room\/([a-z]{1,32})$/)
    if (!match) return new Response('Not found', { status: 404 })
    if (req.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected a WebSocket', { status: 426 })
    }
    // Browsers always send Origin on a WebSocket; this keeps other sites
    // from embedding the game against this server.
    const origin = req.headers.get('Origin')
    if (origin && !ORIGIN_OK.test(origin)) return new Response('Forbidden', { status: 403 })

    const room = env.ROOMS.get(env.ROOMS.idFromName(match[1]!))
    return room.fetch(req)
  },
} satisfies ExportedHandler<Env>

export class Room extends DurableObject<Env> {
  private state: GameState | null = null
  private sockets = new Map<string, WebSocket>()
  private grace = new Map<string, ReturnType<typeof setTimeout>>()

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    // A redeploy or eviction mid-game must not lose the game.
    ctx.blockConcurrencyWhile(async () => {
      this.state = (await ctx.storage.get<GameState>('state')) ?? null
    })
  }

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url)
    const code = url.pathname.split('/').pop()!
    const id = url.searchParams.get('id') ?? ''
    const name = (url.searchParams.get('name') ?? '').slice(0, 16)
    const create = url.searchParams.get('create') === '1'

    const [client, server] = Object.values(new WebSocketPair()) as [WebSocket, WebSocket]
    server.accept()
    const done = new Response(null, { status: 101, webSocket: client })
    const reject = (reason: Extract<ToGuest, { t: 'rejected' }>['reason'], message: string) => {
      send(server, { t: 'rejected', reason, message })
      server.close(4001, reason)
      return done
    }

    if (!/^[\w-]{8,64}$/.test(id)) return reject('rejected', 'Could not join.')

    // A room is alive while anyone is still seated at it (the grace period
    // counts), so a host reloading the page does not lose their table.
    const alive = !!this.state?.players.some((p) => p.connected)
    if (create) {
      if (alive && this.state!.hostId !== id && !this.state!.players.some((p) => p.id === id)) {
        return reject('taken', 'That word is already in use.')
      }
      if (!alive) this.state = createGame(code, id, name)
    } else if (!alive) {
      return reject('not-found', `No table called “${code}” is open right now.`)
    }

    try {
      this.commit(join(this.state!, id, name))
    } catch (e) {
      return reject('rejected', e instanceof Error ? e.message : 'Could not join.')
    }

    // One live connection per player: opening the table somewhere new
    // takes the seat over from the old tab.
    const old = this.sockets.get(id)
    if (old && old !== server) {
      send(old, { t: 'replaced' })
      old.close(4000, 'replaced')
    }
    this.sockets.set(id, server)
    const pending = this.grace.get(id)
    if (pending) clearTimeout(pending)
    this.grace.delete(id)

    server.addEventListener('message', (ev) => this.onMessage(id, server, ev.data))
    server.addEventListener('close', () => this.onClose(id, server))
    server.addEventListener('error', () => this.onClose(id, server))

    this.broadcast()
    return done
  }

  private onMessage(id: string, ws: WebSocket, data: string | ArrayBuffer) {
    if (this.sockets.get(id) !== ws || !this.state) return
    if (typeof data !== 'string' || data.length > MAX_MESSAGE) return
    let msg: ToHost
    try {
      msg = JSON.parse(data) as ToHost
    } catch {
      return
    }
    if (msg.t === 'ping') return send(ws, { t: 'pong' })
    if (msg.t !== 'action' || typeof msg.action?.type !== 'string') return

    const action = msg.action as Action
    try {
      this.commit(apply(this.state, id, action))
    } catch (e) {
      if (!(e instanceof RuleError)) console.error(e)
      send(ws, { t: 'error', message: e instanceof Error ? e.message : 'Something went wrong.' })
      return
    }
    if (action.type === 'kick') {
      const gone = this.sockets.get(action.player)
      this.sockets.delete(action.player)
      if (gone) {
        send(gone, { t: 'rejected', reason: 'rejected', message: 'The host removed you from the table.' })
        gone.close(4001, 'removed')
      }
    }
    this.broadcast()
  }

  private onClose(id: string, ws: WebSocket) {
    if (this.sockets.get(id) !== ws) return
    this.sockets.delete(id)
    this.grace.set(
      id,
      setTimeout(() => {
        this.grace.delete(id)
        if (this.sockets.has(id) || !this.state) return
        this.commit(setConnected(this.state, id, false))
        this.broadcast()
      }, GRACE_MS),
    )
  }

  private commit(next: GameState) {
    this.state = next
    void this.ctx.storage.put('state', next)
    void this.ctx.storage.setAlarm(Date.now() + IDLE_MS)
  }

  async alarm() {
    if (this.sockets.size > 0) {
      await this.ctx.storage.setAlarm(Date.now() + IDLE_MS)
      return
    }
    this.state = null
    await this.ctx.storage.deleteAll()
  }

  private broadcast() {
    if (!this.state) return
    for (const [id, ws] of this.sockets) send(ws, { t: 'state', view: viewFor(this.state, id) })
  }
}

function send(ws: WebSocket, msg: ToGuest) {
  try {
    ws.send(JSON.stringify(msg))
  } catch {
    // The socket closed under us; its close handler does the cleanup.
  }
}
