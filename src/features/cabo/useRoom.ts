import { useEffect, useState } from 'react'
import { playerId, Room, type Snapshot } from './net'

/**
 * One live room connection per tab, held outside React.
 *
 * StrictMode mounts effects twice, and a re-render can re-run them, so
 * teardown is deferred a tick and cancelled if the same room is asked for
 * again straight away — otherwise every mount would reconnect.
 */
let live: { key: string; room: Room } | null = null
let pendingClose: ReturnType<typeof setTimeout> | null = null

function acquire(code: string, host: boolean, name: string) {
  const key = `${host ? 'host' : 'guest'}:${code}`
  if (pendingClose) {
    clearTimeout(pendingClose)
    pendingClose = null
  }
  if (live?.key === key) return live.room
  live?.room.close()
  const room = new Room(code, playerId(), name, host)
  live = { key, room }
  return room
}

function release(room: Room) {
  pendingClose = setTimeout(() => {
    pendingClose = null
    if (live?.room !== room) return
    room.close()
    live = null
  }, 50)
}

export function useRoom(code: string, host: boolean, name: string | null) {
  const [room, setRoom] = useState<Room | null>(null)
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
