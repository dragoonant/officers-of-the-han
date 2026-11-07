import type { WorldState } from '../../contracts/world'
import { world } from '../../world'
import { ymText } from '../save/save'
import { money } from './format'
import { colorOf } from './lookup'
import { LacquerButton, Portrait } from './seam'
import { useUi } from '../store/ui'
import { FactionDot } from './ui'

/** A mirror whose rim shows twelve months; the lit segment turns one step per month (400 ms). */
export function MonthDial({ ym, size = 52 }: { ym: { year: number; month: number }; size?: number }) {
  const segs = Array.from({ length: 12 }, (_, i) => i)
  return (
    <span style={{ position: 'relative', display: 'inline-block', width: size, height: size }} data-testid="month-dial" aria-label={ymText(ym)}>
      <svg viewBox="0 0 100 100" width={size} height={size}>
        <circle cx="50" cy="50" r="47" fill="#1c1613" stroke="#3b2a18" strokeWidth="2" />
        {segs.map((i) => {
          const a0 = (i * 30 - 90 + 2) * (Math.PI / 180)
          const a1 = ((i + 1) * 30 - 90 - 2) * (Math.PI / 180)
          const p = (a: number, r: number): string => `${(50 + r * Math.cos(a)).toFixed(1)} ${(50 + r * Math.sin(a)).toFixed(1)}`
          return <path key={i} d={`M${p(a0, 40)} A40 40 0 0 1 ${p(a1, 40)}`} fill="none" strokeWidth="9" stroke={i + 1 === ym.month ? 'var(--vermilion)' : i + 1 < ym.month ? '#7a5a30' : '#4a3a2a'} style={{ transition: 'stroke 400ms' }} />
        })}
        <circle cx="50" cy="50" r="27" fill="var(--bronze-face)" stroke="#3b2a18" strokeWidth="1.5" />
        <g style={{ transform: `rotate(${(ym.month - 1) * 30}deg)`, transformOrigin: '50px 50px', transition: 'transform 400ms' }}><circle cx="50" cy="19" r="3" fill="var(--ochre)" /></g>
      </svg>
      <span style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#231a12', fontWeight: 800, fontSize: size * 0.2, lineHeight: 1 }}>
        <span>{ym.year}</span><span style={{ fontSize: size * 0.17 }}>M{ym.month}</span>
      </span>
    </span>
  )
}

/** Thirty tick marks round a small mirror: lit ones are days left. */
export function DaysDial({ days, size = 46 }: { days: number; size?: number }) {
  return (
    <span style={{ position: 'relative', display: 'inline-block', width: size, height: size }} data-testid="days-dial" aria-label={`${days} days left`}>
      <svg viewBox="0 0 100 100" width={size} height={size}>
        {Array.from({ length: 30 }, (_, i) => {
          const a = (i * 12 - 90) * (Math.PI / 180)
          return <line key={i} x1={50 + 38 * Math.cos(a)} y1={50 + 38 * Math.sin(a)} x2={50 + 48 * Math.cos(a)} y2={50 + 48 * Math.sin(a)} stroke={i < days ? 'var(--ochre)' : '#4a3a2a'} strokeWidth="4" strokeLinecap="round" />
        })}
        <circle cx="50" cy="50" r="31" fill="var(--bronze-face)" stroke="#3b2a18" strokeWidth="1.5" />
        <circle cx="50" cy="50" r="24" fill="none" stroke="#6a5530" strokeWidth="1" />
      </svg>
      <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#231a12', fontWeight: 800, fontSize: size * 0.3 }} data-testid="days-left">{days}</span>
    </span>
  )
}

export function Hud({ s }: { s: WorldState }) {
  const v = world.query.officerView(s, s.player)
  const setPanel = useUi((u) => u.setPanel)
  const open = useUi((u) => u.openOfficer)
  if (!v) return null
  const color = colorOf(s, v.faction)
  const post = v.post === 'wanderer' ? 'Wanderer' : v.post === 'ruler' ? 'Ruler' : v.post === 'prefect' ? `${v.rankName}, prefect` : v.rankName
  return (
    <div className="whud" data-testid="hud">
      <MonthDial ym={s.ym} />
      <DaysDial days={v.days} />
      <button className="wchip" style={{ padding: 0, border: 'none', background: 'none' }} onClick={() => open(s.player)} aria-label="Your officer card" data-testid="open-me"><Portrait name={v.name} portrait={v.portrait} size={44} ring={color ? `var(--f-${color})` : undefined} /></button>
      <div className="info">
        <div className="l1">{v.name} - {post}</div>
        <div className="l2">{color ? <FactionDot color={color} /> : null} {v.factionName ?? 'No house'}{v.cityName ? `, ${v.cityName}` : ''} - {ymText(s.ym)}</div>
      </div>
      <div className="purse" data-testid="purse">{money(v.gold)}<div className="dust" style={{ fontSize: 11, fontWeight: 400 }}>gold</div></div>
      <div className="btns">
        <LacquerButton small onClick={() => setPanel('factions')} testid="open-factions">Houses</LacquerButton>
        <LacquerButton small onClick={() => setPanel('chronicle')} testid="open-chronicle">Chronicle</LacquerButton>
        <LacquerButton small onClick={() => setPanel('menu')} testid="open-menu">Menu</LacquerButton>
      </div>
    </div>
  )
}

