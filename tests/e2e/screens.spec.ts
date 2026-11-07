// Handoff screenshots (deviceScaleFactor 2) into docs/screens/. Run with SHOTS=1.
import { expect, test } from '@playwright/test'
import { saves, seed } from './fixtures/saves'

const SHOTS = process.env.SHOTS === '1'
const out = (n: string): string => `docs/screens/${n}`

test.describe('screenshots', () => {
  test.skip(!SHOTS, 'SHOTS=1 writes the screenshots')

  test('desktop: title, map on open, battle in the world, result letter', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 })
    const page = await ctx.newPage()
    await page.goto('?speed=instant&q=low')
    await page.waitForTimeout(1500)
    await page.screenshot({ path: out('title.png') })
    await page.evaluate(() => localStorage.clear())
    await page.close()
    const p2 = await ctx.newPage()
    await seed(p2, saves().battle)
    await p2.goto('?speed=instant&q=low')
    await p2.getByTestId('continue').click()
    await expect(p2.getByTestId('battle-letter')).toBeVisible()
    await p2.getByTestId('battle-open').click()
    await expect(p2.getByTestId('action-bar')).toBeVisible({ timeout: 90_000 })
    await p2.click('#ai-toggle')
    await p2.evaluate(() => new Promise<void>((resolve) => {
      const st = window.__oth!.store
      const stop = st.subscribe((s) => { if ((s.state?.actionCount ?? 0) >= 14) { stop(); (document.getElementById('ai-toggle') as HTMLButtonElement).click(); resolve() } })
    }))
    await p2.waitForTimeout(1200)
    await p2.screenshot({ path: out('world-battle-mid-fight.png') })
    await p2.click('#ai-toggle')
    await expect(p2.getByTestId('end-banner')).toBeVisible({ timeout: 200_000 })
    await p2.click('#battle-done')
    await expect(p2.getByTestId('world-battle')).toBeHidden()
    await p2.waitForTimeout(900)
    // the engine reports a battle through the chronicle (no battle letter exists): dismiss letters, open it
    for (let i = 0; i < 6 && (await p2.locator('.answers button').count()); i++) { await p2.locator('.answers button').first().click(); await p2.waitForTimeout(300) }
    await p2.getByTestId('open-chronicle').click()
    await p2.waitForTimeout(500)
    await p2.screenshot({ path: out('battle-result-chronicle.png') })
    await p2.keyboard.press('Escape')
    await p2.reload()
    await p2.getByTestId('continue').click()
    await p2.waitForTimeout(1500)
    await p2.screenshot({ path: out('map-on-open-desktop.png') })
    await ctx.close()
  })

  test('phone portrait: map on open', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true })
    const page = await ctx.newPage()
    await seed(page, saves().duel)
    await page.goto('?speed=instant&q=low')
    await page.getByTestId('continue').click()
    await page.getByTestId('world-duel').waitFor()
    await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('oth-save')!); s.snapshot.pending = []; localStorage.setItem('oth-save', JSON.stringify(s)) })
    await page.reload()
    await page.getByTestId('continue').click()
    await page.waitForTimeout(1500)
    await page.screenshot({ path: out('map-on-open-phone.png') })
    await ctx.close()
  })
})
