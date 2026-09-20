export type StarProps = {
  /** Rendered size in px. The star is square. */
  size?: number
  className?: string
  /** Decorative next to a wordmark; labelled when standing alone. */
  title?: string
}

/**
 * The site's star mark — the same geometry as the cursor, so the pointer
 * and the logo are recognisably the same object.
 *
 * Filled with currentColor rather than a token, so whatever places it
 * decides the colour.
 */
export function Star({ size = 40, className, title }: StarProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      role={title ? 'img' : 'presentation'}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {title && <title>{title}</title>}
      <path d="M10 1 L12.23 6.93 L18.56 7.22 L13.61 11.17 L15.29 17.28 L10 13.8 L4.71 17.28 L6.39 11.17 L1.44 7.22 L7.77 6.93 Z" />
    </svg>
  )
}
