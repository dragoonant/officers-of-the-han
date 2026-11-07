// The action rules (W-WORK, W-ACT, W-CRT, W-PROP, W-DIP, W-CAP, W-MIS): legality (`checkAction`), cost and effect (`applyAction`).
// The player and the AI call exactly these functions; the AI works on a mutable working context.
import type { Contestant, DebateSetup, DuelSetup } from '../contracts/contest'
import type { DiploKind, Mission, WorkKind, WorldAction, RejectCode, OfficerState, CityFocus } from '../contracts/world'
import type { YM } from '../contracts/data'
import { childSeed } from '../shared/rng'
import {
  C, F, O, type Ctx, addFriendship, addMonths, addRelation, ageOf, bestType, cityName, clamp, compat, d100, factionCities, factionName, factionOfficers,
  friendship, gainXp, isBound, isKin, isRival, log, nameOf, newPendingId, officersIn, pactBetween, prof, rankOf, relation, roadBetween, roll,
  sameOath, setFriendship, sortedIds, statSum, totalTroops, ymNum, rnd, nearestOwnCity, neighbors,
} from './core'
import { checkArmy, createArmy, defencePower, suggestArmyLedBy, unitsPower } from './war'
import { clearPrefect, foundFaction, joinFaction, killOfficer, makeWanderer, normalize, pushLetter, succeedRuler, checkEnd } from './people'
import { uprisingArmy } from './uprising'
import { mergeFaction } from './merge'

export interface Fail { code: RejectCode; message: string }
const fail = (code: RejectCode, message: string): Fail => ({ code, message })

export const DAYS = { work: 10, visit: 5, banquet: 10, gift: 1, search: 10, study: 15, drill: 15, rest: 10, recruit: 5, serve: 5, resign: 1, challenge: 5, oath: 1, marry: 1, claim: 10, uprise: 10, appoint: 1, transfer: 2, mission: 1, transport: 5, war: 10, diplomacy: 5, captive: 1, focus: 1, propose: 1 } as const
const WORK_GOLD: Record<Exclude<WorkKind, 'draft'>, number> = { farm: 20, trade: 20, walls: 30, order: 10, train: 0 }

// ---------- derived numbers (every number the UI shows comes from here or war.ts) ----------
export interface WorkInfo { gold: number; gain: number; capped: boolean; note?: string }

export function workInfo(c: Ctx, o: OfficerState, work: WorkKind): WorkInfo {
  const ct = C(c, o.city!)
  const def = c.d.cityDef.get(ct.id)!
  const st = o.stats
  switch (work) {
    case 'farm': { const g = 4 + Math.floor(st.pol / 6); return { gold: 20, gain: Math.min(g, def.farmMax - ct.farm), capped: ct.farm >= def.farmMax } }
    case 'trade': { const g = 4 + Math.floor(st.pol / 6); return { gold: 20, gain: Math.min(g, def.tradeMax - ct.trade), capped: ct.trade >= def.tradeMax } }
    case 'walls': { const g = 4 + Math.floor(st.ldr / 6); return { gold: 30, gain: Math.min(g, def.wallsMax - ct.walls), capped: ct.walls >= def.wallsMax } }
    case 'order': { const g = 1 + Math.floor(st.cha / 20); return { gold: 10, gain: Math.min(g, 100 - ct.order), capped: ct.order >= 100 } }
    case 'train': { const g = 2 + Math.floor(st.ldr / 12); return { gold: 0, gain: Math.min(g, 100 - ct.training), capped: ct.training >= 100 } }
    case 'draft': {
      const n = Math.min(Math.floor(ct.population / 50), 300 + st.cha * 5)
      return { gold: Math.ceil(n / 10), gain: n, capped: n < 1, note: `${n} new troops` }
    }
    default: return { gold: 0, gain: 0, capped: true }
  }
}

export function recruitChance(c: Ctx, actor: OfficerState, target: OfficerState): number {
  let rivalIn = false
  if (actor.faction) {
    for (const f of factionOfficers(c, actor.faction)) if (f.id !== target.id && isRival(c, f.id, target.id)) { rivalIn = true; break }
  }
  return clamp(20 + Math.floor(actor.stats.cha / 2) + Math.floor(friendship(c, actor.id, target.id) / 2) - (rivalIn ? 30 : 0), 5, 95)
}

/** The person a wanderer asks in this city (ruler first, else prefect), or null. */
export function servePatron(c: Ctx, cityId: string): OfficerState | null {
  const ct = C(c, cityId)
  if (!ct.faction) return null
  const f = F(c, ct.faction)
  const r = c.s.officers[f.ruler]
  if (r && r.status === 'active' && r.city === cityId) return r
  const p = ct.prefect ? c.s.officers[ct.prefect] : undefined
  if (p && p.status === 'active' && p.city === cityId) return p
  return null
}

export function serveChance(c: Ctx, actor: OfficerState, patron: OfficerState): number {
  const small = patron.faction ? factionOfficers(c, patron.faction).length < 5 : false
  return clamp(30 + Math.floor((statSum(actor.stats) - 250) / 3) + Math.floor(friendship(c, actor.id, patron.id) / 2) + (small ? 20 : 0), 5, 95)
}

export function marryChance(c: Ctx, a: string, b: string): number {
  return clamp(40 + (friendship(c, a, b) - 70) * 2 + 10 * compat(c, a, b), 0, 100)
}

export function searchChances(c: Ctx, o: OfficerState): { hidden: number | null; gold: number; goldAmount: number } {
  const hid = hiddenIn(c, o.city!)
  return { hidden: hid ? clamp(30 + Math.floor(o.stats.int / 2), 0, 100) : null, gold: 50, goldAmount: 20 + Math.floor(o.stats.pol / 2) }
}

export function hiddenIn(c: Ctx, cityId: string): OfficerState | null {
  for (const id of sortedIds(c.s.officers)) {
    const o = c.s.officers[id]!
    if (o.hidden && o.status === 'active' && o.city === cityId) return o
  }
  return null
}

export function diploChance(c: Ctx, envoy: OfficerState, ownF: string, target: string, kind: DiploKind): number {
  const ours = totalTroops(c, ownF)
  const theirs = totalTroops(c, target)
  if (kind === 'surrender') {
    const ratio = ours / Math.max(1, theirs)
    return clamp(Math.floor((ratio - 3) * 15 + envoy.stats.cha / 10), 0, 60)
  }
  const base = relation(c, ownF, target) - 20 + Math.floor(envoy.stats.cha / 4) + (theirs < ours ? 10 : 0) + (kind === 'truce' ? 10 : 0)
  return clamp(base, 5, 90)
}

export function captiveChance(c: Ctx, rulerId: string, captive: OfficerState): number {
  if (isBound(c, captive)) return 0
  return clamp(30 + Math.floor(O(c, rulerId).stats.cha / 2) - Math.floor((captive.loyalty ?? 50) / 2) + Math.floor(friendship(c, captive.id, rulerId) / 2), 5, 90)
}

export function proposeChance(c: Ctx, proposer: OfficerState, ruler: OfficerState, proposal: 'war' | 'alliance' | 'truce' | 'prefect', ctxBonus: number): number {
  return clamp(30 + Math.floor(friendship(c, proposer.id, ruler.id) / 2) + 5 * rankOf(proposer) + ctxBonus, 5, 95)
}

/** context bonus for a war proposal (W-PROP-1) */
export function warContext(c: Ctx, from: string, to: string, units: { officer: string; troops: number }[]): number {
  const att = unitsPower(c, units, C(c, from).training)
  const def = defencePower(c, to)
  if (def <= 0) return 20
  if (att > 1.4 * def) return 20
  if (att < def) return -30
  return 0
}

// ---------- missions ----------
export function missionAllows(c: Ctx, o: OfficerState, to: string): boolean {
  const m = o.mission
  if (!m) return false
  if (m.kind === 'develop' || m.kind === 'scout') return m.city === to
  if (m.kind === 'recruit') { const t = c.s.officers[m.officer]; return !!t && t.city === to }
  return false
}

export function missionDeadline(c: Ctx, kind: Mission['kind']): YM {
  return kind === 'recruit' || kind === 'scout' ? addMonths(c.s.ym, 1) : { ...c.s.ym }
}

export function describeMission(c: Ctx, m: Mission): string {
  switch (m.kind) {
    case 'develop': return `Do ${m.count} ${m.work} work in ${cityName(c, m.city)} (${m.done} done)`
    case 'recruit': return `Bring ${nameOf(c, m.officer)} into the house`
    case 'scout': return `Scout ${cityName(c, m.city)}${m.reached ? ' and return' : ''}`
    case 'envoy': return `Carry a ${m.proposal} proposal to ${factionName(c, m.faction)}`
  }
}

const MISSION_MERIT = { develop: 100, recruit: 200, scout: 150, envoy: 200 } as const

export function completeMission(c: Ctx, id: string, bonus = 0): void {
  const o = O(c, id)
  const m = o.mission
  if (!m) return
  o.mission = null
  o.merit += MISSION_MERIT[m.kind] + bonus
  const f = o.faction ? c.s.factions[o.faction] : undefined
  if (f) addFriendship(c, id, f.ruler, 3)
  log(c, 'mission-done', `${nameOf(c, id)} completed a mission: ${describeMission(c, m)}.`, [id], o.city ?? undefined)
}

export function failMission(c: Ctx, id: string): void {
  const o = O(c, id)
  const m = o.mission
  if (!m) return
  o.mission = null
  o.merit = Math.max(0, o.merit - 50)
  const f = o.faction ? c.s.factions[o.faction] : undefined
  if (f) addFriendship(c, id, f.ruler, -5)
  log(c, 'mission-failed', `${nameOf(c, id)} failed a mission: ${describeMission(c, m)}.`, [id], o.city ?? undefined)
}

export function validMission(c: Ctx, ruler: OfficerState, m: Mission): string | null {
  if (!m || typeof m !== 'object') return 'No mission.'
  switch (m.kind) {
    case 'develop':
      if (!c.s.cities[m.city] || c.s.cities[m.city]!.faction !== ruler.faction) return 'Develop work must be in one of our cities.'
      if (!['farm', 'trade', 'walls', 'order', 'train', 'draft'].includes(m.work)) return 'Unknown work.'
      if (!Number.isInteger(m.count) || m.count < 1 || m.count > 6) return 'Count must be 1 to 6.'
      return null
    case 'recruit': {
      const t = c.s.officers[m.officer]
      if (!t || t.status !== 'active' || t.hidden || t.post !== 'wanderer') return 'That officer is not a wanderer in sight.'
      return null
    }
    case 'scout':
      return c.s.cities[m.city] ? null : 'No such city.'
    case 'envoy': {
      const f = c.s.factions[m.faction]
      if (!f || !f.alive || m.faction === ruler.faction) return 'No such house.'
      if (!['alliance', 'truce', 'surrender'].includes(m.proposal)) return 'Unknown proposal.'
      return null
    }
  }
}

function afterWork(c: Ctx, o: OfficerState, work: WorkKind): void {
  const m = o.mission
  if (m && m.kind === 'develop' && m.work === work && m.city === o.city) {
    const done = m.done + 1
    o.mission = { ...m, done }
    if (done >= m.count) completeMission(c, o.id)
  }
}

// ---------- contests for the player ----------
export function contestant(c: Ctx, id: string, player: boolean): Contestant {
  const o = O(c, id)
  const p = prof(c, id)
  const ct: Contestant = { id, name: p.name, stats: { ...o.stats }, temperament: p.temperament, health: o.health, player }
  if (p.portrait) ct.portrait = p.portrait
  return ct
}

export function duelSetup(c: Ctx, tag: string, a: string, b: string): DuelSetup {
  const pl = c.s.player
  return { id: `${tag}|${c.s.nextId++}`, seed: childSeed(c.s.rng), a: contestant(c, a, a === pl), b: contestant(c, b, b === pl && a !== pl), inBattle: false }
}

export function debateSetup(c: Ctx, tag: string, a: string, b: string, purpose: DebateSetup['purpose'], bonusB: number): DebateSetup {
  const pl = c.s.player
  return { id: `${tag}|${c.s.nextId++}`, seed: childSeed(c.s.rng), a: contestant(c, a, a === pl), b: contestant(c, b, b === pl && a !== pl), purpose, composureBonus: { a: 0, b: bonusB } }
}

// ---------- costs ----------
export function costOf(c: Ctx, actorId: string, a: WorldAction): { days: number; gold: number } {
  const o = c.s.officers[actorId]
  const none = { days: 0, gold: 0 }
  if (!o) return none
  switch (a.kind) {
    case 'work': {
      if (!o.city || !c.s.cities[o.city]) return { days: DAYS.work, gold: 0 }
      return { days: DAYS.work, gold: workInfo(c, o, a.work).gold }
    }
    case 'travel': { const e = o.city ? roadBetween(c, o.city, a.to) : null; return { days: e ? e.days : 0, gold: 0 } }
    case 'visit': return { days: DAYS.visit, gold: 0 }
    case 'banquet': return { days: DAYS.banquet, gold: 100 }
    case 'gift': return { days: DAYS.gift, gold: a.gold }
    case 'search': return { days: DAYS.search, gold: 0 }
    case 'study': return { days: DAYS.study, gold: 0 }
    case 'drill': return { days: DAYS.drill, gold: 0 }
    case 'rest': return { days: DAYS.rest, gold: 0 }
    case 'recruit': return { days: DAYS.recruit, gold: 0 }
    case 'serve': return { days: DAYS.serve, gold: 0 }
    case 'resign': return { days: DAYS.resign, gold: 0 }
    case 'challenge': return { days: DAYS.challenge, gold: 0 }
    case 'oath': return { days: DAYS.oath, gold: 0 }
    case 'marry': return { days: DAYS.marry, gold: 0 }
    case 'claim': return { days: DAYS.claim, gold: 0 }
    case 'uprise': return { days: DAYS.uprise, gold: 0 }
    case 'appoint': return { days: DAYS.appoint, gold: 0 }
    case 'transfer': return { days: DAYS.transfer, gold: 0 }
    case 'mission': return { days: DAYS.mission, gold: 0 }
    case 'transport': return { days: DAYS.transport, gold: 0 }
    case 'war': return { days: DAYS.war, gold: 0 }
    case 'diplomacy': return { days: DAYS.diplomacy, gold: 0 }
    case 'captive': return { days: DAYS.captive, gold: 0 }
    case 'focus': return { days: DAYS.focus, gold: 0 }
    case 'propose': return { days: DAYS.propose, gold: 0 }
    default: return none
  }
}

// ---------- legality ----------
const isInt = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n)
const STATS_INT = ['int', 'pol']
const STATS_WAR = ['war', 'ldr']
const FOCI = ['balanced', 'farm', 'trade', 'military', 'defense']

function activeOfficer(c: Ctx, id: string): OfficerState | Fail {
  const o = c.s.officers[id]
  if (!o) return fail('bad-target', 'No such officer.')
  if (o.status !== 'active') return fail('not-legal', o.status === 'army' ? `${nameOf(c, id)} is away with an army.` : o.status === 'captive' ? `${nameOf(c, id)} is a prisoner.` : `${nameOf(c, id)} cannot act.`)
  if (o.hidden) return fail('not-legal', 'A hidden officer cannot act.')
  if (!o.city || !c.s.cities[o.city]) return fail('not-legal', 'Not in a city.')
  return o
}
const isFail = (x: OfficerState | Fail): x is Fail => 'code' in x && 'message' in x && !('stats' in x)

function peer(c: Ctx, o: OfficerState, id: unknown): OfficerState | Fail {
  if (typeof id !== 'string') return fail('bad-target', 'Name an officer.')
  const t = c.s.officers[id]
  if (!t || id === o.id) return fail('bad-target', 'No such officer.')
  if (t.status !== 'active' || t.hidden || t.city !== o.city) return fail('bad-target', `${nameOf(c, id)} is not here.`)
  return t
}

function needDays(o: OfficerState, d: number): Fail | null {
  return o.days < d ? fail('no-days', `Needs ${d} days; ${o.days} left.`) : null
}

export function groupOf(c: Ctx, id: string): string[] {
  const o = c.s.officers[id]
  return o && o.oathGroup !== null ? c.s.oaths[o.oathGroup] ?? [] : []
}

export function checkAction(c: Ctx, actorId: string, a: WorldAction): Fail | null {
  if (a.kind === 'endMonth') return null
  const ao = activeOfficer(c, actorId)
  if (isFail(ao)) return ao
  const o = ao
  const city = C(c, o.city!)
  const own = !!o.faction && city.faction === o.faction
  const isRuler = o.post === 'ruler'
  const cost = costOf(c, actorId, a)
  const dayFail = (): Fail | null => needDays(o, cost.days)
  switch (a.kind) {
    case 'work': {
      if (!o.faction || !own) return fail('not-legal', 'Work needs a city of your own house.')
      if (!['farm', 'trade', 'walls', 'order', 'train', 'draft'].includes(a.work)) return fail('bad-target', 'Unknown work.')
      const w = workInfo(c, o, a.work)
      if (w.capped) return fail('not-legal', a.work === 'draft' ? 'No one left to draft.' : 'Already at its maximum.')
      return dayFail() ?? (city.gold < w.gold ? fail('no-gold', `The city needs ${w.gold} gold.`) : null)
    }
    case 'travel': {
      if (typeof a.to !== 'string' || !c.s.cities[a.to]) return fail('bad-target', 'No such city.')
      const e = roadBetween(c, o.city!, a.to)
      if (!e) return fail('bad-target', 'No road leads there.')
      if (o.post !== 'wanderer' && C(c, a.to).faction !== o.faction && !missionAllows(c, o, a.to)) return fail('not-legal', 'Only your own house\'s cities are open to you.')
      return needDays(o, e.days)
    }
    case 'visit': {
      const t = peer(c, o, a.officer)
      if (isFail(t)) return t
      if (o.visitedThisMonth.includes(t.id) || t.visitedThisMonth.includes(o.id)) return fail('not-legal', 'Already visited this month.')
      return dayFail()
    }
    case 'banquet': {
      if (!own || !(isRuler || city.prefect === o.id)) return fail('not-legal', 'Only a ruler or prefect hosts a banquet in their city.')
      if (o.gold < 100) return fail('no-gold', 'A banquet costs 100 gold from your purse.')
      if (!officersIn(c, city.id, (x) => x.faction === o.faction && x.id !== o.id).length) return fail('not-legal', 'No one to feast.')
      return dayFail()
    }
    case 'gift': {
      if (!isInt(a.gold) || a.gold < 50) return fail('bad-target', 'A gift is at least 50 gold.')
      if (typeof a.officer !== 'string' || a.officer === o.id) return fail('bad-target', 'No such officer.')
      const t = c.s.officers[a.officer]
      if (!t || t.status !== 'active' || t.hidden) return fail('bad-target', 'No such officer.')
      const reward = a.fromCity === true
      if (reward) {
        if (!isRuler || t.faction !== o.faction) return fail('not-legal', 'Only a ruler pays a reward from the city, to their own officers.')
        const src = city.faction === o.faction ? city : C(c, F(c, o.faction!).capital)
        if (src.gold < a.gold) return fail('no-gold', 'The city lacks the gold.')
      } else {
        if (t.city !== o.city) return fail('bad-target', `${nameOf(c, t.id)} is not here.`)
        if (o.gold < a.gold) return fail('no-gold', 'Your purse lacks the gold.')
      }
      return dayFail()
    }
    case 'search': return dayFail()
    case 'study': return STATS_INT.includes(a.stat) ? dayFail() : fail('bad-target', 'Study INT or POL.')
    case 'drill': return STATS_WAR.includes(a.stat) ? dayFail() : fail('bad-target', 'Drill WAR or LDR.')
    case 'rest': return o.health >= 100 ? fail('not-legal', 'Already in full health.') : dayFail()
    case 'recruit': {
      if (!o.faction || o.post === 'wanderer') return fail('not-legal', 'Only those who serve a house can recruit.')
      const t = peer(c, o, a.officer)
      if (isFail(t)) return t
      if (t.post !== 'wanderer') return fail('bad-target', `${nameOf(c, t.id)} already serves.`)
      if (isRival(c, o.id, t.id)) return fail('not-legal', 'Rivals never accept.')
      if (a.mode !== 'persuade' && a.mode !== 'debate') return fail('bad-target', 'Unknown mode.')
      if (a.mode === 'debate' && actorId !== c.s.player) return fail('not-legal', 'Only the player debates.')
      return dayFail()
    }
    case 'serve': {
      if (o.post !== 'wanderer') return fail('not-legal', 'Only wanderers ask to serve.')
      const p = servePatron(c, o.city!)
      if (!p) return fail('not-legal', 'No ruler or prefect is here to ask.')
      if (isRival(c, o.id, p.id)) return fail('not-legal', 'Rivals never accept.')
      return dayFail()
    }
    case 'resign':
      return !o.faction || isRuler ? fail('not-legal', 'You have no post to resign.') : dayFail()
    case 'challenge': {
      const t = peer(c, o, a.officer)
      if (isFail(t)) return t
      if (o.faction && F(c, o.faction).ruler === t.id) return fail('not-legal', 'You cannot challenge your own ruler.')
      if (t.health < 30) return fail('not-legal', `${nameOf(c, t.id)} is too hurt to duel.`)
      if (o.health < 30) return fail('not-legal', 'You are too hurt to duel.')
      return dayFail()
    }
    case 'oath': {
      const t = peer(c, o, a.officer)
      if (isFail(t)) return t
      if (sameOath(c, o.id, t.id)) return fail('not-legal', 'Already sworn.')
      if (friendship(c, o.id, t.id) < 80) return fail('not-legal', 'Friendship must reach 80.')
      if (isRival(c, o.id, t.id)) return fail('not-legal', 'Rivals never accept.')
      const set = new Set([o.id, t.id, ...groupOf(c, o.id), ...groupOf(c, t.id)])
      if (set.size > 4) return fail('not-legal', 'An oath group holds at most four.')
      return dayFail()
    }
    case 'marry': {
      const t = peer(c, o, a.officer)
      if (isFail(t)) return t
      if (o.spouse || t.spouse) return fail('not-legal', 'One of you is already married.')
      if (ageOf(c, o.id) < 16 || ageOf(c, t.id) < 16) return fail('not-legal', 'Both must be adults.')
      if (friendship(c, o.id, t.id) < 70) return fail('not-legal', 'Friendship must reach 70.')
      if (isRival(c, o.id, t.id) || isKin(c, o.id, t.id)) return fail('not-legal', 'Not possible.')
      return dayFail()
    }
    case 'claim': {
      if (o.post !== 'wanderer' || city.faction !== null) return fail('not-legal', 'Claim needs a wanderer in a vacant city.')
      if (companionsOf(c, o).length < 1) return fail('not-legal', 'You need a companion (friendship 60+) here.')
      return dayFail()
    }
    case 'uprise': {
      if (o.post !== 'wanderer' || city.faction === null) return fail('not-legal', 'Uprising needs a wanderer in a held city.')
      if (city.order >= 60) return fail('not-legal', 'The city is too orderly (below 60 needed).')
      if (o.health < 30) return fail('not-legal', 'You are too hurt.')
      return dayFail()
    }
    case 'appoint': {
      if (!isRuler) return fail('not-legal', 'Only the ruler appoints.')
      const t = c.s.officers[a.officer]
      if (!t || t.faction !== o.faction || t.status !== 'active' || t.id === o.id || t.hidden) return fail('bad-target', 'No such officer of ours.')
      const tc = C(c, t.city!)
      if (tc.faction !== o.faction) return fail('not-legal', 'They are not in one of our cities.')
      if (tc.prefect === t.id) return fail('not-legal', 'Already prefect.')
      return dayFail()
    }
    case 'transfer': {
      if (!isRuler) return fail('not-legal', 'Only the ruler transfers officers.')
      const t = c.s.officers[a.officer]
      if (!t || t.faction !== o.faction || t.status !== 'active' || t.id === o.id || t.hidden) return fail('bad-target', 'No such officer of ours.')
      if (typeof a.to !== 'string' || !c.s.cities[a.to] || C(c, a.to).faction !== o.faction) return fail('bad-target', 'Destination must be one of our cities.')
      if (t.city === a.to) return fail('bad-target', 'Already there.')
      return dayFail()
    }
    case 'mission': {
      if (!isRuler) return fail('not-legal', 'Only the ruler gives missions.')
      const t = c.s.officers[a.officer]
      if (!t || t.faction !== o.faction || t.status !== 'active' || t.id === o.id || t.hidden) return fail('bad-target', 'No such officer of ours.')
      if (t.mission) return fail('not-legal', 'They already hold a mission.')
      const err = validMission(c, o, a.mission)
      if (err) return fail('bad-target', err)
      return dayFail()
    }
    case 'transport': {
      const from = c.s.cities[a.from]
      const to = c.s.cities[a.to]
      if (!from || !to || from.faction !== o.faction || to.faction !== o.faction || !o.faction) return fail('bad-target', 'Both must be cities of our house.')
      if (!(isRuler || from.prefect === o.id)) return fail('not-legal', 'Only the ruler or the city\'s prefect sends supplies.')
      if (!roadBetween(c, a.from, a.to)) return fail('bad-target', 'The cities are not joined by a road.')
      if (![a.gold, a.rice, a.troops].every((n) => isInt(n) && n >= 0)) return fail('bad-target', 'Amounts must be whole numbers.')
      if (a.gold + a.rice + a.troops <= 0) return fail('bad-target', 'Send something.')
      if (a.gold > from.gold || a.rice > from.rice || a.troops > from.troops) return fail('no-gold', 'The city lacks that much.')
      return dayFail()
    }
    case 'war': {
      if (!isRuler || !o.faction) return fail('not-legal', 'Only the ruler orders war.')
      if (typeof a.from !== 'string' || typeof a.to !== 'string') return fail('bad-target', 'Name the cities.')
      const err = checkArmy(c, o.faction, a.from, a.to, a.units)
      if (err) return fail('bad-target', err)
      return dayFail()
    }
    case 'diplomacy': return checkDiplomacy(c, o, a)
    case 'captive': {
      if (!isRuler) return fail('not-legal', 'Only the ruler deals with captives.')
      const t = c.s.officers[a.officer]
      if (!t || t.status !== 'captive' || !t.city || C(c, t.city).faction !== o.faction) return fail('bad-target', 'No such captive in our cities.')
      if (!['recruit', 'release', 'execute'].includes(a.decision)) return fail('bad-target', 'Unknown decision.')
      if (a.decision === 'execute' && t.id === c.s.player) return fail('not-legal', 'The player\'s officer is never executed.')
      return dayFail()
    }
    case 'focus': {
      const ct = c.s.cities[a.city]
      if (!ct || ct.faction !== o.faction || !o.faction) return fail('bad-target', 'Not one of our cities.')
      if (!(isRuler || ct.prefect === o.id)) return fail('not-legal', 'Only the ruler or the prefect sets the focus.')
      if (!FOCI.includes(a.focus)) return fail('bad-target', 'Unknown focus.')
      return dayFail()
    }
    case 'propose': return checkPropose(c, o, a)
    default:
      return fail('not-legal', 'Not an action.')
  }
}

export function companionsOf(c: Ctx, o: OfficerState): OfficerState[] {
  return officersIn(c, o.city!, (x) => x.id !== o.id && x.post === 'wanderer' && friendship(c, o.id, x.id) >= 60)
}

function checkDiplomacy(c: Ctx, o: OfficerState, a: Extract<WorldAction, { kind: 'diplomacy' }>): Fail | null {
  const isRuler = o.post === 'ruler'
  const env = c.s.officers[a.envoy]
  if (!o.faction) return fail('not-legal', 'Not in a house.')
  const missionEnvoy = o.mission?.kind === 'envoy' && a.envoy === o.id && o.mission.faction === a.faction && o.mission.proposal === a.proposal
  if (!isRuler && !missionEnvoy) return fail('not-legal', 'Only the ruler (or an envoy on mission) conducts diplomacy.')
  if (!env || env.faction !== o.faction || env.status !== 'active') return fail('bad-target', 'The envoy must be an active officer of our house.')
  const tf = c.s.factions[a.faction]
  if (!tf || !tf.alive || a.faction === o.faction) return fail('bad-target', 'No such house.')
  if (!['alliance', 'truce', 'surrender'].includes(a.proposal)) return fail('bad-target', 'Unknown proposal.')
  if (a.mode !== 'roll' && a.mode !== 'debate') return fail('bad-target', 'Unknown mode.')
  if (a.mode === 'debate' && a.envoy !== c.s.player) return fail('not-legal', 'Only the player debates.')
  const pact = pactBetween(c, o.faction, a.faction)
  if (a.proposal === 'alliance' && pact === 'alliance') return fail('not-legal', 'Already allied.')
  if (a.proposal === 'truce' && pact) return fail('not-legal', 'Already bound by a pact.')
  if (a.proposal === 'surrender') {
    if (totalTroops(c, o.faction) < 3 * totalTroops(c, a.faction)) return fail('not-legal', 'Our troops must be at least 3x theirs.')
    if (pact) return fail('not-legal', 'Not while a pact stands.')
  }
  return needDays(o, DAYS.diplomacy)
}

function checkPropose(c: Ctx, o: OfficerState, a: Extract<WorldAction, { kind: 'propose' }>): Fail | null {
  if (!o.faction || o.post === 'ruler' || o.post === 'wanderer') return fail('not-legal', 'Only officers and prefects propose.')
  if (o.proposedThisMonth) return fail('not-legal', 'Already proposed this month.')
  const f = F(c, o.faction)
  const r = c.s.officers[f.ruler]
  if (!r || r.status !== 'active') return fail('not-legal', 'The ruler is not available.')
  if (r.city !== o.city && f.ruler !== c.s.player) return fail('not-legal', 'The ruler is not here.')
  if (f.ruler === c.s.player && o.id === c.s.player) return fail('not-legal', 'No.')
  const own = C(c, o.city!).faction === o.faction
  switch (a.proposal) {
    case 'war': {
      if (!own) return fail('not-legal', 'Propose war from one of our cities.')
      if (typeof a.to !== 'string') return fail('bad-target', 'Name the target city.')
      if (a.units !== undefined && !Array.isArray(a.units)) return fail('bad-target', 'Units must be a list.')
      const units = a.units ?? suggestArmyLedBy(c, o.faction, o.city!, o.id)
      if (units.length === 0) return fail('bad-target', 'No army can be raised here.')
      if (!units.some((u) => u.commander && u.officer === o.id)) return fail('bad-target', 'The proposer leads the army.')
      const err = checkArmy(c, o.faction, o.city!, a.to, units)
      if (err) return fail('bad-target', err)
      break
    }
    case 'alliance':
    case 'truce': {
      const tf = a.faction ? c.s.factions[a.faction] : undefined
      if (!tf || !tf.alive || tf.id === o.faction) return fail('bad-target', 'No such house.')
      const pact = pactBetween(c, o.faction, tf.id)
      if (pact === 'alliance' || (a.proposal === 'truce' && pact)) return fail('not-legal', 'A pact already stands.')
      break
    }
    case 'prefect': {
      const ct = C(c, o.city!)
      if (!own || ct.prefect === o.id) return fail('not-legal', 'Not possible here.')
      break
    }
    default: return fail('bad-target', 'Unknown proposal.')
  }
  return needDays(o, DAYS.propose)
}

// ---------- effects ----------
export function isBlockedStatus(o: OfficerState): boolean { return o.status !== 'active' }

function spend(c: Ctx, o: OfficerState, days: number): void {
  o.days = Math.max(0, o.days - days)
}

function joinThrough(c: Ctx, targetId: string, fid: string, friend: number): void {
  joinFaction(c, targetId, fid, 60 + Math.floor(friend / 4))
}

export function applyAction(c: Ctx, actorId: string, a: WorldAction): void {
  if (a.kind === 'endMonth') return
  const o = O(c, actorId)
  const city = o.city ? C(c, o.city) : null
  const cost = costOf(c, actorId, a)
  const age = ageOf(c, actorId)
  const name = nameOf(c, actorId)
  const loc = o.city ?? undefined
  // pre-charge (some effects below create pendings; the days are paid either way)
  if (a.kind !== 'travel') spend(c, o, cost.days)
  switch (a.kind) {
    case 'work': {
      const w = workInfo(c, o, a.work)
      const ct = city!
      ct.gold -= w.gold
      switch (a.work) {
        case 'farm': ct.farm += w.gain; gainXp(o, 'pol', 10, age); break
        case 'trade': ct.trade += w.gain; gainXp(o, 'pol', 10, age); break
        case 'walls': ct.walls += w.gain; gainXp(o, 'ldr', 10, age); break
        case 'order': ct.order += w.gain; gainXp(o, 'cha', 10, age); break
        case 'train': ct.training += w.gain; gainXp(o, 'ldr', 10, age); break
        case 'draft': {
          const n = w.gain
          const before = ct.troops
          ct.training = Math.floor((ct.training * before) / (before + n))
          ct.troops += n
          ct.population -= n
          ct.order = Math.max(0, ct.order - 2)
          gainXp(o, 'cha', 10, age)
          break
        }
      }
      o.merit += 20
      log(c, 'work', `${name} did ${a.work} work in ${cityName(c, ct.id)}.`, [actorId], ct.id)
      afterWork(c, o, a.work)
      return
    }
    case 'travel': {
      const e = roadBetween(c, o.city!, a.to)!
      spend(c, o, e.days)
      clearPrefect(c, actorId)
      o.city = a.to
      log(c, 'travel', `${name} travelled to ${cityName(c, a.to)}.`, [actorId], a.to)
      return
    }
    case 'visit': {
      const t = O(c, a.officer)
      addFriendship(c, actorId, t.id, 3 + Math.floor(o.stats.cha / 25) + compat(c, actorId, t.id))
      o.visitedThisMonth.push(t.id)
      log(c, 'visit', `${name} visited ${nameOf(c, t.id)}.`, [actorId, t.id], loc)
      return
    }
    case 'banquet': {
      o.gold -= 100
      const guests = officersIn(c, city!.id, (x) => x.faction === o.faction && x.id !== actorId)
      const add = 2 + Math.floor(o.stats.cha / 40)
      for (const g of guests) {
        addFriendship(c, actorId, g.id, add)
        if (o.post === 'ruler' && g.loyalty !== null) g.loyalty = clamp(g.loyalty + 1, 0, 100)
      }
      log(c, 'banquet', `${name} gave a banquet in ${cityName(c, city!.id)}.`, [actorId], loc)
      return
    }
    case 'gift': {
      const t = O(c, a.officer)
      const reward = a.fromCity === true
      const ruler = !!o.faction && o.post === 'ruler' && t.faction === o.faction
      if (reward) {
        const src = city!.faction === o.faction ? city! : C(c, F(c, o.faction!).capital)
        src.gold -= a.gold
      } else o.gold -= a.gold
      t.gold += a.gold
      if (ruler && t.loyalty !== null) {
        t.loyalty = clamp(t.loyalty + Math.floor(a.gold / 20), 0, 100)
        log(c, 'reward', `${name} rewarded ${nameOf(c, t.id)} with ${a.gold} gold.`, [actorId, t.id], loc)
      } else {
        addFriendship(c, actorId, t.id, Math.min(10, Math.floor(a.gold / 25)))
        log(c, 'gift', `${name} gave ${nameOf(c, t.id)} ${a.gold} gold.`, [actorId, t.id], loc)
      }
      return
    }
    case 'search': {
      gainXp(o, 'int', 10, age)
      const hid = hiddenIn(c, o.city!)
      if (hid && roll(c, clamp(30 + Math.floor(o.stats.int / 2), 0, 100))) {
        hid.hidden = false
        hid.faction = null
        hid.post = 'wanderer'
        hid.loyalty = null
        o.merit += 10
        log(c, 'found', `${name} searched ${cityName(c, o.city)} and found ${nameOf(c, hid.id)}.`, [actorId, hid.id], loc)
        return
      }
      if (roll(c, 50)) {
        const g = 20 + Math.floor(o.stats.pol / 2)
        o.gold += g
        o.merit += 10
        log(c, 'search', `${name} searched ${cityName(c, o.city)} and found ${g} gold.`, [actorId], loc)
      } else log(c, 'search', `${name} searched ${cityName(c, o.city)} and found nothing.`, [actorId], loc)
      return
    }
    case 'study':
      gainXp(o, a.stat, 30, age)
      log(c, 'study', `${name} studied ${a.stat.toUpperCase()}.`, [actorId], loc)
      return
    case 'drill':
      gainXp(o, a.stat, 30, age)
      log(c, 'drill', `${name} drilled ${a.stat.toUpperCase()}.`, [actorId], loc)
      return
    case 'rest':
      o.health = clamp(o.health + 20, 0, 100)
      log(c, 'rest', `${name} rested.`, [actorId], loc)
      return
    case 'recruit': {
      const t = O(c, a.officer)
      if (a.mode === 'debate') {
        const fr = friendship(c, actorId, t.id)
        const bonus = fr < 20 ? 0.1 * Math.floor((20 - fr) / 20) : 0
        const setup = debateSetup(c, `rc|${actorId}|${t.id}`, actorId, t.id, 'recruit', bonus)
        c.s.pending.push({ kind: 'debate', id: newPendingId(c), setup, context: 'recruit' })
        return
      }
      const pct = recruitChance(c, o, t)
      if (roll(c, pct)) recruitSuccess(c, actorId, t.id)
      else log(c, 'recruit', `${nameOf(c, t.id)} declined ${name}.`, [actorId, t.id], loc)
      return
    }
    case 'serve': {
      const p = servePatron(c, o.city!)!
      const pct = serveChance(c, o, p)
      if (roll(c, pct)) {
        joinThrough(c, actorId, p.faction!, friendship(c, actorId, p.id))
        log(c, 'join', `${name} joined ${factionName(c, p.faction)}.`, [actorId, p.id], loc)
      } else log(c, 'serve', `${nameOf(c, p.id)} turned ${name} away.`, [actorId, p.id], loc)
      return
    }
    case 'resign': {
      doResign(c, actorId)
      return
    }
    case 'challenge': {
      const t = O(c, a.officer)
      const accepts = t.stats.war >= o.stats.war - 10 || prof(c, t.id).temperament === 'reckless'
      if (!accepts) { log(c, 'duel', `${nameOf(c, t.id)} declined ${name}'s challenge.`, [actorId, t.id], loc); return }
      if (actorId === c.s.player || t.id === c.s.player) {
        const setup = duelSetup(c, `ch|${actorId}|${t.id}`, actorId, t.id)
        c.s.pending.push({ kind: 'duel', id: newPendingId(c), setup, context: 'challenge' })
        return
      }
      const ra = o.stats.war + o.health / 10 + 20 * rnd(c)
      const rb = t.stats.war + t.health / 10 + 20 * rnd(c)
      applyDuelResult(c, actorId, t.id, Math.abs(ra - rb) < 3 ? null : ra > rb ? actorId : t.id)
      return
    }
    case 'oath': {
      const t = O(c, a.officer)
      doOath(c, [actorId, t.id])
      return
    }
    case 'marry': {
      const t = O(c, a.officer)
      if (t.id !== c.s.player && !roll(c, marryChance(c, actorId, t.id))) {
        log(c, 'marry', `${nameOf(c, t.id)} declined ${name}'s proposal.`, [actorId, t.id], loc)
        return
      }
      doMarry(c, actorId, t.id)
      return
    }
    case 'claim': {
      const comps = companionsOf(c, o).map((x) => x.id)
      foundFaction(c, actorId, city!.id, comps)
      log(c, 'claim', `${name} claimed ${cityName(c, city!.id)} and founded a house.`, [actorId, ...comps], loc)
      normalize(c)
      return
    }
    case 'uprise': {
      const comps = companionsOf(c, o).slice(0, 4).map((x) => x.id)
      uprisingArmy(c, actorId, comps, city!.id)
      log(c, 'uprise', `${name} raised an uprising at ${cityName(c, city!.id)}.`, [actorId, ...comps], loc)
      return
    }
    case 'appoint': {
      const t = O(c, a.officer)
      const ct = C(c, t.city!)
      if (ct.prefect && ct.prefect !== t.id) { const old = O(c, ct.prefect); if (old.post === 'prefect') old.post = 'officer' }
      clearPrefect(c, t.id)
      ct.prefect = t.id
      t.post = 'prefect'
      log(c, 'appoint', `${name} appointed ${nameOf(c, t.id)} prefect of ${cityName(c, ct.id)}.`, [actorId, t.id], ct.id)
      return
    }
    case 'transfer': {
      const t = O(c, a.officer)
      clearPrefect(c, t.id)
      t.city = a.to
      t.days = 0 // RULING: arrives at once, but cannot act this month
      log(c, 'transfer', `${name} sent ${nameOf(c, t.id)} to ${cityName(c, a.to)}.`, [actorId, t.id], a.to)
      return
    }
    case 'mission': {
      const t = O(c, a.officer)
      const m = normalizeMission(c, a.mission)
      if (t.id === c.s.player) {
        c.s.pending.push({ kind: 'offer', id: newPendingId(c), from: actorId, offer: 'mission', text: `${name} asks: ${describeMission(c, m)}.`, mission: m })
      } else {
        t.mission = m
        log(c, 'mission', `${name} gave ${nameOf(c, t.id)} a mission: ${describeMission(c, m)}.`, [actorId, t.id], loc)
      }
      return
    }
    case 'transport': {
      const from = C(c, a.from)
      const to = C(c, a.to)
      from.gold -= a.gold; to.gold += a.gold
      from.rice -= a.rice; to.rice += a.rice
      if (a.troops > 0) {
        const before = to.troops
        to.training = Math.floor((to.training * before + from.training * a.troops) / (before + a.troops))
        from.troops -= a.troops; to.troops += a.troops
      }
      log(c, 'transport', `${name} moved supplies from ${cityName(c, a.from)} to ${cityName(c, a.to)}.`, [actorId], a.to)
      return
    }
    case 'war': {
      const army = createArmy(c, o.faction!, a.from, a.to, a.units)
      log(c, 'war', `${name} sent an army from ${cityName(c, a.from)} against ${cityName(c, a.to)} (${army.units.length} units).`, [actorId, ...army.units.map((u) => u.officer)], a.from)
      return
    }
    case 'diplomacy': {
      doDiplomacy(c, o, a)
      return
    }
    case 'captive': {
      doCaptive(c, o, O(c, a.officer), a.decision)
      return
    }
    case 'focus': {
      C(c, a.city).focus = a.focus as CityFocus
      log(c, 'focus', `${name} set the focus of ${cityName(c, a.city)} to ${a.focus}.`, [actorId], a.city)
      return
    }
    case 'propose': {
      doPropose(c, o, a)
      return
    }
  }
}

export function normalizeMission(c: Ctx, m: Mission): Mission {
  switch (m.kind) {
    case 'develop': return { kind: 'develop', city: m.city, work: m.work, count: m.count, done: 0, deadline: missionDeadline(c, 'develop') }
    case 'recruit': return { kind: 'recruit', officer: m.officer, deadline: missionDeadline(c, 'recruit') }
    case 'scout': return { kind: 'scout', city: m.city, reached: false, deadline: missionDeadline(c, 'scout') }
    case 'envoy': return { kind: 'envoy', faction: m.faction, proposal: m.proposal, deadline: missionDeadline(c, 'envoy') }
  }
}

export function recruitSuccess(c: Ctx, actorId: string, targetId: string): void {
  const a = O(c, actorId)
  const t = O(c, targetId)
  if (!a.faction || t.post !== 'wanderer' || t.status !== 'active') return
  joinThrough(c, targetId, a.faction, friendship(c, actorId, targetId))
  a.merit += 100
  log(c, 'join', `${nameOf(c, targetId)} joined ${factionName(c, a.faction)}, brought by ${nameOf(c, actorId)}.`, [actorId, targetId], t.city ?? undefined)
  if (a.mission?.kind === 'recruit' && a.mission.officer === targetId) completeMission(c, actorId)
}

export function doResign(c: Ctx, actorId: string): void {
  const o = O(c, actorId)
  const fid = o.faction
  if (!fid) return
  const ruler = F(c, fid).ruler
  const followers = o.city
    ? officersIn(c, o.city, (x) => x.id !== actorId && x.faction === fid && x.post !== 'ruler' && sameOath(c, actorId, x.id) && !isBound(c, x)).map((x) => x.id)
    : []
  const fname = factionName(c, fid)
  makeWanderer(c, actorId)
  addFriendship(c, actorId, ruler, -20)
  log(c, 'resign', `${nameOf(c, actorId)} left ${fname}.`, [actorId], o.city ?? undefined)
  for (const f of followers) {
    makeWanderer(c, f)
    log(c, 'resign', `${nameOf(c, f)} followed ${nameOf(c, actorId)} out of ${fname}.`, [f, actorId], o.city ?? undefined)
  }
  normalize(c)
}

export function doOath(c: Ctx, ids: string[]): void {
  const set = new Set<string>()
  for (const id of ids) {
    set.add(id)
    for (const m of groupOf(c, id)) set.add(m)
  }
  const members = [...set].filter((id) => c.s.officers[id] && c.s.officers[id]!.status !== 'dead').slice(0, 4).sort()
  if (members.length < 2) return
  // dissolve old groups of the members
  for (const id of members) {
    const o = O(c, id)
    if (o.oathGroup !== null) {
      const g = c.s.oaths[o.oathGroup]
      if (g) { const k = g.indexOf(id); if (k >= 0) g.splice(k, 1) }
      o.oathGroup = null
    }
  }
  for (const g of c.s.oaths) if (g.length === 1) { const m = c.s.officers[g[0]!]; if (m) m.oathGroup = null; g.length = 0 }
  let gi = c.s.oaths.findIndex((g) => g.length === 0)
  if (gi < 0) { c.s.oaths.push([]); gi = c.s.oaths.length - 1 }
  c.s.oaths[gi] = members.slice()
  for (const id of members) O(c, id).oathGroup = gi
  for (let i = 0; i < members.length; i++) for (let j = i + 1; j < members.length; j++) {
    if (friendship(c, members[i]!, members[j]!) < 80) setFriendship(c, members[i]!, members[j]!, 80)
  }
  log(c, 'oath', `${members.map((m) => nameOf(c, m)).join(', ')} swore an oath of brotherhood.`, members, O(c, members[0]!).city ?? undefined)
}

export function doMarry(c: Ctx, a: string, b: string): void {
  const x = O(c, a)
  const y = O(c, b)
  if (x.spouse || y.spouse) return
  x.spouse = b
  y.spouse = a
  if (friendship(c, a, b) < 70) setFriendship(c, a, b, 70)
  log(c, 'marry', `${nameOf(c, a)} and ${nameOf(c, b)} were married.`, [a, b], x.city ?? undefined)
}

export function applyDuelResult(c: Ctx, a: string, b: string, winner: string | null): void {
  const oa = O(c, a)
  const ob = O(c, b)
  gainXp(oa, 'war', 10, ageOf(c, a))
  gainXp(ob, 'war', 10, ageOf(c, b))
  if (!winner) { log(c, 'duel', `${nameOf(c, a)} and ${nameOf(c, b)} fought to a draw.`, [a, b], oa.city ?? undefined); return }
  const loser = winner === a ? b : a
  O(c, winner).merit += 50
  if (!sameOath(c, winner, loser)) addFriendship(c, winner, loser, -5)
  log(c, 'duel', `${nameOf(c, winner)} defeated ${nameOf(c, loser)} in a duel.`, [a, b], oa.city ?? undefined)
}

export function applyDiploResult(c: Ctx, ownF: string, target: string, proposal: DiploKind, ok: boolean, envoyId: string): void {
  const names = `${factionName(c, ownF)} and ${factionName(c, target)}`
  const env = c.s.officers[envoyId]
  if (ok) {
    addRelation(c, ownF, target, 15)
    if (proposal === 'alliance') {
      c.s.pacts = c.s.pacts.filter((p) => !((p.a === ownF && p.b === target) || (p.a === target && p.b === ownF)))
      const [x, y] = ownF < target ? [ownF, target] : [target, ownF]
      c.s.pacts.push({ a: x, b: y, kind: 'alliance', until: addMonths(c.s.ym, 24) })
      log(c, 'diplomacy', `${names} became allies.`, [envoyId])
    } else if (proposal === 'truce') {
      const [x, y] = ownF < target ? [ownF, target] : [target, ownF]
      c.s.pacts.push({ a: x, b: y, kind: 'truce', until: addMonths(c.s.ym, 12) })
      log(c, 'diplomacy', `${names} agreed a truce.`, [envoyId])
    } else {
      log(c, 'diplomacy', `${factionName(c, target)} yielded to ${factionName(c, ownF)}.`, [envoyId])
      mergeFaction(c, target, ownF)
    }
  } else {
    addRelation(c, ownF, target, -5)
    log(c, 'diplomacy', `${factionName(c, target)} refused ${factionName(c, ownF)}'s ${proposal}.`, [envoyId])
  }
  if (env?.mission?.kind === 'envoy' && env.mission.faction === target && env.mission.proposal === proposal) completeMission(c, envoyId, ok ? 0 : 20)
  normalize(c)
  checkEnd(c)
}

function doDiplomacy(c: Ctx, o: OfficerState, a: Extract<WorldAction, { kind: 'diplomacy' }>): void {
  const env = O(c, a.envoy)
  const ownF = o.faction!
  if (a.mode === 'debate') {
    const ours = totalTroops(c, ownF)
    const theirs = totalTroops(c, a.faction)
    const bonus = theirs > ours ? 0.1 : 0
    const rulerId = F(c, a.faction).ruler
    const setup = debateSetup(c, `dp|${o.id}|${env.id}|${a.faction}|${a.proposal}`, env.id, rulerId, 'diplomacy', bonus)
    c.s.pending.push({ kind: 'debate', id: newPendingId(c), setup, context: 'diplomacy' })
    return
  }
  const pct = diploChance(c, env, ownF, a.faction, a.proposal)
  applyDiploResult(c, ownF, a.faction, a.proposal, roll(c, pct), env.id)
}

export function doCaptive(c: Ctx, ruler: OfficerState, t: OfficerState, decision: 'recruit' | 'release' | 'execute'): void {
  const fid = ruler.faction!
  const name = nameOf(c, ruler.id)
  if (decision === 'recruit') {
    if (roll(c, captiveChance(c, ruler.id, t))) {
      t.status = 'active'
      joinThrough(c, t.id, fid, friendship(c, t.id, ruler.id))
      log(c, 'join', `${nameOf(c, t.id)} yielded and joined ${factionName(c, fid)}.`, [ruler.id, t.id], t.city ?? undefined)
    } else log(c, 'captive', `${nameOf(c, t.id)} refused ${name}.`, [ruler.id, t.id], t.city ?? undefined)
    return
  }
  if (decision === 'release') {
    releaseCaptive(c, t)
    log(c, 'captive', `${name} released ${nameOf(c, t.id)}.`, [ruler.id, t.id], t.city ?? undefined)
    return
  }
  const where = t.city ?? undefined
  log(c, 'captive', `${name} had ${nameOf(c, t.id)} executed.`, [ruler.id, t.id], where)
  killOfficer(c, t.id, 'executed')
  for (const o of factionOfficers(c, fid)) {
    if (prof(c, o.id).temperament === 'righteous' && o.loyalty !== null) o.loyalty = clamp(o.loyalty - 5, 0, 100)
  }
  normalize(c)
}

export function releaseCaptive(c: Ctx, t: OfficerState): void {
  const old = t.faction
  let dest = t.city!
  if (old && c.s.factions[old]?.alive) {
    const near = nearestOwnCityAdjacent(c, old, t.city!)
    if (near) dest = near
  }
  t.status = 'active'
  t.city = dest
  t.faction = null
  t.post = 'wanderer'
  t.loyalty = null
  t.mission = null
}

function nearestOwnCityAdjacent(c: Ctx, fid: string, from: string): string | null {
  let best: string | null = null
  let bd = Infinity
  for (const e of neighbors(c, from)) {
    if (C(c, e.to).faction === fid && e.days < bd) { bd = e.days; best = e.to }
  }
  return best
}

function doPropose(c: Ctx, o: OfficerState, a: Extract<WorldAction, { kind: 'propose' }>): void {
  o.proposedThisMonth = true
  const f = F(c, o.faction!)
  const ruler = O(c, f.ruler)
  let bonus = 0
  let units = a.units
  if (a.proposal === 'war') {
    units = a.units ?? suggestArmyLedBy(c, o.faction!, o.city!, o.id)
    bonus = warContext(c, o.city!, a.to!, units)
  }
  const pct = proposeChance(c, o, ruler, a.proposal, bonus)
  const ok = roll(c, pct)
  const name = nameOf(c, o.id)
  if (!ok) { log(c, 'propose', `${nameOf(c, ruler.id)} turned down ${name}'s ${a.proposal} proposal.`, [o.id, ruler.id], o.city ?? undefined); return }
  log(c, 'propose', `${nameOf(c, ruler.id)} approved ${name}'s ${a.proposal} proposal.`, [o.id, ruler.id], o.city ?? undefined)
  switch (a.proposal) {
    case 'war': {
      const err = checkArmy(c, o.faction!, o.city!, a.to!, units!)
      if (!err) {
        const army = createArmy(c, o.faction!, o.city!, a.to!, units!)
        log(c, 'war', `${name} leads an army from ${cityName(c, army.from)} against ${cityName(c, army.to)}.`, [o.id, ...army.units.map((u) => u.officer)], army.from)
      }
      break
    }
    case 'alliance':
    case 'truce':
      applyDiploResult(c, o.faction!, a.faction!, a.proposal, roll(c, diploChance(c, o, o.faction!, a.faction!, a.proposal)), o.id)
      break
    case 'prefect': {
      const ct = C(c, o.city!)
      if (ct.prefect && ct.prefect !== o.id) { const old = O(c, ct.prefect); if (old.post === 'prefect') old.post = 'officer' }
      ct.prefect = o.id
      o.post = 'prefect'
      log(c, 'appoint', `${name} became prefect of ${cityName(c, ct.id)}.`, [o.id], ct.id)
      break
    }
  }
}

export { d100, succeedRuler, pushLetter, nearestOwnCity, bestType, ymNum, factionCities }
