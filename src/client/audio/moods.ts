// Which bed the game wants, and which cues its events play. Pure and presentation-only: no rules maths (docs/spec/60-audio.md sections 3 and 4).
import type { CueId, Mood } from './manifest'

export type SceneKind = 'map' | 'battle' | 'duel' | 'debate'

export interface MoodInput {
  screen: 'title' | 'new' | 'game' | 'end'
  /** How the chronicle ended, on the end screen. */
  endKind: string | null
  /** Month 1..12 on the world clock. */
  month: number
  /** An enemy army is on or beside the player's city. */
  warNear: boolean
  /** The full-screen scene on top of the map (a duel inside a battle counts as a duel). */
  scene: SceneKind
  /** A council moment: the Houses or Chronicle panel, or an event, offer, captive or successor letter. */
  court: boolean
  /** The player's side won or lost the battle on screen; null while undecided or when the player took no part. */
  battleResult: 'win' | 'loss' | null
}

export const isWinter = (month: number): boolean => month === 12 || month <= 2

export function moodFor(i: MoodInput): Mood {
  if (i.screen === 'title' || i.screen === 'new') return 'title'
  if (i.screen === 'end') return i.endKind === 'unified' ? 'victory' : 'defeat'
  switch (i.scene) {
    case 'duel':
      return 'duel'
    case 'debate':
      return 'debate'
    case 'battle':
      return i.battleResult === 'win' ? 'victory' : i.battleResult === 'loss' ? 'defeat' : 'battle'
    default:
      if (i.court) return 'court'
      if (i.warNear) return 'war'
      return isWinter(i.month) ? 'winter' : 'peace'
  }
}

/** An army that is not the player's house, marching to or from the player's city or a city next to it. */
export function warNear(
  playerCity: string | null,
  playerFaction: string | null,
  armies: readonly { from: string; to: string; faction: string | null }[],
  neighbours: (city: string) => readonly string[],
): boolean {
  if (!playerCity) return false
  const zone = new Set([playerCity, ...neighbours(playerCity)])
  return armies.some((a) => (playerFaction === null || a.faction !== playerFaction) && (zone.has(a.to) || zone.has(a.from)))
}

// ---- event hooks -------------------------------------------------------------------------------------------------------------------------

export type TroopKind = 'spear' | 'cavalry' | 'archer'
export interface BattleCueResult {
  cues: CueId[]
  /** Lay the charge layer over the bed for this many seconds (a cavalry charge). */
  charge?: number
}
export interface BattleEventLike {
  kind: string
  unit?: string
  range?: number
  tactic?: string
  success?: boolean
}

/** What a battle event sounds like. `typeOf` says what troop a unit is. Only the events with a sound in the spec return cues. */
export function battleCues(ev: BattleEventLike, typeOf: (unit: string) => TroopKind | undefined): BattleCueResult {
  switch (ev.kind) {
    case 'move':
      return { cues: ['march'] }
    case 'attack': {
      const t = ev.unit ? typeOf(ev.unit) : undefined
      if ((ev.range ?? 1) > 1 || t === 'archer') return { cues: ['volley'] }
      if (t === 'cavalry') return { cues: ['charge-hooves', 'clash'], charge: 2.5 }
      return { cues: ['clash'] }
    }
    case 'volley':
      return { cues: ['volley'] }
    case 'gate':
      return { cues: ['wall-hit'] }
    case 'burn':
    case 'ignite':
      return { cues: ['fire'] }
    case 'tactic':
      if (ev.tactic === 'fire') return { cues: ['fire'] }
      if (ev.tactic === 'rally' || ev.tactic === 'taunt') return { cues: ['rally-horn'] }
      return { cues: [] }
    default:
      return { cues: [] }
  }
}

/** The cue for one duel round: a mighty blow, else the stance that landed, else the guard that held. */
export function duelRoundCue(r: { a: string; b: string; dealtByA: number; dealtByB: number }): CueId | null {
  if (r.a === 'yield' || r.b === 'yield') return null
  if (r.a === 'mighty' || r.b === 'mighty') return 'duel-mighty'
  const dealt = r.dealtByA + r.dealtByB
  if (dealt > 0) {
    const winner = r.dealtByA >= r.dealtByB ? r.a : r.b
    return winner === 'feint' ? 'duel-feint' : 'duel-strike'
  }
  return r.a === 'guard' || r.b === 'guard' ? 'duel-guard' : 'duel-feint'
}
