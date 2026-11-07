// W-AI-2: the AI court at month start (prefects, transfers, missions, captives, rewards, war, diplomacy).
import type { ArmyUnit, Mission, WorldAction } from '../../contracts/world'
import {
  C, F, O, type Ctx, factionCities, factionOfficers, friendship, isRival, newPendingId, nameOf, neighbors, officersIn, pactBetween, roll, rnd, sortedIds, totalTroops,
  distance, cityName, log, ymNum,
} from '../../world/core'
import { applyAction, checkAction, describeMission, normalizeMission, hiddenIn, workInfo } from '../../world/rules'
import { checkArmy, defencePower, suggestArmy, unitsPower } from '../../world/war'
import { isBorder, riceNeeded } from './officer'

/** W-AI-2: the attack threshold. */
export const WAR_RATIO = 1.4

/** W-AI-2: a threatened ruler with no pact yet asks the threat for a truce this often (percent per month). */
export const DIPLO_CHANCE = 8
/** W-AI-2: a ruler with 3.5x the troops of an adjacent house demands surrender with this chance (percent per month). */
export const SURRENDER_CHANCE = 6
/** W-AI-2: chance (percent) that a ruler looks for a war in a given month, per war slot. */
export const WAR_CHANCE = 60

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

/** W-AI-5: no AI war in the first three months of a scenario. */
export function peacefulOpening(c: Ctx): boolean {
  const sc = c.d.data.scenarios.find((x) => x.id === c.s.scenario)
  if (!sc) return false
  return ymNum(c.s.ym) - ymNum({ year: sc.year, month: sc.month }) < OPENING_MONTHS
}
export const OPENING_MONTHS = 3

/** W-AI-5: while the coalition stands, a coalition member's preferred victim (Dong Zhuo's house), else null. */
function coalitionTarget(c: Ctx, fid: string): string | null {
  if (!c.s.flags.includes('coalition') || c.s.flags.includes('coalition-ended')) return null
  const ev = c.d.data.events.find((e) => e.id === 'coalition-forms')
  const al = ev?.effects.find((e) => e.kind === 'alliance')
  if (!al || al.kind !== 'alliance' || !al.factions.includes(fid)) return null
  const dz = c.s.officers['dong-zhuo']
  const f = dz && dz.status !== 'dead' ? dz.faction : null
  return f && f !== fid && c.s.factions[f]?.alive ? f : null
}

/** Army sizes the AI tries, smallest first (W-AI-2: send only what the job needs). */
const FRACTIONS = [0.25, 0.8]

/** The best attack for a faction right now, or null (P_att > WAR_RATIO * P_def with the smallest army that manages it, rice there). */
export function bestWar(c: Ctx, fid: string, minTroops = 1000): WorldAction | null {
  if (peacefulOpening(c)) return null // W-AI-5
  const ruler = F(c, fid).ruler
  const hostile = coalitionTarget(c, fid) // W-AI-5: the coalition marches on Dong Zhuo's cities
  const pl = c.s.officers[c.s.player]
  let best: { a: WorldAction; ratio: number } | null = null
  for (const from of factionCities(c, fid)) {
    const ct = C(c, from)
    if (ct.troops < minTroops) continue
    const must = pl && pl.status === 'active' && pl.faction === fid && pl.city === from && pl.health >= 30 && pl.post !== 'ruler' ? pl.id : undefined
    // W-AI-6: the troops left at home must still be fed until the harvest
    const options: { units: ArmyUnit[]; patt: number }[] = []
    for (const fr of FRACTIONS) {
      const units = suggestArmy(c, fid, from, must, fr)
      if (units.length === 0) continue
      let a = 0
      for (const u of units) a += u.troops
      if (ct.rice - Math.ceil(a / 100) * 2 < riceNeeded(c, ct.troops - a)) continue
      options.push({ units, patt: unitsPower(c, units, ct.training) })
    }
    if (options.length === 0) continue
    const top = options[options.length - 1]!
    for (const e of neighbors(c, from)) {
      const t = C(c, e.to)
      if (t.faction === fid || (t.faction && pactBetween(c, fid, t.faction))) continue
      const pdef = defencePower(c, e.to)
      const pick = pdef > 0 ? (top.patt > WAR_RATIO * pdef ? top : undefined) : options[0] // a vacant city needs only a small force
      if (!pick) continue
      if (checkArmy(c, fid, from, e.to, pick.units) !== null) continue
      let ratio = pdef > 0 ? top.patt / pdef : 1e9
      if (hostile && t.faction === hostile) ratio = ratio * 100 + 1
      if (!best || ratio > best.ratio) {
        const a = ok(c, ruler, { kind: 'war', from, to: e.to, units: pick.units })
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
    // a mission must be doable: skip work that is already at its maximum, and keep the gold for two actions
    const w = r.find(([k]) => { const info = workInfo(c, pl, k); return !info.capped && ct.gold >= info.gold * 2 + 100 })
    if (w) opts.push({ kind: 'develop', city: ct.id, work: w[0], count: 2, done: 0, deadline: { ...c.s.ym } })
  }
  const wand = officersIn(c, pl.city, (x) => x.post === 'wanderer' && !isRival(c, pl.id, x.id))[0]
  if (wand) opts.push({ kind: 'recruit', officer: wand.id, deadline: { ...c.s.ym } })
  for (const e of neighbors(c, pl.city)) {
    const t = C(c, e.to)
    if (t.faction && t.faction !== fid && e.days <= 15) { opts.push({ kind: 'scout', city: e.to, reached: false, deadline: { ...c.s.ym } }); break }
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
    if (!roll(c, WAR_CHANCE)) continue
    const a = bestWar(c, fid)
    if (!a) break
    applyAction(c, ruler, a)
  }
  // threatened: truce or alliance
  const th = threat(c, fid)
  if (th && !pactBetween(c, fid, th) && roll(c, DIPLO_CHANCE)) {
    const proposal = 'truce'
    const a = ok(c, ruler, { kind: 'diplomacy', envoy: ruler, faction: th, proposal, mode: 'roll' })
    if (a) applyAction(c, ruler, a)
  }
  // a much stronger neighbour may demand surrender (W-DIP-4)
  if (SURRENDER_CHANCE > 0) {
    const mine = totalTroops(c, fid)
    let weakest: string | null = null
    let wt = Infinity
    const seen = new Set<string>()
    for (const cid of factionCities(c, fid)) for (const e of neighbors(c, cid)) {
      const f2 = C(c, e.to).faction
      if (f2 && f2 !== fid && !seen.has(f2)) seen.add(f2)
    }
    for (const f2 of [...seen].sort()) {
      const tt = totalTroops(c, f2)
      if (mine >= 3.5 * tt && !pactBetween(c, fid, f2) && tt < wt) { wt = tt; weakest = f2 }
    }
    if (weakest && roll(c, SURRENDER_CHANCE)) {
      const a = ok(c, ruler, { kind: 'diplomacy', envoy: ruler, faction: weakest, proposal: 'surrender', mode: 'roll' })
      if (a) applyAction(c, ruler, a)
    }
  }
  void friendship; void hiddenIn; void isBorder; void cityName; void log
}
