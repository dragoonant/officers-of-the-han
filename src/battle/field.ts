// B-MAP-3 / B-MAP-4: seeded field generation. Uses its own stream (seed ^ constant), never the battle's.
import type { BattleSetup } from '../contracts/battle'
import { nextFloat, seedRng, type RngState } from '../shared/rng'
import { FIELD_COLS, FIELD_ROWS, hexIndex, neighbors, offsetToAxial } from './hex'
import { TERRAIN } from './terrain'
import type { HexCell, Terrain } from './types'

export const WALL_COL = 10
export const KEEP_COL = 13
export const KEEP_ROW = 5
export const GATE_ROWS: readonly number[] = [1, 5, 9] // one gate per ~4 rows (11 rows -> 3, at least 2)
export const ATTACKER_COLS = [0, 1, 2]
export const DEFENDER_COLS = [11, 12, 13, 14]

const cell = (terrain: Terrain): HexCell => ({ terrain, burn: 0, burnBy: null, gateHp: 0, gateMax: 0 })
const at = (col: number, row: number): number => row * FIELD_COLS + col

function pick(st: RngState, n: number): number {
  return Math.floor(nextFloat(st) * n)
}

function shuffled<T>(st: RngState, arr: T[]): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = pick(st, i + 1)
    const t = a[i] as T
    a[i] = a[j] as T
    a[j] = t
  }
  return a
}

/** Deterministic: same setup (seed, terrain, walls) -> same field. */
export function generateField(setup: Pick<BattleSetup, 'seed' | 'terrain' | 'walls'>): HexCell[] {
  const st = seedRng((setup.seed ^ 0x5bd1e995) >>> 0)
  const cells: HexCell[] = []
  for (let i = 0; i < FIELD_COLS * FIELD_ROWS; i++) cells.push(cell('plain'))
  const set = (col: number, row: number, t: Terrain): void => {
    if (col < 0 || col >= FIELD_COLS || row < 0 || row >= FIELD_ROWS) return
    cells[at(col, row)] = cell(t)
  }
  // Outside the walls (columns 0..9): the terrain.
  const base = (): Terrain => {
    const x = nextFloat(st)
    return x < 0.25 ? 'grass' : 'plain'
  }
  for (let row = 0; row < FIELD_ROWS; row++) for (let col = 0; col < WALL_COL; col++) set(col, row, base())

  switch (setup.terrain) {
    case 'plain':
      for (let row = 0; row < FIELD_ROWS; row++) for (let col = 3; col < WALL_COL; col++) if (nextFloat(st) < 0.09) set(col, row, 'forest')
      break
    case 'forest':
      for (let row = 0; row < FIELD_ROWS; row++) for (let col = 2; col < WALL_COL; col++) if (nextFloat(st) < 0.6) set(col, row, 'forest')
      break
    case 'hills': {
      const bands = shuffled(st, [3, 4, 5, 6, 7, 8]).slice(0, 2 + pick(st, 2))
      for (const bc of bands) {
        const wide = nextFloat(st) < 0.4
        for (let row = 0; row < FIELD_ROWS; row++) {
          if (nextFloat(st) < 0.75) set(bc, row, 'hill')
          if (wide && nextFloat(st) < 0.6) set(bc + 1, row, 'hill')
        }
      }
      for (let row = 0; row < FIELD_ROWS; row++) for (let col = 3; col < WALL_COL; col++) if (cells[at(col, row)]?.terrain !== 'hill' && nextFloat(st) < 0.06) set(col, row, 'forest')
      break
    }
    case 'mountain': {
      for (let col = 3; col < WALL_COL - 1; col++) {
        const top = 1 + pick(st, 3)
        const bot = 1 + pick(st, 3)
        for (let k = 0; k < top; k++) set(col, k, 'mountain')
        for (let k = 0; k < bot; k++) set(col, FIELD_ROWS - 1 - k, 'mountain')
      }
      const bc = 4 + pick(st, 3)
      const passes = shuffled(st, [2, 3, 4, 5, 6, 7, 8]).slice(0, 2 + pick(st, 2))
      for (let row = 0; row < FIELD_ROWS; row++) set(bc, row, passes.includes(row) ? 'plain' : 'mountain')
      break
    }
    case 'river': {
      const rc = 4 + pick(st, 3)
      const fords = shuffled(st, [1, 2, 3, 4, 5, 6, 7, 8, 9]).slice(0, 2 + pick(st, 2))
      for (let row = 0; row < FIELD_ROWS; row++) set(rc, row, fords.includes(row) ? 'ford' : 'river')
      for (let row = 0; row < FIELD_ROWS; row++) for (let col = 7; col < WALL_COL; col++) if (nextFloat(st) < 0.07) set(col, row, 'forest')
      break
    }
    case 'marsh': {
      const blobs = 4 + pick(st, 3)
      for (let b = 0; b < blobs; b++) {
        const cc = 2 + pick(st, 8)
        const cr = pick(st, FIELD_ROWS)
        const ax = offsetToAxial(cc, cr)
        const hs = [ax, ...neighbors(ax.q, ax.r)]
        for (const h of hs) {
          const i = hexIndex(h.q, h.r)
          if (i < 0) continue
          const col = i % FIELD_COLS
          if (col >= 2 && col < WALL_COL && nextFloat(st) < 0.8) cells[i] = cell('marsh')
        }
      }
      break
    }
  }

  // A road along the middle gate row (not over rivers, fords or mountains).
  for (let col = 0; col < WALL_COL; col++) {
    const t = cells[at(col, KEEP_ROW)]?.terrain
    if (t && t !== 'river' && t !== 'ford' && t !== 'mountain') set(col, KEEP_ROW, 'road')
  }
  // The two columns in front of the wall are always open ground (a place to stand and attack the gate).
  for (let row = 0; row < FIELD_ROWS; row++) {
    for (const col of [WALL_COL - 2, WALL_COL - 1]) {
      const t = cells[at(col, row)]?.terrain
      if (t === 'mountain' || t === 'river' || t === 'ford') set(col, row, 'plain')
    }
  }
  // The deploy columns are never impassable.
  for (let row = 0; row < FIELD_ROWS; row++) for (const col of ATTACKER_COLS) if (!TERRAIN[cells[at(col, row)]!.terrain].cost) set(col, row, 'plain')

  // The city: wall line, gates, town, keep (B-MAP-3).
  const gateMax = 100 + Math.max(0, Math.floor(setup.walls)) * 2
  for (let row = 0; row < FIELD_ROWS; row++) {
    if (GATE_ROWS.includes(row)) {
      const g = cell('gate')
      g.gateHp = gateMax
      g.gateMax = gateMax
      cells[at(WALL_COL, row)] = g
    } else set(WALL_COL, row, 'wall')
    for (let col = WALL_COL + 1; col < FIELD_COLS; col++) set(col, row, 'town')
  }
  set(KEEP_COL, KEEP_ROW, 'keep')

  // B-MAP-4 repair: every gate must be reachable from the deploy zone.
  for (const gr of GATE_ROWS) {
    if (!gateReachable(cells, gr)) {
      for (let col = 0; col < WALL_COL; col++) {
        const t = cells[at(col, gr)]!.terrain
        if (!TERRAIN[t].cost) set(col, gr, t === 'river' ? 'ford' : 'plain')
      }
    }
  }
  return cells
}

/** Is there a passable path from every attacker deploy hex to a hex outside `gateRow`'s gate? (B-MAP-4) */
export function gateReachable(cells: readonly HexCell[], gateRow: number): boolean {
  const seen = new Set<number>()
  const stack: number[] = []
  for (let row = 0; row < FIELD_ROWS; row++) for (const col of ATTACKER_COLS) {
    const i = at(col, row)
    if (TERRAIN[cells[i]!.terrain].cost && !seen.has(i)) { seen.add(i); stack.push(i) }
  }
  while (stack.length) {
    const i = stack.pop()!
    const ax = offsetToAxial(i % FIELD_COLS, Math.floor(i / FIELD_COLS))
    for (const n of neighbors(ax.q, ax.r)) {
      const j = hexIndex(n.q, n.r)
      if (j < 0 || seen.has(j)) continue
      const col = j % FIELD_COLS
      if (col >= WALL_COL) continue // stay outside the walls
      if (!TERRAIN[cells[j]!.terrain].cost) continue
      seen.add(j)
      stack.push(j)
    }
  }
  const gax = offsetToAxial(WALL_COL, gateRow)
  for (const n of neighbors(gax.q, gax.r)) {
    const j = hexIndex(n.q, n.r)
    if (j >= 0 && j % FIELD_COLS < WALL_COL && seen.has(j)) return true
  }
  return false
}
