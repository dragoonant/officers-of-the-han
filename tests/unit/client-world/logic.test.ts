import { describe, expect, it } from 'vitest'
import type { ActionItem } from '../../../src/world/types'
import { collapseItems } from '../../../src/client/world/ActionBar'
import { createdProblem } from '../../../src/client/world/NewGame'
import { lineage, summarise } from '../../../src/client/world/End'
import { proposerArmy } from '../../../src/client/world/Dialogs'
import { RIVERS, projectX, projectY, riverBrush } from '../../../src/client/world/geo'
import { chanceText, costText } from '../../../src/client/world/format'
import { GAME_DATA } from '../../../src/data'
import { world } from '../../../src/world'

const item = (kind: string, label: string, available: boolean, reason: string | null): ActionItem => ({ group: 'Travel', kind: kind as ActionItem['kind'], label, action: { kind: 'rest' }, days: 5, gold: 0, available, reason, chance: null })

describe('client logic', () => {
  it('collapses unavailable actions that share a reason', () => {
    const out = collapseItems([item('travel', 'Travel to A', false, 'No'), item('travel', 'Travel to B', false, 'No'), item('travel', 'Travel to C', true, null)])
    expect(out.map((i) => i.label)).toEqual(['Travel', 'Travel to C'])
  })
  it('W-NEW-1 form mirrors the pool rule', () => {
    const ok = { name: 'A', born: 160, stats: { war: 64, ldr: 64, int: 64, pol: 64, cha: 64 } }
    expect(createdProblem(ok)).toBeNull()
    expect(createdProblem({ ...ok, name: ' ' })).toMatch(/name/)
    expect(createdProblem({ ...ok, born: 149 })).toMatch(/Birth/)
    expect(createdProblem({ ...ok, stats: { ...ok.stats, war: 96 } })).toMatch(/20 to 95/)
    expect(createdProblem({ ...ok, stats: { ...ok.stats, war: 70 } })).toMatch(/pool/)
  })
  it('the engine accepts what the form accepts', () => {
    const s = world.newGame({ scenario: '190', seed: 1, officer: { name: 'Form Test', sex: 'm', born: 150, stats: { war: 95, ldr: 95, int: 95, pol: 20, cha: 15 + 5 }, temperament: 'cautious', bestType: 'cavalry', city: 'chengdu' } })
    expect(s.officers[s.player]?.custom?.name).toBe('Form Test')
  })
  it('W-END-3 summarises the lineage from the log', () => {
    const s = world.newGame({ scenario: '190', seed: 1, officer: 'liu-bei' })
    const ids = lineage(s)
    expect(ids).toContain('liu-bei')
    const sum = summarise(s, ids)
    expect(sum.lines.length).toBeGreaterThan(0)
  })
  it('a proposer always leads the army they propose', () => {
    const s = world.newGame({ scenario: '190', seed: 1, officer: 'liu-bei' })
    const u = proposerArmy(s, 'pingyuan', 'beihai')
    expect(u.filter((x) => x.commander).map((x) => x.officer)).toEqual(['liu-bei'])
    expect(u.length).toBeLessThanOrEqual(5)
  })
  it('river polylines stay on the tray and are drawn', () => {
    expect(RIVERS.map((r) => r.id)).toEqual(['yellow', 'yangtze', 'han', 'huai', 'wei'])
    for (const r of RIVERS) {
      expect(riverBrush(r).startsWith('M')).toBe(true)
      for (const [lon, lat] of r.points) {
        expect(projectX(lon)).toBeGreaterThan(0)
        expect(projectX(lon)).toBeLessThan(900)
        expect(projectY(lat)).toBeGreaterThan(-40)
        expect(projectY(lat)).toBeLessThan(820)
      }
    }
  })
  it('the projection matches the data for Luoyang', () => {
    const l = GAME_DATA.cities.find((c) => c.id === 'luoyang')!
    expect(Math.abs(projectX(l.lon) - l.x)).toBeLessThan(2)
    expect(Math.abs(projectY(l.lat) - l.y)).toBeLessThan(2)
  })
  it('formats costs and chances', () => {
    expect(costText(1, 0)).toBe('1 day')
    expect(costText(10, 20)).toBe('10 days, 20 gold')
    expect(chanceText(50, 'you find gold')).toBe('50% you find gold')
    expect(chanceText(null)).toBeNull()
  })
})
