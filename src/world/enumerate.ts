// Candidate instances of each action kind for an actor: legalActions lists one canonical legal instance per kind
// (all instances for kinds with a small enumerated parameter: work, travel, study, drill).
import type { DiploKind, WorkKind, WorldAction } from '../contracts/world'
import { C, F, type Ctx, factionCities, factionOfficers, neighbors, officersIn, sortedIds } from './core'
import { checkAction } from './rules'
import { suggestArmy } from './war'

export const KINDS: WorldAction['kind'][] = [
  'work', 'travel', 'visit', 'banquet', 'gift', 'search', 'study', 'drill', 'rest', 'recruit', 'serve', 'resign', 'challenge', 'oath', 'marry', 'claim', 'uprise',
  'appoint', 'transfer', 'mission', 'transport', 'war', 'diplomacy', 'captive', 'focus', 'propose',
]
const ENUMERATED = new Set<string>(['work', 'travel', 'study', 'drill'])
const WORKS: WorkKind[] = ['farm', 'trade', 'walls', 'order', 'train', 'draft']

/** Every action of this kind worth trying (not yet checked). */
export function candidates(c: Ctx, actorId: string, kind: WorldAction['kind']): WorldAction[] {
  const o = c.s.officers[actorId]
  if (!o || !o.city) return []
  const out: WorldAction[] = []
  const here = officersIn(c, o.city, (x) => x.id !== actorId)
  switch (kind) {
    case 'work': for (const w of WORKS) out.push({ kind: 'work', work: w }); break
    case 'travel': for (const e of neighbors(c, o.city)) out.push({ kind: 'travel', to: e.to }); break
    case 'visit': for (const t of here) out.push({ kind: 'visit', officer: t.id }); break
    case 'banquet': out.push({ kind: 'banquet' }); break
    case 'gift':
      for (const t of here) out.push({ kind: 'gift', officer: t.id, gold: 50 })
      if (o.post === 'ruler' && o.faction) {
        for (const t of factionOfficers(c, o.faction)) if (t.id !== actorId && t.loyalty !== null && t.loyalty < 60) out.push({ kind: 'gift', officer: t.id, gold: 100, fromCity: true })
      }
      break
    case 'search': out.push({ kind: 'search' }); break
    case 'study': out.push({ kind: 'study', stat: 'int' }, { kind: 'study', stat: 'pol' }); break
    case 'drill': out.push({ kind: 'drill', stat: 'war' }, { kind: 'drill', stat: 'ldr' }); break
    case 'rest': out.push({ kind: 'rest' }); break
    case 'recruit': for (const t of here) if (t.post === 'wanderer') out.push({ kind: 'recruit', officer: t.id, mode: 'persuade' }); break
    case 'serve': out.push({ kind: 'serve' }); break
    case 'resign': out.push({ kind: 'resign' }); break
    case 'challenge': for (const t of here) out.push({ kind: 'challenge', officer: t.id }); break
    case 'oath': for (const t of here) out.push({ kind: 'oath', officer: t.id }); break
    case 'marry': for (const t of here) out.push({ kind: 'marry', officer: t.id }); break
    case 'claim': out.push({ kind: 'claim' }); break
    case 'uprise': out.push({ kind: 'uprise' }); break
    case 'appoint': {
      if (o.post !== 'ruler' || !o.faction) break
      for (const t of factionOfficers(c, o.faction)) if (t.id !== actorId && t.status === 'active') out.push({ kind: 'appoint', officer: t.id })
      break
    }
    case 'transfer': {
      if (o.post !== 'ruler' || !o.faction) break
      const cities = factionCities(c, o.faction)
      for (const t of factionOfficers(c, o.faction)) if (t.id !== actorId && t.status === 'active') for (const to of cities) if (to !== t.city) out.push({ kind: 'transfer', officer: t.id, to })
      break
    }
    case 'mission': {
      if (o.post !== 'ruler' || !o.faction) break
      for (const t of factionOfficers(c, o.faction)) {
        if (t.id === actorId || t.status !== 'active' || t.mission || !t.city) continue
        if (C(c, t.city).faction === o.faction) out.push({ kind: 'mission', officer: t.id, mission: { kind: 'develop', city: t.city, work: 'farm', count: 2, done: 0, deadline: { ...c.s.ym } } })
      }
      break
    }
    case 'transport': {
      if (!o.faction) break
      const cities = factionCities(c, o.faction)
      for (const from of cities) {
        const fc = C(c, from)
        for (const e of neighbors(c, from)) if (C(c, e.to).faction === o.faction) out.push({ kind: 'transport', from, to: e.to, gold: Math.floor(fc.gold / 2), rice: Math.floor(fc.rice / 4), troops: Math.floor(fc.troops / 4) })
      }
      break
    }
    case 'war': {
      if (o.post !== 'ruler' || !o.faction) break
      for (const from of factionCities(c, o.faction)) {
        for (const e of neighbors(c, from)) {
          if (C(c, e.to).faction === o.faction) continue
          const units = suggestArmy(c, o.faction, from)
          if (units.length) out.push({ kind: 'war', from, to: e.to, units })
        }
      }
      break
    }
    case 'diplomacy': {
      if (!o.faction) break
      const proposals: DiploKind[] = ['alliance', 'truce', 'surrender']
      for (const fid of sortedIds(c.s.factions)) {
        if (fid === o.faction || !F(c, fid).alive) continue
        const envoy = o.post === 'ruler' ? actorId : actorId
        for (const p of proposals) out.push({ kind: 'diplomacy', envoy, faction: fid, proposal: p, mode: 'roll' })
      }
      break
    }
    case 'captive': {
      if (o.post !== 'ruler' || !o.faction) break
      for (const id of sortedIds(c.s.officers)) {
        const t = c.s.officers[id]!
        if (t.status !== 'captive' || !t.city || C(c, t.city).faction !== o.faction) continue
        out.push({ kind: 'captive', officer: id, decision: 'recruit' }, { kind: 'captive', officer: id, decision: 'release' }, { kind: 'captive', officer: id, decision: 'execute' })
      }
      break
    }
    case 'focus': {
      const ct = C(c, o.city)
      const order = ['balanced', 'farm', 'trade', 'military', 'defense'] as const
      for (const f of order) if (f !== ct.focus) out.push({ kind: 'focus', city: o.city, focus: f })
      break
    }
    case 'propose': {
      if (!o.faction) break
      for (const e of neighbors(c, o.city)) if (C(c, e.to).faction !== o.faction) out.push({ kind: 'propose', proposal: 'war', to: e.to })
      for (const fid of sortedIds(c.s.factions)) if (fid !== o.faction && F(c, fid).alive) {
        out.push({ kind: 'propose', proposal: 'truce', faction: fid }, { kind: 'propose', proposal: 'alliance', faction: fid })
      }
      out.push({ kind: 'propose', proposal: 'prefect' })
      break
    }
  }
  return out
}

/** Legal instances of one kind, in candidate order. */
export function legalOfKind(c: Ctx, actorId: string, kind: WorldAction['kind'], all: boolean): WorldAction[] {
  const out: WorldAction[] = []
  for (const a of candidates(c, actorId, kind)) {
    if (checkAction(c, actorId, a) === null) {
      out.push(a)
      if (!all && !ENUMERATED.has(kind)) break
    }
  }
  return out
}

export function playerActions(c: Ctx, actorId: string): WorldAction[] {
  const out: WorldAction[] = []
  const o = c.s.officers[actorId]
  if (o && o.status === 'active') for (const k of KINDS) out.push(...legalOfKind(c, actorId, k, false))
  out.push({ kind: 'endMonth' })
  return out
}
