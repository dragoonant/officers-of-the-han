import { describe, expect, it } from 'vitest'
import type { Contestant, DebateSetup } from '../../../src/contracts/contest'
import {
  autoDebate, clash, createDebate, debateTells, force, legalTablets, parseTablet, startComposure, stepDebate, query, type DebateState,
} from '../../../src/debate'

const who = (id: string, o: { int?: number; cha?: number; player?: boolean } = {}): Contestant => ({
  id, name: id, stats: { war: 50, ldr: 50, int: o.int ?? 60, pol: 50, cha: o.cha ?? 40 }, temperament: 'steady', health: 100, player: o.player ?? false,
})
const setup = (a: { int?: number; cha?: number; player?: boolean } = { player: true }, b: { int?: number; cha?: number } = {}, seed = 3, bonus = { a: 0, b: 0 }): DebateSetup => ({
  id: 'db1', seed, a: who('a', a), b: who('b', b), purpose: 'recruit', composureBonus: bonus,
})
const T = (id: string) => parseTablet(id)!

/** Put chosen tablets into the hands and force b's committed tablet. */
function rig(st: DebateState, a: string[], b: string[], bPick: string): DebateState {
  const s = structuredClone(st)
  s.hands = { a: [...a], b: [...b] }
  s.committed = { a: null, b: bPick }
  return s
}

describe('D-DEB-1 composure', () => {
  it('D-DEB-1 composure = 40 + INT / 2 + CHA / 4', () => {
    const st = createDebate(setup({ int: 80, cha: 60, player: true }, { int: 50, cha: 20 }))
    expect(st.composure).toEqual({ a: 95, b: 70 }) // 40+40+15, 40+25+5
    expect(startComposure(who('x', { int: 71, cha: 30 }), 0)).toBe(83) // 40+35.5+7.5 = 83
  })
})

describe('D-DEB-2 deck and hands', () => {
  it('D-DEB-2 one deck of 24 tablets: four kinds, powers 1-6 once each, shuffled by the stream', () => {
    const st = createDebate(setup())
    const all = [...st.deck, ...st.hands.a, ...st.hands.b]
    expect(all.length).toBe(24)
    expect(new Set(all).size).toBe(24)
    for (const k of ['reason', 'precedent', 'appeal', 'scorn']) for (let p = 1; p <= 6; p++) expect(all).toContain(`${k}-${p}`)
    expect(createDebate(setup()).deck).toEqual(st.deck)
    expect(createDebate(setup({ player: true }, {}, 4)).deck).not.toEqual(st.deck)
  })
  it('D-DEB-2 each draws 4, both hands are face up, and each draws back to 4 after a round', () => {
    const st = createDebate(setup())
    expect(st.hands.a.length).toBe(4)
    expect(st.hands.b.length).toBe(4)
    expect(legalTablets(st, 'b')).toEqual(st.hands.b) // visible to the player
    const r = stepDebate(st, { tablet: st.hands.a[0]! })
    if (!r.ok) throw new Error(r.message)
    expect(r.state.hands.a.length).toBe(4)
    expect(r.state.hands.b.length).toBe(4)
    expect(r.state.deck.length).toBe(16 - 2)
    expect(r.state.hands.a).not.toContain(st.hands.a[0])
  })
  it('D-DEB-2 playing a tablet not in hand is refused', () => {
    const st = createDebate(setup())
    const notMine = st.hands.b.find((t) => !st.hands.a.includes(t))!
    const r = stepDebate(st, { tablet: notMine })
    expect(r.ok).toBe(false)
  })
})

describe('D-DEB-3 beats', () => {
  const dmgTo = (mine: string, theirs: string) => clash(T(mine), T(theirs), who('a', { int: 0, cha: 0 }), who('b', { int: 0, cha: 0 }))
  it('D-DEB-3 Reason beats Appeal, Appeal beats Scorn, Scorn beats Reason', () => {
    expect(dmgTo('reason-1', 'appeal-6').deal).toBe(5)
    expect(dmgTo('appeal-1', 'scorn-6').deal).toBe(5)
    expect(dmgTo('scorn-1', 'reason-6').deal).toBe(5)
    expect(dmgTo('appeal-6', 'reason-1').take).toBe(5)
  })
  it('D-DEB-3 Precedent beats none and loses to none', () => {
    expect(dmgTo('precedent-3', 'scorn-3')).toEqual({ deal: 0, take: 0 })
    expect(dmgTo('precedent-3', 'reason-3')).toEqual({ deal: 0, take: 0 })
    expect(dmgTo('precedent-4', 'reason-3').deal).toBe(5)
  })
})

describe('D-DEB-4 force', () => {
  it('D-DEB-4 force = power + INT/20 for Reason and Precedent, CHA/20 for Appeal and Scorn', () => {
    const c = who('x', { int: 100, cha: 40 })
    expect(force(T('reason-3'), c)).toBe(8)
    expect(force(T('precedent-1'), c)).toBe(6)
    expect(force(T('appeal-3'), c)).toBe(5)
    expect(force(T('scorn-6'), c)).toBe(8)
  })
})

describe('D-DEB-5 resolution', () => {
  const play = (a: string, b: string, o: { aInt?: number; aCha?: number } = {}) => {
    const st = rig(createDebate(setup({ int: o.aInt ?? 0, cha: o.aCha ?? 0, player: true }, { int: 0, cha: 0 })), [a, 'precedent-1', 'precedent-2', 'precedent-3'], [b, 'precedent-4', 'precedent-5', 'precedent-6'], b)
    const r = stepDebate(st, { tablet: a })
    if (!r.ok) throw new Error(r.message)
    return { before: st, after: r.state }
  }
  it('D-DEB-5 Scorn beats Reason: the winner deals 5 x its force', () => {
    const { before, after } = play('scorn-4', 'reason-6')
    expect(before.composure.b - after.composure.b).toBe(20)
    expect(after.composure.a).toBe(before.composure.a)
  })
  it('D-DEB-5 the loser of a beat takes the winner\'s force, whatever its own power', () => {
    const { before, after } = play('reason-2', 'scorn-5')
    expect(before.composure.a - after.composure.a).toBe(25)
  })
  it('D-DEB-5 same kind: the higher force deals 5 x the difference; equal force deals nothing', () => {
    const hi = play('reason-5', 'reason-2')
    expect(hi.before.composure.b - hi.after.composure.b).toBe(15)
    const eq = play('appeal-3', 'appeal-3')
    expect(eq.after.composure).toEqual(eq.before.composure)
    const prec = play('precedent-5', 'scorn-2') // Precedent involved
    expect(prec.before.composure.b - prec.after.composure.b).toBe(15)
  })
  it('D-DEB-5 stat bonuses count in the force', () => {
    const { before, after } = play('scorn-1', 'reason-1', { aCha: 100 }) // force 1 + 5 = 6 -> 30
    expect(before.composure.b - after.composure.b).toBe(30)
  })
})

describe('D-DEB-6 ending', () => {
  it('D-DEB-6 a debater at 0 composure loses', () => {
    const st = rig(createDebate(setup({ int: 0, cha: 0, player: true }, { int: 0, cha: 0 })), ['reason-6', 'precedent-1', 'precedent-2', 'precedent-3'], ['appeal-1', 'precedent-4', 'precedent-5', 'precedent-6'], 'appeal-1')
    st.composure.b = 5
    const r = stepDebate(st, { tablet: 'reason-6' })
    expect(r.ok && r.state.outcome).toMatchObject({ winner: 'a', rounds: 1, composureLeft: { b: 0 } })
  })
  it('D-DEB-6 after 6 rounds the higher composure share wins; a tie goes to the defender', () => {
    const play6 = (mutate: (s: DebateState) => void) => {
      let st = createDebate(setup({ int: 40, cha: 40, player: true }, { int: 40, cha: 40 }))
      mutate(st)
      for (let i = 0; i < 6; i++) {
        st = rig(st, ['precedent-1', 'precedent-2', 'precedent-3', 'precedent-4'], ['precedent-1', 'precedent-2', 'precedent-3', 'precedent-4'], 'precedent-1')
        const r = stepDebate(st, { tablet: 'precedent-1' })
        if (!r.ok) throw new Error(r.message)
        st = r.state
      }
      return st
    }
    const tie = play6(() => undefined)
    expect(tie.outcome).toMatchObject({ winner: 'b', rounds: 6 })
    const aUp = play6((s) => { s.composure.a -= 1; s.start.a = s.composure.a + 1; s.composure.a += 1; s.composure.b -= 5 })
    expect(aUp.outcome!.winner).toBe('a')
    const bUp = play6((s) => { s.composure.a -= 5 })
    expect(bUp.outcome!.winner).toBe('b')
    // share, not raw composure: a has fewer points but a higher share
    const share = play6((s) => { s.start.a = 60; s.composure.a = 60; s.start.b = 200; s.composure.b = 150 })
    expect(share.outcome!.winner).toBe('a')
  })
})

describe('D-DEB-7 world modifiers', () => {
  it('D-DEB-7 composureBonus raises the starting composure by that fraction', () => {
    const base = createDebate(setup())
    const up = createDebate(setup({ player: true }, {}, 3, { a: 0.1, b: 0.2 }))
    expect(up.composure.a).toBe(Math.floor(base.composure.a * 1.1))
    expect(up.composure.b).toBe(Math.floor(base.composure.b * 1.2))
    expect(up.start).toEqual(up.composure)
  })
})

describe('D-DEB-8 AI tells', () => {
  it('D-DEB-8 weights = expected damage dealt minus taken against a uniform pick of the visible hand, shifted so the minimum is 1', () => {
    const st = rig(createDebate(setup({ int: 0, cha: 0, player: true }, { int: 0, cha: 0 })), ['reason-3', 'appeal-2', 'scorn-5', 'precedent-1'], ['reason-4', 'scorn-1', 'precedent-6', 'appeal-6'], 'reason-4')
    const tells = debateTells(st, 'b')
    expect(tells.map((t) => t.tablet)).toEqual(['reason-4', 'scorn-1', 'precedent-6', 'appeal-6'])
    // by hand for reason-4 against [reason-3, appeal-2, scorn-5, precedent-1]
    const mine = T('reason-4')
    let e = 0
    for (const o of st.hands.a) {
      const c = clash(mine, T(o), st.setup.b, st.setup.a)
      e += c.deal - c.take
    }
    e /= 4
    const all = tells.map((t) => t.expectedDealt - t.expectedTaken)
    expect(all[0]).toBeCloseTo(e)
    const min = Math.min(...all)
    tells.forEach((t, i) => expect(t.weight).toBeCloseTo(all[i]! - min + 1))
    expect(Math.min(...tells.map((t) => t.weight))).toBeCloseTo(1)
    expect(tells.reduce((s, t) => s + t.pct, 0)).toBeCloseTo(100, 0)
    expect(query.debateTells(st, 'b')).toEqual(tells)
  })
  it('D-DEB-8 the AI commits first, when the round opens, and the player\'s tablet cannot change it', () => {
    const st = createDebate(setup())
    expect(st.committed.b).not.toBeNull()
    expect(st.hands.b).toContain(st.committed.b)
    expect(st.committed.a).toBeNull()
    const plays = st.hands.a.map((t) => {
      const r = stepDebate(st, { tablet: t })
      return r.ok ? r.state.log[0]!.b : null
    })
    expect(new Set(plays).size).toBe(1)
  })
  it('D-DEB-8 the draw follows the weights (2000 seeds)', () => {
    const counts = new Map<string, number>()
    const n = 2000
    let expected = 0
    let hits = 0
    for (let seed = 1; seed <= n; seed++) {
      const st = createDebate(setup({ player: true }, {}, seed))
      const tells = debateTells(st, 'b')
      const best = tells.slice().sort((x, y) => y.pct - x.pct)[0]!
      expected += best.pct / 100
      if (st.committed.b === best.tablet) hits++
      counts.set(st.committed.b!, (counts.get(st.committed.b!) ?? 0) + 1)
    }
    expect(Math.abs(hits - expected) / n).toBeLessThan(0.04)
  })
})

describe('debate contract', () => {
  it('autoDebate is deterministic, finishes within 6 rounds and ignores player flags', () => {
    for (let seed = 1; seed < 150; seed++) {
      const s = setup({ int: 30 + (seed % 60), cha: 30 + (seed % 50), player: true }, { int: 90 - (seed % 50) }, seed)
      const o = autoDebate(s)
      expect(o).toEqual(autoDebate(s))
      expect(o.rounds).toBeGreaterThanOrEqual(1)
      expect(o.rounds).toBeLessThanOrEqual(6)
      expect(['a', 'b']).toContain(o.winner)
    }
  })
  it('stepDebate never throws on garbage and never mutates its input', () => {
    const st = createDebate(setup())
    const snap = JSON.stringify(st)
    for (const g of [null, undefined, 5, 'x', {}, { tablet: null }, { tablet: 7 }, { tablet: 'scorn-9' }, [], { tablet: {} }]) {
      expect(() => stepDebate(st, g as never)).not.toThrow()
    }
    expect(JSON.stringify(st)).toBe(snap)
    expect(JSON.parse(JSON.stringify(st))).toEqual(st)
  })
  it('both sides AI: stepDebate without a player plays the committed tablets', () => {
    let st = createDebate({ ...setup(), a: who('a'), b: who('b') })
    while (!st.outcome) {
      const r = stepDebate(st, {})
      if (!r.ok) throw new Error(r.message)
      st = r.state
    }
    expect(st.log.length).toBeGreaterThan(0)
  })
})
