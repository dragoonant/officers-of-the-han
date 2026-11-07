// Shared helpers for the world engine: data index, working context, ties, ranks, logging, cloning.
import type { Aptitude, CityDef, GameData, OfficerDef, RoadTerrain, Sex, Stats, Temperament, TroopType, YM } from '../contracts/data'
import type { CityState, FactionState, LogEntry, OfficerState, WorldState } from '../contracts/world'
import { chance as rngChance, clamp, d100 as rngD100, nextFloat } from '../shared/rng'
import { CHRONICLE_KINDS } from './logkinds'

// ---------- time ----------
export const ymNum = (ym: YM): number => ym.year * 12 + ym.month - 1
export const addMonths = (ym: YM, n: number): YM => {
  const t = ymNum(ym) + n
  return { year: Math.floor(t / 12), month: (t % 12) + 1 }
}
export const ymLabel = (ym: YM): string => `${ym.year}-${String(ym.month).padStart(2, '0')}`

// ---------- ranks (W-OFF-4) ----------
export const RANK_NAMES = ['Attendant', 'Captain', 'Colonel', 'General', 'Grand General']
export const RANK_MERIT = [0, 1000, 3000, 6000, 10000]
export const RANK_CAP = [3000, 5000, 8000, 12000, 15000]
export const RANK_SALARY = [10, 20, 35, 55, 80]

export const pk = (a: string, b: string): string => (a < b ? `${a}|${b}` : `${b}|${a}`)

// ---------- data index ----------
export interface RoadEdge {
  to: string
  days: number
  terrain: RoadTerrain
}

export interface Prof {
  name: string
  courtesy?: string
  sex: Sex
  born: number
  died: number | null
  temperament: Temperament
  aptitude: Record<TroopType, Aptitude>
  portrait?: string
}

export interface DataIdx {
  data: GameData
  cityDef: Map<string, CityDef>
  cityIds: string[]
  adj: Map<string, RoadEdge[]>
  dist: Map<string, Map<string, number>>
  officerDef: Map<string, OfficerDef>
  kinSet: Set<string>
  childrenOf: Map<string, string[]>
  spouseKin: [string, string][]
}

const IDX_CACHE = new WeakMap<GameData, DataIdx>()

export function indexData(data: GameData): DataIdx {
  const hit = IDX_CACHE.get(data)
  if (hit) return hit
  const cityDef = new Map<string, CityDef>()
  for (const c of data.cities) cityDef.set(c.id, c)
  const cityIds = data.cities.map((c) => c.id).sort()
  const adj = new Map<string, RoadEdge[]>()
  for (const id of cityIds) adj.set(id, [])
  for (const r of data.roads) {
    adj.get(r.a)?.push({ to: r.b, days: r.days, terrain: r.terrain })
    adj.get(r.b)?.push({ to: r.a, days: r.days, terrain: r.terrain })
  }
  for (const list of adj.values()) list.sort((x, y) => (x.to < y.to ? -1 : x.to > y.to ? 1 : 0))
  const dist = new Map<string, Map<string, number>>()
  for (const a of cityIds) {
    // Dijkstra (tiny graphs)
    const dm = new Map<string, number>([[a, 0]])
    const done = new Set<string>()
    for (;;) {
      let best: string | null = null
      let bd = Infinity
      for (const [k, v] of dm) if (!done.has(k) && (v < bd || (v === bd && best !== null && k < best))) { best = k; bd = v }
      if (best === null) break
      done.add(best)
      for (const e of adj.get(best) ?? []) {
        const nd = bd + e.days
        if (nd < (dm.get(e.to) ?? Infinity)) dm.set(e.to, nd)
      }
    }
    dist.set(a, dm)
  }
  const officerDef = new Map<string, OfficerDef>()
  const kinSet = new Set<string>()
  const childrenOf = new Map<string, string[]>()
  const spouseKin: [string, string][] = []
  const addChild = (p: string, c: string): void => {
    const l = childrenOf.get(p) ?? []
    if (!l.includes(c)) l.push(c)
    childrenOf.set(p, l)
  }
  for (const o of data.officers) {
    officerDef.set(o.id, o)
    for (const k of o.kin) {
      kinSet.add(pk(o.id, k.id))
      if (k.role === 'child') addChild(o.id, k.id)
      if (k.role === 'parent') addChild(k.id, o.id)
      if (k.role === 'spouse') spouseKin.push([o.id, k.id])
    }
  }
  const idx: DataIdx = { data, cityDef, cityIds, adj, dist, officerDef, kinSet, childrenOf, spouseKin }
  IDX_CACHE.set(data, idx)
  return idx
}

// ---------- working context ----------
export interface Ctx {
  d: DataIdx
  s: WorldState
  out: LogEntry[]
  /** true while the AI acts (no player-only pending creation) */
  ai: boolean
}

export function makeCtx(d: DataIdx, s: WorldState): Ctx {
  return { d, s, out: [], ai: false }
}

export function cloneState(s: WorldState): WorldState {
  const officers: Record<string, OfficerState> = {}
  for (const id in s.officers) {
    const o = s.officers[id]!
    officers[id] = { ...o, stats: { ...o.stats }, xp: { ...o.xp }, visitedThisMonth: o.visitedThisMonth.slice(), items: o.items.slice() }
  }
  const cities: Record<string, CityState> = {}
  for (const id in s.cities) cities[id] = { ...s.cities[id]! }
  const factions: Record<string, FactionState> = {}
  for (const id in s.factions) factions[id] = { ...s.factions[id]! }
  return {
    ...s,
    ym: { ...s.ym },
    cursor: s.cursor ? { ...s.cursor } : null,
    rng: [s.rng[0], s.rng[1], s.rng[2], s.rng[3]],
    options: { ...s.options },
    cities,
    officers,
    factions,
    relations: { ...s.relations },
    friendships: { ...s.friendships },
    rivals: s.rivals.slice(),
    oaths: s.oaths.map((g) => g.slice()),
    pacts: s.pacts.map((p) => ({ ...p, until: { ...p.until } })),
    armies: s.armies.map((a) => ({ ...a, units: a.units.map((u) => ({ ...u })) })),
    flags: s.flags.slice(),
    firedEvents: s.firedEvents.slice(),
    pending: s.pending.slice(), // pendings are never mutated in place
    log: s.log.slice(), // entries are never mutated in place
  }
}

// ---------- rng ----------
export const rnd = (c: Ctx): number => nextFloat(c.s.rng)
export const roll = (c: Ctx, pct: number): boolean => rngChance(c.s.rng, pct)
export const d100 = (c: Ctx): number => rngD100(c.s.rng)
export { clamp }

// ---------- accessors ----------
export const O = (c: Ctx, id: string): OfficerState => c.s.officers[id]!
export const C = (c: Ctx, id: string): CityState => c.s.cities[id]!
export const F = (c: Ctx, id: string): FactionState => c.s.factions[id]!

export function prof(c: Ctx, id: string): Prof {
  const o = c.s.officers[id]
  if (o?.custom) {
    return { name: o.custom.name, sex: o.custom.sex, born: o.custom.born, died: null, temperament: o.custom.temperament, aptitude: o.custom.aptitude, portrait: o.custom.portrait }
  }
  const d = c.d.officerDef.get(id)
  if (d) return d
  return { name: id, sex: 'm', born: 170, died: null, temperament: 'steady', aptitude: { spear: 'B', cavalry: 'B', archer: 'B' } }
}
export const nameOf = (c: Ctx, id: string): string => prof(c, id).name
export const cityName = (c: Ctx, id: string | null): string => (id ? c.d.cityDef.get(id)?.name ?? id : '-')
export const factionName = (c: Ctx, id: string | null): string => (id ? c.s.factions[id]?.name ?? id : 'no one')
export const ageOf = (c: Ctx, id: string): number => c.s.ym.year - prof(c, id).born

export const sortedIds = (rec: Record<string, unknown>): string[] => Object.keys(rec).sort()

export const statSum = (st: Stats): number => st.war + st.ldr + st.int + st.pol + st.cha

export function rankOf(o: OfficerState): number {
  if (o.post === 'ruler') return 4
  let r = 0
  for (let i = 1; i < RANK_MERIT.length; i++) if (o.merit >= RANK_MERIT[i]!) r = i
  return r
}
export const troopCap = (o: OfficerState): number => RANK_CAP[rankOf(o)]!
export const salaryOf = (o: OfficerState): number => RANK_SALARY[rankOf(o)]!
export function expectedTier(o: OfficerState): number {
  const sum = statSum(o.stats)
  return sum >= 400 ? 4 : sum >= 360 ? 3 : sum >= 320 ? 2 : sum >= 280 ? 1 : 0
}

// ---------- ties ----------
export function friendship(c: Ctx, a: string, b: string): number {
  return c.s.friendships[pk(a, b)] ?? 20
}
export function setFriendship(c: Ctx, a: string, b: string, v: number): void {
  if (a === b) return
  c.s.friendships[pk(a, b)] = clamp(Math.round(v), 0, 100)
}
export function addFriendship(c: Ctx, a: string, b: string, delta: number): void {
  setFriendship(c, a, b, friendship(c, a, b) + delta)
}
export function compat(c: Ctx, a: string, b: string): number {
  const ta = prof(c, a).temperament
  const tb = prof(c, b).temperament
  if (ta === tb) return 2
  if ((ta === 'righteous' && tb === 'ambitious') || (ta === 'ambitious' && tb === 'righteous')) return -2
  if ((ta === 'cautious' && tb === 'reckless') || (ta === 'reckless' && tb === 'cautious')) return -2
  return 0
}
export function isRival(c: Ctx, a: string, b: string): boolean {
  return friendship(c, a, b) <= 5 || c.s.rivals.includes(pk(a, b))
}
export const isKin = (c: Ctx, a: string, b: string): boolean => c.d.kinSet.has(pk(a, b))
export function sameOath(c: Ctx, a: string, b: string): boolean {
  const oa = c.s.officers[a]
  const ob = c.s.officers[b]
  return !!oa && !!ob && oa.oathGroup !== null && oa.oathGroup === ob.oathGroup
}
export function isBound(c: Ctx, o: OfficerState): boolean {
  if (!o.faction) return false
  const f = c.s.factions[o.faction]
  if (!f || f.ruler === o.id) return false
  return sameOath(c, o.id, f.ruler) || o.spouse === f.ruler || isKin(c, o.id, f.ruler)
}
export function relation(c: Ctx, fa: string, fb: string): number {
  return c.s.relations[pk(fa, fb)] ?? 30
}
export function addRelation(c: Ctx, fa: string, fb: string, delta: number): void {
  if (fa === fb) return
  c.s.relations[pk(fa, fb)] = clamp(relation(c, fa, fb) + delta, 0, 100)
}
export function pactBetween(c: Ctx, fa: string, fb: string): 'alliance' | 'truce' | null {
  let found: 'alliance' | 'truce' | null = null
  for (const p of c.s.pacts) {
    if ((p.a === fa && p.b === fb) || (p.a === fb && p.b === fa)) {
      if (p.kind === 'alliance') return 'alliance'
      found = 'truce'
    }
  }
  return found
}

// ---------- map ----------
export const neighbors = (c: Ctx, city: string): RoadEdge[] => c.d.adj.get(city) ?? []
export function roadBetween(c: Ctx, a: string, b: string): RoadEdge | null {
  for (const e of neighbors(c, a)) if (e.to === b) return e
  return null
}
export const distance = (c: Ctx, a: string, b: string): number => c.d.dist.get(a)?.get(b) ?? Infinity

export function factionCities(c: Ctx, fid: string): string[] {
  const out: string[] = []
  for (const id of c.d.cityIds) if (c.s.cities[id]?.faction === fid) out.push(id)
  return out
}
export function factionOfficers(c: Ctx, fid: string, includeCaptives = false): OfficerState[] {
  const out: OfficerState[] = []
  for (const id of sortedIds(c.s.officers)) {
    const o = c.s.officers[id]!
    if (o.faction !== fid) continue
    if (o.status === 'active' || o.status === 'army' || (includeCaptives && o.status === 'captive')) out.push(o)
  }
  return out
}
export function officersIn(c: Ctx, city: string, filter?: (o: OfficerState) => boolean): OfficerState[] {
  const out: OfficerState[] = []
  for (const id of sortedIds(c.s.officers)) {
    const o = c.s.officers[id]!
    if (o.city === city && o.status === 'active' && !o.hidden && (!filter || filter(o))) out.push(o)
  }
  return out
}
export function totalTroops(c: Ctx, fid: string): number {
  let t = 0
  for (const id of c.d.cityIds) {
    const ct = c.s.cities[id]!
    if (ct.faction === fid) t += ct.troops
  }
  for (const a of c.s.armies) if (a.faction === fid) for (const u of a.units) t += u.troops
  return t
}
/** nearest faction city by road days (ties: lowest id), excluding `exclude` */
export function nearestOwnCity(c: Ctx, fid: string, from: string, exclude?: string): string | null {
  let best: string | null = null
  let bd = Infinity
  for (const id of c.d.cityIds) {
    if (id === exclude) continue
    if (c.s.cities[id]?.faction !== fid) continue
    const d = distance(c, from, id)
    if (d < bd) { bd = d; best = id }
  }
  return best
}
export function bestType(c: Ctx, id: string): TroopType {
  const ap = prof(c, id).aptitude
  const rank = (a: Aptitude): number => (a === 'A' ? 2 : a === 'B' ? 1 : 0)
  let best: TroopType = 'spear'
  for (const t of ['spear', 'cavalry', 'archer'] as TroopType[]) if (rank(ap[t]) > rank(ap[best])) best = t
  return best
}

// ---------- logging ----------
export function log(c: Ctx, kind: string, text: string, officers: string[] = [], city?: string): void {
  const involvesPlayer = officers.includes(c.s.player)
  if (!involvesPlayer && !CHRONICLE_KINDS.has(kind)) return
  const e: LogEntry = city ? { ym: { ...c.s.ym }, kind, text, officers, city } : { ym: { ...c.s.ym }, kind, text, officers }
  c.s.log.push(e)
  c.out.push(e)
  if (c.s.log.length > 2500) c.s.log.splice(0, c.s.log.length - 2000)
}

export function newPendingId(c: Ctx): string {
  return `p${c.s.nextId++}`
}

export function gainXp(o: OfficerState, stat: keyof Stats, amount: number, age: number): void {
  if (age >= 55) return
  let x = o.xp[stat] + amount
  while (x >= 100) {
    x -= 100
    if (o.stats[stat] < 100) o.stats[stat] += 1
  }
  o.xp[stat] = x
}

/** Pendings the month pipeline must wait for. */
export const BLOCKING = new Set<string>(['battle', 'duel', 'debate', 'chooseDefenders', 'eventChoice', 'chooseSuccessor', 'captured'])
export const hasBlocking = (c: Ctx): boolean => c.s.pending.some((p) => BLOCKING.has(p.kind))
