// Debate engine (30-duel-debate.md §2). Pure and deterministic.
//
// RNG DRAW ORDER (state.rng, seeded from setup.seed):
//   1. createDebate: Fisher-Yates shuffle of the 24-tablet deck (23 draws, i = 23 down to 1).
//   2. each round opens: one draw for each AI side, a then b (the committed tablet, D-DEB-8).
//   Resolution draws nothing. Refills are deterministic (top of the deck, a first).
import type { Contestant, DebateOutcome, DebateSetup } from '../contracts/contest'
import { nextFloat, seedRng, type RngState } from '../shared/rng'

export type ArgKind = 'reason' | 'precedent' | 'appeal' | 'scorn'
export type Side = 'a' | 'b'
export const KINDS: readonly ArgKind[] = ['reason', 'precedent', 'appeal', 'scorn']
export const KIND_NAME: Record<ArgKind, string> = { reason: 'Reason', precedent: 'Precedent', appeal: 'Appeal', scorn: 'Scorn' }
export const MAX_ROUNDS = 6
export const HAND = 4

/** A tablet id is "<kind>-<power>", e.g. "scorn-4". */
export type TabletId = string

export interface Tablet {
  id: TabletId
  kind: ArgKind
  power: number
}

export interface DebateRound {
  round: number
  a: TabletId | null
  b: TabletId | null
  damageToA: number
  damageToB: number
}

export interface DebateState {
  setup: DebateSetup
  rng: RngState
  deck: TabletId[]
  hands: { a: TabletId[]; b: TabletId[] } // face up
  composure: { a: number; b: number }
  start: { a: number; b: number }
  round: number
  committed: { a: TabletId | null; b: TabletId | null }
  log: DebateRound[]
  outcome: DebateOutcome | null
}

export type DebateAction = { tablet?: TabletId }
export type DebateEvent = { kind: 'round'; record: DebateRound } | { kind: 'end'; outcome: DebateOutcome }
export type DebateResult =
  | { ok: true; state: DebateState; events: DebateEvent[] }
  | { ok: false; code: 'ended' | 'bad-tablet' | 'cannot'; message: string }

export function parseTablet(id: TabletId): Tablet | null {
  const m = /^(reason|precedent|appeal|scorn)-([1-6])$/.exec(id)
  return m ? { id, kind: m[1] as ArgKind, power: Number(m[2]) } : null
}

const opp = (s: Side): Side => (s === 'a' ? 'b' : 'a')

export function startComposure(c: Contestant, bonus: number): number {
  return Math.floor((40 + c.stats.int / 2 + c.stats.cha / 4) * (1 + bonus))
}

/** D-DEB-4. The stat bonus is floored so force and damage stay whole numbers. */
export function force(t: Tablet, c: Contestant): number {
  const stat = t.kind === 'reason' || t.kind === 'precedent' ? c.stats.int : c.stats.cha
  return t.power + Math.floor(stat / 20)
}

const BEATS: Record<ArgKind, ArgKind | null> = { reason: 'appeal', appeal: 'scorn', scorn: 'reason', precedent: null }

/** D-DEB-3/5: damage the first tablet's owner deals / takes. */
export function clash(mine: Tablet, theirs: Tablet, myC: Contestant, theirC: Contestant): { deal: number; take: number } {
  const fm = force(mine, myC)
  const ft = force(theirs, theirC)
  if (BEATS[mine.kind] === theirs.kind) return { deal: 5 * fm, take: 0 }
  if (BEATS[theirs.kind] === mine.kind) return { deal: 0, take: 5 * ft }
  if (fm > ft) return { deal: 5 * (fm - ft), take: 0 }
  if (ft > fm) return { deal: 0, take: 5 * (ft - fm) }
  return { deal: 0, take: 0 }
}

export interface DebateTell {
  tablet: TabletId
  weight: number
  pct: number
  expectedDealt: number
  expectedTaken: number
}

/** D-DEB-8: the distribution the AI of `side` draws its tablet from. */
export function debateTells(st: DebateState, side: Side): DebateTell[] {
  const mine = st.hands[side]
  const theirs = st.hands[opp(side)]
  const me = st.setup[side]
  const them = st.setup[opp(side)]
  if (mine.length === 0) return []
  const raw = mine.map((id) => {
    const t = parseTablet(id)!
    let dealt = 0
    let taken = 0
    for (const oid of theirs) {
      const c = clash(t, parseTablet(oid)!, me, them)
      dealt += c.deal
      taken += c.take
    }
    const n = Math.max(1, theirs.length)
    return { id, dealt: dealt / n, taken: taken / n, e: (dealt - taken) / n }
  })
  const min = Math.min(...raw.map((r) => r.e))
  const weights = raw.map((r) => r.e - min + 1)
  const total = weights.reduce((a, b) => a + b, 0)
  return raw.map((r, i) => ({
    tablet: r.id, weight: weights[i]!, pct: Math.round((1000 * weights[i]!) / total) / 10,
    expectedDealt: r.dealt, expectedTaken: r.taken,
  }))
}

function drawTablet(rng: RngState, tells: DebateTell[]): TabletId | null {
  if (tells.length === 0) return null
  const total = tells.reduce((a, t) => a + t.weight, 0)
  const x = nextFloat(rng) * total
  let acc = 0
  for (const t of tells) {
    acc += t.weight
    if (x < acc) return t.tablet
  }
  return tells[tells.length - 1]!.tablet
}

function openRound(st: DebateState): void {
  st.committed = { a: null, b: null }
  for (const s of ['a', 'b'] as const) {
    if (!st.setup[s].player) st.committed[s] = drawTablet(st.rng, debateTells(st, s))
  }
}

export function createDebate(setup: DebateSetup): DebateState {
  const rng = seedRng(setup.seed)
  const deck: TabletId[] = []
  for (const k of KINDS) for (let p = 1; p <= 6; p++) deck.push(`${k}-${p}`)
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(nextFloat(rng) * (i + 1))
    const t = deck[i]!
    deck[i] = deck[j]!
    deck[j] = t
  }
  const hands = { a: [] as TabletId[], b: [] as TabletId[] }
  for (let i = 0; i < HAND; i++) {
    hands.a.push(deck.pop()!)
    hands.b.push(deck.pop()!)
  }
  const ca = startComposure(setup.a, setup.composureBonus.a)
  const cb = startComposure(setup.b, setup.composureBonus.b)
  const st: DebateState = {
    setup, rng, deck, hands, composure: { a: ca, b: cb }, start: { a: ca, b: cb }, round: 1,
    committed: { a: null, b: null }, log: [], outcome: null,
  }
  openRound(st)
  return st
}

function copy(st: DebateState): DebateState {
  return {
    ...st, rng: [...st.rng] as RngState, deck: st.deck.slice(), hands: { a: st.hands.a.slice(), b: st.hands.b.slice() },
    composure: { ...st.composure }, start: { ...st.start }, committed: { ...st.committed }, log: st.log.slice(),
  }
}

function finish(st: DebateState, winner: Side, events: DebateEvent[]): void {
  st.outcome = {
    debateId: st.setup.id, winner, rounds: st.log.length,
    composureLeft: { a: Math.max(0, st.composure.a), b: Math.max(0, st.composure.b) },
  }
  events.push({ kind: 'end', outcome: st.outcome })
}

/** Tablets a side may play now. */
export function legalTablets(st: DebateState, side: Side): TabletId[] {
  return st.outcome ? [] : st.hands[side].slice()
}

/** Play one round. The player's side supplies `action.tablet`; AI sides use their committed tablet. Never throws. */
export function stepDebate(state: DebateState, action: DebateAction): DebateResult {
  try {
    if (state.outcome) return { ok: false, code: 'ended', message: 'The debate is over.' }
    const st = copy(state)
    const pick: Record<Side, TabletId | null> = { a: null, b: null }
    for (const s of ['a', 'b'] as const) {
      if (st.setup[s].player) {
        const t = action?.tablet
        if (typeof t !== 'string' || !st.hands[s].includes(t)) {
          return { ok: false, code: 'bad-tablet', message: 'Play one of the tablets in your hand.' }
        }
        pick[s] = t
      } else pick[s] = st.committed[s]
    }
    const events: DebateEvent[] = []
    let toA = 0
    let toB = 0
    const ta = pick.a ? parseTablet(pick.a) : null
    const tb = pick.b ? parseTablet(pick.b) : null
    if (ta && tb) {
      const c = clash(ta, tb, st.setup.a, st.setup.b)
      toB = c.deal
      toA = c.take
    }
    st.composure.a -= toA
    st.composure.b -= toB
    for (const s of ['a', 'b'] as const) {
      const p = pick[s]
      if (p) st.hands[s].splice(st.hands[s].indexOf(p), 1)
    }
    const rec: DebateRound = { round: st.round, a: pick.a, b: pick.b, damageToA: toA, damageToB: toB }
    st.log.push(rec)
    events.push({ kind: 'round', record: rec })
    // refill, a first
    for (const s of ['a', 'b'] as const) while (st.hands[s].length < HAND && st.deck.length) st.hands[s].push(st.deck.pop()!)
    const aOut = st.composure.a <= 0
    const bOut = st.composure.b <= 0
    if (aOut || bOut) {
      // both at zero: the defender (b) wins the tie (D-DEB-6)
      finish(st, aOut && !bOut ? 'b' : bOut && !aOut ? 'a' : 'b', events)
    } else if (st.round >= MAX_ROUNDS) {
      const sa = st.composure.a / st.start.a
      const sb = st.composure.b / st.start.b
      finish(st, sa > sb ? 'a' : 'b', events)
    } else {
      st.round += 1
      openRound(st)
    }
    return { ok: true, state: st, events }
  } catch (e) {
    return { ok: false, code: 'cannot', message: String(e) }
  }
}

/** Both sides AI (any `player` flags are ignored). */
export function autoDebate(setup: DebateSetup): DebateOutcome {
  const s2: DebateSetup = { ...setup, a: { ...setup.a, player: false }, b: { ...setup.b, player: false } }
  let st = createDebate(s2)
  for (let i = 0; i < 20 && !st.outcome; i++) {
    const r = stepDebate(st, {})
    if (!r.ok) break
    st = r.state
  }
  return st.outcome ?? { debateId: setup.id, winner: 'b', rounds: st.log.length, composureLeft: { ...st.composure } }
}

export const query = { debateTells, legalTablets }
