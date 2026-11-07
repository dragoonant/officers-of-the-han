// legalActions (20-battle.md §9). The single source of truth step() validates against.
import type { DuelOutcome } from '../contracts/contest'
import { cellAt, enemiesOf, reach, unitById, alive, isBrokenGate } from './core'
import { hexDistance, neighbors } from './hex'
import {
  attackTargetsFrom, canChallenge, knownTactics, tacticTargets, tacticTargetsFrom,
} from './query'
import { TACTICS, type BattleAction, type BattleState, type BUnit } from './types'

export type Kind = BattleAction['kind']

/** Gates an attacker unit may hit from where it stands (B-SIEGE-1). */
export function gateTargets(state: BattleState, u: BUnit): { q: number; r: number }[] {
  if (u.side !== 'attacker' || u.routed) return []
  const out: { q: number; r: number }[] = []
  for (const n of neighbors(u.q, u.r)) {
    const c = cellAt(state, n.q, n.r)
    if (c && c.terrain === 'gate' && !isBrokenGate(c)) out.push({ q: n.q, r: n.r })
  }
  return out
}

/** B-TURN-4. Returns null when the unit is not (effectively) taunted. */
export function tauntInfo(state: BattleState, u: BUnit): { taunter: BUnit; canAttackNow: boolean; attackHexes: Set<string>; closerOnly: boolean } | null {
  if (!u.taunted) return null
  const t = unitById(state, u.taunted)
  if (!t || !alive(t)) return null
  const canAttackNow = attackTargetsFrom(state, u, u.q, u.r).some((x) => x.target === t.id)
  const attackHexes = new Set<string>()
  if (!u.moved) {
    for (const n of reach(state, u).values()) {
      if (attackTargetsFrom(state, u, n.q, n.r).some((x) => x.target === t.id)) attackHexes.add(`${n.q},${n.r}`)
    }
  }
  return { taunter: t, canAttackNow, attackHexes, closerOnly: !canAttackNow && attackHexes.size === 0 }
}

export function retreatAction(state: BattleState): BattleAction[] {
  return state.playerSide ? [{ kind: 'retreat', side: state.playerSide }] : []
}

/** Legal actions of one kind for the active unit. */
export function legalOfKind(state: BattleState, u: BUnit, kind: Kind): BattleAction[] {
  const out: BattleAction[] = []
  const taunt = tauntInfo(state, u)
  const forced = !!taunt && (taunt.canAttackNow || taunt.attackHexes.size > 0)
  switch (kind) {
    case 'wait':
      if (!forced) out.push({ kind: 'wait', unit: u.id }) // B-TURN-4: a taunted unit that can attack must
      break
    case 'undoMove':
      if (u.moved && !u.acted) out.push({ kind: 'undoMove', unit: u.id })
      break
    case 'move': {
      if (u.moved) break
      const dNow = taunt ? hexDistance(u.q, u.r, taunt.taunter.q, taunt.taunter.r) : 0
      for (const n of reach(state, u).values()) {
        if (taunt) {
          if (taunt.canAttackNow) continue // must attack from where it stands
          if (forced) {
            if (!taunt.attackHexes.has(`${n.q},${n.r}`)) continue
          } else if (hexDistance(n.q, n.r, taunt.taunter.q, taunt.taunter.r) >= dNow) continue
        }
        out.push({ kind: 'move', unit: u.id, q: n.q, r: n.r })
      }
      break
    }
    case 'attack':
      for (const t of attackTargetsFrom(state, u, u.q, u.r)) {
        if (taunt && forced && t.target !== taunt.taunter.id) continue
        out.push({ kind: 'attack', unit: u.id, target: t.target })
      }
      break
    case 'attackGate':
      if (forced) break
      for (const g of gateTargets(state, u)) out.push({ kind: 'attackGate', unit: u.id, q: g.q, r: g.r })
      break
    case 'tactic':
      if (forced) break
      for (const tac of TACTICS) {
        if (!knownTactics(state, u.id).includes(tac)) continue
        for (const t of tacticTargets(state, u.id, tac)) out.push({ kind: 'tactic', unit: u.id, tactic: tac, q: t.q, r: t.r })
      }
      break
    case 'challenge':
      if (forced) break
      for (const id of canChallenge(state, u)) out.push({ kind: 'challenge', unit: u.id, target: id })
      break
    default:
      break
  }
  return out
}

export function canonicalDuelResult(state: BattleState): DuelOutcome | null {
  const p = state.pendingDuel
  if (!p) return null
  return { duelId: p.id, winner: null, how: 'draw', rounds: 0, vigorLeft: { a: 0, b: 0 } }
}

export function legalActions(state: BattleState): BattleAction[] {
  if (state.outcome) return []
  if (state.pendingDuel) {
    const r = canonicalDuelResult(state)!
    return [{ kind: 'duelResolved', result: r }, ...retreatAction(state)]
  }
  const u = state.active ? unitById(state, state.active) : undefined
  if (!u) return [...retreatAction(state)]
  const out: BattleAction[] = []
  for (const k of ['wait', 'undoMove', 'attack', 'attackGate', 'tactic', 'challenge', 'move'] as Kind[]) out.push(...legalOfKind(state, u, k))
  if (out.length === 0) out.push({ kind: 'wait', unit: u.id }) // defensive: never empty
  out.push(...retreatAction(state))
  return out
}

export { enemiesOf, tacticTargetsFrom }
