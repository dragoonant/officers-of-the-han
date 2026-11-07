// THE SEAM with the board agent. Everything the world client takes from src/client/ui/**, src/client/battle/** and
// src/client/contests/** is imported here and nowhere else. Until those land on main this file re-exports local
// stand-ins; after `git merge main` switch the exports below to the real modules and delete ./ui.tsx's duplicates
// and the stand-ins at the bottom of this file.
import type { BattleState } from '../../battle/types'
import type { BattleOutcome, BattleSetup } from '../../contracts/battle'
import type { DebateOutcome, DebateSetup, DuelOutcome, DuelSetup } from '../../contracts/contest'
import { world } from '../../world'
import { useGame } from '../store/game'
import { LacquerButton, SilkLetter } from './ui'

export { CloudBand, LacquerBox, LacquerButton, Mirror, Portrait, SilkLetter, StatDial } from './ui'

export interface BattleScreenProps {
  setup: BattleSetup
  initial?: BattleState
  onChange?: (s: BattleState) => void
  onDone: (o: BattleOutcome) => void
}
export interface DuelScreenProps { setup: DuelSetup; onDone: (o: DuelOutcome) => void }
export interface DebateScreenProps { setup: DebateSetup; onDone: (o: DebateOutcome) => void }

// ---- stand-ins (delete after the merge) ----

export function BattleScreen({ setup, onDone }: BattleScreenProps) {
  const state = useGame((s) => s.state)
  const mine = setup.units.filter((u) => setup.playerControls.includes(u.officer.id)).map((u) => u.officer.name)
  return (
    <SilkLetter title={`Battle at ${setup.cityName}`} from="Stand-in board" testid="battle-standin">
      <p>The hex board is not part of this build yet. Units: {setup.units.length}. You command: {mine.join(', ') || 'no one'}.</p>
      <div className="answers">
        <LacquerButton primary testid="resolve-numbers" onClick={() => state && onDone(world.auto.battle(state, setup))}>
          Resolve by the numbers<span className="sub">The world's automatic result (W-WAR-5) decides this battle</span>
        </LacquerButton>
      </div>
    </SilkLetter>
  )
}

export function DuelScreen({ setup, onDone }: DuelScreenProps) {
  return (
    <SilkLetter title={`Duel: ${setup.a.name} against ${setup.b.name}`} from="Stand-in board" testid="duel-standin">
      <p>The duel board is not part of this build yet.</p>
      <div className="answers">
        <LacquerButton primary testid="resolve-numbers" onClick={() => onDone(world.auto.duel(setup))}>Resolve by the numbers<span className="sub">Both duelists' WAR and health decide it</span></LacquerButton>
      </div>
    </SilkLetter>
  )
}

export function DebateScreen({ setup, onDone }: DebateScreenProps) {
  return (
    <SilkLetter title={`Debate: ${setup.a.name} against ${setup.b.name}`} from="Stand-in board" testid="debate-standin">
      <p>The debate board is not part of this build yet.</p>
      <div className="answers">
        <LacquerButton primary testid="resolve-numbers" onClick={() => onDone(world.auto.debate(setup))}>Resolve by the numbers<span className="sub">Both speakers' INT and CHA decide it</span></LacquerButton>
      </div>
    </SilkLetter>
  )
}
