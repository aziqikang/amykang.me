import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { EGGS, MAX_SEQUENCE, PRESS_EGGS, SEQUENCE_EGGS } from './registry'
import styles from './EggProvider.module.css'

const STORAGE_KEY = 'amykang.eggs.found'

type EggContextValue = {
  /** Set off a component-fired egg. */
  fire: (id: string) => void
  found: string[]
}

const EggContext = createContext<EggContextValue | null>(null)

export function useEggs() {
  const context = useContext(EggContext)
  if (!context) throw new Error('useEggs must be used inside <EggProvider>')
  return context
}

function readFound(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    // Filtered against the live registry: eggs get renamed and retired,
    // and a stale id left in storage would count toward the total and
    // show someone 4/3.
    const known = new Set(EGGS.map((egg) => egg.id))
    return (JSON.parse(raw) as string[]).filter((id) => known.has(id))
  } catch {
    // Private browsing, disabled storage, corrupted value — an easter egg
    // is never worth breaking the page over.
    return []
  }
}

export function EggProvider({ children }: { children: ReactNode }) {
  const [found, setFound] = useState<string[]>(readFound)
  const [toast, setToast] = useState<string | null>(null)

  const buffer = useRef<string[]>([])
  const toastTimer = useRef<number | undefined>(undefined)

  const trigger = useCallback((id: string) => {
    const egg = EGGS.find((e) => e.id === id)
    if (!egg) return

    egg.effect()
    setToast(egg.label)

    setFound((previous) => {
      if (previous.includes(id)) return previous
      const next = [...previous, id]
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch {
        /* nothing worth handling */
      }
      return next
    })

    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 2600)
  }, [])

  const fire = useCallback(
    (id: string) => {
      const egg = EGGS.find((e) => e.id === id)
      if (!egg || egg.trigger.type !== 'manual') return
      trigger(id)
    },
    [trigger],
  )

  // Independent of the listener below, which may never mount.
  useEffect(() => () => window.clearTimeout(toastTimer.current), [])

  useEffect(() => {
    // Every egg is component-fired at the moment, so there is nothing to
    // watch the keyboard for. The machinery stays — a keyboard egg is
    // still one registry entry away — but it does not sit scanning every
    // keystroke for zero possible matches.
    if (!SEQUENCE_EGGS.length && !PRESS_EGGS.length) return

    function onKeyDown(event: KeyboardEvent) {
      // Never swallow what someone is typing into a field.
      //
      // The instanceof guard is load-bearing: event.target is not always
      // an Element (it is `window` for events dispatched on window), and
      // calling .matches() on one throws, which would kill the listener
      // for the rest of the session.
      const target = event.target
      if (
        target instanceof HTMLElement &&
        target.matches('input, textarea, select, [contenteditable="true"]')
      ) {
        return
      }

      // Lowercase unconditionally. Casing the buffer and the registry
      // differently is how "ArrowUp" silently fails to equal "arrowup"
      // and the konami code never fires.
      const key = event.key.toLowerCase()

      // Single-key eggs fire only when the page itself holds focus.
      // Enter is how a keyboard user activates whatever they have tabbed
      // to, so this must not go off when anything is focused — and a
      // modified press (⌘↵, ⇧↵) always belongs to the browser or the app.
      const bare =
        !event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey
      const idle =
        document.activeElement === null || document.activeElement === document.body

      if (bare && idle) {
        for (const egg of PRESS_EGGS) {
          if (egg.trigger.key.toLowerCase() === key) {
            trigger(egg.id)
            return
          }
        }
      }

      buffer.current = [...buffer.current, key].slice(-MAX_SEQUENCE)

      for (const egg of SEQUENCE_EGGS) {
        const { keys } = egg.trigger
        const tail = buffer.current.slice(-keys.length)
        if (tail.length === keys.length && tail.every((k, i) => k === keys[i]?.toLowerCase())) {
          buffer.current = []
          trigger(egg.id)
          break
        }
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [trigger])

  const value = useMemo(() => ({ fire, found }), [fire, found])

  return (
    <EggContext.Provider value={value}>
      {children}

      <AnimatePresence>
        {toast && (
          <motion.div
            className={styles.toast}
            role="status"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.22, ease: [0.22, 0.61, 0.36, 1] }}
          >
            <span className={styles.egg} aria-hidden="true">
              {'\u{1F423}'}
            </span>
            <span className={styles.label}>{toast}</span>
            <span className={styles.count}>
              {found.length}/{EGGS.length}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </EggContext.Provider>
  )
}
