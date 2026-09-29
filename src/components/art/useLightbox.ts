import { useCallback, useEffect, useRef, useState } from 'react'
import { jumpScroll } from '@/lib/scroll'

/**
 * Open/close state for a lightbox, plus the two things around it that are
 * easy to get wrong and were hard-won here: locking the page behind the
 * overlay, and putting focus back where it came from.
 *
 * Shared by every grid so the photography galleries inherit the fixes rather
 * than reimplementing them and rediscovering the same bugs.
 */
export function useLightbox() {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  // Remember which card opened it so focus can go home. Losing focus to
  // <body> on close strands keyboard users at the top of the page.
  const triggerRef = useRef<HTMLButtonElement | null>(null)

  /**
   * Lock the page while the lightbox is open.
   *
   * Pinning <body> at a negative offset rather than setting overflow:
   * hidden. Overflow alone did not actually hold — the wheel still scrolled
   * the grid behind the overlay — and it has never worked on iOS Safari.
   * Taking the body out of flow is the version that does, with the scroll
   * position restored exactly on close.
   *
   * Keyed on the open STATE, not on the Lightbox component's lifecycle: that
   * component unmounts only once its exit animation finishes, so a close
   * interrupted mid-animation would strand the page locked.
   */
  useEffect(() => {
    if (openIndex === null) return

    const { body } = document
    const scrollY = window.scrollY
    const saved = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
    }

    body.style.position = 'fixed'
    body.style.top = `-${scrollY}px`
    body.style.left = '0'
    body.style.right = '0'
    body.style.width = '100%'

    return () => {
      Object.assign(body.style, saved)
      // Jump, don't glide — html has scroll-behavior: smooth, which would
      // otherwise animate the restore and look like the page fell over.
      jumpScroll(scrollY, 0)
    }
  }, [openIndex])

  const open = useCallback((index: number, trigger: HTMLButtonElement) => {
    triggerRef.current = trigger
    setOpenIndex(index)
  }, [])

  const close = useCallback(() => {
    setOpenIndex(null)
    triggerRef.current?.focus()
  }, [])

  return { openIndex, open, close, navigate: setOpenIndex }
}
