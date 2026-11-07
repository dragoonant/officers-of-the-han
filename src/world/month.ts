// The month pipeline (W-TIME-3): a resumable cursor over the stages below. See step.ts for the RNG draw order.
import type { Pending } from '../contracts/world'
import { runCourt } from '../ai/world/ruler'
import { runOfficerTurn } from '../ai/world/officer'
import {
  C, F, O, type Ctx, addMonths, ageOf, cityName, clamp, expectedTier, factionName, friendship, hasBlocking, isBound, log, nameOf,
  newPendingId, prof, rankOf, roll, salaryOf, sortedIds, ymNum,
} from './core'
import { runEventsStage } from './events'
import { captiveChance, doResign, releaseCaptive, failMission, completeMission } from './rules'
import { captureOfficer, checkEnd, foundFaction, joinFaction, killOfficer, normalize, pushLetter, rebelCity } from './people'
import { runArmiesStage } from './war'

export const STAGES = ['ai-officers', 'armies', 'captives', 'events', 'deaths', 'loyalty', 'missions', 'month-start'] as const

export function startPipeline(c: Ctx): void {
  c.s.phase = 'world'
  c.s.cursor = { stage: STAGES[0], index: 0 }
  runPipeline(c)
}

export function runPipeline(c: Ctx): void {
  let guard = 0
  while (c.s.cursor && guard++ < 64) {
    if (hasBlocking(c)) return
    const cur = c.s.cursor
    const r = runStage(c, cur.stage, cur.index)
    if (r === 'paused') return
    if (c.s.phase === 'ended') { c.s.cursor = null; return }
    const k = STAGES.indexOf(cur.stage as (typeof STAGES)[number])
    c.s.cursor = k + 1 < STAGES.length ? { stage: STAGES[k + 1]!, index: 0 } : null
  }
}

function runStage(c: Ctx, stage: string, index: number): 'done' | 'paused' {
  switch (stage) {
    case 'ai-officers': return stageAiOfficers(c, index)
    case 'armies': return runArmiesStage(c)
    case 'captives': stageCaptives(c); return 'done'
    case 'events': return runEventsStage(c, index)
    case 'deaths': stageDeaths(c); return 'done'
    case 'loyalty': stageLoyalty(c); return 'done'
    case 'missions': stageMissions(c); return 'done'
    case 'month-start': monthStart(c, false); return 'done'
    default: return 'done'
  }
}

function stageAiOfficers(c: Ctx, _start: number): 'done' | 'paused' {
  c.ai = true
  for (const id of sortedIds(c.s.officers)) {
    const o = c.s.officers[id]!
    if (o.status !== 'active' || o.hidden || id === c.s.player) continue
    runOfficerTurn(c, id)
  }
  c.ai = false
  return 'done'
}

function stageCaptives(c: Ctx): void {
  const po = c.s.officers[c.s.player]
  if (!po || po.status !== 'captive' || c.s.pending.some((p) => p.kind === 'captured')) return
  const ct = po.city ? C(c, po.city) : null
  const fid = ct?.faction
  if (!fid) { releaseCaptive(c, po); return }
  const ruler = F(c, fid).ruler
  const can = roll(c, captiveChance(c, ruler, po))
  c.s.pending.push({
    kind: 'captured', id: newPendingId(c), captor: ruler, canJoin: can,
    text: can
      ? `${nameOf(c, po.id)} is held at ${cityName(c, po.city)} by ${factionName(c, fid)}. ${nameOf(c, ruler)} offers a place in the house.`
      : `${nameOf(c, po.id)} is held at ${cityName(c, po.city)} by ${factionName(c, fid)}. No offer is made; ${nameOf(c, ruler)} will decide.`,
  })
}

export function answerCaptured(c: Ctx, pendingId: string, join: boolean): string | null {
  const p = c.s.pending[0]
  if (!p || p.kind !== 'captured' || p.id !== pendingId) return 'No such decision.'
  const po = O(c, c.s.player)
  if (join && !p.canJoin) return 'No offer was made.'
  c.s.pending.shift()
  if (po.status !== 'captive') return null
  const fid = po.city ? C(c, po.city).faction : null
  if (join && fid) {
    po.status = 'active'
    joinFaction(c, po.id, fid, 60 + Math.floor(friendship(c, po.id, F(c, fid).ruler) / 4))
    log(c, 'join', `${nameOf(c, po.id)} yielded and joined ${factionName(c, fid)}.`, [po.id], po.city ?? undefined)
  } else {
    releaseCaptive(c, po)
    log(c, 'captive', `${nameOf(c, po.id)} was released.`, [po.id], po.city ?? undefined)
  }
  return null
}

function stageDeaths(c: Ctx): void {
  const n = ymNum(c.s.ym)
  for (const id of sortedIds(c.s.officers)) {
    const o = c.s.officers[id]!
    if (o.status !== 'active' && o.status !== 'army' && o.status !== 'captive') continue
    if (o.health <= 0) { killOfficer(c, id, 'of wounds'); continue }
    if (c.s.options.lifespans && o.deathYM && ymNum(o.deathYM) <= n) killOfficer(c, id, 'of old age')
  }
  normalize(c)
  checkEnd(c)
}

const MOOD = { righteous: 10, steady: 5, cautious: 0, reckless: 0, ambitious: -10 } as const

function stageLoyalty(c: Ctx): void {
  for (const id of sortedIds(c.s.officers)) {
    const o = c.s.officers[id]!
    if (o.status !== 'active' || !o.faction || o.post === 'ruler' || o.post === 'wanderer' || o.loyalty === null) continue
    const f = c.s.factions[o.faction]
    if (!f) continue
    const bound = isBound(c, o)
    if (bound) { o.loyalty = 100; continue }
    const fit = rankOf(o) >= expectedTier(o) ? 10 : -10
    const t = clamp(40 + Math.floor(friendship(c, id, f.ruler) / 2) + fit + MOOD[prof(c, id).temperament], 0, 100)
    const gap = t - o.loyalty
    o.loyalty = Math.abs(gap) < 2 ? t : o.loyalty + (gap > 0 ? 2 : -2)
    if (id === c.s.player) continue
    if (o.loyalty < 30 && roll(c, (30 - o.loyalty) * 2)) { doResign(c, id); continue }
    if (o.post === 'prefect' && prof(c, id).temperament === 'ambitious' && o.loyalty < 25 && roll(c, 10)) rebelCity(c, id, 'rebelled against')
  }
}

function stageMissions(c: Ctx): void {
  const n = ymNum(c.s.ym)
  for (const id of sortedIds(c.s.officers)) {
    const o = c.s.officers[id]!
    if (!o.mission || o.status === 'dead') continue
    let m = o.mission
    if (m.kind === 'scout') {
      if (o.city === m.city && !m.reached) { m = { ...m, reached: true }; o.mission = m }
      if (m.reached && o.city && o.faction && C(c, o.city).faction === o.faction && o.city !== m.city) { completeMission(c, id); continue }
    }
    if (n >= ymNum(m.deadline)) failMission(c, id)
  }
}

/** Month start: income, upkeep, salaries, growth, coming of age, day reset, AI courts. `initial` skips the clock and the economy (new game). */
export function monthStart(c: Ctx, initial: boolean): void {
  const s = c.s
  if (!initial) {
    s.ym = addMonths(s.ym, 1)
    s.pacts = s.pacts.filter((p) => ymNum(s.ym) < ymNum(p.until))
    for (const cid of c.d.cityIds) {
      const ct = C(c, cid)
      if (!ct.faction) continue // W-ECO-6
      ct.gold += Math.floor((ct.trade * (50 + ct.order)) / 400) // W-ECO-1
      if (s.ym.month === 9) ct.rice += Math.floor((ct.farm * (50 + ct.order)) / 20) // W-ECO-2
      const need = Math.ceil(ct.troops / 100) // W-ECO-3
      if (ct.rice >= need) ct.rice -= need
      else {
        ct.rice = 0
        ct.troops -= Math.floor(ct.troops / 10)
        ct.order = Math.max(0, ct.order - 5)
        log(c, 'famine', `${cityName(c, cid)} could not feed its troops.`, [], cid)
      }
    }
    for (const id of sortedIds(s.officers)) { // W-ECO-4
      const o = s.officers[id]!
      if (!o.faction || o.post === 'ruler' || o.post === 'wanderer' || (o.status !== 'active' && o.status !== 'army')) continue
      const ct = o.city ? C(c, o.city) : null
      if (!ct || ct.faction !== o.faction) continue
      const pay = salaryOf(o)
      if (ct.gold >= pay) { ct.gold -= pay; o.gold += pay }
      else if (o.loyalty !== null) o.loyalty = Math.max(0, o.loyalty - 3)
    }
    for (const cid of c.d.cityIds) { // W-ECO-5
      const ct = C(c, cid)
      if (ct.faction) ct.population += Math.floor((ct.population * ct.order) / 20000)
    }
  }
  for (const id of sortedIds(s.officers)) {
    const o = s.officers[id]!
    if (o.status === 'dead' || o.status === 'unborn') continue
    if (!initial) o.health = clamp(o.health + 10, 0, 100) // W-OFF-8
    o.days = 30
    o.visitedThisMonth = []
    o.proposedThisMonth = false
  }
  comingOfAge(c)
  // AI courts
  c.ai = true
  for (const fid of sortedIds(s.factions)) {
    const f = s.factions[fid]!
    if (!f.alive || f.ruler === s.player) continue
    const r = s.officers[f.ruler]
    if (!r || r.status !== 'active') continue
    runCourt(c, fid)
  }
  c.ai = false
  normalize(c)
  s.phase = 'player'
  s.cursor = null
  checkEnd(c)
}

function comingOfAge(c: Ctx): void {
  const sc = c.d.data.scenarios.find((x) => x.id === c.s.scenario)
  if (!sc) return
  for (const a of sc.appearances) {
    const o = c.s.officers[a.id]
    if (!o || o.status !== 'unborn' || a.year > c.s.ym.year) continue
    const f = a.faction ? c.s.factions[a.faction] : undefined
    const city = c.s.cities[a.city] ? a.city : c.d.cityIds[0]!
    o.status = 'active'
    o.health = 100
    o.days = 30
    if (f && f.alive && !a.hidden) {
      joinFaction(c, a.id, f.id, 60)
      o.city = C(c, city).faction === f.id ? city : f.capital
    } else {
      o.faction = null
      o.post = 'wanderer'
      o.loyalty = null
      o.city = city
      o.hidden = !!a.hidden
    }
    log(c, 'appear', `${nameOf(c, a.id)} came of age (${ageOf(c, a.id)}).`, [a.id], o.city ?? undefined)
  }
}

export type { Pending }
