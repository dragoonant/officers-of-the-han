#!/usr/bin/env node
// Step 1 of 3: ask the local Flux Studio (FLUX.2 klein) for two candidate portraits per prompt and save the raw PNGs.
// One GPU job at a time, fixed seeds, resumable (existing files are skipped), waits while the studio is busy.
// Next: contact-sheets.mjs (review) and pick-portraits.mjs. Instructions: docs/spec/55-portraits.md, docs/handoff/m5-av-runbook.md.
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { candidateSeed, GEN_HELP, isMain, loadPromptTable, parseGenArgs, pngSize, rawFileName, sleep, UsageError } from './lib.mjs'

const DONE = ['done', 'completed', 'complete', 'succeeded', 'success', 'finished', 'ready']
const FAILED = ['error', 'failed', 'failure', 'cancelled', 'canceled']
const ACTIVE = ['queued', 'pending', 'running', 'processing', 'loading']

export function classifyStatus(job) {
  const s = String(job?.status ?? job?.state ?? '').toLowerCase()
  if (DONE.includes(s)) return 'done'
  if (FAILED.includes(s)) return 'failed'
  return 'pending'
}

/** The image names of a finished job (strings or {name|file|filename}). */
export function jobImageNames(job) {
  for (const key of ['images', 'files', 'outputs', 'results']) {
    const v = job?.[key]
    if (Array.isArray(v) && v.length) {
      const names = v.map((e) => (typeof e === 'string' ? e : (e?.name ?? e?.file ?? e?.filename ?? ''))).map((s) => String(s).split(/[\\/]/).pop()).filter(Boolean)
      if (names.length) return names
    }
  }
  return []
}

export function missingCandidates(rawDir, id, candidates, force) {
  const out = []
  for (let i = 0; i < candidates; i++) if (force || !existsSync(path.join(rawDir, rawFileName(id, i)))) out.push(i)
  return out
}

async function http(base, method, route, { body, timeoutMs = 30000, raw = false } = {}) {
  const res = await fetch(base + route, {
    method,
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!res.ok) throw new Error(`${method} ${route} -> HTTP ${res.status} ${(await res.text().catch(() => '')).slice(0, 300)}`)
  return raw ? Buffer.from(await res.arrayBuffer()) : await res.json().catch(() => ({}))
}

function readJson(file, fallback) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    return fallback
  }
}
const stamp = () => new Date().toISOString().replace(/[:.]/g, '-')

/** How many other jobs the studio reports as queued or running (best effort: 0 when the list cannot be read). */
async function studioBusy(base) {
  try {
    const r = await http(base, 'GET', '/api/jobs', { timeoutMs: 10000 })
    const jobs = Array.isArray(r) ? r : Array.isArray(r?.jobs) ? r.jobs : []
    return jobs.filter((j) => ACTIVE.includes(String(j?.status ?? '').toLowerCase())).length
  } catch {
    return 0
  }
}

/** The POST /api/jobs body: model klein, square, one megapixel, one image, the fixed seed. */
export function buildJobBody(table, entry, index) {
  return { model: table.model ?? 'klein', prompt: entry.prompt, aspect: table.aspect ?? '1:1', megapixels: table.megapixels ?? 1, batch: 1, seed: candidateSeed(entry.seed, index) }
}

async function runJob(base, body, opts, hooks) {
  const created = await http(base, 'POST', '/api/jobs', { body })
  const id = created?.id ?? created?.jobId
  if (!id) throw new Error(`the studio did not return a job id: ${JSON.stringify(created).slice(0, 200)}`)
  hooks.current = { base, id }
  const t0 = Date.now()
  let wait = opts.pollMs
  let job = {}
  try {
    for (;;) {
      await sleep(wait)
      wait = Math.min(Math.round(wait * 1.4), 5000)
      job = await http(base, 'GET', `/api/jobs/${encodeURIComponent(id)}`)
      const state = classifyStatus(job)
      if (state === 'done') break
      if (state === 'failed') throw new Error(`job ${id} ${job.status}: ${String(job.error ?? job.message ?? '').slice(0, 300)}`)
      if (Date.now() - t0 > opts.timeoutMs) {
        await http(base, 'POST', `/api/jobs/${encodeURIComponent(id)}/cancel`, { body: {}, timeoutMs: 10000 }).catch(() => {})
        throw new Error(`job ${id} did not finish within ${Math.round(opts.timeoutMs / 1000)} s (cancelled)`)
      }
    }
  } finally {
    hooks.current = null
  }
  const name = jobImageNames(job)[0]
  if (!name) throw new Error(`job ${id} finished with no image`)
  const data = await http(base, 'GET', `/files/${encodeURIComponent(id)}/${encodeURIComponent(name)}`, { raw: true, timeoutMs: 120000 })
  return { id, name, data, seconds: (Date.now() - t0) / 1000 }
}

/** Returns the exit code: 0 ok or nothing to do, 1 something failed, 2 bad command line or the studio cannot be reached. */
export async function main(argv, io = { log: console.log, err: console.error }, hooks = { current: null }) {
  const table = loadPromptTable()
  let opts
  try {
    opts = parseGenArgs(argv, table.entries)
  } catch (e) {
    if (e instanceof UsageError) {
      io.err(`error: ${e.message}\n`)
      io.err(GEN_HELP)
      return e.exitCode
    }
    throw e
  }
  if (opts.help) {
    io.log(GEN_HELP)
    return 0
  }
  const rawDir = path.join(opts.out, 'raw')
  const logFile = path.join(rawDir, 'generation-log.json')
  const selected = table.entries.filter((e) => (!opts.only || opts.only.includes(e.id)) && (opts.set === 'all' || (opts.set === 'officers') === (e.kind === 'officer')))
  let work = []
  for (const e of selected) for (const i of missingCandidates(rawDir, e.id, opts.candidates, opts.force)) work.push({ entry: e, index: i })
  const total = selected.length * opts.candidates
  if (opts.limit !== null) work = work.slice(0, opts.limit)
  io.log(`Flux Studio runner: ${selected.length} portrait(s) selected, ${work.length} image(s) to generate, ${total - work.length} already on disk${opts.force ? ' (force)' : ''}.`)
  if (opts.dryRun) {
    for (const w of work.slice(0, 5)) io.log(`  ${rawFileName(w.entry.id, w.index)}  seed ${candidateSeed(w.entry.seed, w.index)}`)
    if (work[0]) io.log(`  first request: ${JSON.stringify(buildJobBody(table, work[0].entry, work[0].index))}`)
    io.log(`\nDry run: nothing was sent to ${opts.base}. Raw files would go to ${rawDir}.`)
    return 0
  }
  if (work.length === 0) {
    io.log('Nothing to do. (Use --force to regenerate, or --only <id> --force for one portrait.)')
    return 0
  }
  io.log(`\nGPU WORK STARTS: ${work.length} job(s) on ${opts.base}, one at a time. Tell the owner first; stop the studio afterwards.`)
  try {
    await http(opts.base, 'GET', '/api/jobs', { timeoutMs: 10000 })
  } catch (e) {
    io.err(`error: cannot reach the Flux Studio at ${opts.base} (${e instanceof Error ? e.message : e}). Start it on the PC (port 7880) or pass --base <url>.`)
    return 2
  }
  // keep the model loaded for the whole batch (KB local-ai-studios); restored in finally
  await http(opts.base, 'POST', '/api/settings', { body: { freeAfter: false }, timeoutMs: 10000 }).catch(() => io.log('    note: could not set freeAfter:false; the model may reload between jobs'))
  mkdirSync(rawDir, { recursive: true })
  const log = readJson(logFile, {})
  let failures = 0
  let consecutive = 0
  let done = 0
  try {
    for (const w of work) {
      const { entry, index } = w
      const file = rawFileName(entry.id, index)
      io.log(`[${done + failures + 1}/${work.length}] ${file}`)
      try {
        for (let waited = 0; ; waited++) {
          const busy = await studioBusy(opts.base)
          if (busy === 0) break
          if (waited === 0) io.log(`    the studio has ${busy} other job(s) queued or running; waiting (never two GPU jobs at once)`)
          if (waited * 3000 > opts.timeoutMs * 4) throw new Error('the studio stayed busy with other jobs')
          await sleep(3000)
        }
        const body = buildJobBody(table, entry, index)
        const job = await runJob(opts.base, body, opts, hooks)
        if (job.data.length < 64 || job.data.subarray(1, 4).toString('latin1') !== 'PNG') throw new Error(`${job.name} is not a PNG (${job.data.length} bytes)`)
        const target = path.join(rawDir, file)
        if (existsSync(target)) {
          const dir = path.join(rawDir, 'archive', stamp())
          mkdirSync(dir, { recursive: true })
          renameSync(target, path.join(dir, file))
        }
        const tmp = `${target}.part`
        writeFileSync(tmp, job.data)
        renameSync(tmp, target)
        const sz = pngSize(job.data)
        log[file] = { id: entry.id, candidate: index, seed: body.seed, jobId: job.id, seconds: Math.round(job.seconds * 10) / 10, width: sz?.width, height: sz?.height, finishedAt: new Date().toISOString(), request: body }
        writeFileSync(logFile, `${JSON.stringify(log, null, 2)}\n`)
        done++
        consecutive = 0
        io.log(`    saved ${file} (${Math.round(job.seconds)} s)`)
      } catch (e) {
        failures++
        consecutive++
        io.err(`    FAILED ${file}: ${e instanceof Error ? e.message : e}`)
        if (consecutive >= 3) {
          io.err('Three images failed in a row; stopping so the GPU is not hammered. Fix the studio and run again (finished images are skipped).')
          break
        }
      }
    }
  } finally {
    await http(opts.base, 'POST', '/api/settings', { body: { freeAfter: true }, timeoutMs: 10000 }).catch(() => {})
  }
  io.log(`\nGenerated ${done} image(s), ${failures} failure(s). Raw files: ${rawDir}`)
  io.log('Next: node tools/gen/portraits/contact-sheets.mjs   (and stop the Flux Studio when you are done with it)')
  return failures ? 1 : 0
}

if (isMain(import.meta.url)) {
  const hooks = { current: null }
  process.once('SIGINT', async () => {
    const cur = hooks.current
    if (cur) {
      console.error(`\nInterrupted: cancelling job ${cur.id} on the studio...`)
      await http(cur.base, 'POST', `/api/jobs/${encodeURIComponent(cur.id)}/cancel`, { body: {}, timeoutMs: 5000 }).catch(() => {})
    }
    process.exit(130)
  })
  main(process.argv.slice(2), { log: console.log, err: console.error }, hooks).then((c) => { process.exitCode = c }, (e) => { console.error(e instanceof Error ? e.stack : e); process.exitCode = 1 })
}
