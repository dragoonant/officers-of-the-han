// Local ornaments and controls for the world client (Han lacquerware, docs/spec/50-presentation.md).
// seam.tsx is the only file that decides whether these or the board agent's src/client/ui/** are used.
import { useId, type CSSProperties, type ReactNode } from 'react'
import type { StatKey } from '../../contracts/data'

const BASE = import.meta.env.BASE_URL

/** One cloud-scroll motif repeated across a strip. Colour comes from currentColor. */
export function CloudBand({ className, drift }: { className?: string; drift?: boolean }) {
  const id = useId()
  return (
    <svg className={className} width="100%" height="100%" preserveAspectRatio="none" aria-hidden="true" style={{ display: 'block' }}>
      <defs>
        <pattern id={id} width="48" height="14" patternUnits="userSpaceOnUse">
          <path d="M0 11 C6 11 8 3 15 3 C21 3 22 9 18 9 C15 9 15 6 17 6 M15 3 C20 2 24 6 30 6 C36 6 38 11 48 11" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="30" cy="6" r="1.4" fill="currentColor" />
        </pattern>
      </defs>
      <g className={drift ? 'drift' : undefined}>
        <rect x="0" y="0" width="3000" height="100%" fill={`url(#${id})`} />
      </g>
    </svg>
  )
}

/** A bronze mirror: sawtooth rim, concentric rings, knob. */
export function Mirror({ size = 48, ring, children, style, face = 'var(--bronze-face)' }: { size?: number; ring?: string; children?: ReactNode; style?: CSSProperties; face?: string }) {
  const r = 50
  return (
    <span style={{ position: 'relative', display: 'inline-block', width: size, height: size, flex: '0 0 auto', ...style }}>
      <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true" style={{ position: 'absolute', inset: 0 }}>
        {ring && <circle cx="50" cy="50" r="48" fill="none" stroke={ring} strokeWidth="5" />}
        <circle cx="50" cy="50" r="44" fill={face} stroke="#3b2a18" strokeWidth="1.5" />
        <circle cx="50" cy="50" r="43" fill="none" stroke="#6a5530" strokeWidth="4" strokeDasharray="2.2 2.2" />
        <circle cx="50" cy="50" r="34" fill="none" stroke="#6a5530" strokeWidth="1.2" />
        <circle cx="50" cy="50" r="26" fill="none" stroke="#8d7440" strokeWidth="1" />
        <circle cx="50" cy="50" r={r - 41} fill="#8d7440" opacity={children ? 0 : 1} />
      </svg>
      {children && <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{children}</span>}
    </span>
  )
}

export function portraitUrl(portrait?: string): string | null {
  return portrait ? `${BASE}portraits/${portrait}.webp` : null
}

function initials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] ?? '?') + (parts.length > 1 ? parts[parts.length - 1]![0]! : '')).toUpperCase()
}

/** Portrait in a mirror frame, or the medallion (initials on a bronze disc) when there is no art. */
export function Portrait({ name, portrait, size = 56, ring }: { name: string; portrait?: string | undefined; size?: number; ring?: string | undefined }) {
  const url = portraitUrl(portrait)
  return (
    <span style={{ position: 'relative', display: 'inline-block', width: size, height: size, flex: '0 0 auto' }} data-portrait={portrait ?? 'medallion'}>
      <Mirror size={size} {...(ring ? { ring } : {})} />
      {url ? (
        <img src={url} alt="" draggable={false} style={{ position: 'absolute', left: '13%', top: '13%', width: '74%', height: '74%', borderRadius: '50%', objectFit: 'cover', objectPosition: 'center 20%', border: '1px solid #3b2a18' }} />
      ) : (
        <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: size * 0.28, color: '#3b2a18', letterSpacing: '0.05em' }}>{initials(name)}</span>
      )}
    </span>
  )
}

export const factionVar = (color: number | null | undefined): string => (color ? `var(--f-${color})` : 'var(--dust)')

export function FactionDot({ color }: { color: number | null | undefined }) {
  return <span className="dot" style={{ background: factionVar(color) }} />
}

const STAT_LABEL: Record<StatKey, string> = { war: 'WAR', ldr: 'LDR', int: 'INT', pol: 'POL', cha: 'CHA' }
export function statLabel(k: StatKey): string { return STAT_LABEL[k] }

/** A stat as a mirror back: the ring fills to value/100. */
export function StatDial({ label, value, size = 46 }: { label: string; value: number; size?: number }) {
  const c = 2 * Math.PI * 38
  const frac = Math.max(0, Math.min(1, value / 100))
  return (
    <span className="dial" data-stat={label}>
      <span style={{ position: 'relative', display: 'inline-block', width: size, height: size }}>
        <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true" style={{ position: 'absolute', inset: 0 }}>
          <circle cx="50" cy="50" r="46" fill="#1c1613" stroke="#3b2a18" strokeWidth="2" />
          <circle cx="50" cy="50" r="38" fill="none" stroke="#4a3a2a" strokeWidth="9" />
          <circle cx="50" cy="50" r="38" fill="none" stroke="var(--ochre)" strokeWidth="9" strokeDasharray={`${c * frac} ${c}`} transform="rotate(-90 50 50)" />
          <circle cx="50" cy="50" r="30" fill="var(--bronze-face)" stroke="#3b2a18" strokeWidth="1.5" />
        </svg>
        <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#231a12', fontSize: size * 0.3 }}>{value}</span>
      </span>
      {label}
    </span>
  )
}

export function LacquerButton({ children, onClick, primary, disabled, available, selected, big, small, className, testid, type = 'button', title }: {
  children: ReactNode; onClick?: () => void; primary?: boolean; disabled?: boolean; available?: boolean; selected?: boolean; big?: boolean; small?: boolean; className?: string; testid?: string; type?: 'button' | 'submit'; title?: never
}) {
  void title
  const cls = ['lbtn', primary ? 'primary' : '', disabled ? 'off' : '', available && !disabled ? 'avail' : '', selected ? 'sel' : '', big ? 'big' : '', small ? 'small' : '', className ?? ''].filter(Boolean).join(' ')
  return (
    <button type={type} className={cls} disabled={disabled} onClick={onClick} data-testid={testid} aria-disabled={disabled || undefined}>
      {children}
    </button>
  )
}

/** A lacquer box that opens (bottom sheet on phones, via CSS). */
export function LacquerBox({ title, onClose, children, wide, testid, footer }: { title: ReactNode; onClose?: () => void; children: ReactNode; wide?: boolean; testid?: string; footer?: ReactNode }) {
  return (
    <div className="overlay" data-testid={testid}>
      <div className={`lbox${wide ? ' wide' : ''}`} role="dialog" aria-label={typeof title === 'string' ? title : undefined}>
        <div className="band"><CloudBand /></div>
        <div className="inner">
          <div className="head">
            <h2>{title}</h2>
            {onClose && <button className="x" onClick={onClose} aria-label="Close">×</button>}
          </div>
          {children}
          {footer && <div style={{ marginTop: 12 }}>{footer}</div>}
        </div>
      </div>
    </div>
  )
}

/** A pale silk letter edged in vermilion; answers are lacquer buttons. */
export function SilkLetter({ title, from, children, testid }: { title: ReactNode; from?: ReactNode; children: ReactNode; testid?: string }) {
  return (
    <div className="overlay letterbg">
      <div className="silk" role="dialog" aria-label="Letter" data-testid={testid ?? 'letter'}>
        {from && <div className="from">{from}</div>}
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  )
}

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
