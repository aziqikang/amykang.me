import { useEffect, useState } from 'react'
import { GuestRoom, HostRoom, playerId, savedHostGame, type Snapshot } from './net'

/**
 * One live room per tab, held outside React.
 *
 * A room owns a claimed PeerJS id, and the broker holds a released id for
 * a few seconds — so tearing the room down and rebuilding it (StrictMode's
 * double effect, or a re-render that changes nothing) would lock the host
 * out of their own code. Teardown is therefore deferred a tick and
 * cancelled if the same room is asked for again straight away.
 */
let live: { key: string; room: HostRoom | GuestRoom } | null = null
let pendingClose: ReturnType<typeof setTimeout> | null = null

function acquire(code: string, host: boolean, name: string) {
  const key = `${host ? 'host' : 'guest'}:${code}`
  if (pendingClose) {
    clearTimeout(pendingClose)
    pendingClose = null
  }
  if (live?.key === key) return live.room
  live?.room.close()
  const me = playerId()
  const room = host ? new HostRoom(code, me, name, savedHostGame(code)) : new GuestRoom(code, me, name)
  live = { key, room }
  return room
}

function release(room: HostRoom | GuestRoom) {
  pendingClose = setTimeout(() => {
    pendingClose = null
    if (live?.room !== room) return
    if (room instanceof HostRoom) room.end()
    else room.close()
    live = null
  }, 50)
}

export function useRoom(code: string, host: boolean, name: string | null) {
  const [room, setRoom] = useState<HostRoom | GuestRoom | null>(null)
  const [snap, setSnap] = useState<Snapshot | null>(null)

  useEffect(() => {
    if (!name) return
    const r = acquire(code, host, name)
    setRoom(r)
    const off = r.subscribe(setSnap)
    return () => {
      off()
      release(r)
    }
  }, [code, host, name])

  return { room, snap }
}
