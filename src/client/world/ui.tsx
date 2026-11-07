// Icons and small helpers for the world client. The ornaments (mirror, box, silk, button) come from
// src/client/ui/** through seam.tsx.
import type { StatKey } from '../../contracts/data'

const BASE = import.meta.env.BASE_URL
export function portraitUrl(portrait?: string): string | null {
  return portrait ? `${BASE}portraits/${portrait}.webp` : null
}

export const factionVar = (color: number | null | undefined): string => (color ? `var(--f-${color})` : 'var(--dust)')

export function FactionDot({ color }: { color: number | null | undefined }) {
  return <span className="dot" style={{ background: factionVar(color) }} />
}

const STAT_LABEL: Record<StatKey, string> = { war: 'WAR', ldr: 'LDR', int: 'INT', pol: 'POL', cha: 'CHA' }
export function statLabel(k: StatKey): string { return STAT_LABEL[k] }

// ---- log icons ----
export const ICON_PATHS: Record<string, string> = {
  coin: 'M8 2a6 6 0 100 12A6 6 0 008 2zm0 3v6M6 8h4',
  sword: 'M3 13l7-7 3-3 0 3-3 3-7 7zm1 0l-2 2',
  scroll: 'M4 3h8v10H4zM6 6h4M6 9h4',
  leaf: 'M3 13C3 6 8 3 13 3c0 6-3 10-10 10zm0 0l5-5',
  road: 'M5 14L7 2M11 14L9 2M8 4v2M8 9v2',
  person: 'M8 8a3 3 0 100-6 3 3 0 000 6zM3 14c0-3 2-5 5-5s5 2 5 5',
  heart: 'M8 14S2 10 2 6a3 3 0 016-1 3 3 0 016 1c0 4-6 8-6 8z',
  flag: 'M4 14V2M4 3h8l-2 3 2 3H4',
  skull: 'M8 2a5 5 0 00-3 9v3h6v-3a5 5 0 00-3-9zM6 8h1M9 8h1',
  star: 'M8 2l1.8 3.8 4.2.6-3 3 .7 4.2L8 11.5 4.3 13.6 5 9.4 2 6.4l4.2-.6z',
  knot: 'M3 8a3 3 0 016 0 3 3 0 016 0 3 3 0 01-6 0 3 3 0 01-6 0z',
  tower: 'M4 14V6h2V4h1v2h2V4h1v2h2v8zM7 14v-3h2v3',
  moon: 'M10 2a6 6 0 100 12 5 5 0 010-12z',
}

export function Icon({ name, size = 16 }: { name: string; size?: number }) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" data-icon={name}>
      <path d={ICON_PATHS[name] ?? ICON_PATHS.star} />
    </svg>
  )
}
