// Pickers and forms for actions that need a target or numbers. Every form builds one WorldAction, asks
// query.can for days/gold/legality and query.chanceOf for the chance, and runs it through the store.
import { useMemo, useState } from 'react'
import type { ArmyUnit, DiploKind, Mission, WorkKind, WorldAction, WorldState } from '../../contracts/world'
import type { TroopType } from '../../contracts/data'
import { world } from '../../world'
import { useGame } from '../store/game'
import { costText, TROOP_TEXT, cap, money } from './format'
import { cityNameOf, factionNameOf, nameOf } from './lookup'
import { LacquerBox, LacquerButton } from './seam'
import { OfficerChip } from './Views'

type Close = () => void
const q = world.query

/** Footer: cost, chance, the engine's reason when it cannot be done, and the button that names the decision. */
function Do({ s, action, label, sub, onDone, danger }: { s: WorldState; action: WorldAction | null; label: string; sub?: string; onDone: Close; danger?: boolean }) {
  const act = useGame((g) => g.act)
  const [err, setErr] = useState<string | null>(null)
  const can = action ? q.can(s, action) : null
  const ch = action ? q.chanceOf(s, action) : null
  const ok = !!action && !!can?.ok
  return (
    <div style={{ marginTop: 10 }}>
      {can && <div className="dust">Costs {costText(can.days, can.gold)}.{ch ? ` Chance ${ch.pct}% that ${ch.what}.` : ''}{ch?.alt ? ` ${ch.alt.pct}% ${ch.alt.what}.` : ''}</div>}
      {can && !can.ok && <div className="err" data-testid="why-not">{can.reason}</div>}
      {err && <div className="err">{err}</div>}
      <LacquerButton primary={!danger} disabled={!ok} available={ok} testid="do-it" onClick={() => {
        if (!action) return
        const r = act(action)
        if (r.ok) onDone()
        else setErr(r.fail.message)
      }}>{label}{sub ? <span className="sub">{sub}</span> : null}</LacquerButton>
    </div>
  )
}

function Select<T extends string>({ label, value, onChange, options, testid }: { label: string; value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; testid?: string }) {
  return (
    <label className="field">{label}
      <select value={value} data-testid={testid} onChange={(e) => onChange(e.target.value as T)}>{options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
    </label>
  )
}

const uniq = <T,>(xs: T[]): T[] => [...new Set(xs)]

// ---------- single officer targets ----------
const OFFICER_VERBS: Record<string, { title: string; verb: (n: string) => string; blurb: string }> = {
  visit: { title: 'Visit an officer', verb: (n) => `Visit ${n}`, blurb: 'A visit builds friendship. Once per pair each month.' },
  challenge: { title: 'Challenge to a duel', verb: (n) => `Challenge ${n} to a duel`, blurb: 'If they accept, you fight a duel. The loser may be hurt.' },
  oath: { title: 'Swear an oath', verb: (n) => `Swear an oath with ${n}`, blurb: 'Sworn siblings fight and trust as one.' },
  marry: { title: 'Propose marriage', verb: (n) => `Propose marriage to ${n}`, blurb: 'A marriage binds two officers for life.' },
  appoint: { title: 'Appoint a prefect', verb: (n) => `Make ${n} prefect of their city`, blurb: 'The prefect governs the city where they stand.' },
}

function OfficerTargets({ s, kind, onClose }: { s: WorldState; kind: string; onClose: Close }) {
  const list = useMemo(() => q.targetsFor(s, kind as WorldAction['kind']), [s, kind])
  const [pick, setPick] = useState<number>(0)
  const a = list[pick] ?? null
  const info = OFFICER_VERBS[kind]!
  const oid = a && 'officer' in a ? a.officer : null
  return (
    <LacquerBox title={info.title} onClose={onClose} testid={`dialog-${kind}`}>
      <div className="dust">{info.blurb}</div>
      <div className="chips" style={{ marginTop: 8 }}>
        {list.map((x, i) => {
          const id = 'officer' in x ? x.officer : ''
          const ch = q.chanceOf(s, x)
          return <OfficerChip key={id + i} s={s} id={id} selected={i === pick} extra={ch ? `${ch.pct}%` : ''} onClick={() => setPick(i)} />
        })}
      </div>
      <Do s={s} action={a} label={oid ? info.verb(nameOf(s, oid)) : 'Choose someone'} onDone={onClose} />
    </LacquerBox>
  )
}

function RecruitDialog({ s, onClose }: { s: WorldState; onClose: Close }) {
  const list = useMemo(() => q.targetsFor(s, 'recruit'), [s])
  const [pick, setPick] = useState(0)
  const [mode, setMode] = useState<'persuade' | 'debate'>('persuade')
  const base = list[pick]
  const a: WorldAction | null = base && base.kind === 'recruit' ? { ...base, mode } : null
  const oid = a && a.kind === 'recruit' ? a.officer : null
  return (
    <LacquerBox title="Recruit a wanderer" onClose={onClose} testid="dialog-recruit">
      <div className="dust">Ask a wanderer to join your house. Persuading is one roll; a debate is played out on the board.</div>
      <div className="chips" style={{ marginTop: 8 }}>{list.map((x, i) => <OfficerChip key={i} s={s} id={x.kind === 'recruit' ? x.officer : ''} selected={i === pick} extra={`${q.chanceOf(s, x)?.pct ?? 0}%`} onClick={() => setPick(i)} />)}</div>
      <div className="tabs" style={{ marginTop: 8 }}>
        <button className={`tab${mode === 'persuade' ? ' on' : ''}`} onClick={() => setMode('persuade')}>Persuade (one roll)</button>
        <button className={`tab${mode === 'debate' ? ' on' : ''}`} onClick={() => setMode('debate')} data-testid="mode-debate">Debate (play it out)</button>
      </div>
      <Do s={s} action={a} label={oid ? `${mode === 'debate' ? 'Debate with' : 'Persuade'} ${nameOf(s, oid)} to join` : 'Choose someone'} onDone={onClose} />
    </LacquerBox>
  )
}

function GiftDialog({ s, onClose }: { s: WorldState; onClose: Close }) {
  const list = useMemo(() => q.targetsFor(s, 'gift').filter((x): x is Extract<WorldAction, { kind: 'gift' }> => x.kind === 'gift'), [s])
  const [pick, setPick] = useState(0)
  const [gold, setGold] = useState<number | null>(null)
  const base = list[pick]
  const a: WorldAction | null = base ? { ...base, gold: gold ?? base.gold } : null
  return (
    <LacquerBox title="Give a gift" onClose={onClose} testid="dialog-gift">
      <div className="dust">Gold given raises the friendship and loyalty of the one who receives it.</div>
      <div className="chips" style={{ marginTop: 8 }}>{list.map((x, i) => <OfficerChip key={i} s={s} id={x.officer} selected={i === pick} extra={x.fromCity ? 'from the city treasury' : ''} onClick={() => { setPick(i); setGold(null) }} />)}</div>
      <label className="field" style={{ marginTop: 8, maxWidth: 220 }}>Gold to give
        <input data-testid="gift-gold" type="number" min={1} step={10} value={gold ?? base?.gold ?? 50} onChange={(e) => setGold(Math.max(1, Math.floor(Number(e.target.value) || 1)))} />
      </label>
      <Do s={s} action={a} label={base ? `Give ${gold ?? base.gold} gold to ${nameOf(s, base.officer)}` : 'Choose someone'} onDone={onClose} />
    </LacquerBox>
  )
}

function FocusDialog({ s, onClose }: { s: WorldState; onClose: Close }) {
  const list = useMemo(() => q.targetsFor(s, 'focus'), [s])
  const [pick, setPick] = useState(0)
  const a = list[pick] ?? null
  const city = a && a.kind === 'focus' ? a.city : null
  const cur = city ? s.cities[city]?.focus : null
  return (
    <LacquerBox title="Set the focus of a city" onClose={onClose} testid="dialog-focus">
      <div className="dust">{city ? `${cityNameOf(city)} now follows a ${cur} focus.` : ''} The focus tilts what the city does with its people each month.</div>
      <div className="tabs" style={{ marginTop: 8 }}>{list.map((x, i) => <button key={i} className={`tab${i === pick ? ' on' : ''}`} onClick={() => setPick(i)}>{x.kind === 'focus' ? cap(x.focus) : ''}</button>)}</div>
      <Do s={s} action={a} label={a && a.kind === 'focus' ? `Set ${cityNameOf(a.city)} to ${a.focus}` : 'Choose a focus'} onDone={onClose} />
    </LacquerBox>
  )
}

function CaptiveDialog({ s, onClose }: { s: WorldState; onClose: Close }) {
  const list = useMemo(() => q.targetsFor(s, 'captive').filter((x): x is Extract<WorldAction, { kind: 'captive' }> => x.kind === 'captive'), [s])
  const ids = uniq(list.map((x) => x.officer))
  const [who, setWho] = useState(ids[0] ?? '')
  const [dec, setDec] = useState<'recruit' | 'release' | 'execute'>('recruit')
  const a: WorldAction | null = who ? { kind: 'captive', officer: who, decision: dec } : null
  const text = { recruit: `Try to win ${nameOf(s, who)} over`, release: `Release ${nameOf(s, who)} unharmed`, execute: `Execute ${nameOf(s, who)}` }[dec]
  return (
    <LacquerBox title="Deal with a captive" onClose={onClose} testid="dialog-captive">
      <div className="chips">{ids.map((id) => <OfficerChip key={id} s={s} id={id} selected={id === who} onClick={() => setWho(id)} />)}</div>
      <div className="tabs" style={{ marginTop: 8 }}>
        {(['recruit', 'release', 'execute'] as const).map((d) => <button key={d} className={`tab${dec === d ? ' on' : ''}`} onClick={() => setDec(d)}>{cap(d)}</button>)}
      </div>
      <Do s={s} action={a} label={text} sub={dec === 'execute' ? 'This cannot be undone' : undefined} danger={dec === 'execute'} onDone={onClose} />
    </LacquerBox>
  )
}

function TransferDialog({ s, onClose }: { s: WorldState; onClose: Close }) {
  const list = useMemo(() => q.targetsFor(s, 'transfer').filter((x): x is Extract<WorldAction, { kind: 'transfer' }> => x.kind === 'transfer'), [s])
  const offs = uniq(list.map((x) => x.officer))
  const [who, setWho] = useState(offs[0] ?? '')
  const cities = uniq(list.filter((x) => x.officer === who).map((x) => x.to))
  const [to, setTo] = useState('')
  const dest = cities.includes(to) ? to : cities[0] ?? ''
  const a: WorldAction | null = who && dest ? { kind: 'transfer', officer: who, to: dest } : null
  return (
    <LacquerBox title="Transfer an officer" onClose={onClose} testid="dialog-transfer">
      <div className="dust">The officer moves at once and has no days left this month.</div>
      <div className="chips" style={{ marginTop: 8 }}>{offs.map((id) => <OfficerChip key={id} s={s} id={id} selected={id === who} onClick={() => setWho(id)} extra={cityNameOf(s.officers[id]?.city)} />)}</div>
      <div style={{ marginTop: 8, maxWidth: 260 }}><Select label="Send them to" value={dest} onChange={setTo} options={cities.map((c) => ({ value: c, label: cityNameOf(c) }))} /></div>
      <Do s={s} action={a} label={who && dest ? `Send ${nameOf(s, who)} to ${cityNameOf(dest)}` : 'Choose'} onDone={onClose} />
    </LacquerBox>
  )
}

function MissionDialog({ s, onClose }: { s: WorldState; onClose: Close }) {
  const list = useMemo(() => q.targetsFor(s, 'mission').filter((x): x is Extract<WorldAction, { kind: 'mission' }> => x.kind === 'mission'), [s])
  const offs = uniq(list.map((x) => x.officer))
  const me = s.officers[s.player]!
  const myCities = Object.values(s.cities).filter((c) => c.faction === me.faction).map((c) => c.id)
  const wanderers = Object.values(s.officers).filter((o) => o.status === 'active' && o.post === 'wanderer' && !o.hidden).map((o) => o.id)
  const others = Object.keys(s.factions).filter((f) => f !== me.faction && s.factions[f]!.alive)
  const [who, setWho] = useState(offs[0] ?? '')
  const [kind, setKind] = useState<Mission['kind']>('develop')
  const [city, setCity] = useState(myCities[0] ?? '')
  const [work, setWork] = useState<WorkKind>('farm')
  const [count, setCount] = useState(2)
  const [target, setTarget] = useState(wanderers[0] ?? '')
  const [scout, setScout] = useState(Object.keys(s.cities)[0] ?? '')
  const [fac, setFac] = useState(others[0] ?? '')
  const [prop, setProp] = useState<DiploKind>('truce')
  const deadline = { ...s.ym }
  const mission: Mission | null = kind === 'develop' ? { kind, city, work, count, done: 0, deadline } : kind === 'recruit' ? (target ? { kind, officer: target, deadline } : null) : kind === 'scout' ? { kind, city: scout, reached: false, deadline } : fac ? { kind, faction: fac, proposal: prop, deadline } : null
  const a: WorldAction | null = who && mission ? { kind: 'mission', officer: who, mission } : null
  return (
    <LacquerBox title="Give a mission" onClose={onClose} testid="dialog-mission">
      <div className="chips">{offs.map((id) => <OfficerChip key={id} s={s} id={id} selected={id === who} onClick={() => setWho(id)} />)}</div>
      <div className="formgrid" style={{ marginTop: 8 }}>
        <Select label="Mission" value={kind} onChange={setKind} options={[{ value: 'develop', label: 'Develop a city' }, { value: 'recruit', label: 'Recruit a wanderer' }, { value: 'scout', label: 'Scout a city' }, { value: 'envoy', label: 'Carry a proposal' }]} />
        {kind === 'develop' && <>
          <Select label="City" value={city} onChange={setCity} options={myCities.map((c) => ({ value: c, label: cityNameOf(c) }))} />
          <Select label="Work" value={work} onChange={setWork} options={(['farm', 'trade', 'walls', 'order', 'train', 'draft'] as WorkKind[]).map((w) => ({ value: w, label: cap(w) }))} />
          <label className="field">Times (1 to 6)<input type="number" min={1} max={6} value={count} onChange={(e) => setCount(Math.min(6, Math.max(1, Math.floor(Number(e.target.value) || 1))))} /></label>
        </>}
        {kind === 'recruit' && <Select label="Wanderer to recruit" value={target} onChange={setTarget} options={wanderers.map((w) => ({ value: w, label: `${nameOf(s, w)} (${cityNameOf(s.officers[w]?.city)})` }))} />}
        {kind === 'scout' && <Select label="City to scout" value={scout} onChange={setScout} options={Object.keys(s.cities).map((c) => ({ value: c, label: cityNameOf(c) }))} />}
        {kind === 'envoy' && <>
          <Select label="House" value={fac} onChange={setFac} options={others.map((f) => ({ value: f, label: factionNameOf(s, f) }))} />
          <Select label="Proposal" value={prop} onChange={setProp} options={[{ value: 'alliance', label: 'Alliance' }, { value: 'truce', label: 'Truce' }, { value: 'surrender', label: 'Surrender' }]} />
        </>}
      </div>
      <Do s={s} action={a} label={who ? `Give ${nameOf(s, who)} this mission` : 'Choose an officer'} onDone={onClose} />
    </LacquerBox>
  )
}

function TransportDialog({ s, onClose }: { s: WorldState; onClose: Close }) {
  const list = useMemo(() => q.targetsFor(s, 'transport').filter((x): x is Extract<WorldAction, { kind: 'transport' }> => x.kind === 'transport'), [s])
  const [pick, setPick] = useState(0)
  const base = list[pick]
  const from = base ? q.cityView(s, base.from) : null
  const [amt, setAmt] = useState<{ gold: number; rice: number; troops: number }>({ gold: base?.gold ?? 0, rice: base?.rice ?? 0, troops: base?.troops ?? 0 })
  const a: WorldAction | null = base ? { kind: 'transport', from: base.from, to: base.to, ...amt } : null
  const num = (k: 'gold' | 'rice' | 'troops', max: number) => (
    <label className="field">{cap(k)} (max {money(max)})
      <input type="number" min={0} max={max} step={k === 'troops' ? 100 : 50} value={amt[k]} onChange={(e) => setAmt({ ...amt, [k]: Math.max(0, Math.floor(Number(e.target.value) || 0)) })} data-testid={`tr-${k}`} />
    </label>
  )
  return (
    <LacquerBox title="Send supplies" onClose={onClose} testid="dialog-transport">
      <div className="dust">Move gold, rice and troops between two of your cities joined by a road.</div>
      <div className="tabs" style={{ marginTop: 8 }}>{list.map((x, i) => <button key={i} className={`tab${i === pick ? ' on' : ''}`} onClick={() => { setPick(i); setAmt({ gold: x.gold, rice: x.rice, troops: x.troops }) }}>{cityNameOf(x.from)} to {cityNameOf(x.to)}</button>)}</div>
      {from && <div className="formgrid" style={{ marginTop: 8 }}>{num('gold', from.gold)}{num('rice', from.rice)}{num('troops', from.troops)}</div>}
      <Do s={s} action={a} label={base ? `Send from ${cityNameOf(base.from)} to ${cityNameOf(base.to)}` : 'Choose a route'} onDone={onClose} />
    </LacquerBox>
  )
}

// ---------- armies ----------
export function ArmyForm({ s, from, to, units, setUnits, lockCommander }: { s: WorldState; from: string; to: string; units: ArmyUnit[]; setUnits: (u: ArmyUnit[]) => void; lockCommander?: string }) {
  const me = s.officers[s.player]
  const cv = q.cityView(s, from)
  const pool = (cv?.officers ?? []).filter((o) => o.faction === me?.faction && s.officers[o.id]?.status === 'active' && !s.officers[o.id]?.hidden)
  const power = q.armyPower(s, { from, units })
  const def = q.defencePower(s, to)
  const total = units.reduce((a, u) => a + u.troops, 0)
  const ratio = def.power > 0 ? power.power / def.power : 0
  const upd = (i: number, patch: Partial<ArmyUnit>): void => setUnits(units.map((u, j) => (j === i ? { ...u, ...patch } : patch.commander ? { ...u, commander: false } : u)))
  const free = pool.filter((o) => !units.some((u) => u.officer === o.id))
  return (
    <div data-testid="army-form">
      <div className="dust">{cityNameOf(from)} has {money(cv?.troops ?? 0)} troops; the army takes {money(total)} and rice for the march. One to five units, one commander.</div>
      {units.map((u, i) => {
        const capv = q.troopCap(s, u.officer)
        return (
          <div key={u.officer} className="army-row" data-unit={u.officer}>
            <select value={u.officer} disabled={lockCommander === u.officer} onChange={(e) => upd(i, { officer: e.target.value })} aria-label="Officer">
              {[u.officer, ...free.map((f) => f.id)].map((id) => <option key={id} value={id}>{nameOf(s, id)}</option>)}
            </select>
            <input type="number" min={1} max={capv} step={100} value={u.troops} onChange={(e) => upd(i, { troops: Math.max(0, Math.floor(Number(e.target.value) || 0)) })} aria-label={`Troops, rank cap ${capv}`} />
            <select value={u.type} onChange={(e) => upd(i, { type: e.target.value as TroopType })} aria-label="Troop type">{(['spear', 'cavalry', 'archer'] as const).map((t) => <option key={t} value={t}>{TROOP_TEXT[t]} ({q.officerView(s, u.officer)?.aptitude[t]})</option>)}</select>
            <span className="row" style={{ gap: 2 }}>
              <input type="radio" name="cmd" checked={u.commander} disabled={!!lockCommander && lockCommander !== u.officer} onChange={() => upd(i, { commander: true })} aria-label="Commander" />
              <button className="lbtn small" disabled={lockCommander === u.officer} onClick={() => setUnits(units.filter((_, j) => j !== i))} aria-label="Remove unit">x</button>
            </span>
            <span className="dust" style={{ gridColumn: '1 / -1', fontSize: 11 }}>{nameOf(s, u.officer)}: rank cap {money(capv)} troops{u.commander ? ', commander' : ''}</span>
          </div>
        )
      })}
      {units.length < 5 && free.length > 0 && (
        <div style={{ marginTop: 6 }}><LacquerButton small onClick={() => setUnits([...units, { officer: free[0]!.id, troops: Math.min(q.troopCap(s, free[0]!.id), 500), type: 'spear', commander: units.length === 0 }])} testid="add-unit">Add a unit</LacquerButton></div>
      )}
      <div className="pow" data-testid="army-power">
        <span>Your army power {money(power.power)}</span>
        <span className="dust">against {cityNameOf(to)} defence {money(def.power)}</span>
        <span className={ratio >= 1.4 ? 'good' : ratio < 1 ? 'bad' : ''}>{ratio.toFixed(2)}x</span>
      </div>
      <div className="dust" style={{ fontSize: 11.5 }}>{power.breakdown}. Defence: {def.breakdown}.</div>
    </div>
  )
}

function WarDialog({ s, onClose }: { s: WorldState; onClose: Close }) {
  const list = useMemo(() => q.targetsFor(s, 'war').filter((x): x is Extract<WorldAction, { kind: 'war' }> => x.kind === 'war'), [s])
  const froms = uniq(list.map((x) => x.from))
  const [from, setFrom] = useState(froms[0] ?? '')
  const tos = uniq(list.filter((x) => x.from === from).map((x) => x.to))
  const [to0, setTo] = useState('')
  const to = tos.includes(to0) ? to0 : tos[0] ?? ''
  const init = list.find((x) => x.from === from && x.to === to)?.units ?? []
  return (
    <LacquerBox title="Send an army" onClose={onClose} wide testid="dialog-war">
      <div className="formgrid">
        <Select label="March from" value={from} onChange={(v) => { setFrom(v); setTo('') }} options={froms.map((c) => ({ value: c, label: cityNameOf(c) }))} testid="war-from" />
        <Select label="March against" value={to} onChange={setTo} options={tos.map((c) => ({ value: c, label: `${cityNameOf(c)} (${factionNameOf(s, s.cities[c]?.faction ?? null)})` }))} testid="war-to" />
      </div>
      <WarBody key={from + to} s={s} from={from} to={to} init={init} onClose={onClose} />
    </LacquerBox>
  )
}

function WarBody({ s, from, to, init, onClose }: { s: WorldState; from: string; to: string; init: ArmyUnit[]; onClose: Close }) {
  const [units, setUnits] = useState<ArmyUnit[]>(init)
  const a: WorldAction | null = from && to ? { kind: 'war', from, to, units } : null
  return (
    <>
      <div className="sec">The army</div>
      <ArmyForm s={s} from={from} to={to} units={units} setUnits={setUnits} />
      <Do s={s} action={a} label={`March on ${cityNameOf(to)}`} sub="The army takes the field at month end" onDone={onClose} />
    </>
  )
}

/** The army a proposer would lead: the engine's suggestion with the player as sole commander. */
export function proposerArmy(s: WorldState, from: string, to: string): ArmyUnit[] {
  const me = s.player
  const sug = q.suggestArmy(s, from, to).map((u) => ({ ...u, commander: u.officer === me }))
  if (sug.some((u) => u.officer === me)) return sug
  const best = (['spear', 'cavalry', 'archer'] as const).reduce((b, t) => ((q.officerView(s, me)?.aptitude[t] ?? 'C') < (q.officerView(s, me)?.aptitude[b] ?? 'C') ? t : b), 'spear' as TroopType)
  const mine: ArmyUnit = { officer: me, troops: Math.min(q.troopCap(s, me), 800), type: best, commander: true }
  return [mine, ...sug.slice(0, 4)].map((u, i) => ({ ...u, commander: i === 0 }))
}

function ProposeDialog({ s, onClose }: { s: WorldState; onClose: Close }) {
  const list = useMemo(() => q.targetsFor(s, 'propose').filter((x): x is Extract<WorldAction, { kind: 'propose' }> => x.kind === 'propose'), [s])
  const kinds = uniq(list.map((x) => x.proposal))
  const [kind, setKind] = useState<'war' | 'alliance' | 'truce' | 'prefect'>(kinds[0] ?? 'war')
  const mine = list.filter((x) => x.proposal === kind)
  const [pick, setPick] = useState(0)
  const base = mine[pick] ?? mine[0]
  const me = s.officers[s.player]
  return (
    <LacquerBox title="Propose to the ruler" onClose={onClose} wide testid="dialog-propose">
      <div className="dust">You may propose once a month. The ruler decides, and approves with the chance shown.</div>
      <div className="tabs" style={{ marginTop: 8 }}>{kinds.map((k) => <button key={k} className={`tab${kind === k ? ' on' : ''}`} onClick={() => { setKind(k); setPick(0) }}>{{ war: 'A war, led by you', alliance: 'An alliance', truce: 'A truce', prefect: 'To be made prefect' }[k]}</button>)}</div>
      {kind === 'war' && base && me?.city && (
        <>
          <div className="tabs" style={{ marginTop: 8 }}>{mine.map((x, i) => <button key={i} className={`tab${i === pick ? ' on' : ''}`} onClick={() => setPick(i)}>{cityNameOf(x.to)}</button>)}</div>
          <ProposeWar key={base.to} s={s} from={me.city} to={base.to!} onClose={onClose} />
        </>
      )}
      {(kind === 'alliance' || kind === 'truce') && (
        <>
          <div className="tabs" style={{ marginTop: 8 }}>{mine.map((x, i) => <button key={i} className={`tab${i === pick ? ' on' : ''}`} onClick={() => setPick(i)}>{factionNameOf(s, x.faction ?? null)}</button>)}</div>
          <Do s={s} action={base ?? null} label={base ? `Propose a ${kind} with ${factionNameOf(s, base.faction ?? null)}` : 'Choose a house'} sub="You carry it as envoy if the ruler agrees" onDone={onClose} />
        </>
      )}
      {kind === 'prefect' && <Do s={s} action={base ?? null} label={`Ask to be made prefect of ${cityNameOf(me?.city)}`} onDone={onClose} />}
    </LacquerBox>
  )
}

function ProposeWar({ s, from, to, onClose }: { s: WorldState; from: string; to: string; onClose: Close }) {
  const me = s.player
  const [units, setUnits] = useState<ArmyUnit[]>(() => proposerArmy(s, from, to))
  const a: WorldAction = { kind: 'propose', proposal: 'war', to, units }
  return (
    <>
      <div className="sec">The army you would lead</div>
      <ArmyForm s={s} from={from} to={to} units={units} setUnits={setUnits} lockCommander={me} />
      <Do s={s} action={a} label={`Propose war on ${cityNameOf(to)}`} sub="You command the army if the ruler approves" onDone={onClose} />
    </>
  )
}

function DiplomacyDialog({ s, onClose }: { s: WorldState; onClose: Close }) {
  const list = useMemo(() => q.targetsFor(s, 'diplomacy').filter((x): x is Extract<WorldAction, { kind: 'diplomacy' }> => x.kind === 'diplomacy'), [s])
  const facs = uniq(list.map((x) => x.faction))
  const [fac, setFac] = useState(facs[0] ?? '')
  const props = list.filter((x) => x.faction === fac).map((x) => x.proposal)
  const [prop, setProp] = useState<DiploKind>('truce')
  const p = props.includes(prop) ? prop : props[0] ?? 'truce'
  const [mode, setMode] = useState<'roll' | 'debate'>('roll')
  const me = s.officers[s.player]!
  const team = me.faction ? q.factionView(s, me.faction)?.officers ?? [] : []
  const [envoy, setEnvoy] = useState(s.player)
  const env = mode === 'debate' ? s.player : envoy
  const a: WorldAction | null = fac ? { kind: 'diplomacy', envoy: env, faction: fac, proposal: p, mode } : null
  return (
    <LacquerBox title="Send an envoy" onClose={onClose} testid="dialog-diplomacy">
      <div className="formgrid">
        <Select label="To the house of" value={fac} onChange={setFac} options={facs.map((f) => ({ value: f, label: factionNameOf(s, f) }))} testid="dip-faction" />
        <Select label="Proposal" value={p} onChange={setProp} options={props.map((x) => ({ value: x, label: cap(x) }))} testid="dip-proposal" />
        <Select label="Envoy" value={env} onChange={setEnvoy} options={team.filter((id) => s.officers[id]?.status === 'active').map((id) => ({ value: id, label: nameOf(s, id) }))} />
      </div>
      <div className="tabs" style={{ marginTop: 8 }}>
        <button className={`tab${mode === 'roll' ? ' on' : ''}`} onClick={() => setMode('roll')}>Leave it to the envoy (one roll)</button>
        <button className={`tab${mode === 'debate' ? ' on' : ''}`} onClick={() => setMode('debate')}>Argue it yourself (debate)</button>
      </div>
      <Do s={s} action={a} label={fac ? `Propose a ${p} to ${factionNameOf(s, fac)}` : 'Choose a house'} onDone={onClose} />
    </LacquerBox>
  )
}

function ConfirmDialog({ s, kind, onClose }: { s: WorldState; kind: 'resign' | 'endMonth'; onClose: Close }) {
  const act = useGame((g) => g.act)
  const days = s.officers[s.player]?.days ?? 0
  const [err, setErr] = useState<string | null>(null)
  if (kind === 'resign') {
    return (
      <LacquerBox title="Resign your post?" onClose={onClose} testid="dialog-resign">
        <p>You will leave your house and become a wanderer. Your city and post are no longer yours.</p>
        <Do s={s} action={{ kind: 'resign' }} label="Resign and become a wanderer" danger onDone={onClose} />
      </LacquerBox>
    )
  }
  return (
    <LacquerBox title="End the month?" onClose={onClose} testid="dialog-endmonth">
      <p>You still have {days} {days === 1 ? 'day' : 'days'} left this month. Unspent days are lost when the month ends, and every other officer then takes their turn.</p>
      {err && <div className="err">{err}</div>}
      <LacquerButton primary testid="confirm-endmonth" onClick={() => { const r = act({ kind: 'endMonth' }); if (r.ok) onClose(); else setErr(r.fail.message) }}>End the month<span className="sub">Lose {days} unspent days and let the world move</span></LacquerButton>
    </LacquerBox>
  )
}

export const DIALOG_KINDS = new Set(['visit', 'challenge', 'oath', 'marry', 'appoint', 'recruit', 'gift', 'focus', 'captive', 'transfer', 'mission', 'transport', 'war', 'propose', 'diplomacy', 'resign', 'endMonth'])

export function ActionDialog({ s, kind, onClose }: { s: WorldState; kind: string; onClose: Close }) {
  switch (kind) {
    case 'visit': case 'challenge': case 'oath': case 'marry': case 'appoint': return <OfficerTargets s={s} kind={kind} onClose={onClose} />
    case 'recruit': return <RecruitDialog s={s} onClose={onClose} />
    case 'gift': return <GiftDialog s={s} onClose={onClose} />
    case 'focus': return <FocusDialog s={s} onClose={onClose} />
    case 'captive': return <CaptiveDialog s={s} onClose={onClose} />
    case 'transfer': return <TransferDialog s={s} onClose={onClose} />
    case 'mission': return <MissionDialog s={s} onClose={onClose} />
    case 'transport': return <TransportDialog s={s} onClose={onClose} />
    case 'war': return <WarDialog s={s} onClose={onClose} />
    case 'propose': return <ProposeDialog s={s} onClose={onClose} />
    case 'diplomacy': return <DiplomacyDialog s={s} onClose={onClose} />
    case 'resign': case 'endMonth': return <ConfirmDialog s={s} kind={kind} onClose={onClose} />
    default: return null
  }
}

