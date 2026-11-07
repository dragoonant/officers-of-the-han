// FROZEN CONTRACT (M0, 2026-11-07). Duel and debate setups/outcomes (docs/spec/30-duel-debate.md). Plain JSON only.
import type { Stats, Temperament } from './data'

export interface Contestant {
  id: string
  name: string
  stats: Stats
  temperament: Temperament
  health: number
  portrait?: string
  /** True when the player chooses for this side. At most one side is the player. */
  player: boolean
}

export interface DuelSetup {
  id: string
  seed: number
  a: Contestant // challenger
  b: Contestant
  inBattle: boolean // D-DUEL-7 vs B-DUEL-3
}

export interface DuelOutcome {
  duelId: string
  winner: 'a' | 'b' | null // null = draw
  how: 'knockout' | 'yield' | 'draw'
  rounds: number
  vigorLeft: { a: number; b: number }
}

export type DebatePurpose = 'recruit' | 'diplomacy' | 'proposal' | 'event' | 'captive'

export interface DebateSetup {
  id: string
  seed: number
  a: Contestant // the asker
  b: Contestant // the asked (the defender, wins ties: D-DEB-6)
  purpose: DebatePurpose
  composureBonus: { a: number; b: number } // fractions, e.g. 0.1 = +10% (D-DEB-7)
}

export interface DebateOutcome {
  debateId: string
  winner: 'a' | 'b'
  rounds: number
  composureLeft: { a: number; b: number }
}
