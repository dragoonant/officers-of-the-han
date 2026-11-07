// Scenario 190 -> pick an officer (W-NEW-1) or create one. Options and a visible, editable seed.
import { useMemo, useState } from 'react'
import type { CreatedOfficer, NewGameOptions } from '../../contracts/world'
import type { Stats, Temperament, TroopType, StatKey } from '../../contracts/data'
import { GAME_DATA } from '../../data'
import { world } from '../../world'
import { useGame } from '../store/game'
import { TEMPERAMENT_TEXT, TROOP_TEXT, money } from './format'
import { cityNameOf, colorOf, factionNameOf, nameOf, portraitOf } from './lookup'
import { LacquerButton, Portrait, StatDial } from './seam'
import { statLabel } from './ui'
import { usePortraitManifest } from '../ui/usePortraitManifest'

const SCEN = GAME_DATA.scenarios[0]!
const POOL = 320
const STAT_KEYS: StatKey[] = ['war', 'ldr', 'int', 'pol', 'cha']
const TEMPERAMENTS: Temperament[] = ['righteous', 'ambitious', 'cautious', 'reckless', 'steady']

/** The pool rule of W-NEW-1, mirrored for the form; the engine is the judge (newGame throws on a bad one). */
export function createdProblem(c: Pick<CreatedOfficer, 'name' | 'born' | 'stats'>): string | null {
  const name = c.name.trim()
  if (name.length < 1 || name.length > 24) return 'Give the officer a name of 1 to 24 characters.'
  if (!Number.isInteger(c.born) || c.born < 150 || c.born > 174) return 'Birth year must be 150 to 174.'
  let sum = 0
  for (const k of STAT_KEYS) {
    const v = c.stats[k]
    if (!Number.isInteger(v) || v < 20 || v > 95) return `${statLabel(k)} must be 20 to 95.`
    sum += v
  }
  if (sum > POOL) return `The five stats total ${sum}; the pool is ${POOL}.`
  return null
}

export function NewGame() {
  const goTitle = useGame((g) => g.goTitle)
  const startNew = useGame((g) => g.startNew)
  const [mode, setMode] = useState<'pick' | 'create'>('pick')
  const [seed, setSeed] = useState<number>(() => Date.now() % 1_000_000_000) // client only: the engine never reads a clock
  const [lifespans, setLifespans] = useState(true)
  const [events, setEvents] = useState(true)
  const options = { lifespans, events }

  return (
    <div className="newgame" data-testid="newgame">
      <div className="top">
        <LacquerButton small onClick={goTitle} testid="back-title">Back</LacquerButton>
        <h2>{SCEN.name} - January {SCEN.year}</h2>
        <div className="tabs">
          <button className={`tab${mode === 'pick' ? ' on' : ''}`} onClick={() => setMode('pick')} data-testid="tab-pick">Pick an officer</button>
          <button className={`tab${mode === 'create' ? ' on' : ''}`} onClick={() => setMode('create')} data-testid="tab-create">Create an officer</button>
        </div>
      </div>
      <div className="dust" style={{ fontSize: 12 }}>{SCEN.blurb}</div>
      <div className="row">
        <label className="field">Seed (the same seed and choices replay the same world)
          <input data-testid="seed" type="number" min={0} step={1} value={seed} onChange={(e) => setSeed(Math.max(0, Math.floor(Number(e.target.value) || 0)))} />
        </label>
        <label className="row"><input type="checkbox" checked={lifespans} onChange={(e) => setLifespans(e.target.checked)} data-testid="opt-lifespans" /> Lifespans (officers age and die)</label>
        <label className="row"><input type="checkbox" checked={events} onChange={(e) => setEvents(e.target.checked)} data-testid="opt-events" /> Historical events</label>
      </div>
      {mode === 'pick' ? <Picker seed={seed} options={options} start={(o) => startNew(o)} /> : <Creator seed={seed} options={options} start={(o) => startNew(o)} />}
    </div>
  )
}

interface PartProps { seed: number; options: { lifespans: boolean; events: boolean }; start: (o: NewGameOptions) => void }

function Picker({ seed, options, start }: PartProps) {
  const base = useMemo(() => world.newGame({ scenario: SCEN.id, seed: 1, officer: 'liu-bei' }), [])
  const [faction, setFaction] = useState<string>('all')
  const [q, setQ] = useState('')
  const [sel, setSel] = useState<string>('liu-bei')
  const ids = useMemo(() => {
    const out = Object.values(base.officers).filter((o) => (o.status === 'active' || o.status === 'army') && !o.hidden).map((o) => o.id)
    return out.sort((a, b) => nameOf(base, a).localeCompare(nameOf(base, b)))
  }, [base])
  const factions = useMemo(() => {
    const present = new Set(ids.map((i) => base.officers[i]!.faction).filter((f): f is string => !!f))
    return [...present].sort((a, b) => base.factions[a]!.name.localeCompare(base.factions[b]!.name))
  }, [ids, base])
  const shown = ids.filter((id) => {
    const o = base.officers[id]!
    if (faction === 'wanderers' ? o.faction !== null : faction !== 'all' && o.faction !== faction) return false
    return !q.trim() || nameOf(base, id).toLowerCase().includes(q.trim().toLowerCase())
  })
  const preview = useMemo(() => world.newGame({ scenario: SCEN.id, seed, officer: sel, options }), [sel, seed, options.lifespans, options.events]) // eslint-disable-line react-hooks/exhaustive-deps
  const v = world.query.officerView(preview, sel)
  return (
    <div className="picker">
      <div style={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0 }}>
        <div className="row" style={{ marginBottom: 6 }}>
          <label className="field" style={{ flex: '1 1 140px' }}>House
            <select data-testid="filter-faction" value={faction} onChange={(e) => setFaction(e.target.value)}>
              <option value="all">All officers</option>
              <option value="wanderers">Wanderers</option>
              {factions.map((f) => <option key={f} value={f}>{base.factions[f]!.name}</option>)}
            </select>
          </label>
          <label className="field" style={{ flex: '1 1 140px' }}>Search by name
            <input data-testid="search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name" />
          </label>
          <span className="dust">{shown.length} officers</span>
        </div>
        <div className="grid" data-testid="officer-grid">
          {shown.map((id) => {
            const o = base.officers[id]!
            return (
              <button key={id} className={`pick${sel === id ? ' sel' : ''}`} onClick={() => setSel(id)} data-pick={id}>
                <Portrait id={id} name={nameOf(base, id)} portrait={portraitOf(base, id)} size={60} ring={o.faction ? `var(--f-${colorOf(base, o.faction)})` : undefined} />
                <span className="nm">{nameOf(base, id)}</span>
              </button>
            )
          })}
        </div>
      </div>
      <div className="side" data-testid="pick-card">
        {v && (
          <>
            <div className="row" style={{ alignItems: 'flex-start' }}>
              <Portrait id={v.id} name={v.name} portrait={v.portrait} size={72} ring={v.faction ? `var(--f-${colorOf(preview, v.faction)})` : undefined} />
              <div>
                <h3 style={{ fontSize: 14, color: 'var(--ochre)' }}>{v.name}</h3>
                <div>{v.post === 'wanderer' ? 'Wanderer' : v.post === 'ruler' ? 'Ruler' : v.post === 'prefect' ? 'Prefect' : 'Officer'}, {v.rankName}</div>
                <div className="dust">{factionNameOf(preview, v.faction)} - {v.cityName}</div>
              </div>
            </div>
            <div className="dials" style={{ margin: '10px 0' }}>{STAT_KEYS.map((k) => <StatDial key={k} label={statLabel(k)} value={v.stats[k]} size={40} />)}</div>
            <div className="kv">
              <div><span>Age</span><span>{v.age}</span></div>
              <div><span>Temperament</span><span>{TEMPERAMENT_TEXT[v.temperament]}</span></div>
              <div><span>Merit</span><span>{money(v.merit)}</span></div>
              <div><span>Gold</span><span>{money(v.gold)}</span></div>
              <div><span>Loyalty</span><span>{v.loyalty ?? 'none'}</span></div>
              <div><span>Troops A/B/C</span><span>{(['spear', 'cavalry', 'archer'] as const).map((t) => `${TROOP_TEXT[t]![0]}${v.aptitude[t]}`).join(' ')}</span></div>
            </div>
            {v.status === 'army' && <div className="dust" style={{ marginTop: 6 }}>Starts marching with an army.</div>}
            <div style={{ marginTop: 10 }}>
              <LacquerButton primary big testid="start-game" onClick={() => start({ scenario: SCEN.id, seed, officer: sel, options })}>
                Play as {v.name}<span className="sub">Starts January {SCEN.year} in {v.cityName}</span>
              </LacquerButton>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function Creator({ seed, options, start }: PartProps) {
  const initial = useMemo(() => world.newGame({ scenario: SCEN.id, seed: 1, officer: 'liu-bei' }), [])
  const [name, setName] = useState('')
  const [sex, setSex] = useState<'m' | 'f'>('m')
  const [born, setBorn] = useState(165)
  const [stats, setStats] = useState<Stats>({ war: 64, ldr: 64, int: 64, pol: 64, cha: 64 })
  const [temperament, setTemperament] = useState<Temperament>('steady')
  const [bestType, setBestType] = useState<TroopType>('spear')
  const [portrait, setPortrait] = useState<string | undefined>(undefined)
  // generated faces (face-01 ...) come first once their manifest lists them; the older generic portraits follow
  const faces = [...usePortraitManifest().ids].filter((k) => /^face-\d+$/.test(k)).sort()
  const [city, setCity] = useState('luoyang')
  const total = STAT_KEYS.reduce((a, k) => a + stats[k], 0)
  const left = POOL - total
  const created: CreatedOfficer = { name: name.trim(), sex, born, stats, temperament, bestType, city, ...(portrait ? { portrait } : {}) }
  const problem = createdProblem(created)
  const setStat = (k: StatKey, raw: number): void => {
    const others = total - stats[k]
    const v = Math.max(20, Math.min(95, POOL - others, Math.round(raw || 20)))
    setStats({ ...stats, [k]: v })
  }
  return (
    <div className="scroll" style={{ flex: 1 }} data-testid="creator">
      <div className="formgrid">
        <label className="field">Name<input data-testid="c-name" maxLength={24} value={name} onChange={(e) => setName(e.target.value)} placeholder="Name (1 to 24 characters)" /></label>
        <label className="field">Sex<select data-testid="c-sex" value={sex} onChange={(e) => setSex(e.target.value as 'm' | 'f')}><option value="m">Man</option><option value="f">Woman</option></select></label>
        <label className="field">Birth year (150 to 174)<input data-testid="c-born" type="number" min={150} max={174} value={born} onChange={(e) => setBorn(Math.floor(Number(e.target.value) || 0))} /></label>
        <label className="field">Temperament<select data-testid="c-temper" value={temperament} onChange={(e) => setTemperament(e.target.value as Temperament)}>{TEMPERAMENTS.map((t) => <option key={t} value={t}>{TEMPERAMENT_TEXT[t]}</option>)}</select></label>
        <label className="field">Best troop type (aptitude A, the others B)<select data-testid="c-type" value={bestType} onChange={(e) => setBestType(e.target.value as TroopType)}>{(['spear', 'cavalry', 'archer'] as const).map((t) => <option key={t} value={t}>{TROOP_TEXT[t]}</option>)}</select></label>
        <label className="field">Start city (you start as a wanderer there)<select data-testid="c-city" value={city} onChange={(e) => setCity(e.target.value)}>{GAME_DATA.cities.map((c) => <option key={c.id} value={c.id}>{c.name} ({initial.cities[c.id]?.faction ? factionNameOf(initial, initial.cities[c.id]!.faction) : 'vacant'})</option>)}</select></label>
      </div>
      <div className="sec">Abilities: {left} of {POOL} points left (each 20 to 95)</div>
      <div className="formgrid">
        {STAT_KEYS.map((k) => (
          <label key={k} className="field">{statLabel(k)} <b className="ochre">{stats[k]}</b>
            <input type="range" min={20} max={95} value={stats[k]} onChange={(e) => setStat(k, Number(e.target.value))} data-testid={`c-${k}`} />
          </label>
        ))}
      </div>
      <div className="sec">Portrait</div>
      <div className="portraits" style={{ maxHeight: 150, overflow: 'auto' }}>
        <button className={`pick${!portrait ? ' sel' : ''}`} onClick={() => setPortrait(undefined)}><Portrait name={name || '?'} size={48} /><span className="nm">Medallion</span></button>
        {[...faces, ...GAME_DATA.genericPortraits].map((p) => (
          <button key={p} className={`pick${portrait === p ? ' sel' : ''}`} onClick={() => setPortrait(p)} aria-label={`Portrait ${p}`}>
            <Portrait name={name || '?'} portrait={p} size={48} />
          </button>
        ))}
      </div>
      <div style={{ margin: '12px 0' }}>
        {problem && <div className="err" data-testid="c-problem">{problem}</div>}
        <LacquerButton primary big disabled={!!problem} testid="start-created" onClick={() => start({ scenario: SCEN.id, seed, officer: created, options })}>
          Begin as {name.trim() || 'your officer'}<span className="sub">A wanderer in {cityNameOf(city)} with 300 gold and no merit</span>
        </LacquerButton>
      </div>
    </div>
  )
}
