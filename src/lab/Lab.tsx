// Standalone lab: play the battle, a duel and a debate before the world client exists. Not part of the game proper.
import { useMemo, useState } from 'react'
import officers from '../data/officers.json'
import { sampleSetup } from '../battle/sample'
import type { BattleOutcome, BattleSetup } from '../contracts/battle'
import type { Contestant, DebateOutcome, DebateSetup, DuelOutcome, DuelSetup } from '../contracts/contest'
import type { OfficerDef, RoadTerrain } from '../contracts/data'
import { BattleScreen, DebateScreen, DuelScreen } from '../client/contests'
import { CloudBand, LacquerButton, SilkLetter } from '../client/ui'
import './lab.css'

type Tab = 'battle' | 'duel' | 'debate'
const OFFS = officers as unknown as OfficerDef[]
const ATK = ['cao-cao', 'xiahou-dun', 'xiahou-yuan', 'cao-ren', 'dian-wei', 'li-dian', 'chen-gong', 'gan-ning']
const DEF = ['lu-bu', 'gao-shun', 'guan-yu', 'liu-bei', 'dong-zhuo', 'li-jue', 'guo-si', 'huang-gai']
const TERRAINS: RoadTerrain[] = ['plain', 'hills', 'mountain', 'river', 'marsh', 'forest']
const byId = new Map(OFFS.map((o) => [o.id, o]))

/** A sample setup with real officers' names, stats and portraits swapped in for the anonymous sample ones. */
export function labSetup(seed: number, terrain: RoadTerrain, side: 'attacker' | 'defender', named: boolean): BattleSetup {
  const base = sampleSetup({ seed, terrain, playerControls: [`${side[0]}0`] })
  if (!named) return { ...base, cityName: 'Sample City' }
  const rename = new Map<string, string>()
  const na: string[] = []
  const nd: string[] = []
  for (const u of base.units) {
    const pool = u.side === 'attacker' ? ATK : DEF
    const list = u.side === 'attacker' ? na : nd
    const id = pool[list.length % pool.length]!
    list.push(id)
    rename.set(u.officer.id, id)
  }
  const units = base.units.map((u) => {
    const id = rename.get(u.officer.id)!
    const def = byId.get(id)
    return {
      ...u,
      officer: {
        ...u.officer,
        id,
        name: def?.name ?? id,
        portrait: def?.portrait,
        stats: def?.stats ?? u.officer.stats,
        temperament: def?.temperament ?? u.officer.temperament,
        aptitude: def?.aptitude ?? u.officer.aptitude,
        oathGroup: u.officer.oathGroup.map((x) => rename.get(x)!),
      },
    }
  })
  return { ...base, cityName: 'Luoyang', units, playerControls: base.playerControls.map((x) => rename.get(x)!) }
}

function contestant(id: string, player: boolean): Contestant {
  const d = byId.get(id) ?? OFFS[0]!
  return { id: d.id, name: d.name, stats: d.stats, temperament: d.temperament, health: 100, portrait: d.portrait, player }
}

function BattleTab() {
  const [seed, setSeed] = useState(7)
  const [terrain, setTerrain] = useState<RoadTerrain>('plain')
  const [side, setSide] = useState<'attacker' | 'defender'>('attacker')
  const [named, setNamed] = useState(true)
  const [run, setRun] = useState<{ setup: BattleSetup; key: number } | null>(null)
  const [outcome, setOutcome] = useState<BattleOutcome | null>(null)
  if (run && !outcome) {
    return (
      <div className="lab-full">
        <BattleScreen key={run.key} setup={run.setup} onDone={setOutcome} />
      </div>
    )
  }
  return (
    <div className="lab-form">
      {outcome && (
        <SilkLetter title="Battle report" actions={<LacquerButton name="New battle" onClick={() => { setOutcome(null); setRun(null) }} />}>
          The {outcome.winner} won on day {outcome.days} ({outcome.reason}). {outcome.units.filter((u) => u.routed).length} units routed, {outcome.duels.length} duels.
          Merit: {outcome.units.filter((u) => u.side === outcome.winner).reduce((a, u) => a + u.merit, 0)} to the winners.
        </SilkLetter>
      )}
      {!outcome && (
        <>
          <label>Seed <input id="lab-seed" type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value) | 0)} /></label>
          <label>Terrain
            <select id="lab-terrain" value={terrain} onChange={(e) => setTerrain(e.target.value as RoadTerrain)}>
              {TERRAINS.map((t) => <option key={t}>{t}</option>)}
            </select>
          </label>
          <label>Play as
            <select id="lab-side" value={side} onChange={(e) => setSide(e.target.value as 'attacker' | 'defender')}>
              <option value="attacker">Attacker (west)</option>
              <option value="defender">Defender (the city)</option>
            </select>
          </label>
          <label><input id="lab-named" type="checkbox" checked={named} onChange={(e) => setNamed(e.target.checked)} /> Named officers (else anonymous medallions)</label>
          <LacquerButton id="lab-start-battle" primary state="available" name="Start the battle" cost="Sample setup from the seed" onClick={() => setRun({ setup: labSetup(seed, terrain, side, named), key: Date.now() })} />
        </>
      )}
    </div>
  )
}

function ContestPicker({ kind }: { kind: 'duel' | 'debate' }) {
  const names = useMemo(() => OFFS.filter((o) => o.stats).map((o) => ({ id: o.id, name: o.name })), [])
  const [a, setA] = useState('guan-yu')
  const [b, setB] = useState('lu-bu')
  const [seed, setSeed] = useState(3)
  const [run, setRun] = useState<number | null>(null)
  const [res, setRes] = useState<DuelOutcome | DebateOutcome | null>(null)
  const setup = useMemo(() => {
    if (run === null) return null
    const base = { id: `lab-${kind}-${seed}`, seed }
    if (kind === 'duel') return { ...base, a: contestant(a, true), b: contestant(b, false), inBattle: false } satisfies DuelSetup
    return { ...base, a: contestant(a, true), b: contestant(b, false), purpose: 'recruit', composureBonus: { a: 0, b: 0.1 } } satisfies DebateSetup
  }, [run, a, b, seed, kind])
  if (setup && !res) {
    return (
      <div className="lab-full">
        {kind === 'duel' ? <DuelScreen key={run} setup={setup as DuelSetup} onDone={setRes} /> : <DebateScreen key={run} setup={setup as DebateSetup} onDone={setRes} />}
      </div>
    )
  }
  const pick = (v: string, set: (s: string) => void, id: string) => (
    <select id={id} value={v} onChange={(e) => set(e.target.value)}>{names.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}</select>
  )
  return (
    <div className="lab-form">
      {res && <SilkLetter title={kind === 'duel' ? 'Duel result' : 'Debate result'} actions={<LacquerButton name="Again" onClick={() => { setRes(null); setRun(null) }} />}>{JSON.stringify(res)}</SilkLetter>}
      {!res && (
        <>
          <label>You {pick(a, setA, `lab-${kind}-a`)}</label>
          <label>Against {pick(b, setB, `lab-${kind}-b`)}</label>
          <label>Seed <input id={`lab-${kind}-seed`} type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value) | 0)} /></label>
          <LacquerButton id={`lab-start-${kind}`} primary state="available" name={kind === 'duel' ? 'Begin the duel' : 'Begin the debate'} cost="You play the first named officer" onClick={() => setRun(Date.now())} />
        </>
      )}
    </div>
  )
}

export function Lab() {
  const [tab, setTab] = useState<Tab>('battle')
  return (
    <div className="lab">
      <div className="lab-head">
        <CloudBand />
        <div className="lab-tabs" role="tablist">
          <span className="caps lab-title">Officers of the Han · Lab</span>
          {(['battle', 'duel', 'debate'] as Tab[]).map((t) => (
            <button key={t} role="tab" id={`tab-${t}`} aria-selected={tab === t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)} type="button">{t}</button>
          ))}
        </div>
      </div>
      <div className="lab-body">
        {tab === 'battle' && <BattleTab />}
        {tab === 'duel' && <ContestPicker key="duel" kind="duel" />}
        {tab === 'debate' && <ContestPicker key="debate" kind="debate" />}
      </div>
    </div>
  )
}
