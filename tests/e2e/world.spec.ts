// World client e2e. Run with PW_PORT=5322 npx playwright test tests/e2e/world.spec.ts
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium, expect, test, type BrowserContext, type Page } from '@playwright/test'

const FALLBACK = '/opt/pw-browsers/chromium'
const exe = existsSync(FALLBACK) ? { executablePath: FALLBACK } : {}
const PORT = Number(process.env.PW_PORT ?? 5317)
const BASE = `http://localhost:${PORT}/officers-of-the-han/`
const SHOTS = process.env.SHOTS === '1'

async function startAs(page: Page, id: string, seed = 1): Promise<void> {
  await page.goto('./')
  await page.getByTestId('new-officer').click()
  const confirm = page.getByTestId('confirm-new-yes')
  if (await confirm.isVisible().catch(() => false)) await confirm.click()
  await page.getByTestId('seed').fill(String(seed))
  await page.locator(`[data-pick="${id}"]`).click()
  await page.getByTestId('start-game').click()
  await expect(page.getByTestId('game')).toBeVisible()
}

const daysLeft = async (page: Page): Promise<number> => Number(await page.getByTestId('days-left').innerText())
const monthLabel = async (page: Page): Promise<string> => (await page.getByTestId('month-dial').getAttribute('aria-label')) ?? ''
async function chronicleCount(page: Page): Promise<number> {
  await page.getByTestId('open-chronicle').click()
  const t = await page.getByTestId('chronicle-panel').innerText()
  await page.getByRole('button', { name: 'Close' }).click()
  return Number(/of (\d+) entries/.exec(t)?.[1] ?? -1)
}

/** Answer every letter on the screen with its first (primary) button. */
async function answerLetters(page: Page): Promise<number> {
  let n = 0
  for (let i = 0; i < 12; i++) {
    const letter = page.getByTestId('letter')
    const stand = page.getByTestId('resolve-numbers')
    const battle = page.getByTestId('battle-open')
    if (await battle.isVisible().catch(() => false)) { await battle.click(); continue }
    if (await stand.isVisible().catch(() => false)) { await stand.click(); n++; continue }
    if (!(await letter.isVisible().catch(() => false))) break
    await letter.locator('button.lbtn').first().click()
    n++
  }
  return n
}

test.describe('world client', () => {
  test('new game as Liu Bei, work, end the month, answer a letter, then Continue restores the spot (persistent profile)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'oth-pw-'))
    let ctx: BrowserContext | null = null
    try {
      ctx = await chromium.launchPersistentContext(dir, { ...exe, baseURL: BASE, viewport: { width: 1180, height: 760 }, args: ['--no-sandbox'] })
      let page = ctx.pages()[0] ?? (await ctx.newPage())
      const errors: string[] = []
      page.on('pageerror', (e) => errors.push(String(e)))
      await startAs(page, 'liu-bei', 1)
      expect(await monthLabel(page)).toContain('January 190')
      expect(await daysLeft(page)).toBe(30)

      await page.getByTestId('act-work').first().click() // Farm work
      await expect.poll(() => daysLeft(page)).toBeLessThan(30)

      await page.getByTestId('end-month').click()
      await page.getByTestId('confirm-endmonth').click()
      await expect.poll(async () => (await page.getByTestId('letter').isVisible()) || (await monthLabel(page)).includes('February')).toBe(true)
      const answered = await answerLetters(page)
      expect(answered).toBeGreaterThan(0)
      expect(await monthLabel(page)).toContain('February 190')
      expect(await daysLeft(page)).toBe(30)
      const logBefore = await chronicleCount(page)
      expect(logBefore).toBeGreaterThan(0)
      const purseBefore = await page.getByTestId('purse').innerText()

      // close the page, open a new one in the same profile: Continue
      await page.close()
      page = await ctx.newPage()
      await page.goto('./')
      await expect(page.getByTestId('continue-line')).toContainText('Liu Bei')
      await expect(page.getByTestId('continue-line')).toContainText('February 190')
      await page.getByTestId('continue').click()
      await expect(page.getByTestId('game')).toBeVisible()
      expect(await monthLabel(page)).toContain('February 190')
      expect(await daysLeft(page)).toBe(30)
      expect(await chronicleCount(page)).toBe(logBefore)
      expect(await page.getByTestId('purse').innerText()).toBe(purseBefore)

      // save survives a reload too, and Discard asks once more
      await page.reload()
      await page.getByTestId('discard-save').click()
      await page.getByTestId('confirm-discard-yes').click()
      await expect(page.getByTestId('continue-line')).toContainText('No saved game')
      expect(errors).toEqual([])
    } finally {
      await ctx?.close()
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test('create an officer and start as a wanderer', async ({ page }) => {
    await page.goto('./')
    await page.getByTestId('new-officer').click()
    await page.getByTestId('tab-create').click()
    await expect(page.getByTestId('c-problem')).toBeVisible() // no name yet
    await page.getByTestId('c-name').fill('Lin Wei')
    await page.getByTestId('c-city').selectOption('luoyang')
    await expect(page.getByTestId('c-problem')).toHaveCount(0)
    await page.getByTestId('start-created').click()
    await expect(page.getByTestId('game')).toBeVisible()
    await expect(page.getByTestId('hud')).toContainText('Lin Wei')
    await expect(page.getByTestId('hud')).toContainText('Wanderer')
    await expect(page.getByTestId('hud')).toContainText('Luoyang')
    // a wanderer can ask to serve: the action bar names the engine's reasons for what it cannot do
    await page.getByTestId('tab-People').click()
    await expect(page.getByTestId('actionbar')).toContainText('Recruit')
  })

  test('a corrupt save is explained and can be discarded', async ({ page }) => {
    await page.goto('./')
    await page.evaluate(() => localStorage.setItem('oth-save', '{not json'))
    await page.reload()
    await expect(page.getByTestId('save-broken')).toContainText('damaged')
    await page.getByTestId('discard-broken').click()
    await page.getByTestId('confirm-discard-yes').click()
    await expect(page.getByTestId('save-broken')).toHaveCount(0)
    await page.evaluate(() => localStorage.setItem('oth-save', JSON.stringify({ version: 1, savedAt: 1, opts: {}, actions: [], presentation: {}, snapshot: { version: 1, scenario: '999', ym: { year: 190, month: 1 }, rng: {}, officers: {}, cities: {}, factions: {}, log: [], pending: [] } })))
    await page.reload()
    await expect(page.getByTestId('save-broken')).toContainText('no longer in the game')
  })

  test('the map pans by drag, zooms by wheel, and Find me flies back (the view is one matrix on the world group)', async ({ page }) => {
    await startAs(page, 'liu-bei', 1)
    await answerLetters(page)
    const world = page.getByTestId('map-world')
    const matrix = async (): Promise<number[]> => ((await world.getAttribute('transform')) ?? '').replace(/matrix\(|\)/g, '').split(' ').map(Number)
    await page.waitForTimeout(1200) // the framing tween
    const m0 = await matrix()
    const box = (await page.getByTestId('map').boundingBox())!
    const vbBefore = await page.locator('[data-testid=map] > svg').getAttribute('viewBox')
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2 - 80, box.y + box.height / 2 - 40, { steps: 6 })
    await page.mouse.up()
    await expect.poll(async () => (await matrix())[4]).toBeLessThan(m0[4]! - 40)
    expect(await page.locator('[data-testid=map] > svg').getAttribute('viewBox')).toBe(vbBefore) // panning never changes the viewBox
    await page.mouse.wheel(0, -300) // zoom in
    await expect.poll(async () => (await matrix())[0]).toBeGreaterThan(m0[0]!)
    await page.getByTestId('find-me').click()
    await page.waitForTimeout(1000)
    const m1 = await matrix()
    expect(Math.abs(m1[4]! - m0[4]!)).toBeLessThan(2) // back on the player's city, at the comfortable zoom
    expect(Math.abs(m1[0]! - m0[0]!)).toBeLessThan(0.01)
  })

  test('phone portrait and landscape fit with no horizontal scroll and no text selection', async ({ browser }) => {
    for (const vp of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
      const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 2, hasTouch: true, isMobile: true, baseURL: BASE })
      const page = await ctx.newPage()
      await page.goto('./')
      const fits = async (): Promise<void> => {
        const w = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, bw: document.body.scrollWidth, iw: window.innerWidth }))
        expect(w.sw).toBeLessThanOrEqual(w.iw)
        expect(w.bw).toBeLessThanOrEqual(w.iw)
      }
      await fits()
      expect(await page.evaluate(() => getComputedStyle(document.body).userSelect)).toBe('none')
      await page.getByTestId('new-officer').click()
      await fits()
      await page.getByTestId('start-game').click()
      await expect(page.getByTestId('game')).toBeVisible()
      await answerLetters(page) // the random seed may open with a letter
      await fits()
      // the action bar and the End Month button are inside the viewport
      const bar = await page.getByTestId('actionbar').boundingBox()
      expect(bar).not.toBeNull()
      expect(bar!.y + bar!.height).toBeLessThanOrEqual(vp.height + 1)
      const end = await page.getByTestId('end-month').boundingBox()
      expect(end!.x + end!.width).toBeLessThanOrEqual(vp.width + 1)
      await page.getByTestId('ticker').dblclick()
      expect(await page.evaluate(() => String(getSelection()))).toBe('')
      await page.getByRole('button', { name: 'Close' }).click()
      // tap a city -> bottom sheet (portrait) or side panel (landscape)
      await page.locator('[data-city="pingyuan"]').dispatchEvent('pointerdown', { pointerId: 1, isPrimary: true, clientX: 0, clientY: 0 }).catch(() => undefined)
      await ctx.close()
    }
  })

  if (SHOTS) {
    test('screenshots for the handoff', async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2, baseURL: BASE })
      const page = await ctx.newPage()
      const out = (n: string): string => join(process.cwd(), 'docs', 'screens', n)
      await page.goto('./')
      await page.waitForTimeout(400)
      await page.screenshot({ path: out('title.png') })
      await page.getByTestId('new-officer').click()
      await page.getByTestId('seed').fill('1')
      await page.locator('[data-pick="liu-bei"]').click()
      await page.waitForTimeout(400)
      await page.screenshot({ path: out('officer-picker.png') })
      await page.getByTestId('start-game').click()
      await expect(page.getByTestId('game')).toBeVisible()
      await page.getByTestId('act-work').first().click()
      await page.getByTestId('end-month').click()
      await page.getByTestId('confirm-endmonth').click()
      await page.waitForTimeout(300)
      await page.screenshot({ path: out('letter.png') })
      await answerLetters(page)
      await page.waitForTimeout(500)
      await page.screenshot({ path: out('map-midgame.png') })
      await page.locator('[data-city="pingyuan"]').click({ force: true })
      await page.waitForTimeout(400)
      await page.screenshot({ path: out('city-box.png') })
      await ctx.close()
      const pctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, baseURL: BASE })
      const p = await pctx.newPage()
      await startAs(p, 'liu-bei', 1)
      await p.waitForTimeout(500)
      await p.screenshot({ path: out('phone-portrait.png') })
      await pctx.close()
    })
  }
})
