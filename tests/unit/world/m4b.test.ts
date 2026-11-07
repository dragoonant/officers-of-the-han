import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { W, act, fresh, calm } from './helpers'
import { ArmyForm } from '../../../src/client/world/Dialogs'

describe('M4b suggestArmy with a proposer (W-PROP-1)', () => {
  it('W-PROP-1 query.suggestArmy(.., proposer) lists the proposer first as sole commander, with their best troop type', () => {
    const s = fresh('cao-ren', 1, calm)
    const plain = W.query.suggestArmy(s, 'xuchang', 'wancheng')
    const led = W.query.suggestArmy(s, 'xuchang', 'wancheng', 'cao-ren')
    expect(led.length).toBeGreaterThan(0)
    expect(led[0]!.officer).toBe('cao-ren')
    expect(led.filter((u) => u.commander).map((u) => u.officer)).toEqual(['cao-ren'])
    const apt = W.query.officerView(s, 'cao-ren')!.aptitude
    for (const t of ['spear', 'cavalry', 'archer'] as const) expect('ABC'.indexOf(apt[led[0]!.type])).toBeLessThanOrEqual('ABC'.indexOf(apt[t]))
    expect(plain.length).toBeGreaterThan(0)
  })
  it('W-PROP-1 a proposer who cannot march gets no army; a propose without units uses the led army', () => {
    const s = fresh('cao-ren', 1, (x) => { calm(x); x.pacts = []; x.cities['wancheng']!.faction = 'f-dong-zhuo'; x.cities['wancheng']!.troops = 500 })
    expect(W.query.suggestArmy(s, 'xuchang', 'wancheng', 'li-jue')).toEqual([])
    const n = act(s, { kind: 'propose', proposal: 'war', to: 'wancheng' })
    expect(n.officers['cao-ren']!.proposedThisMonth).toBe(true)
  })
})

describe('M4b ArmyForm is safe without a route', () => {
  it('renders a not-available state for a missing city instead of throwing', () => {
    const s = fresh('cao-cao', 1, calm)
    const html = renderToStaticMarkup(createElement(ArmyForm, { s, from: '', to: '', units: [], setUnits: () => undefined }))
    expect(html).toContain('army-unavailable')
    const html2 = renderToStaticMarkup(createElement(ArmyForm, { s, from: 'xuchang', to: 'nowhere', units: [], setUnits: () => undefined }))
    expect(html2).toContain('Not available')
  })
})
