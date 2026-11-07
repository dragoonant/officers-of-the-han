import type { WorldState } from '../../contracts/world'
import { GAME_DATA } from '../../data'

const OFF = new Map(GAME_DATA.officers.map((o) => [o.id, o]))
const CITIES = new Map(GAME_DATA.cities.map((c) => [c.id, c]))

export function nameOf(s: WorldState, id: string): string {
  return s.officers[id]?.custom?.name ?? OFF.get(id)?.name ?? id
}
export const cityNameOf = (id: string | null | undefined): string => (id ? CITIES.get(id)?.name ?? id : 'nowhere')
export function factionNameOf(s: WorldState, id: string | null): string {
  return id ? s.factions[id]?.name ?? id : 'No house'
}
export function colorOf(s: WorldState, factionId: string | null | undefined): number | null {
  return factionId ? s.factions[factionId]?.color ?? null : null
}
export function portraitOf(s: WorldState, id: string): string | undefined {
  return s.officers[id]?.custom?.portrait ?? OFF.get(id)?.portrait
}
