// The invariants of docs/spec/00-architecture.md, checked by tools/sim.ts after every step.
import type { WorldState } from '../contracts/world'
import type { GameData } from '../contracts/data'
import { indexData } from './core'

export function checkInvariants(data: GameData, s: WorldState): string[] {
  const d = indexData(data)
  const bad: string[] = []
  const inArmy = new Map<string, number>()
  for (const a of s.armies) for (const u of a.units) inArmy.set(u.officer, (inArmy.get(u.officer) ?? 0) + 1)
  for (const id in s.officers) {
    const o = s.officers[id]!
    const n = inArmy.get(id) ?? 0
    if ((o.status === 'active' || o.status === 'captive') && (!o.city || !s.cities[o.city])) bad.push(`${id}: ${o.status} without a valid city`)
    if (o.status === 'army' && n !== 1) bad.push(`${id}: army officer in ${n} armies`)
    if (o.status !== 'army' && n > 0) bad.push(`${id}: ${o.status} officer inside an army`)
    if (o.status === 'dead' && (o.post !== 'wanderer' || o.faction !== null || o.city !== null)) bad.push(`${id}: dead officer keeps a post/faction/city`)
    if (o.status === 'unborn' && (o.faction !== null || o.city !== null)) bad.push(`${id}: unborn officer placed`)
    if (o.days < 0 || o.days > 30) bad.push(`${id}: days ${o.days}`)
    if (o.loyalty !== null && (o.loyalty < 0 || o.loyalty > 100 || !Number.isInteger(o.loyalty))) bad.push(`${id}: loyalty ${o.loyalty}`)
    if (o.health < 0 || o.health > 100) bad.push(`${id}: health ${o.health}`)
    for (const k of ['war', 'ldr', 'int', 'pol', 'cha'] as const) if (o.stats[k] < 1 || o.stats[k] > 100) bad.push(`${id}: stat ${k} ${o.stats[k]}`)
    if (o.post === 'ruler' && (!o.faction || s.factions[o.faction]?.ruler !== id)) bad.push(`${id}: ruler post without being the ruler`)
    if (o.post === 'prefect' && !(o.city && s.cities[o.city]?.prefect === id)) bad.push(`${id}: prefect post without the prefecture`)
    if (o.post === 'wanderer' && o.faction !== null && o.status !== 'captive' && o.status !== 'dead') bad.push(`${id}: wanderer with a faction`)
    if (o.spouse && s.officers[o.spouse]?.spouse !== id) bad.push(`${id}: spouse not mutual`)
  }
  for (const key in s.friendships) {
    const v = s.friendships[key]!
    if (v < 0 || v > 100 || !Number.isInteger(v)) bad.push(`friendship ${key} = ${v}`)
  }
  for (const key in s.relations) {
    const v = s.relations[key]!
    if (v < 0 || v > 100) bad.push(`relation ${key} = ${v}`)
  }
  for (const fid in s.factions) {
    const f = s.factions[fid]!
    if (!f.alive) continue
    let cities = 0
    for (const cid in s.cities) if (s.cities[cid]!.faction === fid) cities++
    if (cities < 1) bad.push(`${fid}: living faction without a city`)
    const r = s.officers[f.ruler]
    if (!r || (r.status !== 'active' && r.status !== 'army') || r.faction !== fid || r.post !== 'ruler') bad.push(`${fid}: bad ruler ${f.ruler}`)
    if (s.cities[f.capital]?.faction !== fid) bad.push(`${fid}: capital ${f.capital} not its own`)
  }
  for (const cid in s.cities) {
    const c = s.cities[cid]!
    const def = d.cityDef.get(cid)!
    for (const k of ['population', 'farm', 'trade', 'walls', 'order', 'troops', 'training', 'gold', 'rice'] as const) {
      if (!Number.isInteger(c[k]) || c[k] < 0) bad.push(`${cid}: ${k} = ${c[k]}`)
    }
    if (c.farm > def.farmMax || c.trade > def.tradeMax || c.walls > def.wallsMax || c.order > 100 || c.training > 100) bad.push(`${cid}: over max`)
    if (c.faction !== null && !s.factions[c.faction]?.alive) bad.push(`${cid}: held by dead faction ${c.faction}`)
    if (c.prefect) {
      const p = s.officers[c.prefect]
      if (!p || p.status !== 'active' || p.city !== cid || p.faction !== c.faction) bad.push(`${cid}: bad prefect ${c.prefect}`)
    }
  }
  for (const a of s.armies) {
    if (a.units.length < 1 || a.units.length > 5 || a.units.filter((u) => u.commander).length !== 1) bad.push(`${a.id}: malformed army`)
  }
  if (s.phase !== 'ended' && s.cursor && s.phase !== 'world') bad.push('cursor set outside the world phase')
  if (s.phase === 'world' && s.cursor && !s.pending.some((p) => ['battle', 'duel', 'debate', 'chooseDefenders', 'eventChoice', 'chooseSuccessor', 'captured'].includes(p.kind))) bad.push('paused without a blocking pending')
  return bad
}
