// W-AI-2: the AI court at month start (prefects, transfers, missions, captives, rewards, war, diplomacy).
import type { Mission, WorldAction } from '../../contracts/world'
import {
  C, F, O, type Ctx, factionCities, factionOfficers, friendship, isRival, newPendingId, nameOf, neighbors, officersIn, pactBetween, roll, rnd, sortedIds, totalTroops,
  distance, cityName, log,
} from '../../world/core'
import { applyAction, checkAction, describeMission, normalizeMission, hiddenIn } from '../../world/rules'
import { checkArmy, defencePower, suggestArmy, unitsPower } from '../../world/war'
import { isBorder } from './officer'

const ok = (c: Ctx, id: string, a: WorldAction): WorldAction | null => (checkAction(c, id, a) === null ? a : null)

export function fillPrefectAction(c: Ctx, fid: string): WorldAction | null {
  const ruler = F(c, fid).ruler
  for (const cid of factionCities(c, fid)) {
    const ct = C(c, cid)
    if (ct.prefect) continue
    let best: string | null = null
    let bs = -1
    for (const x of officersIn(c, cid, (y) => y.faction === fid && y.post === 'officer')) {
      const sc = x.stats.pol + x.stats.ldr
      if (sc > bs) { bs = sc; best = x.id }
    }
    if (best) { const a = ok(c, ruler, { kind: 'appoint', officer: best }); if (a) return a }
  }
  return null
}

export function moveAction(c: Ctx, fid: string): WorldAction | null {
  const ruler = F(c, fid).ruler
  const cities = factionCities(c, fid)
  const count = (cid: string): number => officersIn(c, cid, (y) => y.faction === fid).length
  for (const cid of cities) {
    if (count(cid) <= 4) continue
    const pool = officersIn(c, cid, (y) => y.faction === fid && y.post === 'officer' && y.id !== c.s.player && !y.mission).sort((a, b) => a.merit - b.merit || (a.id < b.id ? -1 : 1))
    const mover = pool[0]
    if (!mover) continue
    let dest: string | null = null
    let bd = Infinity
    for (const t of cities) {
      if (t === cid || count(t) >= 2) continue
      const d = distance(c, cid, t)
      if (d < bd) { bd = d; dest = t }
    }
    if (dest) { const a = ok(c, ruler, { kind: 'transfer', officer: mover.id, to: dest }); if (a) return a }
  }
  return null
}

/** The best attack for a faction right now, or null (P_att > 1.4 * P_def, rice there). */
export function bestWar(c: Ctx, fid: string, minTroops = 1000): WorldAction | null {
  const ruler = F(c, fid).ruler
  const pl = c.s.officers[c.s.player]
  let best: { a: WorldAction; ratio: number } | null = null
  for (const from of factionCities(c, fid)) {
    const ct = C(c, from)
    if (ct.troops < minTroops) continue
    const must = pl && pl.status === 'active' && pl.faction === fid && pl.city === from && pl.health >= 30 && pl.post !== 'ruler' ? pl.id : undefined
    const units = suggestArmy(c, fid, from, must)
    if (units.length === 0) continue
    const patt = unitsPower(c, units, ct.training)
    for (const e of neighbors(c, from)) {
      const t = C(c, e.to)
      if (t.faction === fid || (t.faction && pactBetween(c, fid, t.faction))) continue
      if (checkArmy(c, fid, from, e.to, units) !== null) continue
      const pdef = defencePower(c, e.to)
      if (pdef > 0 && patt <= 1.4 * pdef) continue
      const ratio = pdef > 0 ? patt / pdef : 1e9
      if (!best || ratio > best.ratio) {
        const a = ok(c, ruler, { kind: 'war', from, to: e.to, units })
        if (a) best = { a, ratio }
      }
    }
  }
  return best ? best.a : null
}

/** A neighbouring faction with over 1.5x our troops, if any (lowest id). */
function threat(c: Ctx, fid: string): string | null {
  const mine = totalTroops(c, fid)
  const seen = new Set<string>()
  for (const cid of factionCities(c, fid)) for (const e of neighbors(c, cid)) {
    const f = C(c, e.to).faction
    if (f && f !== fid) seen.add(f)
  }
  for (const f of [...seen].sort()) if (totalTroops(c, f) > 1.5 * mine) return f
  return null
}

function missionOffer(c: Ctx, fid: string): void {
  const pl = c.s.officers[c.s.player]
  if (!pl || pl.faction !== fid || pl.post === 'ruler' || pl.status !== 'active' || pl.mission || !pl.city) return
  if (c.s.pending.some((p) => p.kind === 'offer' && p.offer === 'mission')) return
  if (!roll(c, 60)) return
  const ct = C(c, pl.city)
  const opts: Mission[] = []
  if (ct.faction === fid) {
    const def = c.d.cityDef.get(ct.id)!
    const r: ['farm' | 'trade' | 'walls' | 'order', number][] = [
      ['farm', ct.farm / Math.max(1, def.farmMax)], ['trade', ct.trade / Math.max(1, def.tradeMax)], ['order', ct.order / 100], ['walls', ct.walls / Math.max(1, def.wallsMax)],
    ]
    r.sort((a, b) => a[1] - b[1])
    opts.push({ kind: 'develop', city: ct.id, work: r[0]![0], count: 2, done: 0, deadline: { ...c.s.ym } })
  }
  const wand = officersIn(c, pl.city, (x) => x.post === 'wanderer' && !isRival(c, pl.id, x.id))[0]
  if (wand) opts.push({ kind: 'recruit', officer: wand.id, deadline: { ...c.s.ym } })
  for (const e of neighbors(c, pl.city)) {
    const t = C(c, e.to)
    if (t.faction && t.faction !== fid) { opts.push({ kind: 'scout', city: e.to, reached: false, deadline: { ...c.s.ym } }); break }
  }
  if (opts.length === 0) return
  const m = normalizeMission(c, opts[Math.floor(rnd(c) * opts.length)]!)
  const ruler = F(c, fid).ruler
  c.s.pending.push({ kind: 'offer', id: newPendingId(c), from: ruler, offer: 'mission', text: `${nameOf(c, ruler)} entrusts you with a task: ${describeMission(c, m)}.`, mission: m })
}

function captivesPhase(c: Ctx, fid: string): void {
  const ruler = F(c, fid).ruler
  const rulerO = O(c, ruler)
  for (const id of sortedIds(c.s.officers)) {
    const t = c.s.officers[id]!
    if (t.status !== 'captive' || !t.city || C(c, t.city).faction !== fid) continue
    if (O(c, ruler).days < 1) return
    if (checkAction(c, ruler, { kind: 'captive', officer: id, decision: 'recruit' }) === null) applyAction(c, ruler, { kind: 'captive', officer: id, decision: 'recruit' })
    if (c.s.officers[id]!.status !== 'captive') continue
    const never = id === c.s.player || prof(c, ruler) === 'righteous'
    const execute = !never && roll(c, 20)
    const dec = execute ? 'execute' : 'release'
    const a: WorldAction = { kind: 'captive', officer: id, decision: dec }
    if (checkAction(c, ruler, a) === null) applyAction(c, ruler, a)
  }
  void rulerO
}

function prof(c: Ctx, id: string): string {
  const d = c.d.officerDef.get(id)
  return d ? d.temperament : (c.s.officers[id]?.custom?.temperament ?? 'steady')
}

export function runCourt(c: Ctx, fid: string): void {
  const f = F(c, fid)
  const ruler = f.ruler
  let guard = 0
  for (let a = fillPrefectAction(c, fid); a && guard++ < 12; a = fillPrefectAction(c, fid)) applyAction(c, ruler, a)
  for (let k = 0; k < 4; k++) { const a = moveAction(c, fid); if (!a) break; applyAction(c, ruler, a) }
  missionOffer(c, fid)
  captivesPhase(c, fid)
  // rewards
  const cap = C(c, f.capital)
  let rewarded = 0
  for (const x of factionOfficers(c, fid)) {
    if (rewarded >= 4 || cap.gold <= 500) break
    if (x.id === ruler || x.loyalty === null || x.loyalty >= 60 || x.status !== 'active') continue
    const a = ok(c, ruler, { kind: 'gift', officer: x.id, gold: 100, fromCity: true })
    if (a) { applyAction(c, ruler, a); rewarded++ }
  }
  // war
  const cities = factionCities(c, fid).length
  const limit = cities >= 9 ? 2 : 1
  for (let w = 0; w < limit; w++) {
    const a = bestWar(c, fid)
    if (!a) break
    applyAction(c, ruler, a)
  }
  // threatened: truce or alliance
  const th = threat(c, fid)
  if (th && roll(c, 20)) {
    const pact = pactBetween(c, fid, th)
    const proposal = pact === 'truce' ? 'alliance' : 'truce'
    const a = ok(c, ruler, { kind: 'diplomacy', envoy: ruler, faction: th, proposal, mode: 'roll' })
    if (a) applyAction(c, ruler, a)
  }
  void friendship; void hiddenIn; void isBorder; void cityName; void log
}
