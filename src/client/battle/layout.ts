// World layout of the hex board. One hex is one unit wide (flat to flat), so a figure built at "1 unit = one tile width" fits.
import { FIELD_COLS, FIELD_ROWS, hexToWorld, worldToHex, type Hex } from '../../battle/hex'
import type { Terrain } from '../../battle/types'

/** Circumradius of a hex (flat to flat = 1). */
export const SIZE = 1 / Math.sqrt(3)

const raw = (q: number, r: number): { x: number; z: number } => hexToWorld(q, r, SIZE)
/** Centre of the board in raw hex space (odd-r: the odd rows are shifted half a hex east). */
const CX = (FIELD_COLS - 1 + 0.5) / 2
const CZ = ((FIELD_ROWS - 1) * 1.5 * SIZE) / 2
/** Board half-extents (including a rim). */
export const BOARD_W = FIELD_COLS + 0.5
export const BOARD_H = (FIELD_ROWS - 1) * 1.5 * SIZE + 2 * SIZE

/** Axial -> world (board centred on the origin). */
export function tileXZ(q: number, r: number): { x: number; z: number } {
  const p = raw(q, r)
  // raw x for (q,r) is size*sqrt3*(q + r/2) = q + r/2 in these units; the odd-r column offset is already in q.
  return { x: p.x - CX, z: p.z - CZ }
}

/** World -> axial hex (rounded), or null when outside the field. */
export function hexAtWorld(x: number, z: number): Hex {
  return worldToHex(x + CX, z + CZ, SIZE)
}

/** Height of the top surface of a tile (for figures, marks and the camera floor). */
export function tileTop(t: Terrain): number {
  switch (t) {
    case 'river': return 0.02
    case 'ford': return 0.06
    case 'marsh': return 0.08
    case 'hill': return 0.42
    case 'mountain': return 0.9
    case 'wall': return 0.82
    case 'gate': return 0.3
    case 'keep': return 0.4
    case 'town': return 0.16
    default: return 0.14
  }
}

/** Mineral colours of the lacquered tiles (50-presentation.md "Battle"). */
export const TERRAIN_COLOUR: Record<Terrain, string> = {
  plain: '#2f7d5b', // malachite
  grass: '#8db8a0', // celadon
  forest: '#1f5a43', // darker malachite
  hill: '#6b4a33', // umber
  mountain: '#5b5b5e', // carbon grey
  river: '#3f6fb5', // azurite
  ford: '#6b8fc0',
  marsh: '#4d6f63',
  road: '#cdbd7e', // pale ochre
  wall: '#17110e',
  gate: '#17110e',
  keep: '#d9a441',
  town: '#9c9a96',
  ash: '#3a3633',
}

/** The 14 faction pigments (theme.css --f-1..--f-14). */
export const PIGMENTS = ['#2f7d5b', '#3f6fb5', '#d6a41e', '#e8e4d8', '#5b5b5e', '#a8324f', '#34407e', '#6b4a33', '#cdbd7e', '#8a4b2e', '#8db8a0', '#7a3d7a', '#b0643a', '#6d7c8c'] as const

function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

/** Pigments that read against the board's malachite, celadon and umber (indices into PIGMENTS). */
const POOL = [1, 2, 3, 5, 6, 11, 12, 13] as const

/** Pigment for a faction id (null = rebels: slate). The attacker and defender never share one. */
export function sidePigments(attacker: string | null, defender: string | null): { attacker: string; defender: string } {
  const pick = (f: string | null): number => (f === null ? 3 : hash(f) % POOL.length)
  const a = pick(attacker)
  let d = pick(defender)
  if (d === a) d = (d + 3) % POOL.length
  return { attacker: PIGMENTS[POOL[a]!]!, defender: PIGMENTS[POOL[d]!]! }
}
