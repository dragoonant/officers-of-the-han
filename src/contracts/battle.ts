// FROZEN CONTRACT (M0, 2026-11-07). The seam between the world (src/world) and the hex battle (src/battle).
// docs/spec/20-battle.md. Plain JSON only.
import type { Aptitude, RoadTerrain, Stats, Temperament, TroopType } from './data'

export type BattleSide = 'attacker' | 'defender'

/** An officer as the battle sees them: a snapshot, so the battle never reads world state. */
export interface BattleOfficer {
  id: string // officer id, or "garrison-<city>" for a W-WAR-3 garrison
  name: string
  stats: Stats
  temperament: Temperament
  aptitude: Record<TroopType, Aptitude>
  health: number
  oathGroup: string[] // ids of oath siblings (excluding self), for B-DMG-1 "oath bond"
  portrait?: string
}

export interface BattleUnitSetup {
  officer: BattleOfficer
  side: BattleSide
  troops: number
  type: TroopType
  commander: boolean
}

export interface BattleSetup {
  id: string // unique per battle in a world, e.g. "190-03-a1"
  seed: number
  attackerFaction: string | null // null for an uprising's rebels
  defenderFaction: string | null
  cityId: string
  cityName: string
  terrain: RoadTerrain // the road's terrain (B-MAP-3)
  siege: true // v0.1: every battle is a siege (20-battle.md B-MAP-3)
  walls: number // B-SIEGE-1
  attackerTraining: number // B-UNIT-5
  defenderTraining: number
  maxDays: number // 20
  units: BattleUnitSetup[]
  /** Officer ids the player controls. Empty for AI-vs-AI (benches). The client also uses it to know the player's side. */
  playerControls: string[]
}

export interface BattleUnitResult {
  officer: string
  side: BattleSide
  troopsStart: number
  troopsEnd: number // 0 if routed by troop loss
  routed: boolean
  captured: boolean
  slain: boolean
  wounded: number // health lost in duels
  merit: number
}

export interface DuelRecord {
  a: string // challenger officer id
  b: string
  winner: string | null // null = draw
  slain: string | null
}

export interface BattleOutcome {
  battleId: string
  winner: BattleSide
  reason: 'commander-routed' | 'all-routed' | 'keep-taken' | 'time' | 'retreat'
  days: number
  units: BattleUnitResult[]
  duels: DuelRecord[]
}
