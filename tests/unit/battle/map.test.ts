import { describe, expect, it } from 'vitest'
import {
  ATTACKER_COLS, DEFENDER_COLS, GATE_ROWS, KEEP_COL, KEEP_ROW, WALL_COL, axialToOffset, createBattle, generateField, hexDistance, hexIndex,
  hexToWorld, indexToHex, inField, neighbors, offsetToAxial, query, worldToHex,
} from '../../../src/battle'
import { TERRAIN } from '../../../src/battle/terrain'
import type { RoadTerrain } from '../../../src/contracts/data'
import { sampleSetup } from '../../../src/battle/sample'
import { H, mk, setTerrain, doStep, unit } from './helpers'

const TERRAINS: RoadTerrain[] = ['plain', 'hills', 'mountain', 'river', 'marsh', 'forest']

describe('B-MAP-1 hex geometry', () => {
  it('B-MAP-1 the field is 15 x 11 hexes in odd-r layout', () => {
    const s = createBattle(sampleSetup({ seed: 1 }))
    expect(s.hexes.length).toBe(165)
    for (let i = 0; i < 165; i++) {
      const h = indexToHex(i)
      expect(hexIndex(h.q, h.r)).toBe(i)
      const o = axialToOffset(h.q, h.r)
      expect(offsetToAxial(o.col, o.row)).toEqual(h)
    }
    expect(inField(-1, 0)).toBe(false)
    expect(hexIndex(0, 11)).toBe(-1)
  })
  it('B-MAP-1 the six neighbours are (q+1,r) (q-1,r) (q,r+1) (q,r-1) (q+1,r-1) (q-1,r+1)', () => {
    expect(neighbors(3, 4)).toEqual([
      { q: 4, r: 4 }, { q: 2, r: 4 }, { q: 3, r: 5 }, { q: 3, r: 3 }, { q: 4, r: 3 }, { q: 2, r: 5 },
    ])
    for (const n of neighbors(3, 4)) expect(hexDistance(3, 4, n.q, n.r)).toBe(1)
  })
  it('B-MAP-1 distance is the axial hex distance', () => {
    expect(hexDistance(0, 0, 3, -1)).toBe(3)
    expect(hexDistance(2, 2, 2, 2)).toBe(0)
    expect(hexDistance(0, 0, 2, 2)).toBe(4)
    expect(hexDistance(0, 0, 0, 4)).toBe(4)
  })
  it('B-MAP-1 hexToWorld lays out pointy-top hexes and worldToHex inverts it', () => {
    const a = hexToWorld(0, 0, 1)
    const b = hexToWorld(1, 0, 1)
    expect(b.x - a.x).toBeCloseTo(Math.sqrt(3))
    expect(hexToWorld(0, 1, 1).z).toBeCloseTo(1.5)
    for (let i = 0; i < 165; i++) {
      const h = indexToHex(i)
      const w = hexToWorld(h.q, h.r, 2.5)
      expect(worldToHex(w.x, w.z, 2.5)).toEqual(h)
    }
    // all six neighbours are the same distance away
    for (const n of neighbors(0, 0)) {
      const w = hexToWorld(n.q, n.r, 1)
      expect(Math.hypot(w.x, w.z)).toBeCloseTo(Math.sqrt(3))
    }
  })
})

describe('B-MAP-2 terrain', () => {
  it('B-MAP-2 table: move costs, defence and burning', () => {
    const t = TERRAIN
    expect(t.plain.cost).toEqual({ spear: 1, cavalry: 1, archer: 1 })
    expect(t.forest.cost).toEqual({ spear: 2, cavalry: 3, archer: 2 })
    expect(t.hill.cost).toEqual({ spear: 2, cavalry: 2, archer: 2 })
    expect(t.ford.cost).toEqual({ spear: 2, cavalry: 3, archer: 2 })
    expect(t.marsh.cost).toEqual({ spear: 3, cavalry: 4, archer: 3 })
    expect(t.road.cost).toEqual({ spear: 1, cavalry: 1, archer: 1 })
    for (const n of ['mountain', 'river', 'wall'] as const) expect(t[n].cost).toBeNull()
    expect([t.plain.def, t.grass.def, t.forest.def, t.hill.def, t.ford.def, t.marsh.def, t.road.def, t.gate.def, t.keep.def, t.town.def])
      .toEqual([1.0, 1.0, 0.8, 0.85, 1.15, 1.1, 1.0, 0.8, 0.7, 0.85])
    expect(['plain', 'grass', 'forest'].every((k) => t[k as 'plain'].burns)).toBe(true)
    expect(['hill', 'mountain', 'river', 'ford', 'marsh', 'road', 'wall', 'gate', 'keep', 'town'].every((k) => !t[k as 'hill'].burns)).toBe(true)
  })
  it('B-MAP-2 a unit pays the terrain cost when moving (real moveRange)', () => {
    let s = mk([{ id: 'sp', col: 2, row: 5, type: 'spear' }, { id: 'e', side: 'defender', col: 12, row: 5 }])
    s = setTerrain(s, 3, 5, 'forest')
    const fq = H(3, 5)
    const cost = (st: typeof s, id: string): number => query.moveRange(st, id).find((m) => m.q === fq.q && m.r === fq.r)!.cost
    expect(cost(s, 'sp')).toBe(2)
    for (const [type, c] of [['cavalry', 3], ['archer', 2]] as const) {
      const s2 = structuredClone(s)
      unit(s2, 'sp').type = type
      expect(cost(s2, 'sp')).toBe(c)
    }
    const m = setTerrain(s, 3, 5, 'mountain')
    expect(query.moveRange(m, 'sp').some((h) => h.q === fq.q && h.r === fq.r)).toBe(false)
    expect(query.hexAt(m, fq.q, fq.r)!.passable).toBe(false)
  })
  it('B-MAP-2 movement points are spent: marsh costs 3 for a spear', () => {
    let s = mk([{ id: 'sp', col: 2, row: 5 }, { id: 'e', side: 'defender', col: 12, row: 5 }])
    s = setTerrain(s, 3, 5, 'marsh')
    const range = query.moveRange(s, 'sp')
    const h = H(3, 5)
    expect(range.find((m) => m.q === h.q && m.r === h.r)!.cost).toBe(3)
    const far = H(4, 5) // only reachable around or through: 4 points = marsh 3 + 1
    expect(range.find((m) => m.q === far.q && m.r === far.r)!.cost).toBeLessThanOrEqual(4)
  })
  it('B-MAP-2 hill, ford, marsh, forest hexes report their defence through hexAt', () => {
    let s = mk([{ id: 'sp', col: 2, row: 5 }, { id: 'e', side: 'defender', col: 12, row: 5 }])
    for (const [t, d] of [['forest', 0.8], ['hill', 0.85], ['ford', 1.15], ['marsh', 1.1]] as const) {
      s = setTerrain(s, 4, 4, t)
      const h = H(4, 4)
      expect(query.hexAt(s, h.q, h.r)!.defence).toBe(d)
    }
  })
  it('B-MAP-2 an unbroken gate is impassable and a broken one costs 1', () => {
    const s = mk([{ id: 'sp', col: 9, row: 5 }, { id: 'e', side: 'defender', col: 12, row: 5 }])
    const g = H(WALL_COL, 5)
    expect(query.hexAt(s, g.q, g.r)!.passable).toBe(false)
    const b = structuredClone(s)
    b.hexes[5 * 15 + WALL_COL]!.gateHp = 0
    expect(query.hexAt(b, g.q, g.r)!.moveCost).toEqual({ spear: 1, cavalry: 1, archer: 1 })
    expect(query.moveRange(b, 'sp').some((m) => m.q === g.q && m.r === g.r)).toBe(true)
  })
})

describe('B-MAP-3 generation', () => {
  const find = (terrain: RoadTerrain, seed: number) => generateField({ seed, terrain, walls: 50 })
  const count = (cells: ReturnType<typeof find>, t: string, from = 0, to = 14): number => {
    let n = 0
    cells.forEach((c, i) => { const col = i % 15; if (c.terrain === t && col >= from && col <= to) n++ })
    return n
  }
  it('B-MAP-3 is deterministic for a setup', () => {
    for (const t of TERRAINS) expect(find(t, 99)).toEqual(find(t, 99))
    expect(find('plain', 1)).not.toEqual(find('plain', 2))
  })
  it('B-MAP-3 the city: wall line on column 10 with a gate per ~4 rows, town behind, one keep at column 13 mid row', () => {
    for (const t of TERRAINS) {
      const f = find(t, 5)
      const gates: number[] = []
      for (let row = 0; row < 11; row++) {
        const c = f[row * 15 + WALL_COL]!
        expect(['wall', 'gate']).toContain(c.terrain)
        if (c.terrain === 'gate') gates.push(row)
        for (let col = 11; col < 15; col++) expect(f[row * 15 + col]!.terrain).toBe(col === KEEP_COL && row === KEEP_ROW ? 'keep' : 'town')
      }
      expect(gates).toEqual([...GATE_ROWS])
      expect(gates.length).toBeGreaterThanOrEqual(2)
      expect(count(f, 'keep')).toBe(1)
    }
  })
  it('B-MAP-3 gate HP is 100 + walls * 2', () => {
    const f = generateField({ seed: 3, terrain: 'plain', walls: 80 })
    expect(f[1 * 15 + WALL_COL]!.gateHp).toBe(260)
    expect(f[1 * 15 + WALL_COL]!.gateMax).toBe(260)
    const s = createBattle(sampleSetup({ seed: 3, walls: 35 }))
    expect(query.gateHp(s).map((g) => g.hp)).toEqual([170, 170, 170])
  })
  it('B-MAP-3 plain: plains, grass and scattered forest, no mountain or river', () => {
    for (let seed = 0; seed < 30; seed++) {
      const f = find('plain', seed)
      expect(count(f, 'mountain') + count(f, 'river')).toBe(0)
      expect(count(f, 'plain', 0, 9) + count(f, 'grass', 0, 9) + count(f, 'road', 0, 9)).toBeGreaterThan(60)
    }
  })
  it('B-MAP-3 hills have hill bands; marsh has marsh patches; forest is a forest majority', () => {
    let hills = 0
    let marsh = 0
    for (let seed = 0; seed < 30; seed++) {
      hills += count(find('hills', seed), 'hill')
      marsh += count(find('marsh', seed), 'marsh')
      const fo = find('forest', seed)
      expect(count(fo, 'forest')).toBeGreaterThan(count(fo, 'plain', 0, 9) + count(fo, 'grass', 0, 9) - 20)
    }
    expect(hills / 30).toBeGreaterThan(8)
    expect(marsh / 30).toBeGreaterThan(4)
  })
  it('B-MAP-3 mountain edges leave 2-3 passes through the band', () => {
    let seen = 0
    for (let seed = 0; seed < 30; seed++) {
      const f = find('mountain', seed)
      expect(count(f, 'mountain')).toBeGreaterThan(10)
      // some column of cols 4..6 is a mountain wall with 2-3 passes
      let found = false
      for (let col = 4; col <= 6; col++) {
        const rows = [...Array(11).keys()].filter((row) => f[row * 15 + col]!.terrain !== 'mountain')
        const mt = 11 - rows.length
        if (mt >= 7 && rows.length >= 2 && rows.length <= 4) found = true
      }
      if (found) seen++
    }
    expect(seen).toBeGreaterThan(20)
  })
  it('B-MAP-3 river crosses the middle with 2-3 fords', () => {
    for (let seed = 0; seed < 30; seed++) {
      const f = find('river', seed)
      let ok = false
      for (let col = 4; col <= 6; col++) {
        const fords = [...Array(11).keys()].filter((row) => f[row * 15 + col]!.terrain === 'ford').length
        const rivers = [...Array(11).keys()].filter((row) => f[row * 15 + col]!.terrain === 'river').length
        if (fords >= 2 && fords <= 3 && fords + rivers === 11) ok = true
      }
      expect(ok).toBe(true)
    }
  })
  it('B-MAP-3 deployment: attackers in columns 0-2, defenders in columns 11-14, one unit per hex', () => {
    for (let seed = 1; seed < 40; seed++) {
      const s = createBattle(sampleSetup({ seed }))
      const seen = new Set<string>()
      for (const u of s.units) {
        const col = axialToOffset(u.q, u.r).col
        if (u.side === 'attacker') expect(ATTACKER_COLS).toContain(col)
        else expect(DEFENDER_COLS).toContain(col)
        const k = `${u.q},${u.r}`
        expect(seen.has(k)).toBe(false)
        seen.add(k)
        expect(s.hexes[hexIndex(u.q, u.r)]!.terrain).not.toBe('keep')
      }
    }
  })
})

describe('B-MAP-4 every gate is reachable', () => {
  it('B-MAP-4 500 seeds x every terrain leave a passable path from the deploy zone to every gate', () => {
    for (const terrain of TERRAINS) {
      for (let seed = 0; seed < 500; seed++) {
        const f = generateField({ seed: seed * 2654435761, terrain, walls: 40 })
        const passable = (i: number): boolean => !!TERRAIN[f[i]!.terrain].cost
        // flood from the first deploy hex, outside the wall only
        const start = 0 * 15 + 0
        const seen = new Set<number>([start])
        const stack = [start]
        while (stack.length) {
          const i = stack.pop()!
          const h = indexToHex(i)
          for (const n of neighbors(h.q, h.r)) {
            const j = hexIndex(n.q, n.r)
            if (j < 0 || seen.has(j) || j % 15 >= WALL_COL || !passable(j)) continue
            seen.add(j)
            stack.push(j)
          }
        }
        for (let row = 0; row < 11; row++) for (const col of ATTACKER_COLS) expect(seen.has(row * 15 + col), `${terrain}#${seed} deploy ${col},${row}`).toBe(true)
        for (const gr of GATE_ROWS) {
          const g = H(WALL_COL, gr)
          const ok = neighbors(g.q, g.r).some((n) => {
            const j = hexIndex(n.q, n.r)
            return j >= 0 && seen.has(j)
          })
          expect(ok, `${terrain}#${seed} gate row ${gr}`).toBe(true)
        }
      }
    }
  })
})
void doStep
