// KB rule 22: one versioned envelope under localStorage['oth-save']. The snapshot is what reopens; the action list rides along.
import type { BattleState } from '../../battle/types'
import type { NewGameOptions, WorldAction, WorldState } from '../../contracts/world'
import { GAME_DATA } from '../../data'
import { world } from '../../world'

export const SAVE_KEY = 'oth-save'
export const SAVE_VERSION = 1

export interface SaveEnvelope {
  version: 1
  savedAt: number
  opts: NewGameOptions
  actions: WorldAction[]
  snapshot: WorldState
  presentation: { battle?: BattleState }
}

export interface SaveLine {
  officer: string
  post: string
  faction: string
  city: string
  when: string
  ym: string
  text: string
}

export type SaveRead =
  | { kind: 'none' }
  | { kind: 'ok'; env: SaveEnvelope; line: SaveLine }
  | { kind: 'corrupt'; reason: string }
  | { kind: 'missing-content'; reason: string }
  | { kind: 'refused'; reason: string }

export type KV = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function browserStorage(): KV | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
export const ymText = (ym: { year: number; month: number }): string => `${MONTHS[ym.month - 1] ?? `Month ${ym.month}`} ${ym.year}`

export function whenText(savedAt: number, now: number = Date.now()): string {
  const s = Math.max(0, Math.round((now - savedAt) / 1000))
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`
  return `${Math.floor(s / 86400)} d ago`
}

/** What Continue shows: officer, post, faction, city, month and year, and when it was saved. */
export function describeSave(env: SaveEnvelope, now: number = Date.now()): SaveLine {
  const sum = world.query.saveSummary(env.snapshot)
  const o = env.snapshot.officers[env.snapshot.player]
  const city = o?.city ? GAME_DATA.cities.find((c) => c.id === o.city)?.name ?? o.city : 'on the road'
  const post = sum.post === 'wanderer' ? 'Wanderer' : sum.post === 'ruler' ? 'Ruler' : `${sum.rankName}${sum.post === 'prefect' ? ', prefect' : ''}`
  const faction = sum.factionName ?? 'no house'
  const when = whenText(env.savedAt, now)
  const ym = ymText(env.snapshot.ym)
  return { officer: sum.playerName, post, faction, city, when, ym, text: `${sum.playerName}, ${post}, ${faction}, at ${city}, ${ym}, saved ${when}` }
}

/** Throws a message when the envelope cannot be opened; the caller maps it to corrupt or missing-content. */
export function validateEnvelope(raw: unknown): { ok: true; env: SaveEnvelope } | { ok: false; kind: 'corrupt' | 'missing-content'; reason: string } {
  const bad = (reason: string): { ok: false; kind: 'corrupt'; reason: string } => ({ ok: false, kind: 'corrupt', reason })
  if (!raw || typeof raw !== 'object') return bad('The save is not a game record.')
  const e = raw as Partial<SaveEnvelope>
  if (e.version !== SAVE_VERSION) return bad(`The save is from another version of the game (${String(e.version)}).`)
  const s = e.snapshot
  if (!s || typeof s !== 'object' || s.version !== 1 || !s.officers || !s.cities || !s.factions || !Array.isArray(s.log) || !Array.isArray(s.pending) || !s.ym || !s.rng) return bad('The saved world is incomplete.')
  if (!e.opts || typeof e.opts !== 'object' || !Array.isArray(e.actions)) return bad('The save has no setup record.')
  if (typeof e.savedAt !== 'number') return bad('The save has no date.')
  if (!GAME_DATA.scenarios.some((x) => x.id === s.scenario)) return { ok: false, kind: 'missing-content', reason: `Scenario ${s.scenario} is no longer in the game.` }
  const officers = new Set(GAME_DATA.officers.map((o) => o.id))
  for (const id of Object.keys(s.officers)) {
    const o = s.officers[id]!
    if (!o.custom && !officers.has(id)) return { ok: false, kind: 'missing-content', reason: `Officer ${id} is no longer in the game.` }
  }
  const cities = new Set(GAME_DATA.cities.map((c) => c.id))
  for (const id of Object.keys(s.cities)) if (!cities.has(id)) return { ok: false, kind: 'missing-content', reason: `City ${id} is no longer in the game.` }
  if (!s.officers[s.player]) return bad('The saved player officer is missing.')
  try {
    const issues = world.invariants(s)
    if (issues.length) return bad(`The saved world fails its checks: ${issues[0]}`)
    world.legalActions(s)
  } catch (err) {
    return bad(`The engine cannot read this state: ${String(err)}`)
  }
  return { ok: true, env: e as SaveEnvelope }
}

export function readSave(storage: KV | null = browserStorage(), now: number = Date.now()): SaveRead {
  if (!storage) return { kind: 'refused', reason: 'This browser does not let the game store anything, so nothing can be saved or continued.' }
  let text: string | null
  try {
    text = storage.getItem(SAVE_KEY)
  } catch (err) {
    return { kind: 'refused', reason: `This browser refused to read the save (${String(err)}).` }
  }
  if (text === null) return { kind: 'none' }
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { kind: 'corrupt', reason: 'The save is unreadable (it is not valid data).' }
  }
  const v = validateEnvelope(raw)
  if (!v.ok) return { kind: v.kind, reason: v.reason }
  return { kind: 'ok', env: v.env, line: describeSave(v.env, now) }
}

export type WriteResult = { ok: true } | { ok: false; reason: string }

export function writeSave(env: SaveEnvelope, storage: KV | null = browserStorage()): WriteResult {
  if (!storage) return { ok: false, reason: 'This browser does not let the game store anything. Your progress will be lost when you close the tab.' }
  try {
    storage.setItem(SAVE_KEY, JSON.stringify(env))
    return { ok: true }
  } catch (err) {
    return { ok: false, reason: `This browser refused to store the save (${String(err)}). Your progress will be lost when you close the tab.` }
  }
}

export function clearSave(storage: KV | null = browserStorage()): void {
  try {
    storage?.removeItem(SAVE_KEY)
  } catch {
    /* nothing to clear */
  }
}
