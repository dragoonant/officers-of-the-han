// Audio and portraits in the browser (docs/spec/60-audio.md section 8, 55-portraits.md section 5): with no files present every page loads with
// 0 console errors, the settings panel works and persists, and the game stays silent; with a manifest that lists a file the director plays it;
// a generated portrait wins when the manifest lists it.
import { expect, test, type Page } from '@playwright/test'

const WEBP_1PX = Buffer.from('UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==', 'base64')

/** A 1 s mono 44.1 kHz sine as a WAV file (the decoder does not care that the manifest says .ogg). */
function wav(): Buffer {
  const n = 44100
  const b = Buffer.alloc(44 + n * 2)
  b.write('RIFF', 0)
  b.writeUInt32LE(36 + n * 2, 4)
  b.write('WAVEfmt ', 8)
  b.writeUInt32LE(16, 16)
  b.writeUInt16LE(1, 20)
  b.writeUInt16LE(1, 22)
  b.writeUInt32LE(44100, 24)
  b.writeUInt32LE(88200, 28)
  b.writeUInt16LE(2, 32)
  b.writeUInt16LE(16, 34)
  b.write('data', 36)
  b.writeUInt32LE(n * 2, 40)
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(8000 * Math.sin((2 * Math.PI * 440 * i) / 44100)), 44 + i * 2)
  return b
}

function watch(page: Page): { errors: string[] } {
  const errors: string[] = []
  page.on('console', (m) => {
    if (m.type() === 'error' && !/favicon\.ico/.test(m.location().url)) errors.push(`console: ${m.text()} (${m.location().url})`)
  })
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  page.on('requestfailed', (r) => errors.push(`requestfailed: ${r.url()}`))
  page.on('response', (r) => {
    if (r.status() >= 400) errors.push(`http ${r.status()}: ${r.url()}`)
  })
  return { errors }
}

/** Answer every pending letter (the first button of its answers), and resolve contests with the engine's automatic outcome. */
async function settle(page: Page): Promise<void> {
  for (let i = 0; i < 30; i++) {
    const kind = await page.evaluate(() => window.__game!.getState().state?.pending[0]?.kind ?? null)
    if (!kind) return
    if (kind === 'battle' || kind === 'duel' || kind === 'debate') {
      await page.evaluate(() => {
        const st = window.__game!.getState()
        const p = st.state!.pending[0]!
        const w = window.__world!
        if (p.kind === 'battle') st.act({ kind: 'resolveBattle', pending: p.id, outcome: w.auto.battle(st.state!, p.setup) })
        else if (p.kind === 'duel') st.act({ kind: 'resolveDuel', pending: p.id, outcome: w.auto.duel(p.setup) })
        else if (p.kind === 'debate') st.act({ kind: 'resolveDebate', pending: p.id, outcome: w.auto.debate(p.setup) })
      })
    } else {
      await page.locator('.answers button:not([disabled])').first().click()
    }
    await page.waitForTimeout(100)
  }
}

async function startGame(page: Page): Promise<void> {
  await page.goto('./?test=1')
  await page.getByTestId('new-officer').click()
  const confirm = page.getByTestId('confirm-new-yes')
  if (await confirm.isVisible().catch(() => false)) await confirm.click()
  await page.getByTestId('seed').fill('1')
  await page.locator('[data-pick="liu-bei"]').click()
  await page.getByTestId('start-game').click()
  await expect(page.getByTestId('game')).toBeVisible()
}

test.describe('audio with no files', () => {
  test('title, sounds.html and the lab load with 0 console errors and 0 failed audio or portrait requests', async ({ page }) => {
    const w = watch(page)
    await page.goto('./?test=1')
    await expect(page.getByTestId('new-officer')).toBeVisible()
    await page.getByTestId('sound-btn').click()
    await expect(page.getByTestId('music-note')).toContainText('files pending')
    await page.goto('sounds.html')
    await expect(page.getByTestId('manifest-state')).toContainText('no files yet')
    await expect(page.locator('[data-testid^="slot-"]')).toHaveCount(31) // 10 beds, the charge layer, 2 stings, 18 effects
    await expect(page.locator('[data-testid^="slot-"] .miss')).toHaveCount(31)
    await expect(page.getByTestId('portrait-summary')).toContainText('0 generated')
    await page.goto('lab.html')
    await page.waitForTimeout(500)
    expect(w.errors).toEqual([])
  })

  test('the settings panel in the Menu works, persists in oth-audio, and the game plays through silently', async ({ page }) => {
    const w = watch(page)
    await page.goto('./?test=1')
    await startGame(page)
    await page.getByTestId('open-menu').click()
    await expect(page.getByTestId('sound-panel')).toBeVisible()
    const music = page.getByTestId('vol-music')
    await music.fill('35')
    await expect(page.getByTestId('vol-music-val')).toHaveText('35')
    await page.getByTestId('vol-sfx').fill('55')
    await page.getByTestId('sound-mute').click()
    await expect(page.getByTestId('sound-mute')).toHaveAttribute('aria-pressed', 'true')
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('oth-audio') ?? 'null'))
    expect(saved).toEqual({ music: 0.35, sfx: 0.55, muted: true })
    // reload: the settings come back
    await page.reload()
    const again = await page.evaluate(() => JSON.parse(localStorage.getItem('oth-audio') ?? 'null'))
    expect(again).toEqual(saved)
    await page.getByTestId('continue').click()
    await page.getByTestId('open-menu').click()
    await expect(page.getByTestId('vol-music-val')).toHaveText('35')
    await expect(page.getByTestId('sound-mute')).toHaveAttribute('aria-pressed', 'true')
    await page.getByTestId('sound-mute').click()
    await expect(page.getByTestId('sound-mute')).toHaveAttribute('aria-pressed', 'false')
    // play on: end the month a few times, tap buttons; nothing may error and no audio request may be made
    await page.getByRole('button', { name: 'Close' }).click()
    await settle(page)
    for (let i = 0; i < 2; i++) {
      await page.getByTestId('end-month').click()
      const yes = page.getByTestId('confirm-endmonth')
      if (await yes.isVisible().catch(() => false)) await yes.click()
      await settle(page)
    }
    const status = await page.evaluate(() => (window as unknown as { __audio: { status(): { trackCount: number } } }).__audio.status().trackCount)
    expect(status).toBe(0)
    expect(w.errors).toEqual([])
  })
})

test.describe('audio and portraits with files', () => {
  test('a manifest that lists a bed makes the director play it after the first gesture', async ({ page }) => {
    const w = watch(page)
    await page.route('**/audio/manifest.json', (r) =>
      r.fulfill({ json: { version: 1, tracks: [{ id: 'bed-title', file: 'bed-title-a.ogg', bpm: 72, beatsPerBar: 4, loopStart: 0, loopEnd: 1, gainDb: 0, role: 'bed', mood: 'title' }] } }),
    )
    await page.route('**/audio/bed-title-a.ogg', (r) => r.fulfill({ body: wav(), contentType: 'audio/wav' }))
    await page.goto('./?test=1')
    await expect(page.getByTestId('new-officer')).toBeVisible()
    await page.getByTestId('new-officer').hover()
    await page.mouse.click(5, 5) // the first gesture unlocks audio
    await expect.poll(() => page.evaluate(() => (window as unknown as { __audio: { debug(): { bed: string | null } | null } }).__audio.debug()?.bed ?? null), { timeout: 10_000 }).toBe('bed-title')
    await expect.poll(() => page.evaluate(() => (window as unknown as { __audio: { levels(): { bed: number } } }).__audio.levels().bed), { timeout: 8000 }).toBeGreaterThan(0.9)
    // muting is the master gain, not a pause: the director keeps running
    await page.getByTestId('sound-btn').click()
    await page.getByTestId('sound-mute').click()
    expect(w.errors).toEqual([])
  })

  test('a generated portrait wins when the manifest lists it; others fall back to the older file or the medallion', async ({ page }) => {
    const w = watch(page)
    await page.route('**/portraits/gen/manifest.json', (r) => r.fulfill({ json: { version: 1, portraits: { 'cao-cao': {}, 'li-ru': {}, 'face-02': {} } } }))
    await page.route('**/portraits/gen/*.webp', (r) => r.fulfill({ body: WEBP_1PX, contentType: 'image/webp' }))
    await page.goto('sounds.html')
    await expect(page.getByTestId('portrait-cao-cao')).toHaveAttribute('data-state', 'generated')
    await expect(page.getByTestId('portrait-li-ru')).toHaveAttribute('data-state', 'generated') // had no older portrait at all
    await expect(page.getByTestId('portrait-face-02')).toHaveAttribute('data-state', 'generated')
    await expect(page.getByTestId('portrait-face-03')).toHaveAttribute('data-state', 'medallion')
    await expect(page.getByTestId('portrait-lu-bu')).toHaveAttribute('data-state', 'file')
    await expect(page.getByTestId('portrait-summary')).toContainText('3 generated')
    await expect(page.getByTestId('portrait-cao-cao').locator('img')).toHaveAttribute('src', /portraits\/gen\/cao-cao-128\.webp$/)
    await expect(page.getByTestId('portrait-lu-bu').locator('img')).toHaveAttribute('src', /portraits\/lu-bu\.webp$/)
    expect(w.errors).toEqual([])
  })
})
