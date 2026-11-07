import { expect, test, type Page } from '@playwright/test'

const LAB = 'lab.html?speed=instant&q=low'

async function startBattle(page: Page): Promise<void> {
  await page.goto(LAB)
  await page.click('#lab-start-battle')
  await expect(page.getByTestId('battle-screen')).toBeVisible()
  await expect(page.getByTestId('action-bar')).toBeVisible({ timeout: 60_000 })
}
const cam = (page: Page) => page.evaluate(() => window.__oth!.view.camera())

test('the lab battle plays to an outcome at Instant speed with the AI commanding', async ({ page }) => {
  await startBattle(page)
  await page.click('#ai-toggle')
  await expect(page.getByTestId('end-banner')).toBeVisible({ timeout: 200_000 })
  const lines = await page.getByTestId('feed').innerText()
  expect(lines.length).toBeGreaterThan(20)
  await page.click('#battle-done')
  await expect(page.getByText('Battle report')).toBeVisible()
})

test('a tap on the tile drawn behind a standing figure reaches that tile (rule 25)', async ({ page }) => {
  await startBattle(page)
  const pick = await page.evaluate(() => {
    const o = window.__oth!
    const s = o.store.getState().state!
    const marks = (window as unknown as { __marks: { q: number; r: number; kind: string }[] }).__marks
    const moves = marks.filter((m) => m.kind === 'move')
    const units = s.units.filter((u) => !u.routed)
    let best: { q: number; r: number; d: number } | null = null
    for (const m of moves) {
      const t = o.view.tileToScreen(m.q, m.r)!
      for (const u of units) {
        const p = o.view.tileToScreen(u.q, u.r)!
        const dy = p.y - t.y
        const dx = Math.abs(p.x - t.x)
        if (dx < 22 && dy > 8 && dy < 80) {
          const d = dx + Math.abs(dy - 30)
          if (!best || d < best.d) best = { q: m.q, r: m.r, d }
        }
      }
    }
    return best
  })
  expect(pick, 'a move tile hidden behind a figure').not.toBeNull()
  const pt = await page.evaluate((p) => window.__oth!.view.tileToScreen(p!.q, p!.r)!, pick)
  const before = await page.evaluate(() => { const s = window.__oth!.store.getState().state!; return s.active })
  await page.mouse.click(pt.x, pt.y)
  await expect
    .poll(() => page.evaluate((id) => { const u = window.__oth!.store.getState().state!.units.find((x) => x.id === id)!; return [u.q, u.r] }, before), { timeout: 20_000 })
    .toEqual([pick!.q, pick!.r])
})

test('mouse: wheel zooms, left drag pans until a middle press, middle pans, right rotates', async ({ page }) => {
  await startBattle(page)
  await page.evaluate(() => localStorage.removeItem('oth-mouse'))
  const c0 = await cam(page)
  await page.mouse.move(500, 420)
  await page.mouse.wheel(0, -400)
  await expect.poll(async () => (await cam(page)).zoom).toBeGreaterThan(c0.zoom + 0.05)
  await page.evaluate(() => window.__oth!.view.reset())
  await expect.poll(async () => (await cam(page)).zoom).toBeLessThan(0.02)
  await page.evaluate(() => window.__oth!.view.setView({ zoom: 0.4, x: 0, z: 0 }))
  const a = await cam(page)
  // fresh profile: the left drag pans
  await page.mouse.move(500, 420)
  await page.mouse.down()
  await page.mouse.move(580, 450, { steps: 6 })
  await page.mouse.up()
  const b = await cam(page)
  expect(Math.hypot(b.tx - a.tx, b.tz - a.tz)).toBeGreaterThan(0.2)
  // middle drag pans
  await page.mouse.move(500, 420)
  await page.mouse.down({ button: 'middle' })
  await page.mouse.move(430, 400, { steps: 6 })
  await page.mouse.up({ button: 'middle' })
  const c = await cam(page)
  expect(Math.hypot(c.tx - b.tx, c.tz - b.tz)).toBeGreaterThan(0.2)
  expect(await page.evaluate(() => localStorage.getItem('oth-mouse'))).toBe('middle')
  // now the left drag only picks
  await page.mouse.move(500, 420)
  await page.mouse.down()
  await page.mouse.move(600, 470, { steps: 6 })
  await page.mouse.up()
  const d = await cam(page)
  expect(Math.hypot(d.tx - c.tx, d.tz - c.tz)).toBeLessThan(0.01)
  // right drag rotates
  await page.mouse.move(500, 420)
  await page.mouse.down({ button: 'right' })
  await page.mouse.move(580, 420, { steps: 6 })
  await page.mouse.up({ button: 'right' })
  const e = await cam(page)
  expect(Math.abs(e.az - d.az)).toBeGreaterThan(0.2)
})

test.describe('phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
  test('the HUD fits 390x844 and nothing selects (rule 24)', async ({ page }) => {
    await startBattle(page)
    const r = await page.evaluate(() => {
      const box = (sel: string) => { const e = document.querySelector(sel); if (!e) return null; const b = e.getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, b: b.bottom } }
      return { w: window.innerWidth, h: window.innerHeight, sw: document.documentElement.scrollWidth, init: box('.initiative'), bar: box('.actions'), us: getComputedStyle(document.body).userSelect }
    })
    expect(r.sw).toBeLessThanOrEqual(r.w)
    expect(r.init!.r).toBeLessThanOrEqual(r.w + 1)
    expect(r.bar!.r).toBeLessThanOrEqual(r.w + 1)
    expect(r.bar!.b).toBeLessThanOrEqual(r.h + 1)
    expect(r.us).toBe('none')
    const el = page.locator('.hint, .ticker, .card-phone .nm').first()
    await el.click({ clickCount: 3, force: true })
    expect(await page.evaluate(() => String(getSelection()))).toBe('')
  })
})

test('a duel plays to an outcome', async ({ page }) => {
  await page.goto(LAB)
  await page.click('#tab-duel')
  await page.click('#lab-start-duel')
  await expect(page.getByTestId('duel-screen')).toBeVisible()
  for (let i = 0; i < 14 && !(await page.getByTestId('duel-result').isVisible()); i++) {
    const mighty = page.locator('#stance-mighty')
    if (await mighty.isEnabled()) await mighty.click()
    else await page.click(i % 2 ? '#stance-guard' : '#stance-strike')
  }
  await expect(page.getByTestId('duel-result')).toBeVisible()
  await page.click('#duel-done')
  await expect(page.getByText('Duel result')).toBeVisible()
})

test('a debate plays to an outcome', async ({ page }) => {
  await page.goto(LAB)
  await page.click('#tab-debate')
  await page.click('#lab-start-debate')
  await expect(page.getByTestId('debate-screen')).toBeVisible()
  for (let i = 0; i < 8 && !(await page.getByTestId('debate-result').isVisible()); i++) await page.locator('.tray .tally.play').first().click()
  await expect(page.getByTestId('debate-result')).toBeVisible()
  await page.click('#debate-done')
  await expect(page.getByText('Debate result')).toBeVisible()
})
