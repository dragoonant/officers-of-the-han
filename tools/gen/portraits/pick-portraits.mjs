#!/usr/bin/env node
// Step 3 of 3: crop the picked candidate square on the face centre, resize to 256 and 128 px, write WebP and the manifest.
// Output: public/portraits/gen/<id>.webp, <id>-128.webp, manifest.json. The game reads the manifest at runtime and falls back to the older
// portrait or the medallion for any id it does not list (docs/spec/55-portraits.md).
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import {
  checkFfmpeg, cropBox, DEFAULT_FACE, DEFAULT_ZOOM, isMain, loadPromptTable, parsePickArgs, PICK_HELP, pngSize, rawFileName, run, SIZE_LARGE, SIZE_SMALL, UsageError,
} from './lib.mjs'

function readJson(file, fallback) {
  try { return JSON.parse(readFileSync(file, 'utf8')) } catch { return fallback }
}

/** Crop + resize one image to a WebP file with ffmpeg. */
export async function makeWebp(ffmpeg, src, box, size, dest) {
  const vf = `crop=${box.side}:${box.side}:${box.x}:${box.y},scale=${size}:${size}:flags=lanczos`
  const r = await run(ffmpeg, ['-hide_banner', '-v', 'error', '-y', '-i', src, '-vf', vf, '-frames:v', '1', '-c:v', 'libwebp', '-quality', '82', '-compression_level', '6', dest])
  if (r.code !== 0) throw new Error(`ffmpeg failed for ${dest}: ${r.stderr.slice(-300)}`)
}

/** Returns the exit code. */
export async function main(argv, io = { log: console.log, err: console.error }) {
  const table = loadPromptTable()
  let opts
  try {
    opts = parsePickArgs(argv, table.entries)
  } catch (e) {
    if (e instanceof UsageError) { io.err(`error: ${e.message}\n`); io.err(PICK_HELP); return e.exitCode }
    throw e
  }
  if (opts.help) { io.log(PICK_HELP); return 0 }
  const picksDoc = readJson(opts.picksFile, { version: 1, picks: {} })
  picksDoc.picks ??= {}
  for (const [id, p] of Object.entries(opts.picks)) picksDoc.picks[id] = { ...(picksDoc.picks[id] ?? {}), ...p }
  const rawDir = path.join(opts.out, 'raw')
  const todo = []
  const missing = []
  for (const e of table.entries) {
    if (opts.only && !opts.only.includes(e.id)) continue
    const p = picksDoc.picks[e.id] ?? {}
    const letter = p.pick ?? 'a'
    const src = path.join(rawDir, rawFileName(e.id, letter === 'b' ? 1 : 0))
    if (existsSync(src)) todo.push({ entry: e, letter, src, face: p.face ?? DEFAULT_FACE, zoom: p.zoom ?? DEFAULT_ZOOM })
    else missing.push(e.id)
  }
  io.log(`Picking ${todo.length} portrait(s); ${missing.length} have no raw candidate yet${missing.length ? ` (${missing.slice(0, 6).join(', ')}${missing.length > 6 ? ', ...' : ''})` : ''}.`)
  if (opts.dryRun) {
    for (const t of todo.slice(0, 10)) io.log(`  ${t.entry.id}: candidate ${t.letter}, face ${t.face.join(':')}, zoom ${t.zoom} -> ${t.entry.id}.webp / ${t.entry.id}-128.webp`)
    io.log('Dry run: nothing was written.')
    return 0
  }
  if (todo.length === 0 && Object.keys(opts.picks).length === 0) { io.err('error: nothing to pick. Run gen-portraits.mjs first.'); return 1 }
  try { await checkFfmpeg(opts.ffmpeg, { webp: true }) } catch (e) { if (e instanceof UsageError) { io.err(`error: ${e.message}`); return e.exitCode } throw e }
  mkdirSync(opts.publicDir, { recursive: true })
  const manifestFile = path.join(opts.publicDir, 'manifest.json')
  const manifest = readJson(manifestFile, { version: 1, portraits: {} })
  manifest.portraits ??= {}
  let failed = 0
  for (const t of todo) {
    try {
      const sz = pngSize(readFileSync(t.src).subarray(0, 32))
      if (!sz) throw new Error('not a PNG')
      const box = cropBox(sz.width, sz.height, t.face, t.zoom)
      const large = path.join(opts.publicDir, `${t.entry.id}.webp`)
      const small = path.join(opts.publicDir, `${t.entry.id}-128.webp`)
      await makeWebp(opts.ffmpeg, t.src, box, SIZE_LARGE, large)
      await makeWebp(opts.ffmpeg, t.src, box, SIZE_SMALL, small)
      manifest.portraits[t.entry.id] = { pick: t.letter, seed: t.entry.seed, kind: t.entry.kind, bytes: statSync(large).size + statSync(small).size }
    } catch (e) {
      failed++
      io.err(`  FAILED ${t.entry.id}: ${e instanceof Error ? e.message : e}`)
    }
  }
  manifest.version = 1
  manifest.size = SIZE_LARGE
  manifest.small = SIZE_SMALL
  manifest.style = table.style
  const ids = Object.keys(manifest.portraits).sort()
  manifest.portraits = Object.fromEntries(ids.map((k) => [k, manifest.portraits[k]]))
  writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`)
  mkdirSync(path.dirname(opts.picksFile), { recursive: true })
  writeFileSync(opts.picksFile, `${JSON.stringify(picksDoc, null, 2)}\n`)
  const bytes = ids.reduce((a, k) => a + (manifest.portraits[k].bytes ?? 0), 0)
  io.log(`Manifest: ${manifestFile} (${ids.length} portrait(s), ${(bytes / 1048576).toFixed(2)} MB of WebP)`)
  io.log('Commit public/portraits/gen/ and tools/gen/portraits/portrait-picks.json. Not verified by eye until the owner has looked at the app.')
  return failed ? 1 : 0
}

if (isMain(import.meta.url)) {
  main(process.argv.slice(2)).then((c) => { process.exitCode = c }, (e) => { console.error(e instanceof Error ? e.stack : e); process.exitCode = 1 })
}
