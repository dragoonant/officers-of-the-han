// W-EVT-1 / 40-events.md: the event interpreter (conditions, effects, the player's choice and its contests).
import type { EventCond, EventDef, EventEffect } from '../contracts/data'
import {
  C, F, O, type Ctx, addFriendship, addMonths, addRelation, cityName, clamp, factionCities, factionName, friendship, log, nameOf, nearestOwnCity,
  newPendingId, pk, roll, setFriendship, ymNum,
} from './core'
import { clearPrefect, checkEnd, joinFaction, killOfficer, makeWanderer, normalize, pushLetter, succeedRuler } from './people'
import { contestant, debateSetup, doMarry, doOath, duelSetup } from './rules'

/** Accept a faction id, or an officer id (meaning that officer's faction). */
function fid(c: Ctx, id: string): string | null {
  if (c.s.factions[id]) return id
  const o = c.s.officers[id]
  return o?.faction ?? null
}

const alive = (c: Ctx, id: string): boolean => {
  const o = c.s.officers[id]
  return !!o && (o.status === 'active' || o.status === 'army' || o.status === 'captive')
}

export function condHolds(c: Ctx, k: EventCond): boolean {
  const s = c.s
  switch (k.kind) {
    case 'officerAlive': return alive(c, k.id)
    case 'officerDead': return s.officers[k.id]?.status === 'dead'
    case 'officerInFaction': return alive(c, k.id) && s.officers[k.id]!.faction === k.faction
    case 'officerIsRuler': return alive(c, k.id) && s.officers[k.id]!.post === 'ruler'
    case 'factionExists': return !!s.factions[k.id]?.alive
    case 'factionHoldsCity': return s.cities[k.city]?.faction === k.faction
    case 'flag': return s.flags.includes(k.id)
    case 'notFlag': return !s.flags.includes(k.id)
    case 'date': {
      const n = ymNum(s.ym)
      if (k.from && n < ymNum(k.from)) return false
      if (k.to && n > ymNum(k.to)) return false
      return true
    }
    case 'relationBelow': {
      const a = fid(c, k.a)
      const b = fid(c, k.b)
      if (!a || !b) return false
      return (s.relations[pk(a, b)] ?? 30) < k.value
    }
  }
}

function effectRefs(e: EventEffect): { officers: string[]; factions: string[] } {
  switch (e.kind) {
    case 'moveOfficer': case 'makeWanderer': case 'killOfficer': case 'merit': return { officers: [e.id], factions: [] }
    case 'joinFaction': return { officers: [e.id], factions: [e.faction] }
    case 'transferCity': return { officers: [], factions: [e.faction] }
    case 'moveCapital': return { officers: [], factions: [e.faction] }
    case 'setRuler': return { officers: [e.id], factions: [e.faction] }
    case 'alliance': case 'endAlliance': return { officers: [], factions: e.factions }
    case 'friendship': return { officers: [e.a, e.b], factions: [] }
    case 'oath': return { officers: e.ids, factions: [] }
    case 'marry': return { officers: [e.a, e.b], factions: [] }
    case 'item': return { officers: [e.officer], factions: [] }
    default: return { officers: [], factions: [] }
  }
}

/** E-5: an event whose referenced officers or factions no longer fit never fires. */
export function eventFits(c: Ctx, ev: EventDef): boolean {
  const lists: EventEffect[][] = [ev.effects]
  for (const o of ev.options ?? []) {
    lists.push(o.effects)
  }
  for (const list of lists.slice(0, 1)) {
    for (const e of list) {
      const r = effectRefs(e)
      for (const id of r.officers) if (!alive(c, id)) return false
      for (const f of r.factions) if (!c.s.factions[f]?.alive) return false
    }
  }
  return true
}

export function playerInvolved(c: Ctx, ev: EventDef): boolean {
  const po = c.s.officers[c.s.player]
  if (!po || po.status === 'dead') return false
  if (ev.involves?.includes(po.id)) return true
  if (po.post === 'ruler' && po.faction && ev.involvesFaction?.includes(po.faction)) return true
  return false
}

export function applyEffects(c: Ctx, effects: EventEffect[]): void {
  for (const e of effects) applyEffect(c, e)
  normalize(c)
  checkEnd(c)
}

function applyEffect(c: Ctx, e: EventEffect): void {
  const s = c.s
  switch (e.kind) {
    case 'setFlag':
      if (!s.flags.includes(e.id)) s.flags.push(e.id)
      return
    case 'moveOfficer': {
      const o = s.officers[e.id]
      if (!o || o.status !== 'active' || !s.cities[e.city]) return
      clearPrefect(c, e.id)
      o.city = e.city
      return
    }
    case 'joinFaction': {
      const o = s.officers[e.id]
      const f = s.factions[e.faction]
      if (!o || !f || !f.alive || !alive(c, e.id)) return
      if (o.faction === e.faction && (e.post ?? 'officer') === o.post) return
      if (o.faction && o.faction !== e.faction) makeWanderer(c, e.id)
      if (o.status === 'captive') o.status = 'active'
      const post = e.post ?? 'officer'
      if (post === 'ruler') {
        const old = F(c, e.faction).ruler
        joinFaction(c, e.id, e.faction, 0, 'ruler')
        if (old !== e.id && s.officers[old] && s.officers[old]!.post === 'ruler') s.officers[old]!.post = 'officer'
        f.ruler = e.id
      } else joinFaction(c, e.id, e.faction, 60, post === 'prefect' ? 'officer' : post)
      if (!o.city || C(c, o.city).faction !== e.faction) o.city = f.capital
      if (post === 'prefect') {
        const ct = C(c, o.city)
        if (ct.faction === e.faction && ct.prefect !== e.id) {
          if (ct.prefect) { const old = O(c, ct.prefect); if (old.post === 'prefect') old.post = 'officer' }
          ct.prefect = e.id
          o.post = 'prefect'
        }
      }
      return
    }
    case 'makeWanderer': {
      const o = s.officers[e.id]
      if (!o || !alive(c, e.id)) return
      if (o.status === 'captive') o.status = 'active'
      makeWanderer(c, e.id, e.city)
      return
    }
    case 'killOfficer':
      killOfficer(c, e.id, '')
      return
    case 'transferCity': {
      const ct = s.cities[e.city]
      const f = s.factions[e.faction]
      if (!ct || !f || !f.alive || ct.faction === e.faction) return
      const prev = ct.faction
      ct.faction = e.faction
      ct.prefect = null
      if (prev) {
        for (const id of Object.keys(s.officers).sort()) {
          const o = s.officers[id]!
          if (o.status === 'active' && o.faction === prev && o.city === e.city) {
            const dest = nearestOwnCity(c, prev, e.city, e.city)
            clearPrefect(c, id)
            if (dest) o.city = dest
          }
        }
      }
      return
    }
    case 'moveCapital': {
      const f = s.factions[e.faction]
      if (!f || !f.alive || !s.cities[e.city] || s.cities[e.city]!.faction !== e.faction) return
      f.capital = e.city
      return
    }
    case 'setRuler': {
      const f = s.factions[e.faction]
      const o = s.officers[e.id]
      if (!f || !f.alive || !o || !alive(c, e.id)) return
      if (f.ruler === e.id && o.post === 'ruler') return
      const old = f.ruler
      if (o.faction && o.faction !== e.faction) makeWanderer(c, e.id)
      if (o.status === 'captive') o.status = 'active'
      clearPrefect(c, e.id)
      joinFaction(c, e.id, e.faction, 0, 'ruler')
      f.ruler = e.id
      const oo = s.officers[old]
      if (oo && old !== e.id && oo.post === 'ruler') oo.post = oo.faction === e.faction ? 'officer' : oo.post
      if (!o.city || C(c, o.city).faction !== e.faction) o.city = f.capital
      return
    }
    case 'alliance': {
      const fs = e.factions.filter((f) => s.factions[f]?.alive)
      for (let i = 0; i < fs.length; i++) for (let j = i + 1; j < fs.length; j++) {
        const [a, b] = fs[i]! < fs[j]! ? [fs[i]!, fs[j]!] : [fs[j]!, fs[i]!]
        s.pacts = s.pacts.filter((p) => !(p.a === a && p.b === b))
        s.pacts.push({ a, b, kind: 'alliance', until: addMonths(s.ym, e.months) })
      }
      return
    }
    case 'endAlliance': {
      const fs = e.factions
      s.pacts = s.pacts.filter((p) => !(p.kind === 'alliance' && fs.includes(p.a) && fs.includes(p.b)))
      return
    }
    case 'relation': {
      const a = fid(c, e.a)
      const b = fid(c, e.b)
      if (a && b && a !== b) addRelation(c, a, b, e.delta)
      return
    }
    case 'cityDelta': {
      const ct = s.cities[e.city]
      const def = c.d.cityDef.get(e.city)
      if (!ct || !def) return
      const max = e.field === 'farm' ? def.farmMax : e.field === 'trade' ? def.tradeMax : e.field === 'walls' ? def.wallsMax : e.field === 'order' ? 100 : Infinity
      ct[e.field] = clamp(ct[e.field] + e.delta, 0, max)
      return
    }
    case 'friendship': {
      if (alive(c, e.a) && alive(c, e.b)) addFriendship(c, e.a, e.b, e.delta)
      return
    }
    case 'merit': {
      const o = s.officers[e.id]
      if (o && alive(c, e.id)) o.merit = Math.max(0, o.merit + e.delta)
      return
    }
    case 'oath': {
      const ids = e.ids.filter((id) => alive(c, id))
      if (ids.length >= 2) doOath(c, ids)
      return
    }
    case 'marry': {
      if (alive(c, e.a) && alive(c, e.b)) doMarry(c, e.a, e.b)
      return
    }
    case 'item': {
      const o = s.officers[e.officer]
      if (o && alive(c, e.officer) && !o.items.includes(e.item)) o.items.push(e.item)
      return
    }
  }
}

/** Runs the events stage from `start`. Returns 'paused' when the player must choose. */
export function runEventsStage(c: Ctx, start: number): 'done' | 'paused' {
  const events = c.d.data.events
  if (!c.s.options.events) return 'done'
  for (let i = start; i < events.length; i++) {
    const ev = events[i]!
    if (c.s.firedEvents.includes(ev.id)) continue
    const n = ymNum(c.s.ym)
    if (n < ymNum(ev.from) || n > ymNum(ev.to)) continue
    if (!ev.conditions.every((k) => condHolds(c, k))) continue
    if (!eventFits(c, ev)) continue
    if (!roll(c, ev.chance)) continue
    c.s.firedEvents.push(ev.id)
    const involved = playerInvolved(c, ev)
    if (involved && ev.options && ev.options.length > 0) {
      c.s.pending.push({ kind: 'eventChoice', id: newPendingId(c), eventId: ev.id, title: ev.title, text: ev.text, options: ev.options.map((o) => ({ label: o.label })) })
      c.s.cursor = { stage: 'events', index: i + 1 }
      log(c, 'event', ev.title, [c.s.player])
      return 'paused'
    }
    applyEffects(c, ev.effects)
    log(c, 'event', ev.title, [], undefined)
    if (ev.major || involved) pushLetter(c, ev.title, ev.text)
    if (c.s.phase === 'ended') return 'done'
  }
  return 'done'
}

/** The player chose an option. Returns an error message or null. */
export function answerEventChoice(c: Ctx, pendingId: string, option: number): string | null {
  const p = c.s.pending[0]
  if (!p || p.kind !== 'eventChoice' || p.id !== pendingId) return 'No such decision.'
  const ev = c.d.data.events.find((e) => e.id === p.eventId)
  if (!ev || !ev.options) { c.s.pending.shift(); return null }
  if (!Number.isInteger(option) || option < 0 || option >= ev.options.length) return 'No such option.'
  c.s.pending.shift()
  const opt = ev.options[option]!
  applyEffects(c, opt.effects)
  log(c, 'event', `${ev.title}: ${opt.text}`, [c.s.player])
  const ct = opt.contest
  if (ct) {
    const a = c.s.officers[ct.a]
    const b = c.s.officers[ct.b]
    if (a && b && a.status === 'active' && b.status === 'active') {
      const tag = `ev|${ev.id}|${option}`
      if (ct.kind === 'duel') c.s.pending.unshift({ kind: 'duel', id: newPendingId(c), setup: duelSetup(c, tag, ct.a, ct.b), context: 'event' })
      else c.s.pending.unshift({ kind: 'debate', id: newPendingId(c), setup: debateSetup(c, tag, ct.a, ct.b, 'event', 0), context: 'event' })
    } else applyEffects(c, ct.onLoss)
  }
  return null
}

/** A duel/debate tagged `ev|eventId|option` finished. */
export function finishEventContest(c: Ctx, setupId: string, aWon: boolean): void {
  const parts = setupId.split('|')
  const ev = c.d.data.events.find((e) => e.id === parts[1])
  const opt = ev?.options?.[Number(parts[2])]
  if (!ev || !opt?.contest) return
  applyEffects(c, aWon ? opt.contest.onWin : opt.contest.onLoss)
  log(c, 'event', `${ev.title}: ${aWon ? 'won' : 'lost'}.`, [c.s.player])
}

export { contestant, cityName, factionName, friendship, setFriendship, factionCities, nameOf, succeedRuler }
