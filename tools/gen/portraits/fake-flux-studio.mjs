#!/usr/bin/env node
// A stand-in for the local Flux Studio (port 7880) so the portrait runner can be tested without the GPU PC. The image is a solid-colour PNG
// chosen from the seed. It is NOT a portrait. Never commit its output.
import http from 'node:http'
import { FAKE_HELP, isMain, parseFakeArgs, sleep, solidPng, UsageError } from './lib.mjs'

/** Check a request like the real studio's sanitizer would; returns an error string or null. */
export function validateJob(b) {
  if (!b || typeof b !== 'object') return 'body must be a JSON object'
  if (!['klein', 'dev', 'schnell'].includes(b.model)) return 'model must be klein, dev or schnell'
  if (typeof b.prompt !== 'string' || !b.prompt.trim()) return 'prompt is required'
  if (b.seed !== undefined && !Number.isInteger(b.seed)) return 'seed must be an integer'
  if (b.batch !== undefined && !(Number.isInteger(b.batch) && b.batch >= 1 && b.batch <= 4)) return 'batch must be 1-4'
  if (b.aspect !== undefined && !/^\d+:\d+$/.test(String(b.aspect))) return 'aspect must look like 2:3'
  if (b.megapixels !== undefined && !(typeof b.megapixels === 'number' && b.megapixels > 0 && b.megapixels <= 4)) return 'megapixels must be 0-4'
  return null
}

export const colourFor = (seed) => [(seed * 37) % 256, (seed * 91 + 40) % 256, (seed * 53 + 90) % 256]

/**
 * Start the fake studio. `externalBusyMs` lists a pretend job from someone else as running for that long, so a test can prove the runner waits.
 * Returns { url, port, stats, close }. stats.maxConcurrent proves no two jobs ever ran at once.
 */
export async function startFakeFlux({ port = 0, delayMs = 100, size = 64, externalBusyMs = 0, failSeeds = [] } = {}) {
  const jobs = new Map()
  const stats = { requests: 0, posts: 0, rejected: 0, running: 0, maxConcurrent: 0, settings: [], jobs: [], postedWhileExternalBusy: 0 }
  const busyUntil = Date.now() + externalBusyMs
  let chain = Promise.resolve()
  let counter = 0
  const processJob = (job) => {
    chain = chain.then(async () => {
      job.status = 'running'
      stats.running++
      stats.maxConcurrent = Math.max(stats.maxConcurrent, stats.running)
      try {
        await sleep(delayMs)
        if (failSeeds.includes(job.params.seed)) throw new Error('fake failure')
        job.png = solidPng(size, size, colourFor(job.params.seed ?? 0))
        job.images = ['image_0.png']
        job.status = 'done'
      } catch (e) {
        job.status = 'error'
        job.error = e instanceof Error ? e.message : String(e)
      } finally {
        stats.running--
      }
    })
  }
  const send = (res, code, obj) => {
    const text = JSON.stringify(obj)
    res.writeHead(code, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(text) })
    res.end(text)
  }
  const readBody = (req) => new Promise((resolve) => { const c = []; req.on('data', (d) => c.push(d)); req.on('end', () => resolve(Buffer.concat(c).toString('utf8'))) })
  const server = http.createServer(async (req, res) => {
    stats.requests++
    const url = new URL(req.url ?? '/', 'http://localhost')
    const parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent)
    try {
      if (req.method === 'GET' && url.pathname === '/api/jobs') {
        const list = [...jobs.values()].map((j) => ({ id: j.id, status: j.status }))
        if (Date.now() < busyUntil) list.push({ id: 'someone-else', status: 'running' })
        return send(res, 200, list)
      }
      if (req.method === 'POST' && url.pathname === '/api/settings') {
        stats.settings.push(JSON.parse((await readBody(req)) || '{}'))
        return send(res, 200, { ok: true })
      }
      if (req.method === 'POST' && url.pathname === '/api/jobs') {
        stats.posts++
        if (Date.now() < busyUntil) stats.postedWhileExternalBusy++
        let body
        try { body = JSON.parse((await readBody(req)) || '{}') } catch { stats.rejected++; return send(res, 400, { error: 'invalid JSON' }) }
        const err = validateJob(body)
        if (err) { stats.rejected++; return send(res, 400, { error: err }) }
        const id = `fx${String(++counter).padStart(4, '0')}`
        const job = { id, status: 'queued', params: body, images: [] }
        jobs.set(id, job)
        stats.jobs.push({ id, body })
        processJob(job)
        return send(res, 200, { id })
      }
      if (parts[0] === 'api' && parts[1] === 'jobs' && parts[2]) {
        const job = jobs.get(parts[2])
        if (!job) return send(res, 404, { error: 'no such job' })
        if (req.method === 'GET' && parts.length === 3) return send(res, 200, { id: job.id, status: job.status, images: job.images, error: job.error })
        if (req.method === 'POST' && parts[3] === 'cancel') return send(res, 200, { id: job.id, status: job.status })
      }
      if (req.method === 'GET' && parts[0] === 'files' && parts.length === 3) {
        const job = jobs.get(parts[1])
        if (!job || !job.png || parts[2] !== 'image_0.png') return send(res, 404, { error: 'no such file' })
        res.writeHead(200, { 'content-type': 'image/png', 'content-length': job.png.length })
        return res.end(job.png)
      }
      return send(res, 404, { error: 'not found' })
    } catch (e) {
      return send(res, 500, { error: e instanceof Error ? e.message : String(e) })
    }
  })
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve) })
  const actual = server.address().port
  return { url: `http://127.0.0.1:${actual}`, port: actual, stats, close: async () => { await new Promise((r) => server.close(r)); await chain.catch(() => {}) } }
}

if (isMain(import.meta.url)) {
  try {
    const opts = parseFakeArgs(process.argv.slice(2))
    if (opts.help) console.log(FAKE_HELP)
    else {
      const s = await startFakeFlux(opts)
      console.log(`Fake Flux Studio listening on ${s.url}. Point the runner at it with --base ${s.url}. Ctrl-C to stop.`)
      process.once('SIGINT', () => { void s.close().then(() => process.exit(0)) })
    }
  } catch (e) {
    if (e instanceof UsageError) { console.error(`error: ${e.message}\n\n${FAKE_HELP}`); process.exitCode = e.exitCode } else throw e
  }
}
