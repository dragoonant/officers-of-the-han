import { describe, expect, it } from 'vitest'
import { FIELD_COLS, FIELD_ROWS, indexToHex, neighbors } from '../../../src/battle/hex'
import { hexAtWorld, tileXZ } from '../../../src/client/battle/layout'

describe('hex layout', () => {
  it('round-trips every hex through world space', () => {
    for (let i = 0; i < FIELD_COLS * FIELD_ROWS; i++) {
      const h = indexToHex(i)
      const p = tileXZ(h.q, h.r)
      expect(hexAtWorld(p.x, p.z)).toEqual(h)
    }
  })
  it('neighbours are one unit apart (flat to flat)', () => {
    const c = tileXZ(5, 4)
    for (const n of neighbors(5, 4)) {
      const p = tileXZ(n.q, n.r)
      expect(Math.hypot(p.x - c.x, p.z - c.z)).toBeCloseTo(1, 6)
    }
  })
  it('board is centred', () => {
    let sx = 0
    for (let i = 0; i < FIELD_COLS * FIELD_ROWS; i++) { const h = indexToHex(i); sx += tileXZ(h.q, h.r).x }
    expect(Math.abs(sx / (FIELD_COLS * FIELD_ROWS))).toBeLessThan(0.3)
  })
})
