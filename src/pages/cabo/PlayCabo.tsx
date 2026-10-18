import { useEffect, useState, type CSSProperties, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { MAX_PLAYERS, MIN_PLAYERS, type Card } from '@/features/cabo/engine'
import { cleanCode, randomWord } from '@/features/cabo/words'
import { useHelp } from './Help'
import { PlayingCard } from './PlayingCard'
import { loadName, saveName } from './name'
import styles from './Cabo.module.css'

/** Four cards fanned across the felt, two of them peeked. */
const FAN: (Card | null)[] = [
  { id: 100, rank: 13, suit: 'H' },
  null,
  null,
  { id: 101, rank: 7, suit: 'S' },
]

export default function PlayCabo() {
  const navigate = useNavigate()
  const help = useHelp()
  const [name, setName] = useState(loadName)
  const [code, setCode] = useState('')
  const [nameError, setNameError] = useState(false)

  useEffect(() => {
    document.title = 'Cabo'
  }, [])

  const needName = () => {
    if (name.trim()) return false
    setNameError(true)
    document.getElementById('cabo-name')?.focus()
    return true
  }

  const host = () => {
    if (needName()) return
    saveName(name)
    navigate(`/play-cabo/${randomWord()}`, { state: { host: true } })
  }

  const joinRoom = (e: FormEvent) => {
    e.preventDefault()
    const word = cleanCode(code)
    if (!word || needName()) return
    saveName(name)
    navigate(`/play-cabo/${word}`)
  }

  return (
    <main className={styles.landing}>
      <div className={`${styles.felt} ${styles.landingFelt}`}>
        <div className={styles.fan} aria-hidden>
          {FAN.map((c, i) => (
            <div key={i} className={styles.fanCard} style={{ '--i': i } as CSSProperties}>
              <PlayingCard card={c} size="lg" />
            </div>
          ))}
        </div>

        <h1 className={styles.wordmark}>cabo</h1>
        <p className={styles.tagline}>
          The memory card game for {MIN_PLAYERS}–{MAX_PLAYERS}. Keep your total low, remember
          what you’ve seen, and call Cabo before anyone else.
        </p>

        <label className={styles.field}>
          <span>your name</span>
          <input
            id="cabo-name"
            value={name}
            maxLength={16}
            autoComplete="nickname"
            placeholder="e.g. amy"
            aria-invalid={nameError}
            onChange={(e) => {
              setName(e.target.value)
              setNameError(false)
            }}
          />
          {nameError && <small className={styles.fieldError}>Pick a name first.</small>}
        </label>

        <div className={styles.choices}>
          <button type="button" className={styles.primary} onClick={host}>
            host a table
          </button>
          <span className={styles.or}>or</span>
          <form className={styles.inline} onSubmit={joinRoom}>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="join word"
              aria-label="Join word"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
            <button type="submit" className={styles.secondary} disabled={!cleanCode(code)}>
              join
            </button>
          </form>
        </div>

        <button type="button" className={styles.textButton} onClick={() => help.open('rules')}>
          how to play <kbd>?</kbd>
        </button>
      </div>
    </main>
  )
}
