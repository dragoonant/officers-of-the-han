import { describe, expect, it } from 'vitest'
import { createBattle, legalActions, query, step } from '../../../src/battle'
import { nextFloat } from '../../../src/shared/rng'
import { H, activate, doStep, mk, setTerrain, unit } from './helpers'

// A = .6 WAR + .4 LDR + .3 training + 20 ; D = .7 LDR + .3 WAR + .3 training + 20 (training 60 -> 18)
const A = (war: number, ldr: number, tr = 60): number => 0.6 * war + 0.4 * ldr + 0.3 * tr + 20
const D = (war: number, ldr: number, tr = 60): number => 0.7 * ldr + 0.3 * war + 0.3 * tr + 20

function duelPair(over: Partial<Parameters<typeof mk>[0][number]> = {}, tgt: Partial<Parameters<typeof mk>[0][number]> = {}) {
  return mk([
    { id: 'att', col: 5, row: 5, war: 80, ldr: 60, ...over },
    { id: 'def', side: 'defender', col: 6, row: 5, war: 50, ldr: 70, ...tgt },
  ])
}
const rollOf = (rng: number[]): number => 0.9 + 0.2 * nextFloat([...rng] as [number, number, number, number])

describe('B-UNIT-5 morale', () => {
  it('B-UNIT-5 morale starts at 40 + training / 2', () => {
    const s = mk([{ id: 'a', col: 5, row: 5 }, { id: 'd', side: 'defender', col: 12, row: 5 }], { training: [60, 41] })
    expect(unit(s, 'a').morale).toBe(70)
    expect(unit(s, 'd').morale).toBe(60) // floor(40 + 20.5)
    const s2 = createBattle(structuredClone(s.setup))
    expect(s2.units.every((u) => u.morale === (u.side === 'attacker' ? 70 : 60))).toBe(true)
  })
})

describe('B-UNIT-2 troop types', () => {
  it('B-UNIT-2 movement points are spear 4, cavalry 6, archer 4', () => {
    for (const [type, mp] of [['spear', 4], ['cavalry', 6], ['archer', 4]] as const) {
      const s = mk([{ id: 'a', col: 2, row: 5, type }, { id: 'd', side: 'defender', col: 12, row: 5 }])
      const far = Math.max(...query.moveRange(s, 'a').map((m) => m.cost))
      expect(far).toBe(mp)
      expect(query.unitView(s, 'a')!.movePoints).toBe(mp)
    }
  })
  it('B-UNIT-2 archers attack at range 1-2 and 3 from a hill; spear and cavalry only at 1', () => {
    const base = (type: 'spear' | 'archer' | 'cavalry', dcol: number) =>
      mk([{ id: 'a', col: 3, row: 5, type }, { id: 'd', side: 'defender', col: dcol, row: 5 }])
    expect(query.attackTargets(base('archer', 4), 'a').map((t) => t.range)).toEqual([1])
    expect(query.attackTargets(base('archer', 5), 'a').map((t) => t.range)).toEqual([2])
    expect(query.attackTargets(base('archer', 6), 'a')).toEqual([])
    expect(query.attackTargets(base('spear', 5), 'a')).toEqual([])
    expect(query.attackTargets(base('cavalry', 5), 'a')).toEqual([])
    expect(query.attackTargets(base('spear', 4), 'a').length).toBe(1)
    const hill = setTerrain(base('archer', 6), 3, 5, 'hill')
    expect(query.attackTargets(hill, 'a').map((t) => t.range)).toEqual([3])
    expect(query.unitView(hill, 'a')!.range).toBe(3)
  })
})

describe('B-UNIT-3 type edge', () => {
  const pairs: [string, string, boolean][] = [
    ['spear', 'cavalry', true], ['cavalry', 'archer', true], ['archer', 'spear', true],
    ['cavalry', 'spear', false], ['archer', 'cavalry', false], ['spear', 'archer', false], ['spear', 'spear', false],
  ]
  for (const [a, d, edge] of pairs) {
    it(`B-UNIT-3 type edge ${a} vs ${d} ${edge ? 'x1.25' : 'none'}`, () => {
      const s = mk([
        { id: 'att', col: 5, row: 5, type: a as 'spear' }, { id: 'def', side: 'defender', col: 6, row: 5, type: d as 'spear' },
      ])
      const p = query.attackPreview(s, 'att', 'def')!
      expect(p.multipliers.find((m) => m.name === 'Type edge')?.value).toBe(edge ? 1.25 : undefined)
    })
  }
})

describe('B-UNIT-4 aptitude', () => {
  it('B-UNIT-4 A x1.10, B x1.00, C x0.85 on damage dealt, and divides damage taken', () => {
    const val = (a: 'A' | 'B' | 'C', d: 'A' | 'B' | 'C'): number => {
      const s = duelPair({ apt: a }, { apt: d })
      return query.attackPreview(s, 'att', 'def')!.max
    }
    const b = val('B', 'B')
    expect(val('A', 'B')).toBeGreaterThanOrEqual(Math.floor(b * 1.1) - 1)
    expect(val('A', 'B')).toBeLessThanOrEqual(Math.ceil(b * 1.1) + 1)
    expect(val('C', 'B') / b).toBeCloseTo(0.85, 1)
    expect(val('B', 'A') / b).toBeCloseTo(1 / 1.1, 1)
    expect(val('B', 'C') / b).toBeCloseTo(1 / 0.85, 1)
    expect(query.unitView(duelPair({ apt: 'A' }), 'att')!.aptitude).toBe(1.1)
    expect(query.unitView(duelPair({ apt: 'C' }), 'att')!.aptitude).toBe(0.85)
  })
})

describe('B-DMG-1 damage', () => {
  it('B-DMG-1 damage = floor(troops*0.12*(A/D)*...*roll) with the roll drawn first from the battle stream', () => {
    const s = duelPair()
    const mid = 3000 * 0.12 * (A(80, 60) / D(50, 70)) * (0.75 + 70 / 200)
    const roll = rollOf(s.rng)
    const { state, events } = doStep(s, { kind: 'attack', unit: 'att', target: 'def' })
    const ev = events.find((e) => e.kind === 'attack')!
    expect(ev.kind === 'attack' && ev.damage).toBe(Math.max(1, Math.floor(mid * roll)))
    expect(unit(state, 'def').troops).toBe(3000 - Math.max(1, Math.floor(mid * roll)))
  })
  it('B-DMG-1 terrain defence multiplies the damage taken (forest 0.8)', () => {
    const open = query.attackPreview(duelPair(), 'att', 'def')!
    const forest = query.attackPreview(setTerrain(duelPair(), 6, 5, 'forest'), 'att', 'def')!
    expect(forest.max / open.max).toBeCloseTo(0.8, 1)
    expect(forest.multipliers.find((m) => m.name.startsWith('Terrain'))!.value).toBe(0.8)
  })
  it('B-DMG-1 surround adds 10% per other attacking-side unit next to the defender', () => {
    const base = query.attackPreview(duelPair(), 'att', 'def')!
    const s = mk([
      { id: 'att', col: 5, row: 5, war: 80, ldr: 60 }, { id: 'def', side: 'defender', col: 6, row: 5, war: 50, ldr: 70 },
      { id: 'f1', col: 6, row: 4 }, { id: 'f2', col: 6, row: 6 }, { id: 'f3', col: 7, row: 5 },
    ])
    const p = query.attackPreview(s, 'att', 'def')!
    expect(p.multipliers.find((m) => m.name === 'Surround')!.value).toBeCloseTo(1.3)
    expect(p.max / base.max).toBeCloseTo(1.3, 1)
  })
  it('B-DMG-1 moraleMod = 0.75 + morale / 200', () => {
    const lo = query.attackPreview(mk([{ id: 'att', col: 5, row: 5, morale: 0 }, { id: 'def', side: 'defender', col: 6, row: 5 }]), 'att', 'def')!
    const hi = query.attackPreview(mk([{ id: 'att', col: 5, row: 5, morale: 100 }, { id: 'def', side: 'defender', col: 6, row: 5 }]), 'att', 'def')!
    expect(lo.multipliers.find((m) => m.name === 'Morale')!.value).toBe(0.75)
    expect(hi.multipliers.find((m) => m.name === 'Morale')!.value).toBe(1.25)
  })
  it('B-DMG-1 cavalry momentum x1.30 after moving 3 or more hexes, melee only', () => {
    const s = mk([{ id: 'att', col: 2, row: 5, type: 'cavalry' }, { id: 'def', side: 'defender', col: 8, row: 5 }])
    const near = doStep(s, { kind: 'move', unit: 'att', ...H(3, 5) }).state // 1 hex
    expect(query.attackPreview(near, 'att', 'def')).toBeNull() // not adjacent yet
    const far = doStep(s, { kind: 'move', unit: 'att', ...H(7, 5) }).state // 5 hexes
    const p = query.attackPreview(far, 'att', 'def')!
    expect(p.multipliers.find((m) => m.name === 'Momentum')!.value).toBe(1.3)
    // moved only 2: no momentum
    const s2 = mk([{ id: 'att', col: 5, row: 5, type: 'cavalry' }, { id: 'def', side: 'defender', col: 8, row: 5 }])
    const two = doStep(s2, { kind: 'move', unit: 'att', ...H(7, 5) }).state
    expect(query.attackPreview(two, 'att', 'def')!.multipliers.some((m) => m.name === 'Momentum')).toBe(false)
    // a spear that moved far has none either
    const sp = mk([{ id: 'att', col: 2, row: 5, type: 'spear' }, { id: 'def', side: 'defender', col: 7, row: 5 }])
    const spm = doStep(sp, { kind: 'move', unit: 'att', ...H(5, 5) }).state
    expect(query.attackPreview(spm, 'att', 'def')).toBeNull()
  })
  it('B-DMG-1 oath bond x1.10 when an oath sibling is next to the defender', () => {
    const s = mk([
      { id: 'att', col: 5, row: 5, oath: ['bro'] }, { id: 'def', side: 'defender', col: 6, row: 5 }, { id: 'bro', col: 6, row: 4 },
    ])
    expect(query.attackPreview(s, 'att', 'def')!.multipliers.find((m) => m.name === 'Oath bond')!.value).toBe(1.1)
    const s2 = mk([
      { id: 'att', col: 5, row: 5, oath: ['bro'] }, { id: 'def', side: 'defender', col: 6, row: 5 }, { id: 'bro', col: 2, row: 2 },
    ])
    expect(query.attackPreview(s2, 'att', 'def')!.multipliers.some((m) => m.name === 'Oath bond')).toBe(false)
  })
  it('B-DMG-1 damage is at least 1', () => {
    const s = mk([
      { id: 'att', col: 5, row: 5, troops: 1, war: 20, ldr: 20 }, { id: 'def', side: 'defender', col: 6, row: 5, war: 100, ldr: 100, troops: 5000 },
    ])
    const p = query.attackPreview(s, 'att', 'def')!
    expect(p.min).toBe(1)
    const r = doStep(s, { kind: 'attack', unit: 'att', target: 'def' })
    expect(unit(r.state, 'def').troops).toBe(4999)
  })
  it('B-DMG-1 training enters A and D', () => {
    const lo = mk([{ id: 'att', col: 5, row: 5 }, { id: 'def', side: 'defender', col: 6, row: 5 }], { training: [20, 90] })
    const hi = mk([{ id: 'att', col: 5, row: 5 }, { id: 'def', side: 'defender', col: 6, row: 5 }], { training: [90, 20] })
    expect(query.attackPreview(hi, 'att', 'def')!.max).toBeGreaterThan(query.attackPreview(lo, 'att', 'def')!.max)
  })
})

describe('B-DMG-2 counter', () => {
  it('B-DMG-2 a melee attack is answered at x0.5 by a defender who survives', () => {
    const s = duelPair()
    const { state, events } = doStep(s, { kind: 'attack', unit: 'att', target: 'def' })
    const ev = events.find((e) => e.kind === 'attack')!
    expect(ev.kind === 'attack' && ev.counter).toBeGreaterThan(0)
    expect(unit(state, 'att').troops).toBe(3000 - (ev.kind === 'attack' ? ev.counter : 0))
    const p = query.attackPreview(s, 'att', 'def')!
    expect(p.counter).toBe(true)
    expect(ev.kind === 'attack' && ev.counter).toBeGreaterThanOrEqual(p.counterMin - 1)
    expect(ev.kind === 'attack' && ev.counter).toBeLessThanOrEqual(p.counterMax + 1)
  })
  it('B-DMG-2 no counter when the attack routs the defender', () => {
    const s = duelPair({}, { troops: 5 })
    const { state, events } = doStep(s, { kind: 'attack', unit: 'att', target: 'def' })
    expect(unit(state, 'def').routed).toBe(true)
    expect(unit(state, 'att').troops).toBe(3000)
    const ev = events.find((e) => e.kind === 'attack')!
    expect(ev.kind === 'attack' && ev.counter).toBe(0)
  })
  it('B-DMG-2 an archer shooting at range 2 is not countered; archers attacked at range 1 counter', () => {
    const s = mk([{ id: 'att', col: 5, row: 5, type: 'archer' }, { id: 'def', side: 'defender', col: 7, row: 5, type: 'archer' }])
    const r = doStep(s, { kind: 'attack', unit: 'att', target: 'def' })
    expect(unit(r.state, 'att').troops).toBe(3000)
    expect(query.attackPreview(s, 'att', 'def')!.counter).toBe(false)
    const s1 = mk([{ id: 'att', col: 5, row: 5, type: 'spear' }, { id: 'def', side: 'defender', col: 6, row: 5, type: 'archer' }])
    const r1 = doStep(s1, { kind: 'attack', unit: 'att', target: 'def' })
    expect(unit(r1.state, 'att').troops).toBeLessThan(3000)
  })
})

describe('B-DMG-3 morale', () => {
  it('B-DMG-3 the target loses ceil(25 * damage / troops_before) morale; the attacker gains 3', () => {
    const s = duelPair({ morale: 50 }, { morale: 80 })
    const { state, events } = doStep(s, { kind: 'attack', unit: 'att', target: 'def' })
    const ev = events.find((e) => e.kind === 'attack')!
    const dmg = ev.kind === 'attack' ? ev.damage : 0
    const counter = ev.kind === 'attack' ? ev.counter : 0
    expect(unit(state, 'def').morale).toBe(80 - Math.ceil((25 * dmg) / 3000))
    expect(unit(state, 'att').morale).toBe(50 + 3 - Math.ceil((25 * counter) / 3000))
  })
  it('B-DMG-3 morale never leaves 0..100', () => {
    const s = duelPair({ morale: 99 }, { morale: 1 })
    const { state } = doStep(s, { kind: 'attack', unit: 'att', target: 'def' })
    expect(unit(state, 'att').morale).toBeLessThanOrEqual(100)
    expect(unit(state, 'def').morale).toBeGreaterThanOrEqual(0)
  })
})

describe('B-DMG-4 preview', () => {
  it('B-DMG-4 shows min and max damage (roll 0.9 and 1.1), the counter range and every multiplier', () => {
    const s = duelPair()
    const p = query.attackPreview(s, 'att', 'def')!
    const mid = 3000 * 0.12 * (A(80, 60) / D(50, 70)) * 1.1
    expect(p.min).toBe(Math.floor(mid * 0.9))
    expect(p.max).toBe(Math.floor(mid * 1.1))
    expect(p.counterMin).toBeGreaterThan(0)
    expect(p.counterMax).toBeGreaterThanOrEqual(p.counterMin)
    expect(p.multipliers.map((m) => m.name)).toContain('Morale')
    expect(p.multipliers.map((m) => m.name)).toContain('Stat ratio')
    expect(p.range).toBe(1)
    expect(p.kills).toBe(false)
  })
  it('B-DMG-4 previews never touch the RNG or the state', () => {
    const s = duelPair()
    const before = JSON.stringify(s)
    query.attackPreview(s, 'att', 'def')
    query.moveRange(s, 'att')
    query.tacticTargets(s, 'att', 'fire')
    expect(JSON.stringify(s)).toBe(before)
  })
  it('B-DMG-4 the preview can be asked from a hex the unit could move to', () => {
    const s = mk([{ id: 'att', col: 3, row: 5, type: 'cavalry' }, { id: 'def', side: 'defender', col: 8, row: 5 }])
    const p = query.attackPreview(s, 'att', 'def', H(7, 5))!
    expect(p.multipliers.some((m) => m.name === 'Momentum')).toBe(true)
    expect(query.attackPreview(s, 'att', 'def')).toBeNull()
  })
})

describe('B-TURN-2 move then one action', () => {
  it('B-TURN-2 move and then attack; the attack ends the turn', () => {
    const s = mk([{ id: 'att', col: 3, row: 5 }, { id: 'def', side: 'defender', col: 6, row: 5 }])
    const m = doStep(s, { kind: 'move', unit: 'att', ...H(5, 5) })
    expect(m.state.active).toBe('att')
    const a = doStep(m.state, { kind: 'attack', unit: 'att', target: 'def' })
    expect(a.state.active).toBe('def')
  })
  it('B-TURN-2 a unit may act without moving', () => {
    const s = mk([{ id: 'att', col: 5, row: 5 }, { id: 'def', side: 'defender', col: 6, row: 5 }])
    expect(legalActions(s).some((a) => a.kind === 'attack')).toBe(true)
    expect(doStep(s, { kind: 'wait', unit: 'att' }).state.active).toBe('def')
  })
  it('B-TURN-2 only one move per turn; undoMove restores the hex', () => {
    const s = mk([{ id: 'att', col: 3, row: 5 }, { id: 'def', side: 'defender', col: 12, row: 5 }])
    const m = doStep(s, { kind: 'move', unit: 'att', ...H(4, 5) }).state
    const again = step(m, { kind: 'move', unit: 'att', ...H(5, 5) })
    expect(again.ok).toBe(false)
    expect(!again.ok && again.code).toBe('already-moved')
    expect(legalActions(m).some((a) => a.kind === 'undoMove')).toBe(true)
    const u = doStep(m, { kind: 'undoMove', unit: 'att' }).state
    expect(unit(u, 'att').q).toBe(H(3, 5).q)
    expect(unit(u, 'att').moved).toBe(false)
    const none = step(s, { kind: 'undoMove', unit: 'att' })
    expect(none.ok).toBe(false)
  })
  it('B-TURN-2 a unit that is not active cannot act', () => {
    const s = mk([{ id: 'att', col: 3, row: 5 }, { id: 'def', side: 'defender', col: 12, row: 5 }])
    const r = step(s, { kind: 'wait', unit: 'def' })
    expect(!r.ok && r.code).toBe('not-active')
  })
})

describe('B-TURN-3 zone of control', () => {
  const corridor = (enemy = true, ally = false) => {
    let s = mk([
      { id: 'att', col: 0, row: 5, type: 'cavalry' },
      { id: 'def', side: 'defender', col: enemy ? 4 : 12, row: enemy ? 4 : 5 },
      ...(ally ? [{ id: 'ally', col: 2, row: 5 }] : []),
    ])
    for (let row = 0; row < 11; row++) if (row !== 5) for (let col = 1; col < 9; col++) s = setTerrain(s, col, row, 'mountain')
    s = setTerrain(s, 4, 4, 'plain')
    return s
  }
  const reachable = (s: ReturnType<typeof corridor>, col: number, row: number): boolean => {
    const h = H(col, row)
    return query.moveRange(s, 'att').some((m) => m.q === h.q && m.r === h.r)
  }
  it('B-TURN-3 a unit that enters a hex next to an enemy must stop', () => {
    const s = corridor()
    expect(reachable(s, 3, 5)).toBe(true) // adjacent to (4,4): stop here
    expect(reachable(s, 5, 5)).toBe(false) // would have to pass through the zone
    const free = corridor(false)
    expect(reachable(free, 5, 5)).toBe(true)
  })
  it('B-TURN-3 units cannot pass through other units', () => {
    const s = corridor(false, true)
    expect(reachable(s, 1, 5)).toBe(true)
    expect(reachable(s, 2, 5)).toBe(false)
    expect(reachable(s, 3, 5)).toBe(false)
    const r = step(s, { kind: 'move', unit: 'att', ...H(3, 5) })
    expect(r.ok).toBe(false)
  })
})

describe('B-TURN-1 initiative', () => {
  it('B-TURN-1 order is LDR + 20 for cavalry, highest first', () => {
    const s = mk([
      { id: 'a1', col: 1, row: 1, ldr: 60 }, { id: 'a2', col: 1, row: 3, ldr: 55, type: 'cavalry' },
      { id: 'd1', side: 'defender', col: 12, row: 1, ldr: 90 }, { id: 'd2', side: 'defender', col: 12, row: 3, ldr: 70, type: 'cavalry' },
    ])
    const fresh = createBattle(s.setup)
    expect(fresh.order.slice(0, 2).sort()).toEqual(['d1', 'd2']) // 90 and 70 + 20 tie
    expect(fresh.order.slice(2)).toEqual(['a2', 'a1']) // 55 + 20 = 75, then 60
  })
  it('B-TURN-1 ties are broken by a seeded shuffle drawn once a day', () => {
    const orders = new Set<string>()
    for (let seed = 1; seed < 30; seed++) {
      const s = mk([
        { id: 'a1', col: 1, row: 1, ldr: 60 }, { id: 'a2', col: 1, row: 3, ldr: 60 },
        { id: 'd1', side: 'defender', col: 12, row: 1, ldr: 60 }, { id: 'd2', side: 'defender', col: 12, row: 3, ldr: 60 },
      ], { seed })
      const again = createBattle(s.setup)
      expect(again.order).toEqual(createBattle(s.setup).order) // deterministic
      orders.add(again.order.join())
    }
    expect(orders.size).toBeGreaterThan(5)
  })
  it('B-TURN-1 each unit acts once a day, then a new day starts with a fresh order', () => {
    let s = mk([
      { id: 'a1', col: 1, row: 1 }, { id: 'd1', side: 'defender', col: 12, row: 1 }, { id: 'a2', col: 1, row: 3 },
    ])
    s = createBattle(s.setup)
    const seen: string[] = []
    while (s.day === 1) {
      seen.push(s.active!)
      s = doStep(s, { kind: 'wait', unit: s.active! }).state
    }
    expect(seen.sort()).toEqual(['a1', 'a2', 'd1'])
    expect(s.day).toBe(2)
    expect(query.initiative(s).length).toBe(3)
    expect(query.initiative(s)[0]).toBe(s.active)
  })
})

describe('B-TURN-5 who decides', () => {
  it('B-TURN-5 the player controls their own unit, and every unit of their side when they are the commander', () => {
    const units = [
      { id: 'p', col: 1, row: 1, commander: true }, { id: 'x', col: 1, row: 3 },
      { id: 'd1', side: 'defender' as const, col: 12, row: 1, commander: true }, { id: 'd2', side: 'defender' as const, col: 12, row: 3 },
    ]
    const cmd = mk(units, { playerControls: ['p'] })
    expect(query.isPlayerUnit(cmd, 'p')).toBe(true)
    expect(query.isPlayerUnit(cmd, 'x')).toBe(true)
    expect(query.isPlayerUnit(cmd, 'd1')).toBe(false)
    const sub = mk(units, { playerControls: ['x'] })
    expect(query.isPlayerUnit(sub, 'x')).toBe(true)
    expect(query.isPlayerUnit(sub, 'p')).toBe(false)
    expect(sub.playerSide).toBe('attacker')
    expect(mk(units).playerSide).toBeNull()
  })
})
void activate
