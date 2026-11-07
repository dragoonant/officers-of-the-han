// A player-facing line for EVERY battle event kind (tests/unit/client/eventLines.test.ts fails on a kind without one).
import { TERRAIN } from '../../battle/terrain'
import type { BattleEvent, TacticId } from '../../battle/types'

export const TACTIC_NAME: Record<TacticId, string> = { fire: 'Fire', confuse: 'Confuse', taunt: 'Taunt', rally: 'Rally', volley: 'Volley' }

export interface LineCtx {
  /** Display name of a unit id (or officer id). */
  name(id: string): string
  /** Terrain name at a hex, optional. */
  terrainAt?(q: number, r: number): string | undefined
}

type Lines = { [K in BattleEvent['kind']]: (e: Extract<BattleEvent, { kind: K }>, c: LineCtx) => string }

export const LINES: Lines = {
  dayStart: (e) => `Day ${e.day} begins.`,
  turnStart: (e, c) => `${c.name(e.unit)} takes the field.`,
  move: (e, c) => `${c.name(e.unit)} moves ${Math.max(1, e.path.length - 1)} ${e.path.length === 2 ? 'hex' : 'hexes'}.`,
  undoMove: (e, c) => `${c.name(e.unit)} takes the move back.`,
  attack: (e, c) =>
    `${c.name(e.unit)} ${e.range > 1 ? 'shoots' : 'strikes'} ${c.name(e.target)} for ${e.damage}${e.counter > 0 ? ` and takes ${e.counter} in return` : ''}.${e.killed ? ` ${c.name(e.target)}'s troops are gone.` : ''}`,
  gate: (e, c) => `${c.name(e.unit)} batters the gate for ${e.damage}. ${e.broken ? 'The gate breaks open.' : `${e.hp} strength left.`}`,
  tactic: (e, c) => {
    const n = c.name(e.unit)
    const where = c.terrainAt?.(e.q, e.r)
    switch (e.tactic) {
      case 'fire': return e.success ? `${n} sets the ${where ?? 'ground'} alight.` : `${n} tries to light a fire, but it will not catch (${e.chance}%).`
      case 'confuse': return e.success ? `${n} throws the enemy into confusion; they will lose their next turn.` : `${n}'s confusion fails (${e.chance}%).`
      case 'taunt': return e.success ? `${n} taunts the enemy; they must charge ${n}.` : `${n}'s taunt is ignored (${e.chance}%).`
      case 'rally': return `${n} rallies the troops nearby (+15 morale).`
      case 'volley': return `${n} calls a volley.`
    }
  },
  volley: (e, c) => `The volley hits ${c.name(e.target)} for ${e.damage}.`,
  burn: (e, c) => `${c.name(e.unit)} burns: ${e.troops} troops and ${e.morale} morale lost.`,
  ignite: (e) => `Fire spreads to a new hex (${e.q}, ${e.r}).`,
  ash: (e) => `The fire at (${e.q}, ${e.r}) dies down to ash.`,
  confusedSkip: (e, c) => `${c.name(e.unit)} is confused and loses the turn.`,
  challenge: (e, c) => (e.accepted ? `${c.name(e.unit)} challenges ${c.name(e.target)}, who accepts.` : `${c.name(e.unit)} challenges ${c.name(e.target)}, who refuses and loses 15 morale.`),
  duel: (e, c) => {
    if (!e.winner) return `The duel between ${c.name(e.a)} and ${c.name(e.b)} ends in a draw.`
    const loser = e.winner === e.a ? e.b : e.a
    return `${c.name(e.winner)} wins the duel over ${c.name(loser)} by ${e.how === 'yield' ? 'yielding' : 'knockout'}.${e.slain ? ` ${c.name(e.slain)} is slain.` : ''}`
  },
  rout: (e, c) => {
    const why = e.reason === 'troops' ? 'loses all its troops' : e.reason === 'morale' ? 'breaks and flees' : 'is slain'
    return `${c.name(e.unit)} ${why}${e.captured ? ' and is captured' : ''}.`
  },
  morale: (e, c) => `${c.name(e.unit)} ${e.delta < 0 ? 'loses' : 'gains'} ${Math.abs(e.delta)} morale.`,
  wait: (e, c) => `${c.name(e.unit)} waits.`,
  end: (e) => `The battle is over: the ${e.winner} wins (${REASON[e.reason]}).`,
}

const REASON: Record<string, string> = {
  'commander-routed': 'the enemy commander routed',
  'all-routed': 'every enemy unit routed',
  'keep-taken': 'the keep is taken',
  time: 'time ran out',
  retreat: 'the enemy retreated',
}

export function eventLine(e: BattleEvent, c: LineCtx): string {
  const f = LINES[e.kind] as (e: BattleEvent, c: LineCtx) => string
  return f(e, c)
}

export const terrainName = (t: keyof typeof TERRAIN): string => TERRAIN[t].name.toLowerCase()
