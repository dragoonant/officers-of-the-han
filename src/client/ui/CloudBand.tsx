import { useId } from 'react'

/** Cloud-scroll band: one curl path repeated along the width. `color` defaults to vermilion; pass var(--ochre) on red. */
export function CloudBand({ height = 14, color = 'var(--vermilion)', className, style }: { height?: number; color?: string; className?: string; style?: React.CSSProperties }) {
  const id = useId().replace(/:/g, '')
  return (
    <svg className={className} style={{ display: 'block', width: '100%', height, color, ...style }} aria-hidden="true" focusable="false" preserveAspectRatio="none">
      <defs>
        <pattern id={id} width="22" height="14" patternUnits="userSpaceOnUse">
          <path
            d="M0 12 H2 Q7 12 9 8 Q11 3 16 4 Q20 5 19 8.5 Q18 11 14.8 10.2 Q12.8 9.4 14 8"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </pattern>
      </defs>
      <rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
      <rect x="0" y={height - 1.5} width="100%" height="1.5" fill="currentColor" opacity="0.6" />
    </svg>
  )
}
