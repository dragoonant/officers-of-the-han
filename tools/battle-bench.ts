// Battle bench: auto-plays battles (both sides AI, and AI vs random), checks invariants after every step and reports.
// Usage: npm run bench:battle -- [N=150] [--seed=1] [--verbose]
import { chooseAction, type AiTier } from '../src/ai/battle'
import type { BattleSetup } from '../src/contracts/battle'
import {
  createBattle, legalActions, replay, step, type BattleAction, type BattleEvent, type BattleState,
} from '../src/battle'
import { sampleSetup } from '../src/battle/sample'
import { TERRAIN } from '../src/battle/terrain'
import { hexIndex } from '../src/battle/hex'

const args = process.argv.slice(2)
const N = Number(args.find((a) => /^\d+$/.test(a)) ?? 150)
const SEED0 = Number((args.find((a) => a.startsWith('--seed=')) ?? '--seed=1').slice(7))
const VERBOSE = args.includes('--verbose')

export function checkInvariants(s: BattleState): string[] {
  const bad: string[] = []
  const seen = new Set<string>()
  for (const u of s.units) {
    for (const v of [u.troops, u.morale, u.health, u.q, u.r, u.merit]) if (!Number.isFinite(v)) bad.push(`NaN in ${u.id}`)
    if (u.troops < 0 || u.troops > u.troopsStart) bad.push(`${u.id} troops ${u.troops} outside [0, ${u.troopsStart}]`)
    if (u.morale < 0 || u.morale > 100) bad.push(`${u.id} morale ${u.morale}`)
    if (u.routed) continue
    const k = `${u.q},${u.r}`
    if (seen.has(k)) bad.push(`two units on ${k}`)
    seen.add(k)
    const i = hexIndex(u.q, u.r)
    const c = s.hexes[i]
    if (!c) bad.push(`${u.id} off the field`)
    else {
      const info = TERRAIN[c.terrain]
      const passable = c.terrain === 'gate' ? c.gateHp <= 0 : !!info.cost
      if (!passable) bad.push(`${u.id} on impassable ${c.terrain}`)
    }
  }
  for (const c of s.hexes) if (c.terrain === 'gate' && (c.gateHp < 0 || c.gateHp > c.gateMax)) bad.push('gate hp out of range')
  if (!s.outcome && legalActions(s).length === 0) bad.push('legalActions empty before the outcome')
  if (s.outcome && legalActions(s).length !== 0) bad.push('legalActions non-empty after the outcome')
  if (s.day < 1 || s.day > s.setup.maxDays) bad.push(`day ${s.day}`)
  return bad
}

export interface PlayResult {
  state: BattleState
  actions: BattleAction[]
  events: BattleEvent[]
  errors: string[]
  ms: number
}

export function playBattle(setup: BattleSetup, tiers: { attacker: AiTier; defender: AiTier }, check: boolean): PlayResult {
  const t0 = performance.now()
  let s = createBattle(setup)
  const actions: BattleAction[] = []
  const events: BattleEvent[] = []
  const errors: string[] = []
  if (check) errors.push(...checkInvariants(s))
  for (let i = 0; i < 6000 && !s.outcome; i++) {
    const u = s.units.find((x) => x.id === s.active)
    if (!u) { errors.push('no active unit before the outcome'); break }
    const a = chooseAction(s, u.id, tiers[u.side])
    const r = step(s, a)
    if (!r.ok) { errors.push(`AI action rejected: ${JSON.stringify(a)} -> ${r.code} ${r.message}`); break }
    actions.push(a)
    events.push(...r.events)
    s = r.state
    if (check) errors.push(...checkInvariants(s))
    if (errors.length > 5) break
  }
  if (!s.outcome) errors.push('battle did not end')
  const ms = performance.now() - t0
  if (check && s.outcome) {
    const rp = replay(setup, actions)
    if (JSON.stringify(rp) !== JSON.stringify(s)) errors.push('replay differs from the live state')
    if (JSON.stringify(JSON.parse(JSON.stringify(s))) !== JSON.stringify(s)) errors.push('JSON round trip differs')
  }
  return { state: s, actions, events, errors, ms }
}

function power(setup: BattleSetup, side: 'attacker' | 'defender'): number {
  return setup.units.filter((u) => u.side === side).reduce((a, u) => a + u.troops * (0.5 + (u.officer.stats.war + u.officer.stats.ldr) / 200), 0)
}

const pct = (a: number, b: number): string => (b ? `${((100 * a) / b).toFixed(1)}%` : 'n/a')

function main(): void {
  let failures = 0
  const fail = (m: string): void => { failures++; console.log('FAIL', m) }

  // 1. AI vs AI over varied setups
  const bands = [0.7, 1.0, 1.4, 2.0, Infinity]
  const bandName = (b: number, i: number): string => `${i === 0 ? '0' : bands[i - 1]}-${b === Infinity ? 'inf' : b}`
  const bandStats = bands.map(() => ({ n: 0, att: 0 }))
  const reasons: Record<string, number> = {}
  let days = 0
  let duels = 0
  let fires = 0
  let gates = 0
  let msMax = 0
  let msTotal = 0
  let errBattles = 0
  for (let i = 0; i < N; i++) {
    const setup = sampleSetup({ seed: SEED0 * 100000 + i })
    const res = playBattle(setup, { attacker: 'ai', defender: 'ai' }, true)
    if (res.errors.length) { errBattles++; fail(`battle ${setup.id} (${setup.terrain}): ${res.errors.slice(0, 3).join(' | ')}`) }
    const o = res.state.outcome
    if (!o) continue
    const ratio = power(setup, 'attacker') / power(setup, 'defender')
    const bi = bands.findIndex((b) => ratio < b)
    bandStats[bi]!.n++
    if (o.winner === 'attacker') bandStats[bi]!.att++
    reasons[o.reason] = (reasons[o.reason] ?? 0) + 1
    days += o.days
    duels += o.duels.length
    fires += res.events.filter((e) => e.kind === 'tactic' && e.tactic === 'fire' && e.success).length
    gates += res.events.filter((e) => e.kind === 'gate' && e.broken).length
    msMax = Math.max(msMax, res.ms)
    msTotal += res.ms
    if (VERBOSE) console.log(setup.id, setup.terrain, o.winner, o.reason, o.days, `${res.ms.toFixed(0)}ms`)
  }
  console.log(`\n== AI vs AI, ${N} battles (seed ${SEED0}) ==`)
  console.log('attacker win rate by power ratio (attacker/defender):')
  bands.forEach((b, i) => console.log(`  ${bandName(b, i).padEnd(10)} n=${String(bandStats[i]!.n).padStart(4)}  attacker wins ${pct(bandStats[i]!.att, bandStats[i]!.n)}`))
  const done = N - errBattles
  console.log(`avg days ${(days / Math.max(1, N)).toFixed(1)}; duels ${duels}; fires lit ${fires}; gates broken ${gates}`)
  console.log('rout reasons:', JSON.stringify(reasons))
  console.log(`time per battle: avg ${(msTotal / Math.max(1, N)).toFixed(0)} ms, max ${msMax.toFixed(0)} ms (with invariant checks on)`)
  void done

  // 2. speed without checks
  const sp = sampleSetup({ seed: 4242 })
  const t0 = performance.now()
  for (let i = 0; i < 20; i++) playBattle({ ...sp, seed: sp.seed + i }, { attacker: 'ai', defender: 'ai' }, false)
  const per = (performance.now() - t0) / 20
  console.log(`speed (no checks): ${per.toFixed(0)} ms per battle`)
  if (per > 300) fail(`a battle takes ${per.toFixed(0)} ms (> 300)`)

  // 3. AI vs random, both seats, evenly matched forces
  const M = Math.max(40, Math.floor(N / 2))
  for (const seat of ['attacker', 'defender'] as const) {
    let wins = 0
    for (let i = 0; i < M; i++) {
      const setup = sampleSetup({ seed: SEED0 * 100000 + 50000 + i, attackers: 6, defenders: 6, attackerTroops: 4000, defenderTroops: 4000, statBias: [0, 0] })
      const res = playBattle(setup, seat === 'attacker' ? { attacker: 'ai', defender: 'random' } : { attacker: 'random', defender: 'ai' }, i < 10)
      if (res.errors.length) fail(`ai-vs-random ${setup.id}: ${res.errors.slice(0, 2).join(' | ')}`)
      if (res.state.outcome?.winner === seat) wins++
    }
    console.log(`AI as ${seat} vs random: ${wins}/${M} (${pct(wins, M)})`)
    if (wins / M < 0.9) fail(`AI as ${seat} wins only ${pct(wins, M)} against random (gate 90%)`)
  }
  console.log(failures ? `\nBENCH FAILED (${failures})` : '\nbench ok')
  process.exit(failures ? 1 : 0)
}

if (process.argv[1] && /battle-bench/.test(process.argv[1])) main()
