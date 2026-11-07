// B-OUT-1: build the BattleOutcome from a state.
import type { BattleOutcome, BattleSide, BattleUnitResult } from '../contracts/battle'
import type { BattleState } from './types'

export function buildOutcome(state: BattleState, winner: BattleSide, reason: BattleOutcome['reason']): BattleOutcome {
  const units: BattleUnitResult[] = state.units.map((u) => {
    let merit = u.kills * 50 + u.duelWins * 100
    if (u.side === winner) {
      if (!u.routed) merit += 150
      if (u.commander) merit += 300
    } else merit += 30
    return {
      officer: u.officer.id,
      side: u.side,
      troopsStart: u.troopsStart,
      troopsEnd: Math.max(0, u.troops),
      routed: u.routed,
      captured: u.captured,
      slain: u.slain,
      wounded: u.wounded,
      merit,
    }
  })
  return {
    battleId: state.setup.id,
    winner,
    reason,
    days: Math.min(state.day, state.setup.maxDays),
    units,
    duels: state.duels.map((d) => ({ ...d })),
  }
}
