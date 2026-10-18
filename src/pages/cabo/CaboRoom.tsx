import { useEffect, useState, type FormEvent, type MouseEvent, type ReactNode } from 'react'
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { cleanCode, randomWord } from '@/features/cabo/words'
import type { FailReason } from '@/features/cabo/net'
import { useRoom } from '@/features/cabo/useRoom'
import { useHelp } from './Help'
import { Lobby } from './Lobby'
import { Table } from './Table'
import { loadName, saveName } from './name'
import styles from './Cabo.module.css'

export default function CaboRoom() {
  const params = useParams()
  const code = cleanCode(params.code ?? '')
  const location = useLocation()
  const navigate = useNavigate()
  const help = useHelp()

  // Arriving from "host a table" may open a new room; arriving any other
  // way only joins one. History state survives a reload, so a host who
  // refreshes simply rejoins their own table.
  const [host] = useState(() => (location.state as { host?: boolean } | null)?.host === true)
  const [name, setName] = useState<string | null>(() => loadName() || null)
  const [logOpen, setLogOpen] = useState(false)
  const { room, snap } = useRoom(code, host, name)

  useEffect(() => {
    document.title = `Cabo · ${code}`
  }, [code])

  // A brand-new room whose word happens to be in use just takes another.
  useEffect(() => {
    if (snap?.status.kind === 'failed' && snap.status.reason === 'taken' && host) {
      navigate(`/play-cabo/${randomWord()}`, { replace: true, state: { host: true } })
    }
  }, [snap?.status, host, navigate])

  // Mid-game, leaving drops you from the round, so check first.
  const midGame = !!snap?.view && snap.view.phase !== 'lobby' && snap.status.kind !== 'failed'

  if (code !== params.code) {
    return <Navigate to={code ? `/play-cabo/${code}` : '/play-cabo'} />
  }

  if (!name) return <NamePrompt code={code} onName={setName} />

  const leave = (e: MouseEvent) => {
    if (midGame && !window.confirm('Leave the table? The game carries on without you.')) {
      e.preventDefault()
    }
  }

  const status = snap?.status
  const view = snap?.view ?? null
  let body: ReactNode
  if (!snap || !status || (status.kind === 'connecting' && !view)) {
    body = <Notice title={host ? 'setting the table…' : `finding “${code}”…`} />
  } else if (status.kind === 'failed' && status.reason !== 'taken') {
    body = (
      <Notice title={FAIL_TITLE[status.reason]}>
        <p>{status.message}</p>
        {status.reason === 'not-found' && <p>Check the word with your host — it may have a typo.</p>}
        <div className={styles.choices}>
          {(status.reason === 'unreachable' || status.reason === 'replaced') && (
            <button type="button" className={styles.primary} onClick={() => window.location.reload()}>
              {status.reason === 'replaced' ? 'play here instead' : 'try again'}
            </button>
          )}
          <Link className={styles.secondary} to="/play-cabo">
            back
          </Link>
        </div>
      </Notice>
    )
  } else if (!view) {
    body = <Notice title="connecting…" />
  } else if (view.phase === 'lobby') {
    body = <Lobby view={view} send={(a) => room?.send(a)} />
  } else {
    body = (
      <Table
        view={view}
        send={(a) => room?.send(a)}
        error={snap.error}
        logOpen={logOpen}
        toggleLog={() => setLogOpen((o) => !o)}
      />
    )
  }

  const playing = view && view.phase !== 'lobby'

  return (
    <div className={styles.room}>
      <header className={styles.topbar}>
        <Link to="/play-cabo" className={styles.wordmarkSmall} onClick={leave} title="Leave the table">
          cabo
        </Link>
        <span className={styles.chip} title="Join word">
          {code}
        </span>
        {playing && <span className={styles.topMeta}>round {view.round}</span>}
        {status?.kind === 'reconnecting' && <span className={styles.chipWarn}>reconnecting…</span>}
        <span className={styles.spacer} />
        {playing && (
          <button
            type="button"
            className={logOpen ? styles.iconButtonOn : styles.iconButton}
            onClick={() => setLogOpen((o) => !o)}
            title="Log (L)"
            aria-label="Show the log"
            aria-pressed={logOpen}
          >
            ☰
          </button>
        )}
        <button
          type="button"
          className={styles.iconButton}
          onClick={() => help.open(playing ? 'controls' : 'rules')}
          title="Rules & controls (?)"
          aria-label="Rules and controls"
        >
          ?
        </button>
      </header>
      {body}
    </div>
  )
}

const FAIL_TITLE: Record<FailReason, string> = {
  'not-found': 'no table here',
  taken: 'word taken',
  rejected: 'can’t join',
  replaced: 'open in another tab',
  unreachable: 'can’t connect',
}

function Notice({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className={styles.center}>
      <div className={`${styles.felt} ${styles.notice}`}>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  )
}

function NamePrompt({ code, onName }: { code: string; onName: (n: string) => void }) {
  const [value, setValue] = useState('')
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!value.trim()) return
    saveName(value)
    onName(value.trim())
  }
  return (
    <main className={styles.landing}>
      <form className={`${styles.felt} ${styles.notice}`} onSubmit={submit}>
        <p className={styles.kicker}>you’re invited to</p>
        <h1 className={styles.bigCode}>{code}</h1>
        <label className={styles.field}>
          <span>your name</span>
          <input
            autoFocus
            value={value}
            maxLength={16}
            autoComplete="nickname"
            onChange={(e) => setValue(e.target.value)}
          />
        </label>
        <button type="submit" className={styles.primary} disabled={!value.trim()}>
          take a seat
        </button>
      </form>
    </main>
  )
}
