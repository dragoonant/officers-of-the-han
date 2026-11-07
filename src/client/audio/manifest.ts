// The audio manifest (docs/spec/60-audio.md). `public/audio/manifest.json` lists the generated files; it is empty until the owner's Audio
// Studio produces them. Everything here is pure (no Web Audio, no DOM) except `fetchManifest`.
export type TrackRole = 'bed' | 'charge' | 'stinger' | 'sfx'
export type Mood = 'title' | 'peace' | 'winter' | 'war' | 'court' | 'battle' | 'duel' | 'debate' | 'victory' | 'defeat'
export const MOODS: readonly Mood[] = ['title', 'peace', 'winter', 'war', 'court', 'battle', 'duel', 'debate', 'victory', 'defeat']

/** One-shot effects (Stable Audio Open), by the name the game plays them with. */
export const SFX_CUES = [
  'ui-tap', 'ui-chime', 'letter-unroll', 'gong-month',
  'march', 'clash', 'volley', 'charge-hooves', 'fire', 'wall-hit', 'rally-horn',
  'duel-strike', 'duel-guard', 'duel-feint', 'duel-mighty',
  'debate-tally', 'debate-win', 'debate-loss',
] as const
/** Short musical stings (ACE-Step) that ride the music bus. */
export const STING_CUES = ['sting-letter', 'sting-month'] as const
export type SfxCue = (typeof SFX_CUES)[number]
export type StingCue = (typeof STING_CUES)[number]
export type CueId = SfxCue | StingCue
export const CUES: readonly CueId[] = [...SFX_CUES, ...STING_CUES]

export interface TrackEntry {
  id: string
  /** Path under `audio/` (e.g. `bed-battle-a.ogg`). */
  file: string
  /** Optional fallback tried when `file` fails to fetch or decode (M4A for old Safari). */
  alt?: string
  bpm: number
  beatsPerBar: number
  /** Loop region in seconds inside the file. `loopEnd <= loopStart` means "to the end of the file". */
  loopStart: number
  loopEnd: number
  gainDb: number
  role: TrackRole
  mood?: Mood
  /** For roles 'stinger' (without a mood) and 'sfx': which game cue plays it. */
  cue?: CueId
}

export interface Manifest {
  version: 1
  tracks: TrackEntry[]
}

export const EMPTY_MANIFEST: Manifest = { version: 1, tracks: [] }

/** The slots a complete score fills; the audition page shows "no file yet" for any slot with nothing in the manifest. */
export interface Slot {
  key: string
  label: string
  role: TrackRole
  mood?: Mood
  cue?: CueId
}
export const SLOTS: readonly Slot[] = [
  ...MOODS.map((m): Slot => ({ key: `bed:${m}`, label: `Music: ${m}`, role: 'bed', mood: m })),
  { key: 'charge', label: 'Charge layer (over the battle bed)', role: 'charge' },
  ...STING_CUES.map((c): Slot => ({ key: `cue:${c}`, label: `Sting: ${c}`, role: 'stinger', cue: c })),
  ...SFX_CUES.map((c): Slot => ({ key: `cue:${c}`, label: `Effect: ${c}`, role: 'sfx', cue: c })),
]

const ROLES: readonly string[] = ['bed', 'charge', 'stinger', 'sfx']
const num = (v: unknown, d: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : d)

/** Validate untrusted JSON. Bad entries are dropped (never thrown on); `warn` hears why. */
export function normalizeManifest(raw: unknown, warn: (msg: string) => void = () => {}): Manifest {
  const list = raw && typeof raw === 'object' && Array.isArray((raw as { tracks?: unknown }).tracks) ? (raw as { tracks: unknown[] }).tracks : null
  if (!list) {
    if (raw !== undefined) warn('audio manifest has no "tracks" array; treating it as empty')
    return { version: 1, tracks: [] }
  }
  const out: TrackEntry[] = []
  const seen = new Set<string>()
  for (const r of list) {
    const o = r as Record<string, unknown> | null
    if (!o || typeof o !== 'object') continue
    const id = typeof o.id === 'string' ? o.id : ''
    const file = typeof o.file === 'string' ? o.file : ''
    const role = typeof o.role === 'string' && ROLES.includes(o.role) ? (o.role as TrackRole) : null
    if (!id || !file || !role) {
      warn(`audio manifest entry ignored (needs id, file and role): ${JSON.stringify(r).slice(0, 80)}`)
      continue
    }
    if (seen.has(id)) {
      warn(`audio manifest: duplicate id "${id}" ignored`)
      continue
    }
    seen.add(id)
    const t: TrackEntry = {
      id,
      file,
      bpm: Math.max(0, num(o.bpm, 0)),
      beatsPerBar: Math.max(1, Math.round(num(o.beatsPerBar, 4))),
      loopStart: Math.max(0, num(o.loopStart, 0)),
      loopEnd: Math.max(0, num(o.loopEnd, 0)),
      gainDb: num(o.gainDb, 0),
      role,
    }
    if (typeof o.alt === 'string' && o.alt) t.alt = o.alt
    if (typeof o.mood === 'string' && (MOODS as readonly string[]).includes(o.mood)) t.mood = o.mood as Mood
    if (typeof o.cue === 'string' && (CUES as readonly string[]).includes(o.cue)) t.cue = o.cue as CueId
    out.push(t)
  }
  return { version: 1, tracks: out }
}

export const dbToGain = (db: number): number => Math.pow(10, db / 20)
export const gainToDb = (g: number): number => (g <= 1e-6 ? -Infinity : 20 * Math.log10(g))

/** Bed fallbacks when a mood has no file of its own (first loadable wins). Victory and defeat have none: silence is correct. */
export const MOOD_FALLBACK: Record<Mood, readonly Mood[]> = {
  title: ['title', 'court'],
  peace: ['peace', 'court'],
  winter: ['winter', 'peace', 'court'],
  war: ['war', 'peace'],
  court: ['court', 'peace'],
  battle: ['battle'],
  duel: ['duel', 'battle'],
  debate: ['debate', 'court'],
  victory: ['victory'],
  defeat: ['defeat'],
}

/** Candidate tracks for a mood, best first. Beds and (for victory/defeat) stingers tagged with the mood are both accepted. */
export function candidatesForMood(m: Manifest, mood: Mood): TrackEntry[] {
  const out: TrackEntry[] = []
  for (const mm of MOOD_FALLBACK[mood]) {
    for (const t of m.tracks) if (t.mood === mm && (t.role === 'bed' || t.role === 'stinger') && !out.includes(t)) out.push(t)
  }
  return out
}

/** The charge layer: one tagged for this mood, then an untagged one, then any. */
export function candidatesForCharge(m: Manifest, mood: Mood | null): TrackEntry[] {
  const all = m.tracks.filter((t) => t.role === 'charge')
  const rank = (t: TrackEntry): number => (mood && t.mood === mood ? 0 : t.mood === undefined ? 1 : 2)
  return all.slice().sort((a, b) => rank(a) - rank(b))
}

/** The track a one-shot cue plays (an effect or a sting). Null when the manifest has none. */
export function cueTrack(m: Manifest, cue: CueId): TrackEntry | null {
  return m.tracks.find((t) => (t.role === 'sfx' || (t.role === 'stinger' && !t.mood)) && (t.cue === cue || (t.cue === undefined && t.id === cue))) ?? null
}

/** Which manifest entries fill a slot. */
export function entriesForSlot(m: Manifest, s: Slot): TrackEntry[] {
  if (s.role === 'bed') return m.tracks.filter((t) => t.mood === s.mood && (t.role === 'bed' || t.role === 'stinger'))
  if (s.role === 'charge') return m.tracks.filter((t) => t.role === 'charge')
  return m.tracks.filter((t) => t.role === s.role && !t.mood && (t.cue === s.cue || t.id === s.cue))
}

/** Audio files live under `<base>audio/`. `base` is Vite's BASE_URL (a sub-path on Pages). */
export function audioUrl(file: string, base: string = import.meta.env.BASE_URL ?? '/'): string {
  const b = base.endsWith('/') ? base : `${base}/`
  return `${b}audio/${file.replace(/^\/+/, '')}`
}

const warned = new Set<string>()
/** Log a problem once per key (a missing file must not spam the console on every retrigger). */
export function warnOnce(key: string, msg: string): void {
  if (warned.has(key)) return
  warned.add(key)
  console.warn(`[audio] ${msg}`)
}
export function resetWarnings(): void {
  warned.clear()
}

/**
 * Read `manifest.json`. A committed empty manifest means a missing file never produces a 404; if the file is nonetheless absent or broken the
 * result is an empty manifest and nothing is logged above `console.warn` (the page must load with 0 console errors and no audio files).
 */
export async function fetchManifest(fetchFn: typeof fetch = fetch, base?: string): Promise<Manifest> {
  try {
    const res = await fetchFn(audioUrl('manifest.json', base))
    if (!res.ok) return { version: 1, tracks: [] }
    return normalizeManifest(await res.json(), (m) => warnOnce(`manifest:${m}`, m))
  } catch {
    return { version: 1, tracks: [] }
  }
}
