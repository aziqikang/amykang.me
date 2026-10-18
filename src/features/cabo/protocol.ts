import type { Action, View } from './engine'

/** Messages a player's browser sends the room. */
export type ToHost = { t: 'action'; action: Action } | { t: 'ping' }

/** Messages the room sends a player. */
export type ToGuest =
  | { t: 'state'; view: View }
  | { t: 'error'; message: string }
  | { t: 'rejected'; reason: 'not-found' | 'taken' | 'rejected'; message: string }
  /** The same player opened the table somewhere else. */
  | { t: 'replaced' }
  | { t: 'pong' }
