// Officer chip, officer card, city box, faction list and chronicle.
import { useState } from 'react'
import type { WorldState } from '../../contracts/world'
import { world } from '../../world'
import { LOG_KINDS } from '../../world'
import { useGame } from '../store/game'
import { useUi } from '../store/ui'
import { ymText } from '../save/save'
import { costText, money, TEMPERAMENT_TEXT, TROOP_TEXT } from './format'
import { iconFor } from './logicons'
import { colorOf, cityNameOf, nameOf, portraitOf } from './lookup'
import { CloudBand, LacquerBox, LacquerButton, Portrait, StatDial } from './seam'
import { FactionDot, Icon, statLabel } from './ui'
import type { StatKey } from '../../contracts/data'

const STATS: StatKey[] = ['war', 'ldr', 'int', 'pol', 'cha']

export function OfficerChip({ s, id, extra, selected, target, onClick }: { s: WorldState; id: string; extra?: string; selected?: boolean; target?: boolean; onClick?: () => void }) {
  const open = useUi((u) => u.openOfficer)
  const o = s.officers[id]
  return (
    <button className={`wchip${selected ? ' sel' : ''}${target ? ' target' : ''}`} onClick={onClick ?? (() => open(id))} data-officer={id}>
      <Portrait name={nameOf(s, id)} portrait={portraitOf(s, id)} size={30} ring={o?.faction ? `var(--f-${colorOf(s, o.faction)})` : undefined} />
      <span>{nameOf(s, id)}{extra ? <span className="sm"> {extra}</span> : null}</span>
    </button>
  )
}

export function LogRow({ s, e }: { s: WorldState; e: WorldState['log'][number] }) {
  void s
  return (
    <div className="logrow" data-kind={e.kind}>
      <span className="ic"><Icon name={iconFor(e.kind)} /></span>
      <span className="grow">{e.text}</span>
      <span className="when">{ymText(e.ym)}</span>
    </div>
  )
}

export function OfficerCard({ s, id, onClose }: { s: WorldState; id: string; onClose: () => void }) {
  const v = world.query.officerView(s, id)
  const open = useUi((u) => u.openOfficer)
  if (!v) return null
  const color = colorOf(s, v.faction)
  return (
    <LacquerBox title={v.name} onClose={onClose} testid="officer-card">
      <div className="row" style={{ alignItems: 'flex-start', gap: 14 }}>
        <Portrait name={v.name} portrait={v.portrait} size={92} ring={color ? `var(--f-${color})` : undefined} />
        <div className="grow" style={{ minWidth: 180 }}>
          {v.courtesy && <div className="dust">Courtesy name {v.courtesy}</div>}
          <div><b>{v.post === 'ruler' ? 'Ruler' : v.post === 'wanderer' ? 'Wanderer' : v.post === 'prefect' ? 'Prefect' : 'Officer'}</b>, {v.rankName}{v.isPlayer ? ' (you)' : ''}</div>
          <div>{color ? <FactionDot color={color} /> : null} {v.factionName ?? 'No house'}{v.cityName ? `, at ${v.cityName}` : ''}</div>
          <div className="dust">{v.sex === 'f' ? 'Woman' : 'Man'}, born {v.born} (age {v.age}) - {v.status === 'army' ? 'marching with an army' : v.status === 'captive' ? 'a captive' : v.status}</div>
          <div className="dust">{TEMPERAMENT_TEXT[v.temperament]} temperament</div>
        </div>
      </div>
      <div className="sec">Abilities</div>
      <div className="dials">{STATS.map((k) => <StatDial key={k} label={statLabel(k)} value={v.stats[k]} />)}</div>
      <div className="sec">Troops</div>
      <div className="row">
        {(['spear', 'cavalry', 'archer'] as const).map((t) => <span key={t} className="wchip" style={{ padding: '3px 10px' }}>{TROOP_TEXT[t]} <b className="ochre">{v.aptitude[t]}</b></span>)}
        <span className="dust">Leads up to {money(v.troopCap)} troops</span>
      </div>
      <div className="sec">Standing</div>
      <div className="kv">
        <div><span>Rank</span><span>{v.rankName}</span></div>
        <div><span>Merit</span><span>{money(v.merit)}{v.nextRankMerit !== null ? ` / ${money(v.nextRankMerit)}` : ''}</span></div>
        <div><span>Loyalty</span><span>{v.loyalty === null ? 'none' : v.loyalty}</span></div>
        <div><span>Salary</span><span>{v.salary} gold</span></div>
        <div><span>Purse</span><span>{money(v.gold)} gold</span></div>
        <div><span>Health</span><span>{v.health}</span></div>
        <div><span>Days left</span><span>{v.days}</span></div>
      </div>
      {v.missionText && (<><div className="sec">Mission</div><div>{v.missionText}</div></>)}
      {(v.spouse || v.oathGroup.length > 0) && (
        <>
          <div className="sec">Bonds</div>
          {v.spouse && <div>Spouse: <OfficerChip s={s} id={v.spouse} /></div>}
          {v.oathGroup.length > 0 && <div className="chips" style={{ marginTop: 4 }}>Oath siblings: {v.oathGroup.map((o) => <OfficerChip key={o} s={s} id={o} />)}</div>}
        </>
      )}
      <div className="sec">Ties</div>
      {v.ties.length === 0 && <div className="dust">No ties of note.</div>}
      {v.ties.map((t) => (
        <div key={t.other + t.kind} className="row" style={{ padding: '2px 0' }}>
          <button className="lbtn small" style={{ textTransform: 'none', letterSpacing: 0 }} onClick={() => open(t.other)}>{t.name}</button>
          <span className="dust grow">{t.note} ({t.kind})</span>
          <b className="ochre num">{t.value}</b>
        </div>
      ))}
      {v.items.length > 0 && (<><div className="sec">Items</div><div>{v.items.join(', ')}</div></>)}
    </LacquerBox>
  )
}

export function CityBox({ s, id, onClose }: { s: WorldState; id: string; onClose: () => void }) {
  const v = world.query.cityView(s, id)
  const act = useGame((g) => g.act)
  const open = useUi((u) => u.openOfficer)
  if (!v) return null
  const color = colorOf(s, v.faction)
  const travel = world.query.actionsHere(s).find((a) => a.kind === 'travel' && a.action.kind === 'travel' && a.action.to === id)
  const here = s.officers[s.player]?.city === id
  const bar = (n: number, max: number) => `${n} / ${max}`
  return (
    <div className="sheet city" data-testid="city-box">
      <div style={{ height: 14, color: 'var(--vermilion)' }}><CloudBand /></div>
      <div className="inner">
        <div className="head row" style={{ marginBottom: 6 }}>
          <h2 style={{ fontSize: 15, color: 'var(--ochre)', flex: 1 }}>{v.name}</h2>
          <button className="x lbox-x" onClick={onClose} aria-label="Close city box" style={{ border: '1px solid var(--vermilion)', background: 'var(--lacquer)', width: 32, height: 32, borderRadius: '50%' }}>×</button>
        </div>
        <div>{color ? <FactionDot color={color} /> : null} {v.factionName ? `${v.factionName}` : 'Vacant - no house holds it'} <span className="dust">- {v.province} province</span></div>
        {v.prefectName && <div className="dust">Prefect: {v.prefectName}</div>}
        {!here && travel && (
          <div style={{ margin: '8px 0' }}>
            <LacquerButton available={travel.available} disabled={!travel.available} primary onClick={() => { act(travel.action); onClose() }} testid="city-travel">
              Travel to {v.name}<span className="sub">{costText(travel.days, travel.gold)}</span>
            </LacquerButton>
          </div>
        )}
        {!here && travel && !travel.available && travel.reason && <div className="err">{travel.reason}</div>}
        <div className="sec">Numbers</div>
        <div className="kv">
          <div><span>Population</span><span>{money(v.population)}</span></div>
          <div><span>Farms</span><span>{bar(v.farm, v.farmMax)}</span></div>
          <div><span>Trade</span><span>{bar(v.trade, v.tradeMax)}</span></div>
          <div><span>Walls</span><span>{bar(v.walls, v.wallsMax)}</span></div>
          <div><span>Order</span><span>{v.order}</span></div>
          <div><span>Troops</span><span>{money(v.troops)}</span></div>
          <div><span>Training</span><span>{v.training}</span></div>
          <div><span>Gold</span><span>{money(v.gold)}</span></div>
          <div><span>Rice</span><span>{money(v.rice)}</span></div>
          <div><span>Focus</span><span>{v.focus}</span></div>
          <div><span>Income next month</span><span>+{money(v.incomeGold)} gold</span></div>
          <div><span>Next harvest</span><span>+{money(v.harvestRice)} rice</span></div>
          <div><span>Rice upkeep</span><span>-{money(v.upkeepRice)} / month</span></div>
          <div><span>Defence power</span><span>{money(v.defencePower)}</span></div>
        </div>
        <div className="sec">Officers here ({v.officers.length})</div>
        <div className="chips">{v.officers.map((o) => <OfficerChip key={o.id} s={s} id={o.id} extra={o.post === 'wanderer' ? 'wanderer' : o.post === 'ruler' ? 'ruler' : o.post === 'prefect' ? 'prefect' : ''} />)}</div>
        {v.captives.length > 0 && (<><div className="sec">Captives</div><div className="chips">{v.captives.map((o) => <OfficerChip key={o.id} s={s} id={o.id} onClick={() => open(o.id)} />)}</div></>)}
        <div className="sec">Roads</div>
        <div className="dust">{v.neighbors.map((n) => `${n.name} ${n.days}d`).join(', ')}</div>
      </div>
    </div>
  )
}

export function FactionsPanel({ s, onClose }: { s: WorldState; onClose: () => void }) {
  const me = s.officers[s.player]?.faction ?? null
  const [pick, setPick] = useState<string | null>(me)
  const ids = Object.keys(s.factions).filter((f) => s.factions[f]!.alive)
  const views = ids.map((f) => world.query.factionView(s, f)!).filter(Boolean).sort((a, b) => b.cities.length - a.cities.length || b.totalTroops - a.totalTroops)
  const sel = pick ? world.query.factionView(s, pick) : null
  const open = useUi((u) => u.openOfficer)
  const setCity = useUi((u) => u.setCity)
  return (
    <LacquerBox title="Houses of the realm" onClose={onClose} wide testid="factions-panel">
      <div className="scroll" style={{ maxHeight: '38dvh' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead><tr className="dust" style={{ textAlign: 'left' }}><th>House</th><th>Ruler</th><th>Cities</th><th>Troops</th><th>To you</th></tr></thead>
          <tbody>
            {views.map((f) => {
              const rel = me && f.id !== me ? world.query.factionView(s, me)?.relations.find((r) => r.faction === f.id) : null
              return (
                <tr key={f.id} onClick={() => setPick(f.id)} style={{ cursor: 'pointer', background: pick === f.id ? 'rgba(0,0,0,.3)' : undefined }} data-faction-row={f.id}>
                  <td><FactionDot color={f.color} /> {f.name}{f.id === me ? ' (yours)' : ''}</td>
                  <td>{f.rulerName}</td><td className="num">{f.cities.length}</td><td className="num">{money(f.totalTroops)}</td>
                  <td>{f.id === me ? '-' : rel ? `${rel.value}${rel.pact ? ` (${rel.pact})` : ''}` : ''}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {sel && (
        <>
          <div className="sec">{sel.name}</div>
          <div className="kv">
            <div><span>Ruler</span><span><button className="lbtn small" style={{ textTransform: 'none' }} onClick={() => open(sel.ruler)}>{sel.rulerName}</button></span></div>
            <div><span>Capital</span><span>{cityNameOf(sel.capital)}</span></div>
            <div><span>Officers</span><span>{sel.officers.length}</span></div>
            <div><span>Gold</span><span>{money(sel.totalGold)}</span></div>
            <div><span>Rice</span><span>{money(sel.totalRice)}</span></div>
          </div>
          <div className="sec">Cities</div>
          <div className="chips">{sel.cities.map((c) => <button key={c} className="wchip" style={{ padding: '3px 10px' }} onClick={() => { setCity(c); onClose() }}>{cityNameOf(c)}</button>)}</div>
          <div className="sec">Relations and pacts</div>
          <div className="dust">{sel.relations.filter((r) => r.pact || Math.abs(r.value) >= 20).map((r) => `${r.name}: ${r.value}${r.pact ? ` (${r.pact}${r.until ? ` until ${ymText(r.until)}` : ''})` : ''}`).join('; ') || 'No pacts, no strong feelings.'}</div>
        </>
      )}
    </LacquerBox>
  )
}

export function ChroniclePanel({ s, onClose }: { s: WorldState; onClose: () => void }) {
  const [mine, setMine] = useState(false)
  const rows = s.log.filter((e) => !mine || e.officers.includes(s.player)).slice(-300).reverse()
  return (
    <LacquerBox title="Chronicle" onClose={onClose} wide testid="chronicle-panel">
      <div className="tabs" style={{ marginBottom: 8 }}>
        <button className={`tab${!mine ? ' on' : ''}`} onClick={() => setMine(false)}>Everything</button>
        <button className={`tab${mine ? ' on' : ''}`} onClick={() => setMine(true)} data-testid="chronicle-mine">My officer</button>
        <span className="dust" style={{ alignSelf: 'center' }}>{rows.length} of {s.log.length} entries</span>
      </div>
      {rows.length === 0 && <div className="dust">Nothing recorded yet.</div>}
      {rows.map((e, i) => <LogRow key={i} s={s} e={e} />)}
      <details style={{ marginTop: 10 }}><summary className="dust">Key to the marks</summary>
        <div className="row" style={{ marginTop: 6 }}>{LOG_KINDS.map((k) => <span key={k.kind} className="wchip" style={{ padding: '2px 8px' }}><Icon name={iconFor(k.kind)} size={13} /> {k.kind}</span>)}</div>
      </details>
    </LacquerBox>
  )
}

