// Headless world sim: `npm run sim -- --years 10 --seeds 20 [--fixture] [--officer id] [--quiet]`.
// The autopilot plays the player's officer and answers every pending; every invariant of 00-architecture.md is checked after every step.
import { createWorldApi } from '../src/world'
import { LOG_KIND_SET } from '../src/world/logkinds'
import { GAME_DATA } from '../src/data'
import { MINI_WORLD } from '../tests/fixtures/mini-world'
import type { GameData } from '../src/contracts/data'
import type { WorldAction, WorldState } from '../src/contracts/world'

function arg(name: string, def: string): string {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1]!.startsWith('--') ? process.argv[i + 1]! : def
}
const flag = (name: string): boolean => process.argv.includes(`--${name}`)

const years = Number(arg('years', '10'))
const seeds = Number(arg('seeds', '20'))
const quiet = flag('quiet')
let data: GameData = GAME_DATA
if (flag('fixture')) data = MINI_WORLD
else if (GAME_DATA.cities.length === 0 || GAME_DATA.officers.length === 0) {
  console.log('NOTICE: the real data is empty; running on the fixture (tests/fixtures/mini-world.ts).')
  data = MINI_WORLD
}
const world = createWorldApi(data)
const scenario = data.scenarios[0]!.id

const failures: string[] = []
let stalls = 0
const totals = { steps: 0, wars: 0, battles: 0, deaths: 0, captures: 0, rebels: 0, joins: 0, events: 0, endings: 0, played: 0, rejects: 0, unknownKinds: 0 }
const factionsByYear = new Map<number, number[]>()
const kinds = new Map<string, number>()
// balance stats (13-balance.md)
let factionMonths = 0
let attackerWins = 0
let famineEarly = 0
const earlyFamineCities = new Map<string, number>()
const cityCounts = new Map<number, Map<string, number[]>>() // year -> faction name -> city counts per seed
const topShare200: number[] = []
const strongAlive = new Map<string, number>() // label -> seeds alive at the end
const STRONG: [string, RegExp][] = [['Cao Cao', /cao cao/i], ['Yuan Shao', /yuan shao/i], ['Sun', /\bsun\b/i], ['Liu Biao', /liu biao/i], ['Liu Yan/Zhang', /liu (yan|zhang)/i]]
const playerPosts = new Map<string, number>()
const t0 = Date.now()

for (let seed = 1; seed <= seeds; seed++) {
  const probe = world.newGame({ scenario, seed, officer: arg('officer', '') || pickOfficer(seed) })
  let s: WorldState = probe
  const opts = { scenario, seed, officer: arg('officer', '') || pickOfficer(seed) }
  const actions: WorldAction[] = []
  const endYear = s.ym.year + years
  let monthSteps = 0
  let lastMonth = s.ym.year * 12 + s.ym.month
  let yr = s.ym.year
  const record = (st: WorldState): void => {
    let alive = 0
    for (const f of Object.values(st.factions)) if (f.alive) alive++
    const arr = factionsByYear.get(st.ym.year) ?? []
    arr.push(alive)
    factionsByYear.set(st.ym.year, arr)
    if (st.ym.year === 195 || st.ym.year === 200) {
      const byF = cityCounts.get(st.ym.year) ?? new Map<string, number[]>()
      const cnt = new Map<string, number>()
      for (const c of Object.values(st.cities)) if (c.faction) cnt.set(c.faction, (cnt.get(c.faction) ?? 0) + 1)
      for (const f of Object.values(st.factions)) if (f.alive) { const a = byF.get(f.name) ?? []; a.push(cnt.get(f.id) ?? 0); byF.set(f.name, a) }
      cityCounts.set(st.ym.year, byF)
    }
  }
  while (s.phase !== 'ended' && s.ym.year < endYear) {
    const legal = world.legalActions(s)
    if (legal.length === 0) { failures.push(`seed ${seed}: legalActions empty at ${s.ym.year}-${s.ym.month}`); break }
    const a = world.autopilot(s)
    const r = world.step(s, a)
    totals.steps++
    if (!r.ok) {
      totals.rejects++
      failures.push(`seed ${seed}: autopilot action rejected ${JSON.stringify(a).slice(0, 160)}: ${r.code} ${r.message}`)
      const r2 = world.step(s, { kind: 'endMonth' })
      if (!r2.ok) { failures.push(`seed ${seed}: endMonth rejected`); break }
      actions.push({ kind: 'endMonth' })
      s = r2.state
    } else {
      actions.push(a)
      s = r.state
      for (const e of r.events) {
        if (e.kind === 'famine' && s.ym.year === 190 && s.ym.month <= 9 && e.city) { famineEarly++; earlyFamineCities.set(e.city, (earlyFamineCities.get(e.city) ?? 0) + 1) }
        if (e.kind === 'battle' && / took /.test(e.text)) attackerWins++
        kinds.set(e.kind, (kinds.get(e.kind) ?? 0) + 1)
        if (!LOG_KIND_SET.has(e.kind)) { totals.unknownKinds++; failures.push(`seed ${seed}: unknown log kind ${e.kind}`) }
        if (e.kind === 'war') totals.wars++
        else if (e.kind === 'battle') totals.battles++
        else if (e.kind === 'death') totals.deaths++
        else if (e.kind === 'capture') totals.captures++
        else if (e.kind === 'rebel') totals.rebels++
        else if (e.kind === 'join') totals.joins++
        else if (e.kind === 'event') totals.events++
      }
      if (a.kind === 'resolveBattle') totals.played++
    }
    const inv = world.invariants(s)
    if (inv.length) {
      failures.push(`seed ${seed} ${s.ym.year}-${s.ym.month} after ${a.kind}: ${inv.slice(0, 3).join('; ')}`)
      if (failures.length > 40) break
    }
    const m = s.ym.year * 12 + s.ym.month
    if (m !== lastMonth) { factionMonths += Object.values(s.factions).filter((f) => f.alive).length; lastMonth = m; monthSteps = 0; if (s.ym.year !== yr) { yr = s.ym.year; record(s) } } else if (++monthSteps > 400) {
      stalls++
      failures.push(`seed ${seed}: stall at ${s.ym.year}-${s.ym.month}`)
      break
    }
  }
  if (s.phase === 'ended') totals.endings++
  {
    const cnt = new Map<string, number>()
    for (const c of Object.values(s.cities)) if (c.faction) cnt.set(c.faction, (cnt.get(c.faction) ?? 0) + 1)
    const tot = Object.keys(s.cities).length
    topShare200.push(Math.max(0, ...cnt.values()) / tot)
    for (const [label, re] of STRONG) if (Object.values(s.factions).some((f) => f.alive && re.test(f.name))) strongAlive.set(label, (strongAlive.get(label) ?? 0) + 1)
    const po = s.officers[s.player]
    const key = po ? `${po.status}/${po.post}${po.faction ? ' of ' + s.factions[po.faction]?.name : ''}` : 'none'
    playerPosts.set(key, (playerPosts.get(key) ?? 0) + 1)
  }
  if (JSON.stringify(JSON.parse(JSON.stringify(s))) !== JSON.stringify(s)) failures.push(`seed ${seed}: state is not plain JSON`)
  if (seed <= 2) {
    const rep = world.replay(opts, actions)
    if (JSON.stringify(rep) !== JSON.stringify(s)) failures.push(`seed ${seed}: replay differs from the live state`)
  }
  if (!quiet && seed <= 3) {
    const alive = Object.values(s.factions).filter((f) => f.alive)
    console.log(`seed ${seed}: player ${opts.officer} -> ${s.ym.year}-${s.ym.month} ${s.phase}; factions alive ${alive.length} (${alive.map((f) => f.name).join(', ')}); dead officers ${Object.values(s.officers).filter((o) => o.status === 'dead').length}`)
  }
  if (failures.length > 40) break
}

function pickOfficer(seed: number): string {
  const s0 = world.newGame({ scenario, seed: 1, officer: firstOfficer() })
  const ids = Object.keys(s0.officers).sort().filter((id) => s0.officers[id]!.status === 'active' && !s0.officers[id]!.hidden)
  return ids[(seed - 1) % ids.length]!
}
function firstOfficer(): string {
  const sc = data.scenarios[0]!
  return sc.officers.find((o) => !o.hidden)!.id
}

const secs = ((Date.now() - t0) / 1000).toFixed(1)
console.log(`\n== sim: ${seeds} seeds x ${years} years on ${data === MINI_WORLD ? 'the fixture' : 'the real data'} in ${secs}s ==`)
console.log(`steps ${totals.steps}, wars ${totals.wars}, battles ${totals.battles}, played battles ${totals.played}, deaths ${totals.deaths}, captures ${totals.captures}, rebellions ${totals.rebels}, joins ${totals.joins}, events ${totals.events}, endings ${totals.endings}`)
console.log('living factions by year (mean over seeds):')
for (const [y, arr] of [...factionsByYear.entries()].sort((a, b) => a[0] - b[0])) console.log(`  ${y}: ${(arr.reduce((p, q) => p + q, 0) / arr.length).toFixed(1)}  (min ${Math.min(...arr)}, max ${Math.max(...arr)})`)
const fy = factionMonths / 12
const famines = kinds.get('famine') ?? 0
console.log(`\nbalance (${fy.toFixed(0)} faction-years): famine/faction-year ${(famines / fy).toFixed(2)}; wars/faction-year ${(totals.wars / fy).toFixed(2)}; captures/battle ${(totals.captures / Math.max(1, totals.battles)).toFixed(2)}; attacker wins ${attackerWins}/${totals.battles}; diplomacy/faction-year ${((kinds.get('diplomacy') ?? 0) / fy).toFixed(2)}; missions done ${kinds.get('mission-done') ?? 0} failed ${kinds.get('mission-failed') ?? 0}; successions ${kinds.get('succession') ?? 0}`)
console.log(`famine events in 190-1..190-9: ${famineEarly} ${[...earlyFamineCities.entries()].map(([k, v]) => `${k}:${v}`).join(' ')}`)
for (const y of [195, 200]) {
  const m = cityCounts.get(y)
  if (!m) continue
  const rows = [...m.entries()].map(([n, a]) => ({ n, mean: a.reduce((p, q) => p + q, 0) / seeds, seeds: a.length })).sort((a, b) => b.mean - a.mean)
  console.log(`cities by faction at ${y} (mean over all seeds, seeds alive): ${rows.map((r) => `${r.n} ${r.mean.toFixed(1)} (${r.seeds})`).join(', ')}`)
}
console.log(`largest city share at 200 per seed: ${topShare200.map((x) => (x * 100).toFixed(0) + '%').join(' ')}; seeds over 40%: ${topShare200.filter((x) => x > 0.4).length}`)
console.log(`strong powers alive at the end (seeds of ${seeds}): ${STRONG.map(([l]) => `${l} ${strongAlive.get(l) ?? 0}`).join(', ')}`)
console.log(`player's officer at the end: ${[...playerPosts.entries()].map(([k, v]) => `${k} x${v}`).join('; ')}`)
console.log('log kinds:', [...kinds.entries()].sort().map(([k, v]) => `${k}=${v}`).join(' '))
console.log(`invariant failures: ${failures.length}, stalls: ${stalls}, rejected autopilot actions: ${totals.rejects}, unknown log kinds: ${totals.unknownKinds}`)
for (const f of failures.slice(0, 20)) console.log('  FAIL', f)
process.exit(failures.length === 0 && stalls === 0 ? 0 : 1)
