import type { BattleSetup } from '../contracts/battle'
import { createBattle } from './create'
import { step } from './step'
import type { BattleAction, BattleState } from './types'

/** replay(setup, actions) deep-equals the live state. Stops (returning what it has) at the first rejected action. */
export function replay(setup: BattleSetup, actions: BattleAction[]): BattleState {
  let s = createBattle(setup)
  for (const a of actions) {
    const r = step(s, a)
    if (!r.ok) break
    s = r.state
  }
  return s
}
