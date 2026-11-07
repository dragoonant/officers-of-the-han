import { describe, expect, it } from 'vitest'
import { chooseBattleAction, chooseRandomAction } from '../../../src/ai/battle'
import { createBattle, legalActions, replay, step, type BattleAction, type BattleState } from '../../../src/battle'
import { sampleSetup } from '../../../src/battle/sample'
import { nextFloat, seedRng } from '../../../src/shared/rng'
import { playBattle } from '../../../tools/battle-bench'
import { H, doStep, mk, setTerrain, unit } from './helpers'

describe('step is total (fuzz)', () => {
  const junk = (st: ReturnType<typeof seedRng>): unknown => {
    const pool: unknown[] = [null, undefined, NaN, Infinity, -1, 0, 1, 2.5, 999, '', 'a0', 'd0', 'zzz', 'fire', {}, [], [1], true, { x: 1 }, '__proto__']
    return pool[Math.floor(nextFloat(st) * pool.length)]
  }
  it('step never throws and never mutates its input for 2,000 garbage actions', () => {
    const kinds = ['move', 'undoMove', 'attack', 'attackGate', 'tactic', 'challenge', 'duelResolved', 'wait', 'retreat', 'bogus', undefined, 5]
    const st = seedRng(77)
    let s: BattleState = createBattle(sampleSetup({ seed: 5, playerControls: ['a0'] }))
    let accepted = 0
    for (let i = 0; i < 2000; i++) {
      const a: Record<string, unknown> = { kind: kinds[Math.floor(nextFloat(st) * kinds.length)] }
      for (const f of ['unit', 'target', 'q', 'r', 'tactic', 'side', 'result']) if (nextFloat(st) < 0.6) a[f] = junk(st)
      if (nextFloat(st) < 0.3 && s.active) a.unit = s.active
      if (nextFloat(st) < 0.1) { a.result = { duelId: junk(st), winner: junk(st), how: junk(st), rounds: junk(st), vigorLeft: junk(st) } }
      const before = JSON.stringify(s)
      let r: ReturnType<typeof step> | undefined
      expect(() => { r = step(s, a as unknown as BattleAction) }).not.toThrow()
      expect(JSON.stringify(s)).toBe(before)
      if (r!.ok) { accepted++; s = r!.state }
      if (s.outcome) s = createBattle(sampleSetup({ seed: 5 + i, playerControls: ['a0'] }))
    }
    expect(accepted).toBeGreaterThan(0)
    expect(step(null as never, { kind: 'wait', unit: 'x' }).ok).toBe(false)
    expect(step(s, null as never).ok).toBe(false)
  })
  it('every legal action is accepted by step, in a real battle', () => {
    let s = createBattle(sampleSetup({ seed: 11, playerControls: ['a0'] }))
    for (let i = 0; i < 400 && !s.outcome; i++) {
      const la = legalActions(s)
      expect(la.length).toBeGreaterThan(0)
      for (const a of la.filter((x) => x.kind !== 'retreat')) {
        const r = step(s, a)
        expect(r.ok, JSON.stringify(a)).toBe(true)
      }
      const ai = chooseBattleAction(s, s.active!)
      s = doStep(s, ai).state
    }
  })
})

describe('determinism and replay', () => {
  it('B-OUT-2 the same setup and actions give the same state; replay(setup, actions) equals the live state; JSON round-trips', () => {
    for (let seed = 1; seed <= 6; seed++) {
      const setup = sampleSetup({ seed: 300 + seed })
      const a = playBattle(setup, { attacker: 'ai', defender: 'ai' }, false)
      const b = playBattle(setup, { attacker: 'ai', defender: 'ai' }, false)
      expect(JSON.stringify(a.state)).toBe(JSON.stringify(b.state))
      expect(JSON.stringify(replay(setup, a.actions))).toBe(JSON.stringify(a.state))
      expect(JSON.parse(JSON.stringify(a.state))).toEqual(a.state)
    }
  })
  it('step returns a new state and never mutates the old one', () => {
    const s = createBattle(sampleSetup({ seed: 2 }))
    const snap = JSON.stringify(s)
    const r = doStep(s, chooseBattleAction(s, s.active!))
    expect(r.state).not.toBe(s)
    expect(JSON.stringify(s)).toBe(snap)
  })
  it('different seeds give different battles', () => {
    const a = playBattle(sampleSetup({ seed: 1, attackers: 6, defenders: 6 }), { attacker: 'ai', defender: 'ai' }, false)
    const b = playBattle({ ...sampleSetup({ seed: 1, attackers: 6, defenders: 6 }), seed: 99 }, { attacker: 'ai', defender: 'ai' }, false)
    expect(JSON.stringify(a.state.rng)).not.toBe(JSON.stringify(b.state.rng))
  })
  it('a battle between AIs ends within maxDays and under 300 ms', () => {
    const t0 = performance.now()
    for (let i = 0; i < 5; i++) {
      const r = playBattle(sampleSetup({ seed: 40 + i }), { attacker: 'ai', defender: 'ai' }, false)
      expect(r.state.outcome).not.toBeNull()
    }
    expect((performance.now() - t0) / 5).toBeLessThan(300)
  })
})

describe('battle AI', () => {
  it('never returns an illegal action and is deterministic', () => {
    for (let seed = 1; seed <= 5; seed++) {
      let s = createBattle(sampleSetup({ seed: 500 + seed }))
      for (let i = 0; i < 300 && !s.outcome; i++) {
        const a = chooseBattleAction(s, s.active!)
        expect(JSON.stringify(chooseBattleAction(s, s.active!))).toBe(JSON.stringify(a))
        expect(legalActions(s).some((l) => JSON.stringify(l) === JSON.stringify(a))).toBe(true)
        const rnd = chooseRandomAction(s, s.active!)
        expect(legalActions(s).some((l) => JSON.stringify(l) === JSON.stringify(rnd))).toBe(true)
        s = doStep(s, i % 3 === 0 ? rnd : a).state
      }
    }
  })
  it('attacks an adjacent enemy it can badly hurt', () => {
    const s = mk([{ id: 'a', col: 5, row: 5, war: 90 }, { id: 'e', side: 'defender', col: 6, row: 5, war: 30, ldr: 30, troops: 800 }, { id: 'k', side: 'defender', col: 12, row: 5, commander: true }])
    const turn = playTurn(s, 'a')
    expect(turn[turn.length - 1]).toMatchObject({ kind: 'attack', target: 'e' })
  })
  it('attackers walk toward the gates and hit them', () => {
    const s = mk([{ id: 'a', col: 6, row: 5, type: 'spear' }, { id: 'e', side: 'defender', col: 13, row: 2 }])
    const m = chooseBattleAction(s, 'a')
    expect(m.kind).toBe('move')
    if (m.kind === 'move') expect(m.q + m.r).toBeGreaterThanOrEqual(unit(s, 'a').q + unit(s, 'a').r) // eastwards
    const at = mk([{ id: 'a', col: 9, row: 5, type: 'spear' }, { id: 'e', side: 'defender', col: 13, row: 2 }])
    expect(chooseBattleAction(at, 'a')).toMatchObject({ kind: 'attackGate', ...H(10, 5) })
  })
  it('defenders hold the walls instead of sallying out', () => {
    const s = mk([{ id: 'd', side: 'defender', col: 11, row: 5, type: 'spear' }, { id: 'a', col: 3, row: 5 }])
    const act = chooseBattleAction(doStepToActive(s, 'd'), 'd')
    if (act.kind === 'move') expect(act.q + Math.floor(act.r / 2)).toBeGreaterThan(H(9, 5).q + 2) // never out of the gate
    expect(['wait', 'move']).toContain(act.kind)
  })
  it('rallies when allies are low on morale', () => {
    const s = mk([
      { id: 'c', col: 1, row: 1 }, { id: 'x', col: 5, row: 5, ldr: 90, war: 30, int: 10, morale: 25, commander: false }, { id: 'y', col: 5, row: 6, morale: 20 },
      { id: 'e', side: 'defender', col: 9, row: 5 }, { id: 'k', side: 'defender', col: 12, row: 5, commander: true },
    ])
    const turn = playTurn(doStepToActive(s, 'x'), 'x')
    expect(turn[turn.length - 1]).toMatchObject({ kind: 'tactic', tactic: 'rally' })
  })
  it('lights fire only when it hits more enemies than friends', () => {
    const base = (friend: boolean) => doStepToActive(mk([
      { id: 'c', col: 0, row: 0 },
      { id: 'x', col: 3, row: 5, int: 95, war: 30, ldr: 40, type: 'archer', commander: false },
      ...(friend ? [{ id: 'f', col: 5, row: 6, troops: 6000 }, { id: 'f2', col: 5, row: 4, troops: 6000 }, { id: 'f3', col: 6, row: 4, troops: 6000 }, { id: 'f4', col: 6, row: 6, troops: 6000 }] : []),
      { id: 'e1', side: 'defender' as const, col: 5, row: 5, troops: 6000 }, { id: 'e2', side: 'defender' as const, col: 6, row: 5, troops: 6000 },
      { id: 'k', side: 'defender' as const, col: 12, row: 5, commander: true },
    ]), 'x')
    const fires = (s: BattleState): boolean => playTurn(s, 'x').some((a) => a.kind === 'tactic' && a.tactic === 'fire')
    expect(fires(base(false))).toBe(true)
    expect(fires(base(true))).toBe(false)
  })
  it('challenges a weaker officer when it has the better WAR', () => {
    const s = mk([
      { id: 'a', col: 5, row: 5, war: 99, troops: 200 }, { id: 'e', side: 'defender', col: 6, row: 5, war: 70, temperament: 'reckless', troops: 9000 },
      { id: 'k', side: 'defender', col: 12, row: 5, commander: true },
    ])
    const turn = playTurn(s, 'a')
    expect(turn[turn.length - 1]).toMatchObject({ kind: 'challenge', target: 'e' })
    const weak = mk([
      { id: 'a', col: 5, row: 5, war: 62, troops: 9000 }, { id: 'e', side: 'defender', col: 6, row: 5, war: 95, troops: 200 }, { id: 'k', side: 'defender', col: 12, row: 5, commander: true },
    ])
    expect(playTurn(weak, 'a').some((a) => a.kind === 'challenge')).toBe(false)
  })
  it('a taunted AI unit obeys the taunt', () => {
    const s = mk([{ id: 'x', col: 5, row: 5 }, { id: 'e', side: 'defender', col: 6, row: 5 }, { id: 'o', side: 'defender', col: 5, row: 6 }])
    const t = structuredClone(s)
    t.order = ['e', 'x', 'o']
    t.cursor = 0
    t.active = 'e'
    unit(t, 'e').taunted = 'x'
    expect(chooseBattleAction(t, 'e')).toEqual({ kind: 'attack', unit: 'e', target: 'x' })
  })
  it('the AI beats the random tier', () => {
    let wins = 0
    for (let i = 0; i < 10; i++) {
      const setup = sampleSetup({ seed: 700 + i, attackers: 6, defenders: 6, attackerTroops: 4000, defenderTroops: 4000 })
      const r = playBattle(setup, { attacker: 'ai', defender: 'random' }, false)
      if (r.state.outcome?.winner === 'attacker') wins++
    }
    expect(wins).toBeGreaterThanOrEqual(9)
  })
})

/** Let the AI play out the active unit's whole turn; returns its actions. */
function playTurn(s: BattleState, id: string): BattleAction[] {
  const out: BattleAction[] = []
  let cur = s
  for (let i = 0; i < 4 && cur.active === id && !cur.outcome; i++) {
    const a = chooseBattleAction(cur, id)
    out.push(a)
    cur = doStep(cur, a).state
  }
  return out
}

function doStepToActive(s: BattleState, id: string): BattleState {
  const n = structuredClone(s)
  n.order = [id, ...n.units.map((u) => u.id).filter((x) => x !== id)]
  n.cursor = 0
  n.active = id
  return n
}
void setTerrain
