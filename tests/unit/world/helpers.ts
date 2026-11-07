import { createWorldApi } from '../../../src/world'
import { MINI_WORLD, MINI_OPTS } from '../../fixtures/mini-world'
import { seedRng } from '../../../src/shared/rng'
import type { StepResult, WorldAction, WorldState } from '../../../src/contracts/world'

export const W = createWorldApi(MINI_WORLD)
export const J = <T,>(x: T): T => JSON.parse(JSON.stringify(x)) as T

export function ok(r: StepResult): WorldState {
  if (!r.ok) throw new Error(`rejected: ${r.code} ${r.message}`)
  return r.state
}
/** answer every pending with the autopilot's answer */
export function clear(s: WorldState): WorldState {
  let g = 0
  while (s.pending.length && g++ < 50) s = ok(W.step(s, W.autopilot(s, false)))
  return s
}
export function fresh(officer = 'xiahou-dun', seed = 1, mut?: (s: WorldState) => void): WorldState {
  let s = W.newGame(MINI_OPTS(officer, seed))
  s = J(s)
  s.pending = []
  // undo whatever the first month's AI court did to the player's side: disband armies
  for (const a of s.armies) {
    s.cities[a.from]!.troops += a.units.reduce((n, u) => n + u.troops, 0)
    s.cities[a.from]!.rice += a.rice
    for (const u of a.units) s.officers[u.officer]!.status = 'active'
  }
  s.armies = []
  for (const st of MINI_WORLD.scenarios[0]!.officers) {
    const o = s.officers[st.id]!
    if (st.post === 'prefect' && o.status === 'active' && o.faction && o.city === st.city && s.cities[st.city]!.faction === o.faction && !s.cities[st.city]!.prefect) { s.cities[st.city]!.prefect = st.id; o.post = 'prefect' }
  }
  if (mut) mut(s)
  return s
}
/** a world where the AI does nothing: no events, no deaths, everyone loyal, allied, idle */
export function calm(s: WorldState): void {
  s.options.events = false
  s.options.lifespans = false
  s.cities['wancheng']!.faction = 'f-cao-cao'
  for (const o of Object.values(s.officers)) {
    if (o.id !== s.player) o.days = 0
    if (o.loyalty !== null) o.loyalty = 100
  }
  s.pacts.push({ a: 'f-cao-cao', b: 'f-dong-zhuo', kind: 'alliance', until: { year: 300, month: 1 } }, { a: 'f-cao-cao', b: 'f-yuan-shao', kind: 'alliance', until: { year: 300, month: 1 } }, { a: 'f-dong-zhuo', b: 'f-yuan-shao', kind: 'alliance', until: { year: 300, month: 1 } })
}
export const act = (s: WorldState, a: WorldAction): WorldState => ok(W.step(s, a))
export const rej = (s: WorldState, a: WorldAction) => { const r = W.step(s, a); if (r.ok) throw new Error('expected a rejection'); return r }
/** end the month, answering any pendings with the autopilot's choices, until the player's turn */
export function endMonth(s: WorldState, idle = false): WorldState {
  if (idle) { s = J(s); for (const o of Object.values(s.officers)) if (o.id !== s.player) o.days = 0 }
  s = act(s, { kind: 'endMonth' })
  let g = 0
  while ((s.phase === 'world' || s.pending.length) && g++ < 80) s = ok(W.step(s, W.autopilot(s, false)))
  return s
}
/** try the action under different rng states until `pred` holds on the result (for rolled actions) */
export function tryRolls(s: WorldState, a: WorldAction, pred: (n: WorldState) => boolean): WorldState {
  for (let i = 1; i < 200; i++) {
    const t = J(s)
    t.rng = seedRng(i * 7919)
    const r = W.step(t, a)
    if (r.ok && pred(r.state)) return r.state
  }
  throw new Error('no rng state produced the wanted result')
}
