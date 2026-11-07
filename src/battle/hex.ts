// Hex geometry for the field (20-battle.md B-MAP-1). Pointy-top, axial (q, r), "odd-r" offset storage.
// Pure helpers shared with the 3D client: hexToWorld returns x/z on the ground plane.

export interface Hex {
  q: number
  r: number
}

export const FIELD_COLS = 15
export const FIELD_ROWS = 11

/** The six neighbour offsets, in a fixed order (E, W, SE-ish, ...). B-MAP-1. */
export const DIRS: readonly Hex[] = [
  { q: 1, r: 0 },
  { q: -1, r: 0 },
  { q: 0, r: 1 },
  { q: 0, r: -1 },
  { q: 1, r: -1 },
  { q: -1, r: 1 },
]

export function neighbors(q: number, r: number): Hex[] {
  return DIRS.map((d) => ({ q: q + d.q, r: r + d.r }))
}

/** Axial hex distance. */
export function hexDistance(aq: number, ar: number, bq: number, br: number): number {
  const dq = aq - bq
  const dr = ar - br
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2
}

/** odd-r offset (col,row) -> axial. */
export function offsetToAxial(col: number, row: number): Hex {
  return { q: col - (row - (row & 1)) / 2, r: row }
}

/** axial -> odd-r offset. */
export function axialToOffset(q: number, r: number): { col: number; row: number } {
  return { col: q + (r - (r & 1)) / 2, row: r }
}

export function inField(q: number, r: number): boolean {
  if (!Number.isInteger(q) || !Number.isInteger(r)) return false
  const { col, row } = axialToOffset(q, r)
  return col >= 0 && col < FIELD_COLS && row >= 0 && row < FIELD_ROWS
}

/** Index into the row-major hex array, or -1 outside the field. */
export function hexIndex(q: number, r: number): number {
  if (!inField(q, r)) return -1
  const { col, row } = axialToOffset(q, r)
  return row * FIELD_COLS + col
}

export function indexToHex(i: number): Hex {
  return offsetToAxial(i % FIELD_COLS, Math.floor(i / FIELD_COLS))
}

export const hexKey = (q: number, r: number): string => `${q},${r}`

/** Pointy-top layout: centre of hex (q, r) on the ground plane for a hex of circumradius `size`. */
export function hexToWorld(q: number, r: number, size: number): { x: number; z: number } {
  return { x: size * Math.sqrt(3) * (q + r / 2), z: size * 1.5 * r }
}

/** Inverse of hexToWorld, rounded to the nearest hex. */
export function worldToHex(x: number, z: number, size: number): Hex {
  const fq = ((Math.sqrt(3) / 3) * x - (1 / 3) * z) / size
  const fr = ((2 / 3) * z) / size
  let q = Math.round(fq)
  let r = Math.round(fr)
  const s = Math.round(-fq - fr)
  const dq = Math.abs(q - fq)
  const dr = Math.abs(r - fr)
  const ds = Math.abs(s - (-fq - fr))
  if (dq > dr && dq > ds) q = -r - s
  else if (dr > ds) r = -q - s
  return { q: q + 0, r: r + 0 }
}

/** All in-field hexes within `range` of (q, r) (including the centre). */
export function hexesWithin(q: number, r: number, range: number): Hex[] {
  const out: Hex[] = []
  for (let dq = -range; dq <= range; dq++) {
    for (let dr = Math.max(-range, -dq - range); dr <= Math.min(range, -dq + range); dr++) {
      if (inField(q + dq, r + dr)) out.push({ q: q + dq, r: r + dr })
    }
  }
  return out
}
