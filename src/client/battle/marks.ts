// Which tiles are painted and how. Everything comes from legalActions / query.* (never computed in the client).
import { legalActions, query } from '../../battle'
import type { BattleState } from '../../battle/types'
import type { Mode } from './store'

export type MarkKind = 'move' | 'attack' | 'tactic' | 'chosen' | 'selected' | 'active' | 'hover'
export interface Mark {
  q: number
  r: number
  kind: MarkKind
}

export function computeMarks(state: BattleState, mode: Mode, selected: string | null, hover: { q: number; r: number } | null, interactive: boolean): Mark[] {
  const out: Mark[] = []
  const au = query.activeUnit(state)
  if (au && !state.outcome) out.push({ q: au.q, r: au.r, kind: 'active' })
  const sel = selected ? state.units.find((u) => u.id === selected && !u.routed) : null
  if (sel && sel.id !== au?.id) out.push({ q: sel.q, r: sel.r, kind: 'selected' })
  if (interactive && au && !state.outcome && !state.pendingDuel) {
    const legal = legalActions(state)
    const unitHex = (id: string): { q: number; r: number } | null => {
      const u = state.units.find((x) => x.id === id)
      return u ? { q: u.q, r: u.r } : null
    }
    if (mode.kind === 'idle') {
      for (const a of legal) {
        if (a.kind === 'move') out.push({ q: a.q, r: a.r, kind: 'move' })
        else if (a.kind === 'attack') {
          const h = unitHex(a.target)
          if (h) out.push({ ...h, kind: 'attack' })
        } else if (a.kind === 'attackGate') out.push({ q: a.q, r: a.r, kind: 'attack' })
      }
    } else if (mode.kind === 'attack') {
      for (const a of legal) {
        if (a.kind === 'attack') {
          const h = unitHex(a.target)
          if (h) out.push({ ...h, kind: mode.target === a.target ? 'chosen' : 'attack' })
        } else if (a.kind === 'attackGate') out.push({ q: a.q, r: a.r, kind: mode.gate?.q === a.q && mode.gate?.r === a.r ? 'chosen' : 'attack' })
      }
    } else if (mode.kind === 'tactic') {
      for (const a of legal) {
        if (a.kind === 'tactic' && a.tactic === mode.tactic) out.push({ q: a.q, r: a.r, kind: mode.target?.q === a.q && mode.target?.r === a.r ? 'chosen' : 'tactic' })
      }
    } else if (mode.kind === 'challenge') {
      for (const a of legal) {
        if (a.kind === 'challenge') {
          const h = unitHex(a.target)
          if (h) out.push({ ...h, kind: mode.target === a.target ? 'chosen' : 'attack' })
        }
      }
    }
  }
  if (hover) out.push({ q: hover.q, r: hover.r, kind: 'hover' })
  return out
}
