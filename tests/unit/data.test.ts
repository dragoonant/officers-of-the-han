import { describe, expect, it } from 'vitest'
import { GAME_DATA } from '../../src/data/index'
import { checkData, REQUIRED_EVENTS } from '../../tools/data/checks'

const sc = GAME_DATA.scenarios.find((s) => s.id === '190')!
const officer = (id: string) => GAME_DATA.officers.find((o) => o.id === id)!

describe('data: the validator checks (12-data.md section 6)', () => {
  it('passes every check', () => {
    expect(checkData(GAME_DATA)).toEqual([])
  })
})

describe('data: shape and counts', () => {
  it('has about 40-50 cities covering all thirteen provinces', () => {
    expect(GAME_DATA.cities.length).toBeGreaterThanOrEqual(40)
    expect(new Set(GAME_DATA.cities.map((c) => c.province)).size).toBe(13)
  })
  it('has at least 180 officers in 190 or appearing by 200, and 30 hidden', () => {
    const exist = sc.officers.length + sc.appearances.filter((a) => a.year <= 200).length
    expect(exist).toBeGreaterThanOrEqual(180)
    expect(sc.officers.filter((o) => o.hidden).length + sc.appearances.filter((a) => a.hidden).length).toBeGreaterThanOrEqual(30)
  })
  it('ships the required event slate', () => {
    const ids = GAME_DATA.events.map((e) => e.id)
    for (const id of REQUIRED_EVENTS) expect(ids).toContain(id)
  })
  it('every officer cites a source and a basis', () => {
    for (const o of GAME_DATA.officers) {
      expect(o.source.length, o.id).toBeGreaterThan(3)
      expect(o.basis.length, o.id).toBeGreaterThan(10)
    }
  })
})

describe('data: spot checks against the record', () => {
  it('Liu Bei, Guan Yu and Zhang Fei are one oath group', () => {
    expect(sc.oaths.some((g) => ['liu-bei', 'guan-yu', 'zhang-fei'].every((id) => g.includes(id)))).toBe(true)
  })
  it('Dong Zhuo rules a faction that holds Luoyang and Chang\'an', () => {
    const f = sc.factions.find((x) => x.ruler === 'dong-zhuo')!
    expect(f.capital).toBe('luoyang')
    const holds = sc.cities.filter((c) => c.faction === f.id).map((c) => c.id)
    expect(holds).toContain('luoyang')
    expect(holds).toContain('chang-an')
  })
  it('Zhuge Liang appears later than 190 and starts hidden', () => {
    const a = sc.appearances.find((x) => x.id === 'zhuge-liang')!
    expect(a.year).toBe(197)
    expect(a.hidden).toBe(true)
    expect(sc.officers.some((o) => o.id === 'zhuge-liang')).toBe(false)
  })
  it('Liu Bei serves Gongsun Zan as prefect of Pingyuan', () => {
    const s = sc.officers.find((o) => o.id === 'liu-bei')!
    expect(s.faction).toBe('f-gongsun-zan')
    expect(s.city).toBe('pingyuan')
    expect(s.post).toBe('prefect')
  })
  it('keeps the sibling game\'s stats where they exist', () => {
    expect(officer('lu-bu').stats.war).toBe(100)
    expect(officer('zhuge-liang').stats.int).toBe(100)
    expect(officer('guan-yu').stats.war).toBe(97)
  })
  it('the coalition factions are friendly and Dong Zhuo is hostile to them', () => {
    const rel = (a: string, b: string) => sc.relations.find((r) => (r.a === a && r.b === b) || (r.a === b && r.b === a))?.value
    expect(rel('f-cao-cao', 'f-sun-jian')).toBe(60)
    expect(rel('f-dong-zhuo', 'f-yuan-shao')!).toBeLessThanOrEqual(15)
  })
  it('the Hulao Gate event offers a duel against Lu Bu with the historical option first', () => {
    const e = GAME_DATA.events.find((x) => x.id === 'hulao-gate')!
    expect(e.options![0]!.contest).toBeUndefined()
    expect(e.options!.some((o) => o.contest?.kind === 'duel' && o.contest.b === 'lu-bu')).toBe(true)
  })
  it('officers who appear later are born late enough', () => {
    for (const a of sc.appearances) {
      const o = officer(a.id)
      expect(a.year, a.id).toBeGreaterThanOrEqual(o.born + 12)
    }
  })
  it('portraits copied for matching officers exist on disk (validator) and generic list is non-empty', () => {
    expect(GAME_DATA.genericPortraits.length).toBeGreaterThan(20)
    expect(GAME_DATA.officers.filter((o) => o.portrait).length).toBeGreaterThanOrEqual(30)
  })
})
