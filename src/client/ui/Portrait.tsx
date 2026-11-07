import { useState } from 'react'
import { Mirror, type MirrorRing } from './Mirror'
import { portraitCandidates } from './portraitSource'
import { usePortraitManifest } from './usePortraitManifest'

const BASE = (() => {
  try {
    return import.meta.env.BASE_URL ?? '/'
  } catch {
    return '/'
  }
})()

/** The medallion: a mirror with the officer's surname initial and a cloud scroll. Used when there is no portrait file. */
export function Medallion({ name, size }: { name: string; size: number }) {
  const initial = (name.trim().split(/\s+/)[0] ?? '?').charAt(0).toUpperCase()
  return (
    <span style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bronze-face)' }}>
      <svg viewBox="0 0 40 40" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} aria-hidden="true">
        <path d="M4 33 Q9 33 10 28 Q11 23 16 24 Q20 25 19 28.5 Q18 31 15 30 M20 34 Q27 34 29 29 Q31 24 36 25" fill="none" stroke="rgba(35,26,18,.45)" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
      <span className="medallion-letter" style={{ fontSize: size * 0.34, position: 'relative' }}>{initial}</span>
    </span>
  )
}

/**
 * An officer portrait in a mirror frame. a generated portrait listed in public/portraits/gen/manifest.json wins (by `id`, then `portrait`); else `portrait` (or `id`) names public/portraits/<name>.webp; without a file the medallion is shown.
 * `rings` forwards to the mirror (vigor / spirit arcs); `faction` is a CSS colour for the lacquer dot.
 */
export function Portrait({ id, name, portrait, size = 56, faction, rings, selected, target }: { id?: string; name: string; portrait?: string; size?: number; faction?: string; rings?: MirrorRing[]; selected?: boolean; target?: boolean }) {
  const manifest = usePortraitManifest()
  const urls = portraitCandidates({ id, portrait }, size, manifest, BASE)
  const [bad, setBad] = useState<string[]>([])
  const [loaded, setLoaded] = useState<string | null>(null)
  const src = urls.find((u) => !bad.includes(u))
  return (
    <span style={{ position: 'relative', display: 'inline-block', width: size, height: size, flex: '0 0 auto' }}>
      <Mirror size={size} rings={rings} selected={selected} target={target}>
        {!src ? <Medallion name={name} size={size} /> : null}
        {src && (
          <img
            key={src}
            src={src}
            alt={name}
            draggable={false}
            onLoad={() => setLoaded(src)}
            onError={() => setBad((b) => [...b, src])}
            style={{ opacity: loaded === src ? 1 : 0 }}
          />
        )}
      </Mirror>
      {faction && <span style={{ position: 'absolute', right: -1, bottom: -1, width: size * 0.2, height: size * 0.2, borderRadius: '50%', background: faction, border: '2px solid var(--lacquer)' }} />}
    </span>
  )
}
