#!/usr/bin/env node
// Step 2 of 3: 4x4 labelled contact sheets of the raw candidates, for review (KB rule 13: look at every image). Pure Node plus ffmpeg for decoding.
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { CANDIDATE_LETTERS, checkFfmpeg, encodePng, isMain, loadPromptTable, parseSheetsArgs, rawFileName, run, SHEETS_HELP, UsageError } from './lib.mjs'

// 5x7 bitmap font, one hex row per line, for A-Z 0-9 and a few marks (labels are upper-cased).
const FONT = {
  A: [0x0e, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11], B: [0x1e, 0x11, 0x11, 0x1e, 0x11, 0x11, 0x1e], C: [0x0e, 0x11, 0x10, 0x10, 0x10, 0x11, 0x0e],
  D: [0x1e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x1e], E: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x1f], F: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x10],
  G: [0x0e, 0x11, 0x10, 0x17, 0x11, 0x11, 0x0f], H: [0x11, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11], I: [0x0e, 0x04, 0x04, 0x04, 0x04, 0x04, 0x0e],
  J: [0x07, 0x02, 0x02, 0x02, 0x02, 0x12, 0x0c], K: [0x11, 0x12, 0x14, 0x18, 0x14, 0x12, 0x11], L: [0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x1f],
  M: [0x11, 0x1b, 0x15, 0x15, 0x11, 0x11, 0x11], N: [0x11, 0x11, 0x19, 0x15, 0x13, 0x11, 0x11], O: [0x0e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  P: [0x1e, 0x11, 0x11, 0x1e, 0x10, 0x10, 0x10], Q: [0x0e, 0x11, 0x11, 0x11, 0x15, 0x12, 0x0d], R: [0x1e, 0x11, 0x11, 0x1e, 0x14, 0x12, 0x11],
  S: [0x0f, 0x10, 0x10, 0x0e, 0x01, 0x01, 0x1e], T: [0x1f, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04], U: [0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  V: [0x11, 0x11, 0x11, 0x11, 0x11, 0x0a, 0x04], W: [0x11, 0x11, 0x11, 0x15, 0x15, 0x15, 0x0a], X: [0x11, 0x11, 0x0a, 0x04, 0x0a, 0x11, 0x11],
  Y: [0x11, 0x11, 0x0a, 0x04, 0x04, 0x04, 0x04], Z: [0x1f, 0x01, 0x02, 0x04, 0x08, 0x10, 0x1f],
  0: [0x0e, 0x11, 0x13, 0x15, 0x19, 0x11, 0x0e], 1: [0x04, 0x0c, 0x04, 0x04, 0x04, 0x04, 0x0e], 2: [0x0e, 0x11, 0x01, 0x02, 0x04, 0x08, 0x1f],
  3: [0x1f, 0x02, 0x04, 0x02, 0x01, 0x11, 0x0e], 4: [0x02, 0x06, 0x0a, 0x12, 0x1f, 0x02, 0x02], 5: [0x1f, 0x10, 0x1e, 0x01, 0x01, 0x11, 0x0e],
  6: [0x06, 0x08, 0x10, 0x1e, 0x11, 0x11, 0x0e], 7: [0x1f, 0x01, 0x02, 0x04, 0x08, 0x08, 0x08], 8: [0x0e, 0x11, 0x11, 0x0e, 0x11, 0x11, 0x0e],
  9: [0x0e, 0x11, 0x11, 0x0f, 0x01, 0x02, 0x0c], '-': [0, 0, 0, 0x1f, 0, 0, 0], '.': [0, 0, 0, 0, 0, 0x0c, 0x0c], ' ': [0, 0, 0, 0, 0, 0, 0],
}

/** Draw `text` into an RGB buffer at (x, y) with the 5x7 font scaled by `scale`. */
export function drawText(buf, width, x, y, text, scale, rgb) {
  let cx = x
  for (const ch of text.toUpperCase()) {
    const g = FONT[ch] ?? FONT[' ']
    for (let row = 0; row < 7; row++) {
      for (let col = 0; col < 5; col++) {
        if (!(g[row] & (1 << (4 - col)))) continue
        for (let dy = 0; dy < scale; dy++) {
          for (let dx = 0; dx < scale; dx++) {
            const px = cx + col * scale + dx
            const py = y + row * scale + dy
            if (px < 0 || px >= width) continue
            const o = (py * width + px) * 3
            if (o < 0 || o + 2 >= buf.length) continue
            buf[o] = rgb[0]
            buf[o + 1] = rgb[1]
            buf[o + 2] = rgb[2]
          }
        }
      }
    }
    cx += 6 * scale
  }
}

/** The label, with the id shortened (never the a/b letter) to fit `max` characters. */
function fit(t, max) {
  return t.label.length <= max ? t.label : `${t.id.slice(0, Math.max(1, max - 2))} ${t.label.slice(-1)}`
}

async function decodeTile(ffmpeg, file, size) {
  const r = await run(ffmpeg, ['-v', 'error', '-i', file, '-vf', `scale=${size}:${size}:flags=bilinear`, '-frames:v', '1', '-pix_fmt', 'rgb24', '-f', 'rawvideo', 'pipe:1'])
  if (r.code !== 0 || r.stdout.length !== size * size * 3) throw new Error(`could not decode ${file}: ${r.stderr.slice(-200)}`)
  return r.stdout
}

/** The tiles (one per existing or missing candidate) in id order, 16 per sheet. */
export function planSheets(entries, rawDir, candidates = CANDIDATE_LETTERS.length) {
  const tiles = []
  for (const e of entries) for (let i = 0; i < candidates; i++) tiles.push({ id: e.id, index: i, label: `${e.id} ${CANDIDATE_LETTERS[i]}`, file: path.join(rawDir, rawFileName(e.id, i)) })
  const sheets = []
  for (let i = 0; i < tiles.length; i += 16) sheets.push(tiles.slice(i, i + 16))
  return sheets
}

export async function main(argv, io = { log: console.log, err: console.error }) {
  const table = loadPromptTable()
  let opts
  try {
    opts = parseSheetsArgs(argv, table.entries)
  } catch (e) {
    if (e instanceof UsageError) { io.err(`error: ${e.message}\n`); io.err(SHEETS_HELP); return e.exitCode }
    throw e
  }
  if (opts.help) { io.log(SHEETS_HELP); return 0 }
  const rawDir = path.join(opts.out, 'raw')
  const entries = table.entries.filter((e) => (!opts.only || opts.only.includes(e.id)) && CANDIDATE_LETTERS.some((_, i) => existsSync(path.join(rawDir, rawFileName(e.id, i)))))
  if (entries.length === 0) { io.err('error: no raw candidates yet. Run gen-portraits.mjs first.'); return 1 }
  try { await checkFfmpeg(opts.ffmpeg) } catch (e) { if (e instanceof UsageError) { io.err(`error: ${e.message}`); return e.exitCode } throw e }
  const sheetsDir = path.join(opts.out, 'sheets')
  mkdirSync(sheetsDir, { recursive: true })
  for (const f of readdirSync(sheetsDir)) if (/^sheet-\d+\.png$/.test(f)) rmSync(path.join(sheetsDir, f))
  const T = opts.tile
  const LABEL = 24
  const W = T * 4
  const H = (T + LABEL) * 4
  const sheets = planSheets(entries, rawDir)
  let n = 0
  for (const tiles of sheets) {
    const buf = Buffer.alloc(W * H * 3, 24)
    for (let k = 0; k < tiles.length; k++) {
      const t = tiles[k]
      const ox = (k % 4) * T
      const oy = Math.floor(k / 4) * (T + LABEL)
      if (existsSync(t.file)) {
        const px = await decodeTile(opts.ffmpeg, t.file, T)
        for (let y = 0; y < T; y++) px.copy(buf, ((oy + y) * W + ox) * 3, y * T * 3, (y + 1) * T * 3)
      } else {
        for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) buf.fill(60, ((oy + y) * W + ox + x) * 3, ((oy + y) * W + ox + x) * 3 + 3)
        drawText(buf, W, ox + 8, oy + T / 2 - 7, 'MISSING', 2, [200, 90, 60])
      }
      drawText(buf, W, ox + 6, oy + T + 5, fit(t, Math.floor((T - 8) / 12)), 2, [235, 220, 190])
    }
    n++
    writeFileSync(path.join(sheetsDir, `sheet-${String(n).padStart(2, '0')}.png`), encodePng(W, H, buf))
  }
  writeFileSync(path.join(sheetsDir, 'index.json'), `${JSON.stringify(sheets.map((s, i) => ({ sheet: i + 1, tiles: s.map((t) => t.label) })), null, 2)}\n`)
  io.log(`Wrote ${n} contact sheet(s) (4x4, ${entries.length} portraits) to ${sheetsDir}`)
  io.log('Review every sheet (KB rule 13), then pick: node tools/gen/portraits/pick-portraits.mjs --pick id=b,...')
  return 0
}

if (isMain(import.meta.url)) {
  main(process.argv.slice(2)).then((c) => { process.exitCode = c }, (e) => { console.error(e instanceof Error ? e.stack : e); process.exitCode = 1 })
}
