// Membership, death, succession, faction founding/destruction and the post-change normaliser.
import type { Post } from '../contracts/data'
import type { Pending } from '../contracts/world'
import {
  C, F, O, type Ctx, ageOf, cityName, clamp, factionCities, factionName, factionOfficers, friendship, isKin, log, nameOf,
  nearestOwnCity, newPendingId, prof, setFriendship, sortedIds,
} from './core'

export function pushLetter(c: Ctx, title: string, text: string): void {
  c.s.pending.push({ kind: 'letter', id: newPendingId(c), title, text })
}

/** Relinquish a prefecture the officer holds (leaving the city, joining an army, resigning). */
export function clearPrefect(c: Ctx, id: string): void {
  const o = O(c, id)
  for (const cid of c.d.cityIds) {
    const ct = C(c, cid)
    if (ct.prefect === id) ct.prefect = null
  }
  if (o.post === 'prefect') o.post = 'officer'
}

export function removeFromArmies(c: Ctx, id: string): void {
  for (let i = c.s.armies.length - 1; i >= 0; i--) {
    const a = c.s.armies[i]!
    const k = a.units.findIndex((u) => u.officer === id)
    if (k < 0) continue
    const wasCmd = a.units[k]!.commander
    a.units.splice(k, 1)
    if (a.units.length === 0) { c.s.armies.splice(i, 1); continue }
    if (wasCmd) a.units[0]!.commander = true
  }
}

export function joinFaction(c: Ctx, id: string, fid: string, loyalty: number, post: Post = 'officer'): void {
  const o = O(c, id)
  o.faction = fid
  o.post = post
  o.loyalty = post === 'ruler' ? null : clamp(Math.round(loyalty), 0, 100)
  o.hidden = false
  o.mission = null
}

/** Turn an officer into a wanderer (ruler succession handled first). */
export function makeWanderer(c: Ctx, id: string, city?: string): void {
  const o = O(c, id)
  const fid = o.faction
  const wasRuler = o.post === 'ruler'
  clearPrefect(c, id)
  o.faction = null
  o.post = 'wanderer'
  o.loyalty = null
  o.mission = null
  if (city && c.s.cities[city]) o.city = city
  if (o.status === 'army') { removeFromArmies(c, id); o.status = 'active' }
  if (wasRuler && fid && c.s.factions[fid]?.alive) succeedRuler(c, fid, id)
}

/** W-DEATH-3. Returns the new ruler id, or null when the faction had nobody (it is destroyed). */
export function succeedRuler(c: Ctx, fid: string, departing: string): string | null {
  const f = F(c, fid)
  const cands = factionOfficers(c, fid).filter((o) => o.id !== departing && o.status !== 'captive')
  let pick: string | null = null
  // adult child
  const kids = (c.d.childrenOf.get(departing) ?? []).filter((k) => cands.some((o) => o.id === k) && ageOf(c, k) >= 16)
  if (kids.length) {
    kids.sort((a, b) => prof(c, a).born - prof(c, b).born || (a < b ? -1 : 1))
    pick = kids[0]!
  }
  if (!pick) {
    const dead = c.s.officers[departing]
    const grp = dead && dead.oathGroup !== null ? c.s.oaths[dead.oathGroup] ?? [] : []
    const sibs = cands.filter((o) => grp.includes(o.id)).sort((a, b) => b.merit - a.merit || (a.id < b.id ? -1 : 1))
    if (sibs.length) pick = sibs[0]!.id
  }
  if (!pick) {
    const rest = cands.slice().sort((a, b) => b.merit - a.merit || (a.id < b.id ? -1 : 1))
    if (rest.length) pick = rest[0]!.id
  }
  const old = c.s.officers[departing]
  if (old && old.post === 'ruler') old.post = old.status === 'dead' ? 'wanderer' : 'officer'
  if (!pick) {
    destroyFaction(c, fid)
    return null
  }
  const n = O(c, pick)
  clearPrefect(c, pick)
  n.post = 'ruler'
  n.loyalty = null
  n.mission = null
  f.ruler = pick
  for (const o of factionOfficers(c, fid)) if (o.id !== pick && o.loyalty !== null) o.loyalty = clamp(o.loyalty - 10, 0, 100)
  log(c, 'succession', `${nameOf(c, pick)} became ruler of ${f.name}, after ${nameOf(c, departing)}.`, [pick, departing], n.city ?? undefined)
  if (c.s.officers[c.s.player]?.faction === fid) pushLetter(c, 'A new ruler', `${nameOf(c, pick)} now leads ${f.name}.`)
  return pick
}

export function destroyFaction(c: Ctx, fid: string): void {
  const f = F(c, fid)
  if (!f.alive) return
  f.alive = false
  // dissolve its armies
  for (let i = c.s.armies.length - 1; i >= 0; i--) {
    const a = c.s.armies[i]!
    if (a.faction !== fid) continue
    for (const u of a.units) {
      const o = c.s.officers[u.officer]
      if (o && o.status === 'army') o.status = 'active'
    }
    c.s.armies.splice(i, 1)
  }
  for (const cid of c.d.cityIds) {
    const ct = C(c, cid)
    if (ct.faction === fid) { ct.faction = null; ct.prefect = null }
  }
  for (const id of sortedIds(c.s.officers)) {
    const o = c.s.officers[id]!
    if (o.faction !== fid) continue
    if (o.status === 'captive') { o.faction = null; continue }
    if (o.status === 'dead' || o.status === 'unborn') continue
    o.faction = null
    o.post = 'wanderer'
    o.loyalty = null
    o.mission = null
  }
  c.s.pacts = c.s.pacts.filter((p) => p.a !== fid && p.b !== fid)
  log(c, 'fall', `The house of ${f.name} fell.`, [f.ruler])
  const pl = c.s.officers[c.s.player]
  if (pl && pl.post === 'wanderer' && pl.status !== 'dead') {
    /* player's own faction handled by letter in normalize when relevant */
  }
}

/** Candidates for the player's successor (W-DEATH-2). Call before clearing the dead officer's ties. */
function successorCandidates(c: Ctx, id: string): string[] {
  const dead = O(c, id)
  const grp = dead.oathGroup !== null ? c.s.oaths[dead.oathGroup] ?? [] : []
  const out: string[] = []
  for (const oid of sortedIds(c.s.officers)) {
    if (oid === id) continue
    const o = c.s.officers[oid]!
    if (o.status === 'dead' || o.status === 'unborn') continue
    if (isKin(c, id, oid) || grp.includes(oid) || dead.spouse === oid || friendship(c, id, oid) >= 60) out.push(oid)
  }
  return out
}

export function killOfficer(c: Ctx, id: string, cause: string): void {
  const o = c.s.officers[id]
  if (!o || o.status === 'dead' || o.status === 'unborn') return
  const fid = o.faction
  const wasRuler = o.post === 'ruler'
  const wasPlayer = id === c.s.player
  const cands = wasPlayer ? successorCandidates(c, id) : []
  const where = o.city ?? undefined
  clearPrefect(c, id)
  removeFromArmies(c, id)
  if (o.spouse) {
    const sp = c.s.officers[o.spouse]
    if (sp && sp.spouse === id) sp.spouse = null
    o.spouse = null
  }
  if (o.oathGroup !== null) {
    const g = c.s.oaths[o.oathGroup]
    if (g) {
      const k = g.indexOf(id)
      if (k >= 0) g.splice(k, 1)
      if (g.length < 2) {
        for (const m of g) { const mo = c.s.officers[m]; if (mo) mo.oathGroup = null }
        g.length = 0
      }
    }
    o.oathGroup = null
  }
  o.status = 'dead'
  o.post = 'wanderer'
  o.faction = null
  o.city = null
  o.loyalty = null
  o.mission = null
  o.hidden = false
  o.days = 0
  c.s.pending = c.s.pending.filter((p) => !(p.kind === 'offer' && p.from === id))
  log(c, 'death', cause ? `${nameOf(c, id)} died (${cause}).` : `${nameOf(c, id)} died.`, [id], where)
  if (wasRuler && fid && c.s.factions[fid]?.alive) succeedRuler(c, fid, id)
  if (wasPlayer) {
    if (cands.length === 0) {
      c.s.ended = { kind: 'chronicle-closes', faction: null }
      c.s.phase = 'ended'
      c.s.cursor = null
      c.s.pending = []
      log(c, 'end', `${nameOf(c, id)} had no one to carry the name on. The chronicle closes.`, [id])
    } else {
      c.s.pending.push({ kind: 'chooseSuccessor', id: newPendingId(c), candidates: cands })
    }
  }
}

/** Take an officer prisoner, held in `holdCity` (a city of the captor). */
export function captureOfficer(c: Ctx, id: string, holdCity: string): void {
  const o = O(c, id)
  if (o.status === 'dead') return
  const fid = o.faction
  const wasRuler = o.post === 'ruler'
  clearPrefect(c, id)
  removeFromArmies(c, id)
  o.status = 'captive'
  o.city = holdCity
  o.mission = null
  o.hidden = false
  o.proposedThisMonth = false
  if (wasRuler) o.post = 'officer'
  else if (o.post === 'prefect') o.post = 'officer'
  if (wasRuler && fid && c.s.factions[fid]?.alive) succeedRuler(c, fid, id)
  log(c, 'capture', `${nameOf(c, id)} was taken prisoner at ${cityName(c, holdCity)}.`, [id], holdCity)
}

function freshFactionId(c: Ctx, rulerId: string): string {
  let fid = `f-${rulerId}`
  while (c.s.factions[fid]) fid = `f-${rulerId}-${c.s.nextId++}`
  return fid
}

function freeColor(c: Ctx): number {
  const used = new Set<number>()
  for (const id in c.s.factions) if (c.s.factions[id]!.alive) used.add(c.s.factions[id]!.color)
  for (let k = 1; k <= 14; k++) if (!used.has(k)) return k
  return 1 + (c.s.nextId % 14)
}

/** Found a new faction holding `cityId` with `rulerId` as ruler and `companions` as officers. */
export function foundFaction(c: Ctx, rulerId: string, cityId: string, companions: string[]): string {
  const fid = freshFactionId(c, rulerId)
  const name = nameOf(c, rulerId)
  c.s.factions[fid] = { id: fid, name, ruler: rulerId, capital: cityId, color: freeColor(c), glyph: name.charAt(0).toUpperCase(), alive: true }
  const ct = C(c, cityId)
  ct.faction = fid
  ct.prefect = null
  joinFaction(c, rulerId, fid, 0, 'ruler')
  O(c, rulerId).city = cityId
  for (const m of companions) {
    joinFaction(c, m, fid, 60 + Math.floor(friendship(c, m, rulerId) / 4))
    O(c, m).city = cityId
  }
  return fid
}

/** Repair every structural invariant after a batch of changes. */
export function normalize(c: Ctx): void {
  for (const fid of sortedIds(c.s.factions)) {
    const f = F(c, fid)
    if (!f.alive) continue
    const cities = factionCities(c, fid)
    if (cities.length === 0) {
      const pl = c.s.officers[c.s.player]
      const playerHere = pl?.faction === fid
      destroyFaction(c, fid)
      if (playerHere) pushLetter(c, 'Our house has fallen', `${f.name} holds no city any more. Those still free are wanderers now.`)
      continue
    }
    const r = c.s.officers[f.ruler]
    const rulerOk = !!r && (r.status === 'active' || r.status === 'army') && r.faction === fid && r.post === 'ruler'
    if (!rulerOk) {
      if (r && r.faction === fid && (r.status === 'active' || r.status === 'army')) {
        // someone who still serves but is not marked ruler: remark them if nobody else is
        const other = factionOfficers(c, fid).find((o) => o.post === 'ruler' && o.id !== f.ruler)
        if (!other) { r.post = 'ruler'; r.loyalty = null; clearPrefect(c, r.id); continue }
      }
      succeedRuler(c, fid, f.ruler)
      if (!f.alive) continue
    }
    if (C(c, f.capital).faction !== fid) {
      let best: string | null = null
      let bp = -1
      for (const cid of cities) if (C(c, cid).population > bp) { bp = C(c, cid).population; best = cid }
      if (best) f.capital = best
    }
  }
  for (const cid of c.d.cityIds) {
    const ct = C(c, cid)
    if (!ct.prefect) continue
    const p = c.s.officers[ct.prefect]
    if (!p || p.status !== 'active' || p.city !== cid || !ct.faction || p.faction !== ct.faction || p.post === 'ruler') {
      if (p && p.post === 'prefect') p.post = 'officer'
      ct.prefect = null
    } else p.post = 'prefect'
  }
  for (const id of sortedIds(c.s.officers)) {
    const o = c.s.officers[id]!
    if (o.post === 'prefect' && !(o.city && C(c, o.city).prefect === id)) o.post = 'officer'
  }
}

/** W-END-1 */
export function checkEnd(c: Ctx): void {
  if (c.s.phase === 'ended') return
  let owner: string | null | undefined
  for (const cid of c.d.cityIds) {
    const f = C(c, cid).faction
    if (f === null) return
    if (owner === undefined) owner = f
    else if (owner !== f) return
  }
  if (!owner) return
  const pf = c.s.officers[c.s.player]?.faction ?? null
  c.s.ended = { kind: pf === owner ? 'unified' : 'another-unified', faction: owner }
  c.s.phase = 'ended'
  c.s.cursor = null
  c.s.pending = []
  log(c, 'end', `${factionName(c, owner)} holds every city under heaven.`, [])
}

export function pendingOf<K extends Pending['kind']>(c: Ctx, kind: K): Extract<Pending, { kind: K }> | undefined {
  return c.s.pending.find((p) => p.kind === kind) as Extract<Pending, { kind: K }> | undefined
}

export { setFriendship, nearestOwnCity }
