// Battle step function (20-battle.md). Pure: returns a new state, never mutates its input, never throws.
//
// RNG DRAW ORDER (state.rng, sfc32 seeded from setup.seed; the field uses a separate stream, see field.ts):
//   createBattle:  day-1 initiative shuffle (Fisher-Yates over alive units in setup order, i = n-1 .. 1).
//   attack:        attack roll (1 draw) -> [if the target is routed by this hit: capture d100 when an enemy is
//                  adjacent] -> else counter roll (1 draw, range 1 only) -> [attacker routed by the counter: capture d100].
//   attackGate:    no draws.
//   tactic fire/confuse/taunt: 1 d100 for the chance. rally: none. volley: 1 roll per victim in unit order
//                  (each victim routed draws its capture d100 right after its roll).
//   challenge:     childSeed (1 draw) for the duel; then, for an auto-resolved or answered duel: on a knockout one d100
//                  (15% slain); a duel-loser routed by morale draws its capture d100. A refusal draws nothing.
//   start of a unit's turn: a burn rout draws a capture d100.
//   end of day:    for each burning hex in index order, for each of its 6 neighbours in DIRS order that burns and is not
//                  alight: one d100 (25%); then the next day's initiative shuffle.
// Events are returned for the presentation; the state alone is authoritative.
import type { BattleOutcome, BattleSide, DuelRecord } from '../contracts/battle'
import type { Contestant, DuelOutcome, DuelSetup } from '../contracts/contest'
import { chance, childSeed, clamp, nextFloat, type RngState } from '../shared/rng'
import { autoDuel } from '../duel'
import {
  alive, calcDamage, cellAt, dmgAt, enemiesOf, other, pathTo, reach, rollOf, tacticChance, unitById, unitAt,
} from './core'
import { hexDistance, hexIndex, neighbors } from './hex'
import { legalOfKind, gateTargets, canonicalDuelResult } from './legal'
import { initiativeOf, volleyVictims } from './query'
import { buildOutcome } from './outcome'
import { TERRAIN } from './terrain'
import type { BUnit, BattleAction, BattleEvent, BattleState, HexCell, RejectCode, StepResult } from './types'

type Ev = BattleEvent[]

function cloneState(s: BattleState): BattleState {
  return {
    ...s,
    rng: [...s.rng] as RngState,
    hexes: s.hexes.slice(),
    units: s.units.map((u) => ({ ...u })),
    order: s.order.slice(),
    duels: s.duels.slice(),
  }
}

const u2 = (w: BattleState, id: string): BUnit => unitById(w, id)!

function setCell(w: BattleState, i: number, patch: Partial<HexCell>): void {
  w.hexes[i] = { ...w.hexes[i]!, ...patch }
}

/** B-TURN-1: one seeded shuffle, then a stable sort by LDR (+20 cavalry), highest first. */
export function rollOrder(w: BattleState): string[] {
  const ids = w.units.filter(alive).map((u) => u.id)
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(nextFloat(w.rng) * (i + 1))
    const t = ids[i]!
    ids[i] = ids[j]!
    ids[j] = t
  }
  return ids
    .map((id, k) => ({ id, k, v: initiativeOf(u2(w, id)) }))
    .sort((a, b) => b.v - a.v || a.k - b.k)
    .map((x) => x.id)
}

// ---- ending -----------------------------------------------------------------------------------

export function endBattle(w: BattleState, ev: Ev, winner: BattleSide, reason: BattleOutcome['reason']): void {
  w.outcome = buildOutcome(w, winner, reason)
  w.active = null
  w.pendingDuel = null
  ev.push({ kind: 'end', winner, reason })
}

/** B-WIN-1. Returns true when the battle ended. */
export function checkEnd(w: BattleState, ev: Ev, acting: BattleSide): boolean {
  if (w.outcome) return true
  const lost = (side: BattleSide): 'commander-routed' | 'all-routed' | null => {
    const mine = w.units.filter((u) => u.side === side)
    const cmd = mine.find((u) => u.commander)
    if (cmd && cmd.routed) return 'commander-routed'
    if (mine.every((u) => u.routed)) return 'all-routed'
    return null
  }
  const la = lost('attacker')
  const ld = lost('defender')
  if (!la && !ld) return false
  if (la && ld) {
    endBattle(w, ev, acting, (acting === 'attacker' ? ld : la)!)
  } else if (la) endBattle(w, ev, 'defender', la)
  else endBattle(w, ev, 'attacker', ld!)
  return true
}

// ---- routs, damage ----------------------------------------------------------------------------

function rout(w: BattleState, ev: Ev, u: BUnit, reason: 'troops' | 'morale' | 'slain', credit: BUnit | null): void {
  if (u.routed) return
  u.routed = true
  if (reason === 'slain') u.slain = true
  else {
    // B-ROUT-1: capture chance from the best WAR among adjacent enemies.
    let best = -1
    for (const e of w.units) {
      if (e.routed || e.side === u.side) continue
      if (hexDistance(u.q, u.r, e.q, e.r) === 1) best = Math.max(best, e.officer.stats.war)
    }
    if (best >= 0) {
      const p = clamp(40 + 0.3 * (best - u.officer.stats.war), 10, 80)
      u.captured = chance(w.rng, p)
    }
  }
  if (credit && credit.side !== u.side && reason !== 'slain') credit.kills++
  ev.push({ kind: 'rout', unit: u.id, reason, captured: u.captured })
}

function checkRout(w: BattleState, ev: Ev, u: BUnit, credit: BUnit | null): boolean {
  if (u.routed) return true
  if (u.troops <= 0) { rout(w, ev, u, 'troops', credit); return true }
  if (u.morale <= 0) { rout(w, ev, u, 'morale', credit); return true }
  return false
}

/** Apply troop damage and the B-DMG-3 morale loss. Does not check the rout. */
function hurt(u: BUnit, dmg: number): void {
  const before = u.troops
  const d = Math.min(dmg, before)
  u.troops = before - d
  if (before > 0) u.morale = clamp(u.morale - Math.ceil((25 * d) / before), 0, 100)
}

const gainMorale = (u: BUnit, n: number): void => { u.morale = clamp(u.morale + n, 0, 100) }

// ---- turn flow --------------------------------------------------------------------------------

function endTurn(w: BattleState, ev: Ev, u: BUnit | undefined): void {
  if (u) {
    u.acted = true
    u.taunted = null
  }
  w.cursor++
  w.active = null
  advance(w, ev)
}

/** Move the cursor to the next unit that can act, running day ends and start-of-turn effects. */
export function advance(w: BattleState, ev: Ev): void {
  for (let guard = 0; guard < 10000 && !w.outcome; guard++) {
    if (w.cursor >= w.order.length) {
      endDay(w, ev)
      continue
    }
    const u = unitById(w, w.order[w.cursor]!)
    if (!u || u.routed) { w.cursor++; continue }
    // start of turn
    u.moved = false
    u.movedDist = 0
    u.fromQ = u.q
    u.fromR = u.r
    u.acted = false
    const i = hexIndex(u.q, u.r)
    const c = w.hexes[i]
    if (c && c.burn > 0) {
      const loss = Math.max(1, Math.floor(u.troops * 0.1))
      const credit = c.burnBy ? (unitById(w, c.burnBy) ?? null) : null
      const t0 = u.troops
      u.troops = Math.max(0, u.troops - loss)
      u.morale = clamp(u.morale - 10, 0, 100)
      ev.push({ kind: 'burn', unit: u.id, troops: t0 - u.troops, morale: 10 })
      if (checkRout(w, ev, u, credit)) {
        if (checkEnd(w, ev, u.side)) return
        w.cursor++
        continue
      }
    }
    if (u.confused) {
      u.confused = false
      ev.push({ kind: 'confusedSkip', unit: u.id })
      w.cursor++
      continue
    }
    w.active = u.id
    ev.push({ kind: 'turnStart', unit: u.id })
    return
  }
}

function endDay(w: BattleState, ev: Ev): void {
  // B-TAC-FIRE: spread, then burn down.
  const burning: number[] = []
  w.hexes.forEach((c, i) => { if (c.burn > 0) burning.push(i) })
  const lit = new Set<number>()
  for (const i of burning) {
    const c = w.hexes[i]!
    const col = i % 15
    const row = Math.floor(i / 15)
    const ax = { q: col - (row - (row & 1)) / 2, r: row }
    for (const n of neighbors(ax.q, ax.r)) {
      const j = hexIndex(n.q, n.r)
      if (j < 0) continue
      const nc = w.hexes[j]!
      if (!TERRAIN[nc.terrain].burns || nc.burn > 0 || lit.has(j)) continue
      if (chance(w.rng, 25)) {
        lit.add(j)
        setCell(w, j, { burn: 2, burnBy: c.burnBy })
        ev.push({ kind: 'ignite', q: n.q, r: n.r })
      }
    }
  }
  for (const i of burning) {
    const c = w.hexes[i]!
    const left = c.burn - 1
    if (left <= 0) {
      setCell(w, i, { terrain: 'ash', burn: 0, burnBy: null })
      const col = i % 15
      const row = Math.floor(i / 15)
      ev.push({ kind: 'ash', q: col - (row - (row & 1)) / 2, r: row })
    } else setCell(w, i, { burn: left })
  }
  for (const u of w.units) {
    u.moved = false
    u.acted = false
  }
  w.day++
  if (w.day > w.setup.maxDays) {
    w.day = w.setup.maxDays
    endBattle(w, ev, 'defender', 'time')
    return
  }
  w.order = rollOrder(w)
  w.cursor = 0
  ev.push({ kind: 'dayStart', day: w.day, order: w.order.slice() })
}

// ---- duels ------------------------------------------------------------------------------------

function contestant(w: BattleState, u: BUnit): Contestant {
  return {
    id: u.officer.id, name: u.officer.name, stats: u.officer.stats, temperament: u.officer.temperament,
    health: u.health, portrait: u.officer.portrait, player: w.setup.playerControls.includes(u.officer.id),
  }
}

function applyDuel(w: BattleState, ev: Ev, ch: BUnit, tg: BUnit, res: DuelOutcome): void {
  const winner = res.winner === 'a' ? ch : res.winner === 'b' ? tg : null
  const loser = winner === ch ? tg : winner === tg ? ch : null
  let slain: string | null = null
  if (winner && loser) {
    winner.duelWins++
    loser.morale = clamp(loser.morale - 40, 0, 100)
    if (res.how === 'knockout') {
      const lost = Math.min(30, loser.health)
      loser.health -= lost
      loser.wounded += lost
      if (chance(w.rng, 15)) {
        slain = loser.officer.id
        rout(w, ev, loser, 'slain', null)
      }
    }
    if (!loser.routed) checkRout(w, ev, loser, null)
  }
  const rec: DuelRecord = { a: ch.officer.id, b: tg.officer.id, winner: winner ? winner.officer.id : null, slain }
  w.duels.push(rec)
  ev.push({ kind: 'duel', a: ch.officer.id, b: tg.officer.id, winner: rec.winner, how: res.how, slain })
}

// ---- the step ---------------------------------------------------------------------------------

const rej = (code: RejectCode, message: string): StepResult => ({ ok: false, code, message })

export function step(state: BattleState, action: BattleAction): StepResult {
  try {
    return stepInner(state, action)
  } catch (e) {
    return rej('internal', `Internal error: ${e instanceof Error ? e.message : String(e)}`)
  }
}

const isStr = (x: unknown): x is string => typeof x === 'string'
const isInt = (x: unknown): x is number => typeof x === 'number' && Number.isInteger(x)

function stepInner(state: BattleState, action: BattleAction): StepResult {
  if (!action || typeof action !== 'object' || !isStr((action as { kind?: unknown }).kind)) return rej('bad-action', 'Not an action.')
  if (state.outcome) return rej('ended', 'The battle is over.')
  const a = action as BattleAction
  const w = cloneState(state)
  const ev: Ev = []

  if (a.kind === 'retreat') {
    if (!state.playerSide || a.side !== state.playerSide) return rej('cannot', 'Only the player\'s side can retreat.')
    endBattle(w, ev, other(a.side), 'retreat')
    w.actionCount++
    return { ok: true, state: w, events: ev }
  }

  if (state.pendingDuel) {
    if (a.kind !== 'duelResolved') return rej('pending-duel', 'A duel is waiting for its result.')
    const p = state.pendingDuel
    const r = a.result
    const ok = r && typeof r === 'object' && r.duelId === p.id && (r.winner === 'a' || r.winner === 'b' || r.winner === null) &&
      (r.winner === null ? r.how === 'draw' : r.how === 'knockout' || r.how === 'yield')
    if (!ok) return rej('bad-result', 'That result does not belong to the pending duel.')
    const ch = unitById(w, p.challenger)
    const tg = unitById(w, p.target)
    if (!ch || !tg) return rej('internal', 'Duel units missing.')
    w.pendingDuel = null
    applyDuel(w, ev, ch, tg, r)
    if (!checkEnd(w, ev, ch.side)) endTurn(w, ev, ch)
    w.actionCount++
    return { ok: true, state: w, events: ev }
  }
  if (a.kind === 'duelResolved') return rej('no-duel', 'No duel is pending.')

  const unitId = (a as { unit?: unknown }).unit
  if (!isStr(unitId)) return rej('bad-action', 'Missing unit.')
  const u = unitById(w, unitId)
  if (!u) return rej('bad-target', 'No such unit.')
  if (w.active !== u.id) return rej('not-active', 'It is not that unit\'s turn.')

  const legal = (k: BattleAction['kind']): BattleAction[] => legalOfKind(w, u, k)

  switch (a.kind) {
    case 'wait': {
      if (!legal('wait').length) return rej('cannot', 'A taunted unit that can attack must do so.')
      ev.push({ kind: 'wait', unit: u.id })
      endTurn(w, ev, u)
      break
    }
    case 'move': {
      if (!isInt(a.q) || !isInt(a.r)) return rej('bad-target', 'Bad hex.')
      if (u.moved) return rej('already-moved', 'This unit has already moved.')
      if (!legal('move').some((x) => x.kind === 'move' && x.q === a.q && x.r === a.r)) {
        const nodes = reach(w, u)
        return rej(nodes.has(hexIndex(a.q, a.r)) ? 'cannot' : 'blocked', 'It cannot move there.')
      }
      const nodes = reach(w, u)
      const path = pathTo(nodes, a.q, a.r)
      u.fromQ = u.q
      u.fromR = u.r
      u.movedDist = hexDistance(u.q, u.r, a.q, a.r)
      u.q = a.q
      u.r = a.r
      u.moved = true
      ev.push({ kind: 'move', unit: u.id, path })
      // B-WIN-2
      if (u.side === 'attacker' && cellAt(w, u.q, u.r)?.terrain === 'keep') endBattle(w, ev, 'attacker', 'keep-taken')
      break
    }
    case 'undoMove': {
      if (!u.moved || u.acted) return rej('not-moved', 'Nothing to undo.')
      u.q = u.fromQ
      u.r = u.fromR
      u.moved = false
      u.movedDist = 0
      ev.push({ kind: 'undoMove', unit: u.id })
      break
    }
    case 'attack': {
      if (!isStr(a.target)) return rej('bad-target', 'Bad target.')
      const t = unitById(w, a.target)
      if (!t || t.routed || t.side === u.side) return rej('bad-target', 'Not an enemy on the field.')
      if (!legal('attack').some((x) => x.kind === 'attack' && x.target === a.target)) return rej('out-of-range', 'Out of range, or a taunt forbids it.')
      doAttack(w, ev, u, t)
      if (!checkEnd(w, ev, u.side)) endTurn(w, ev, u)
      break
    }
    case 'attackGate': {
      if (!isInt(a.q) || !isInt(a.r)) return rej('bad-target', 'Bad hex.')
      if (!legal('attackGate').some((x) => x.kind === 'attackGate' && x.q === a.q && x.r === a.r)) return rej('bad-target', 'No standing gate there to hit.')
      const i = hexIndex(a.q, a.r)
      const c = w.hexes[i]!
      let dmg = Math.floor(u.troops * 0.05 * (0.5 + u.officer.stats.ldr / 100) * (u.type === 'spear' ? 1.5 : 1))
      dmg = Math.max(1, dmg)
      const hp = Math.max(0, c.gateHp - dmg)
      setCell(w, i, { gateHp: hp })
      ev.push({ kind: 'gate', unit: u.id, q: a.q, r: a.r, damage: dmg, hp, broken: hp <= 0 })
      endTurn(w, ev, u)
      break
    }
    case 'tactic': {
      if (!isStr(a.tactic) || !isInt(a.q) || !isInt(a.r)) return rej('bad-target', 'Bad tactic.')
      if (!(['fire', 'confuse', 'taunt', 'rally', 'volley'] as string[]).includes(a.tactic)) return rej('unknown-tactic', 'Unknown tactic.')
      if (!legal('tactic').some((x) => x.kind === 'tactic' && x.tactic === a.tactic && x.q === a.q && x.r === a.r)) return rej('cannot', 'That tactic cannot be used there.')
      doTactic(w, ev, u, a.tactic, a.q, a.r)
      if (!checkEnd(w, ev, u.side)) endTurn(w, ev, u)
      break
    }
    case 'challenge': {
      if (!isStr(a.target)) return rej('bad-target', 'Bad target.')
      if (!legal('challenge').some((x) => x.kind === 'challenge' && x.target === a.target)) return rej('cannot', 'It cannot challenge that unit.')
      const t = u2(w, a.target)
      const targetIsPlayer = w.setup.playerControls.includes(t.officer.id)
      const accepts = targetIsPlayer || t.officer.temperament === 'reckless' || t.officer.stats.war >= u.officer.stats.war - 10
      ev.push({ kind: 'challenge', unit: u.id, target: t.id, accepted: accepts })
      if (!accepts) {
        // B-DUEL-1
        t.morale = clamp(t.morale - 15, 0, 100)
        ev.push({ kind: 'morale', unit: t.id, delta: -15 })
        checkRout(w, ev, t, u)
        if (!checkEnd(w, ev, u.side)) endTurn(w, ev, u)
        break
      }
      const setup: DuelSetup = {
        id: `${w.setup.id}-d${w.duels.length + 1}`, seed: childSeed(w.rng),
        a: contestant(w, u), b: contestant(w, t), inBattle: true,
      }
      if (setup.a.player || setup.b.player) {
        w.pendingDuel = { ...setup, challenger: u.id, target: t.id }
        break
      }
      applyDuel(w, ev, u, t, autoDuel(setup))
      if (!checkEnd(w, ev, u.side)) endTurn(w, ev, u)
      break
    }
    default:
      return rej('bad-action', 'Unknown action.')
  }
  if (w.active === u.id && !w.outcome && w.pendingDuel === null && u.routed) endTurn(w, ev, u)
  w.actionCount++
  return { ok: true, state: w, events: ev }
}

// ---- attack, tactic ---------------------------------------------------------------------------

function doAttack(w: BattleState, ev: Ev, u: BUnit, t: BUnit): void {
  const range = hexDistance(u.q, u.r, t.q, t.r)
  const calc = calcDamage(w, u, t, { range, movedDist: u.movedDist })
  const dmg = dmgAt(calc, rollOf(nextFloat(w.rng)))
  const before = t.troops
  hurt(t, Math.min(dmg, before))
  gainMorale(u, 3)
  let counterDmg = 0
  let killed = false
  if (t.troops <= 0 || t.morale <= 0) {
    killed = true
    checkRout(w, ev, t, u)
  } else if (range === 1) {
    // B-DMG-2
    const cc = calcDamage(w, t, u, { range: 1, movedDist: 0 })
    counterDmg = Math.min(Math.max(1, Math.floor(cc.mid * 0.5 * rollOf(nextFloat(w.rng)))), u.troops)
    hurt(u, counterDmg)
    checkRout(w, ev, u, null)
  }
  ev.push({ kind: 'attack', unit: u.id, target: t.id, range, damage: Math.min(dmg, before), counter: counterDmg, killed })
}

function doTactic(w: BattleState, ev: Ev, u: BUnit, tactic: string, q: number, r: number): void {
  const occ = unitAt(w, q, r)
  if (tactic === 'rally') {
    gainMorale(u, 5)
    gainMorale(u, 15)
    for (const o of w.units) {
      if (o.routed || o.side !== u.side || o.id === u.id) continue
      if (hexDistance(u.q, u.r, o.q, o.r) === 1) gainMorale(o, 15)
    }
    ev.push({ kind: 'tactic', unit: u.id, tactic: 'rally', q, r, success: true, chance: 100 })
    return
  }
  if (tactic === 'volley') {
    ev.push({ kind: 'tactic', unit: u.id, tactic: 'volley', q, r, success: true, chance: 100 })
    let any = false
    for (const vId of volleyVictims(w, u, q, r).map((x) => x.id)) {
      const v = u2(w, vId)
      if (v.routed) continue
      const calc = calcDamage(w, u, v, { range: 2, extra: 0.6 })
      const dmg = Math.min(dmgAt(calc, rollOf(nextFloat(w.rng))), v.troops)
      hurt(v, dmg)
      any = true
      ev.push({ kind: 'volley', unit: u.id, target: v.id, damage: dmg })
      checkRout(w, ev, v, u)
    }
    if (any) gainMorale(u, 3)
    gainMorale(u, 5)
    return
  }
  const pct = tacticChance(u, occ ?? null)
  const ok = chance(w.rng, pct)
  ev.push({ kind: 'tactic', unit: u.id, tactic: tactic as 'fire', q, r, success: ok, chance: pct })
  if (!ok) return
  gainMorale(u, 5)
  if (tactic === 'fire') setCell(w, hexIndex(q, r), { burn: 2, burnBy: u.id })
  else if (tactic === 'confuse' && occ) occ.confused = true
  else if (tactic === 'taunt' && occ) occ.taunted = u.id
}

export { canonicalDuelResult, enemiesOf, gateTargets }
