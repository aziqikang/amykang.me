import { useState, type CSSProperties, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Page } from '@/components/chrome/Page'
import { Reveal } from '@/components/motion'
import { MAX_PLAYERS, MIN_PLAYERS } from '@/features/cabo/engine'
import { cleanCode, randomWord } from '@/features/cabo/words'
import { PlayingCard } from './PlayingCard'
import { Rules } from './Rules'
import { loadName, saveName } from './name'
import styles from './Cabo.module.css'

/** Four cards fanned across the top of the page, two of them peeked. */
const FAN = [
  { id: 100, rank: 13, suit: 'H' as const },
  null,
  null,
  { id: 101, rank: 7, suit: 'S' as const },
]

export default function PlayCabo() {
  const navigate = useNavigate()
  const [name, setName] = useState(loadName)
  const [code, setCode] = useState('')
  const [nameError, setNameError] = useState(false)

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
    <Page
      title="Cabo"
      documentTitle="Play Cabo"
      kicker="a card game"
      lede={`A memory game for ${MIN_PLAYERS}–${MAX_PLAYERS} players with a standard deck. Keep your total low, remember what you've seen, and call Cabo when you think you've won.`}
    >
      <div className={styles.fan} aria-hidden>
        {FAN.map((c, i) => (
          <div key={i} className={styles.fanCard} style={{ '--i': i } as CSSProperties}>
            <PlayingCard card={c} size="lg" />
          </div>
        ))}
      </div>

      <Reveal>
        <div className={styles.entry}>
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
            <div className={styles.choice}>
              <h2>host a room</h2>
              <p>You get a join word to share. Start whenever everyone’s in.</p>
              <button type="button" className={styles.primary} onClick={host}>
                create room
              </button>
            </div>

            <form className={styles.choice} onSubmit={joinRoom}>
              <h2>join a room</h2>
              <p>Type the word your host gave you.</p>
              <div className={styles.inline}>
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="hippopotamus"
                  aria-label="Join word"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                />
                <button type="submit" className={styles.primary} disabled={!cleanCode(code)}>
                  join
                </button>
              </div>
            </form>
          </div>
        </div>
      </Reveal>

      <Reveal delay={0.06}>
        <h2 className={styles.sectionTitle}>how to play</h2>
        <Rules />
      </Reveal>
    </Page>
  )
}
