// The world client played end to end: a save with a pending battle, duel or debate opens its screen, plays to an
// outcome, and the world continues (and the save advances).
import { expect, test, type Page } from '@playwright/test'
import { saved, saves, seed } from './fixtures/saves'

const Q = '?speed=instant&q=low'

async function open(page: Page, kind: 'battle' | 'duel' | 'debate'): Promise<void> {
  await seed(page, saves()[kind])
  await page.goto(Q)
  await expect(page.getByTestId('continue-line')).toContainText('Cao Cao')
  await page.getByTestId('continue').click()
}

test('a pending battle opens from Continue, plays out with the AI, and the world shows the result', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await open(page, 'battle')
  await expect(page.getByTestId('battle-letter')).toBeVisible()
  await expect(page.getByTestId('battle-letter')).not.toContainText(/undefined|NaN|null/)
  await page.getByTestId('battle-open').click()
  await expect(page.getByTestId('battle-screen')).toBeVisible()
  await expect(page.getByTestId('action-bar')).toBeVisible({ timeout: 90_000 })
  await page.click('#speed-instant')
  await page.click('#ai-toggle')
  await expect(page.getByTestId('end-banner')).toBeVisible({ timeout: 200_000 })
  await page.click('#battle-done')
  await expect(page.getByTestId('battle-screen')).toBeHidden()
  // the world continues: the log carries the battle and the save moved on
  await expect.poll(async () => (await saved(page)).snapshot.pending.some((p: { kind: string }) => p.kind === 'battle')).toBe(false)
  const env = await saved(page)
  expect(env.snapshot.log.some((e: { kind: string }) => e.kind === 'battle')).toBe(true)
  expect(env.actions.length).toBeGreaterThan(saves().battle.actions.length)
  expect(env.presentation.battle).toBeUndefined()
  expect(errors).toEqual([])
})

test('reloading mid-battle and pressing Continue reopens the same battle day and troops', async ({ page }) => {
  await open(page, 'battle')
  await page.getByTestId('battle-open').click()
  await expect(page.getByTestId('action-bar')).toBeVisible({ timeout: 90_000 })
  await page.click('#speed-instant')
  // let the AI play a few actions, then switch it off from inside the page so the state stops where we read it
  await page.evaluate(() => new Promise<void>((resolve) => {
    const st = window.__oth!.store
    const stop = st.subscribe((s) => {
      if ((s.state?.actionCount ?? 0) >= 6) { stop(); (document.getElementById('ai-toggle') as HTMLButtonElement).click(); resolve() }
    })
    ;(document.getElementById('ai-toggle') as HTMLButtonElement).click()
  }))
  await page.waitForTimeout(500)
  const mid = await page.evaluate(() => {
    const s = window.__oth!.store.getState().state!
    return { day: s.day, count: s.actionCount, troops: s.units.map((u) => [u.id, u.troops]) }
  })
  expect(mid.count).toBeGreaterThanOrEqual(6)
  await expect.poll(async () => (await saved(page)).presentation.battle?.actionCount).toBe(mid.count)
  await page.reload()
  await page.getByTestId('continue').click()
  // a resumed saved battle opens the board directly
  await expect(page.getByTestId('battle-screen')).toBeVisible()
  await expect.poll(() => page.evaluate(() => window.__oth?.store.getState().state?.actionCount)).toBe(mid.count)
  expect(await page.evaluate(() => window.__oth!.store.getState().state!.day)).toBe(mid.day)
  const back = await page.evaluate(() => window.__oth!.store.getState().state!.units.map((u) => [u.id, u.troops]))
  expect(back).toEqual(mid.troops)
})

test('a pending duel opens its screen, plays to an outcome and the world continues', async ({ page }) => {
  await open(page, 'duel')
  await expect(page.getByTestId('world-duel')).toBeVisible()
  await playContest(page, 'world-duel')
  await expect(page.getByTestId('world-duel')).toBeHidden({ timeout: 30_000 })
  await expect.poll(async () => (await saved(page)).snapshot.pending.some((p: { kind: string }) => p.kind === 'duel')).toBe(false)
  await expect(page.getByTestId('actionbar')).toBeVisible()
})

test('a pending debate opens its screen, plays to an outcome and the world continues', async ({ page }) => {
  await open(page, 'debate')
  await expect(page.getByTestId('world-debate')).toBeVisible()
  await playContest(page, 'world-debate')
  await expect(page.getByTestId('world-debate')).toBeHidden({ timeout: 30_000 })
  await expect.poll(async () => (await saved(page)).snapshot.pending.some((p: { kind: string }) => p.kind === 'debate')).toBe(false)
})

/** Click the first enabled button of a duel / debate screen until its Continue button ends it. */
async function playContest(page: Page, screen: string): Promise<void> {
  const root = page.getByTestId(screen)
  for (let i = 0; i < 80; i++) {
    if (await root.isHidden()) return
    const done = root.getByRole('button', { name: /continue/i })
    if (await done.count()) { await done.first().click(); return }
    const btns = root.locator('button:not([disabled])')
    if (await btns.count()) await btns.first().click({ timeout: 2000 }).catch(() => undefined)
    await page.waitForTimeout(150)
  }
}
