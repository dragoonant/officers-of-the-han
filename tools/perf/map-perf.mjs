// Map performance on an emulated phone. NOT part of `npm run e2e`.
//   npm run build && node tools/perf/map-perf.mjs [--label after] [--rates 1,4,6] [--shot docs/screens/x.png] [--battle]
// Starts `vite preview` on PW_PORT (default 5331) when nothing answers there. Writes tools/perf/out/<label>.json and prints a table.
// Frame times come from an in-page rAF loop; long tasks from a PerformanceObserver; the CPU is throttled through CDP.
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { chromium, devices } from '@playwright/test'

const args = process.argv.slice(2)
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d }
const PORT = Number(process.env.PW_PORT ?? 5331)
const BASE = `http://localhost:${PORT}/officers-of-the-han/`
const LABEL = opt('label', 'run')
const RATES = opt('rates', '4,6').split(',').map(Number)
const SHOT = opt('shot', '')
const DEVICE = devices[opt('device', 'Pixel 7')]
const exe = existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {}

async function up() { try { return (await fetch(BASE)).ok } catch { return false } }
let server = null
if (!(await up())) {
  server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
  for (let i = 0; i < 60 && !(await up()); i++) await new Promise((r) => setTimeout(r, 500))
}

const stats = (xs) => {
  if (!xs.length) return { n: 0, median: 0, p95: 0, over50: 0, max: 0 }
  const s = [...xs].sort((a, b) => a - b)
  const q = (p) => s[Math.min(s.length - 1, Math.floor(p * s.length))]
  return { n: s.length, median: +q(0.5).toFixed(1), p95: +q(0.95).toFixed(1), over50: s.filter((x) => x > 50).length, max: +s[s.length - 1].toFixed(1) }
}

const INSTALL = () => {
  window.__frames = []; window.__long = []; window.__rec = false
  let last = 0
  const loop = (t) => { if (window.__rec && last) window.__frames.push(t - last); last = t; requestAnimationFrame(loop) }
  requestAnimationFrame(loop)
  try { new PerformanceObserver((l) => { if (window.__rec) for (const e of l.getEntries()) window.__long.push(e.duration) }).observe({ entryTypes: ['longtask'] }) } catch {}
}
let CDP = null
let m0 = null
let traceEvents = []
const metrics = async () => Object.fromEntries((await CDP.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]))
const begin = async (page) => {
  traceEvents = []
  await CDP.send('Tracing.start', { transferMode: 'ReportEvents', traceConfig: { includedCategories: ['cc', 'disabled-by-default-devtools.timeline'] } })
  await page.evaluate(() => { window.__frames = []; window.__long = []; window.__rec = true }); m0 = await metrics() }
const end = async (page) => {
  const r = await page.evaluate(() => { window.__rec = false; return { f: window.__frames, l: window.__long } })
  const m1 = await metrics()
  const done = new Promise((r) => CDP.once('Tracing.tracingComplete', r))
  await CDP.send('Tracing.end'); await done
  // raster work runs off the main thread, so CPU throttling does not slow it: report it as its own number (ms, summed over the gesture)
  const rasterMs = +(traceEvents.filter((e) => e.name === 'RasterTask' && e.ph === 'X').reduce((a, e) => a + (e.dur ?? 0), 0) / 1000).toFixed(0)
  const d = (k) => +((m1[k] - m0[k]) * 1000).toFixed(0)
  // main-thread work per gesture, in ms of the (throttled) main thread: script, style recalc, layout, whole tasks
  return { ...stats(r.f), long: r.l.length, longMax: r.l.length ? +Math.max(...r.l).toFixed(0) : 0, long100: r.l.filter((x) => x > 100).length,
    rasterMs, mainMs: d('TaskDuration'), scriptMs: d('ScriptDuration'), styleMs: d('RecalcStyleDuration'), layoutMs: d('LayoutDuration') }
}

async function touch(cdp, type, pts) {
  await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], id) => ({ x, y, id })) })
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function runRate(browser, rate) {
  const ctx = await browser.newContext({ ...DEVICE, baseURL: BASE })
  const page = await ctx.newPage()
  await page.addInitScript(() => { const o = Element.prototype.setPointerCapture; Element.prototype.setPointerCapture = function (id) { try { return o.call(this, id) } catch {} } })
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  const cdp = await ctx.newCDPSession(page)
  CDP = cdp
  await cdp.send('Performance.enable')
  cdp.on('Tracing.dataCollected', (e) => { traceEvents.push(...e.value) })
  await cdp.send('Emulation.setCPUThrottlingRate', { rate })
  await page.addInitScript(INSTALL)
  await page.goto('./')
  await page.getByTestId('new-officer').click()
  const confirm = page.getByTestId('confirm-new-yes')
  if (await confirm.isVisible().catch(() => false)) await confirm.click()
  await page.getByTestId('seed').fill('1')
  await page.locator('[data-pick="liu-bei"]').click()
  const out = { rate }

  // first map render after New Game: click -> a city mirror exists -> two frames later
  out.firstMapMs = await page.evaluate(() => new Promise((res) => {
    const t0 = performance.now()
    window.__rec = true; window.__frames = []; window.__long = []
    const tick = () => {
      if (document.querySelector('[data-testid=map] [data-city]')) {
        requestAnimationFrame(() => requestAnimationFrame(() => { window.__rec = false; res(performance.now() - t0) }))
      } else requestAnimationFrame(tick)
    }
    document.querySelector('[data-testid=start-game]').click()
    requestAnimationFrame(tick)
  }))
  out.firstMapMs = +out.firstMapMs.toFixed(0)
  await page.getByTestId('map').waitFor()
  for (let i = 0; i < 6; i++) { // the opening letter (a mission) sits over the map: accept it
    const l = page.getByTestId('letter')
    if (!(await l.isVisible().catch(() => false))) break
    await l.locator('button.lbtn').first().click(); await sleep(300)
  }
  await sleep(1800 * Math.max(1, rate / 2)) // the framing tween

  const box = await page.getByTestId('map').boundingBox()
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2

  // The gestures are driven inside the page, one pointer move per animation frame (as a finger does at 60 Hz), so a frame
  // that costs more than 16.7 ms shows up as a long frame. (Driving from CDP stretches the gesture and hides the cost.)
  const drive = (kind) => page.evaluate((kind) => new Promise((res) => {
    const m = document.querySelector('[data-testid=map]')
    const r = m.getBoundingClientRect()
    const cx = r.x + r.width / 2, cy = r.y + r.height / 2
    const tgt = document.elementFromPoint(cx, cy)
    const ev = (type, id, x, y) => tgt.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: id, pointerType: 'touch', isPrimary: id === 1, clientX: x, clientY: y }))
    const steps = []
    if (kind === 'pan') { for (let i = 0; i < 90; i++) { const k = i < 45 ? i : 90 - i; steps.push([[cx - k * 3, cy - k * 1.5]]) } }
    else { for (let i = 0; i <= 60; i++) { const d = 60 + i * 2.2; steps.push([[cx - d, cy], [cx + d, cy]]) } for (let i = 60; i >= 0; i--) { const d = 60 + i * 2.2; steps.push([[cx - d, cy], [cx + d, cy]]) } }
    const start = kind === 'pan' ? [[cx, cy]] : [[cx - 60, cy], [cx + 60, cy]]
    start.forEach((p, i) => ev('pointerdown', i + 1, p[0], p[1]))
    let i = 0
    const tick = () => {
      if (i >= steps.length) { start.forEach((p, k) => ev('pointerup', k + 1, p[0], p[1])); res(); return }
      steps[i++].forEach((p, k) => ev('pointermove', k + 1, p[0], p[1]))
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }), kind)
  await begin(page); await drive('pan'); out.pan = await end(page)
  await sleep(300)
  await begin(page); await drive('pinch'); out.pinch = await end(page)
  await sleep(500)

  // tap a city: input -> city box in the DOM -> next frame
  const pt = await page.evaluate(() => {
    const m = document.querySelector('[data-testid=map]').getBoundingClientRect()
    for (const g of document.querySelectorAll('[data-city]')) {
      const r = g.getBoundingClientRect()
      const x = r.x + r.width / 2, y = r.y + r.height / 2
      if (x > m.x + 20 && x < m.right - 20 && y > m.y + 20 && y < m.bottom - 60) return { x, y }
    }
    return null
  })
  if (pt) {
    await page.evaluate(() => { window.__tapT = 0; new MutationObserver((_, o) => { if (document.querySelector('[data-testid=city-box]')) { window.__tapDone = performance.now(); o.disconnect() } }).observe(document.body, { childList: true, subtree: true }); window.__tapDone = 0 })
    await begin(page)
    const t0 = Date.now()
    await touch(cdp, 'touchStart', [[pt.x, pt.y]]); await touch(cdp, 'touchEnd', [])
    await page.getByTestId('city-box').waitFor()
    out.cityOpenMs = Date.now() - t0
    out.cityOpen = await end(page)
    await page.getByTestId('map').click({ position: { x: 5, y: 5 }, force: true }).catch(() => {})
  }

  // end the month (engine-bound: the AI plays the world)
  for (let i = 0; i < 3; i++) if (await page.getByTestId('city-box').isVisible().catch(() => false)) { await touch(cdp, 'touchStart', [[box.x + 4, box.y + 4]]); await touch(cdp, 'touchEnd', []); await sleep(200) }
  await begin(page)
  const t1 = Date.now()
  await page.getByTestId('end-month').click()
  await page.getByTestId('confirm-endmonth').click()
  await page.waitForFunction(() => document.querySelector('[data-testid=letter]') || /February/.test(document.querySelector('[data-testid=month-dial]')?.getAttribute('aria-label') ?? ''), null, { timeout: 120000 })
  out.endMonthMs = Date.now() - t1
  out.endMonth = await end(page)
  out.errors = errors
  await ctx.close()
  return out
}

async function battlePerf(browser, rate) {
  const { execFileSync } = await import('node:child_process')
  const env = JSON.parse(execFileSync('npx', ['tsx', 'tests/e2e/fixtures/make-saves.ts'], { encoding: 'utf8', maxBuffer: 64 << 20 })).battle
  const ctx = await browser.newContext({ ...DEVICE, baseURL: BASE })
  const page = await ctx.newPage()
  await page.addInitScript(INSTALL)
  await page.addInitScript((t) => { try { localStorage.setItem('oth-save', t) } catch {} }, JSON.stringify(env))
  const cdp = await ctx.newCDPSession(page)
  await page.goto('./')
  await page.getByTestId('continue').click()
  await page.getByTestId('battle-open').click()
  const t0 = Date.now()
  await cdp.send('Emulation.setCPUThrottlingRate', { rate })
  await page.getByTestId('action-bar').waitFor({ timeout: 120000 })
  const readyMs = Date.now() - t0
  const info = await page.evaluate(() => { const c = document.querySelector('canvas'); return { canvas: c ? `${c.width}x${c.height}` : null, dpr: devicePixelRatio } })
  await page.evaluate(() => { window.__frames = []; window.__long = []; window.__rec = true })
  await sleep(5000)
  const r = await page.evaluate(() => { window.__rec = false; return { f: window.__frames, l: window.__long } })
  await ctx.close()
  return { rate, readyMs, ...info, idle: stats(r.f), longMax: r.l.length ? Math.max(...r.l) : 0 }
}
if (args.includes('--battle')) {
  const b = await chromium.launch({ ...exe, args: ['--no-sandbox', '--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
  for (const r of RATES) console.log('battle', JSON.stringify(await battlePerf(b, r)))
  await b.close(); server?.kill(); process.exit(0)
}
const browser = await chromium.launch({ ...exe, args: ['--no-sandbox'] })
if (SHOT) { // 390x844 at device scale 1, the map after the opening mission is answered, zoomed on the player's city
  const ctx = await browser.newContext({ ...DEVICE, viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, baseURL: BASE })
  const page = await ctx.newPage()
  await page.goto('./'); await page.getByTestId('new-officer').click()
  const c = page.getByTestId('confirm-new-yes'); if (await c.isVisible().catch(() => false)) await c.click()
  await page.getByTestId('seed').fill('1'); await page.locator('[data-pick="liu-bei"]').click(); await page.getByTestId('start-game').click()
  await page.getByTestId('map').waitFor()
  for (let i = 0; i < 6; i++) { const l = page.getByTestId('letter'); if (!(await l.isVisible().catch(() => false))) break; await l.locator('button.lbtn').first().click(); await sleep(300) }
  await sleep(2000)
  await page.screenshot({ path: SHOT }); await ctx.close()
}
const results = []
for (const r of RATES) { results.push(await runRate(browser, r)); console.error(`done ${r}x`) }
await browser.close()
server?.kill()
mkdirSync('tools/perf/out', { recursive: true })
writeFileSync(`tools/perf/out/${LABEL}.json`, JSON.stringify(results, null, 2))
const row = (n, s) => `${n.padEnd(8)} raster ${String(s.rasterMs).padStart(5)} ms | main ${String(s.mainMs).padStart(5)} ms (script ${s.scriptMs}, style ${s.styleMs}, layout ${s.layoutMs}) | median ${String(s.median).padStart(5)}  p95 ${String(s.p95).padStart(5)}  >50ms ${String(s.over50).padStart(3)}  frames ${String(s.n).padStart(4)}  longtasks ${s.long} (max ${s.longMax} ms, >100ms: ${s.long100})`
for (const r of results) {
  console.log(`\n== ${LABEL}  ${DEVICE.userAgent ? 'Pixel 7' : ''}  CPU ${r.rate}x ==`)
  console.log(`first map render after New Game: ${r.firstMapMs} ms`)
  console.log(row('pan', r.pan)); console.log(row('pinch', r.pinch))
  if (r.cityOpen) console.log(`city box open: ${r.cityOpenMs} ms (wall, includes CDP round trips); longest longtask ${r.cityOpen.longMax} ms; max frame ${r.cityOpen.max} ms`)
  console.log(`end month: ${r.endMonthMs} ms wall; longest longtask ${r.endMonth.longMax} ms; max frame ${r.endMonth.max} ms`)
  if (r.errors.length) console.log('page errors:', r.errors)
}
