// Battle engine types (20-battle.md). Plain JSON only. Contracts: src/contracts/battle.ts.
import type { Aptitude, TroopType } from '../contracts/data'
import type { BattleOfficer, BattleOutcome, BattleSetup, BattleSide, DuelRecord } from '../contracts/battle'
import type { DuelOutcome, DuelSetup } from '../contracts/contest'
import type { RngState } from '../shared/rng'

export type Terrain =
  | 'plain' | 'grass' | 'forest' | 'hill' | 'mountain' | 'river' | 'ford'
  | 'marsh' | 'road' | 'wall' | 'gate' | 'keep' | 'town' | 'ash'

export type TacticId = 'fire' | 'confuse' | 'taunt' | 'rally' | 'volley'

export interface HexCell {
  terrain: Terrain
  /** Days of burning left (0 = not burning). B-TAC-FIRE */
  burn: number
  /** Unit id credited for a fire (merit), or null. */
  burnBy: string | null
  /** Gate HP (only meaningful for terrain 'gate'); 0 = broken. */
  gateHp: number
  gateMax: number
}

export interface BUnit {
  id: string // unique in the battle; equals officer.id unless a duplicate garrison id had to be renamed
  officer: BattleOfficer
  side: BattleSide
  type: TroopType
  commander: boolean
  troopsStart: number
  troops: number
  morale: number
  health: number
  q: number
  r: number
  routed: boolean
  captured: boolean
  slain: boolean
  wounded: number
  merit: number // kills*50 + duel wins*100 accrued here; the rest is added at the end (B-OUT-1)
  kills: number
  duelWins: number
  // per-turn state
  moved: boolean
  movedDist: number // hex distance start -> end of this turn's move (momentum)
  fromQ: number
  fromR: number
  acted: boolean
  confused: boolean
  taunted: string | null // id of the taunter
}

export interface BattleState {
  setup: BattleSetup
  rng: RngState
  day: number // 1-based
  hexes: HexCell[] // row-major, 15 x 11, odd-r offset
  units: BUnit[]
  order: string[] // unit ids acting today, in initiative order
  cursor: number // index in order of the active unit
  active: string | null // id of the unit whose turn it is (null once ended)
  pendingDuel: (DuelSetup & { challenger: string; target: string }) | null
  duels: DuelRecord[]
  outcome: BattleOutcome | null
  playerSide: BattleSide | null
  actionCount: number
}

export type BattleAction =
  | { kind: 'move'; unit: string; q: number; r: number }
  | { kind: 'undoMove'; unit: string }
  | { kind: 'attack'; unit: string; target: string }
  | { kind: 'attackGate'; unit: string; q: number; r: number }
  | { kind: 'tactic'; unit: string; tactic: TacticId; q: number; r: number }
  | { kind: 'challenge'; unit: string; target: string }
  | { kind: 'duelResolved'; result: DuelOutcome }
  | { kind: 'wait'; unit: string }
  | { kind: 'retreat'; side: BattleSide }

export type BattleEvent =
  | { kind: 'dayStart'; day: number; order: string[] }
  | { kind: 'turnStart'; unit: string }
  | { kind: 'move'; unit: string; path: { q: number; r: number }[] }
  | { kind: 'undoMove'; unit: string }
  | { kind: 'attack'; unit: string; target: string; range: number; damage: number; counter: number; killed: boolean }
  | { kind: 'gate'; unit: string; q: number; r: number; damage: number; hp: number; broken: boolean }
  | { kind: 'tactic'; unit: string; tactic: TacticId; q: number; r: number; success: boolean; chance: number }
  | { kind: 'volley'; unit: string; target: string; damage: number }
  | { kind: 'burn'; unit: string; troops: number; morale: number }
  | { kind: 'ignite'; q: number; r: number }
  | { kind: 'ash'; q: number; r: number }
  | { kind: 'confusedSkip'; unit: string }
  | { kind: 'challenge'; unit: string; target: string; accepted: boolean }
  | { kind: 'duel'; a: string; b: string; winner: string | null; how: DuelOutcome['how']; slain: string | null }
  | { kind: 'rout'; unit: string; reason: 'troops' | 'morale' | 'slain'; captured: boolean }
  | { kind: 'morale'; unit: string; delta: number }
  | { kind: 'wait'; unit: string }
  | { kind: 'end'; winner: BattleSide; reason: BattleOutcome['reason'] }

export type RejectCode =
  | 'ended' | 'bad-action' | 'not-active' | 'pending-duel' | 'no-duel' | 'bad-target'
  | 'out-of-range' | 'already-moved' | 'already-acted' | 'not-moved' | 'blocked'
  | 'unknown-tactic' | 'cannot' | 'bad-result' | 'internal'

export type StepResult =
  | { ok: true; state: BattleState; events: BattleEvent[] }
  | { ok: false; code: RejectCode; message: string }

export const TACTICS: readonly TacticId[] = ['fire', 'confuse', 'taunt', 'rally', 'volley']
export const APT_MULT: Record<Aptitude, number> = { A: 1.1, B: 1.0, C: 0.85 }
