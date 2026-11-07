// The Audio Studio runner (tools/audio): cue table vs docs/spec/60-audio.md, bar maths, flag parsing, and the whole pipeline
// (generate -> master -> manifest) against the fake studio. Nothing here makes sound; the generated files are click tracks in a temp folder.
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { CUES, entriesForSlot, normalizeManifest, SLOTS } from '../../src/client/audio/manifest'
import { estimateTempo, findFirstSound, findLastSound } from '../../tools/audio/dsp.mjs'
import { startFakeStudio, validateJob, type FakeStudio } from '../../tools/audio/fake-audio-studio.mjs'
import { classifyStatus, jobFileNames, main as genMain } from '../../tools/audio/gen-music.mjs'
import {
  barSamples, barSeconds, buildJobBody, loadCueTable, loopSeconds, parseFakeArgs, parseGenArgs, parseMasterArgs, rawFileName, round3, run,
  SAMPLE_RATE, UsageError, type Cue,
} from '../../tools/audio/lib.mjs'
import { buildManifest, main as masterMain, manifestEntry, planCut } from '../../tools/audio/master-audio.mjs'

const table = loadCueTable()
const cue = (id: string): Cue => {
  const c = table.cues.find((x) => x.id === id)
  if (!c) throw new Error(`no cue ${id}`)
  return c
}
const capture = () => {
  const lines: string[] = []
  return { lines, io: { log: (s: string) => void lines.push(s), err: (s: string) => void lines.push(s) } }
}


const MUSIC = table.cues.filter((c) => c.kind === 'music')
const SFX = table.cues.filter((c) => c.kind === 'sfx')
const BANNED_B64 = 'WyJjaGliaSIsIk1HU0QiLCJTRCIsInN1cGVyLWRlZm9ybWVkIiwiTWFzdGVyIEdyYWRlIFNEIiwiR3VuZGFtIiwiTmVuZG9yb2lkIiwiY3V0ZSIsImthd2FpaSIsInRveSIsImNhcnRvb255Iiwic3R1YmJ5IiwidGlueSBsZWdzIl0='

describe('cue table (docs/spec/60-audio.md sections 2 and 4)', () => {
  it('lists the 13 music cues and 18 effects, with unique ids and seeds', () => {
    expect(MUSIC.map((c) => c.id)).toEqual([
      'bed-title', 'bed-peace', 'bed-winter', 'bed-war', 'bed-court', 'bed-battle', 'charge', 'bed-duel', 'bed-debate', 'jingle-victory', 'jingle-defeat', 'sting-letter', 'sting-month',
    ])
    expect(SFX).toHaveLength(18)
    expect(new Set(table.cues.map((c) => c.id)).size).toBe(table.cues.length)
    expect(new Set(table.cues.map((c) => c.seed)).size).toBe(table.cues.length)
  })
  it('every effect and sting maps to a cue the game plays, and every game cue has a file slot in the table', () => {
    const cues = new Set(table.cues.map((c) => c.cue).filter(Boolean))
    for (const c of CUES) expect(cues.has(c), c).toBe(true)
    for (const c of table.cues.filter((x) => x.role === 'sfx')) expect(c.id).toBe(`sfx-${c.cue}`)
  })
  it('every bed, jingle and the charge layer is tagged with a mood the game has', () => {
    const moods = new Set(SLOTS.map((s) => s.mood).filter(Boolean))
    for (const c of MUSIC.filter((x) => x.role === 'bed' || x.mood)) expect(moods.has(c.mood as never), c.id).toBe(true)
    for (const m of moods) expect(MUSIC.some((c) => c.mood === m && c.role !== 'charge'), String(m)).toBe(true)
  })
  it('whole bars: loop lengths from tempo and bar count, jingles and stings are one-shots', () => {
    const spec: Record<string, [number, string, number, number]> = {
      'bed-title': [72, 'D minor', 12, 40],
      'bed-peace': [90, 'G major', 12, 32],
      'bed-winter': [72, 'A minor', 12, 40],
      'bed-war': [100, 'E minor', 12, 28.8],
      'bed-court': [80, 'F major', 12, 36],
      'bed-battle': [120, 'D minor', 20, 40],
      charge: [120, 'D minor', 8, 16],
      'bed-duel': [108, 'A minor', 8, 17.778],
      'bed-debate': [88, 'C major', 8, 21.818],
    }
    for (const [id, [bpm, key, bars, secs]] of Object.entries(spec)) {
      const c = cue(id)
      expect([c.bpm, c.key, c.bars, c.beatsPerBar, c.timesig, c.loop]).toEqual([bpm, key, bars, 4, '4', true])
      expect(round3(loopSeconds(c))).toBeCloseTo(secs, 3)
    }
    for (const id of ['jingle-victory', 'jingle-defeat', 'sting-letter', 'sting-month']) expect(cue(id).loop).toBe(false)
  })
  it('keeps battle and the charge layer on one tempo, key and meter (the phase-lock rule)', () => {
    expect(new Set(['bed-battle', 'charge'].map((id) => `${cue(id).bpm}|${cue(id).key}|${cue(id).beatsPerBar}`)).size).toBe(1)
  })
  it('asks the studio for a take a little longer than the loop, within the studio limits', () => {
    for (const c of MUSIC) {
      const slack = (c.duration ?? 0) - loopSeconds(c)
      expect(slack, c.id).toBeGreaterThanOrEqual(2)
      expect(slack, c.id).toBeLessThanOrEqual(6.5)
      expect(validateJob(buildJobBody(c, table, 2)), c.id).toBeNull()
    }
    for (const c of SFX) {
      expect(validateJob(buildJobBody(c, table, 2)), c.id).toBeNull()
      expect(c.keepSeconds ?? 0, c.id).toBeLessThanOrEqual(c.seconds ?? 0)
    }
  })
  it('the budget: the loops, jingles and stings add up to about 5 MB at the OGG quality', () => {
    const seconds = MUSIC.reduce((a, c) => a + loopSeconds(c), 0) + SFX.reduce((a, c) => a + (c.keepSeconds ?? 0), 0)
    const bytes = seconds * (128000 / 8)
    expect(bytes / 1048576).toBeGreaterThan(3.5)
    expect(bytes / 1048576).toBeLessThan(5.5)
  })
  it('every prompt names instruments and mechanism only: no game, studio or composer, nothing from KB rule 23', () => {
    const banned = JSON.parse(Buffer.from(BANNED_B64, 'base64').toString('utf8')) as string[]
    for (const c of table.cues) {
      expect(c.prompt, c.id).not.toMatch(/dynasty|koei|tecmo|total war|nobunaga|genshin|hans zimmer|three kingdoms/i)
      for (const w of banned) expect(new RegExp(`(^|[^a-z0-9])${w.replace(/[-\s]/g, '[-\\s]')}($|[^a-z0-9])`, 'i').test(`${c.prompt} ${c.negative ?? ''}`), `${c.id} ${w.length}`).toBe(false)
    }
    for (const c of MUSIC) expect(`${c.prompt}`, c.id).toMatch(/guqin|pipa|xiao|dizi|zheng|bianzhong|drum|gong|strings|suona/)
    expect(table.musicExclusions).toMatch(/no vocals.*no lyrics/)
    expect(cue('charge').prompt).toMatch(/no bass, no cello, no sub-bass/)
  })
  it('every effect prompt says "no music, no voices" and carries a negative prompt against them', () => {
    for (const c of SFX) {
      expect(c.prompt, c.id).toMatch(/no music, no voices/)
      expect(String(buildJobBody(c, table, 1).negative), c.id).toMatch(/music.*voices/)
    }
  })
  it('puts the common exclusions on every music request', () => {
    const body = buildJobBody(cue('bed-battle'), table, 2)
    expect(body).toMatchObject({ mode: 'music', lyrics: '[Instrumental]', duration: 44, bpm: 120, key: 'D minor', timesig: '4', batch: 2, seed: 52106, steps: 8 })
    expect(String(body.prompt)).toContain(table.musicExclusions)
    expect(buildJobBody(cue('sfx-clash'), table, 1)).toMatchObject({ mode: 'sfx', seconds: 3, batch: 1, seed: 52206, steps: 50 })
  })
})

describe('bar maths (60-audio section 5)', () => {
  it('is bars x beatsPerBar x 60 / bpm', () => {
    expect(barSeconds(120, 4, 20)).toBe(40)
    expect(barSeconds(72, 4, 16)).toBeCloseTo(53.3333, 4)
    expect(barSeconds(100, 4, 6)).toBeCloseTo(14.4, 10)
    expect(barSeconds(66, 4, 4)).toBeCloseTo(14.5454, 3)
  })
  it('rounds to a whole sample, within 12 microseconds of the exact length', () => {
    expect(barSamples(120, 4, 20)).toBe(40 * 44100)
    for (const c of MUSIC) {
      const n = barSamples(c.bpm, c.beatsPerBar, c.bars ?? 0)
      expect(Number.isInteger(n)).toBe(true)
      expect(Math.abs(n / SAMPLE_RATE - loopSeconds(c))).toBeLessThan(12e-6)
    }
  })
  it('cuts a loop to exactly the bar length, starting at the first sound, with a 10 ms declick', () => {
    const sr = SAMPLE_RATE
    const x = new Float32Array(sr * 50)
    for (let i = Math.round(0.35 * sr); i < x.length; i++) x[i] = 0.3 * Math.sin((2 * Math.PI * 220 * i) / sr)
    const plan = planCut(cue('bed-battle'), x, { seamFadeMs: 10 })
    expect(Math.abs(plan.start - Math.round(0.35 * sr))).toBeLessThan(sr * 0.001)
    expect(plan.length).toBe(40 * sr)
    expect(plan.fadeIn).toBe(441)
    expect(plan.fadeOut).toBe(441)
    expect(plan.padded).toBe(0)
    expect(planCut(cue('bed-battle'), x, { seamFadeMs: 0 }).fadeIn).toBe(0)
  })
  it('pads (and says so) when the take is too short, and keeps a jingle past its nominal bars for the natural tail', () => {
    const sr = SAMPLE_RATE
    const short = new Float32Array(sr * 30).fill(0.2)
    expect(planCut(cue('bed-battle'), short, { seamFadeMs: 10 }).padded).toBeGreaterThan(0)
    const j = new Float32Array(sr * 18)
    for (let i = Math.round(0.2 * sr); i < 16.5 * sr; i++) j[i] = 0.2 * Math.sin((2 * Math.PI * 330 * i) / sr)
    const plan = planCut(cue('jingle-victory'), j, { seamFadeMs: 10 })
    expect(plan.length).toBeGreaterThan(barSamples(100, 4, 4))
    expect(plan.length / sr).toBeCloseTo(16.5 - 0.2 + 0.25, 1)
    expect(plan.fadeOut).toBe(Math.round(0.25 * sr))
  })
  it('keeps an effect short: head pre-roll of 2 ms, no longer than keepSeconds', () => {
    const sr = SAMPLE_RATE
    const x = new Float32Array(sr * 4)
    for (let i = Math.round(0.1 * sr); i < 3 * sr; i++) x[i] = 0.5 * Math.sin(i / 7) * Math.exp(-(i - 0.1 * sr) / sr)
    const plan = planCut(cue('sfx-clash'), x, { seamFadeMs: 10 })
    expect(plan.length).toBeLessThanOrEqual(Math.round(1.2 * sr))
    expect(plan.start).toBeLessThanOrEqual(plan.firstSound)
    expect(plan.firstSound - plan.start).toBeLessThanOrEqual(Math.round(0.002 * sr))
  })
})

describe('signal analysis', () => {
  const sr = SAMPLE_RATE
  const clicks = (bpm: number, seconds: number, headSec: number): Float32Array => {
    const x = new Float32Array(Math.round(seconds * sr))
    const period = (60 / bpm) * sr
    for (let t = headSec * sr; t < x.length; t += period) {
      for (let k = 0; k < 800 && t + k < x.length; k++) x[Math.round(t) + k] = 0.8 * Math.exp(-k / 150) * Math.sin(k / 3)
    }
    return x
  }
  it('finds where the sound starts and ends', () => {
    const x = clicks(120, 10, 0.4)
    expect(findFirstSound(x, sr)).toBeGreaterThanOrEqual(Math.round(0.4 * sr))
    expect(findFirstSound(x, sr)).toBeLessThan(Math.round(0.4 * sr) + 20)
    expect(findFirstSound(new Float32Array(1000), sr)).toBe(-1)
    expect(findLastSound(x, sr)).toBeGreaterThan(9 * sr)
    expect(findLastSound(new Float32Array(1000), sr)).toBe(0)
  })
  it('agrees with the requested BPM on a click track and flags a drifted one', () => {
    const a = estimateTempo(clicks(120, 24, 0.3), sr, 120)
    expect(Math.abs(a.driftPct)).toBeLessThan(1)
    const b = estimateTempo(clicks(108, 24, 0.3), sr, 120)
    expect(b.driftPct).toBeLessThan(-5)
  })
})

describe('command lines', () => {
  const cues = table.cues
  it('gen-music: defaults, lists, and numbers', () => {
    const d = parseGenArgs([], cues, table)
    expect(d).toMatchObject({ dryRun: false, force: false, only: null, limit: null, candidates: 2, base: 'http://localhost:7890' })
    const o = parseGenArgs(['--only', 'sfx-clash, sfx-fire', '--dry-run', '--base', 'http://192.168.1.5:7890/', '--candidates', '1', '--limit', '3', '--force', '--timeout', '60'], cues, table)
    expect(o).toMatchObject({ only: ['sfx-clash', 'sfx-fire'], dryRun: true, base: 'http://192.168.1.5:7890', candidates: 1, limit: 3, force: true, timeoutMs: 60000 })
    expect(parseGenArgs(['--base=http://127.0.0.1:1234'], cues, table).base).toBe('http://127.0.0.1:1234')
  })
  it('gen-music: rejects what it cannot use, with a message', () => {
    expect(() => parseGenArgs(['--only', 'bed-nope'], cues, table)).toThrow(/unknown cue id: bed-nope/)
    expect(() => parseGenArgs(['--candidates', '3'], cues, table)).toThrow(/--candidates must be a whole number from 1 to 2/)
    expect(() => parseGenArgs(['--limit', '0'], cues, table)).toThrow(/--limit/)
    expect(() => parseGenArgs(['--base', 'localhost:7890'], cues, table)).toThrow(UsageError)
    expect(() => parseGenArgs(['--frobnicate'], cues, table)).toThrow(UsageError)
    expect(() => parseGenArgs(['--only'], cues, table)).toThrow(UsageError)
  })
  it('master-audio: picks, ffmpeg path and switches', () => {
    const o = parseMasterArgs(['--ffmpeg', 'C:\\tools\\ffmpeg\\bin\\ffmpeg.exe', '--pick', 'bed-battle=b,sfx-clash=a', '--prune', '--audition', '--jobs', '4', '--seam-fade-ms', '0'], cues)
    expect(o).toMatchObject({ ffmpeg: 'C:\\tools\\ffmpeg\\bin\\ffmpeg.exe', picks: { 'bed-battle': 'b', 'sfx-clash': 'a' }, alt: false, prune: true, audition: true, jobs: 4, seamFadeMs: 0 })
    expect(() => parseMasterArgs(['--pick', 'bed-battle=c'], cues)).toThrow(/id=a or id=b/)
    expect(() => parseMasterArgs(['--pick', 'nope=a'], cues)).toThrow(/unknown cue id/)
    expect(() => parseMasterArgs(['--seam-fade-ms', '500'], cues)).toThrow(UsageError)
    expect(parseMasterArgs(['--alt'], cues).alt).toBe(true)
  })
  it('fake studio: port and delay', () => {
    expect(parseFakeArgs(['--port', '0', '--delay-ms', '5'])).toMatchObject({ port: 0, delayMs: 5 })
    expect(() => parseFakeArgs(['--port', 'x'])).toThrow(UsageError)
  })
  it('reads the studio status words and file lists leniently', () => {
    expect(classifyStatus({ status: 'completed' })).toBe('done')
    expect(classifyStatus({ status: 'Failed' })).toBe('failed')
    expect(classifyStatus({ status: 'running' })).toBe('pending')
    expect(classifyStatus({})).toBe('pending')
    expect(jobFileNames({ audios: ['audio_0.flac', 'audio_1.flac'] }, 2)).toEqual(['audio_0.flac', 'audio_1.flac'])
    expect(jobFileNames({ files: [{ name: 'x/audio_0.flac' }] }, 2)).toEqual(['audio_0.flac'])
    expect(jobFileNames({}, 2)).toEqual(['audio_0.flac', 'audio_1.flac'])
  })
})

describe('manifest building', () => {
  const state = {
    'bed-battle': { picked: 'a', candidates: { a: {}, b: {} } },
    'sfx-clash': { picked: 'b', candidates: { b: { alt: 'sfx-clash-b.m4a' } } },
  }
  const cues = [cue('bed-battle'), cue('sfx-clash')]
  it('writes the game schema: candidate a by default, loopEnd = bar length, OGG only unless an M4A was made', () => {
    expect(manifestEntry(cue('bed-battle'), 'a')).toEqual({
      id: 'bed-battle', file: 'bed-battle-a.ogg', bpm: 120, beatsPerBar: 4, loopStart: 0, loopEnd: 40, gainDb: 0, role: 'bed', mood: 'battle',
    })
    expect(manifestEntry(cue('bed-battle'), 'a', { alt: true })).toMatchObject({ alt: 'bed-battle-a.m4a' })
    expect(manifestEntry(cue('jingle-victory'), 'a')).toMatchObject({ role: 'stinger', mood: 'victory', loopEnd: 0, bpm: 100 })
    expect(manifestEntry(cue('sting-month'), 'a')).toMatchObject({ role: 'stinger', cue: 'sting-month', loopEnd: 0 })
    expect(manifestEntry(cue('sfx-ui-tap'), 'a')).toMatchObject({ role: 'sfx', cue: 'ui-tap', bpm: 0, loopEnd: 0, gainDb: -3 })
    expect(manifestEntry(cue('charge'), 'a')).toMatchObject({ role: 'charge', loopEnd: 16, mood: 'battle' })
  })
  it('keeps foreign entries, follows the pick, and lists the other candidate only in audition mode', () => {
    const foreign = { id: 'extra', file: 'extra.ogg', role: 'bed', mood: 'peace' }
    const m = buildManifest({ version: 1, tracks: [foreign, { id: 'bed-battle', file: 'old.ogg', role: 'bed' }] }, cues, state)
    expect(m.tracks.map((t) => t.id)).toEqual(['extra', 'bed-battle', 'sfx-clash'])
    expect(m.tracks[2]).toMatchObject({ file: 'sfx-clash-b.ogg', alt: 'sfx-clash-b.m4a' })
    const a = buildManifest(m, cues, state, { audition: true })
    expect(a.tracks.map((t) => t.id)).toEqual(['extra', 'bed-battle', 'bed-battle-b', 'sfx-clash'])
    expect(buildManifest(a, cues, state).tracks.map((t) => t.id)).toEqual(['extra', 'bed-battle', 'sfx-clash'])
  })
})

// ---- the whole pipeline against the fake studio ----------------------------------------------------------------------------------------

const have = (tool: string): boolean => spawnSync(tool, ['-version'], { stdio: 'ignore' }).status === 0
const ffprobe = (file: string, entry: string): number => {
  const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries', entry, '-of', 'default=nw=1:nk=1', file], { encoding: 'utf8' })
  return Number(r.stdout.trim())
}

describe.skipIf(!have('ffmpeg') || !have('ffprobe'))('pipeline: gen -> master -> manifest, against the fake studio', () => {
  // a subset keeps the test fast: a loop, the phase-locked layer, a jingle, a sting and two effects
  const SUB = ['bed-duel', 'charge', 'jingle-victory', 'sting-letter', 'sfx-clash', 'sfx-ui-tap']
  const only = SUB.join(',')
  let studio: FakeStudio
  let tmp: string
  let out: string
  let pub: string
  const genArgs = (...more: string[]) => ['--base', studio.url, '--out', out, '--poll-ms', '20', ...more]

  beforeAll(async () => {
    tmp = mkdtempSync(path.join(os.tmpdir(), 'audio-runner-test-'))
    out = path.join(tmp, 'out')
    pub = path.join(tmp, 'public-audio')
    studio = await startFakeStudio({ delayMs: 20 })
  })
  afterAll(async () => {
    await studio.close()
    rmSync(tmp, { recursive: true, force: true })
  })

  it('--dry-run prints the whole plan (all 31 cues) and makes zero network calls', async () => {
    const { lines, io } = capture()
    expect(await genMain(genArgs('--dry-run'), io)).toBe(0)
    expect(studio.stats.requests).toBe(0)
    const text = lines.join('\n')
    for (const c of table.cues) expect(text).toContain(c.id)
    expect(text).toContain('Dry run')
    expect(existsSync(path.join(out, 'raw'))).toBe(false)
    const dead = capture()
    expect(await genMain(['--dry-run', '--base', 'http://127.0.0.1:1', '--out', out], dead.io)).toBe(0)
  })

  it('generates the cues, two candidates each, one job at a time, with the recorded seeds', async () => {
    const { lines, io } = capture()
    expect(await genMain(genArgs('--only', only), io), lines.join('\n')).toBe(0)
    expect(studio.stats.posts).toBe(SUB.length)
    expect(studio.stats.rejected).toBe(0)
    expect(studio.stats.maxConcurrent).toBe(1)
    expect(studio.stats.statusCalls).toBe(1)
    for (const id of SUB) for (const i of [0, 1]) expect(existsSync(path.join(out, 'raw', rawFileName(id, i))), `${id} ${i}`).toBe(true)
    const log = JSON.parse(readFileSync(path.join(out, 'raw', 'generation-log.json'), 'utf8'))
    for (const id of SUB) {
      expect(log[id].seed).toBe(cue(id).seed)
      expect(log[id].request.batch).toBe(2)
    }
    const posted = studio.stats.jobs.map((j) => j.body)
    expect(posted.filter((b) => b.mode === 'music')).toHaveLength(4)
    expect(posted.filter((b) => b.mode === 'sfx')).toHaveLength(2)
    expect(posted.find((b) => b.bpm === 108)).toMatchObject({ mode: 'music', bpm: 108, key: 'A minor', lyrics: '[Instrumental]', duration: 22 })
  }, 300000)

  it('a second run makes zero requests', async () => {
    const before = studio.stats.requests
    const { lines, io } = capture()
    expect(await genMain(genArgs('--only', only), io)).toBe(0)
    expect(studio.stats.requests).toBe(before)
    expect(lines.join('\n')).toContain('Nothing to do')
  })

  it('--force archives the old takes first; --candidates 1 leaves the other take alone', async () => {
    const { io } = capture()
    expect(await genMain(genArgs('--force', '--only', 'sfx-ui-tap', '--candidates', '1'), io)).toBe(0)
    expect(studio.stats.jobs.at(-1)?.body).toMatchObject({ mode: 'sfx', batch: 1, seed: cue('sfx-ui-tap').seed })
    const archive = path.join(out, 'raw', 'archive')
    const stamps = readdirSync(archive)
    expect(stamps).toHaveLength(1)
    expect(readdirSync(path.join(archive, stamps[0] ?? ''))).toEqual(['sfx-ui-tap-a.flac'])
    expect(existsSync(path.join(out, 'raw', 'sfx-ui-tap-b.flac'))).toBe(true)
  }, 120000)

  it('waits while the studio reports other jobs, and never starts two at once', async () => {
    const busy = await startFakeStudio({ delayMs: 20 })
    try {
      // a job from "someone else" is already running when the runner asks
      const first = fetch(`${busy.url}/api/jobs`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mode: 'sfx', prompt: 'x'.repeat(30), seconds: 6, seed: 1 }) })
      await first
      const { lines, io } = capture()
      expect(await genMain(['--base', busy.url, '--out', path.join(tmp, 'busy'), '--poll-ms', '20', '--only', 'sfx-ui-tap', '--candidates', '1'], io)).toBe(0)
      expect(busy.stats.maxConcurrent).toBe(1)
      expect(lines.join('\n')).toMatch(/saved sfx-ui-tap-a\.flac/)
    } finally {
      await busy.close()
    }
  }, 60000)

  it('reports an unreachable studio clearly, without touching files', async () => {
    const { lines, io } = capture()
    expect(await genMain(['--base', 'http://127.0.0.1:1', '--out', path.join(tmp, 'elsewhere'), '--only', 'sfx-clash'], io)).toBe(2)
    expect(lines.join('\n')).toMatch(/cannot reach the Audio Studio/)
  })

  it('refuses to master without ffmpeg, saying how to get it', async () => {
    const { lines, io } = capture()
    expect(await masterMain(['--ffmpeg', path.join(tmp, 'no-such-ffmpeg'), '--out', out, '--public', pub, '--only', 'sfx-clash'], io)).toBe(2)
    expect(lines.join('\n')).toMatch(/ffmpeg was not found.*--ffmpeg/)
    expect(existsSync(pub)).toBe(false)
  })

  describe('mastering', () => {
    let manifest: ReturnType<typeof normalizeManifest>
    let report: { entries: Record<string, Record<string, any>>; shippedBytes: number }

    it('masters every take to OGG (no M4A by default) and writes a manifest the game accepts', async () => {
      const { lines, io } = capture()
      expect(await masterMain(['--out', out, '--public', pub, '--jobs', '4', '--only', only], io), lines.join('\n')).toBe(0)
      const warns: string[] = []
      manifest = normalizeManifest(JSON.parse(readFileSync(path.join(pub, 'manifest.json'), 'utf8')), (w) => warns.push(w))
      expect(warns).toEqual([])
      expect(manifest.tracks.map((t) => t.id)).toEqual(SUB.slice().sort((a, b) => table.cues.findIndex((c) => c.id === a) - table.cues.findIndex((c) => c.id === b)))
      for (const t of manifest.tracks) {
        expect(existsSync(path.join(pub, t.file)), t.file).toBe(true)
        expect(t.alt).toBeUndefined()
        expect(existsSync(path.join(pub, t.file.replace('.ogg', '.m4a')))).toBe(false)
        expect(t.file).toMatch(/-a\.ogg$/)
      }
      for (const s of SLOTS.filter((x) => x.key === 'charge' || x.key === 'bed:duel' || x.key === 'cue:clash' || x.key === 'cue:sting-letter')) expect(entriesForSlot(manifest, s).length, s.key).toBe(1)
      const charge = manifest.tracks.find((t) => t.id === 'charge')
      expect([charge?.bpm, charge?.beatsPerBar, charge?.loopEnd]).toEqual([120, 4, 16])
      report = JSON.parse(readFileSync(path.join(out, 'report.json'), 'utf8'))
      expect(Object.keys(report.entries)).toHaveLength(SUB.length * 2)
      expect(report.shippedBytes).toBeGreaterThan(0)
      expect(lines.join('\n')).toMatch(/Shipped audio: .* MB/)
    }, 600000)

    it('lengths are exactly bar-aligned (ffprobe on the OGG, decoded sample counts in the report)', () => {
      for (const c of MUSIC.filter((x) => SUB.includes(x.id) && x.loop)) {
        const expected = loopSeconds(c)
        for (const l of ['a', 'b']) {
          const e = report.entries[`${c.id}-${l}`]!
          expect(e.samples, c.id).toBe(barSamples(c.bpm, c.beatsPerBar, c.bars ?? 0))
          expect(Math.abs(ffprobe(path.join(pub, `${c.id}-${l}.ogg`), 'format=duration') - expected), `${c.id}-${l}.ogg`).toBeLessThan(0.002)
          expect(Math.abs(e.ogg.seconds - expected), `${c.id} ogg decoded`).toBeLessThan(0.0005)
          expect(e.m4a).toBeNull()
        }
      }
    })

    it('jingles and stings keep their natural tail past the nominal bars; effects stay short', () => {
      expect(report.entries['jingle-victory-a']!.seconds).toBeGreaterThan(loopSeconds(cue('jingle-victory')))
      expect(report.entries['sting-letter-a']!.seconds).toBeGreaterThan(loopSeconds(cue('sting-letter')))
      expect(report.entries['sfx-clash-a']!.seconds).toBeLessThanOrEqual(1.2)
      expect(report.entries['sfx-ui-tap-a']!.seconds).toBeLessThanOrEqual(0.5)
      expect(manifest.tracks.find((t) => t.id === 'jingle-victory')?.loopEnd).toBe(0)
    })

    it('loudness is within 1 LU of target (beds and charge -16, jingles -14, stings -15); true peak <= -1 dBTP; effects peak near -3 dBFS', () => {
      for (const [key, e] of Object.entries(report.entries)) {
        if (e.kind === 'music') {
          expect(Math.abs(e.lufs - e.targetLufs), `${key} LUFS ${e.lufs}`).toBeLessThanOrEqual(1)
          expect(e.truePeakDb, `${key} true peak`).toBeLessThanOrEqual(-1)
        } else {
          expect(Math.abs(e.peakDb - e.targetPeakDb), `${key} peak ${e.peakDb}`).toBeLessThanOrEqual(1.5)
        }
        expect(e.notVerifiedByEar).toBe(true)
        expect(typeof e.crestDb).toBe('number')
      }
      expect(report.entries['bed-duel-a']!.targetLufs).toBe(-16)
      expect(report.entries['charge-a']!.targetLufs).toBe(-16)
      expect(report.entries['jingle-victory-a']!.targetLufs).toBe(-14)
      expect(report.entries['sting-letter-a']!.targetLufs).toBe(-15)
    })

    it('bar 1 starts at 0.000 s: the head silence is gone and the tempo check finds the requested BPM', async () => {
      for (const id of ['bed-duel', 'charge']) {
        const e = report.entries[`${id}-a`]!
        expect(e.firstSoundSec, id).toBeGreaterThan(0.1)
        expect(Math.abs(e.tempoDriftPct), `${id} drift`).toBeLessThan(2.5)
        const pcm = await run('ffmpeg', ['-v', 'error', '-i', path.join(pub, `${id}-a.ogg`), '-t', '0.1', '-ac', '1', '-f', 'f32le', 'pipe:1'])
        const x = new Float32Array(pcm.stdout.buffer.slice(pcm.stdout.byteOffset, pcm.stdout.byteOffset + pcm.stdout.byteLength))
        expect(findFirstSound(x, SAMPLE_RATE, -45), id).toBeLessThan(Math.round(0.005 * SAMPLE_RATE))
      }
    })

    it('records both candidates', () => {
      const cands = JSON.parse(readFileSync(path.join(pub, 'candidates.json'), 'utf8'))
      for (const id of SUB) {
        expect(cands.cues[id].picked).toBe('a')
        expect(Object.keys(cands.cues[id].candidates)).toEqual(['a', 'b'])
        expect(existsSync(path.join(pub, `${id}-b.ogg`))).toBe(true)
      }
    })

    it('--alt also writes the M4A and names it in the manifest', async () => {
      const { lines, io } = capture()
      expect(await masterMain(['--out', out, '--public', pub, '--only', 'sfx-ui-tap', '--alt'], io), lines.join('\n')).toBe(0)
      const m = JSON.parse(readFileSync(path.join(pub, 'manifest.json'), 'utf8'))
      expect(m.tracks.find((t: { id: string }) => t.id === 'sfx-ui-tap').alt).toBe('sfx-ui-tap-a.m4a')
      expect(existsSync(path.join(pub, 'sfx-ui-tap-a.m4a'))).toBe(true)
    }, 120000)

    it('--audition lists the other candidates as extra tracks the game still accepts; --pick and --prune finish the choice', async () => {
      const { lines, io } = capture()
      expect(await masterMain(['--out', out, '--public', pub, '--only', 'sfx-clash', '--audition'], io), lines.join('\n')).toBe(0)
      const aud = normalizeManifest(JSON.parse(readFileSync(path.join(pub, 'manifest.json'), 'utf8')), (w) => lines.push(w))
      expect(aud.tracks.map((t) => t.id)).toContain('sfx-clash-b')
      expect(entriesForSlot(aud, SLOTS.find((s) => s.key === 'cue:clash')!)).toHaveLength(2) // sounds.html shows both rows

      expect(await masterMain(['--out', out, '--public', pub, '--only', 'sfx-clash,bed-duel', '--pick', 'bed-duel=b,sfx-clash=b', '--prune'], io), lines.join('\n')).toBe(0)
      const final = normalizeManifest(JSON.parse(readFileSync(path.join(pub, 'manifest.json'), 'utf8')))
      expect(final.tracks).toHaveLength(SUB.length)
      expect(final.tracks.find((t) => t.id === 'bed-duel')?.file).toBe('bed-duel-b.ogg')
      expect(final.tracks.find((t) => t.id === 'sfx-clash')?.file).toBe('sfx-clash-b.ogg')
      expect(final.tracks.find((t) => t.id === 'charge')?.file).toBe('charge-a.ogg')
      expect(existsSync(path.join(pub, 'bed-duel-a.ogg'))).toBe(false)
      expect(existsSync(path.join(pub, 'bed-duel-b.ogg'))).toBe(true)
      expect(existsSync(path.join(pub, 'charge-b.ogg'))).toBe(true) // not in --only, not pruned
    }, 300000)
  })
})
