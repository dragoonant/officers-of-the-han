// W-WAR-5 auto-resolve, expressed as a valid BattleOutcome; also AI-vs-AI duel/debate outcomes (RULINGs in the handoff).
import type { BattleOutcome, BattleSetup, BattleUnitResult } from '../contracts/battle'
import type { DebateOutcome, DebateSetup, DuelOutcome, DuelSetup } from '../contracts/contest'
import type { WorldState } from '../contracts/world'
import { nextFloat, seedRng, type RngState } from '../shared/rng'
import type { DataIdx } from './core'

export function sidePower(units: BattleSetup['units'], side: 'attacker' | 'defender', training: number): number {
  let p = 0
  for (const u of units) {
    if (u.side !== side) continue
    p += u.troops * (0.6 + (u.officer.stats.war + u.officer.stats.ldr) / 250) * (0.7 + training / 333)
  }
  return p
}

export function wallsFactor(d: DataIdx, setup: BattleSetup): number {
  const max = d.cityDef.get(setup.cityId)?.wallsMax ?? 100
  return 1 + (0.6 * setup.walls) / Math.max(1, max)
}

/** Does the defending side have a city to retreat to? */
function defenderHasRetreat(s: WorldState, setup: BattleSetup): boolean {
  if (!setup.defenderFaction) return false
  for (const id in s.cities) {
    const ct = s.cities[id]!
    if (ct.faction === setup.defenderFaction && id !== setup.cityId) return true
  }
  return false
}

/** One draw for the winner, then one capture draw per losing real officer, in setup order. */
export function autoBattleOutcome(d: DataIdx, s: WorldState, setup: BattleSetup, rng: RngState): BattleOutcome {
  const pa = sidePower(setup.units, 'attacker', setup.attackerTraining)
  const pd = sidePower(setup.units, 'defender', setup.defenderTraining) * wallsFactor(d, setup)
  const attWins = pa * (0.85 + 0.3 * nextFloat(rng)) > pd
  const winner = attWins ? 'attacker' : 'defender'
  const pw = attWins ? pa : pd
  const pl = attWins ? pd : pa
  const q = pw > 0 ? Math.min(1, pl / pw) : 1
  const noRetreat = !attWins ? false : !defenderHasRetreat(s, setup)
  const units: BattleUnitResult[] = []
  for (const u of setup.units) {
    const won = u.side === winner
    const loss = won ? Math.floor(u.troops * 0.35 * q) : Math.floor(u.troops * (0.5 + 0.3 * (1 - q)))
    const end = Math.max(0, u.troops - loss)
    let captured = false
    if (!won && !u.officer.id.startsWith('garrison-')) {
      const pct = 10 + (u.side === 'defender' && noRetreat ? 20 : 0)
      captured = 1 + Math.floor(nextFloat(rng) * 100) <= pct
    }
    units.push({
      officer: u.officer.id,
      side: u.side,
      troopsStart: u.troops,
      troopsEnd: end,
      routed: !won,
      captured,
      slain: false,
      wounded: 0,
      merit: won ? 150 + (u.commander ? 300 : 0) : 30,
    })
  }
  return { battleId: setup.id, winner, reason: attWins ? 'commander-routed' : 'time', days: Math.min(setup.maxDays, 10), units, duels: [] }
}

/** AI-vs-AI duel outside battle (RULING): WAR + health/10 + 20*rng each; a within 3 points is a draw. */
export function autoDuelOutcome(setup: DuelSetup, rng: RngState = seedRng(setup.seed)): DuelOutcome {
  const ra = setup.a.stats.war + setup.a.health / 10 + 20 * nextFloat(rng)
  const rb = setup.b.stats.war + setup.b.health / 10 + 20 * nextFloat(rng)
  const diff = ra - rb
  if (Math.abs(diff) < 3) return { duelId: setup.id, winner: null, how: 'draw', rounds: 10, vigorLeft: { a: 10, b: 10 } }
  const aWins = diff > 0
  return {
    duelId: setup.id,
    winner: aWins ? 'a' : 'b',
    how: 'knockout',
    rounds: 6,
    vigorLeft: { a: aWins ? 20 : 0, b: aWins ? 0 : 20 },
  }
}

/** AI-vs-AI debate (RULING): INT + CHA/2 + composure bonus + 15*rng; ties go to the asked side b (D-DEB-6). */
export function autoDebateOutcome(setup: DebateSetup, rng: RngState = seedRng(setup.seed)): DebateOutcome {
  const sa = (setup.a.stats.int + setup.a.stats.cha / 2) * (1 + setup.composureBonus.a) + 15 * nextFloat(rng)
  const sb = (setup.b.stats.int + setup.b.stats.cha / 2) * (1 + setup.composureBonus.b) + 15 * nextFloat(rng)
  const aWins = sa > sb
  return { debateId: setup.id, winner: aWins ? 'a' : 'b', rounds: 4, composureLeft: { a: aWins ? 20 : 0, b: aWins ? 0 : 20 } }
}

/** Reject an outcome that does not fit its setup (RejectCode bad-outcome). */
export function validateBattleOutcome(setup: BattleSetup, o: BattleOutcome): string | null {
  if (!o || typeof o !== 'object') return 'no outcome'
  if (o.battleId !== setup.id) return 'wrong battle id'
  if (o.winner !== 'attacker' && o.winner !== 'defender') return 'bad winner'
  if (!Array.isArray(o.units) || o.units.length !== setup.units.length) return 'unit list does not match the setup'
  const seen = new Set<string>()
  for (const r of o.units) {
    const u = setup.units.find((x) => x.officer.id === r.officer)
    if (!u || seen.has(r.officer)) return `unknown or repeated unit ${String(r.officer)}`
    seen.add(r.officer)
    if (r.side !== u.side) return 'unit side differs from the setup'
    if (r.troopsStart !== u.troops) return 'troopsStart differs from the setup'
    if (!Number.isInteger(r.troopsEnd) || r.troopsEnd < 0 || r.troopsEnd > u.troops) return 'troopsEnd out of range'
    if (!Number.isInteger(r.wounded) || r.wounded < 0 || r.wounded > Math.max(0, u.officer.health)) return 'wounded out of range'
    if (!Number.isFinite(r.merit) || r.merit < 0 || r.merit > 3000) return 'merit out of range'
    if (r.captured && r.side === o.winner) return 'a winning unit cannot be captured'
    if (r.captured && r.slain) return 'captured and slain'
    if (u.officer.id.startsWith('garrison-') && (r.captured || r.slain)) return 'a garrison cannot be captured or slain'
  }
  if (!Number.isInteger(o.days) || o.days < 0 || o.days > setup.maxDays) return 'days out of range'
  if (!Array.isArray(o.duels)) return 'duels missing'
  for (const dr of o.duels) {
    if (!seen.has(dr.a) || !seen.has(dr.b)) return 'duel names an unknown officer'
  }
  return null
}
