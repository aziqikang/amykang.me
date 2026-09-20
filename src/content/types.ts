/**
 * Content shapes. The JSON files are imported directly and asserted
 * against these, so a typo in data fails `npm run build` rather than
 * rendering "undefined" in production.
 */

/** Drives the node color and the chip on each timeline card. */
export type TimelineKind = 'experience' | 'education' | 'project' | 'travel'

export type TimelineEntry = {
  id: string
  /**
   * Sort key, YYYY-MM. Kept separate from dateLabel so entries order
   * correctly while still displaying human ranges like
   * "Nov 2024 – May 2025" — something the old resume.json couldn't do,
   * since it only had the display string.
   */
  start: string
  dateLabel: string
  kind: TimelineKind
  title: string
  org?: string
  /** Small badge, e.g. "incoming". */
  status?: string
  /** One line, shown while collapsed. Optional — an entry whose title and
      org already say it needs no gloss, and omitting this collapses the
      space rather than leaving a gap. */
  summary?: string
  /** Bullets revealed on expand. */
  detail?: string[]
  tags?: string[]
  links?: { label: string; url: string }[]
  /** Slug of a full page under /e/. Surfaces a link on the collapsed card. */
  page?: string
  /**
   * What that link says. "read more" was too limp to click — this should
   * name the thing waiting on the other side.
   */
  pageLabel?: string
}

export type HomeData = {
  /** First entry becomes the page's <h1>; the rest are paragraphs. */
  intro: string[]
}

export type ArtPiece = {
  /** Must match the filename in art-src/ and public/art/. */
  id: string
  title: string
  year: string
  medium: string
  award?: string
  description?: string
}

export type AboutLink = {
  label: string
  url: string
  /** Matches a key in the ICONS map in About.tsx. */
  icon: 'github' | 'linkedin' | 'email' | 'resume'
}

export type AboutData = {
  name: string
  /**
   * One photo per theme. Each carries its own `focus` because the two are
   * framed completely differently — the daylight shot is a close-up with
   * Amy's face near the top, the dusk one a wide shot with her low in the
   * frame — and both have to land in the same circle.
   */
  portrait: {
    light: { src: string; focus: string }
    dark: { src: string; focus: string }
  }
  portraitAlt: string
  paragraphs: string[]
  links: AboutLink[]
}

/** Written by scripts/compress-art.mjs; keyed by piece id. */
export type ArtDims = Record<string, { w: number; h: number }>
