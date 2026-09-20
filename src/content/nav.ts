import type { ComponentType } from 'react'
import Home from '@/pages/Home'
import Art from '@/pages/Art'
import Contact from '@/pages/About'

export type NavItem = {
  path: string
  label: string
  /** Rendered when this route is active. */
  Component: ComponentType
  /** Stable anchor for the onboarding tour to point at (Phase 4). */
  tourId: string
}

/**
 * The single list that drives BOTH the <Routes> table in App.tsx and the
 * tab bar in Nav.tsx.
 *
 * Adding a tab is therefore two steps and no more: drop a component in
 * src/pages/, add one row here. There is deliberately no second place
 * where routes are declared, because that is exactly where a nav and a
 * router drift apart.
 */
export const NAV: readonly NavItem[] = [
  { path: '/', label: 'home', Component: Home, tourId: 'nav-home' },
  { path: '/art', label: 'art', Component: Art, tourId: 'nav-art' },
  { path: '/contact', label: 'contact', Component: Contact, tourId: 'nav-contact' },
]
