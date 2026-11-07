// query.*: every number the UI shows. Read-only functions over a WorldState.
import type { Army, ArmyUnit, Mission, WorldAction, WorldState } from '../contracts/world'
import {
  C, F, O, type Ctx, type DataIdx, RANK_CAP, RANK_MERIT, RANK_NAMES, RANK_SALARY, ageOf, cityName, factionCities, factionName, factionOfficers, friendship, isRival, isKin,
  makeCtx, nameOf, neighbors, officersIn, pactBetween, prof, rankOf, relation, sortedIds, totalTroops, troopCap, salaryOf, ymNum, compat,
} from './core'
import { KINDS, candidates, legalOfKind } from './enumerate'
import {
  DAYS, captiveChance, checkAction, costOf, describeMission, diploChance, hiddenIn, marryChance, proposeChance, recruitChance, searchChances, serveChance,
  servePatron, warContext, workInfo,
} from './rules'
import { armyPower as armyPowerC, defencePower as defencePowerC, defenceTroops, formDefence, suggestArmy as suggestArmyC, suggestArmyLedBy, unitsPower } from './war'
import type {
  ActionGroup, ActionItem, CanResult, ChanceInfo, CityView, FactionView, MonthReportRow, OfficerView, PowerInfo, SaveSummary, TieView,
} from './types'

const GROUP: Record<string, ActionGroup> = {
  work: 'Work',
  visit: 'People', banquet: 'People', gift: 'People', recruit: 'People', serve: 'People', challenge: 'People', oath: 'People', marry: 'People',
  appoint: 'Court', transfer: 'Court', mission: 'Court', transport: 'Court', war: 'Court', diplomacy: 'Court', captive: 'Court', focus: 'Court', propose: 'Court',
  travel: 'Travel',
  search: 'Self', study: 'Self', drill: 'Self', rest: 'Self', resign: 'Self', claim: 'Self', uprise: 'Self',
}

const LABEL: Record<string, string> = {
  visit: 'Visit', banquet: 'Give a banquet', gift: 'Give a gift', recruit: 'Recruit a wanderer', serve: 'Ask to serve', challenge: 'Challenge to a duel', oath: 'Swear an oath',
  marry: 'Propose marriage', appoint: 'Appoint a prefect', transfer: 'Transfer an officer', mission: 'Give a mission', transport: 'Send supplies', war: 'Send an army',
  diplomacy: 'Send an envoy', captive: 'Deal with a captive', focus: 'Set city focus', propose: 'Propose to the ruler', search: 'Search the city', rest: 'Rest', resign: 'Resign',
  claim: 'Claim this city', uprise: 'Raise an uprising',
}

const NO_CANDIDATE: Record<string, string> = {
  visit: 'No one else is here.', gift: 'No one to give to.', recruit: 'No wanderer here to recruit.', challenge: 'No one here to challenge.', oath: 'No one here to swear with.',
  marry: 'No one here to marry.', appoint: 'Only a ruler appoints prefects.', transfer: 'Only a ruler transfers officers.', mission: 'Only a ruler gives missions.',
  transport: 'Needs two connected cities of your house.', war: 'Only a ruler orders war.', diplomacy: 'Only a ruler (or an envoy on mission) conducts diplomacy.',
  captive: 'No captives to deal with.', propose: 'Only an officer of a house proposes.', banquet: 'Only a ruler or prefect hosts a banquet.',
  serve: 'Only wanderers ask to serve.', claim: 'Needs a wanderer in a vacant city.', uprise: 'Needs a wanderer in a held city.', resign: 'You have no post to resign.',
  focus: 'Only a ruler or prefect sets the focus.',
}

function templateFor(kind: WorldAction['kind']): WorldAction {
  switch (kind) {
    case 'work': return { kind: 'work', work: 'farm' }
    case 'travel': return { kind: 'travel', to: '' }
    case 'visit': return { kind: 'visit', officer: '' }
    case 'gift': return { kind: 'gift', officer: '', gold: 50 }
    case 'study': return { kind: 'study', stat: 'int' }
    case 'drill': return { kind: 'drill', stat: 'war' }
    case 'recruit': return { kind: 'recruit', officer: '', mode: 'persuade' }
    case 'challenge': return { kind: 'challenge', officer: '' }
    case 'oath': return { kind: 'oath', officer: '' }
    case 'marry': return { kind: 'marry', officer: '' }
    case 'appoint': return { kind: 'appoint', officer: '' }
    case 'transfer': return { kind: 'transfer', officer: '', to: '' }
    case 'mission': return { kind: 'mission', officer: '', mission: { kind: 'scout', city: '', reached: false, deadline: { year: 0, month: 1 } } }
    case 'transport': return { kind: 'transport', from: '', to: '', gold: 0, rice: 0, troops: 0 }
    case 'war': return { kind: 'war', from: '', to: '', units: [] }
    case 'diplomacy': return { kind: 'diplomacy', envoy: '', faction: '', proposal: 'truce', mode: 'roll' }
    case 'captive': return { kind: 'captive', officer: '', decision: 'recruit' }
    case 'focus': return { kind: 'focus', city: '', focus: 'balanced' }
    case 'propose': return { kind: 'propose', proposal: 'prefect' }
    case 'banquet': return { kind: 'banquet' }
    case 'search': return { kind: 'search' }
    case 'rest': return { kind: 'rest' }
    case 'serve': return { kind: 'serve' }
    case 'resign': return { kind: 'resign' }
    case 'claim': return { kind: 'claim' }
    case 'uprise': return { kind: 'uprise' }
    default: return { kind: 'endMonth' }
  }
}

export function createQuery(d: DataIdx) {
  const ctx = (s: WorldState): Ctx => makeCtx(d, s)

  function ties(c: Ctx, id: string): TieView[] {
    const o = O(c, id)
    const out: TieView[] = []
    const seen = new Set<string>()
    const push = (other: string, kind: TieView['kind'], note: string): void => {
      if (seen.has(other) || !c.s.officers[other] || c.s.officers[other]!.status === 'unborn') return
      seen.add(other)
      out.push({ other, name: nameOf(c, other), kind, value: friendship(c, id, other), note })
    }
    if (o.spouse) push(o.spouse, 'spouse', 'Spouse')
    if (o.oathGroup !== null) for (const m of c.s.oaths[o.oathGroup] ?? []) if (m !== id) push(m, 'oath', 'Sworn sibling')
    const def = d.officerDef.get(id)
    if (def) for (const k of def.kin) push(k.id, 'kin', k.role[0]!.toUpperCase() + k.role.slice(1))
    for (const key of c.s.rivals) {
      const [a, b] = key.split('|') as [string, string]
      if (a === id) push(b, 'rival', 'Rival')
      else if (b === id) push(a, 'rival', 'Rival')
    }
    const friends: [string, number][] = []
    for (const key in c.s.friendships) {
      const [a, b] = key.split('|') as [string, string]
      if (a !== id && b !== id) continue
      friends.push([a === id ? b : a, c.s.friendships[key]!])
    }
    friends.sort((x, y) => (y[1] - x[1]) || (x[0] < y[0] ? -1 : 1))
    for (const [oid, v] of friends) {
      if (v <= 5) push(oid, 'rival', 'Rival (friendship 5 or less)')
      else if (v >= 50 && out.length < 24) push(oid, 'friend', v >= 80 ? 'Close friend' : 'Friend')
    }
    return out
  }

  function missionText(c: Ctx, m: Mission | null): string | null {
    return m ? describeMission(c, m) : null
  }

  function officerView(s: WorldState, id: string): OfficerView | null {
    const c = ctx(s)
    const o = s.officers[id]
    if (!o) return null
    const p = prof(c, id)
    const r = rankOf(o)
    const v: OfficerView = {
      id,
      name: p.name,
      sex: p.sex,
      born: p.born,
      age: ageOf(c, id),
      stats: { ...o.stats },
      xp: { ...o.xp },
      temperament: p.temperament,
      aptitude: { ...p.aptitude },
      status: o.status,
      post: o.post,
      rank: r,
      rankName: RANK_NAMES[r]!,
      nextRankMerit: o.post === 'ruler' || r >= 4 ? null : RANK_MERIT[r + 1]!,
      troopCap: RANK_CAP[r]!,
      salary: RANK_SALARY[r]!,
      faction: o.faction,
      factionName: o.faction ? s.factions[o.faction]?.name ?? null : null,
      city: o.city,
      cityName: o.city ? cityName(c, o.city) : null,
      loyalty: o.loyalty,
      merit: o.merit,
      gold: o.gold,
      health: o.health,
      days: o.days,
      hidden: o.hidden,
      mission: o.mission,
      missionText: missionText(c, o.mission),
      spouse: o.spouse,
      oathGroup: o.oathGroup !== null ? (s.oaths[o.oathGroup] ?? []).filter((m) => m !== id) : [],
      ties: o.status === 'unborn' ? [] : ties(c, id),
      items: o.items.slice(),
      isPlayer: id === s.player,
    }
    if (p.courtesy) v.courtesy = p.courtesy
    if (p.portrait) v.portrait = p.portrait
    return v
  }

  function cityView(s: WorldState, id: string): CityView | null {
    const c = ctx(s)
    const ct = s.cities[id]
    const def = d.cityDef.get(id)
    if (!ct || !def) return null
    const row = (x: { id: string; post: CityView['officers'][number]['post']; status: CityView['officers'][number]['status']; faction: string | null; merit: number; loyalty: number | null }): CityView['officers'][number] => ({
      id: x.id, name: nameOf(c, x.id), post: x.post, rankName: RANK_NAMES[rankOf(x as never)]!, status: x.status, faction: x.faction,
    })
    const officers = officersIn(c, id).map(row)
    const captives = sortedIds(s.officers).map((k) => s.officers[k]!).filter((x) => x.status === 'captive' && x.city === id).map(row)
    return {
      id, name: def.name, province: def.province, faction: ct.faction, factionName: ct.faction ? factionName(c, ct.faction) : null, prefect: ct.prefect,
      prefectName: ct.prefect ? nameOf(c, ct.prefect) : null, population: ct.population, farm: ct.farm, farmMax: def.farmMax, trade: ct.trade, tradeMax: def.tradeMax,
      walls: ct.walls, wallsMax: def.wallsMax, order: ct.order, troops: ct.troops, training: ct.training, gold: ct.gold, rice: ct.rice, focus: ct.focus, officers, captives,
      neighbors: neighbors(c, id).map((e) => ({ id: e.to, name: cityName(c, e.to), days: e.days, terrain: e.terrain, faction: C(c, e.to).faction })),
      incomeGold: ct.faction ? Math.floor((ct.trade * (50 + ct.order)) / 400) : 0,
      harvestRice: ct.faction ? Math.floor((ct.farm * (50 + ct.order)) / 20) : 0,
      upkeepRice: ct.faction ? Math.ceil(ct.troops / 100) : 0,
      defencePower: Math.round(defencePowerC(c, id)),
    }
  }

  function factionView(s: WorldState, id: string): FactionView | null {
    const c = ctx(s)
    const f = s.factions[id]
    if (!f) return null
    const cities = factionCities(c, id)
    let gold = 0
    let rice = 0
    for (const k of cities) { gold += C(c, k).gold; rice += C(c, k).rice }
    const relations: FactionView['relations'] = []
    for (const oid of sortedIds(s.factions)) {
      if (oid === id || !s.factions[oid]!.alive) continue
      const pact = pactBetween(c, id, oid)
      const p = pact ? s.pacts.find((x) => (x.a === id && x.b === oid) || (x.a === oid && x.b === id) ? x.kind === pact : false) : undefined
      relations.push({ faction: oid, name: s.factions[oid]!.name, value: relation(c, id, oid), pact, until: p ? { ...p.until } : null })
    }
    return {
      id, name: f.name, glyph: f.glyph, color: f.color, alive: f.alive, ruler: f.ruler, rulerName: nameOf(c, f.ruler), capital: f.capital, cities,
      officers: factionOfficers(c, id).map((x) => x.id), totalTroops: totalTroops(c, id), totalGold: gold, totalRice: rice, relations,
    }
  }

  function describeItem(c: Ctx, kind: WorldAction['kind'], actor: string, all = false): ActionItem[] {
    const items: ActionItem[] = []
    const o = c.s.officers[actor]!
    const make = (action: WorldAction, available: boolean, reason: string | null, label: string): ActionItem => {
      const cost = costOf(c, actor, action)
      return {
        group: GROUP[kind] ?? 'Self', kind, label, action, days: cost.days, gold: cost.gold, available, reason,
        chance: available ? chanceOfC(c, action)?.pct ?? null : null,
      }
    }
    const lab = (a: WorldAction): string => {
      switch (a.kind) {
        case 'work': return `${a.work[0]!.toUpperCase()}${a.work.slice(1)} work`
        case 'travel': return `Travel to ${cityName(c, a.to)}`
        case 'study': return `Study ${a.stat.toUpperCase()}`
        case 'drill': return `Drill ${a.stat.toUpperCase()}`
        default: return LABEL[a.kind] ?? a.kind
      }
    }
    const enumerated = kind === 'work' || kind === 'travel' || kind === 'study' || kind === 'drill'
    if (enumerated) {
      for (const a of candidates(c, actor, kind)) {
        const f = checkAction(c, actor, a)
        items.push(make(a, !f, f ? f.message : null, lab(a)))
      }
      if (items.length === 0) items.push(make(templateFor(kind), false, 'Nowhere to go.', lab(templateFor(kind))))
      return items
    }
    const legal = all ? legalOfKind(c, actor, kind, true) : legalOfKind(c, actor, kind, false)
    if (legal.length) {
      for (const a of legal) items.push(make(a, true, null, lab(a)))
      return items
    }
    const cands = candidates(c, actor, kind)
    if (cands.length) {
      const f = checkAction(c, actor, cands[0]!)
      items.push(make(cands[0]!, false, f ? f.message : 'Not possible now.', lab(cands[0]!)))
    } else {
      const t = templateFor(kind)
      items.push(make(t, false, o.status !== 'active' ? 'Not available now.' : NO_CANDIDATE[kind] ?? 'Not possible now.', lab(t)))
    }
    return items
  }

  function actionsHere(s: WorldState): ActionItem[] {
    const c = ctx(s)
    const out: ActionItem[] = []
    const o = s.officers[s.player]
    if (!o || o.status !== 'active' || !o.city) return out
    for (const k of KINDS) out.push(...describeItem(c, k, s.player))
    return out
  }

  function targetsFor(s: WorldState, kind: WorldAction['kind']): WorldAction[] {
    const c = ctx(s)
    return legalOfKind(c, s.player, kind, true)
  }

  function chanceOfC(c: Ctx, a: WorldAction): ChanceInfo | null {
    const actorId = c.s.player
    const o = c.s.officers[actorId]
    if (!o || !o.city) return null
    switch (a.kind) {
      case 'recruit': {
        const t = c.s.officers[a.officer]
        return t ? { pct: recruitChance(c, o, t), what: 'they agree to join' } : null
      }
      case 'serve': {
        const p = servePatron(c, o.city)
        return p ? { pct: serveChance(c, o, p), what: 'you are taken in' } : null
      }
      case 'marry': { const t = c.s.officers[a.officer]; return t && t.id !== actorId ? { pct: t.id === actorId ? 0 : marryChance(c, actorId, a.officer), what: 'they accept' } : null }
      case 'oath': { const t = c.s.officers[a.officer]; return t ? { pct: compat(c, actorId, a.officer) >= 0 ? 100 : 0, what: 'they accept (needs compatibility 0 or more)' } : null }
      case 'challenge': {
        const t = c.s.officers[a.officer]
        if (!t) return null
        return { pct: t.stats.war >= o.stats.war - 10 || prof(c, t.id).temperament === 'reckless' ? 100 : 0, what: 'they accept the challenge' }
      }
      case 'diplomacy': {
        const env = c.s.officers[a.envoy]
        if (!env || !env.faction || !c.s.factions[a.faction]) return null
        return { pct: diploChance(c, env, env.faction, a.faction, a.proposal), what: `the ${a.proposal} is agreed` }
      }
      case 'captive': {
        const t = c.s.officers[a.officer]
        return t && a.decision === 'recruit' ? { pct: captiveChance(c, actorId, t), what: 'the captive yields' } : null
      }
      case 'search': {
        const sc = searchChances(c, o)
        const info: ChanceInfo = { pct: sc.hidden ?? sc.gold, what: sc.hidden !== null ? 'you find a hidden officer' : `you find ${sc.goldAmount} gold` }
        if (sc.hidden !== null) info.alt = { pct: sc.gold, what: `otherwise you find ${sc.goldAmount} gold` }
        return info
      }
      case 'propose': {
        const f = o.faction ? c.s.factions[o.faction] : undefined
        const r = f ? c.s.officers[f.ruler] : undefined
        if (!r) return null
        const bonus = a.proposal === 'war' && a.to ? warContext(c, o.city, a.to, a.units ?? suggestArmyLedBy(c, o.faction!, o.city, o.id)) : 0
        return { pct: proposeChance(c, o, r, a.proposal, bonus), what: 'the ruler approves' }
      }
      default: return null
    }
  }

  function powerInfo(c: Ctx, units: { officer: string; troops: number }[], training: number, mult = 1): PowerInfo {
    let t = 0
    for (const u of units) t += u.troops
    const p = Math.round(unitsPower(c, units, training) * mult)
    return { power: p, troops: t, units: units.length, breakdown: `${units.length} units, ${t} troops, training ${training}${mult !== 1 ? `, walls x${mult.toFixed(2)}` : ''}` }
  }

  return {
    officerView,
    cityView,
    factionView,
    actionsHere,
    targetsFor,
    can(s: WorldState, what: WorldAction['kind'] | WorldAction): CanResult {
      const c = ctx(s)
      const id = s.player
      if (typeof what !== 'string') {
        const f = checkAction(c, id, what)
        const cost = costOf(c, id, what)
        return { ok: !f, reason: f ? f.message : null, days: cost.days, gold: cost.gold }
      }
      const item = describeItem(c, what, id)[0]
      if (!item) return { ok: false, reason: 'Not possible now.', days: 0, gold: 0 }
      return { ok: item.available, reason: item.reason, days: item.days, gold: item.gold }
    },
    chanceOf(s: WorldState, a: WorldAction): ChanceInfo | null {
      return chanceOfC(ctx(s), a)
    },
    armyPower(s: WorldState, army: Pick<Army, 'from' | 'units'> & { uprising?: boolean }): PowerInfo {
      const c = ctx(s)
      return powerInfo(c, army.units, army.uprising ? 20 : C(c, army.from).training)
    },
    defencePower(s: WorldState, city: string): PowerInfo {
      const c = ctx(s)
      const ct = C(c, city)
      const def = formDefence(c, city)
      const walls = 1 + (0.6 * ct.walls) / Math.max(1, d.cityDef.get(city)?.wallsMax ?? 100)
      const info = powerInfo(c, def.map((u) => ({ officer: u.garrison ? '' : u.id, troops: u.troops })).filter((u) => u.officer !== ''), ct.training, walls)
      const garrison = def.find((u) => u.garrison)
      if (garrison) {
        const p = Math.round(garrison.troops * (0.6 + 80 / 250) * (0.7 + ct.training / 333) * walls)
        return { power: p, troops: garrison.troops, units: 1, breakdown: `garrison of ${garrison.troops}, training ${ct.training}, walls x${walls.toFixed(2)}` }
      }
      return info
    },
    defenceTroops(s: WorldState, city: string): number { return defenceTroops(ctx(s), city) },
    /** The army the player's house would raise in `from`; with `proposer` (W-PROP-1) an army led by and fitted to that officer. */
    suggestArmy(s: WorldState, from: string, to: string, proposer?: string): ArmyUnit[] {
      const c = ctx(s)
      const o = s.officers[s.player]
      if (!o?.faction) return []
      void to
      return proposer ? suggestArmyLedBy(c, o.faction, from, proposer) : suggestArmyC(c, o.faction, from, undefined)
    },
    monthReport(s: WorldState): MonthReportRow[] {
      const prev = ymNum(s.ym) - 1
      return s.log.filter((e) => ymNum(e.ym) >= prev).map((e) => (e.city ? { ym: e.ym, kind: e.kind, text: e.text, officers: e.officers, city: e.city } : { ym: e.ym, kind: e.kind, text: e.text, officers: e.officers }))
    },
    saveSummary(s: WorldState): SaveSummary {
      const c = ctx(s)
      const o = s.officers[s.player]
      const name = nameOf(c, s.player)
      const fn = o?.faction ? factionName(c, o.faction) : null
      const rn = o ? (o.post === 'ruler' ? 'Ruler' : RANK_NAMES[rankOf(o)]!) : ''
      const cities = o?.faction ? factionCities(c, o.faction).length : 0
      const line = `${name}, ${o?.post === 'wanderer' ? 'wanderer' : `${rn} of ${fn}`} - year ${s.ym.year}, month ${s.ym.month}`
      return { line, ym: { ...s.ym }, playerName: name, factionName: fn, post: o?.post ?? 'wanderer', rankName: rn, cities }
    },
    /** salary / troop cap / next rank etc. are on officerView; this helper lists all officers for pickers */
    officerIds(s: WorldState, filter?: 'active' | 'wanderers' | 'start'): string[] {
      const out: string[] = []
      for (const id of sortedIds(s.officers)) {
        const o = s.officers[id]!
        if (filter === 'active' && o.status !== 'active') continue
        if (filter === 'wanderers' && !(o.status === 'active' && o.post === 'wanderer' && !o.hidden)) continue
        out.push(id)
      }
      return out
    },
    cityIds(): string[] { return d.cityIds.slice() },
    isRival(s: WorldState, a: string, b: string): boolean { return isRival(ctx(s), a, b) },
    isKin(s: WorldState, a: string, b: string): boolean { return isKin(ctx(s), a, b) },
    hiddenHere(s: WorldState): boolean {
      const o = s.officers[s.player]
      return !!o?.city && !!hiddenIn(ctx(s), o.city)
    },
    troopCap(s: WorldState, id: string): number { return troopCap(O(ctx(s), id)) },
    salary(s: WorldState, id: string): number { return salaryOf(O(ctx(s), id)) },
    workPreview(s: WorldState, work: Parameters<typeof workInfo>[2]): { gold: number; gain: number; capped: boolean } | null {
      const c = ctx(s)
      const o = s.officers[s.player]
      if (!o?.city || !s.cities[o.city]) return null
      const w = workInfo(c, o, work)
      return { gold: w.gold, gain: w.gain, capped: w.capped }
    },
  }
}

export type WorldQuery = ReturnType<typeof createQuery>
export { DAYS, F, armyPowerC, defencePowerC }
