// The data checks of docs/spec/12-data.md §6, shared by tools/validate-data.ts and tests/unit/data.test.ts.
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { EventCond, EventEffect, GameData, ScenarioDef } from '../../src/contracts/data'

const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/
export const REQUIRED_EVENTS = [
  'coalition-forms', 'hulao-gate', 'burning-of-luoyang', 'imperial-seal', 'coalition-breaks', 'ji-province', 'sun-jian-falls',
  'chain-stratagem', 'li-guo-seize', 'tao-qian-offers-xu', 'sun-ce-borrows', 'emperor-to-xu', 'yuan-shu-emperor', 'fall-of-xiapi',
  'peach-garden-reunion',
]
export const PROVINCES = ['Sili', 'Yu', 'Ji', 'Yan', 'Xu', 'Qing', 'Jing', 'Yang', 'Yi', 'Liang', 'Bing', 'You', 'Jiao']
const SALARY = [10, 20, 35, 55, 80]
const rankOf = (m: number) => (m >= 10000 ? 4 : m >= 6000 ? 3 : m >= 3000 ? 2 : m >= 1000 ? 1 : 0)

export function checkData(data: GameData, root = process.cwd()): string[] {
  const errs: string[] = []
  const err = (m: string) => errs.push(m)

  // ---- ids ----
  const uniq = (what: string, ids: string[]) => {
    const seen = new Set<string>()
    for (const id of ids) {
      if (!KEBAB.test(id)) err(`${what} id not kebab-case: ${id}`)
      if (seen.has(id)) err(`${what} id duplicated: ${id}`)
      seen.add(id)
    }
    return seen
  }
  const cityIds = uniq('city', data.cities.map((c) => c.id))
  const offIds = uniq('officer', data.officers.map((o) => o.id))
  const evIds = uniq('event', data.events.map((e) => e.id))
  const offById = new Map(data.officers.map((o) => [o.id, o]))
  const cityById = new Map(data.cities.map((c) => [c.id, c]))

  // ---- cities ----
  for (const c of data.cities) {
    if (!c.source) err(`city ${c.id}: no source`)
    if (!PROVINCES.includes(c.province)) err(`city ${c.id}: unknown province ${c.province}`)
    if (c.lat < 5 || c.lat > 50 || c.lon < 95 || c.lon > 130) err(`city ${c.id}: lat/lon out of range`)
    for (const k of ['farmMax', 'tradeMax', 'wallsMax'] as const) if (!(c[k] >= 100 && c[k] <= 999)) err(`city ${c.id}: ${k} ${c[k]} outside 100..999`)
    const px = Math.round((c.lon - 97) * 30)
    const py = Math.round((41.5 - c.lat) * 36)
    if (!c.nudged && (c.x !== px || c.y !== py)) err(`city ${c.id}: x/y differ from the projection but not marked nudged`)
    if (c.nudged && Math.hypot(c.x - px, c.y - py) > 60) err(`city ${c.id}: nudged more than 60 units`)
  }
  for (const p of PROVINCES) if (!data.cities.some((c) => c.province === p)) err(`province without a city: ${p}`)
  for (let i = 0; i < data.cities.length; i++)
    for (let j = i + 1; j < data.cities.length; j++) {
      const a = data.cities[i]!
      const b = data.cities[j]!
      if (Math.hypot(a.x - b.x, a.y - b.y) < 24) err(`cities ${a.id} and ${b.id} are closer than 25 map units`)
    }

  // ---- roads ----
  const pairSeen = new Set<string>()
  const adj = new Map<string, string[]>()
  for (const c of data.cities) adj.set(c.id, [])
  for (const r of data.roads) {
    if (!cityIds.has(r.a) || !cityIds.has(r.b)) { err(`road ${r.a}-${r.b}: unknown city`); continue }
    if (r.a === r.b) err(`road ${r.a}: joins a city to itself`)
    const key = [r.a, r.b].sort().join('|')
    if (pairSeen.has(key)) err(`duplicate road ${key}`)
    pairSeen.add(key)
    if (!(r.days >= 5 && r.days <= 25) || !Number.isInteger(r.days)) err(`road ${key}: days ${r.days} outside 5..25`)
    adj.get(r.a)!.push(r.b)
    adj.get(r.b)!.push(r.a)
  }
  if (data.cities.length) {
    const seen = new Set<string>([data.cities[0]!.id])
    const stack = [data.cities[0]!.id]
    while (stack.length) for (const n of adj.get(stack.pop()!) ?? []) if (!seen.has(n)) { seen.add(n); stack.push(n) }
    const lost = data.cities.filter((c) => !seen.has(c.id)).map((c) => c.id)
    if (lost.length) err(`road graph not connected; unreachable: ${lost.join(', ')}`)
  }

  // ---- officers ----
  for (const o of data.officers) {
    if (!o.source) err(`officer ${o.id}: no source`)
    if (!o.basis) err(`officer ${o.id}: no basis`)
    if (!o.name) err(`officer ${o.id}: no name`)
    for (const [k, v] of Object.entries(o.stats)) {
      if (!Number.isInteger(v) || v < 1 || v > 100) err(`officer ${o.id}: stat ${k}=${v} outside 1..100`)
      if ((v >= 85 || v <= 30) && !o.basis.includes(k === 'ldr' ? 'LDR' : k.toUpperCase())) err(`officer ${o.id}: basis has no ${k.toUpperCase()} line for stat ${v}`)
    }
    if (o.died !== null && o.died <= o.born) err(`officer ${o.id}: died ${o.died} not after born ${o.born}`)
    const ap = o.appears ?? o.born + 16
    if (ap < o.born + 12) err(`officer ${o.id}: appears ${ap} < born + 12`)
    if (o.died !== null && ap > o.died) err(`officer ${o.id}: appears after death`)
    if (o.portrait && !existsSync(join(root, 'public', 'portraits', `${o.portrait}.webp`))) err(`officer ${o.id}: portrait file missing: ${o.portrait}`)
    const kinSeen = new Set<string>()
    for (const k of o.kin) {
      if (!offIds.has(k.id)) { err(`officer ${o.id}: kin ${k.id} unknown`); continue }
      if (kinSeen.has(k.id + k.role)) err(`officer ${o.id}: duplicate kin ${k.id}`)
      kinSeen.add(k.id + k.role)
      const inv = { parent: 'child', child: 'parent', sibling: 'sibling', spouse: 'spouse' }[k.role]
      if (!offById.get(k.id)!.kin.some((x) => x.id === o.id && x.role === inv)) err(`officer ${o.id}: kin ${k.role} ${k.id} is not mirrored`)
    }
    if (o.kin.filter((k) => k.role === 'spouse').length > 1) err(`officer ${o.id}: more than one spouse`)
  }
  for (const g of data.genericPortraits) if (!existsSync(join(root, 'public', 'portraits', `${g}.webp`))) err(`generic portrait missing: ${g}`)

  // ---- scenarios ----
  for (const sc of data.scenarios) checkScenario(sc, data, err, offById, cityById, offIds)

  // ---- events ----
  for (const id of REQUIRED_EVENTS) if (!evIds.has(id)) err(`required event missing: ${id}`)
  const facIds = new Set(data.scenarios.flatMap((s) => s.factions.map((f) => f.id)))
  const checkCond = (e: string, c: EventCond) => {
    if ('id' in c && (c.kind === 'officerAlive' || c.kind === 'officerDead' || c.kind === 'officerInFaction' || c.kind === 'officerIsRuler') && !offIds.has(c.id)) err(`event ${e}: condition officer ${c.id} unknown`)
    if (c.kind === 'officerInFaction' && !facIds.has(c.faction)) err(`event ${e}: condition faction ${c.faction} unknown`)
    if (c.kind === 'factionExists' && !facIds.has(c.id)) err(`event ${e}: condition faction ${c.id} unknown`)
    if (c.kind === 'factionHoldsCity') {
      if (!facIds.has(c.faction)) err(`event ${e}: condition faction ${c.faction} unknown`)
      if (!cityIds.has(c.city)) err(`event ${e}: condition city ${c.city} unknown`)
    }
    if (c.kind === 'relationBelow') for (const f of [c.a, c.b]) if (!facIds.has(f)) err(`event ${e}: condition faction ${f} unknown`)
  }
  const checkEff = (e: string, x: EventEffect) => {
    const o = (id: string) => { if (!offIds.has(id)) err(`event ${e}: effect officer ${id} unknown`) }
    const f = (id: string) => { if (!facIds.has(id)) err(`event ${e}: effect faction ${id} unknown`) }
    const c = (id: string) => { if (!cityIds.has(id)) err(`event ${e}: effect city ${id} unknown`) }
    switch (x.kind) {
      case 'moveOfficer': o(x.id); c(x.city); break
      case 'joinFaction': o(x.id); f(x.faction); break
      case 'makeWanderer': o(x.id); if (x.city) c(x.city); break
      case 'killOfficer': o(x.id); break
      case 'transferCity': c(x.city); f(x.faction); break
      case 'moveCapital': f(x.faction); c(x.city); break
      case 'setRuler': f(x.faction); o(x.id); break
      case 'alliance': case 'endAlliance': x.factions.forEach(f); break
      case 'relation': f(x.a); f(x.b); break
      case 'cityDelta': c(x.city); break
      case 'friendship': o(x.a); o(x.b); break
      case 'merit': o(x.id); break
      case 'oath': x.ids.forEach(o); break
      case 'marry': o(x.a); o(x.b); break
      case 'item': o(x.officer); break
      case 'setFlag': break
    }
  }
  for (const ev of data.events) {
    if (!ev.title || !ev.text) err(`event ${ev.id}: title or text empty`)
    if (!ev.source) err(`event ${ev.id}: no source`)
    if (ev.chance < 1 || ev.chance > 100) err(`event ${ev.id}: chance ${ev.chance}`)
    const a = ev.from.year * 12 + ev.from.month
    const b = ev.to.year * 12 + ev.to.month
    if (a > b) err(`event ${ev.id}: window starts after it ends`)
    if (ev.from.month < 1 || ev.from.month > 12 || ev.to.month < 1 || ev.to.month > 12) err(`event ${ev.id}: bad month`)
    ev.conditions.forEach((c) => checkCond(ev.id, c))
    ev.effects.forEach((x) => checkEff(ev.id, x))
    for (const id of ev.involves ?? []) if (!offIds.has(id)) err(`event ${ev.id}: involves unknown officer ${id}`)
    for (const id of ev.involvesFaction ?? []) if (!facIds.has(id)) err(`event ${ev.id}: involvesFaction unknown ${id}`)
    if (ev.options) {
      if (ev.options.length < 2 || ev.options.length > 3) err(`event ${ev.id}: needs 2-3 options`)
      if (!ev.involves?.length && !ev.involvesFaction?.length) err(`event ${ev.id}: options without involves/involvesFaction`)
      ev.options.forEach((op, i) => {
        if (!op.label || !op.text) err(`event ${ev.id}: option ${i} lacks label or text`)
        op.effects.forEach((x) => checkEff(ev.id, x))
        if (op.contest) {
          const ct = op.contest
          if (!offIds.has(ct.a) || !offIds.has(ct.b)) err(`event ${ev.id}: contest officers unknown`)
          ct.onWin.forEach((x) => checkEff(ev.id, x))
          ct.onLoss.forEach((x) => checkEff(ev.id, x))
        }
      })
      if (JSON.stringify(ev.options[0]!.effects) !== JSON.stringify(ev.effects)) err(`event ${ev.id}: option 0 must equal the historical effects`)
      if (ev.options[0]!.contest) err(`event ${ev.id}: option 0 must not be a contest`)
    }
  }
  return errs
}

function checkScenario(
  sc: ScenarioDef, data: GameData, err: (m: string) => void,
  offById: Map<string, GameData['officers'][number]>, cityById: Map<string, GameData['cities'][number]>, offIds: Set<string>,
) {
  const tag = `scenario ${sc.id}`
  const facIds = new Set<string>()
  for (const f of sc.factions) {
    if (!KEBAB.test(f.id) || facIds.has(f.id)) err(`${tag}: faction id bad or duplicated: ${f.id}`)
    facIds.add(f.id)
    if (f.color < 1 || f.color > 14 || !Number.isInteger(f.color)) err(`${tag}: faction ${f.id} colour ${f.color}`)
    if (!f.glyph) err(`${tag}: faction ${f.id} has no glyph`)
  }
  const csById = new Map(sc.cities.map((c) => [c.id, c]))
  if (csById.size !== sc.cities.length) err(`${tag}: duplicate city starts`)
  for (const c of data.cities) if (!csById.has(c.id)) err(`${tag}: city ${c.id} has no start`)
  for (const cs of sc.cities) {
    const def = cityById.get(cs.id)
    if (!def) { err(`${tag}: start for unknown city ${cs.id}`); continue }
    if (cs.faction !== null && !facIds.has(cs.faction)) err(`${tag}: city ${cs.id} owned by unknown ${cs.faction}`)
    if (cs.farm > def.farmMax || cs.trade > def.tradeMax || cs.walls > def.wallsMax) err(`${tag}: city ${cs.id} above a maximum`)
    for (const k of ['population', 'farm', 'trade', 'walls', 'order', 'troops', 'training', 'gold', 'rice'] as const) if (!(cs[k] >= 0) || !Number.isFinite(cs[k])) err(`${tag}: city ${cs.id} ${k}=${cs[k]}`)
    if (cs.order > 100 || cs.training > 100) err(`${tag}: city ${cs.id} order/training above 100`)
    if (cs.faction !== null) {
      const upkeep = Math.ceil(cs.troops / 100)
      if (cs.rice < upkeep * 9) err(`${tag}: city ${cs.id} rice ${cs.rice} cannot feed ${cs.troops} troops until month 9`)
    }
  }
  const startById = new Map(sc.officers.map((s) => [s.id, s]))
  if (startById.size !== sc.officers.length) err(`${tag}: duplicate officer starts`)
  const appById = new Map(sc.appearances.map((s) => [s.id, s]))
  if (appById.size !== sc.appearances.length) err(`${tag}: duplicate appearances`)
  for (const id of startById.keys()) if (appById.has(id)) err(`${tag}: officer ${id} both starts and appears`)
  const prefects = new Map<string, number>()
  for (const s of sc.officers) {
    const o = offById.get(s.id)
    if (!o) { err(`${tag}: start for unknown officer ${s.id}`); continue }
    if (!cityById.has(s.city)) err(`${tag}: officer ${s.id} in unknown city ${s.city}`)
    if ((o.appears ?? o.born + 16) > sc.year) err(`${tag}: officer ${s.id} starts before they appear`)
    if (o.died !== null && o.died < sc.year) err(`${tag}: officer ${s.id} is already dead`)
    if (s.faction !== null && !facIds.has(s.faction)) err(`${tag}: officer ${s.id} in unknown faction ${s.faction}`)
    if (s.faction === null && s.post !== 'wanderer') err(`${tag}: officer ${s.id} has no faction but post ${s.post}`)
    if (s.faction !== null && s.post === 'wanderer') err(`${tag}: officer ${s.id} is a wanderer with a faction`)
    if (s.hidden && (s.faction !== null || s.post !== 'wanderer')) err(`${tag}: hidden officer ${s.id} must be a wanderer`)
    if ((s.post === 'ruler' || s.post === 'wanderer') && s.loyalty !== null) err(`${tag}: officer ${s.id} (${s.post}) must have null loyalty`)
    if (s.post !== 'ruler' && s.post !== 'wanderer' && (s.loyalty === null || s.loyalty < 0 || s.loyalty > 100)) err(`${tag}: officer ${s.id} loyalty ${s.loyalty}`)
    if (s.faction !== null) {
      const cs = csById.get(s.city)
      if (cs && cs.faction !== s.faction) err(`${tag}: officer ${s.id} of ${s.faction} is in ${s.city}, owned by ${cs.faction}`)
    }
    if (s.post === 'prefect') {
      const k = s.city
      prefects.set(k, (prefects.get(k) ?? 0) + 1)
    }
    if (s.merit < 0 || s.gold < 0) err(`${tag}: officer ${s.id} negative merit or gold`)
  }
  for (const [c, n] of prefects) if (n > 1) err(`${tag}: ${n} prefects in ${c}`)
  for (const a of sc.appearances) {
    const o = offById.get(a.id)
    if (!o) { err(`${tag}: appearance of unknown officer ${a.id}`); continue }
    if (!cityById.has(a.city)) err(`${tag}: appearance of ${a.id} in unknown city`)
    if (a.faction !== null && !facIds.has(a.faction)) err(`${tag}: appearance of ${a.id} in unknown faction`)
    const ap = o.appears ?? o.born + 16
    if (a.year !== ap) err(`${tag}: appearance year ${a.year} of ${a.id} differs from appears ${ap}`)
    if (a.year <= sc.year) err(`${tag}: appearance of ${a.id} is not after the start`)
    if (o.died !== null && o.died < a.year) err(`${tag}: ${a.id} appears after death`)
  }
  for (const o of data.officers) if (!startById.has(o.id) && !appById.has(o.id)) err(`${tag}: officer ${o.id} has neither a start nor an appearance`)
  // factions: ruler, capital
  for (const f of sc.factions) {
    if (!offIds.has(f.ruler)) { err(`${tag}: faction ${f.id} ruler ${f.ruler} unknown`); continue }
    const rs = startById.get(f.ruler)
    if (!rs) err(`${tag}: ruler ${f.ruler} of ${f.id} has no start`)
    else {
      if (rs.faction !== f.id || rs.post !== 'ruler') err(`${tag}: ruler ${f.ruler} is not post ruler of ${f.id}`)
      if (csById.get(rs.city)?.faction !== f.id) err(`${tag}: ruler ${f.ruler} is not in a city of ${f.id}`)
    }
    if (csById.get(f.capital)?.faction !== f.id) err(`${tag}: faction ${f.id} does not hold its capital ${f.capital}`)
    if (sc.officers.filter((s) => s.post === 'ruler' && s.faction === f.id).length !== 1) err(`${tag}: faction ${f.id} needs exactly one ruler`)
    if (!sc.cities.some((c) => c.faction === f.id)) err(`${tag}: faction ${f.id} has no city`)
    // economy: monthly gold covers the salary roll (W-ECO-1, W-OFF-4)
    const income = sc.cities.filter((c) => c.faction === f.id).reduce((a, c) => a + Math.floor((c.trade * (50 + c.order)) / 400), 0)
    const roll = sc.officers.filter((s) => s.faction === f.id && s.post !== 'ruler').reduce((a, s) => a + SALARY[rankOf(s.merit)]!, 0)
    if (income < roll) err(`${tag}: faction ${f.id} monthly income ${income} < salaries ${roll}`)
  }
  // relations, friendships, rivals, oaths
  const relSeen = new Set<string>()
  for (const r of sc.relations) {
    if (!facIds.has(r.a) || !facIds.has(r.b) || r.a === r.b) err(`${tag}: bad relation ${r.a}-${r.b}`)
    const k = [r.a, r.b].sort().join('|')
    if (relSeen.has(k)) err(`${tag}: duplicate relation ${k}`)
    relSeen.add(k)
    if (r.value < 0 || r.value > 100) err(`${tag}: relation ${k} value ${r.value}`)
  }
  const frSeen = new Set<string>()
  for (const fr of sc.friendships) {
    if (!offIds.has(fr.a) || !offIds.has(fr.b) || fr.a === fr.b) err(`${tag}: bad friendship ${fr.a}-${fr.b}`)
    const k = [fr.a, fr.b].sort().join('|')
    if (frSeen.has(k)) err(`${tag}: duplicate friendship ${k}`)
    frSeen.add(k)
    if (fr.value < 0 || fr.value > 100) err(`${tag}: friendship ${k} value ${fr.value}`)
  }
  for (const [a, b] of sc.rivals) {
    if (!offIds.has(a) || !offIds.has(b)) err(`${tag}: rival unknown ${a}-${b}`)
    if (frSeen.has([a, b].sort().join('|'))) err(`${tag}: rivals ${a}-${b} also have a friendship`)
  }
  const inOath = new Set<string>()
  for (const g of sc.oaths) {
    if (g.length < 2 || g.length > 4) err(`${tag}: oath group size ${g.length}`)
    for (const id of g) {
      if (!offIds.has(id)) err(`${tag}: oath member ${id} unknown`)
      if (inOath.has(id)) err(`${tag}: ${id} is in two oath groups`)
      inOath.add(id)
    }
  }
  // counts (12-data.md §6)
  const exist = new Set<string>(sc.officers.map((s) => s.id))
  for (const a of sc.appearances) if (a.year <= 200) exist.add(a.id)
  if (exist.size < 180) err(`${tag}: only ${exist.size} officers exist in ${sc.year} or appear by 200 (need 180)`)
  const hidden = sc.officers.filter((s) => s.hidden).length + sc.appearances.filter((a) => a.hidden).length
  if (hidden < 30) err(`${tag}: only ${hidden} hidden officers (need 30)`)
  if (sc.factions.length < 15) err(`${tag}: fewer than 15 factions`)
  const flagSeen = new Set(sc.flags)
  if (flagSeen.size !== sc.flags.length) err(`${tag}: duplicate flags`)
}
