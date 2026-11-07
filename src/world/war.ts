// W-WAR-*: armies, defence formation, battle setups, auto-resolve and outcome application.
import type { BattleOfficer, BattleOutcome, BattleSetup, BattleUnitSetup } from '../contracts/battle'
import type { Stats, TroopType } from '../contracts/data'
import type { Army, ArmyUnit, OfficerState } from '../contracts/world'
import { childSeed } from '../shared/rng'
import { autoBattleOutcome, sidePower, validateBattleOutcome, wallsFactor } from './battle-auto'
import {
  C, F, O, type Ctx, addFriendship, addRelation, bestType, cityName, clamp, factionName, hasBlocking, log, nameOf, nearestOwnCity,
  newPendingId, pactBetween, prof, roadBetween, sortedIds, troopCap, rankOf,
} from './core'
import { captureOfficer, clearPrefect, foundFaction, joinFaction, killOfficer, normalize, pushLetter, checkEnd } from './people'

export interface DefUnit {
  id: string
  troops: number
  type: TroopType
  commander: boolean
  garrison: boolean
}

const GARRISON_STATS: Stats = { war: 40, ldr: 40, int: 40, pol: 40, cha: 40 }

export function eligibleDefenders(c: Ctx, cityId: string): OfficerState[] {
  const ct = C(c, cityId)
  const out: OfficerState[] = []
  if (!ct.faction) return out
  for (const id of sortedIds(c.s.officers)) {
    const o = c.s.officers[id]!
    if (o.status === 'active' && !o.hidden && o.city === cityId && o.faction === ct.faction && o.health >= 30) out.push(o)
  }
  return out
}

const lw = (o: OfficerState): number => o.stats.ldr + o.stats.war

/** W-WAR-3 defence formation; `chosen` restricts the pool (the player's pick). */
export function formDefence(c: Ctx, cityId: string, chosen?: string[]): DefUnit[] {
  const ct = C(c, cityId)
  if (ct.troops <= 0 || !ct.faction) return []
  let pool = eligibleDefenders(c, cityId)
  if (chosen) pool = pool.filter((o) => chosen.includes(o.id))
  pool.sort((a, b) => {
    const pa = ct.prefect === a.id ? 1 : 0
    const pb = ct.prefect === b.id ? 1 : 0
    if (pa !== pb) return pb - pa
    return lw(b) - lw(a) || (a.id < b.id ? -1 : 1)
  })
  pool = pool.slice(0, 5)
  if (pool.length === 0) {
    if (chosen) return []
    return [{ id: `garrison-${cityId}`, troops: Math.min(ct.troops, 5000), type: 'spear', commander: true, garrison: true }]
  }
  const n = Math.min(pool.length, ct.troops)
  const per = Math.floor(ct.troops / n)
  return pool.slice(0, n).map((o, i) => ({ id: o.id, troops: Math.min(per, troopCap(o)), type: bestType(c, o.id), commander: i === 0, garrison: false }))
}

function defStats(c: Ctx, u: DefUnit): Stats {
  return u.garrison ? GARRISON_STATS : O(c, u.id).stats
}

export function unitsPower(c: Ctx, units: { officer: string; troops: number }[], training: number): number {
  let p = 0
  for (const u of units) {
    const st = O(c, u.officer).stats
    p += u.troops * (0.6 + (st.war + st.ldr) / 250) * (0.7 + training / 333)
  }
  return p
}

export function armyPower(c: Ctx, a: Army): number {
  const tr = a.uprising ? 20 : C(c, a.from).training
  return unitsPower(c, a.units, tr)
}

/** W-WAR-5: the defence's power if the city were attacked now. */
export function defencePower(c: Ctx, cityId: string): number {
  const ct = C(c, cityId)
  const def = formDefence(c, cityId)
  let p = 0
  for (const u of def) {
    const st = defStats(c, u)
    p += u.troops * (0.6 + (st.war + st.ldr) / 250) * (0.7 + ct.training / 333)
  }
  const max = c.d.cityDef.get(cityId)?.wallsMax ?? 100
  return p * (1 + (0.6 * ct.walls) / Math.max(1, max))
}

export function defenceTroops(c: Ctx, cityId: string): number {
  let t = 0
  for (const u of formDefence(c, cityId)) t += u.troops
  return t
}

export function suggestArmy(c: Ctx, fid: string, from: string, mustInclude?: string, fraction = 0.8, includeRuler = false): ArmyUnit[] {
  const ct = C(c, from)
  if (ct.faction !== fid) return []
  const pool = sortedIds(c.s.officers)
    .map((id) => c.s.officers[id]!)
    .filter((o) => o.status === 'active' && !o.hidden && o.faction === fid && o.city === from && o.health >= 30 && (includeRuler || o.post !== 'ruler'))
    .sort((a, b) => lw(b) - lw(a) || (a.id < b.id ? -1 : 1))
  let pick = pool.slice(0, 5)
  if (mustInclude) {
    const m = pool.find((o) => o.id === mustInclude)
    if (m && !pick.includes(m)) pick = [...pick.slice(0, 4), m]
  }
  if (pick.length === 0) return []
  const riceMax = Math.floor(ct.rice / 2) * 100
  const total = Math.min(Math.floor(ct.troops * fraction), riceMax)
  const per = Math.floor(total / pick.length)
  if (per < 1) return []
  pick.sort((a, b) => lw(b) - lw(a) || (a.id < b.id ? -1 : 1))
  return pick.map((o, i) => ({ officer: o.id, troops: Math.min(per, troopCap(o)), type: bestType(c, o.id), commander: i === 0 }))
}

/** W-WAR-1 / W-WAR-2 validation. Returns a message when the army is not allowed. */
export function checkArmy(c: Ctx, fid: string, from: string, to: string, units: ArmyUnit[]): string | null {
  const src = c.s.cities[from]
  const dst = c.s.cities[to]
  if (!src || !dst) return 'No such city.'
  if (src.faction !== fid) return 'The army must form in one of our cities.'
  if (!roadBetween(c, from, to)) return 'No road joins those cities.'
  if (dst.faction === fid) return 'That city is already ours.'
  if (dst.faction && pactBetween(c, fid, dst.faction)) return 'A pact forbids attacking that city.'
  if (!Array.isArray(units) || units.length < 1 || units.length > 5) return 'An army has one to five units.'
  const seen = new Set<string>()
  let total = 0
  let cmd = 0
  for (const u of units) {
    const o = c.s.officers[u.officer]
    if (!o || seen.has(u.officer)) return 'Unknown or repeated officer.'
    seen.add(u.officer)
    if (o.status !== 'active' || o.hidden || o.faction !== fid || o.city !== from) return `${nameOf(c, u.officer)} is not available in ${cityName(c, from)}.`
    if (o.health < 30) return `${nameOf(c, u.officer)} is too hurt to march.`
    if (!Number.isInteger(u.troops) || u.troops < 1) return 'Each unit needs at least one soldier.'
    if (u.troops > troopCap(o)) return `${nameOf(c, u.officer)} cannot lead more than ${troopCap(o)}.`
    if (u.type !== 'spear' && u.type !== 'cavalry' && u.type !== 'archer') return 'Unknown troop type.'
    if (u.commander) cmd++
    total += u.troops
  }
  if (cmd !== 1) return 'An army needs exactly one commander.'
  if (total > src.troops) return `${cityName(c, from)} has only ${src.troops} troops.`
  const rice = Math.ceil(total / 100) * 2
  if (rice > src.rice) return `The army needs ${rice} rice; ${cityName(c, from)} has ${src.rice}.`
  return null
}

export function createArmy(c: Ctx, fid: string, from: string, to: string, units: ArmyUnit[]): Army {
  const src = C(c, from)
  let total = 0
  for (const u of units) total += u.troops
  const rice = Math.ceil(total / 100) * 2
  src.troops -= total
  src.rice -= rice
  const army: Army = { id: `a${c.s.nextId++}`, faction: fid, from, to, units: units.map((u) => ({ ...u })), rice }
  for (const u of army.units) {
    const o = O(c, u.officer)
    clearPrefect(c, u.officer)
    o.status = 'army'
  }
  c.s.armies.push(army)
  return army
}

export function battleOfficer(c: Ctx, id: string): BattleOfficer {
  const o = O(c, id)
  const p = prof(c, id)
  const grp = o.oathGroup !== null ? c.s.oaths[o.oathGroup] ?? [] : []
  const bo: BattleOfficer = {
    id,
    name: p.name,
    stats: { ...o.stats },
    temperament: p.temperament,
    aptitude: { ...p.aptitude },
    health: o.health,
    oathGroup: grp.filter((x) => x !== id),
  }
  if (p.portrait) bo.portrait = p.portrait
  return bo
}

function garrisonOfficer(c: Ctx, cityId: string): BattleOfficer {
  return {
    id: `garrison-${cityId}`,
    name: `Garrison of ${cityName(c, cityId)}`,
    stats: { ...GARRISON_STATS },
    temperament: 'steady',
    aptitude: { spear: 'B', cavalry: 'B', archer: 'B' },
    health: 100,
    oathGroup: [],
  }
}

export function buildSetup(c: Ctx, army: Army, defenders: DefUnit[], played: boolean, controls: 'attacker' | 'defender' | 'none', onlyPlayer: boolean): BattleSetup {
  const ct = C(c, army.to)
  const units: BattleUnitSetup[] = []
  for (const u of army.units) units.push({ officer: battleOfficer(c, u.officer), side: 'attacker', troops: u.troops, type: u.type, commander: u.commander })
  for (const u of defenders) {
    units.push({ officer: u.garrison ? garrisonOfficer(c, army.to) : battleOfficer(c, u.id), side: 'defender', troops: u.troops, type: u.type, commander: u.commander })
  }
  let playerControls: string[] = []
  if (controls !== 'none') {
    playerControls = onlyPlayer
      ? [c.s.player]
      : units.filter((u) => u.side === controls && !u.officer.id.startsWith('garrison-')).map((u) => u.officer.id)
  }
  const road = roadBetween(c, army.from, army.to)
  const mm = String(c.s.ym.month).padStart(2, '0')
  return {
    id: `${c.s.ym.year}-${mm}-${army.id}`,
    seed: played ? childSeed(c.s.rng) : 0,
    attackerFaction: army.faction,
    defenderFaction: ct.faction,
    cityId: army.to,
    cityName: cityName(c, army.to),
    terrain: road?.terrain ?? 'plain',
    siege: true,
    walls: ct.walls,
    attackerTraining: army.uprising ? 20 : C(c, army.from).training,
    defenderTraining: ct.training,
    maxDays: 20,
    units,
    playerControls,
  }
}

// ---------- the armies stage ----------

function returnArmy(c: Ctx, army: Army, survivors?: { officer: string; troops: number }[]): void {
  c.s.armies = c.s.armies.filter((a) => a !== army)
  const fid = army.faction
  let dest: string | null = null
  if (fid) dest = C(c, army.from).faction === fid ? army.from : nearestOwnCity(c, fid, army.from)
  const list = survivors ?? army.units
  let troops = 0
  for (const u of list) troops += u.troops
  if (dest) {
    const ct = C(c, dest)
    ct.troops += troops
    ct.rice += army.rice
  }
  for (const u of list) {
    const o = c.s.officers[u.officer]
    if (!o || o.status === 'dead' || o.status === 'captive') continue
    o.status = 'active'
    if (dest) o.city = dest
  }
}

function playerInvolvement(c: Ctx, army: Army): 'attacker' | 'defender' | null {
  const po = c.s.officers[c.s.player]
  if (!po) return null
  if (po.status === 'army' && army.units.some((u) => u.officer === po.id)) return 'attacker'
  const ct = C(c, army.to)
  if (po.status === 'active' && po.city === army.to && ct.faction && po.faction === ct.faction && (po.post === 'ruler' || ct.prefect === po.id)) return 'defender'
  return null
}

export function runArmiesStage(c: Ctx): 'done' | 'paused' {
  let guard = 0
  while (c.s.armies.length && guard++ < 200) {
    if (hasBlocking(c)) return 'paused'
    const army = c.s.armies[0]!
    if (beginBattle(c, army) === 'paused') return 'paused'
    if (c.s.phase === 'ended') return 'done'
  }
  return 'done'
}

function beginBattle(c: Ctx, army: Army): 'done' | 'paused' {
  const fid = army.faction
  const dst = C(c, army.to)
  if (!army.uprising && fid) {
    if (!F(c, fid).alive) { returnArmy(c, army); return 'done' }
    if (dst.faction === fid || (dst.faction && pactBetween(c, fid, dst.faction))) { returnArmy(c, army); return 'done' }
  }
  const defenders = formDefence(c, army.to)
  if (defenders.length === 0) {
    // W-WAR-3: a vacant or troopless city falls at once
    const setup = buildSetup(c, army, [], false, 'none', false)
    const outcome: BattleOutcome = {
      battleId: setup.id, winner: 'attacker', reason: 'keep-taken', days: 0,
      units: setup.units.map((u) => ({ officer: u.officer.id, side: u.side, troopsStart: u.troops, troopsEnd: u.troops, routed: false, captured: false, slain: false, wounded: 0, merit: 0 })),
      duels: [],
    }
    applyOutcome(c, army.id, setup, outcome)
    return 'done'
  }
  const inv = playerInvolvement(c, army)
  if (inv === 'defender') {
    const cands = eligibleDefenders(c, army.to).map((o) => o.id)
    if (cands.length > 0) {
      c.s.pending.push({ kind: 'chooseDefenders', id: newPendingId(c), armyId: army.id, city: army.to, max: Math.min(5, cands.length), candidates: cands })
      return 'paused'
    }
  }
  if (inv === 'attacker') {
    const cmd = army.units.find((u) => u.commander)
    const all = cmd?.officer === c.s.player
    const setup = buildSetup(c, army, defenders, true, 'attacker', !all)
    c.s.pending.push({ kind: 'battle', id: newPendingId(c), armyId: army.id, setup })
    return 'paused'
  }
  const setup = buildSetup(c, army, defenders, false, 'none', false)
  const outcome = autoBattleOutcome(c.d, c.s, setup, c.s.rng)
  applyOutcome(c, army.id, setup, outcome)
  return 'done'
}

/** The player picked defenders: build the played battle. Returns an error message or null. */
export function answerDefenders(c: Ctx, pendingId: string, officers: string[]): string | null {
  const p = c.s.pending[0]
  if (!p || p.kind !== 'chooseDefenders' || p.id !== pendingId) return 'No such decision.'
  if (!Array.isArray(officers) || officers.length < 1 || officers.length > p.max) return `Choose 1 to ${p.max} defenders.`
  if (new Set(officers).size !== officers.length) return 'Repeated officer.'
  for (const id of officers) if (!p.candidates.includes(id)) return 'That officer cannot defend.'
  const army = c.s.armies.find((a) => a.id === p.armyId)
  c.s.pending.shift()
  if (!army) return null
  const defenders = formDefence(c, army.to, officers)
  if (defenders.length === 0) { // cannot happen (candidates are eligible) but never stall
    const setup = buildSetup(c, army, formDefence(c, army.to), false, 'none', false)
    applyOutcome(c, army.id, setup, autoBattleOutcome(c.d, c.s, setup, c.s.rng))
    return null
  }
  const setup = buildSetup(c, army, defenders, true, 'defender', false)
  c.s.pending.unshift({ kind: 'battle', id: newPendingId(c), armyId: army.id, setup })
  return null
}

/** The client answered a battle pending. Returns an error message or null. */
export function answerBattle(c: Ctx, pendingId: string, outcome: BattleOutcome): string | null {
  const p = c.s.pending[0]
  if (!p || p.kind !== 'battle' || p.id !== pendingId) return 'No such decision.'
  const err = validateBattleOutcome(p.setup, outcome)
  if (err) return err
  c.s.pending.shift()
  const army = c.s.armies.find((a) => a.id === p.armyId)
  if (army) applyOutcome(c, army.id, p.setup, outcome)
  return null
}

// ---------- applying an outcome ----------

function retreatOfficer(c: Ctx, id: string, fromCity: string, fid: string): void {
  const o = O(c, id)
  clearPrefect(c, id)
  const dest = nearestOwnCity(c, fid, fromCity, fromCity)
  if (dest) { o.city = dest; o.status = 'active' }
  else captureOfficer(c, id, fromCity)
}

export function applyOutcome(c: Ctx, armyId: string, setup: BattleSetup, outcome: BattleOutcome): void {
  const army = c.s.armies.find((a) => a.id === armyId)
  if (!army) return
  c.s.armies = c.s.armies.filter((a) => a !== army)
  const ct = C(c, setup.cityId)
  const atkFid = army.faction
  const defFid = setup.defenderFaction
  const attackerWins0 = outcome.winner === 'attacker'
  const res = new Map(outcome.units.map((u) => [u.officer, u]))
  const isReal = (id: string): boolean => !id.startsWith('garrison-')

  // wounds, merit, comrades (W-TIE-7), relation (W-DIP-1)
  const sideIds: Record<'attacker' | 'defender', string[]> = { attacker: [], defender: [] }
  for (const u of setup.units) if (isReal(u.officer.id)) sideIds[u.side].push(u.officer.id)
  for (const r of outcome.units) {
    if (!isReal(r.officer)) continue
    const o = O(c, r.officer)
    o.health = Math.max(0, o.health - r.wounded)
    o.merit += r.merit
  }
  for (const side of ['attacker', 'defender'] as const) {
    const ids = sideIds[side]
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) addFriendship(c, ids[i]!, ids[j]!, 2)
  }
  if (atkFid && defFid) addRelation(c, atkFid, defFid, -20)

  // survivors on each side
  const alive = (id: string): boolean => {
    const r = res.get(id)
    return !!r && !r.slain && !r.captured
  }
  let atkTroops = 0
  const atkSurvivors: { officer: string; troops: number }[] = []
  for (const u of army.units) {
    const r = res.get(u.officer)
    if (!r || !alive(u.officer)) continue
    atkTroops += r.troopsEnd
    atkSurvivors.push({ officer: u.officer, troops: r.troopsEnd })
  }
  let defStart = 0
  let defEnd = 0
  for (const u of setup.units) {
    if (u.side !== 'defender') continue
    defStart += u.troops
    const r = res.get(u.officer.id)
    defEnd += r ? (r.slain || r.captured ? 0 : r.troopsEnd) : 0
  }
  const nonParticipating = Math.max(0, ct.troops - defStart)

  // rebels (an uprising) need a living officer to hold the city
  const attackerWins = attackerWins0 && (atkFid !== null || atkSurvivors.length > 0)

  // slain (before captures so rulers/prefects are handled once)
  const captured: string[] = []
  for (const r of outcome.units) {
    if (!isReal(r.officer)) continue
    if (r.slain) killOfficer(c, r.officer, 'slain in battle')
    else if (r.captured || (!attackerWins && atkFid === null && r.side === 'attacker')) {
      // W-WAR-5: a ruler with another city to fall back on retreats instead of being captured
      const ro = O(c, r.officer)
      const fid = r.side === 'attacker' ? atkFid : defFid
      if (fid && ro.post === 'ruler' && Object.values(c.s.cities).some((x) => x.faction === fid && x.id !== setup.cityId)) continue
      captured.push(r.officer)
    }
  }
  captured.sort((a, b) => (O(c, a).post === 'ruler' ? 1 : 0) - (O(c, b).post === 'ruler' ? 1 : 0)) // rulers last, so no chain of successions
  const atkName = atkFid ? factionName(c, atkFid) : 'The rebels'
  const defName = factionName(c, defFid)
  const cmdId = army.units.find((u) => u.commander)?.officer ?? army.units[0]!.officer
  const involved = [cmdId]
  const pf = c.s.officers[c.s.player]?.faction ?? null
  if (pf && (pf === atkFid || pf === defFid)) involved.push(c.s.player)

  if (attackerWins) {
    // city falls
    let newFid = atkFid
    const prevFid = defFid
    // holders of the captives: the city's new owner; for a founding, set after founding
    const heroes = atkSurvivors.map((s) => s.officer)
    if (newFid === null) {
      const ruler = heroes.includes(cmdId) ? cmdId : heroes[0]!
      newFid = foundFaction(c, ruler, setup.cityId, heroes.filter((h) => h !== ruler))
    } else {
      ct.faction = newFid
    }
    ct.prefect = null
    ct.troops = atkTroops
    ct.gold = Math.floor(ct.gold / 2)
    ct.rice = Math.floor(ct.rice / 2) + army.rice
    ct.order = clamp(ct.order - 20, 0, 100)
    for (const h of heroes) {
      const o = O(c, h)
      o.status = 'active'
      o.city = setup.cityId
    }
    for (const id of captured) {
      const o = O(c, id)
      if (o.status === 'dead' || o.status === 'captive') continue
      captureOfficer(c, id, setup.cityId)
    }
    // the previous owner's officers in the city retreat
    if (prevFid) {
      for (const id of sortedIds(c.s.officers)) {
        const o = c.s.officers[id]!
        if (o.status === 'active' && o.faction === prevFid && o.city === setup.cityId) retreatOfficer(c, id, setup.cityId, prevFid)
      }
    }
    // the commander (or best survivor) becomes prefect (rulers never hold a prefecture)
    if (atkFid !== null) {
      const cand = heroes
        .map((h) => O(c, h))
        .filter((o) => o.post !== 'ruler' && o.status === 'active')
        .sort((a, b) => (a.id === cmdId ? -1 : b.id === cmdId ? 1 : lw(b) - lw(a) || (a.id < b.id ? -1 : 1)))[0]
      if (cand) { ct.prefect = cand.id; cand.post = 'prefect' }
    }
    log(c, 'battle', `${atkName} took ${cityName(c, setup.cityId)} from ${defName}.`, involved, setup.cityId)
    if (pf && pf === prevFid) pushLetter(c, `${cityName(c, setup.cityId)} has fallen`, `${atkName} took ${cityName(c, setup.cityId)}. Our officers fell back.`)
  } else {
    // defender holds
    ct.troops = nonParticipating + defEnd
    for (const id of captured) {
      const o = O(c, id)
      if (o.status === 'dead' || o.status === 'captive') continue
      captureOfficer(c, id, setup.cityId)
    }
    returnArmy(c, army, atkSurvivors)
    log(c, 'battle', `${defName} held ${cityName(c, setup.cityId)} against ${atkName}.`, involved, setup.cityId)
  }
  // anyone from the army still marked as army (not in the survivors list) is released
  for (const u of army.units) {
    const o = c.s.officers[u.officer]
    if (o && o.status === 'army') o.status = 'active'
  }
  normalize(c)
  checkEnd(c)
}

export { sidePower, wallsFactor, rankOf, joinFaction }
