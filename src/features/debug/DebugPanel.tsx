import { useEffect, useState } from 'react'

/**
 * On-device geometry readout, shown only when the URL carries ?debug.
 *
 * iOS Safari has no console without a USB cable and a Mac, so a bug that
 * only reproduces on a phone is otherwise diagnosed by guesswork. This
 * prints the numbers that matter for the timeline's layout so they can be
 * read straight off the screen.
 *
 * Delete once the mobile layout is settled — it is a diagnostic, not a
 * feature, and it has no business shipping to visitors.
 */
export function DebugPanel() {
  const [lines, setLines] = useState<string[]>([])

  useEffect(() => {
    const tick = () => {
      const out: string[] = []
      const root = getComputedStyle(document.documentElement)
      const field = document.querySelector<HTMLElement>('[class*="field"]')

      out.push(`vp ${window.innerWidth}x${window.innerHeight}  scrollY ${Math.round(window.scrollY)}`)
      out.push(`doc ${document.documentElement.scrollHeight}  field ${field ? Math.round(field.getBoundingClientRect().height) : '?'}`)
      out.push(
        `safe t${root.getPropertyValue('--sat') || '?'} b${root.getPropertyValue('--sab') || '?'}`,
      )

      const rows = [...document.querySelectorAll<HTMLElement>('[role="listitem"]')]
      rows.forEach((row, i) => {
        const box = row.getBoundingClientRect()
        // only rows anywhere near the screen, or the list is unreadable
        if (box.bottom < -50 || box.top > window.innerHeight + 50) return
        const wrapper = row.querySelector<HTMLElement>('[data-expandable]')
        const card = row.querySelector<HTMLElement>('article')
        const node = row.querySelector<HTMLElement>('[class*="node"]')
        const h = (el: HTMLElement | null) =>
          el ? Math.round(el.getBoundingClientRect().height) : '-'
        out.push(
          `#${i} row${Math.round(box.height)} card${h(card)} ` +
            `spine${h(node)} exp${h(wrapper)}`,
        )
      })

      setLines(out)
    }

    tick()
    const id = window.setInterval(tick, 400)
    window.addEventListener('scroll', tick, { passive: true })
    return () => {
      window.clearInterval(id)
      window.removeEventListener('scroll', tick)
    }
  }, [])

  return (
    <pre
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 999,
        margin: 0,
        padding: '6px 8px',
        maxHeight: '38vh',
        overflow: 'auto',
        background: 'rgba(0,0,0,.82)',
        color: '#9f9',
        font: '10px/1.35 ui-monospace, Menlo, monospace',
        pointerEvents: 'none',
        whiteSpace: 'pre-wrap',
      }}
    >
      {lines.join('\n')}
    </pre>
  )
}
