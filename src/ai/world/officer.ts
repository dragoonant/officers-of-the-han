// W-AI-3: what an AI officer does with its month. Returns the next action; the caller checks and applies it through the rule functions.
import type { WorkKind, WorldAction } from '../../contracts/world'
import {
  C, O, type Ctx, compat, friendship, isKin, isRival, newPendingId, officersIn, pactBetween, roll, rnd, sameOath, ageOf, distance, neighbors, nameOf, log, cityName,
} from '../../world/core'
import { applyAction, checkAction, groupOf, servePatron, workInfo } from '../../world/rules'
import { normalize } from '../../world/people'

export function isBorder(c: Ctx, cityId: string): boolean {
  const f = C(c, cityId).faction
  for (const e of neighbors(c, cityId)) {
    const t = C(c, e.to)
    if (t.faction !== f && !(f && t.faction && pactBetween(c, f, t.faction))) return true
  }
  return false
}

/** One hop toward `target`, through own cities or the target itself. */
export function hopToward(c: Ctx, from: string, target: string, fid: string | null): string | null {
  if (from === target) return null
  const here = distance(c, from, target)
  let best: string | null = null
  let bd = here
  for (const e of neighbors(c, from)) {
    if (e.to !== target && fid !== null && C(c, e.to).faction !== fid) continue
    const d = distance(c, e.to, target)
    if (d < bd || (d === bd && best !== null && e.to < best && d < here)) { bd = d; best = e.to }
  }
  return best
}

function nearestOwn(c: Ctx, fid: string, from: string): string | null {
  let best: string | null = null
  let bd = Infinity
  for (const cid of c.d.cityIds) {
    if (C(c, cid).faction !== fid) continue
    const d = distance(c, from, cid)
    if (d < bd) { bd = d; best = cid }
  }
  return best
}

/** Months of upkeep a city pays before the next harvest arrives (rice income is at the start of month 9, W-ECO-2). */
export function monthsToHarvest(c: Ctx): number {
  const m = c.s.ym.month
  return m <= 8 ? 8 - m : 20 - m
}

/** The rice a city of `troops` soldiers needs to reach the harvest, with one month to spare (W-AI-6). */
export function riceNeeded(c: Ctx, troops: number): number {
  return (monthsToHarvest(c) + 1) * Math.ceil(troops / 100)
}

const ok = (c: Ctx, id: string, a: WorldAction): WorldAction | null => (checkAction(c, id, a) === null ? a : null)

function workChoice(c: Ctx, id: string): WorldAction | null {
  const o = O(c, id)
  const ct = C(c, o.city!)
  const def = c.d.cityDef.get(ct.id)!
  const reserve = officersIn(c, ct.id, (x) => x.faction === ct.faction).length * 30
  const usable = (w: WorkKind): boolean => {
    const info = workInfo(c, o, w)
    if (info.capped) return false
    if (info.gold > 0 && ct.gold - info.gold < reserve) return false
    if (w === 'draft' && (ct.population < 4000 || ct.order < 50)) return false
    if (w === 'draft' && ct.rice < riceNeeded(c, ct.troops + info.gain)) return false // W-AI-6: never draft into a famine
    return checkAction(c, id, { kind: 'work', work: w }) === null
  }
  const ratios: [WorkKind, number][] = [
    ['farm', ct.farm / Math.max(1, def.farmMax)],
    ['trade', ct.trade / Math.max(1, def.tradeMax)],
    ['order', ct.order / 100],
    ['walls', ct.walls / Math.max(1, def.wallsMax)],
  ]
  const balanced = ratios.slice().sort((a, b) => a[1] - b[1]).map((x) => x[0])
  const order: WorkKind[] = []
  if (ct.order < 40) order.push('order')
  const border = isBorder(c, ct.id)
  switch (ct.focus) {
    case 'farm': order.push('farm'); break
    case 'trade': order.push('trade'); break
    case 'defense': order.push('walls', 'train'); break
    case 'military': order.push('draft', 'train'); break
    default:
      if (border && ct.troops < 5000) order.push('draft', 'train')
      else if (border && ct.training < 70) order.push('train')
  }
  order.push(...balanced)
  if (ct.training < 40) order.push('train')
  for (const w of order) if (usable(w)) return { kind: 'work', work: w }
  return null
}

function missionAction(c: Ctx, id: string): WorldAction | null {
  const o = O(c, id)
  const m = o.mission!
  switch (m.kind) {
    case 'develop': {
      if (o.city === m.city) return ok(c, id, { kind: 'work', work: m.work })
      const hop = hopToward(c, o.city!, m.city, o.faction)
      return hop ? ok(c, id, { kind: 'travel', to: hop }) : null
    }
    case 'recruit': {
      const t = c.s.officers[m.officer]
      if (!t || t.status !== 'active' || t.post !== 'wanderer' || !t.city) return null
      if (t.city === o.city) return ok(c, id, { kind: 'recruit', officer: t.id, mode: 'persuade' })
      const hop = hopToward(c, o.city!, t.city, o.faction)
      return hop ? ok(c, id, { kind: 'travel', to: hop }) : null
    }
    case 'scout': {
      if (m.reached) return returnHome(c, id)
      if (o.city === m.city) return null
      const hop = hopToward(c, o.city!, m.city, o.faction)
      return hop ? ok(c, id, { kind: 'travel', to: hop }) : null
    }
    case 'envoy':
      return ok(c, id, { kind: 'diplomacy', envoy: id, faction: m.faction, proposal: m.proposal, mode: 'roll' })
  }
}

function returnHome(c: Ctx, id: string): WorldAction | null {
  const o = O(c, id)
  if (!o.faction) return null
  const home = nearestOwn(c, o.faction, o.city!)
  if (!home || home === o.city) return null
  const hop = hopToward(c, o.city!, home, o.faction)
  return hop ? ok(c, id, { kind: 'travel', to: hop }) : null
}

function wandererAction(c: Ctx, id: string): WorldAction | null {
  const o = O(c, id)
  const ct = C(c, o.city!)
  if (ct.faction === null) {
    const claim = ok(c, id, { kind: 'claim' })
    if (claim) return claim
  }
  if (o.days === 30) {
    const patron = servePatron(c, ct.id)
    if (patron && !isRival(c, id, patron.id) && roll(c, 30)) {
      const a = ok(c, id, { kind: 'serve' })
      if (a) return a
    }
  }
  if (o.days < 5) return null
  if (rnd(c) < 0.5 && o.days >= 10) return ok(c, id, { kind: 'search' })
  const ns = neighbors(c, ct.id).filter((e) => e.days <= o.days)
  if (ns.length === 0) return null
  const e = ns[Math.floor(rnd(c) * ns.length)]!
  return ok(c, id, { kind: 'travel', to: e.to })
}

export function nextOfficerAction(c: Ctx, id: string): WorldAction | null {
  const o = O(c, id)
  if (o.status !== 'active' || !o.city || o.hidden || o.days <= 0) return null
  if (o.mission) {
    const a = missionAction(c, id)
    if (a) return a
    // W-AI-3: a scout that has arrived stays until the month ends (that is what marks it reached), instead of walking home with the day budget
    if (o.mission.kind === 'scout' && !o.mission.reached && o.city === o.mission.city) return null
  }
  if (o.post === 'wanderer') return wandererAction(c, id)
  const ct = C(c, o.city)
  if (ct.faction !== o.faction) return returnHome(c, id)
  if (o.days === 30 && roll(c, 20)) {
    let best: string | null = null
    let bf = -1
    for (const x of officersIn(c, ct.id, (y) => y.id !== id)) {
      const f = friendship(c, id, x.id)
      if (f > bf && checkAction(c, id, { kind: 'visit', officer: x.id }) === null) { bf = f; best = x.id }
    }
    if (best) return { kind: 'visit', officer: best }
  }
  return workChoice(c, id)
}

/** Everything one AI officer does this month, via the rule functions. */
export function runOfficerTurn(c: Ctx, id: string): void {
  offerToPlayer(c, id)
  for (let i = 0; i < 8; i++) {
    const a = nextOfficerAction(c, id)
    if (!a) break
    if (checkAction(c, id, a) !== null) break
    applyAction(c, id, a)
    if (a.kind === 'resign' || a.kind === 'claim') normalize(c)
    if (O(c, id).status !== 'active') break
  }
}

/** AI officers sometimes offer the player a place, an oath or a marriage (offer pendings). */
function offerToPlayer(c: Ctx, id: string): void {
  const pl = c.s.officers[c.s.player]
  const o = O(c, id)
  if (!pl || pl.status !== 'active' || pl.city !== o.city || id === pl.id || pl.hidden) return
  if (c.s.pending.filter((p) => p.kind === 'offer').length >= 3) return
  if (c.s.pending.some((p) => p.kind === 'offer' && p.from === id)) return
  const name = nameOf(c, id)
  const f = friendship(c, id, pl.id)
  if (isRival(c, id, pl.id)) return
  if (pl.post === 'wanderer' && o.faction && o.post === 'ruler' && roll(c, 20)) {
    c.s.pending.push({ kind: 'offer', id: newPendingId(c), from: id, offer: 'recruit', text: `${name} invites you to join ${c.s.factions[o.faction]!.name}.` })
    return
  }
  if (f >= 80 && !sameOath(c, id, pl.id) && compat(c, id, pl.id) >= 0 && new Set([id, pl.id, ...groupOf(c, id), ...groupOf(c, pl.id)]).size <= 4 && roll(c, 15)) {
    c.s.pending.push({ kind: 'offer', id: newPendingId(c), from: id, offer: 'oath', text: `${name} proposes that you swear an oath of brotherhood.` })
    return
  }
  if (f >= 70 && !o.spouse && !pl.spouse && ageOf(c, id) >= 16 && ageOf(c, pl.id) >= 16 && !isKin(c, id, pl.id) && roll(c, 10)) {
    c.s.pending.push({ kind: 'offer', id: newPendingId(c), from: id, offer: 'marry', text: `${name} asks for your hand.` })
  }
}

export { log, cityName }
