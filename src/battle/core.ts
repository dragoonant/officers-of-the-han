// Shared rule helpers: lookups, movement reach, damage maths. Pure; no RNG here (previews never touch it).
import type { BattleSide } from '../contracts/battle'
import { clamp } from '../shared/rng'
import { FIELD_COLS, FIELD_ROWS, hexDistance, hexIndex, indexToHex, neighbors, type Hex } from './hex'
import { TERRAIN, MOVE_POINTS } from './terrain'
import { APT_MULT, type BattleState, type BUnit, type HexCell, type TacticId } from './types'

export const other = (s: BattleSide): BattleSide => (s === 'attacker' ? 'defender' : 'attacker')

export function unitById(state: BattleState, id: string): BUnit | undefined {
  return state.units.find((u) => u.id === id)
}
export const alive = (u: BUnit): boolean => !u.routed

export function unitAt(state: BattleState, q: number, r: number): BUnit | undefined {
  return state.units.find((u) => !u.routed && u.q === q && u.r === r)
}

export function cellAt(state: BattleState, q: number, r: number): HexCell | null {
  const i = hexIndex(q, r)
  return i < 0 ? null : (state.hexes[i] ?? null)
}

export function enemiesOf(state: BattleState, u: BUnit): BUnit[] {
  return state.units.filter((e) => !e.routed && e.side !== u.side)
}
export function alliesOf(state: BattleState, u: BUnit): BUnit[] {
  return state.units.filter((e) => !e.routed && e.side === u.side && e.id !== u.id)
}

export function isBrokenGate(c: HexCell): boolean {
  return c.terrain === 'gate' && c.gateHp <= 0
}

/** Move cost of entering a cell for a troop type; null = impassable. */
export function enterCost(c: HexCell, type: BUnit['type']): number | null {
  if (c.terrain === 'gate') return c.gateHp <= 0 ? 1 : null
  const info = TERRAIN[c.terrain]
  return info.cost ? info.cost[type] : null
}

export function terrainDef(c: HexCell): number {
  return TERRAIN[c.terrain].def
}
export const burnable = (c: HexCell): boolean => TERRAIN[c.terrain].burns

export interface ReachNode {
  q: number
  r: number
  cost: number
  prev: number // index of previous node, -1 for the start
}

/** B-TURN-2/3: hexes reachable within the unit's movement points, from (fromQ, fromR). Excludes the start hex. */
export function reach(state: BattleState, u: BUnit, fromQ = u.q, fromR = u.r): Map<number, ReachNode> {
  const mp = MOVE_POINTS[u.type]
  const occ = new Set<number>()
  for (const o of state.units) if (!o.routed && o.id !== u.id) occ.add(hexIndex(o.q, o.r))
  const zoc = new Set<number>()
  for (const o of state.units) {
    if (o.routed || o.side === u.side) continue
    for (const n of neighbors(o.q, o.r)) {
      const i = hexIndex(n.q, n.r)
      if (i >= 0) zoc.add(i)
    }
  }
  const startI = hexIndex(fromQ, fromR)
  const best = new Map<number, ReachNode>()
  best.set(startI, { q: fromQ, r: fromR, cost: 0, prev: -1 })
  const open: number[] = [startI]
  const done = new Set<number>()
  while (open.length) {
    let bi = 0
    for (let k = 1; k < open.length; k++) {
      const a = best.get(open[k]!)!
      const b = best.get(open[bi]!)!
      if (a.cost < b.cost || (a.cost === b.cost && open[k]! < open[bi]!)) bi = k
    }
    const ci = open.splice(bi, 1)[0]!
    if (done.has(ci)) continue
    done.add(ci)
    const cur = best.get(ci)!
    if (ci !== startI && zoc.has(ci)) continue // must stop here (B-TURN-3)
    for (const n of neighbors(cur.q, cur.r)) {
      const ni = hexIndex(n.q, n.r)
      if (ni < 0 || occ.has(ni) || done.has(ni)) continue
      const c = state.hexes[ni]
      if (!c) continue
      const ec = enterCost(c, u.type)
      if (ec === null) continue
      const nc = cur.cost + ec
      if (nc > mp) continue
      const old = best.get(ni)
      if (!old || nc < old.cost) {
        best.set(ni, { q: n.q, r: n.r, cost: nc, prev: ci })
        open.push(ni)
      }
    }
  }
  best.delete(startI)
  return best
}

export function pathTo(nodes: Map<number, ReachNode>, q: number, r: number): Hex[] {
  const out: Hex[] = []
  let i = hexIndex(q, r)
  while (i >= 0) {
    const n = nodes.get(i)
    if (!n) break
    out.push({ q: n.q, r: n.r })
    i = n.prev
  }
  return out.reverse()
}

// ---- attack maths (B-DMG-1) -------------------------------------------------------------------

export function training(state: BattleState, side: BattleSide): number {
  return side === 'attacker' ? state.setup.attackerTraining : state.setup.defenderTraining
}

export function attackStat(state: BattleState, u: BUnit): number {
  const s = u.officer.stats
  return 0.6 * s.war + 0.4 * s.ldr + 0.3 * training(state, u.side) + 20
}
export function defenseStat(state: BattleState, u: BUnit): number {
  const s = u.officer.stats
  return 0.7 * s.ldr + 0.3 * s.war + 0.3 * training(state, u.side) + 20
}

export function typeEdge(att: BUnit['type'], def: BUnit['type']): number {
  if (att === 'spear' && def === 'cavalry') return 1.25
  if (att === 'cavalry' && def === 'archer') return 1.25
  if (att === 'archer' && def === 'spear') return 1.25
  return 1
}

/** Max range of a unit standing at (q, r): archers 2, 3 from a hill (B-UNIT-2, B-MAP-2). */
export function maxRange(state: BattleState, u: BUnit, q = u.q, r = u.r): number {
  if (u.type !== 'archer') return 1
  const c = cellAt(state, q, r)
  return c && c.terrain === 'hill' ? 3 : 2
}

export interface Mult {
  name: string
  value: number
}
export interface DamageCalc {
  /** damage at roll 1.0, before floor */
  mid: number
  mults: Mult[]
}
export interface CalcOpts {
  attQ?: number
  attR?: number
  defQ?: number
  defR?: number
  range: number
  movedDist?: number
  extra?: number // volley 0.6
  attMorale?: number
  attTroops?: number
}

export function calcDamage(state: BattleState, att: BUnit, def: BUnit, o: CalcOpts): DamageCalc {
  const aq = o.attQ ?? att.q
  const ar = o.attR ?? att.r
  const dq = o.defQ ?? def.q
  const dr = o.defR ?? def.r
  const troops = o.attTroops ?? att.troops
  const morale = o.attMorale ?? att.morale
  const A = attackStat(state, att)
  const D = defenseStat(state, def)
  const mults: Mult[] = []
  mults.push({ name: 'Stat ratio', value: A / D })
  const edge = typeEdge(att.type, def.type)
  if (edge !== 1) mults.push({ name: 'Type edge', value: edge })
  const aa = APT_MULT[att.officer.aptitude[att.type]]
  const ad = APT_MULT[def.officer.aptitude[def.type]]
  if (aa !== 1) mults.push({ name: 'Aptitude (attacker)', value: aa })
  if (ad !== 1) mults.push({ name: 'Aptitude (defender)', value: 1 / ad })
  const cell = cellAt(state, dq, dr)
  const td = cell ? terrainDef(cell) : 1
  if (td !== 1) mults.push({ name: `Terrain (${cell ? TERRAIN[cell.terrain].name : ''})`, value: td })
  let flank = 0
  for (const o2 of state.units) {
    if (o2.routed || o2.side !== att.side || o2.id === att.id) continue
    if (hexDistance(o2.q, o2.r, dq, dr) === 1) flank++
  }
  if (flank > 0) mults.push({ name: 'Surround', value: 1 + 0.1 * flank })
  mults.push({ name: 'Morale', value: 0.75 + morale / 200 })
  if (att.type === 'cavalry' && o.range === 1 && (o.movedDist ?? 0) >= 3) mults.push({ name: 'Momentum', value: 1.3 })
  if (att.officer.oathGroup.length) {
    for (const o2 of state.units) {
      if (o2.routed || o2.side !== att.side || o2.id === att.id) continue
      if (att.officer.oathGroup.includes(o2.officer.id) && hexDistance(o2.q, o2.r, dq, dr) === 1) {
        mults.push({ name: 'Oath bond', value: 1.1 })
        break
      }
    }
  }
  if (o.extra !== undefined && o.extra !== 1) mults.push({ name: 'Volley', value: o.extra })
  void aq
  void ar
  let mid = troops * 0.12
  for (const m of mults) mid *= m.value
  return { mid, mults }
}

export const dmgAt = (calc: DamageCalc, roll: number): number => Math.max(1, Math.floor(calc.mid * roll))
export const rollOf = (x: number): number => 0.9 + 0.2 * x

// ---- tactics ----------------------------------------------------------------------------------

export function knownTactics(u: BUnit): TacticId[] {
  const s = u.officer.stats
  const out: TacticId[] = []
  if (s.int >= 60) out.push('fire')
  if (s.int >= 75) out.push('confuse')
  if (s.war >= 75) out.push('taunt')
  if (s.ldr >= 70) out.push('rally')
  if (u.type === 'archer' && s.ldr >= 50) out.push('volley')
  return out
}

export function tacticChance(user: BUnit, target: BUnit | null): number {
  if (!target) return clamp(40 + user.officer.stats.int / 2, 10, 95)
  return clamp(50 + user.officer.stats.int - target.officer.stats.int, 10, 95)
}

export function idxToHex(i: number): Hex {
  return indexToHex(i)
}
export const FIELD_SIZE = FIELD_COLS * FIELD_ROWS
