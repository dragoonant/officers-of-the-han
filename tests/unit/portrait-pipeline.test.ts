// Portrait pipeline (docs/spec/55-portraits.md) against the fake Flux Studio: prompts, lint, runner, sheets, pick. Needs ffmpeg with libwebp.
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import officers from '../../src/data/officers.json'
import scenario from '../../src/data/scenarios/190.json'
import { build, namesOf } from '../../tools/gen/portraits/build-prompts.mjs'
import { startFakeFlux, validateJob, type FakeFlux } from '../../tools/gen/portraits/fake-flux-studio.mjs'
import { main as sheets } from '../../tools/gen/portraits/contact-sheets.mjs'
import { buildJobBody, main as gen } from '../../tools/gen/portraits/gen-portraits.mjs'
import {
  bannedWords, buildPrompt, candidateSeed, cropBox, genericSpecs, lintPrompt, loadPromptTable, pngSize, roleOf, run, seedFor, STYLE, TRAITS,
} from '../../tools/gen/portraits/lib.mjs'
import { main as pick } from '../../tools/gen/portraits/pick-portraits.mjs'

const table = loadPromptTable()
const quiet = () => {
  const lines: string[] = []
  return { lines, io: { log: (s: string) => lines.push(s), err: (s: string) => lines.push(`ERR ${s}`) } }
}

describe('prompts', () => {
  it('covers every officer and 96 generic faces, once each', () => {
    const ids = table.entries.map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const o of officers) expect(ids).toContain(o.id)
    expect(table.entries.filter((e) => e.kind === 'generic').length).toBeGreaterThanOrEqual(89)
    expect(table.entries.length).toBe(officers.length + 96)
  })
  it('the committed file is exactly what the builder makes from src/data', () => {
    expect(JSON.parse(JSON.stringify(build()))).toEqual(JSON.parse(readFileSync(path.join(__dirname, '../../tools/gen/portraits/portrait-prompts.json'), 'utf8')))
  })
  it('passes the lint (rule 23 words, game names, officer names) and ends with the one style line', () => {
    const names = namesOf(officers)
    for (const e of table.entries) {
      expect(lintPrompt(e.prompt, names), e.id).toEqual([])
      expect(e.prompt.endsWith(STYLE), e.id).toBe(true)
      expect(e.seed).toBe(seedFor(e.id))
    }
    expect(lintPrompt(STYLE, names)).toEqual([])
    expect(JSON.stringify(table)).not.toMatch(/\bdynasty\b/i)
  })
  it('the lint catches banned words, game names and officer names', () => {
    const words = bannedWords()
    expect(words.length).toBe(13)
    for (const w of words) expect(lintPrompt(`A portrait, ${w}, painted`)).not.toEqual([])
    expect(lintPrompt('in the style of Dynasty Warriors')).not.toEqual([])
    expect(lintPrompt('Cao Cao with a beard', ['Cao Cao'])).not.toEqual([])
    expect(lintPrompt('A man in the thirties, calm gaze')).toEqual([])
    expect(lintPrompt('students of wisdom and tutoring')).toEqual([])
  })
  it('turns temperament into an expression and role into dress', () => {
    const base = { key: 'x', sex: 'm', age: 35, role: 'general', troop: 'cavalry', post: 'officer' }
    expect(buildPrompt({ ...base, temperament: 'righteous' })).toContain('steady, level gaze')
    expect(buildPrompt({ ...base, temperament: 'ambitious' })).toContain('calculating')
    expect(buildPrompt({ ...base, temperament: 'cautious' })).toContain('guarded')
    expect(buildPrompt({ ...base, temperament: 'reckless' })).toContain('fierce')
    expect(buildPrompt({ ...base, temperament: 'steady' })).toContain('calm')
    expect(buildPrompt({ ...base, temperament: 'steady' })).toContain('lamellar')
    expect(buildPrompt({ ...base, role: 'civil', temperament: 'steady' })).toContain('gauze')
    expect(buildPrompt({ ...base, role: 'wanderer', temperament: 'steady' })).toContain('hemp')
    expect(buildPrompt({ ...base, sex: 'f', role: 'civil', temperament: 'steady' })).toContain('hairpin')
  })
  it('uses age at 190 or at appearance, and sourced traits only', () => {
    const byId = new Map(table.entries.map((e) => [e.id, e]))
    const liu = byId.get('liu-bei')!
    expect(liu.spec.age).toBe(190 - officers.find((o) => o.id === 'liu-bei')!.born)
    expect(liu.prompt).toContain('long earlobes')
    const late = scenario.appearances[0]!
    const born = officers.find((o) => o.id === late.id)!.born
    expect(byId.get(late.id)!.spec.age).toBe(Math.max(16, late.year - born))
    for (const e of table.entries) if (e.spec.trait) expect(TRAITS[e.id], e.id).toBeTruthy()
    expect(table.entries.filter((e) => e.spec.trait).length).toBe(Object.keys(TRAITS).filter((k) => byId.has(k)).length)
    expect(roleOf({ stats: { war: 40, ldr: 60, int: 80, pol: 70, cha: 60 }, wanderer: false })).toBe('civil')
    expect(roleOf({ stats: { war: 90, ldr: 80, int: 30, pol: 30, cha: 60 }, wanderer: true })).toBe('wanderer')
  })
  it('generic faces vary in sex, age, role and temperament', () => {
    const g = genericSpecs()
    expect(new Set(g.map((x) => x.sex)).size).toBe(2)
    expect(new Set(g.map((x) => x.role)).size).toBe(4)
    expect(new Set(g.map((x) => x.temperament)).size).toBe(5)
    expect(new Set(g.map((x) => x.age)).size).toBeGreaterThanOrEqual(7)
    expect(new Set(g.map((x) => buildPrompt({ key: x.id, ...x }))).size).toBeGreaterThanOrEqual(80)
  })
})

describe('crop maths', () => {
  it('centres a square on the face and stays inside the image', () => {
    expect(cropBox(1000, 1000, [0.5, 0.5], 1)).toEqual({ x: 0, y: 0, side: 1000 })
    expect(cropBox(1000, 1000, [0.5, 0.44], 0.9)).toEqual({ x: 50, y: 0, side: 900 })
    const c = cropBox(1000, 800, [0.1, 0.9], 0.5)
    expect(c.side).toBe(400)
    expect(c.x).toBe(0)
    expect(c.y + c.side).toBeLessThanOrEqual(800)
  })
})

describe('the fake studio and the runner', () => {
  let studio: FakeFlux
  let dir: string
  beforeEach(async () => {
    dir = mkdtempSync(path.join(os.tmpdir(), 'portrait-test-'))
    studio = await startFakeFlux({ delayMs: 20, size: 64 })
  })
  afterEach(async () => {
    await studio.close()
    rmSync(dir, { recursive: true, force: true })
  })
  const ids = 'liu-bei,face-01,diaochan'

  it('validates job bodies like the real studio', () => {
    expect(validateJob(buildJobBody(table, table.entries[0]!, 0))).toBeNull()
    expect(validateJob({ model: 'nope', prompt: 'x' })).not.toBeNull()
    expect(validateJob({ model: 'klein', prompt: '' })).not.toBeNull()
  })

  it('generates two candidates per id, one job at a time, klein, fixed seeds, then resumes with zero requests', async () => {
    const q = quiet()
    expect(await gen(['--base', studio.url, '--out', dir, '--only', ids, '--poll-ms', '5'], q.io)).toBe(0)
    const raw = readdirSync(path.join(dir, 'raw')).filter((f) => f.endsWith('.png')).sort()
    expect(raw).toEqual(['diaochan-a.png', 'diaochan-b.png', 'face-01-a.png', 'face-01-b.png', 'liu-bei-a.png', 'liu-bei-b.png'])
    expect(studio.stats.posts).toBe(6)
    expect(studio.stats.maxConcurrent).toBe(1)
    for (const j of studio.stats.jobs) {
      expect(j.body.model).toBe('klein')
      expect(j.body.batch).toBe(1)
      expect(j.body.aspect).toBe('1:1')
    }
    const liu = table.entries.find((e) => e.id === 'liu-bei')!
    const seeds = studio.stats.jobs.filter((j) => j.body.prompt === liu.prompt).map((j) => j.body.seed)
    expect(seeds).toEqual([liu.seed, candidateSeed(liu.seed, 1)])
    expect(studio.stats.settings).toEqual([{ freeAfter: false }, { freeAfter: true }])
    expect(pngSize(readFileSync(path.join(dir, 'raw', 'liu-bei-a.png')))).toEqual({ width: 64, height: 64 })
    const before = studio.stats.requests
    const q2 = quiet()
    expect(await gen(['--base', studio.url, '--out', dir, '--only', ids], q2.io)).toBe(0)
    expect(studio.stats.requests).toBe(before) // nothing to do: not even a status call
    expect(q2.lines.join('\n')).toContain('Nothing to do')
  })

  it('resumes after a partial run and honours --limit', async () => {
    expect(await gen(['--base', studio.url, '--out', dir, '--only', ids, '--limit', '4', '--poll-ms', '5'], quiet().io)).toBe(0)
    expect(studio.stats.posts).toBe(4)
    expect(await gen(['--base', studio.url, '--out', dir, '--only', ids, '--poll-ms', '5'], quiet().io)).toBe(0)
    expect(studio.stats.posts).toBe(6)
  })

  it('waits while the studio is busy with someone else\'s job', async () => {
    const busy = await startFakeFlux({ delayMs: 10, externalBusyMs: 700 })
    try {
      const q = quiet()
      expect(await gen(['--base', busy.url, '--out', dir, '--only', 'liu-bei', '--candidates', '1', '--poll-ms', '5'], q.io)).toBe(0)
      expect(busy.stats.postedWhileExternalBusy).toBe(0)
      expect(q.lines.join('\n')).toContain('waiting')
    } finally {
      await busy.close()
    }
  }, 20000)

  it('a dry run touches nothing, and an unreachable studio is exit 2', async () => {
    const q = quiet()
    expect(await gen(['--dry-run', '--base', 'http://127.0.0.1:1', '--out', dir, '--only', 'liu-bei'], q.io)).toBe(0)
    expect(q.lines.join('\n')).toContain('"model":"klein"')
    expect(existsSync(path.join(dir, 'raw'))).toBe(false)
    const q2 = quiet()
    expect(await gen(['--base', 'http://127.0.0.1:1', '--out', dir, '--only', 'liu-bei'], q2.io)).toBe(2)
    expect(await gen(['--only', 'nobody'], quiet().io)).toBe(2)
  })

  it('reports a failed image and carries on', async () => {
    const liu = table.entries.find((e) => e.id === 'liu-bei')!
    const bad = await startFakeFlux({ delayMs: 5, failSeeds: [liu.seed] })
    try {
      const q = quiet()
      expect(await gen(['--base', bad.url, '--out', dir, '--only', 'liu-bei,face-01', '--candidates', '1', '--poll-ms', '5'], q.io)).toBe(1)
      expect(existsSync(path.join(dir, 'raw', 'face-01-a.png'))).toBe(true)
      expect(existsSync(path.join(dir, 'raw', 'liu-bei-a.png'))).toBe(false)
    } finally {
      await bad.close()
    }
  })

  it('makes 4x4 sheets, then picks, crops to 256 and 128 WebP and writes the manifest', async () => {
    await gen(['--base', studio.url, '--out', dir, '--only', ids, '--poll-ms', '5'], quiet().io)
    const q = quiet()
    expect(await sheets(['--out', dir, '--only', ids, '--tile', '64'], q.io)).toBe(0)
    const sheet = path.join(dir, 'sheets', 'sheet-01.png')
    expect(pngSize(readFileSync(sheet))).toEqual({ width: 256, height: (64 + 24) * 4 })
    const pub = path.join(dir, 'public')
    const picks = path.join(dir, 'picks.json')
    const qp = quiet()
    expect(await pick(['--out', dir, '--public', pub, '--picks-file', picks, '--only', ids, '--pick', 'liu-bei=b', '--face', 'liu-bei=0.5:0.4'], qp.io)).toBe(0)
    const m = JSON.parse(readFileSync(path.join(pub, 'manifest.json'), 'utf8'))
    expect(Object.keys(m.portraits).sort()).toEqual(['diaochan', 'face-01', 'liu-bei'])
    expect(m.portraits['liu-bei'].pick).toBe('b')
    expect(m.portraits['face-01'].pick).toBe('a')
    expect(JSON.parse(readFileSync(picks, 'utf8')).picks['liu-bei']).toEqual({ pick: 'b', face: [0.5, 0.4] })
    for (const [file, px] of [['liu-bei.webp', 256], ['liu-bei-128.webp', 128]] as const) {
      const r = await run('ffmpeg', ['-v', 'error', '-i', path.join(pub, file), '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1'])
      expect(r.stdout.length).toBe(px * px * 3)
      // solid colour of candidate b (seed + 1), within the lossy tolerance
      const want = table.entries.find((e) => e.id === 'liu-bei')!.seed + 1
      const rgb = [(want * 37) % 256, (want * 91 + 40) % 256, (want * 53 + 90) % 256]
      for (let c = 0; c < 3; c++) expect(Math.abs(r.stdout[(px * px * 3) / 2 + c]! - rgb[c]!)).toBeLessThan(12)
    }
    // a second pick adds to the manifest instead of replacing it
    expect(await pick(['--out', dir, '--public', pub, '--picks-file', picks, '--only', 'diaochan'], quiet().io)).toBe(0)
    expect(Object.keys(JSON.parse(readFileSync(path.join(pub, 'manifest.json'), 'utf8')).portraits).length).toBe(3)
  })

  it('refuses an unknown id in --pick', async () => {
    expect(await pick(['--out', dir, '--pick', 'nobody=a'], quiet().io)).toBe(2)
    writeFileSync(path.join(dir, 'x'), '')
  })
})
