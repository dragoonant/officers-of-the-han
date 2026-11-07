import { describe, expect, it } from 'vitest'
import { seedRng } from '../../../src/shared/rng'
import { W, J, act, rej, fresh, calm, endMonth, tryRolls } from './helpers'

describe('W-TIE', () => {
  it('W-TIE-1 friendship defaults to 20 and visits raise it', () => {
    let s = fresh('xiahou-dun', 1, calm)
    delete s.friendships['cao-ren|xiahou-dun']
    expect(W.query.officerView(s, 'xiahou-dun')!.ties.find((t) => t.other === 'cao-ren')?.value ?? 20).toBe(20)
    s = act(s, { kind: 'visit', officer: 'cao-ren' })
    expect(s.friendships['cao-ren|xiahou-dun']).toBe(25)
  })
  it('W-TIE-2 compatibility: same +2, righteous-ambitious -2, cautious-reckless -2', () => {
    let s = fresh('xiahou-dun', 1, calm)
    s.officers['xiahou-yuan']!.city = 'xuchang'
    s.friendships['xiahou-dun|xiahou-yuan'] = 30
    s = act(s, { kind: 'visit', officer: 'xiahou-yuan' }) // righteous vs steady = 0: +3 + floor(70/25)=2
    expect(s.friendships['xiahou-dun|xiahou-yuan']).toBe(35)
    let t = fresh('xiahou-dun', 1, calm)
    t.friendships['cao-cao|xiahou-dun'] = 30
    t = act(t, { kind: 'visit', officer: 'cao-cao' }) // righteous vs ambitious = -2
    expect(t.friendships['cao-cao|xiahou-dun']).toBe(30 + 3 + 2 - 2)
  })
  it('W-TIE-3 oath siblings: groups of 2-4 via the oath action, merged', () => {
    let s = fresh('liu-bei', 1, calm)
    s.officers['liu-bei']!.city = 'wancheng'
    expect(s.oaths[0]).toEqual(['liu-bei', 'guan-yu', 'zhang-fei'])
    s.officers['pang-tong']!.hidden = false
    s.officers['pang-tong']!.city = 'wancheng'
    s.friendships['liu-bei|pang-tong'] = 85
    s = act(s, { kind: 'oath', officer: 'pang-tong' })
    expect(s.oaths[s.officers['liu-bei']!.oathGroup!]!.length).toBe(4)
    s.officers['zhuge-liang']!.hidden = false
    s.officers['zhuge-liang']!.city = 'wancheng'
    s.friendships['liu-bei|zhuge-liang'] = 85
    expect(rej(s, { kind: 'oath', officer: 'zhuge-liang' }).code).toBe('not-legal')
  })
  it('W-TIE-4 spouse: at most one, kin from data', () => {
    const s = fresh('lu-bu')
    expect(s.officers['lu-bu']!.spouse).toBe('diaochan')
    expect(s.officers['diaochan']!.spouse).toBe('lu-bu')
    const t = fresh('lu-bu', 1, calm)
    t.friendships['lu-bu|li-ru'] = 90
    expect(rej(t, { kind: 'marry', officer: 'li-ru' }).code).toBe('not-legal')
  })
  it('W-TIE-5 rivals never accept: recruit, oath and marriage are refused', () => {
    let s = fresh('xun-yu', 1, calm)
    s.officers['li-ru']!.city = 'xuchang'
    s.friendships['li-ru|xun-yu'] = 90
    expect(rej(s, { kind: 'oath', officer: 'li-ru' }).code).toBe('not-legal')
    expect(rej(s, { kind: 'marry', officer: 'li-ru' }).code).toBe('not-legal')
    s = fresh('xun-yu', 1, calm)
    s.officers['xiahou-yuan']!.city = 'xuchang'
    s.friendships['xiahou-yuan|xun-yu'] = 3
    s.officers['xiahou-yuan']!.post = 'wanderer'; s.officers['xiahou-yuan']!.faction = null
    expect(rej(s, { kind: 'recruit', officer: 'xiahou-yuan', mode: 'persuade' }).code).toBe('not-legal')
  })
  it('W-TIE-6 an officer bound to the lord has loyalty fixed at 100', () => {
    let s = fresh('xiahou-dun', 1, calm)
    s.officers['cao-ren']!.loyalty = 40
    s = endMonth(s, true)
    expect(s.officers['cao-ren']!.loyalty).toBe(100) // sibling of Cao Cao
  })
  it('W-TIE-7 battle comrades gain +2 friendship', () => {
    let s = fresh('cao-cao', 1, calm)
    s.pacts = []
    s.cities['wancheng']!.faction = 'f-dong-zhuo'
    s.cities['wancheng']!.troops = 100
    const units = [
      { officer: 'xiahou-dun', troops: 3000, type: 'spear' as const, commander: true },
      { officer: 'xiahou-yuan', troops: 3000, type: 'archer' as const, commander: false },
    ]
    s.friendships['xiahou-dun|xiahou-yuan'] = 30
    s = act(s, { kind: 'war', from: 'xuchang', to: 'wancheng', units })
    s = endMonth(s, true)
    expect(s.friendships['xiahou-dun|xiahou-yuan']).toBeGreaterThanOrEqual(32)
  })
})

describe('W-LOY', () => {
  it('W-LOY-1 loyalty moves 2 toward the target each month end', () => {
    let s = fresh('xiahou-dun', 1, calm)
    s.cities['xuchang']!.gold = 100
    s.officers['xiahou-yuan']!.loyalty = 90
    s.officers['xiahou-yuan']!.merit = 0
    s.friendships['cao-cao|xiahou-yuan'] = 20
    s = endMonth(s, true)
    expect(s.officers['xiahou-yuan']!.loyalty).toBe(88)
  })
  it('W-LOY-2 an AI officer with loyalty below 30 may resign', () => {
    let s = fresh('cao-cao', 1, calm)
    s.officers['xiahou-yuan']!.loyalty = 1
    s.officers['xiahou-yuan']!.merit = 0
    s.friendships['cao-cao|xiahou-yuan'] = 0
    s.cities['xuchang']!.gold = 0
    s.cities['xuchang']!.trade = 0
    let gone = false
    for (let i = 1; i < 40 && !gone; i++) {
      const t = J(s)
      t.rng = seedRng(i * 31)
      const r = W.step(t, { kind: 'endMonth' })
      if (r.ok) gone = r.state.officers['xiahou-yuan']!.faction === null
    }
    expect(gone).toBe(true)
  })
  it('W-LOY-3 an ambitious prefect with loyalty below 25 may rebel and found a faction', () => {
    let s = fresh('cao-cao', 1, calm)
    s.officers['li-jue']!.city = 'changan'
    s.cities['changan']!.prefect = 'li-jue'
    s.officers['li-jue']!.post = 'prefect'
    s.officers['li-jue']!.loyalty = 5
    s.cities['changan']!.prefect = 'li-jue'
    s.cities['changan']!.gold = 0
    s.cities['changan']!.trade = 0
    s.officers['hua-xiong']!.post = 'officer'
    let rebelled = false
    for (let i = 1; i < 400 && !rebelled; i++) {
      const t = J(s)
      t.rng = seedRng(i * 31)
      const r = W.step(t, { kind: 'endMonth' })
      if (r.ok && r.state.cities['changan']!.faction !== 'f-dong-zhuo' && r.state.officers['li-jue']!.post === 'ruler') { rebelled = true; expect(W.invariants(r.state)).toEqual([]) }
    }
    expect(rebelled).toBe(true)
  })
})

describe('W-WORK', () => {
  const run = (work: 'farm' | 'trade' | 'walls' | 'order' | 'train' | 'draft', before: (s: ReturnType<typeof fresh>) => void, check: (a: ReturnType<typeof fresh>, b: ReturnType<typeof fresh>) => void): void => {
    const s0 = fresh('xun-yu', 1, (s) => { calm(s); before(s) })
    const s1 = act(s0, { kind: 'work', work })
    expect(s1.officers['xun-yu']!.days).toBe(20)
    expect(s1.officers['xun-yu']!.merit).toBe(s0.officers['xun-yu']!.merit + 20)
    check(s0, s1)
  }
  const xy = { pol: 95, ldr: 40, cha: 75 } // Xun Yu: POL 95, LDR 40, CHA 75
  it('W-WORK-FARM farm += 4 + POL/6, gold 20', () => run('farm', () => {}, (a, b) => { expect(b.cities['xuchang']!.farm - a.cities['xuchang']!.farm).toBe(4 + Math.floor(xy.pol / 6)); expect(a.cities['xuchang']!.gold - b.cities['xuchang']!.gold).toBe(20) }))
  it('W-WORK-TRADE trade += 4 + POL/6, gold 20', () => run('trade', () => {}, (a, b) => { expect(b.cities['xuchang']!.trade - a.cities['xuchang']!.trade).toBe(4 + Math.floor(xy.pol / 6)); expect(a.cities['xuchang']!.gold - b.cities['xuchang']!.gold).toBe(20) }))
  it('W-WORK-WALLS walls += 4 + LDR/6, gold 30', () => run('walls', () => {}, (a, b) => { expect(b.cities['xuchang']!.walls - a.cities['xuchang']!.walls).toBe(4 + Math.floor(xy.ldr / 6)); expect(a.cities['xuchang']!.gold - b.cities['xuchang']!.gold).toBe(30) }))
  it('W-WORK-ORDER order += 1 + CHA/20, gold 10', () => run('order', (s) => { s.cities['xuchang']!.order = 50 }, (a, b) => { expect(b.cities['xuchang']!.order - a.cities['xuchang']!.order).toBe(1 + Math.floor(xy.cha / 20)); expect(a.cities['xuchang']!.gold - b.cities['xuchang']!.gold).toBe(10) }))
  it('W-WORK-TRAIN training += 2 + LDR/12, no gold', () => run('train', (s) => { s.cities['xuchang']!.training = 40 }, (a, b) => { expect(b.cities['xuchang']!.training - a.cities['xuchang']!.training).toBe(2 + Math.floor(xy.ldr / 12)); expect(a.cities['xuchang']!.gold).toBe(b.cities['xuchang']!.gold) }))
  it('W-WORK-DRAFT drafts min(pop/50, 300+CHA*5), costs ceil(n/10), lowers order and training', () => run('draft', (s) => { s.cities['xuchang']!.population = 10000 }, (a, b) => {
    const n = Math.min(Math.floor(10000 / 50), 300 + 75 * 5)
    expect(b.cities['xuchang']!.troops - a.cities['xuchang']!.troops).toBe(n)
    expect(b.cities['xuchang']!.population).toBe(10000 - n)
    expect(a.cities['xuchang']!.gold - b.cities['xuchang']!.gold).toBe(Math.ceil(n / 10))
    expect(b.cities['xuchang']!.order).toBe(a.cities['xuchang']!.order - 2)
    expect(b.cities['xuchang']!.training).toBe(Math.floor((a.cities['xuchang']!.training * a.cities['xuchang']!.troops) / (a.cities['xuchang']!.troops + n)))
  }))
  it('W-WORK-1 results are capped at their max and the city must hold the gold', () => {
    let s = fresh('xun-yu', 1, (x) => { calm(x); x.cities['xuchang']!.farm = 999 })
    s = act(s, { kind: 'work', work: 'farm' })
    expect(s.cities['xuchang']!.farm).toBe(1000)
    expect(rej(s, { kind: 'work', work: 'farm' }).code).toBe('not-legal')
    const t = fresh('xun-yu', 1, (x) => { calm(x); x.cities['xuchang']!.gold = 5 })
    expect(rej(t, { kind: 'work', work: 'trade' }).code).toBe('no-gold')
  })
})
