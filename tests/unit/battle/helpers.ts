import type { BattleOfficer, BattleSetup, BattleSide } from '../../../src/contracts/battle'
import type { Aptitude, Stats, Temperament, TroopType } from '../../../src/contracts/data'
import {
  createBattle, offsetToAxial, step, type BattleAction, type BattleEvent, type BattleState, type Terrain,
} from '../../../src/battle'
import { hexIndex } from '../../../src/battle/hex'

export interface U {
  id: string
  side?: BattleSide
  type?: TroopType
  troops?: number
  war?: number
  ldr?: number
  int?: number
  cha?: number
  apt?: Aptitude
  temperament?: Temperament
  oath?: string[]
  health?: number
  morale?: number
  commander?: boolean
  col?: number
  row?: number
}

export const H = (col: number, row: number): { q: number; r: number } => offsetToAxial(col, row)

export function officer(u: U): BattleOfficer {
  const stats: Stats = { war: u.war ?? 70, ldr: u.ldr ?? 70, int: u.int ?? 50, pol: 50, cha: u.cha ?? 50 }
  return {
    id: u.id, name: u.id, stats, temperament: u.temperament ?? 'steady',
    aptitude: { spear: u.apt ?? 'B', cavalry: u.apt ?? 'B', archer: u.apt ?? 'B' },
    health: u.health ?? 100, oathGroup: u.oath ?? [],
  }
}

export interface MkOpts {
  seed?: number
  terrain?: BattleSetup['terrain']
  walls?: number
  training?: [number, number]
  playerControls?: string[]
  maxDays?: number
  flat?: boolean // default true: outside the walls is all plain
}

/** Build a battle from a list of units, then place them. Unplaced units keep their deployment hex. */
export function mk(units: U[], o: MkOpts = {}): BattleState {
  const setup: BattleSetup = {
    id: 't1', seed: o.seed ?? 7, attackerFaction: 'a', defenderFaction: 'd', cityId: 'c', cityName: 'C',
    terrain: o.terrain ?? 'plain', siege: true, walls: o.walls ?? 50,
    attackerTraining: o.training?.[0] ?? 60, defenderTraining: o.training?.[1] ?? 60,
    maxDays: o.maxDays ?? 20, playerControls: o.playerControls ?? [],
    units: units.map((u, i) => ({
      officer: officer(u), side: u.side ?? 'attacker', troops: u.troops ?? 3000, type: u.type ?? 'spear',
      commander: u.commander ?? !units.some((x, j) => j < i && (x.side ?? 'attacker') === (u.side ?? 'attacker')),
    })),
  }
  let s = createBattle(setup)
  s = structuredClone(s)
  if (o.flat !== false) {
    for (let row = 0; row < 11; row++) for (let col = 0; col < 10; col++) s.hexes[row * 15 + col] = { terrain: 'plain', burn: 0, burnBy: null, gateHp: 0, gateMax: 0 }
  }
  units.forEach((u) => {
    const bu = s.units.find((x) => x.id === u.id)!
    if (u.col !== undefined && u.row !== undefined) {
      const h = H(u.col, u.row)
      bu.q = h.q
      bu.r = h.r
    }
    if (u.morale !== undefined) bu.morale = u.morale
  })
  return activate(s, units[0]!.id)
}

/** Make `id` the active unit, order = [id, ...the others]. */
export function activate(state: BattleState, id: string): BattleState {
  const s = structuredClone(state)
  const ids = s.units.filter((u) => !u.routed).map((u) => u.id)
  s.order = [id, ...ids.filter((x) => x !== id)]
  s.cursor = 0
  s.active = id
  const u = s.units.find((x) => x.id === id)!
  u.moved = false
  u.acted = false
  u.movedDist = 0
  u.fromQ = u.q
  u.fromR = u.r
  return s
}

export function setTerrain(s: BattleState, col: number, row: number, t: Terrain): BattleState {
  const n = structuredClone(s)
  n.hexes[row * 15 + col] = { terrain: t, burn: 0, burnBy: null, gateHp: 0, gateMax: 0 }
  return n
}

export function unit(s: BattleState, id: string) {
  return s.units.find((u) => u.id === id)!
}

export function doStep(s: BattleState, a: BattleAction): { state: BattleState; events: BattleEvent[] } {
  const r = step(s, a)
  if (!r.ok) throw new Error(`step rejected ${JSON.stringify(a)}: ${r.code} ${r.message}`)
  return { state: r.state, events: r.events }
}

export const idx = (col: number, row: number): number => row * 15 + col
export { hexIndex }
