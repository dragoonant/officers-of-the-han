// W-AI-4: the policy that plays the player's officer in the sim. It answers every pending and acts like an AI officer
// (rulers also run a small court), with a little variety so the sim exercises many rules.
import type { GameData } from '../../contracts/data'
import type { WorldAction, WorldState } from '../../contracts/world'
import { cloneState, indexData, makeCtx, O, rnd, F, type Ctx } from '../../world/core'
import { checkAction } from '../../world/rules'
import { bestWar, fillPrefectAction } from './ruler'
import { nextOfficerAction } from './officer'

const VARIETY_SKIP = new Set(['resign', 'captive', 'endMonth', 'transfer', 'mission', 'transport', 'focus', 'war', 'diplomacy'])

function answerPending(state: WorldState, legal: WorldAction[]): WorldAction {
  const p = state.pending[0]!
  switch (p.kind) {
    case 'offer': return legal.find((a) => a.kind === 'answerOffer' && a.accept) ?? legal[0]!
    case 'captured': return legal.find((a) => a.kind === 'answerCaptured' && a.join) ?? legal[0]!
    default: return legal[0]!
  }
}

export function autopilotAction(data: GameData, state: WorldState, legal: WorldAction[], variety = true): WorldAction {
  if (state.pending.length > 0) return answerPending(state, legal)
  const end: WorldAction = { kind: 'endMonth' }
  const po = state.officers[state.player]
  if (!po || po.status !== 'active' || po.days <= 0) return end
  // a private copy of the rng so deciding does not disturb the world's stream
  const shadow: WorldState = { ...state, rng: [state.rng[0], state.rng[1], state.rng[2], state.rng[3]] }
  const c: Ctx = makeCtx(indexData(data), shadow)
  c.ai = true
  const id = state.player
  if (po.post === 'ruler' && po.days >= 10) {
    const fid = po.faction!
    const pre = fillPrefectAction(c, fid)
    if (pre) return pre
    const mine = state.armies.filter((a) => a.faction === fid).length
    if (mine < 1) {
      const w = bestWar(c, fid)
      if (w) return w
    }
  }
  if (variety && !po.mission && po.days >= 5 && rnd(c) < 0.22) {
    const opts = legal.filter((a) => !VARIETY_SKIP.has(a.kind))
    if (opts.length) {
      const a = opts[Math.floor(rnd(c) * opts.length)]!
      if (checkAction(c, id, a) === null) return a
    }
  }
  const a = nextOfficerAction(c, id)
  if (a && checkAction(c, id, a) === null) return a
  void O; void F; void cloneState
  return end
}
