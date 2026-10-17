import { useState } from 'react'
import { MAX_PLAYERS, MIN_PLAYERS, type Action, type View } from '@/features/cabo/engine'
import styles from './Cabo.module.css'

export function Lobby({ view, send }: { view: View; send: (a: Action) => void }) {
  const isHost = view.me === view.hostId
  const [copied, setCopied] = useState(false)
  const link = `${location.origin}/play-cabo/${view.code}`
  const enough = view.players.length >= MIN_PLAYERS

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      // Clipboard can be refused; the link is on screen to copy by hand.
    }
  }

  return (
    <div className={styles.lobby}>
      <div className={styles.codeCard}>
        <p className={styles.kicker}>join word</p>
        <p className={styles.bigCode}>{view.code}</p>
        <p className={styles.muted}>
          Friends go to <b>amykang.me/play-cabo</b> and type it in, or open{' '}
          <span className={styles.link}>{link.replace(/^https?:\/\//, '')}</span>
        </p>
        <button type="button" className={styles.secondary} onClick={copy}>
          {copied ? 'copied!' : 'copy invite link'}
        </button>
      </div>

      <div className={styles.seats}>
        <h2 className={styles.sectionTitle}>
          players <span className={styles.muted}>{view.players.length} / {MAX_PLAYERS}</span>
        </h2>
        <ul className={styles.seatList}>
          {view.players.map((p) => (
            <li key={p.id}>
              <span className={styles.dot} data-on={p.connected} />
              <span className={styles.seatName}>
                {p.name}
                {p.id === view.me && <span className={styles.muted}> (you)</span>}
              </span>
              {p.id === view.hostId && <span className={styles.badge}>host</span>}
              {isHost && p.id !== view.me && (
                <button
                  type="button"
                  className={styles.textButton}
                  onClick={() => send({ type: 'kick', player: p.id })}
                >
                  remove
                </button>
              )}
            </li>
          ))}
          {Array.from({ length: MAX_PLAYERS - view.players.length }, (_, i) => (
            <li key={`open-${i}`} className={styles.openSeat}>
              open seat
            </li>
          ))}
        </ul>

        {isHost ? (
          <button
            type="button"
            className={styles.primary}
            disabled={!enough}
            onClick={() => send({ type: 'start' })}
          >
            {enough ? `start with ${view.players.length} players` : 'waiting for someone to join…'}
          </button>
        ) : (
          <p className={styles.muted}>Waiting for the host to start the game…</p>
        )}
      </div>
    </div>
  )
}
