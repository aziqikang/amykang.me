import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { Rules } from './Rules'
import styles from './Cabo.module.css'

type Tab = 'rules' | 'controls'
type HelpApi = { open: (tab?: Tab) => void; isOpen: boolean }

const HelpContext = createContext<HelpApi>({ open: () => {}, isOpen: false })
export const useHelp = () => useContext(HelpContext)

/** Rules and controls in one sheet, reachable from anywhere with ? */
export function HelpProvider({ children }: { children: ReactNode }) {
  const [tab, setTab] = useState<Tab | null>(null)
  const open = useCallback((t: Tab = 'rules') => setTab(t), [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && tab) {
        e.preventDefault()
        setTab(null)
        return
      }
      if (typingIn(e)) return
      if (e.key === '?' || (e.key === 'h' && !e.metaKey && !e.ctrlKey)) {
        e.preventDefault()
        setTab((t) => (t ? null : 'rules'))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [tab])

  return (
    <HelpContext.Provider value={{ open, isOpen: tab !== null }}>
      {children}
      {tab && (
        <div className={styles.sheetBackdrop} onClick={() => setTab(null)}>
          <div
            className={styles.sheet}
            role="dialog"
            aria-modal="true"
            aria-label="How to play"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.sheetHead}>
              <div className={styles.tabs} role="tablist">
                {(['rules', 'controls'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    role="tab"
                    aria-selected={tab === t}
                    className={tab === t ? styles.tabOn : styles.tab}
                    onClick={() => setTab(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className={styles.iconButton}
                onClick={() => setTab(null)}
                aria-label="Close"
                autoFocus
              >
                ✕
              </button>
            </div>
            <div className={styles.sheetBody}>{tab === 'rules' ? <Rules /> : <Controls />}</div>
          </div>
        </div>
      )}
    </HelpContext.Provider>
  )
}

/** True when a keystroke belongs to a text field, not the game. */
export function typingIn(e: KeyboardEvent) {
  const el = e.target as HTMLElement | null
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
}

const KEYS: [string, string][] = [
  ['D', 'draw from the deck'],
  ['T', 'take the top discard'],
  ['1 – 9', 'tap your card with that number (shown under each card)'],
  ['Enter', 'confirm — swap in, swap / look at the chosen pair, ready, deal'],
  ['X', 'discard the drawn card (and use its power)'],
  ['S', 'stack the card under the pointer onto the pile'],
  ['Y / N', 'swap or leave the cards after a black king look'],
  ['Esc', 'skip a power, clear your selection, close this sheet'],
  ['C C', 'call Cabo — press twice, so it can’t happen by accident'],
  ['L', 'show or hide the log'],
  ['?', 'open or close this sheet'],
]

function Controls() {
  return (
    <div className={styles.controls}>
      <section>
        <h3>stacking</h3>
        <p>
          Whenever the top of the discard pile matches a card you think you know — yours or anyone
          else’s — throw it on the pile:
        </p>
        <ul className={styles.bullets}>
          <li>
            <b>Desktop:</b> double-click the card, drag it onto the pile, or hover it and press{' '}
            <kbd>S</kbd>.
          </li>
          <li>
            <b>Phone:</b> double-tap the card, or flick it toward the pile.
          </li>
        </ul>
        <p>
          Stacked someone else’s card? Tap one of yours to hand it over. Guessed wrong? The card
          goes back and you take a penalty card.
        </p>
      </section>

      <section>
        <h3>keyboard</h3>
        <dl className={styles.keys}>
          {KEYS.map(([k, v]) => (
            <div key={k}>
              <dt>
                {k.split(' ').map((part, i) =>
                  part === '/' || part === '–' ? (
                    <span key={i}> {part} </span>
                  ) : (
                    <kbd key={i}>{part}</kbd>
                  ),
                )}
              </dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
        <p className={styles.muted}>Buttons show their key in the corner, and cards say what they do on hover.</p>
      </section>

      <section>
        <h3>everything else</h3>
        <ul className={styles.bullets}>
          <li>Glowing gold means “you can tap this now”.</li>
          <li>Peeked cards stay face up for five seconds, then it’s up to your memory.</li>
          <li>Cards that move flash for everyone, so watch the table.</li>
        </ul>
      </section>
    </div>
  )
}
