// Builds save envelopes (KB rule 22) in Node for the e2e specs: a played officer with a battle, duel or debate
// letter at pending[0]. Run with `tsx tests/e2e/fixtures/make-saves.ts` (prints JSON), or import `makeSaves()`.
import type { NewGameOptions, Pending, WorldAction, WorldState } from '../../../src/contracts/world'
import { world } from '../../../src/world'

export interface Env { version: 1; savedAt: number; opts: NewGameOptions; actions: WorldAction[]; snapshot: WorldState; presentation: Record<string, never> }
export type Kind = 'battle' | 'duel' | 'debate'

/** The first sensible answer to any pending that is not one of the contests. */
export function answerFor(s: WorldState, p: Pending): WorldAction {
  switch (p.kind) {
    case 'letter': return { kind: 'ack', pending: p.id }
    case 'eventChoice': return { kind: 'choose', pending: p.id, option: 0 }
    case 'offer': return { kind: 'answerOffer', pending: p.id, accept: false }
    case 'captured': return { kind: 'answerCaptured', pending: p.id, join: false }
    case 'chooseDefenders': return { kind: 'setDefenders', pending: p.id, officers: p.candidates.slice(0, p.max) }
    case 'chooseSuccessor': return { kind: 'chooseSuccessor', pending: p.id, officer: p.candidates[0]! }
    case 'battle': return { kind: 'resolveBattle', pending: p.id, outcome: world.auto.battle(s, p.setup) }
    case 'duel': return { kind: 'resolveDuel', pending: p.id, outcome: world.auto.duel(p.setup) }
    case 'debate': return { kind: 'resolveDebate', pending: p.id, outcome: world.auto.debate(p.setup) }
  }
}

function env(opts: NewGameOptions, actions: WorldAction[], snapshot: WorldState): Env {
  return { version: 1, savedAt: Date.now(), opts, actions, snapshot, presentation: {} }
}

function run(s: WorldState, actions: WorldAction[], a: WorldAction): WorldState {
  const r = world.step(s, a)
  if (!r.ok) throw new Error(`fixture step rejected ${JSON.stringify(a).slice(0, 120)}: ${r.message}`)
  actions.push(a)
  return r.state
}

/** Answer pendings that are not `want` and end months until `want` is at pending[0]. */
function until(s: WorldState, actions: WorldAction[], want: Kind, months = 8): WorldState {
  for (let i = 0; i < 40 && months >= 0; i++) {
    const p = s.pending[0]
    if (p?.kind === want) return s
    if (p) { s = run(s, actions, answerFor(s, p)); continue }
    months--
    s = run(s, actions, { kind: 'endMonth' })
  }
  throw new Error(`no ${want} pending came up`)
}

export function makeBattle(seed = 7): Env {
  const opts: NewGameOptions = { scenario: '190', seed, officer: 'cao-cao' }
  const actions: WorldAction[] = []
  let s = world.newGame(opts)
  const war = world.query.actionsHere(s).find((a) => a.kind === 'war' && a.available)?.action
  if (!war || war.kind !== 'war') throw new Error('no war action')
  // put the player in the army as its commander so the battle board has a unit for them
  const units = war.units.map((u, i) => (i === 0 ? { ...u, officer: opts.officer as string } : u))
  s = run(s, actions, { ...war, units })
  s = until(s, actions, 'battle')
  return env(opts, actions, s)
}

export function makeDuel(seed = 7): Env {
  const opts: NewGameOptions = { scenario: '190', seed, officer: 'cao-cao' }
  const actions: WorldAction[] = []
  let s = world.newGame(opts)
  const ch = world.query.actionsHere(s).find((a) => a.kind === 'challenge' && a.available)?.action
  if (!ch) throw new Error('no challenge')
  s = run(s, actions, ch)
  return env(opts, actions, until(s, actions, 'duel', 0))
}

export function makeDebate(seed = 7): Env {
  // an envoy sent by debate (a recruit-by-debate needs a wanderer in the city; the engine path is the same)
  const opts: NewGameOptions = { scenario: '190', seed, officer: 'cao-cao' }
  const actions: WorldAction[] = []
  let s = world.newGame(opts)
  const base = world.query.actionsHere(s).find((x) => x.action.kind === 'diplomacy' && x.available)?.action
  if (!base || base.kind !== 'diplomacy') throw new Error('no debate action')
  const dip: WorldAction = { ...base, mode: 'debate' }
  s = run(s, actions, dip)
  return env(opts, actions, until(s, actions, 'debate', 0))
}

export function makeSaves(): Record<Kind, Env> {
  return { battle: makeBattle(), duel: makeDuel(), debate: makeDebate() }
}

if (process.argv[1]?.endsWith('make-saves.ts')) process.stdout.write(JSON.stringify(makeSaves()))
