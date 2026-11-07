import type { ReactNode } from 'react'

export interface MirrorRing {
  /** 0..1 fill of the arc. */
  value: number
  color: string
}

/**
 * A bronze mirror: concentric rings, a rim of tiny saw-tooth triangles. Children sit inside the face (a portrait, a letter, a number).
 * `rings` draws arcs just inside the saw-tooth rim, outermost first (a duel's vigor and spirit).
 */
export function Mirror({
  size = 64,
  face = 'var(--bronze-face)',
  rim = 'var(--verdigris)',
  rings,
  knob = false,
  selected = false,
  target = false,
  children,
  className,
  style,
}: {
  size?: number
  face?: string
  rim?: string
  rings?: MirrorRing[]
  knob?: boolean
  selected?: boolean
  target?: boolean
  children?: ReactNode
  className?: string
  style?: React.CSSProperties
}) {
  const teeth = Math.max(16, Math.round(size / 3.2))
  const tri: string[] = []
  for (let i = 0; i < teeth; i++) {
    const a0 = ((i - 0.35) / teeth) * Math.PI * 2
    const a1 = ((i + 0.35) / teeth) * Math.PI * 2
    const am = (i / teeth) * Math.PI * 2
    const p = (a: number, r: number): string => `${(50 + Math.sin(a) * r).toFixed(2)},${(50 - Math.cos(a) * r).toFixed(2)}`
    tri.push(`${p(a0, 46)} ${p(am, 49.4)} ${p(a1, 46)}`)
  }
  const ringR = (k: number): number => 41.5 - k * 4.4
  return (
    <span className={`mirror ${className ?? ''}`} style={{ width: size, height: size, ...style }}>
      <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
        <circle cx="50" cy="50" r="49" fill="var(--lacquer)" />
        {tri.map((t, i) => (
          <polygon key={i} points={t} fill={rim} />
        ))}
        <circle cx="50" cy="50" r="46" fill="none" stroke={rim} strokeWidth="1.6" />
        <circle cx="50" cy="50" r="44" fill={face} />
        <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(0,0,0,.35)" strokeWidth="1" />
        <circle cx="50" cy="50" r="30" fill="none" stroke="rgba(35,26,18,.35)" strokeWidth="1" />
        <circle cx="50" cy="50" r="38" fill="none" stroke="rgba(35,26,18,.22)" strokeWidth="0.8" strokeDasharray="1.5 2.5" />
        {rings?.map((rg, k) => {
          const r = ringR(k)
          const c = 2 * Math.PI * r
          return (
            <g key={k} transform="rotate(-90 50 50)">
              <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(15,12,11,.55)" strokeWidth="3.4" />
              <circle cx="50" cy="50" r={r} fill="none" stroke={rg.color} strokeWidth="3.4" strokeLinecap="butt" strokeDasharray={`${Math.max(0, Math.min(1, rg.value)) * c} ${c}`} />
            </g>
          )
        })}
        {knob && (
          <>
            <circle cx="50" cy="50" r="7" fill="var(--bronze-face)" stroke="rgba(35,26,18,.6)" strokeWidth="1" />
            <circle cx="50" cy="50" r="2.4" fill="rgba(35,26,18,.7)" />
          </>
        )}
        {selected && <circle cx="50" cy="50" r="50" fill="none" stroke="var(--vermilion)" strokeWidth="2.4" />}
        {target && <circle cx="50" cy="50" r="50" fill="none" stroke="var(--vermilion)" strokeWidth="2.4" strokeDasharray="5 4" />}
      </svg>
      {children !== undefined && <span className="mirror-in">{children}</span>}
    </span>
  )
}
