// Small pure helpers for the world client (no engine rules here: numbers come from query.*).
import type { Mission } from '../../contracts/world'

export const cap = (s: string): string => (s ? s[0]!.toUpperCase() + s.slice(1) : s)
export const money = (n: number): string => n.toLocaleString('en-US')

/** "10 days" / "1 day" plus "20 gold" when it costs gold. */
export function costText(days: number, gold: number): string {
  const d = `${days} ${days === 1 ? 'day' : 'days'}`
  return gold > 0 ? `${d}, ${gold} gold` : d
}

export function chanceText(pct: number | null | undefined, what?: string): string | null {
  if (pct === null || pct === undefined) return null
  return what ? `${pct}% ${what}` : `${pct}%`
}

export const TEMPERAMENT_TEXT: Record<string, string> = {
  righteous: 'Righteous', ambitious: 'Ambitious', cautious: 'Cautious', reckless: 'Reckless', steady: 'Steady',
}
export const TROOP_TEXT: Record<string, string> = { spear: 'Spear', cavalry: 'Cavalry', archer: 'Archer' }

export const missionKinds = ['develop', 'recruit', 'scout', 'envoy'] as const
export type MissionKind = Mission['kind']
