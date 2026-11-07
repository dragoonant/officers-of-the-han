// The presented state: what the board shows while the director plays events one by one. Authoritative state is re-synced at the end of every batch.
import { hexIndex, FIELD_COLS, FIELD_ROWS } from '../../battle/hex'
import type { BattleEvent, BattleState, Terrain } from '../../battle/types'

export interface PUnit {
  id: string
  q: number
  r: number
  troops: number
  morale: number
  routed: boolean
  confused: boolean
  /** Heading in radians (atan2 of dx, dz). */
  facing: number
}
export interface PHex {
  terrain: Terrain
  burn: number
  gateHp: number
}
export interface Pres {
  units: PUnit[]
  hexes: PHex[]
  day: number
  active: string | null
}

export function presFrom(state: BattleState, prev?: Pres): Pres {
  const old = new Map((prev?.units ?? []).map((u) => [u.id, u]))
  return {
    units: state.units.map((u) => ({
      id: u.id, q: u.q, r: u.r, troops: u.troops, morale: u.morale, routed: u.routed, confused: u.confused,
      facing: old.get(u.id)?.facing ?? (u.side === 'attacker' ? Math.PI / 2 : -Math.PI / 2),
    })),
    hexes: state.hexes.map((h) => ({ terrain: h.terrain, burn: h.burn, gateHp: h.gateHp })),
    day: state.day,
    active: state.active,
  }
}

export function clonePres(p: Pres): Pres {
  return { units: p.units.map((u) => ({ ...u })), hexes: p.hexes.map((h) => ({ ...h })), day: p.day, active: p.active }
}

/** Apply one event to the presented state (in place). */
export function applyEvent(p: Pres, e: BattleEvent): void {
  const unit = (id: string): PUnit | undefined => p.units.find((u) => u.id === id)
  switch (e.kind) {
    case 'dayStart': p.day = e.day; break
    case 'turnStart': p.active = e.unit; break
    case 'move': {
      const u = unit(e.unit)
      const last = e.path[e.path.length - 1]
      if (u && last) { u.q = last.q; u.r = last.r }
      break
    }
    case 'attack': {
      const t = unit(e.target)
      const a = unit(e.unit)
      if (t) t.troops = Math.max(0, t.troops - e.damage)
      if (a) a.troops = Math.max(0, a.troops - e.counter)
      break
    }
    case 'volley': { const t = unit(e.target); if (t) t.troops = Math.max(0, t.troops - e.damage); break }
    case 'burn': { const u = unit(e.unit); if (u) { u.troops = Math.max(0, u.troops - e.troops); u.morale = Math.max(0, u.morale - e.morale) } break }
    case 'morale': { const u = unit(e.unit); if (u) u.morale = Math.max(0, Math.min(100, u.morale + e.delta)); break }
    case 'rout': { const u = unit(e.unit); if (u) u.routed = true; break }
    case 'gate': {
      const i = hexIndex(e.q, e.r)
      const h = p.hexes[i]
      if (h) { h.gateHp = e.hp; if (e.broken) h.gateHp = 0 }
      break
    }
    case 'tactic': {
      if (!e.success) break
      if (e.tactic === 'fire') { const h = p.hexes[hexIndex(e.q, e.r)]; if (h) h.burn = 2 }
      if (e.tactic === 'confuse') { const t = p.units.find((u) => u.q === e.q && u.r === e.r && !u.routed); if (t) t.confused = true }
      break
    }
    case 'ignite': { const h = p.hexes[hexIndex(e.q, e.r)]; if (h) h.burn = 2; break }
    case 'ash': { const h = p.hexes[hexIndex(e.q, e.r)]; if (h) { h.burn = 0; h.terrain = 'ash' } break }
    case 'confusedSkip': { const u = unit(e.unit); if (u) u.confused = false; break }
    default: break
  }
}

export const FIELD_SIZE = FIELD_COLS * FIELD_ROWS
