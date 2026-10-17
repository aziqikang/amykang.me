import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { cleanCode, randomWord } from '@/features/cabo/words'
import { savedHostGame } from '@/features/cabo/net'
import { useRoom } from '@/features/cabo/useRoom'
import { Lobby } from './Lobby'
import { Table } from './Table'
import { loadName, saveName } from './name'
import styles from './Cabo.module.css'

export default function CaboRoom() {
  const params = useParams()
  const code = cleanCode(params.code ?? '')
  const location = useLocation()
  const navigate = useNavigate()

  // Hosting is decided once per mount: either we came here from "create
  // room", or this tab was already hosting this word before a reload.
  const [host] = useState(
    () => (location.state as { host?: boolean } | null)?.host === true || savedHostGame(code) !== null,
  )
  const [name, setName] = useState<string | null>(() => loadName() || null)
  const { room, snap } = useRoom(code, host, name)

  useEffect(() => {
    document.title = `Cabo · ${code} · Amy Kang`
  }, [code])

  // A brand-new room whose word happens to be in use just takes another.
  useEffect(() => {
    if (snap?.status.kind === 'failed' && snap.status.reason === 'taken' && host) {
      navigate(`/play-cabo/${randomWord()}`, { replace: true, state: { host: true } })
    }
  }, [snap?.status, host, navigate])

  // Closing the tab as host ends the room for everyone, so say so.
  const others = (snap?.view?.players.length ?? 1) > 1
  useEffect(() => {
    if (!host || !others) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [host, others])

  if (code !== params.code) {
    return <Navigate to={code ? `/play-cabo/${code}` : '/play-cabo'} />
  }

  if (!name) return <NamePrompt code={code} onName={setName} />

  const status = snap?.status
  let body
  if (!snap || !status || (status.kind === 'connecting' && !snap.view)) {
    body = <Notice title={host ? 'opening the room…' : `finding “${code}”…`} />
  } else if (status.kind === 'failed' && status.reason !== 'taken') {
    body = (
      <Notice title={status.reason === 'not-found' ? 'room not found' : 'can’t join'}>
        <p>{status.message}</p>
        {status.reason === 'not-found' && (
          <p>Check the word with your host — rooms only exist while the host has the page open.</p>
        )}
        <Link className={styles.primary} to="/play-cabo">
          back to cabo
        </Link>
      </Notice>
    )
  } else if (!snap.view) {
    body = <Notice title="connecting…" />
  } else if (snap.view.phase === 'lobby') {
    body = <Lobby view={snap.view} send={(a) => room?.send(a)} />
  } else {
    body = <Table view={snap.view} send={(a) => room?.send(a)} error={snap.error} />
  }

  return (
    <div className={`page ${styles.roomPage}`}>
      <header className={styles.roomHead}>
        <Link to="/play-cabo" className={styles.back}>
          ← cabo
        </Link>
        <h1 className={styles.roomTitle}>
          <span className="visually-hidden">Cabo room </span>
          {code}
        </h1>
        {status?.kind === 'reconnecting' && (
          <span className={styles.badgeWarn}>{host ? 'reconnecting to the broker…' : 'reconnecting…'}</span>
        )}
        {host && <span className={styles.badge}>you’re hosting</span>}
      </header>
      {body}
    </div>
  )
}

function Notice({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className={styles.notice}>
      <h2>{title}</h2>
      {children}
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
    <div className="page">
      <form className={styles.notice} onSubmit={submit}>
        <p className={styles.kicker}>you’re invited to</p>
        <h1 className={styles.roomTitle}>{code}</h1>
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
          join game
        </button>
      </form>
    </div>
  )
}
