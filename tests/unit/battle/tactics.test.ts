import { describe, expect, it } from 'vitest'
import { legalActions, query, step, type BattleAction, type BattleState } from '../../../src/battle'
import { H, doStep, mk, setTerrain, unit, type U } from './helpers'

/** Try seeds until `pred` accepts the stepped result; returns the first hit. */
function firstSeed<T>(build: (seed: number) => BattleState, act: BattleAction | ((s: BattleState) => BattleAction), pred: (r: ReturnType<typeof doStep>) => boolean): { seed: number; s0: BattleState; r: ReturnType<typeof doStep> } {
  for (let seed = 1; seed < 400; seed++) {
    const s0 = build(seed)
    const r = doStep(s0, typeof act === 'function' ? act(s0) : act)
    if (pred(r)) return { seed, s0, r }
  }
  throw new Error('no seed')
}
const ok = (r: ReturnType<typeof doStep>): boolean => r.events.some((e) => e.kind === 'tactic' && e.success)

describe('B-TAC-1 known tactics', () => {
  it('B-TAC-1 tactics come from stats: Fire INT 60, Confuse INT 75, Taunt WAR 75, Rally LDR 70, Volley archers LDR 50', () => {
    const k = (u: Partial<U>): string[] => query.knownTactics(mk([{ col: 3, row: 3, ...u, id: 'x' }, { id: 'e', side: 'defender', col: 12, row: 5 }]), 'x')
    expect(k({ int: 59, war: 74, ldr: 49 })).toEqual([])
    expect(k({ int: 60, war: 74, ldr: 49 })).toEqual(['fire'])
    expect(k({ int: 75, war: 74, ldr: 49 })).toEqual(['fire', 'confuse'])
    expect(k({ int: 10, war: 75, ldr: 49 })).toEqual(['taunt'])
    expect(k({ int: 10, war: 10, ldr: 70 })).toEqual(['rally'])
    expect(k({ int: 10, war: 10, ldr: 50, type: 'archer' })).toEqual(['volley'])
    expect(k({ int: 10, war: 10, ldr: 50, type: 'spear' })).toEqual([])
    expect(k({ int: 10, war: 10, ldr: 49, type: 'archer' })).toEqual([])
  })
  it('B-TAC-1 a unit cannot use a tactic it does not know', () => {
    const s = mk([{ id: 'x', col: 4, row: 5, int: 10, war: 10, ldr: 10 }, { id: 'e', side: 'defender', col: 5, row: 5 }])
    const r = step(s, { kind: 'tactic', unit: 'x', tactic: 'fire', ...H(5, 5) })
    expect(r.ok).toBe(false)
    expect(legalActions(s).some((a) => a.kind === 'tactic')).toBe(false)
  })
})

describe('B-TAC-2 success chance', () => {
  const build = (extra: Partial<U> = {}, eExtra: Partial<U> = {}) => (seed: number) =>
    mk([{ id: 'x', col: 3, row: 5, int: 80, war: 30, ldr: 30, ...extra }, { id: 'e', side: 'defender', col: 5, row: 5, int: 70, ...eExtra }], { seed })
  it('B-TAC-2 chance = clamp(50 + INT_user - INT_target, 10, 95) shown in the preview', () => {
    const p = (a: number, b: number) => query.tacticPreview(build({ int: a }, { int: b })(1), 'x', 'confuse', H(5, 5).q, H(5, 5).r)!.chance
    expect(p(80, 70)).toBe(60)
    expect(p(80, 20)).toBe(95)
    expect(p(80, 99)).toBe(31)
    expect(p(75, 99)).toBe(26)
    const lo = query.tacticPreview(build({ int: 75 }, { int: 100 })(1), 'x', 'confuse', H(5, 5).q, H(5, 5).r)!.chance
    expect(lo).toBe(25)
  })
  it('B-TAC-2 Fire on an empty hex uses clamp(40 + INT / 2, 10, 95)', () => {
    const s = build({ int: 80 })(1)
    const t = query.tacticTargets(s, 'x', 'fire').find((x) => x.unit === null)!
    expect(t.chance).toBe(80)
    const s2 = build({ int: 60 })(1)
    expect(query.tacticTargets(s2, 'x', 'fire').find((x) => x.unit === null)!.chance).toBe(70)
  })
  it('B-TAC-2 the roll follows the chance (real step, 300 seeds)', () => {
    let wins = 0
    const n = 300
    for (let seed = 1; seed <= n; seed++) {
      const s = build({ int: 80 }, { int: 70 })(seed) // 60%
      if (ok(doStep(s, { kind: 'tactic', unit: 'x', tactic: 'confuse', ...H(5, 5) }))) wins++
    }
    expect(wins / n).toBeGreaterThan(0.5)
    expect(wins / n).toBeLessThan(0.7)
  })
  it('B-TAC-2 a successful tactic gives the user +5 morale; a failure does not', () => {
    const win = firstSeed(build({ int: 80 }, { int: 70 }), { kind: 'tactic', unit: 'x', tactic: 'confuse', ...H(5, 5) }, ok)
    expect(unit(win.r.state, 'x').morale).toBe(unit(win.s0, 'x').morale + 5)
    const lose = firstSeed(build({ int: 80 }, { int: 70 }), { kind: 'tactic', unit: 'x', tactic: 'confuse', ...H(5, 5) }, (r) => !ok(r))
    expect(unit(lose.r.state, 'x').morale).toBe(unit(lose.s0, 'x').morale)
    expect(lose.r.state.active).not.toBe('x') // the turn ended anyway
  })
})

describe('B-TAC-FIRE', () => {
  const field = (seed: number, e: Partial<U> = {}) => mk([{ id: 'x', col: 3, row: 5, int: 90, war: 30, ldr: 30 }, { id: 'e', side: 'defender', col: 5, row: 5, ...e }], { seed })
  it('B-TAC-FIRE targets burnable hexes within range 2 and never the user\'s side', () => {
    let s = field(1)
    s = setTerrain(s, 4, 3, 'hill')
    s = setTerrain(s, 4, 6, 'forest')
    const t = query.tacticTargets(s, 'x', 'fire')
    const key = (q: number, r: number) => t.some((x) => x.q === q && x.r === r)
    expect(key(H(4, 3).q, H(4, 3).r)).toBe(false) // hill does not burn
    expect(key(H(4, 6).q, H(4, 6).r)).toBe(true)
    expect(key(H(3, 5).q, H(3, 5).r)).toBe(false) // own hex
    const far = query.tacticTargets(field(1), 'x', 'fire').some((x) => x.q === H(8, 5).q && x.r === H(8, 5).r)
    expect(far).toBe(false)
  })
  it('B-TAC-FIRE on success the hex burns for 2 days; a unit in it loses 10% troops and 10 morale at the start of its turn', () => {
    const { r } = firstSeed((seed) => field(seed), { kind: 'tactic', unit: 'x', tactic: 'fire', ...H(5, 5) }, ok)
    const idx = 5 * 15 + 5
    expect(r.state.hexes[idx]!.burn).toBe(2)
    // the enemy is next in the order: its turn started in the burning hex in the same step
    const burn = r.events.find((e) => e.kind === 'burn')
    expect(burn && burn.kind === 'burn' && burn.troops).toBe(300)
    expect(unit(r.state, 'e').troops).toBe(2700)
    expect(unit(r.state, 'e').morale).toBe(60)
  })
  it('B-TAC-FIRE each day end a burning hex lights each burnable neighbour with chance 25%', () => {
    let lit = 0
    let trials = 0
    for (let seed = 1; seed <= 200; seed++) {
      let s = field(seed)
      s = structuredClone(s)
      s.hexes[5 * 15 + 5] = { ...s.hexes[5 * 15 + 5]!, burn: 2 }
      // x at (3,5) waits, e at (5,5) is in the fire: it takes damage but we only count ignitions
      s = doStep(s, { kind: 'wait', unit: 'x' }).state
      if (s.active === 'e' || s.day === 1) s = doStep(s, { kind: 'wait', unit: s.active! }).state
      trials += 6
      for (const [c, r] of [[6, 5], [4, 5], [5, 4], [5, 6], [4, 4], [4, 6]]) if (s.hexes[r! * 15 + c!]!.burn > 0) lit++
    }
    expect(lit / trials).toBeGreaterThan(0.15)
    expect(lit / trials).toBeLessThan(0.35)
  })
  it('B-TAC-FIRE fire does not spread to hexes that do not burn, and a hex that has burned 2 days becomes ash', () => {
    let s = field(3)
    s = structuredClone(s)
    s.hexes[5 * 15 + 5] = { ...s.hexes[5 * 15 + 5]!, burn: 2 }
    for (const [c, r] of [[6, 5], [4, 5], [5, 4], [5, 6], [4, 4], [4, 6]]) s.hexes[r! * 15 + c!] = { terrain: 'hill', burn: 0, burnBy: null, gateHp: 0, gateMax: 0 }
    for (let i = 0; i < 6 && s.day < 3; i++) s = doStep(s, { kind: 'wait', unit: s.active! }).state
    expect(s.day).toBe(3)
    expect(s.hexes[5 * 15 + 5]!.terrain).toBe('ash')
    expect(s.hexes[5 * 15 + 5]!.burn).toBe(0)
    for (const [c, r] of [[6, 5], [4, 5], [5, 4], [5, 6], [4, 4], [4, 6]]) expect(s.hexes[r! * 15 + c!]!.burn).toBe(0)
    // ash is open ground and does not burn again
    expect(query.hexAt(s, H(5, 5).q, H(5, 5).r)!.burnable).toBe(false)
  })
})

describe('B-TAC-CONFUSE and B-TURN-4', () => {
  it('B-TAC-CONFUSE the target skips its next turn', () => {
    const build = (seed: number) => mk([
      { id: 'x', col: 3, row: 5, int: 95, war: 30, ldr: 90 }, { id: 'e', side: 'defender', col: 5, row: 5, int: 20, ldr: 60 },
      { id: 'y', col: 1, row: 1, ldr: 10 },
    ], { seed })
    const { r } = firstSeed(build, { kind: 'tactic', unit: 'x', tactic: 'confuse', ...H(5, 5) }, ok)
    expect(unit(r.state, 'e').confused).toBe(false)
    expect(r.events.some((e) => e.kind === 'confusedSkip' && e.unit === 'e')).toBe(true)
    expect(r.events.some((e) => e.kind === 'turnStart' && e.unit === 'e')).toBe(false)
  })
  it('B-TAC-CONFUSE only unconfused enemies within range 2 are targets', () => {
    const s = mk([{ id: 'x', col: 3, row: 5, int: 90 }, { id: 'e', side: 'defender', col: 5, row: 5 }, { id: 'far', side: 'defender', col: 9, row: 5 }])
    expect(query.tacticTargets(s, 'x', 'confuse').map((t) => t.unit)).toEqual(['e'])
    const c = structuredClone(s)
    unit(c, 'e').confused = true
    expect(query.tacticTargets(c, 'x', 'confuse')).toEqual([])
  })
  it('B-TURN-4 a confused unit skips its turn and recovers', () => {
    const s = mk([{ id: 'a', col: 3, row: 5 }, { id: 'e', side: 'defender', col: 8, row: 5 }])
    const c = structuredClone(s)
    unit(c, 'e').confused = true
    const r = doStep(c, { kind: 'wait', unit: 'a' })
    expect(r.events.some((e) => e.kind === 'confusedSkip')).toBe(true)
    expect(unit(r.state, 'e').confused).toBe(false)
  })
})

describe('B-TAC-TAUNT and B-TURN-4', () => {
  const taunted = (eCol: number) => {
    const s = mk([{ id: 'x', col: 3, row: 5, war: 90, int: 10 }, { id: 'e', side: 'defender', col: eCol, row: 5 }, { id: 'z', col: 1, row: 1 }])
    const t = structuredClone(s)
    unit(t, 'e').taunted = 'x'
    return t
  }
  it('B-TAC-TAUNT success marks the target taunted for its next turn', () => {
    const build = (seed: number) => mk([{ id: 'x', col: 3, row: 5, war: 90, int: 95, ldr: 90 }, { id: 'e', side: 'defender', col: 5, row: 5, int: 20 }], { seed })
    const { s0 } = firstSeed(build, { kind: 'tactic', unit: 'x', tactic: 'taunt', ...H(5, 5) }, (r) => ok(r))
    expect(query.tacticTargets(s0, 'x', 'taunt').length).toBe(1)
    const found = firstSeed(build, { kind: 'tactic', unit: 'x', tactic: 'taunt', ...H(5, 5) }, (r) => ok(r) && unit(r.state, 'e') !== undefined)
    // after the success the taunted unit is active with an attack on x as its only action
    const la = legalActions(found.r.state)
    expect(found.r.state.active).toBe('e')
    expect(unit(found.r.state, 'e').taunted).toBe('x')
    expect(la.filter((a) => a.kind !== 'retreat').every((a) => a.kind === 'move' || (a.kind === 'attack' && a.target === 'x'))).toBe(true)
  })
  it('B-TURN-4 a taunted unit that can attack the taunter must (no wait, no other target)', () => {
    const s = taunted(4) // adjacent
    const adj = structuredClone(s)
    adj.order = ['e', 'x', 'z']
    adj.cursor = 0
    adj.active = 'e'
    expect(legalActions(adj).filter((a) => a.kind !== 'retreat')).toEqual([{ kind: 'attack', unit: 'e', target: 'x' }])
    expect(step(adj, { kind: 'wait', unit: 'e' }).ok).toBe(false)
  })
  it('B-TURN-4 a taunted unit out of reach must end its move closer to the taunter', () => {
    const s = taunted(9)
    const adj = structuredClone(s)
    adj.order = ['e', 'x', 'z']
    adj.cursor = 0
    adj.active = 'e'
    const moves = legalActions(adj).filter((a) => a.kind === 'move')
    expect(moves.length).toBeGreaterThan(0)
    for (const m of moves) {
      if (m.kind !== 'move') continue
      const d = (Math.abs(m.q - unit(adj, 'x').q) + Math.abs(m.r - unit(adj, 'x').r) + Math.abs(m.q + m.r - unit(adj, 'x').q - unit(adj, 'x').r)) / 2
      expect(d).toBeLessThan(6) // the taunter is 6 hexes away
    }
  })
  it('B-TURN-4 the taunt ends after the unit\'s turn', () => {
    const adj = taunted(4)
    adj.order = ['e', 'x', 'z']
    adj.cursor = 0
    adj.active = 'e'
    const r = doStep(adj, { kind: 'attack', unit: 'e', target: 'x' })
    expect(unit(r.state, 'e').taunted).toBeNull()
  })
})

describe('B-TAC-RALLY', () => {
  it('B-TAC-RALLY the user and adjacent allies gain +15 morale (max 100), always succeeds, draws nothing', () => {
    const s = mk([
      { id: 'x', col: 4, row: 5, ldr: 80, morale: 50 }, { id: 'near', col: 5, row: 5, morale: 40 }, { id: 'full', col: 3, row: 5, morale: 95 },
      { id: 'far', col: 1, row: 1, morale: 40 }, { id: 'e', side: 'defender', col: 12, row: 5 },
    ])
    const t = query.tacticTargets(s, 'x', 'rally')
    expect(t).toEqual([{ q: unit(s, 'x').q, r: unit(s, 'x').r, chance: 100, unit: 'x' }])
    const r = doStep(s, { kind: 'tactic', unit: 'x', tactic: 'rally', q: t[0]!.q, r: t[0]!.r })
    expect(unit(r.state, 'x').morale).toBe(70) // +15 +5 for a successful tactic
    expect(unit(r.state, 'near').morale).toBe(55)
    expect(unit(r.state, 'full').morale).toBe(100)
    expect(unit(r.state, 'far').morale).toBe(40)
    expect(r.state.rng).toEqual(s.rng)
  })
})

describe('B-TAC-VOLLEY', () => {
  it('B-TAC-VOLLEY hits every enemy in the target hex and its neighbours at x0.6 with no counter', () => {
    const s = mk([
      { id: 'x', col: 3, row: 5, type: 'archer', ldr: 60 }, { id: 'f', col: 4, row: 4 },
      { id: 'e1', side: 'defender', col: 5, row: 5 }, { id: 'e2', side: 'defender', col: 6, row: 5 }, { id: 'e3', side: 'defender', col: 9, row: 5 },
    ])
    const t = query.tacticTargets(s, 'x', 'volley')
    expect(t.some((h) => h.q === H(5, 5).q && h.r === H(5, 5).r)).toBe(true)
    const p = query.tacticPreview(s, 'x', 'volley', H(5, 5).q, H(5, 5).r)!
    expect(p.hits.map((h) => h.unit)).toEqual(['e1', 'e2'])
    const normal = query.attackPreview(s, 'x', 'e1')!
    expect(p.hits[0]!.max / normal.max).toBeCloseTo(0.6, 1)
    const r = doStep(s, { kind: 'tactic', unit: 'x', tactic: 'volley', ...H(5, 5) })
    expect(unit(r.state, 'e1').troops).toBeLessThan(3000)
    expect(unit(r.state, 'e2').troops).toBeLessThan(3000)
    expect(unit(r.state, 'e3').troops).toBe(3000)
    expect(unit(r.state, 'f').troops).toBe(3000)
    expect(unit(r.state, 'x').troops).toBe(3000) // no counter
    expect(unit(r.state, 'e1').troops).toBeGreaterThanOrEqual(3000 - p.hits[0]!.max)
    expect(unit(r.state, 'e1').troops).toBeLessThanOrEqual(3000 - p.hits[0]!.min)
  })
  it('B-TAC-VOLLEY needs archers and a target', () => {
    const s = mk([{ id: 'x', col: 3, row: 5, type: 'spear', ldr: 80 }, { id: 'e', side: 'defender', col: 5, row: 5 }])
    expect(query.tacticTargets(s, 'x', 'volley')).toEqual([])
  })
})
