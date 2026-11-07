// Manifest validation, settings, mood map and event hooks (docs/spec/60-audio.md sections 3, 4 and 6). Pure logic, no Web Audio.
import { describe, expect, it } from 'vitest'
import { busGains, DEFAULT_SETTINGS, loadSettings, parseSettings, saveSettings, SETTINGS_KEY, sliderToGain } from '../../src/client/audio/audioEngine'
import {
  audioUrl, candidatesForMood, cueTrack, CUES, entriesForSlot, fetchManifest, MOOD_FALLBACK, MOODS, normalizeManifest, SFX_CUES, SLOTS, STING_CUES, type Manifest,
} from '../../src/client/audio/manifest'
import { battleCues, duelRoundCue, isWinter, moodFor, warNear, type MoodInput } from '../../src/client/audio/moods'
import { activeScene } from '../../src/client/audio/scene'

const input = (o: Partial<MoodInput> = {}): MoodInput => ({ screen: 'game', endKind: null, month: 6, warNear: false, scene: 'map', court: false, battleResult: null, ...o })

describe('manifest', () => {
  it('an empty or broken manifest is empty, never an error', () => {
    const w: string[] = []
    expect(normalizeManifest({ version: 1, tracks: [] }, (m) => w.push(m)).tracks).toEqual([])
    expect(normalizeManifest(undefined, (m) => w.push(m)).tracks).toEqual([])
    expect(normalizeManifest('x').tracks).toEqual([])
    expect(normalizeManifest({ tracks: [null, 3, { id: 'a' }, { id: 'a', file: 'a.ogg', role: 'nope' }] }, (m) => w.push(m)).tracks).toEqual([])
    expect(w.length).toBeGreaterThan(0)
  })
  it('keeps valid entries, de-duplicates ids, drops unknown moods and cues', () => {
    const m = normalizeManifest({
      tracks: [
        { id: 'bed-war', file: 'a.ogg', role: 'bed', mood: 'war', bpm: 100, loopEnd: 28.8 },
        { id: 'bed-war', file: 'b.ogg', role: 'bed', mood: 'war' },
        { id: 'sfx-clash', file: 'c.ogg', role: 'sfx', cue: 'clash', gainDb: -3 },
        { id: 'x', file: 'x.ogg', role: 'sfx', cue: 'nonsense', mood: 'sad' },
      ],
    })
    expect(m.tracks.map((t) => t.id)).toEqual(['bed-war', 'sfx-clash', 'x'])
    expect(m.tracks[0]).toMatchObject({ mood: 'war', bpm: 100, loopEnd: 28.8, beatsPerBar: 4 })
    expect(m.tracks[2]!.cue).toBeUndefined()
    expect(m.tracks[2]!.mood).toBeUndefined()
  })
  it('has a slot for every mood, the charge layer, every sting and every effect', () => {
    for (const mood of MOODS) expect(SLOTS.some((s) => s.key === `bed:${mood}`)).toBe(true)
    for (const c of CUES) expect(SLOTS.some((s) => s.key === `cue:${c}`), c).toBe(true)
    expect(SFX_CUES).toHaveLength(18)
    expect(STING_CUES).toHaveLength(2)
    expect(SLOTS.some((s) => s.key === 'charge')).toBe(true)
  })
  it('finds a cue by its cue name or by id, and fills slots', () => {
    const m: Manifest = {
      version: 1,
      tracks: [
        { id: 'sfx-clash', file: 'a.ogg', bpm: 0, beatsPerBar: 4, loopStart: 0, loopEnd: 0, gainDb: 0, role: 'sfx', cue: 'clash' },
        { id: 'sting-month', file: 'b.ogg', bpm: 80, beatsPerBar: 4, loopStart: 0, loopEnd: 0, gainDb: 0, role: 'stinger', cue: 'sting-month' },
        { id: 'jingle-victory', file: 'c.ogg', bpm: 100, beatsPerBar: 4, loopStart: 0, loopEnd: 0, gainDb: 0, role: 'stinger', mood: 'victory' },
      ],
    }
    expect(cueTrack(m, 'clash')?.id).toBe('sfx-clash')
    expect(cueTrack(m, 'sting-month')?.id).toBe('sting-month')
    expect(cueTrack(m, 'fire')).toBeNull()
    expect(entriesForSlot(m, SLOTS.find((s) => s.key === 'cue:clash')!)).toHaveLength(1)
    expect(entriesForSlot(m, SLOTS.find((s) => s.key === 'bed:victory')!)).toHaveLength(1)
    expect(entriesForSlot(m, SLOTS.find((s) => s.key === 'bed:peace')!)).toHaveLength(0)
  })
  it('falls back between moods (winter to peace to court; duel to battle; victory has none)', () => {
    expect(MOOD_FALLBACK.winter).toEqual(['winter', 'peace', 'court'])
    const m: Manifest = { version: 1, tracks: [{ id: 'bed-peace', file: 'p.ogg', bpm: 90, beatsPerBar: 4, loopStart: 0, loopEnd: 32, gainDb: 0, role: 'bed', mood: 'peace' }] }
    expect(candidatesForMood(m, 'winter').map((t) => t.id)).toEqual(['bed-peace'])
    expect(candidatesForMood(m, 'victory')).toEqual([])
    expect(candidatesForMood(m, 'battle')).toEqual([])
  })
  it('urls follow the Vite base path', () => {
    expect(audioUrl('x.ogg', '/officers-of-the-han/')).toBe('/officers-of-the-han/audio/x.ogg')
    expect(audioUrl('/x.ogg', '/')).toBe('/audio/x.ogg')
  })
  it('a 404, a network error and bad JSON all read as an empty manifest', async () => {
    expect((await fetchManifest((async () => new Response('', { status: 404 })) as typeof fetch, '/')).tracks).toEqual([])
    expect((await fetchManifest((async () => { throw new Error('x') }) as typeof fetch, '/')).tracks).toEqual([])
    expect((await fetchManifest((async () => new Response('<html>', { status: 200 })) as typeof fetch, '/')).tracks).toEqual([])
    const ok = await fetchManifest((async () => new Response(JSON.stringify({ tracks: [{ id: 'a', file: 'a.ogg', role: 'bed' }] }))) as typeof fetch, '/')
    expect(ok.tracks).toHaveLength(1)
  })
})

describe('settings (localStorage "oth-audio")', () => {
  it('defaults, clamping and junk', () => {
    expect(SETTINGS_KEY).toBe('oth-audio')
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS)
    expect(parseSettings('not json')).toEqual(DEFAULT_SETTINGS)
    expect(parseSettings(JSON.stringify({ music: 3, sfx: -1, muted: true }))).toEqual({ music: 1, sfx: 0, muted: true })
    expect(parseSettings(JSON.stringify({ music: 'loud' })).music).toBe(DEFAULT_SETTINGS.music)
  })
  it('round-trips through a storage, and refused storage does not throw', () => {
    const mem = new Map<string, string>()
    const store = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) }
    saveSettings({ music: 0.2, sfx: 0.4, muted: true }, store)
    expect(loadSettings(store)).toEqual({ music: 0.2, sfx: 0.4, muted: true })
    const bad = { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') } }
    expect(() => saveSettings(DEFAULT_SETTINGS, bad)).not.toThrow()
    expect(loadSettings(bad)).toEqual(DEFAULT_SETTINGS)
  })
  it('mute silences the master only; sliders follow a square law', () => {
    expect(sliderToGain(0.5)).toBe(0.25)
    expect(busGains({ music: 0.5, sfx: 1, muted: true })).toEqual({ master: 0, music: 0.25, sfx: 1 })
    expect(busGains({ music: 0.5, sfx: 1, muted: false }).master).toBe(1)
  })
})

describe('mood map (docs/spec/60-audio.md section 3)', () => {
  it('title and new game: title', () => {
    expect(moodFor(input({ screen: 'title' }))).toBe('title')
    expect(moodFor(input({ screen: 'new' }))).toBe('title')
  })
  it('the map: peace, winter in months 12-2, war near your city, court at a council', () => {
    expect(moodFor(input())).toBe('peace')
    expect([12, 1, 2].every((m) => moodFor(input({ month: m })) === 'winter')).toBe(true)
    expect([3, 6, 11].every((m) => moodFor(input({ month: m })) === 'peace')).toBe(true)
    expect(isWinter(2)).toBe(true)
    expect(isWinter(3)).toBe(false)
    expect(moodFor(input({ warNear: true }))).toBe('war')
    expect(moodFor(input({ warNear: true, month: 1 }))).toBe('war')
    expect(moodFor(input({ court: true, warNear: true }))).toBe('court')
  })
  it('scenes: battle, duel over battle, debate; results are the jingles; the end screen', () => {
    expect(moodFor(input({ scene: 'battle' }))).toBe('battle')
    expect(moodFor(input({ scene: 'duel' }))).toBe('duel')
    expect(moodFor(input({ scene: 'debate' }))).toBe('debate')
    expect(moodFor(input({ scene: 'battle', battleResult: 'win' }))).toBe('victory')
    expect(moodFor(input({ scene: 'battle', battleResult: 'loss' }))).toBe('defeat')
    expect(moodFor(input({ screen: 'end', endKind: 'unified' }))).toBe('victory')
    expect(moodFor(input({ screen: 'end', endKind: 'extinct' }))).toBe('defeat')
  })
  it('the open scene with the highest priority wins', () => {
    expect(activeScene({ battle: 1, duel: 1, debate: 0 })).toBe('duel')
    expect(activeScene({ battle: 1, duel: 0, debate: 0 })).toBe('battle')
    expect(activeScene({ battle: 0, duel: 0, debate: 1 })).toBe('debate')
    expect(activeScene({ battle: 0, duel: 0, debate: 0 })).toBe('map')
  })
  it('war near: an army that is not yours, to or from the city or a neighbour', () => {
    const nb = (c: string): string[] => (c === 'luoyang' ? ['hulao', 'chang-an'] : [])
    const army = (from: string, to: string, faction: string | null) => ({ from, to, faction })
    expect(warNear('luoyang', 'f-han', [army('xuchang', 'hulao', 'f-cao')], nb)).toBe(true)
    expect(warNear('luoyang', 'f-han', [army('far', 'away', 'f-cao')], nb)).toBe(false)
    expect(warNear('luoyang', 'f-han', [army('luoyang', 'hulao', 'f-han')], nb)).toBe(false) // your own house marching out
    expect(warNear('luoyang', 'f-han', [army('x', 'luoyang', null)], nb)).toBe(true) // rebels
    expect(warNear('luoyang', null, [army('x', 'hulao', 'f-han')], nb)).toBe(true) // a wanderer fears every army
    expect(warNear(null, 'f-han', [army('x', 'luoyang', null)], nb)).toBe(false)
  })
})

describe('event hooks', () => {
  const types: Record<string, 'spear' | 'cavalry' | 'archer'> = { s: 'spear', c: 'cavalry', a: 'archer' }
  const typeOf = (u: string) => types[u]
  it('battle events: march, clash, volley, charge, wall, fire, rally', () => {
    expect(battleCues({ kind: 'move', unit: 's' }, typeOf).cues).toEqual(['march'])
    expect(battleCues({ kind: 'attack', unit: 's', range: 1 }, typeOf).cues).toEqual(['clash'])
    expect(battleCues({ kind: 'attack', unit: 'a', range: 2 }, typeOf).cues).toEqual(['volley'])
    expect(battleCues({ kind: 'attack', unit: 'c', range: 1 }, typeOf)).toEqual({ cues: ['charge-hooves', 'clash'], charge: 2.5 })
    expect(battleCues({ kind: 'volley', unit: 'a' }, typeOf).cues).toEqual(['volley'])
    expect(battleCues({ kind: 'gate', unit: 's' }, typeOf).cues).toEqual(['wall-hit'])
    expect(battleCues({ kind: 'burn' }, typeOf).cues).toEqual(['fire'])
    expect(battleCues({ kind: 'tactic', tactic: 'fire' }, typeOf).cues).toEqual(['fire'])
    expect(battleCues({ kind: 'tactic', tactic: 'rally' }, typeOf).cues).toEqual(['rally-horn'])
    expect(battleCues({ kind: 'tactic', tactic: 'confuse' }, typeOf).cues).toEqual([])
    for (const k of ['dayStart', 'turnStart', 'rout', 'morale', 'wait', 'end', 'duel']) expect(battleCues({ kind: k }, typeOf).cues, k).toEqual([])
  })
  it('duel rounds: mighty, the stance that landed, the guard that held', () => {
    expect(duelRoundCue({ a: 'mighty', b: 'guard', dealtByA: 20, dealtByB: 0 })).toBe('duel-mighty')
    expect(duelRoundCue({ a: 'strike', b: 'feint', dealtByA: 8, dealtByB: 0 })).toBe('duel-strike')
    expect(duelRoundCue({ a: 'feint', b: 'guard', dealtByA: 6, dealtByB: 0 })).toBe('duel-feint')
    expect(duelRoundCue({ a: 'strike', b: 'guard', dealtByA: 0, dealtByB: 5 })).toBe('duel-strike')
    expect(duelRoundCue({ a: 'guard', b: 'guard', dealtByA: 0, dealtByB: 0 })).toBe('duel-guard')
    expect(duelRoundCue({ a: 'yield', b: 'strike', dealtByA: 0, dealtByB: 0 })).toBeNull()
  })
})
