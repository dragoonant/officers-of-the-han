import { FIELD_COLS, FIELD_ROWS, axialToOffset } from '../../battle/hex'

/** Index into the 15 x 11 hex array, or -1 outside the field. */
export function hexIndexSafe(q: number, r: number): number {
  const { col, row } = axialToOffset(q, r)
  return col >= 0 && col < FIELD_COLS && row >= 0 && row < FIELD_ROWS ? row * FIELD_COLS + col : -1
}
