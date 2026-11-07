import { describe, expect, it } from 'vitest'
import { createWorldApi } from '../../../src/world'
import { GAME_DATA } from '../../../src/data'
import { MINI_WORLD } from '../../fixtures/mini-world'
import { fresh } from './helpers'
import { indexData, makeCtx } from '../../../src/world/core'
import { bestWar, peacefulOpening } from '../../../src/ai/world/ruler'
import { riceNeeded } from '../../../src/ai/world/officer'

describe('W-AI-5 peaceful opening', () => {
  const real = createWorldApi(GAME_DATA)
  it('W-AI-5 a new 190 game has no army on the march and nobody inside one', () => {
    for (const seed of [1, 2, 3]) {
      const s = real.newGame({ scenario: GAME_DATA.scenarios[0]!.id, seed, officer: 'cao-cao' })
      expect(s.armies.length).toBe(0)
      expect(Object.values(s.officers).filter((o) => o.status === 'army').length).toBe(0)
    }
  })
  it('W-AI-5 no AI army is raised in the first three months, but they are allowed later', () => {
    const w = createWorldApi(MINI_WORLD)
    let s = w.newGame({ scenario: MINI_WORLD.scenarios[0]!.id, seed: 3, officer: MINI_WORLD.scenarios[0]!.officers.find((o) => !o.hidden)!.id })
    let months = 0
    let first = 0
    for (let i = 0; i < 400 && s.ym.year < 192; i++) {
      const prevM = s.ym.year * 12 + s.ym.month
      const r = w.step(s, w.autopilot(s))
      if (!r.ok) break
      s = r.state
      if (s.armies.length > 0 && first === 0) first = s.ym.year * 12 + s.ym.month
      void prevM
      months++
    }
    const start = MINI_WORLD.scenarios[0]!.year * 12 + MINI_WORLD.scenarios[0]!.month
    if (first !== 0) expect(first - start).toBeGreaterThanOrEqual(3)
  })
})

describe('W-AI-6 rice before troops', () => {
  const idx = indexData(MINI_WORLD)
  const setup = (rice: number) => fresh('xiahou-dun', 1, (x) => {
    x.options.events = false; x.pacts = []; x.ym = { year: 190, month: 5 }
    x.cities['wancheng']!.faction = null; x.cities['xuchang']!.troops = 8000; x.cities['xuchang']!.rice = rice
  })
  it('W-AI-6 a city short of rice sends no army; a rich one does', () => {
    expect(peacefulOpening(makeCtx(idx, setup(0)))).toBe(false)
    expect(bestWar(makeCtx(idx, setup(100)), 'f-cao-cao')).toBeNull()
    expect(bestWar(makeCtx(idx, setup(60000)), 'f-cao-cao')).not.toBeNull()
  })
  it('W-AI-6 the rice a garrison needs shrinks toward the harvest in month 9', () => {
    const s = setup(0)
    const c = makeCtx(idx, s)
    s.ym = { year: 190, month: 8 }
    expect(riceNeeded(c, 1000)).toBe(10)
    s.ym = { year: 190, month: 9 }
    expect(riceNeeded(c, 1000)).toBe(120)
  })
  it('W-AI-5 no war in the opening months', () => {
    const s = setup(60000)
    s.ym = { year: 190, month: 2 }
    expect(bestWar(makeCtx(idx, s), 'f-cao-cao')).toBeNull()
  })
})
