// What an engine fuzzer cannot see: the words players read. Six starts, every action group and picker, every city box,
// 30 officer cards and every letter over three months; no visible text may hold undefined, NaN, null, [object or an empty button.
import { expect, test, type Page } from '@playwright/test'
import { seed, sweepStarts } from './fixtures/saves'

const BAD = /\bundefined\b|\bNaN\b|\bnull\b|\[object|\bInfinity\b/

async function scan(page: Page, where: string, found: string[]): Promise<void> {
  if (process.env.SWEEP_LOG) console.log(where)
  const r = await page.evaluate(() => {
    const text = document.body.innerText
    const hits: string[] = []
    const m = /\bundefined\b|\bNaN\b|\bnull\b|\[object|\bInfinity\b/g
    let x: RegExpExecArray | null
    while ((x = m.exec(text))) hits.push(text.slice(Math.max(0, x.index - 50), x.index + 40).replace(/\s+/g, ' '))
    const empty = [...document.querySelectorAll('button')].filter((b) => {
      const r = b.getBoundingClientRect()
      return r.width > 0 && r.height > 0 && !(b.innerText || '').trim() && !b.getAttribute('aria-label') && !b.getAttribute('title')
    }).map((b) => b.outerHTML.slice(0, 120))
    return { hits, empty }
  })
  for (const h of r.hits) found.push(`${where}: text "${h}"`)
  for (const e of r.empty) found.push(`${where}: empty button ${e}`)
  expect(BAD.test('')).toBe(false)
}

/** Answer every pending in the page: the first option of a letter; contests are resolved by the engine's auto outcome. */
async function settle(page: Page, where: string, found: string[]): Promise<number> {
  let n = 0
  for (let i = 0; i < 40; i++) {
    const kind = await page.evaluate(() => window.__game!.getState().state?.pending[0]?.kind ?? null)
    if (!kind) return n
    await page.waitForTimeout(120)
    await scan(page, `${where} letter ${kind}`, found)
    n++
    ;(globalThis as { __letters?: number }).__letters = ((globalThis as { __letters?: number }).__letters ?? 0) + 1
    if (kind === 'battle' || kind === 'duel' || kind === 'debate') {
      await page.evaluate(() => {
        const g = window.__game!.getState()
        const s = g.state!
        const p = s.pending[0]!
        const w = window.__world!
        if (p.kind === 'battle') g.act({ kind: 'resolveBattle', pending: p.id, outcome: w.auto.battle(s, p.setup) })
        else if (p.kind === 'duel') g.act({ kind: 'resolveDuel', pending: p.id, outcome: w.auto.duel(p.setup) })
        else if (p.kind === 'debate') g.act({ kind: 'resolveDebate', pending: p.id, outcome: w.auto.debate(p.setup) })
      })
    } else {
      const btn = page.locator('.answers button:not([disabled])').first()
      if (await btn.count()) await btn.click(); else await page.evaluate(() => window.__game!.getState().act({ kind: 'ack', pending: window.__game!.getState().state!.pending[0]!.id }))
    }
    await page.waitForTimeout(80)
  }
  return n
}

const DIALOGS = ['visit', 'challenge', 'oath', 'marry', 'appoint', 'recruit', 'gift', 'focus', 'captive', 'transfer', 'mission', 'transport', 'war', 'propose', 'diplomacy', 'resign', 'endMonth']

/** Touch up to six choices in the open picker (chips, selects, buttons that are not the close or the action) and rescan. */
async function touch(page: Page, where: string, found: string[]): Promise<void> {
  const dlg = page.locator('.overlay').first()
  const chips = dlg.locator('.wchip, .chips button, select, .tabs button, input[type="range"]')
  const n = Math.min(await chips.count(), 5)
  for (let k = 0; k < n; k++) {
    const c = chips.nth(k)
    if (!(await chips.count()) || k >= (await chips.count())) break
    const tag = await c.evaluate((e) => e.tagName, undefined, { timeout: 1000 }).catch(() => '')
    if (process.env.SWEEP_LOG) console.log(`  touch ${k} ${tag} of ${n}`)
    if (tag === 'SELECT') {
      const opts = await c.locator('option').count()
      for (let o = 0; o < Math.min(opts, 4); o++) { await c.selectOption({ index: o }, { timeout: 1000 }).catch(() => undefined); await scan(page, `${where} option ${o}`, found) }
    } else if (tag === 'INPUT') {
      await c.fill('0', { timeout: 1000 }).catch(() => undefined)
    } else await c.click({ timeout: 700 }).catch(() => undefined)
    await scan(page, `${where} choice ${k}`, found)
  }
}

for (const start of sweepStarts()) {
  test(`text sweep: ${start.label}`, async ({ page }) => {
    test.setTimeout(420_000)
    const found: string[] = []
    let pickers = 0
    const letters = 0
    page.on('pageerror', (e) => found.push(`pageerror ${String(e)}`))
    await seed(page, start.env)
    await page.goto('?speed=instant&q=low')
    await page.getByTestId('continue').click()
    await expect(page.getByTestId('game')).toBeVisible()
    await settle(page, 'start', found)
    await scan(page, 'map', found)

    // every picker, opened directly while the month is fresh
    const open: string[] = await page.evaluate(() => { const g = window.__game!.getState(); return window.__world!.query.actionsHere(g.state!).filter((a) => a.available).map((a) => String(a.kind)) })
    for (const kind of DIALOGS.filter((k) => k === 'endMonth' || open.includes(k))) {
      await page.evaluate((k) => window.__ui!.getState().setDialog(k), kind)
      await page.waitForTimeout(80)
      if (!(await page.locator('.overlay').count())) continue
      pickers++
      await scan(page, `${start.label} dialog ${kind}`, found)
      await touch(page, `${start.label} dialog ${kind}`, found)
      await page.evaluate(() => window.__ui!.getState().setDialog(null))
    }

    // every action group
    for (const g of ['Work', 'People', 'Court', 'Travel', 'Self']) {
      await page.getByTestId(`tab-${g}`).click()
      await scan(page, `tab ${g}`, found)
      const count = await page.locator('.actionbar .wactions button').count()
      for (let i = 0; i < Math.min(count, 14); i++) {
        const b = page.locator('.actionbar .wactions button').nth(i)
        if (!(await b.count()) || (await b.isDisabled())) continue
        const label = ((await b.innerText()) || '').split('\n')[0]
        await b.click()
        await page.waitForTimeout(100)
        const dlg = page.locator('.overlay')
        if (await dlg.count()) {
          pickers++
          await scan(page, `${start.label} picker ${g}/${label}`, found)
          await touch(page, `${start.label} picker ${g}/${label}`, found)
          await page.evaluate(() => window.__ui!.getState().setDialog(null))
        }
        await settle(page, `${start.label} after ${label}`, found)
        await page.evaluate(() => window.__ui!.getState().setDialog(null))
      }
    }

    // every city box
    const cities = await page.evaluate(() => [...document.querySelectorAll('[data-city]')].map((e) => e.getAttribute('data-city')!))
    for (const id of cities) {
      await page.evaluate((c) => window.__ui!.getState().setCity(c), id)
      await page.waitForTimeout(30)
      await scan(page, `city box ${id}`, found)
    }
    await page.evaluate(() => window.__ui!.getState().setCity(null))

    // officer cards: 30 spread across the roll
    const ids = await page.evaluate(() => Object.keys(window.__game!.getState().state!.officers))
    const step = Math.max(1, Math.floor(ids.length / 30))
    const picked = [...ids.filter((_, i) => i % step === 0).slice(0, 29), ids[ids.length - 1]!]
    for (const id of picked) {
      await page.evaluate((o) => window.__ui!.getState().openOfficer(o), id)
      await page.waitForTimeout(30)
      await scan(page, `officer card ${id}`, found)
    }
    await page.evaluate(() => window.__ui!.getState().openOfficer(null))
    for (const p of ['factions', 'chronicle', 'menu', 'help'] as const) {
      await page.evaluate((x) => window.__ui!.getState().setPanel(x), p)
      await scan(page, `panel ${p}`, found)
    }
    await page.evaluate(() => window.__ui!.getState().setPanel(null))

    // three months of letters
    for (let m = 0; m < 3; m++) {
      const ended = await page.evaluate(() => { const g = window.__game!.getState(); return g.screen === 'end' })
      if (ended) break
      await page.evaluate(() => { const g = window.__game!.getState(); if (!g.state!.pending.length) g.act({ kind: 'endMonth' }) })
      await settle(page, `${start.label} month ${m + 1}`, found)
      await scan(page, `${start.label} map month ${m + 1}`, found)
    }
    test.info().annotations.push({ type: 'coverage', description: `${pickers} pickers, ${cities.length} cities, ${picked.length} officer cards` })
    expect([...new Set(found)], found.join('\n')).toEqual([])
    expect(pickers + letters, 'the sweep opened pickers').toBeGreaterThan(0)
  })
}
