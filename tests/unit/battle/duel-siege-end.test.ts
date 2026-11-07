import { describe, expect, it } from 'vitest'
import { legalActions, outcomeOf, query, step, type BattleState } from '../../../src/battle'
import { autoDuel } from '../../../src/duel'
import { playBattle } from '../../../tools/battle-bench'
import { sampleSetup } from '../../../src/battle/sample'
import { H, doStep, mk, setTerrain, unit } from './helpers'

const sword = (extra: Partial<Parameters<typeof mk>[0][number]> = {}) => ({ id: 'p', col: 5, row: 5, war: 90, ...extra })

describe('B-DUEL-1 challenge', () => {
  it('B-DUEL-1 needs WAR >= 60, health >= 30 and an adjacent enemy officer', () => {
    const t = (u: object) => legalActions(mk([sword(u), { id: 'e', side: 'defender', col: 6, row: 5 }])).some((a) => a.kind === 'challenge')
    expect(t({})).toBe(true)
    expect(t({ war: 59 })).toBe(false)
    expect(t({ war: 60 })).toBe(true)
    expect(t({ health: 29 })).toBe(false)
    expect(t({ health: 30 })).toBe(true)
    expect(legalActions(mk([sword(), { id: 'e', side: 'defender', col: 8, row: 5 }])).some((a) => a.kind === 'challenge')).toBe(false)
  })
  it('B-DUEL-1 the target accepts if its WAR >= challenger WAR - 10, or it is reckless', () => {
    const run = (e: object) => doStep(mk([sword(), { id: 'e', side: 'defender', col: 6, row: 5, ...e }]), { kind: 'challenge', unit: 'p', target: 'e' })
    const ev = (r: ReturnType<typeof run>) => r.events.find((x) => x.kind === 'challenge')
    expect(ev(run({ war: 80 }))).toMatchObject({ accepted: true })
    expect(ev(run({ war: 79 }))).toMatchObject({ accepted: false })
    expect(ev(run({ war: 40, temperament: 'reckless' }))).toMatchObject({ accepted: true })
  })
  it('B-DUEL-1 a refusal costs the target\'s unit 15 morale and no duel is fought', () => {
    const s = mk([sword(), { id: 'e', side: 'defender', col: 6, row: 5, war: 50, morale: 60 }])
    const r = doStep(s, { kind: 'challenge', unit: 'p', target: 'e' })
    expect(unit(r.state, 'e').morale).toBe(45)
    expect(r.state.duels).toEqual([])
    expect(r.state.active).toBe('e') // the challenge was the action
  })
})

describe('B-DUEL-2 who plays the duel', () => {
  const setup = (pc: string[]) => mk([sword(), { id: 'e', side: 'defender', col: 6, row: 5, war: 85 }], { playerControls: pc })
  it('B-DUEL-2 AI vs AI auto-resolves inside the step', () => {
    const r = doStep(setup([]), { kind: 'challenge', unit: 'p', target: 'e' })
    expect(r.state.pendingDuel).toBeNull()
    expect(r.state.duels.length).toBe(1)
    expect(r.events.some((e) => e.kind === 'duel')).toBe(true)
    expect(r.state.active).toBe('e')
  })
  it('B-DUEL-2 if the player\'s officer is in it, a pending duel is answered by duelResolved', () => {
    const r = doStep(setup(['p']), { kind: 'challenge', unit: 'p', target: 'e' })
    const pend = r.state.pendingDuel!
    expect(pend).not.toBeNull()
    expect(pend.a.player).toBe(true)
    expect(pend.b.player).toBe(false)
    expect(pend.inBattle).toBe(true)
    expect(pend.seed).toBeTypeOf('number')
    const la = legalActions(r.state)
    expect(la[0]!.kind).toBe('duelResolved')
    expect(la.every((a) => a.kind === 'duelResolved' || a.kind === 'retreat')).toBe(true)
    const wait = step(r.state, { kind: 'wait', unit: 'p' })
    expect(!wait.ok && wait.code).toBe('pending-duel')
    // a result for another duel is refused
    const bad = step(r.state, { kind: 'duelResolved', result: { duelId: 'zzz', winner: 'a', how: 'knockout', rounds: 2, vigorLeft: { a: 5, b: 0 } } })
    expect(!bad.ok && bad.code).toBe('bad-result')
    const done = doStep(r.state, { kind: 'duelResolved', result: { duelId: pend.id, winner: 'a', how: 'yield', rounds: 2, vigorLeft: { a: 30, b: 10 } } })
    expect(done.state.pendingDuel).toBeNull()
    expect(done.state.duels[0]).toMatchObject({ a: 'p', b: 'e', winner: 'p' })
    expect(done.state.active).toBe('e')
    expect(step(done.state, { kind: 'duelResolved', result: la[0]!.kind === 'duelResolved' ? la[0]!.result : (null as never) }).ok).toBe(false)
  })
  it('B-DUEL-2 the auto duel is reproducible: same state and action, same record', () => {
    const s = setup([])
    const a = doStep(s, { kind: 'challenge', unit: 'p', target: 'e' })
    const b = doStep(s, { kind: 'challenge', unit: 'p', target: 'e' })
    expect(a.state.duels).toEqual(b.state.duels)
    expect(a.state.rng).toEqual(b.state.rng)
    const direct = autoDuel({
      id: 't1-d1', seed: 1, inBattle: true,
      a: { id: 'p', name: 'p', stats: unit(s, 'p').officer.stats, temperament: 'steady', health: 100, player: false },
      b: { id: 'e', name: 'e', stats: unit(s, 'e').officer.stats, temperament: 'steady', health: 100, player: false },
    })
    expect(['knockout', 'draw', 'yield']).toContain(direct.how)
  })
})

describe('B-DUEL-3 duel results', () => {
  const pending = (seed = 7) => {
    const s = mk([sword({ morale: 70 }), { id: 'e', side: 'defender', col: 6, row: 5, war: 85, morale: 70, health: 90 }], { playerControls: ['p'], seed })
    return doStep(s, { kind: 'challenge', unit: 'p', target: 'e' }).state
  }
  const resolve = (s: BattleState, winner: 'a' | 'b' | null, how: 'knockout' | 'yield' | 'draw') =>
    doStep(s, { kind: 'duelResolved', result: { duelId: s.pendingDuel!.id, winner, how, rounds: 4, vigorLeft: { a: 10, b: 0 } } })
  it('B-DUEL-3 the loser\'s unit loses 40 morale; a draw changes nothing', () => {
    const w = resolve(pending(), 'a', 'yield')
    expect(unit(w.state, 'e').morale).toBe(30)
    expect(unit(w.state, 'e').health).toBe(90)
    const d = resolve(pending(), null, 'draw')
    expect(unit(d.state, 'e').morale).toBe(70)
    expect(unit(d.state, 'p').morale).toBe(70)
    expect(d.state.duels[0]!.winner).toBeNull()
  })
  it('B-DUEL-3 a knocked-out loser is wounded (health -30)', () => {
    const w = resolve(pending(), 'a', 'knockout')
    expect(unit(w.state, 'e').health).toBe(60)
    expect(unit(w.state, 'e').wounded).toBe(30)
    const lose = resolve(pending(), 'b', 'knockout')
    expect(unit(lose.state, 'p').health).toBe(70)
    expect(unit(lose.state, 'p').morale).toBe(30)
  })
  it('B-DUEL-3 with chance 15% a knocked-out loser is slain and the unit routs', () => {
    let slain = 0
    const n = 400
    for (let seed = 1; seed <= n; seed++) {
      const r = resolve(pending(seed), 'a', 'knockout')
      const e = unit(r.state, 'e')
      if (e.slain) {
        slain++
        expect(e.routed).toBe(true)
        expect(r.state.duels[0]!.slain).toBe('e')
      } else expect(r.state.duels[0]!.slain).toBeNull()
    }
    expect(slain / n).toBeGreaterThan(0.09)
    expect(slain / n).toBeLessThan(0.22)
  })
  it('B-DUEL-3 a yield is not a knockout: nobody is wounded or slain', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const r = resolve(pending(seed), 'a', 'yield')
      expect(unit(r.state, 'e').slain).toBe(false)
      expect(unit(r.state, 'e').wounded).toBe(0)
    }
  })
})

describe('B-SIEGE-1 gates', () => {
  const siege = (extra: Partial<Parameters<typeof mk>[0][number]> = {}, o = {}) =>
    mk([{ id: 'a', col: 9, row: 5, ldr: 60, troops: 3000, ...extra }, { id: 'd', side: 'defender', col: 13, row: 3 }], o)
  it('B-SIEGE-1 gate HP is 100 + walls * 2 and an attacker next to it may hit it for floor(troops*0.05*(0.5+LDR/100))', () => {
    const s = siege({ type: 'archer' }, { walls: 100 })
    const g = H(10, 5)
    expect(query.gateHp(s).find((x) => x.q === g.q && x.r === g.r)).toMatchObject({ hp: 300, max: 300, broken: false })
    const r = doStep(s, { kind: 'attackGate', unit: 'a', ...g })
    expect(query.gateHp(r.state).find((x) => x.q === g.q && x.r === g.r)!.hp).toBe(300 - Math.floor(3000 * 0.05 * 1.1))
    expect(r.state.rng).toEqual(s.rng)
    expect(r.state.active).toBe('d')
  })
  it('B-SIEGE-1 spear damage to a gate is x1.5', () => {
    const s = siege({ type: 'spear' }, { walls: 400 })
    const g = H(10, 5)
    const r = doStep(s, { kind: 'attackGate', unit: 'a', ...g })
    expect(query.gateHp(r.state).find((x) => x.q === g.q && x.r === g.r)!.hp).toBe(900 - Math.floor(3000 * 0.05 * 1.1 * 1.5))
  })
  it('B-SIEGE-1 at HP 0 the gate is broken and passable', () => {
    const s = siege({ troops: 9000, type: 'spear' }, { walls: 0 })
    const g = H(10, 5)
    const r = doStep(s, { kind: 'attackGate', unit: 'a', ...g })
    const gate = query.gateHp(r.state).find((x) => x.q === g.q && x.r === g.r)!
    expect(gate.hp).toBe(0)
    expect(gate.broken).toBe(true)
    expect(query.hexAt(r.state, g.q, g.r)!.passable).toBe(true)
    // the next attacker can walk through
    const s2 = structuredClone(r.state)
    s2.order = ['a', 'd']
    s2.cursor = 0
    s2.active = 'a'
    s2.units[0]!.moved = false
    expect(query.moveRange(s2, 'a').some((m) => m.q === g.q && m.r === g.r)).toBe(true)
    // and no more gate attacks on it
    expect(legalActions(s2).some((a) => a.kind === 'attackGate')).toBe(false)
  })
  it('B-SIEGE-1 only attackers next to a standing gate can hit it; walls cannot be hit', () => {
    const far = mk([{ id: 'a', col: 7, row: 5 }, { id: 'd', side: 'defender', col: 13, row: 3 }])
    expect(legalActions(far).some((a) => a.kind === 'attackGate')).toBe(false)
    expect(step(far, { kind: 'attackGate', unit: 'a', ...H(10, 5) }).ok).toBe(false)
    const near = siege()
    expect(step(near, { kind: 'attackGate', unit: 'a', ...H(10, 4) }).ok).toBe(false) // a wall hex
    const def = mk([{ id: 'd', side: 'defender', col: 11, row: 5 }, { id: 'a', col: 3, row: 5 }])
    expect(legalActions(def).some((a) => a.kind === 'attackGate')).toBe(false)
  })
})

describe('B-SIEGE-2 archers over the wall', () => {
  it('B-SIEGE-2 archers inside on town hexes next to the wall shoot at range 2; melee units cannot reach across', () => {
    const s = mk([
      { id: 'arch', side: 'defender', col: 11, row: 4, type: 'archer' }, { id: 'a', col: 9, row: 4 },
    ])
    const t = query.attackTargets(s, 'arch')
    expect(t).toEqual([{ target: 'a', range: 2 }])
    const r = doStep(s, { kind: 'attack', unit: 'arch', target: 'a' })
    expect(unit(r.state, 'a').troops).toBeLessThan(3000)
    expect(unit(r.state, 'arch').troops).toBe(3000)
    const melee = mk([{ id: 'sp', side: 'defender', col: 11, row: 4, type: 'spear' }, { id: 'a', col: 9, row: 4 }])
    expect(query.attackTargets(melee, 'sp')).toEqual([])
  })
})

describe('B-UNIT-1 and B-ROUT-1 routing', () => {
  it('B-UNIT-1 a unit with 0 troops routs and leaves the field', () => {
    const s = mk([sword(), { id: 'e', side: 'defender', col: 6, row: 5, troops: 3 }, { id: 'e2', side: 'defender', col: 12, row: 5 }])
    const r = doStep(s, { kind: 'attack', unit: 'p', target: 'e' })
    expect(unit(r.state, 'e').routed).toBe(true)
    expect(unit(r.state, 'e').troops).toBe(0)
    expect(r.events.some((e) => e.kind === 'rout' && e.unit === 'e' && e.reason === 'troops')).toBe(true)
    expect(query.hexAt(r.state, H(6, 5).q, H(6, 5).r)!.unit).toBeNull()
    expect(query.initiative(r.state)).not.toContain('e')
  })
  it('B-UNIT-1 a unit with 0 morale routs even with troops left', () => {
    const s = mk([sword(), { id: 'e', side: 'defender', col: 6, row: 5, morale: 1 }, { id: 'e2', side: 'defender', col: 12, row: 5 }])
    const r = doStep(s, { kind: 'attack', unit: 'p', target: 'e' })
    expect(unit(r.state, 'e').routed).toBe(true)
    expect(unit(r.state, 'e').troops).toBeGreaterThan(0)
    expect(r.events.some((e) => e.kind === 'rout' && e.reason === 'morale')).toBe(true)
  })
  it('B-ROUT-1 capture chance is 40 + 0.3 * (best adjacent enemy WAR - own WAR), clamped 10-80', () => {
    const rate = (own: number, enemy: number): number => {
      let c = 0
      const n = 300
      for (let seed = 1; seed <= n; seed++) {
        const s = mk([sword({ war: enemy }), { id: 'e', side: 'defender', col: 6, row: 5, troops: 3, war: own }, { id: 'k', side: 'defender', col: 12, row: 5 }], { seed })
        if (unit(doStep(s, { kind: 'attack', unit: 'p', target: 'e' }).state, 'e').captured) c++
      }
      return c / n
    }
    expect(rate(50, 90)).toBeGreaterThan(0.42) // 52%
    expect(rate(50, 90)).toBeLessThan(0.62)
    expect(rate(100, 30)).toBeGreaterThan(0.05) // clamp 19 -> 19%? 40 + 0.3 * -70 = 19
    expect(rate(100, 30)).toBeLessThan(0.32)
    expect(rate(20, 100)).toBeGreaterThan(0.7) // 64
    expect(rate(0, 100)).toBeGreaterThan(0.7) // 70
  })
  it('B-ROUT-1 no adjacent enemy means the officer escapes', () => {
    const s = mk([
      { id: 'arch', col: 5, row: 5, type: 'archer', war: 99 }, { id: 'e', side: 'defender', col: 7, row: 5, troops: 3 }, { id: 'k', side: 'defender', col: 12, row: 5 },
    ])
    const r = doStep(s, { kind: 'attack', unit: 'arch', target: 'e' })
    expect(unit(r.state, 'e').routed).toBe(true)
    expect(unit(r.state, 'e').captured).toBe(false)
  })
  it('B-ROUT-1 a unit routed by fire at the start of its turn escapes unless an enemy is next to it', () => {
    let s = mk([{ id: 'a', col: 3, row: 5 }, { id: 'e', side: 'defender', col: 8, row: 5, troops: 1 }])
    s = structuredClone(s)
    s.hexes[5 * 15 + 8] = { ...s.hexes[5 * 15 + 8]!, burn: 2, burnBy: 'a' }
    const r = doStep(s, { kind: 'wait', unit: 'a' })
    expect(unit(r.state, 'e').routed).toBe(true)
    expect(unit(r.state, 'e').captured).toBe(false)
    expect(r.state.outcome?.winner).toBe('attacker')
  })
})

describe('B-WIN win conditions', () => {
  it('B-WIN-1 a side loses when its commander routs', () => {
    const s = mk([sword(), { id: 'e', side: 'defender', col: 6, row: 5, troops: 3 }, { id: 'k', side: 'defender', col: 12, row: 5, commander: false }])
    expect(unit(s, 'e').commander).toBe(true)
    const r = doStep(s, { kind: 'attack', unit: 'p', target: 'e' })
    expect(r.state.outcome).toMatchObject({ winner: 'attacker', reason: 'commander-routed' })
    expect(r.state.active).toBeNull()
    expect(legalActions(r.state)).toEqual([])
    const again = step(r.state, { kind: 'wait', unit: 'p' })
    expect(!again.ok && again.code).toBe('ended')
  })
  it('B-WIN-1 a side loses when all its units have routed', () => {
    const s = mk([sword({ commander: true }), { id: 'e', side: 'defender', col: 6, row: 5, troops: 3, commander: false }, { id: 'c', side: 'defender', col: 12, row: 5, commander: true }])
    // route the commander first via fire at its turn start, then the last unit
    const t = structuredClone(s)
    unit(t, 'c').routed = true
    const r = doStep(t, { kind: 'attack', unit: 'p', target: 'e' })
    expect(r.state.outcome?.winner).toBe('attacker')
    // commander flag routed counts first; use a side with no commander routed but everyone gone
    const t2 = mk([sword(), { id: 'e', side: 'defender', col: 6, row: 5, troops: 3, commander: true }])
    expect(doStep(t2, { kind: 'attack', unit: 'p', target: 'e' }).state.outcome?.reason).toBe('commander-routed')
  })
  it('B-WIN-1 the attacker loses when its commander routs (counter or burn)', () => {
    const s = mk([{ id: 'a', col: 5, row: 5, troops: 5, commander: true }, { id: 'e', side: 'defender', col: 6, row: 5, war: 100, ldr: 100, troops: 9000 }])
    const r = doStep(s, { kind: 'attack', unit: 'a', target: 'e' })
    expect(r.state.outcome).toMatchObject({ winner: 'defender', reason: 'commander-routed' })
  })
  it('B-WIN-2 an attacker unit ending its move on the keep wins at once', () => {
    let s = mk([{ id: 'a', col: 12, row: 5, type: 'cavalry' }, { id: 'd', side: 'defender', col: 14, row: 1 }])
    s = structuredClone(s)
    s.hexes[5 * 15 + 10] = { ...s.hexes[5 * 15 + 10]!, gateHp: 0 }
    const keep = H(13, 5)
    expect(query.moveRange(s, 'a').some((m) => m.q === keep.q && m.r === keep.r)).toBe(true)
    const r = doStep(s, { kind: 'move', unit: 'a', ...keep })
    expect(r.state.outcome).toMatchObject({ winner: 'attacker', reason: 'keep-taken' })
    // a defender on the keep wins nothing
    const d = mk([{ id: 'a', col: 1, row: 1 }, { id: 'd', side: 'defender', col: 12, row: 5, type: 'cavalry' }])
    const dd = activateDef(d)
    expect(doStep(dd, { kind: 'move', unit: 'd', ...keep }).state.outcome).toBeNull()
  })
  it('B-WIN-3 if maxDays ends with both sides standing the defender wins', () => {
    let s = mk([{ id: 'a', col: 1, row: 1 }, { id: 'd', side: 'defender', col: 12, row: 5 }], { maxDays: 3 })
    s = structuredClone(s)
    for (let i = 0; i < 20 && !s.outcome; i++) s = doStep(s, { kind: 'wait', unit: s.active! }).state
    expect(s.outcome).toMatchObject({ winner: 'defender', reason: 'time', days: 3 })
  })
  it('B-WIN-1 retreat: the player\'s side gives up and the other side wins', () => {
    const s = mk([{ id: 'p', col: 1, row: 1 }, { id: 'd', side: 'defender', col: 12, row: 5 }], { playerControls: ['p'] })
    expect(legalActions(s).some((a) => a.kind === 'retreat')).toBe(true)
    const r = doStep(s, { kind: 'retreat', side: 'attacker' })
    expect(r.state.outcome).toMatchObject({ winner: 'defender', reason: 'retreat' })
    expect(step(s, { kind: 'retreat', side: 'defender' }).ok).toBe(false)
    expect(legalActions(mk([{ id: 'p', col: 1, row: 1 }, { id: 'd', side: 'defender', col: 12, row: 5 }])).some((a) => a.kind === 'retreat')).toBe(false)
  })
})

function activateDef(s: BattleState): BattleState {
  const n = structuredClone(s)
  n.order = ['d', 'a']
  n.cursor = 0
  n.active = 'd'
  return n
}

describe('B-OUT-1 outcome and merit', () => {
  it('B-OUT-1 merit: +150 per surviving winner, +300 winning commander, +30 per loser, +50 per unit routed, +100 per duel', () => {
    // a0 (commander) and a1 attack; d1 falls to a1, d0 (commander) to a0
    let s = mk([
      { id: 'a1', col: 5, row: 5, commander: false },
      { id: 'a0', col: 5, row: 7, commander: true },
      { id: 'd1', side: 'defender', col: 6, row: 5, troops: 3, commander: false },
      { id: 'd0', side: 'defender', col: 6, row: 7, troops: 3, commander: true },
    ])
    s = doStep(s, { kind: 'attack', unit: 'a1', target: 'd1' }).state
    expect(s.outcome).toBeNull()
    const act = s.active!
    const order = structuredClone(s)
    order.order = ['a0', 'd0']
    order.cursor = 0
    order.active = 'a0'
    void act
    const r = doStep(order, { kind: 'attack', unit: 'a0', target: 'd0' })
    const o = r.state.outcome!
    const m = (id: string): number => o.units.find((u) => u.officer === id)!.merit
    expect(m('a1')).toBe(50 + 150)
    expect(m('a0')).toBe(50 + 150 + 300)
    expect(m('d1')).toBe(30)
    expect(m('d0')).toBe(30)
    expect(o.winner).toBe('attacker')
    expect(o.battleId).toBe('t1')
  })
  it('B-OUT-1 winning a duel is worth +100; troops, routed, captured, slain, wounded and duels are reported per unit', () => {
    const s = mk([sword({ commander: true }), { id: 'e', side: 'defender', col: 6, row: 5, war: 85, health: 90 }, { id: 'k', side: 'defender', col: 12, row: 5, commander: true }], { playerControls: ['p'], maxDays: 1 })
    const c = doStep(s, { kind: 'challenge', unit: 'p', target: 'e' }).state
    let r = doStep(c, { kind: 'duelResolved', result: { duelId: c.pendingDuel!.id, winner: 'a', how: 'knockout', rounds: 3, vigorLeft: { a: 4, b: 0 } } }).state
    for (let i = 0; i < 10 && !r.outcome; i++) r = doStep(r, { kind: 'wait', unit: r.active! }).state
    const o = outcomeOf(r)
    expect(o.winner).toBe('defender')
    expect(o.reason).toBe('time')
    const p = o.units.find((u) => u.officer === 'p')!
    expect(p).toMatchObject({ side: 'attacker', troopsStart: 3000, troopsEnd: 3000, routed: false, captured: false, slain: false, wounded: 0 })
    expect(p.merit).toBe(30 + 100) // loser +30, duel win +100
    const e = o.units.find((u) => u.officer === 'e')!
    expect(e.wounded).toBe(30)
    expect(e.merit).toBeGreaterThanOrEqual(150) // winning side, survived (unless slain)
    expect(o.duels).toEqual([{ a: 'p', b: 'e', winner: 'p', slain: e.slain ? 'e' : null }])
    expect(o.units.length).toBe(3)
    expect(JSON.parse(JSON.stringify(o))).toEqual(o)
  })
})

describe('B-OUT-2 auto-play', () => {
  it('B-OUT-2 both sides AI play a full battle headlessly from the same engine', () => {
    for (let i = 1; i <= 6; i++) {
      const res = playBattle(sampleSetup({ seed: 900 + i }), { attacker: 'ai', defender: 'ai' }, true)
      expect(res.errors).toEqual([])
      expect(res.state.outcome).not.toBeNull()
      expect(res.state.outcome!.days).toBeLessThanOrEqual(20)
    }
  })
})
void setTerrain
