// query.*: owns every number the UI shows (20-battle.md §9). Pure; never touches the RNG.
import type { BattleOutcome, BattleSide } from '../contracts/battle'
import { hexDistance, hexIndex, hexesWithin, neighbors } from './hex'
import {
  alive, calcDamage, cellAt, dmgAt, enemiesOf, isBrokenGate, knownTactics as knownTacticsOf, maxRange,
  pathTo, reach, tacticChance, terrainDef, unitAt, unitById, type Mult,
} from './core'
import { MOVE_POINTS, TERRAIN } from './terrain'
import { APT_MULT, type BattleState, type BUnit, type TacticId, type Terrain } from './types'
import { buildOutcome } from './outcome'

export interface MoveOption {
  q: number
  r: number
  cost: number
}
export interface AttackTarget {
  target: string
  range: number
}
export interface AttackPreview {
  attacker: string
  target: string
  range: number
  min: number
  max: number
  /** counter damage range; 0/0 when there is no counter (range > 1, or the target cannot survive) */
  counterMin: number
  counterMax: number
  counter: boolean
  moraleLossTarget: number // at max damage
  kills: boolean // true when max damage routs the target by troops
  multipliers: Mult[]
}
export interface TacticTarget {
  q: number
  r: number
  chance: number // percent
  unit: string | null // occupant of (q, r), if any
}
export interface TacticPreview {
  tactic: TacticId
  q: number
  r: number
  chance: number
  moraleGain: number
  /** damage/effects per affected unit */
  hits: { unit: string; min: number; max: number }[]
  text: string
}
export interface UnitView {
  id: string
  name: string
  portrait: string | undefined
  side: BattleSide
  type: BUnit['type']
  commander: boolean
  q: number
  r: number
  troops: number
  troopsStart: number
  morale: number
  health: number
  stats: BUnit['officer']['stats']
  aptitude: number // multiplier for the unit's own type
  aptitudeRank: string
  routed: boolean
  confused: boolean
  taunted: string | null
  onFire: boolean
  moved: boolean
  movePoints: number
  range: number
  tactics: TacticId[]
  canChallenge: boolean
  initiative: number
  isPlayer: boolean
  terrain: Terrain
}
export interface HexView {
  q: number
  r: number
  terrain: Terrain
  name: string
  defence: number
  moveCost: { spear: number | null; cavalry: number | null; archer: number | null }
  passable: boolean
  burning: number
  burnable: boolean
  gateHp: number | null
  gateMax: number | null
  unit: string | null
}

export function activeUnit(state: BattleState): BUnit | null {
  return state.active ? (unitById(state, state.active) ?? null) : null
}

export function moveRange(state: BattleState, unitId: string): MoveOption[] {
  const u = unitById(state, unitId)
  if (!u || u.routed) return []
  const nodes = reach(state, u)
  return [...nodes.values()].map((n) => ({ q: n.q, r: n.r, cost: n.cost }))
}

/** The path the unit would take to (q, r) from its current hex. */
export function movePath(state: BattleState, unitId: string, q: number, r: number): { q: number; r: number }[] {
  const u = unitById(state, unitId)
  if (!u || u.routed) return []
  return pathTo(reach(state, u), q, r)
}

export function attackTargetsFrom(state: BattleState, u: BUnit, q: number, r: number): AttackTarget[] {
  const mr = maxRange(state, u, q, r)
  const out: AttackTarget[] = []
  for (const e of enemiesOf(state, u)) {
    const d = hexDistance(q, r, e.q, e.r)
    if (d >= 1 && d <= mr) out.push({ target: e.id, range: d })
  }
  return out
}

export function attackTargets(state: BattleState, unitId: string): AttackTarget[] {
  const u = unitById(state, unitId)
  if (!u || u.routed) return []
  return attackTargetsFrom(state, u, u.q, u.r)
}

/** Preview an attack from the unit's current hex, or from (from.q, from.r) as if it had moved there. */
export function attackPreview(
  state: BattleState, unitId: string, targetId: string, from?: { q: number; r: number },
): AttackPreview | null {
  const u = unitById(state, unitId)
  const t = unitById(state, targetId)
  if (!u || !t || u.routed || t.routed || u.side === t.side) return null
  const fq = from?.q ?? u.q
  const fr = from?.r ?? u.r
  const range = hexDistance(fq, fr, t.q, t.r)
  if (range < 1 || range > maxRange(state, u, fq, fr)) return null
  const movedDist = u.moved ? u.movedDist : from ? hexDistance(u.q, u.r, fq, fr) : 0
  const calc = calcDamage(state, u, t, { attQ: fq, attR: fr, range, movedDist })
  const min = dmgAt(calc, 0.9)
  const max = dmgAt(calc, 1.1)
  let counterMin = 0
  let counterMax = 0
  const counter = range === 1 && t.troops - min > 0
  if (counter) {
    // The counter is rolled by the defender after it took `dmg`: fewer troops and less morale.
    const counterAfter = (dmg: number, roll: number): number => {
      const left = t.troops - dmg
      if (left <= 0) return 0
      const lost = Math.ceil((25 * dmg) / t.troops)
      const c = calcDamage(state, t, { ...u, q: fq, r: fr }, {
        range: 1, defQ: fq, defR: fr, attTroops: left, attMorale: Math.max(0, t.morale - lost),
      })
      return Math.max(1, Math.floor(c.mid * 0.5 * roll))
    }
    counterMin = counterAfter(max, 0.9)
    counterMax = counterAfter(min, 1.1)
  }
  return {
    attacker: u.id, target: t.id, range, min, max, counterMin, counterMax, counter,
    moraleLossTarget: Math.ceil((25 * max) / t.troops),
    kills: max >= t.troops,
    multipliers: calc.mults,
  }
}

export function tacticTargets(state: BattleState, unitId: string, tactic: TacticId): TacticTarget[] {
  const u = unitById(state, unitId)
  if (!u || u.routed || !knownTacticsOf(u).includes(tactic)) return []
  return tacticTargetsFrom(state, u, tactic, u.q, u.r)
}

export function tacticTargetsFrom(state: BattleState, u: BUnit, tactic: TacticId, fq: number, fr: number): TacticTarget[] {
  const out: TacticTarget[] = []
  if (tactic === 'rally') return [{ q: fq, r: fr, chance: 100, unit: u.id }]
  for (const h of hexesWithin(fq, fr, 2)) {
    const d = hexDistance(fq, fr, h.q, h.r)
    if (d < 1) continue
    const occ = unitAt(state, h.q, h.r)
    const c = cellAt(state, h.q, h.r)
    if (!c) continue
    if (tactic === 'fire') {
      if (!TERRAIN[c.terrain].burns || c.burn > 0) continue
      if (occ && occ.side === u.side) continue
      out.push({ q: h.q, r: h.r, chance: tacticChance(u, occ ?? null), unit: occ?.id ?? null })
    } else if (tactic === 'confuse' || tactic === 'taunt') {
      if (!occ || occ.side === u.side) continue
      if (tactic === 'confuse' && occ.confused) continue
      if (tactic === 'taunt' && occ.taunted) continue
      out.push({ q: h.q, r: h.r, chance: tacticChance(u, occ), unit: occ.id })
    } else if (tactic === 'volley') {
      if (u.type !== 'archer') continue
      if (volleyVictims(state, u, h.q, h.r).length === 0) continue
      out.push({ q: h.q, r: h.r, chance: 100, unit: occ?.id ?? null })
    }
  }
  return out
}

/** B-TAC-VOLLEY: every enemy unit in the target hex and its neighbours, in unit order. */
export function volleyVictims(state: BattleState, u: BUnit, q: number, r: number): BUnit[] {
  const set = new Set<number>([hexIndex(q, r), ...neighbors(q, r).map((n) => hexIndex(n.q, n.r))])
  return state.units.filter((e) => !e.routed && e.side !== u.side && set.has(hexIndex(e.q, e.r)))
}

export function tacticPreview(state: BattleState, unitId: string, tactic: TacticId, q: number, r: number): TacticPreview | null {
  const u = unitById(state, unitId)
  if (!u || u.routed) return null
  const t = tacticTargets(state, unitId, tactic).find((x) => x.q === q && x.r === r)
  if (!t) return null
  const hits: TacticPreview['hits'] = []
  let text = ''
  if (tactic === 'volley') {
    for (const e of volleyVictims(state, u, q, r)) {
      const calc = calcDamage(state, u, e, { range: 2, extra: 0.6 })
      hits.push({ unit: e.id, min: dmgAt(calc, 0.9), max: dmgAt(calc, 1.1) })
    }
    text = 'Shoots every enemy in the hex and around it at x0.6, no counter.'
  } else if (tactic === 'fire') text = 'The hex burns for 2 days: 10% troops and 10 morale each turn spent in it; it may spread.'
  else if (tactic === 'confuse') text = 'The target skips its next turn.'
  else if (tactic === 'taunt') text = 'The target must close on you and attack you on its next turn.'
  else text = 'You and adjacent allies gain 15 morale.'
  return { tactic, q, r, chance: t.chance, moraleGain: 5, hits, text }
}

export function knownTactics(state: BattleState, unitId: string): TacticId[] {
  const u = unitById(state, unitId)
  return u ? knownTacticsOf(u) : []
}

export function initiativeOf(u: BUnit): number {
  return u.officer.stats.ldr + (u.type === 'cavalry' ? 20 : 0)
}

/** Order for the rest of the day: the active unit first. */
export function initiative(state: BattleState): string[] {
  if (state.outcome) return []
  return state.order.slice(state.cursor).filter((id) => {
    const u = unitById(state, id)
    return !!u && alive(u)
  })
}

export function canChallenge(state: BattleState, u: BUnit): string[] {
  if (u.routed || u.officer.stats.war < 60 || u.health < 30) return []
  const out: string[] = []
  for (const e of enemiesOf(state, u)) {
    if (hexDistance(u.q, u.r, e.q, e.r) === 1 && e.health > 0) out.push(e.id)
  }
  return out
}

export function isPlayerUnit(state: BattleState, id: string): boolean {
  const u = unitById(state, id)
  if (!u) return false
  const pc = state.setup.playerControls
  if (pc.includes(u.officer.id)) return true
  // B-TURN-5: the player's commander commands every unit of the side.
  return pc.some((pid) => {
    const p = state.units.find((x) => x.officer.id === pid)
    return !!p && p.commander && p.side === u.side
  })
}

export function unitView(state: BattleState, unitId: string): UnitView | null {
  const u = unitById(state, unitId)
  if (!u) return null
  const c = cellAt(state, u.q, u.r)
  const rank = u.officer.aptitude[u.type]
  return {
    id: u.id, name: u.officer.name, portrait: u.officer.portrait, side: u.side, type: u.type, commander: u.commander,
    q: u.q, r: u.r, troops: u.troops, troopsStart: u.troopsStart, morale: u.morale, health: u.health,
    stats: u.officer.stats, aptitude: APT_MULT[rank], aptitudeRank: rank, routed: u.routed, confused: u.confused,
    taunted: u.taunted, onFire: !!c && c.burn > 0, moved: u.moved, movePoints: MOVE_POINTS[u.type],
    range: maxRange(state, u), tactics: knownTacticsOf(u), canChallenge: canChallenge(state, u).length > 0,
    initiative: initiativeOf(u), isPlayer: isPlayerUnit(state, u.id), terrain: c ? c.terrain : 'plain',
  }
}

export function hexAt(state: BattleState, q: number, r: number): HexView | null {
  const c = cellAt(state, q, r)
  if (!c) return null
  const info = TERRAIN[c.terrain]
  const broken = isBrokenGate(c)
  const mc = (t: 'spear' | 'cavalry' | 'archer'): number | null => {
    if (c.terrain === 'gate') return broken ? 1 : null
    return info.cost ? info.cost[t] : null
  }
  return {
    q, r, terrain: c.terrain, name: info.name, defence: terrainDef(c),
    moveCost: { spear: mc('spear'), cavalry: mc('cavalry'), archer: mc('archer') },
    passable: mc('spear') !== null, burning: c.burn, burnable: info.burns,
    gateHp: c.terrain === 'gate' ? c.gateHp : null, gateMax: c.terrain === 'gate' ? c.gateMax : null,
    unit: unitAt(state, q, r)?.id ?? null,
  }
}

export function gateHp(state: BattleState): { q: number; r: number; hp: number; max: number; broken: boolean }[] {
  const out: { q: number; r: number; hp: number; max: number; broken: boolean }[] = []
  for (let i = 0; i < state.hexes.length; i++) {
    const c = state.hexes[i]!
    if (c.terrain !== 'gate') continue
    const col = i % 15
    const row = Math.floor(i / 15)
    const q = col - (row - (row & 1)) / 2
    out.push({ q, r: row, hp: c.gateHp, max: c.gateMax, broken: c.gateHp <= 0 })
  }
  return out
}

export function outcome(state: BattleState): BattleOutcome | null {
  return state.outcome
}

export const query = {
  moveRange, movePath, attackTargets, attackPreview, tacticTargets, tacticPreview, initiative, outcome,
  activeUnit, unitView, hexAt, gateHp, knownTactics, isPlayerUnit, canChallenge,
}

/** The outcome of an ended battle; for a battle still in progress, the outcome if the defender simply held (not stored). */
export function outcomeOf(state: BattleState): BattleOutcome {
  return state.outcome ?? buildOutcome(state, 'defender', 'time')
}
