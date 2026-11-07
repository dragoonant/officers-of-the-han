// World engine entry points: newGame, legalActions, step, replay.
//
// RNG DRAW ORDER (one sfc32 stream in state.rng; replay depends on it):
//  newGame: (1) for each officer def by ascending id with a death year (or none: age-75 rule), if options.lifespans: one draw
//           floor(rng*12) for the death month; (2) the created officer's death month draw; (3) the first month start (below).
//  A player action draws only inside its own rule (in the order the rule text lists):
//           W-ACT-SEARCH: [hidden officer found?] (only if one is hidden here) then [gold found? 50%]; W-ACT-RECRUIT/SERVE/MARRY: one d100;
//           W-ACT-CHALLENGE (no player in it): WAR+health/10+20*rng for the challenger then for the target; a debate/duel pending
//           draws one childSeed; W-CRT-DIPLO/propose: one d100 (propose: approval d100, then for alliance/truce the envoy d100);
//           W-CRT-CAPTIVE recruit: one d100.
//  endMonth pipeline, stage by stage:
//   1 ai-officers: officers by ascending id; per officer, draws happen in this order inside src/ai/world/officer.ts
//        (offer rolls to the player; the 20% visit gate once at 30 days left; each action's own draws).
//   2 armies: armies in creation order; each unplayed battle: 1 draw (attacker wins?), then one draw per losing real officer
//        (capture, attacker units then defender units in setup order). A played battle draws 1 childSeed at setup time.
//   3 captives: if the player is a prisoner: one d100 (does the captor offer a place).
//   4 events: for each event in data order that is open, unfired, whose conditions hold and that fits: one d100 (chance);
//        contest setups draw one childSeed each when the player picks an option.
//   5 deaths: no draws.
//   6 loyalty: officers by ascending id: defection d100 (only if loyalty < 30, AI officer), then rebellion d100 (only if AI ambitious
//        prefect with loyalty < 25, not bound).
//   7 missions: no draws.
//   8 month-start: no economy draws; AI courts by ascending faction id (src/ai/world/ruler.ts: mission offer d100 then a pick draw,
//        captives: recruit d100 then a release/execute d100, war and diplomacy rolls through the rules above, threatened gate d100).
import type { BattleOutcome } from '../contracts/battle'
import type { DebateOutcome, DuelOutcome } from '../contracts/contest'
import type { GameData } from '../contracts/data'
import type { CreatedOfficer, NewGameOptions, OfficerState, StepResult, WorldAction, WorldState, Pending, RejectCode } from '../contracts/world'
import { seedRng, clamp, nextFloat } from '../shared/rng'
import { autoBattleOutcome, autoDebateOutcome, autoDuelOutcome } from './battle-auto'
import {
  C, F, O, type Ctx, type DataIdx, addFriendship, bestType, cloneState, factionName, friendship, hasBlocking, indexData, log, makeCtx, nameOf, pk, prof, setFriendship, sortedIds,
} from './core'
import { playerActions } from './enumerate'
import { answerEventChoice, finishEventContest } from './events'
import { answerCaptured, monthStart, runPipeline, startPipeline } from './month'
import { applyDuelResult, applyAction, checkAction, doMarry, doOath, recruitSuccess, applyDiploResult } from './rules'
import { joinFaction, normalize, checkEnd } from './people'
import { answerBattle, answerDefenders, formDefence } from './war'

const STAT_KEYS = ['war', 'ldr', 'int', 'pol', 'cha'] as const

// ---------- new game ----------
export function newGame(d: DataIdx, opts: NewGameOptions): WorldState {
  const sc = d.data.scenarios.find((x) => x.id === opts.scenario)
  if (!sc) throw new Error(`Unknown scenario ${opts.scenario}`)
  const rng = seedRng(opts.seed)
  const s: WorldState = {
    version: 1,
    scenario: sc.id,
    ym: { year: sc.year, month: sc.month },
    phase: 'player',
    cursor: null,
    rng,
    seed: opts.seed,
    options: { lifespans: opts.options?.lifespans ?? true, events: opts.options?.events ?? true },
    player: '',
    cities: {},
    officers: {},
    factions: {},
    relations: {},
    friendships: {},
    rivals: [],
    oaths: [],
    pacts: [],
    armies: [],
    flags: sc.flags.slice(),
    firedEvents: [],
    pending: [],
    log: [],
    ended: null,
    nextId: 1,
  }
  for (const cd of d.data.cities) {
    const st = sc.cities.find((x) => x.id === cd.id)
    s.cities[cd.id] = {
      id: cd.id,
      faction: st?.faction ?? null,
      prefect: null,
      population: st?.population ?? 10000,
      farm: Math.min(cd.farmMax, st?.farm ?? Math.floor(cd.farmMax / 2)),
      trade: Math.min(cd.tradeMax, st?.trade ?? Math.floor(cd.tradeMax / 2)),
      walls: Math.min(cd.wallsMax, st?.walls ?? Math.floor(cd.wallsMax / 2)),
      order: clamp(st?.order ?? 50, 0, 100),
      troops: st?.troops ?? 0,
      training: clamp(st?.training ?? 30, 0, 100),
      gold: st?.gold ?? 0,
      rice: st?.rice ?? 0,
      focus: 'balanced',
    }
  }
  for (const f of sc.factions) {
    s.factions[f.id] = { id: f.id, name: f.name, ruler: f.ruler, capital: f.capital, color: f.color, glyph: f.glyph, alive: true }
  }
  for (const r of sc.relations) s.relations[pk(r.a, r.b)] = clamp(r.value, 0, 100)
  for (const f of sc.friendships) s.friendships[pk(f.a, f.b)] = clamp(f.value, 0, 100)
  for (const r of sc.rivals) s.rivals.push(pk(r[0], r[1]))
  const starts = new Map(sc.officers.map((o) => [o.id, o]))
  for (const def of d.data.officers) {
    const st = starts.get(def.id)
    const o: OfficerState = {
      id: def.id,
      status: st ? 'active' : 'unborn',
      stats: { ...def.stats },
      xp: { war: 0, ldr: 0, int: 0, pol: 0, cha: 0 },
      faction: null,
      city: null,
      post: 'wanderer',
      loyalty: null,
      merit: 0,
      gold: 0,
      health: 100,
      days: 30,
      hidden: false,
      mission: null,
      spouse: null,
      oathGroup: null,
      deathYM: null,
      visitedThisMonth: [],
      proposedThisMonth: false,
      items: [],
    }
    if (st && s.cities[st.city]) {
      o.city = st.city
      o.merit = st.merit
      o.gold = st.gold
      if (st.hidden) {
        o.hidden = true
      } else if (st.faction && s.factions[st.faction]) {
        o.faction = st.faction
        o.post = st.post === 'wanderer' ? 'officer' : st.post
        o.loyalty = o.post === 'ruler' ? null : st.loyalty ?? 70
      }
    } else if (st) o.status = 'unborn'
    s.officers[def.id] = o
  }
  // rulers and prefects must be consistent with the faction table
  for (const fid of Object.keys(s.factions)) {
    const f = s.factions[fid]!
    const r = s.officers[f.ruler]
    if (r && r.status === 'active') { r.faction = fid; r.post = 'ruler'; r.loyalty = null }
  }
  for (const id of Object.keys(s.officers)) {
    const o = s.officers[id]!
    if (o.status === 'active' && o.post === 'prefect' && o.city && s.cities[o.city]!.faction === o.faction && !s.cities[o.city]!.prefect) s.cities[o.city]!.prefect = id
    else if (o.post === 'prefect') o.post = 'officer'
  }
  // oaths
  for (const grp of sc.oaths) {
    const members = grp.filter((id) => s.officers[id]?.status === 'active').slice(0, 4)
    if (members.length < 2) continue
    const gi = s.oaths.length
    s.oaths.push(members)
    for (const m of members) s.officers[m]!.oathGroup = gi
    for (let i = 0; i < members.length; i++) for (let j = i + 1; j < members.length; j++) {
      const k = pk(members[i]!, members[j]!)
      if ((s.friendships[k] ?? 20) < 80) s.friendships[k] = 80
    }
  }
  for (const [a, b] of d.spouseKin) {
    const x = s.officers[a]
    const y = s.officers[b]
    if (x && y && x.status === 'active' && y.status === 'active' && !x.spouse && !y.spouse) { x.spouse = b; y.spouse = a }
  }
  // the player's officer
  const c = makeCtx(d, s)
  let pid: string
  if (typeof opts.officer === 'string') {
    if (!s.officers[opts.officer] || s.officers[opts.officer]!.status !== 'active') throw new Error(`Officer ${opts.officer} is not in the world at the start`)
    pid = opts.officer
  } else pid = addCreatedOfficer(c, opts.officer)
  s.player = pid
  // death months (W-DEATH-1): ascending id, one draw each
  if (s.options.lifespans) {
    for (const id of sortedIds(s.officers)) {
      const o = s.officers[id]!
      if (o.status === 'dead') continue
      const def = d.officerDef.get(id)
      const month = 1 + Math.floor(nextFloat(s.rng) * 12)
      if (def) o.deathYM = def.died !== null ? { year: def.died, month } : { year: def.born + 75, month }
      else o.deathYM = { year: prof(c, id).born + 75, month }
    }
  }
  log(c, 'event', `${sc.name}: ${nameOf(c, pid)} begins.`, [pid])
  monthStart(c, true)
  return s
}

function addCreatedOfficer(c: Ctx, co: CreatedOfficer): string {
  const s = c.s
  let n = 1
  while (s.officers[`custom-${n}`]) n++
  const id = `custom-${n}`
  const st = { war: 0, ldr: 0, int: 0, pol: 0, cha: 0 }
  for (const k of STAT_KEYS) st[k] = clamp(Math.round(co.stats[k]), 20, 95)
  while (st.war + st.ldr + st.int + st.pol + st.cha > 320) {
    let big: (typeof STAT_KEYS)[number] = 'war'
    for (const k of STAT_KEYS) if (st[k] > st[big]) big = k
    st[big] -= 1
  }
  const city = s.cities[co.city] ? co.city : c.d.cityIds[0]!
  const apt = { spear: 'B', cavalry: 'B', archer: 'B' } as const
  const aptitude = { ...apt, [co.bestType]: 'A' } as Record<'spear' | 'cavalry' | 'archer', 'A' | 'B' | 'C'>
  const born = clamp(Math.round(co.born), 150, 174)
  const custom: NonNullable<OfficerState['custom']> = {
    name: (co.name || 'Wanderer').slice(0, 24),
    sex: co.sex,
    born,
    temperament: co.temperament,
    aptitude,
  }
  if (co.portrait) custom.portrait = co.portrait
  s.officers[id] = {
    id, custom, status: 'active', stats: st, xp: { war: 0, ldr: 0, int: 0, pol: 0, cha: 0 }, faction: null, city, post: 'wanderer', loyalty: null,
    merit: 0, gold: 300, health: 100, days: 30, hidden: false, mission: null, spouse: null, oathGroup: null, deathYM: null, visitedThisMonth: [],
    proposedThisMonth: false, items: [],
  }
  return id
}

// ---------- legal actions ----------
export function legalActions(d: DataIdx, state: WorldState): WorldAction[] {
  if (state.phase === 'ended') return []
  const c = makeCtx(d, state)
  const p = state.pending[0]
  if (p) return pendingAnswers(c, p)
  return playerActions(c, state.player)
}

function pendingAnswers(c: Ctx, p: Pending): WorldAction[] {
  switch (p.kind) {
    case 'letter': return [{ kind: 'ack', pending: p.id }]
    case 'eventChoice': return p.options.map((_, i) => ({ kind: 'choose' as const, pending: p.id, option: i }))
    case 'offer': return [{ kind: 'answerOffer', pending: p.id, accept: true }, { kind: 'answerOffer', pending: p.id, accept: false }]
    case 'captured': return p.canJoin ? [{ kind: 'answerCaptured', pending: p.id, join: true }, { kind: 'answerCaptured', pending: p.id, join: false }] : [{ kind: 'answerCaptured', pending: p.id, join: false }]
    case 'chooseDefenders': {
      const order = formDefence(c, p.city).filter((u) => !u.garrison && p.candidates.includes(u.id)).map((u) => u.id)
      const rest = p.candidates.filter((x) => !order.includes(x))
      return [{ kind: 'setDefenders', pending: p.id, officers: [...order, ...rest].slice(0, p.max) }]
    }
    case 'battle': return [{ kind: 'resolveBattle', pending: p.id, outcome: autoBattleOutcome(c.d, c.s, p.setup, seedRng(p.setup.seed)) }]
    case 'duel': return [{ kind: 'resolveDuel', pending: p.id, outcome: autoDuelOutcome(p.setup) }]
    case 'debate': return [{ kind: 'resolveDebate', pending: p.id, outcome: autoDebateOutcome(p.setup) }]
    case 'chooseSuccessor': return p.candidates.map((o) => ({ kind: 'chooseSuccessor' as const, pending: p.id, officer: o }))
  }
}

// ---------- step ----------
const rejectR = (code: RejectCode, message: string): StepResult => ({ ok: false, code, message })

export function step(d: DataIdx, state: WorldState, action: WorldAction): StepResult {
  try {
    return stepInner(d, state, action)
  } catch (e) {
    return rejectR('not-legal', `internal: ${e instanceof Error ? e.message : String(e)}`)
  }
}

const ANSWER_KINDS = new Set(['ack', 'choose', 'answerOffer', 'answerCaptured', 'setDefenders', 'resolveBattle', 'resolveDuel', 'resolveDebate', 'chooseSuccessor'])

function stepInner(d: DataIdx, state: WorldState, action: WorldAction): StepResult {
  if (state.phase === 'ended') return rejectR('ended', 'The game is over.')
  if (!action || typeof action !== 'object' || typeof (action as { kind?: unknown }).kind !== 'string') return rejectR('not-legal', 'Not an action.')
  const c = makeCtx(d, cloneState(state))
  const s = c.s
  const pending = s.pending[0]
  if (pending) {
    if (!ANSWER_KINDS.has(action.kind)) return rejectR('pending-first', 'Answer the pending decision first.')
    const err = answer(c, pending, action)
    if (err) return err
  } else {
    if (ANSWER_KINDS.has(action.kind)) return rejectR('not-legal', 'Nothing is pending.')
    if (s.phase !== 'player') {
      runPipeline(c)
    } else if (action.kind === 'endMonth') {
      startPipeline(c)
    } else {
      const f = checkAction(c, s.player, action)
      if (f) return rejectR(f.code, f.message)
      applyAction(c, s.player, action)
      normalize(c)
      checkEnd(c)
    }
  }
  if (s.cursor && !hasBlocking(c)) runPipeline(c)
  return { ok: true, state: s, events: c.out }
}

function answer(c: Ctx, p: Pending, a: WorldAction): StepResult | null {
  const s = c.s
  const bad = (m: string, code: RejectCode = 'not-legal'): StepResult => rejectR(code, m)
  switch (a.kind) {
    case 'ack':
      if (p.kind !== 'letter' || a.pending !== p.id) return bad('That is not the pending decision.', 'pending-first')
      s.pending.shift()
      return null
    case 'choose': {
      if (p.kind !== 'eventChoice' || a.pending !== p.id) return bad('That is not the pending decision.', 'pending-first')
      const e = answerEventChoice(c, a.pending, a.option)
      return e ? bad(e, 'bad-target') : null
    }
    case 'answerOffer': {
      if (p.kind !== 'offer' || a.pending !== p.id) return bad('That is not the pending decision.', 'pending-first')
      s.pending.shift()
      if (a.accept === true) acceptOffer(c, p)
      return null
    }
    case 'answerCaptured': {
      if (p.kind !== 'captured' || a.pending !== p.id) return bad('That is not the pending decision.', 'pending-first')
      const e = answerCaptured(c, a.pending, a.join === true)
      return e ? bad(e, 'bad-target') : null
    }
    case 'setDefenders': {
      if (p.kind !== 'chooseDefenders' || a.pending !== p.id) return bad('That is not the pending decision.', 'pending-first')
      const e = answerDefenders(c, a.pending, a.officers)
      return e ? bad(e, 'bad-target') : null
    }
    case 'resolveBattle': {
      if (p.kind !== 'battle' || a.pending !== p.id) return bad('That is not the pending decision.', 'pending-first')
      const e = answerBattle(c, a.pending, a.outcome as BattleOutcome)
      return e ? bad(e, 'bad-outcome') : null
    }
    case 'resolveDuel': {
      if (p.kind !== 'duel' || a.pending !== p.id) return bad('That is not the pending decision.', 'pending-first')
      const o = a.outcome as DuelOutcome
      const okWinner = o && (o.winner === 'a' || o.winner === 'b' || o.winner === null)
      if (!o || o.duelId !== p.setup.id || !okWinner || !Number.isInteger(o.rounds) || o.rounds < 0) return bad('The duel outcome does not match.', 'bad-outcome')
      s.pending.shift()
      finishDuel(c, p.setup.id, p.setup.a.id, p.setup.b.id, o.winner)
      return null
    }
    case 'resolveDebate': {
      if (p.kind !== 'debate' || a.pending !== p.id) return bad('That is not the pending decision.', 'pending-first')
      const o = a.outcome as DebateOutcome
      if (!o || o.debateId !== p.setup.id || (o.winner !== 'a' && o.winner !== 'b') || !Number.isInteger(o.rounds) || o.rounds < 0) return bad('The debate outcome does not match.', 'bad-outcome')
      s.pending.shift()
      finishDebate(c, p.setup.id, o.winner === 'a')
      return null
    }
    case 'chooseSuccessor': {
      if (p.kind !== 'chooseSuccessor' || a.pending !== p.id) return bad('That is not the pending decision.', 'pending-first')
      if (!p.candidates.includes(a.officer)) return bad('That officer cannot be chosen.', 'bad-target')
      s.pending.shift()
      s.player = a.officer
      log(c, 'event', `${nameOf(c, a.officer)} carries the name forward.`, [a.officer])
      return null
    }
    default:
      return bad('That is not the pending decision.', 'pending-first')
  }
}

function acceptOffer(c: Ctx, p: Extract<Pending, { kind: 'offer' }>): void {
  const pl = O(c, c.s.player)
  const from = c.s.officers[p.from]
  if (!from || from.status === 'dead') return
  switch (p.offer) {
    case 'recruit':
      if (from.faction && c.s.factions[from.faction]?.alive && pl.post === 'wanderer' && pl.status === 'active') {
        joinFaction(c, pl.id, from.faction, 60 + Math.floor(friendship(c, pl.id, from.id) / 4))
        log(c, 'join', `${nameOf(c, pl.id)} joined ${factionName(c, from.faction)}.`, [pl.id, from.id], pl.city ?? undefined)
      }
      break
    case 'oath': doOath(c, [pl.id, from.id]); break
    case 'marry': if (!pl.spouse && !from.spouse) doMarry(c, pl.id, from.id); break
    case 'mission':
      if (p.mission && !pl.mission && pl.status === 'active') {
        pl.mission = p.mission
        log(c, 'mission', `${nameOf(c, from.id)} gave ${nameOf(c, pl.id)} a mission.`, [from.id, pl.id], pl.city ?? undefined)
      }
      break
  }
}

function finishDuel(c: Ctx, id: string, a: string, b: string, w: 'a' | 'b' | null): void {
  const parts = id.split('|')
  if (parts[0] === 'ev') { finishEventContest(c, id, w === 'a'); return }
  if (parts[0] === 'ch') applyDuelResult(c, a, b, w === null ? null : w === 'a' ? a : b)
}

function finishDebate(c: Ctx, id: string, aWon: boolean): void {
  const parts = id.split('|')
  if (parts[0] === 'ev') { finishEventContest(c, id, aWon); return }
  if (parts[0] === 'rc') {
    const [, actor, target] = parts
    if (actor && target && c.s.officers[actor] && c.s.officers[target]) {
      if (aWon) recruitSuccess(c, actor, target)
      else { addFriendship(c, actor, target, -5); log(c, 'recruit', `${nameOf(c, target)} won the argument against ${nameOf(c, actor)}.`, [actor, target]) }
    }
    return
  }
  if (parts[0] === 'dp') {
    const [, actor, envoy, target, proposal] = parts
    const ao = actor ? c.s.officers[actor] : undefined
    if (ao?.faction && target && c.s.factions[target]?.alive && envoy) applyDiploResult(c, ao.faction, target, proposal as 'alliance' | 'truce' | 'surrender', aWon, envoy)
  }
}

// ---------- replay ----------
export function replay(d: DataIdx, opts: NewGameOptions, actions: WorldAction[]): WorldState {
  let s = newGame(d, opts)
  for (const a of actions) {
    const r = step(d, s, a)
    if (r.ok) s = r.state
  }
  return s
}

export { setFriendship, bestType, C, F, indexData }
export type { GameData }
