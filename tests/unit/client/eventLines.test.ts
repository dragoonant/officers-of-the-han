import { describe, expect, it } from 'vitest'
import type { BattleEvent } from '../../../src/battle/types'
import { eventLine, LINES } from '../../../src/client/battle/eventLines'
import { beatMs, baseMs } from '../../../src/client/battle/director'

const SAMPLES: BattleEvent[] = [
  { kind: 'dayStart', day: 2, order: ['a'] },
  { kind: 'turnStart', unit: 'a' },
  { kind: 'move', unit: 'a', path: [{ q: 0, r: 0 }, { q: 1, r: 0 }] },
  { kind: 'undoMove', unit: 'a' },
  { kind: 'attack', unit: 'a', target: 'b', range: 1, damage: 10, counter: 3, killed: true },
  { kind: 'gate', unit: 'a', q: 1, r: 1, damage: 5, hp: 0, broken: true },
  { kind: 'tactic', unit: 'a', tactic: 'fire', q: 1, r: 1, success: true, chance: 50 },
  { kind: 'volley', unit: 'a', target: 'b', damage: 4 },
  { kind: 'burn', unit: 'a', troops: 5, morale: 10 },
  { kind: 'ignite', q: 1, r: 1 },
  { kind: 'ash', q: 1, r: 1 },
  { kind: 'confusedSkip', unit: 'a' },
  { kind: 'challenge', unit: 'a', target: 'b', accepted: false },
  { kind: 'duel', a: 'a', b: 'b', winner: 'a', how: 'knockout', slain: 'b' },
  { kind: 'rout', unit: 'a', reason: 'morale', captured: true },
  { kind: 'morale', unit: 'a', delta: -5 },
  { kind: 'wait', unit: 'a' },
  { kind: 'end', winner: 'attacker', reason: 'keep-taken' },
]

describe('battle event lines', () => {
  it('has a sample and a line for every event kind', () => {
    const kinds = Object.keys(LINES).sort()
    expect(SAMPLES.map((e) => e.kind).sort()).toEqual(kinds)
    for (const e of SAMPLES) {
      const t = eventLine(e, { name: (id) => `Officer ${id}` })
      expect(t.length, e.kind).toBeGreaterThan(5)
      expect(t).not.toContain('undefined')
    }
  })
  it('every tactic has a line and every kind a beat length', () => {
    for (const tactic of ['fire', 'confuse', 'taunt', 'rally', 'volley'] as const)
      for (const success of [true, false]) expect(eventLine({ kind: 'tactic', unit: 'a', tactic, q: 0, r: 0, success, chance: 40 }, { name: (i) => i })).toBeTruthy()
    for (const e of SAMPLES) {
      expect(baseMs(e)).toBeGreaterThan(0)
      expect(beatMs(e, 'instant')).toBe(0)
    }
  })
})
