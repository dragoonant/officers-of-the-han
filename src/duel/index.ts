// Duel engine (30-duel-debate.md §1). Pure and deterministic.
//
// RNG DRAW ORDER (state.rng, seeded from setup.seed), per round:
//   1. when the round opens: one draw for each AI side, a then b (the AI's committed stance, D-DUEL-6); a side
//      whose pick is forced (Mighty Blow, yield) still consumes its draw so the stream does not depend on it.
//   2. when the round resolves: one draw for side a's hit roll, then one for side b's (always both).
import type { Contestant, DuelOutcome, DuelSetup } from '../contracts/contest'
import { nextFloat, seedRng, type RngState } from '../shared/rng'

export type Stance = 'strike' | 'guard' | 'feint' | 'mighty' | 'yield'
export type Side = 'a' | 'b'
export const MAX_ROUNDS = 10

export interface DuelRound {
  round: number
  a: Stance
  b: Stance
  dealtByA: number
  dealtByB: number
  vigor: { a: number; b: number }
  spirit: { a: number; b: number }
}

export interface DuelState {
  setup: DuelSetup
  rng: RngState
  round: number // the round now open (1-based)
  vigor: { a: number; b: number }
  vigorMax: { a: number; b: number }
  spirit: { a: number; b: number }
  /** AI sides' committed stance for the open round (null for the player's side). */
  committed: { a: Stance | null; b: Stance | null }
  log: DuelRound[]
  outcome: DuelOutcome | null
}

export type DuelAction = { stance?: Stance }
export type DuelEvent = { kind: 'round'; record: DuelRound } | { kind: 'end'; outcome: DuelOutcome }
export type DuelResult =
  | { ok: true; state: DuelState; events: DuelEvent[] }
  | { ok: false; code: 'ended' | 'bad-stance' | 'cannot'; message: string }

/** D-DUEL-3: damage dealt (as a multiple of the dealer's hit) by `me` when facing `them`. */
export const DEAL: Record<Stance, Record<Stance, number>> = {
  strike: { strike: 1, guard: 0, feint: 1.5, mighty: 1, yield: 0 },
  guard: { strike: 0.5, guard: 0, feint: 0, mighty: 0, yield: 0 },
  feint: { strike: 0, guard: 1, feint: 0, mighty: 0, yield: 0 },
  mighty: { strike: 2.5, guard: 1.25, feint: 2.5, mighty: 2.5, yield: 0 },
  yield: { strike: 0, guard: 0, feint: 0, mighty: 0, yield: 0 },
}

export const STANCE_NAME: Record<Stance, string> = {
  strike: 'Strike', guard: 'Guard', feint: 'Feint', mighty: 'Mighty Blow', yield: 'Yield',
}

const opp = (s: Side): Side => (s === 'a' ? 'b' : 'a')
const who = (st: DuelState, s: Side): Contestant => st.setup[s]
const isPlayer = (st: DuelState, s: Side): boolean => who(st, s).player

export function startVigor(c: Contestant): number {
  return Math.floor(40 + c.stats.war / 2 + c.health / 10)
}

export function hitBase(c: Contestant): number {
  return 6 + Math.floor(c.stats.war / 8)
}

function copy(st: DuelState): DuelState {
  return {
    ...st,
    rng: [...st.rng] as RngState,
    vigor: { ...st.vigor }, vigorMax: { ...st.vigorMax }, spirit: { ...st.spirit },
    committed: { ...st.committed }, log: st.log.slice(),
  }
}

/** Legal stances for a side right now. */
export function legalStances(st: DuelState, side: Side): Stance[] {
  if (st.outcome) return []
  const out: Stance[] = ['strike', 'guard', 'feint']
  if (st.spirit[side] >= 100) out.push('mighty')
  out.push('yield')
  return out
}

export interface Tell {
  stance: Stance
  weight: number
  pct: number
}
export interface DuelTells {
  side: Side
  tells: Tell[]
  forced: boolean // Mighty Blow or yield is certain
}

/** D-DUEL-6: the distribution the AI of `side` draws its stance from this round. */
export function duelTells(st: DuelState, side: Side): DuelTells {
  const c = who(st, side)
  const me = st.vigor[side]
  const them = st.vigor[opp(side)]
  const w: Record<'strike' | 'guard' | 'feint', number> = { strike: 40, guard: 30, feint: 30 }
  if (c.temperament === 'reckless') { w.strike += 20; w.guard -= 10; w.feint -= 10 }
  if (c.temperament === 'cautious') { w.guard += 20; w.strike -= 10; w.feint -= 10 }
  if (c.temperament === 'ambitious') { w.feint += 10; w.guard -= 10 }
  if (me / st.vigorMax[side] < 0.3) { w.guard += 15; w.strike -= 15 }
  if (st.spirit[side] >= 100) {
    return { side, tells: [{ stance: 'mighty', weight: 1, pct: 100 }], forced: true }
  }
  if (c.temperament === 'cautious' && me / st.vigorMax[side] < 0.15 && them > 3 * me) {
    return { side, tells: [{ stance: 'yield', weight: 1, pct: 100 }], forced: true }
  }
  const keys = ['strike', 'guard', 'feint'] as const
  let total = 0
  for (const k of keys) { w[k] = Math.max(0, w[k]); total += w[k] }
  const tells: Tell[] = keys.map((k) => ({ stance: k, weight: w[k], pct: total > 0 ? Math.round((1000 * w[k]) / total) / 10 : 0 }))
  return { side, tells, forced: false }
}

function drawStance(rng: RngState, tells: DuelTells): Stance {
  const x = nextFloat(rng) * 100
  let acc = 0
  let last: Stance = tells.tells[0]!.stance
  for (const t of tells.tells) {
    if (t.weight <= 0 && !tells.forced) continue
    acc += t.pct
    last = t.stance
    if (x < acc) return t.stance
  }
  return last
}

function openRound(st: DuelState): void {
  st.committed = { a: null, b: null }
  for (const s of ['a', 'b'] as const) {
    if (!isPlayer(st, s)) st.committed[s] = drawStance(st.rng, duelTells(st, s))
  }
}

export function createDuel(setup: DuelSetup): DuelState {
  const va = startVigor(setup.a)
  const vb = startVigor(setup.b)
  const st: DuelState = {
    setup, rng: seedRng(setup.seed), round: 1,
    vigor: { a: va, b: vb }, vigorMax: { a: va, b: vb }, spirit: { a: 0, b: 0 },
    committed: { a: null, b: null }, log: [], outcome: null,
  }
  openRound(st)
  return st
}

function finish(st: DuelState, winner: Side | null, how: DuelOutcome['how'], events: DuelEvent[]): void {
  st.outcome = {
    duelId: st.setup.id, winner, how, rounds: st.log.length,
    vigorLeft: { a: Math.max(0, st.vigor.a), b: Math.max(0, st.vigor.b) },
  }
  events.push({ kind: 'end', outcome: st.outcome })
}

/** Play one round. The player's side supplies `action.stance`; AI sides use their committed stance. Never throws. */
export function stepDuel(state: DuelState, action: DuelAction): DuelResult {
  try {
    if (state.outcome) return { ok: false, code: 'ended', message: 'The duel is over.' }
    const st = copy(state)
    const pick: Record<Side, Stance> = { a: 'strike', b: 'strike' }
    for (const s of ['a', 'b'] as const) {
      if (isPlayer(st, s)) {
        const stance = action?.stance
        if (typeof stance !== 'string' || !legalStances(st, s).includes(stance)) {
          return { ok: false, code: 'bad-stance', message: `Choose one of: ${legalStances(st, s).join(', ')}.` }
        }
        pick[s] = stance
      } else pick[s] = st.committed[s] ?? 'strike'
    }
    const events: DuelEvent[] = []
    if (pick.a === 'yield' || pick.b === 'yield') {
      st.log.push({ round: st.round, a: pick.a, b: pick.b, dealtByA: 0, dealtByB: 0, vigor: { ...st.vigor }, spirit: { ...st.spirit } })
      if (pick.a === 'yield' && pick.b === 'yield') finish(st, null, 'draw', events)
      else finish(st, pick.a === 'yield' ? 'b' : 'a', 'yield', events)
      return { ok: true, state: st, events }
    }
    // D-DUEL-3: both hit rolls are always drawn, a then b.
    const hit = {
      a: hitBase(st.setup.a) + Math.floor(nextFloat(st.rng) * 5),
      b: hitBase(st.setup.b) + Math.floor(nextFloat(st.rng) * 5),
    }
    const dealt = { a: 0, b: 0 }
    for (const s of ['a', 'b'] as const) {
      const f = DEAL[pick[s]][pick[opp(s)]]
      dealt[s] = f > 0 ? Math.max(1, Math.floor(hit[s] * f)) : 0
    }
    st.vigor.a -= dealt.b
    st.vigor.b -= dealt.a
    // D-DUEL-4: spirit.
    for (const s of ['a', 'b'] as const) {
      let gain = 0
      if (dealt[opp(s)] > 0) gain += 15
      if (dealt[s] > 0) gain += 10
      if (pick.a === pick.b && (pick.a === 'guard' || pick.a === 'feint')) gain += 10
      st.spirit[s] = Math.min(100, st.spirit[s] + gain)
      if (pick[s] === 'mighty') st.spirit[s] = 0
    }
    const rec: DuelRound = {
      round: st.round, a: pick.a, b: pick.b, dealtByA: dealt.a, dealtByB: dealt.b,
      vigor: { ...st.vigor }, spirit: { ...st.spirit },
    }
    st.log.push(rec)
    events.push({ kind: 'round', record: rec })
    const aOut = st.vigor.a <= 0
    const bOut = st.vigor.b <= 0
    if (aOut && bOut) finish(st, null, 'draw', events)
    else if (aOut) finish(st, 'b', 'knockout', events)
    else if (bOut) finish(st, 'a', 'knockout', events)
    else if (st.round >= MAX_ROUNDS) finish(st, null, 'draw', events)
    else {
      st.round += 1
      openRound(st)
    }
    return { ok: true, state: st, events }
  } catch (e) {
    return { ok: false, code: 'cannot', message: String(e) }
  }
}

/** Both sides AI (any `player` flags in the setup are ignored). */
export function autoDuel(setup: DuelSetup): DuelOutcome {
  const s2: DuelSetup = { ...setup, a: { ...setup.a, player: false }, b: { ...setup.b, player: false } }
  let st = createDuel(s2)
  for (let i = 0; i < 40 && !st.outcome; i++) {
    const r = stepDuel(st, {})
    if (!r.ok) break
    st = r.state
  }
  return st.outcome ?? { duelId: setup.id, winner: null, how: 'draw', rounds: st.log.length, vigorLeft: { ...st.vigor } }
}

export const query = { duelTells, legalStances }
