// Battle AI (20-battle.md). A utility AI: every (destination hex, action) pair scores
//   expected damage dealt - expected damage taken next turn + positional value (the keep and gates for attackers,
//   the walls for defenders) + tactic values (fire, confuse, taunt, rally, volley) + duel value.
// Deterministic: no randomness; ties go to the earlier option in enumeration order (stay put first, then reach order,
// attacks, gate, tactics, challenge, wait). `chooseRandomAction` is the bench's weak tier (a seeded uniform pick).
import type { BattleSide } from '../../contracts/battle'
import { clamp, nextFloat, seedRng } from '../../shared/rng'
import {
  alive, calcDamage, cellAt, dmgAt, enemiesOf, alliesOf, enterCost, isBrokenGate, maxRange, reach, tacticChance, unitById,
} from '../../battle/core'
import { KEEP_COL, KEEP_ROW, WALL_COL, GATE_ROWS } from '../../battle/field'
import { hexDistance, hexIndex, hexesWithin, neighbors, offsetToAxial, axialToOffset } from '../../battle/hex'
import { gateTargets, legalActions, legalOfKind, tauntInfo } from '../../battle/legal'
import { attackTargetsFrom, canChallenge, tacticTargetsFrom, volleyVictims } from '../../battle/query'
import { MOVE_POINTS } from '../../battle/terrain'
import type { BattleAction, BattleState, BUnit, TacticId } from '../../battle/types'

const other = (s: BattleSide): BattleSide => (s === 'attacker' ? 'defender' : 'attacker')

// ---- tuning -----------------------------------------------------------------------------------
const W_EXPOSURE = 0.3 // share of the damage an enemy could do to us next turn that we count
const W_PROGRESS = 14 // attackers: per move-cost step toward the goal
const W_HOLD = 10 // defenders: per move-cost step away from their post
const COMMANDER_RISK = 2.5
const KILL_BONUS = 0.5 // times the victim's troops
const COMMANDER_KILL = 6000

// ---- distance fields --------------------------------------------------------------------------

/** Cost-to-goal for every hex (spear costs, units ignored); Infinity where unreachable. */
function costField(state: BattleState, goals: number[]): number[] {
  const dist = new Array<number>(state.hexes.length).fill(Infinity)
  const open: number[] = []
  for (const g of goals) {
    if (g >= 0) { dist[g] = 0; open.push(g) }
  }
  while (open.length) {
    let bi = 0
    for (let k = 1; k < open.length; k++) if (dist[open[k]!]! < dist[open[bi]!]!) bi = k
    const m = open.splice(bi, 1)[0]!
    const mc = state.hexes[m]!
    const ec = enterCost(mc, 'spear')
    if (ec === null) continue
    const ax = offsetToAxial(m % 15, Math.floor(m / 15))
    for (const n of neighbors(ax.q, ax.r)) {
      const ni = hexIndex(n.q, n.r)
      if (ni < 0) continue
      const nd = dist[m]! + ec
      if (nd < dist[ni]!) { dist[ni] = nd; open.push(ni) }
    }
  }
  return dist
}

interface Ctx {
  state: BattleState
  u: BUnit
  sealed: boolean
  anyBroken: boolean
  goal: number[] // cost field for this unit
}

function gateIndices(state: BattleState): { idx: number; row: number; broken: boolean }[] {
  return GATE_ROWS.map((row) => {
    const idx = row * 15 + WALL_COL
    return { idx, row, broken: isBrokenGate(state.hexes[idx]!) }
  })
}

function makeCtx(state: BattleState, u: BUnit): Ctx {
  const gates = gateIndices(state)
  const anyBroken = gates.some((g) => g.broken)
  let goals: number[] = []
  if (u.side === 'attacker') {
    if (anyBroken) goals = [hexIndex(offsetToAxial(KEEP_COL, KEEP_ROW).q, KEEP_ROW)]
    else {
      for (const g of gates) {
        const ax = offsetToAxial(WALL_COL, g.row)
        for (const n of neighbors(ax.q, ax.r)) {
          const i = hexIndex(n.q, n.r)
          if (i >= 0 && i % 15 < WALL_COL && enterCost(state.hexes[i]!, 'spear') !== null) goals.push(i)
        }
      }
    }
  } else {
    for (const g of gates) {
      const ax = offsetToAxial(WALL_COL, g.row)
      for (const n of neighbors(ax.q, ax.r)) {
        const i = hexIndex(n.q, n.r)
        if (i >= 0 && i % 15 > WALL_COL) goals.push(i)
      }
    }
  }
  return { state, u, sealed: !anyBroken, anyBroken, goal: costField(state, goals) }
}

// ---- scoring ----------------------------------------------------------------------------------

const sideOfWall = (q: number, r: number): -1 | 0 | 1 => {
  const col = axialToOffset(q, r).col
  return col < WALL_COL ? -1 : col > WALL_COL ? 1 : 0
}

/** Expected damage enemies could do to `u` standing at (q, r) next turn, weighted. */
function exposure(c: Ctx, q: number, r: number, skip: Set<string>): number {
  const { state, u } = c
  let total = 0
  const mySide = sideOfWall(q, r)
  for (const e of enemiesOf(state, u)) {
    if (skip.has(e.id)) continue
    const d = hexDistance(e.q, e.r, q, r)
    const mr = maxRange(state, e)
    const mp = MOVE_POINTS[e.type]
    if (c.sealed && sideOfWall(e.q, e.r) !== mySide) {
      // across a closed wall only archers matter, and only if they can come within range
      if (e.type !== 'archer' || d > mr + 2) continue
    } else if (d > mp + mr) continue
    const range = Math.max(1, Math.min(mr, d))
    const calc = calcDamage(state, e, u, { attQ: e.q, attR: e.r, defQ: q, defR: r, range, movedDist: Math.min(d, 3) })
    total += calc.mid * (range === 1 ? 1 : 0.9)
  }
  return total * W_EXPOSURE * (u.commander ? COMMANDER_RISK : 1)
}

function killValue(t: BUnit, dmg: number, extraMoraleLoss: number): number {
  const dead = dmg >= t.troops || t.morale - extraMoraleLoss <= 0
  if (!dead) return 0
  return t.troops * KILL_BONUS + 200 + (t.commander ? COMMANDER_KILL : 0)
}

function attackScore(c: Ctx, tId: string, fq: number, fr: number, movedDist: number, range: number): number {
  const { state, u } = c
  const t = unitById(state, tId)!
  const calc = calcDamage(state, u, t, { attQ: fq, attR: fr, range, movedDist })
  const dmg = Math.min(dmgAt(calc, 1), t.troops)
  const moraleLoss = Math.ceil((25 * dmg) / Math.max(1, t.troops))
  let s = dmg + killValue(t, dmg, moraleLoss) + moraleLoss * t.troops * 0.004
  if (range === 1 && dmg < t.troops && t.morale - moraleLoss > 0) {
    const cc = calcDamage(state, t, { ...u, q: fq, r: fr }, { range: 1, defQ: fq, defR: fr, attTroops: t.troops - dmg })
    s -= cc.mid * 0.5 * (u.commander ? COMMANDER_RISK : 1)
  }
  if (t.commander && state.units.filter((x) => x.side === t.side && alive(x)).length > 0) s += dmg * 0.5 // pressure the commander
  return s
}

function gateScore(c: Ctx, q: number, r: number): number {
  const { state, u } = c
  const cell = cellAt(state, q, r)
  if (!cell) return -1
  let dmg = Math.floor(u.troops * 0.05 * (0.5 + u.officer.stats.ldr / 100) * (u.type === 'spear' ? 1.5 : 1))
  dmg = Math.max(1, dmg)
  const real = Math.min(dmg, cell.gateHp)
  let s = 150 + real * 2.5
  if (dmg >= cell.gateHp) s += 500 // breaking a gate opens the way to the keep
  // prefer the gate nearest to the keep row / already damaged
  s += (1 - cell.gateHp / Math.max(1, cell.gateMax)) * 120
  return s
}

function tacticScore(c: Ctx, tac: TacticId, q: number, r: number, fq: number, fr: number, chancePct: number): number {
  const { state, u } = c
  const p = chancePct / 100
  if (tac === 'fire') {
    let enemy = 0
    let friend = 0
    const occ = state.units.find((x) => !x.routed && x.q === q && x.r === r)
    if (occ) enemy += occ.troops * 0.2 + 30
    for (const n of neighbors(q, r)) {
      const o = state.units.find((x) => !x.routed && x.q === n.q && x.r === n.r)
      if (!o) continue
      const cell = cellAt(state, n.q, n.r)
      if (!cell || !['plain', 'grass', 'forest'].includes(cell.terrain)) continue
      if (o.side === u.side) friend += o.troops * 0.2 * 0.4
      else enemy += o.troops * 0.2 * 0.4
    }
    if (hexDistance(fq, fr, q, r) <= 1 && u.type !== 'archer') friend += u.troops * 0.1 // we would be next to the flames
    if (enemy <= friend) return -1
    return p * (enemy - friend)
  }
  const occ = state.units.find((x) => !x.routed && x.q === q && x.r === r)
  if (tac === 'confuse' && occ) return p * (occ.troops * 0.1 + (occ.commander ? 150 : 0)) + (occ.troops * 0.02)
  if (tac === 'taunt' && occ) return p * occ.troops * 0.035
  if (tac === 'rally') {
    let s = 0
    const group = [u, ...alliesOf(state, u).filter((a) => hexDistance(a.q, a.r, fq, fr) === 1)]
    for (const a of group) {
      const gain = Math.min(15, 100 - a.morale)
      s += gain * a.troops * 0.0012 * (a.morale < 40 ? 4 : a.morale < 60 ? 2 : 0.4)
    }
    return s
  }
  if (tac === 'volley') {
    let s = 0
    for (const v of volleyVictims(state, { ...u, q: fq, r: fr } as BUnit, q, r)) {
      const calc = calcDamage(state, u, v, { attQ: fq, attR: fr, range: 2, extra: 0.6 })
      const dmg = Math.min(dmgAt(calc, 1), v.troops)
      s += dmg + killValue(v, dmg, Math.ceil((25 * dmg) / Math.max(1, v.troops)))
    }
    return s
  }
  return 0
}

function duelScore(c: Ctx, tId: string): number {
  const { state, u } = c
  const t = unitById(state, tId)!
  const dw = u.officer.stats.war - t.officer.stats.war
  if (dw <= 0 || u.health < 50) return -1
  const refuses = t.officer.temperament !== 'reckless' && t.officer.stats.war < u.officer.stats.war - 10
  if (refuses) return t.troops * 0.05 + (t.commander ? 50 : 0)
  const p = clamp(0.5 + dw / 60, 0.5, 0.9)
  let s = p * (t.troops * 0.12 + 40) - (1 - p) * (u.troops * 0.12 + 40)
  if (t.commander && t.morale <= 40) s += p * 500
  return s
}

/** Where the unit would like to stand, ignoring actions. */
function positionScore(c: Ctx, q: number, r: number): number {
  const { state, u } = c
  const i = hexIndex(q, r)
  const col = axialToOffset(q, r).col
  let s = 0
  if (u.side === 'attacker') {
    if (u.type === 'archer') {
      // get to shooting distance of the nearest enemy, but not into melee
      let nd = Infinity
      for (const e of enemiesOf(state, u)) nd = Math.min(nd, hexDistance(q, r, e.q, e.r))
      const want = c.anyBroken ? 2 : 2
      s -= Math.max(0, nd - want) * W_PROGRESS * 0.8
      const g = c.goal[i]!
      if (nd > 6 && isFinite(g)) s -= g * W_PROGRESS * 0.3
    } else {
      const g = c.goal[i]!
      s -= (isFinite(g) ? g : 60) * W_PROGRESS
    }
    if (cellAt(state, q, r)?.terrain === 'keep') s += 100000
  } else {
    const g = c.goal[i]!
    if (u.type === 'archer') {
      let nd = Infinity
      for (const e of enemiesOf(state, u)) nd = Math.min(nd, hexDistance(q, r, e.q, e.r))
      s -= Math.max(0, nd - 2) * W_HOLD * 0.5
      if (col <= WALL_COL) s -= 80
      if (isFinite(g)) s -= g * W_HOLD * 0.25
    } else {
      s -= (isFinite(g) ? g : 40) * W_HOLD
      if (col <= WALL_COL) s -= 60
    }
    if (u.commander) {
      // the commander stays well behind the line
      s += (col - WALL_COL) * 6
    }
  }
  // terrain: stand on good ground
  const cell = cellAt(state, q, r)
  if (cell) s += (1 - (cell.terrain === 'ford' ? 1.15 : 1) * 0) + (1 - TERR_DEF(cell.terrain)) * 60
  if (cell && cell.burn > 0) s -= u.troops * 0.25
  return s
}

const TERR_DEF = (t: string): number => (({ forest: 0.8, hill: 0.85, ford: 1.15, marsh: 1.1, keep: 0.7, town: 0.85, gate: 0.8 }) as Record<string, number>)[t] ?? 1

interface Plan {
  score: number
  hex: { q: number; r: number } | null
  action: BattleAction | null
}

function considerFrom(
  c: Ctx, fq: number, fr: number, movedDist: number, forcedTarget: string | null, best: Plan, hexMove: { q: number; r: number } | null,
): void {
  const { state, u } = c
  const pos = positionScore(c, fq, fr)
  const killed = new Set<string>()
  const base = pos - exposure(c, fq, fr, killed)
  const consider = (sc: number, action: BattleAction): void => {
    const total = base + sc
    if (total > best.score) { best.score = total; best.hex = hexMove; best.action = action }
  }
  // attacks
  for (const t of attackTargetsFrom(state, u, fq, fr)) {
    if (forcedTarget && t.target !== forcedTarget) continue
    consider(attackScore(c, t.target, fq, fr, movedDist, t.range), { kind: 'attack', unit: u.id, target: t.target })
  }
  if (forcedTarget) return
  // gates (the unit must stand next to it)
  if (u.side === 'attacker') {
    for (const n of neighbors(fq, fr)) {
      const cell = cellAt(state, n.q, n.r)
      if (cell && cell.terrain === 'gate' && !isBrokenGate(cell)) consider(gateScore(c, n.q, n.r), { kind: 'attackGate', unit: u.id, q: n.q, r: n.r })
    }
  }
  // tactics
  const known = ['fire', 'confuse', 'taunt', 'rally', 'volley'] as TacticId[]
  for (const tac of known) {
    if (!u.officer.stats || !tacticKnown(u, tac)) continue
    for (const t of tacticTargetsFrom(state, u, tac, fq, fr)) {
      const sc = tacticScore(c, tac, t.q, t.r, fq, fr, t.chance)
      if (sc > 0) consider(sc, { kind: 'tactic', unit: u.id, tactic: tac, q: t.q, r: t.r })
    }
  }
  // duels
  for (const id of canChallengeFrom(state, u, fq, fr)) {
    const sc = duelScore(c, id)
    if (sc > 0) consider(sc, { kind: 'challenge', unit: u.id, target: id })
  }
  consider(0, { kind: 'wait', unit: u.id })
}

function tacticKnown(u: BUnit, t: TacticId): boolean {
  const s = u.officer.stats
  switch (t) {
    case 'fire': return s.int >= 60
    case 'confuse': return s.int >= 75
    case 'taunt': return s.war >= 75
    case 'rally': return s.ldr >= 70
    case 'volley': return u.type === 'archer' && s.ldr >= 50
  }
}

function canChallengeFrom(state: BattleState, u: BUnit, q: number, r: number): string[] {
  if (u.officer.stats.war < 60 || u.health < 30) return []
  return enemiesOf(state, u).filter((e) => hexDistance(q, r, e.q, e.r) === 1 && e.health > 0).map((e) => e.id)
}

/** The AI's next action for the active unit `unitId`. Always returns a legal action (falls back to wait). */
export function chooseBattleAction(state: BattleState, unitId: string): BattleAction {
  const legal = legalActions(state)
  const fallback = (): BattleAction => {
    const w = legal.find((a) => a.kind === 'wait')
    return w ?? legal.find((a) => a.kind !== 'retreat' && a.kind !== 'undoMove') ?? legal[0] ?? { kind: 'wait', unit: unitId }
  }
  const u = unitById(state, unitId)
  if (!u || u.routed || state.active !== u.id || state.outcome) return fallback()
  const c = makeCtx(state, u)
  const taunt = tauntInfo(state, u)
  const forced = taunt && (taunt.canAttackNow || taunt.attackHexes.size > 0) ? taunt.taunter.id : null
  const best: Plan = { score: -Infinity, hex: null, action: null }
  // stay put (or, already moved, the only option)
  considerFrom(c, u.q, u.r, u.moved ? u.movedDist : 0, forced && taunt!.canAttackNow ? forced : forced, best, null)
  if (!u.moved) {
    const allowed = new Set(legalOfKind(state, u, 'move').map((a) => (a.kind === 'move' ? hexIndex(a.q, a.r) : -1)))
    const nodes = [...reach(state, u).entries()].sort((a, b) => a[0] - b[0])
    for (const [i, n] of nodes) {
      if (!allowed.has(i)) continue
      // a taunted unit that moves must then attack the taunter
      considerFrom(c, n.q, n.r, hexDistance(u.q, u.r, n.q, n.r), forced, best, { q: n.q, r: n.r })
    }
  }
  let pick: BattleAction | null = null
  if (best.hex) pick = { kind: 'move', unit: u.id, q: best.hex.q, r: best.hex.r }
  else pick = best.action
  if (pick && isLegal(legal, pick)) return pick
  // the plan from the current hex may be illegal under a taunt; take any legal attack, else the fallback
  const atk = legal.find((a) => a.kind === 'attack')
  if (atk) return atk
  return fallback()
}

function isLegal(legal: BattleAction[], a: BattleAction): boolean {
  return legal.some((l) => JSON.stringify(l) === JSON.stringify(a))
}

/** Weak bench tier: a seeded uniform pick among the legal actions (never retreat or undo). */
export function chooseRandomAction(state: BattleState, unitId: string): BattleAction {
  const legal = legalActions(state).filter((a) => a.kind !== 'retreat' && a.kind !== 'undoMove')
  if (!legal.length) return { kind: 'wait', unit: unitId }
  const st = seedRng((state.setup.seed ^ Math.imul(state.actionCount + 1, 0x9e3779b1)) >>> 0)
  const u = unitById(state, unitId)
  // after a move any action ends the turn; before it, prefer to act rather than just move half the time
  const pool = u && !u.moved ? legal : legal.filter((a) => a.kind !== 'move')
  const use = pool.length ? pool : legal
  return use[Math.floor(nextFloat(st) * use.length)]!
}

export type AiTier = 'ai' | 'random'
export function chooseAction(state: BattleState, unitId: string, tier: AiTier = 'ai'): BattleAction {
  return tier === 'random' ? chooseRandomAction(state, unitId) : chooseBattleAction(state, unitId)
}

void other
void hexesWithin
void gateTargets
void canChallenge
