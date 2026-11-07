// The world engine. `createWorldApi(data)` returns the WorldApi of src/contracts/world.ts plus `query`, `auto` and `invariants`.
import type { GameData } from '../contracts/data'
import type { BattleOutcome, BattleSetup } from '../contracts/battle'
import type { DebateOutcome, DebateSetup, DuelOutcome, DuelSetup } from '../contracts/contest'
import type { NewGameOptions, StepResult, WorldAction, WorldApi, WorldState } from '../contracts/world'
import { GAME_DATA } from '../data'
import { seedRng } from '../shared/rng'
import { autoBattleOutcome, autoDebateOutcome, autoDuelOutcome } from './battle-auto'
import { indexData } from './core'
import { checkInvariants } from './invariants'
import { createQuery } from './query'
import { legalActions, newGame, replay, step } from './step'
import { autopilotAction } from '../ai/world/autopilot'

export type WorldEngine = WorldApi & {
  query: ReturnType<typeof createQuery>
  /** AI-vs-AI resolution of the pendings (the sim and benches answer with these) */
  auto: {
    battle(state: WorldState, setup: BattleSetup): BattleOutcome
    duel(setup: DuelSetup): DuelOutcome
    debate(setup: DebateSetup): DebateOutcome
  }
  invariants(state: WorldState): string[]
  autopilot(state: WorldState, variety?: boolean): WorldAction
}

export function createWorldApi(data: GameData): WorldEngine {
  const d = indexData(data)
  const query = createQuery(d)
  return {
    newGame: (opts: NewGameOptions): WorldState => newGame(d, opts),
    legalActions: (state: WorldState): WorldAction[] => legalActions(d, state),
    step: (state: WorldState, action: WorldAction): StepResult => step(d, state, action),
    replay: (opts: NewGameOptions, actions: WorldAction[]): WorldState => replay(d, opts, actions),
    query,
    auto: {
      battle: (state, setup) => autoBattleOutcome(d, state, setup, seedRng(setup.seed)),
      duel: (setup) => autoDuelOutcome(setup),
      debate: (setup) => autoDebateOutcome(setup),
    },
    invariants: (state: WorldState): string[] => checkInvariants(data, state),
    autopilot: (state: WorldState, variety = true): WorldAction => autopilotAction(data, state, legalActions(d, state), variety),
  }
}

export const world = createWorldApi(GAME_DATA)
export { LOG_KINDS } from './logkinds'
export type * from './types'
export { checkInvariants }
