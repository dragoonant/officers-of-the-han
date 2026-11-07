// The audio facade the game and the audition page talk to. It owns the engine, the manifest and the music director, and remembers what was
// asked for before the first user gesture (when no AudioContext may exist yet) so it can be applied the moment audio unlocks.
// With no files in the manifest every call is a silent no-op.
import { AudioEngine, type AudioSettings, type CtxState } from './audioEngine'
import { dbToGain, EMPTY_MANIFEST, fetchManifest, type CueId, type Manifest, type Mood, type TrackEntry } from './manifest'
import { MusicDirector, type CutinKind, type DirectorDebug, type Voice } from './musicDirector'
import { WebMusicGraph } from './webGraph'

export interface AudioStatus {
  manifestReady: boolean
  trackCount: number
  ctx: CtxState
  settings: AudioSettings
  mood: Mood | null
  version: number
}

class AudioFacade {
  readonly engine = new AudioEngine()
  manifest: Manifest = EMPTY_MANIFEST
  private manifestReady = false
  private graph: WebMusicGraph | null = null
  private director: MusicDirector | null = null
  private mood: Mood | null = null
  private timer: ReturnType<typeof setInterval> | null = null
  private chargeTimer: ReturnType<typeof setTimeout> | null = null
  private readonly listeners = new Set<() => void>()
  private readonly auditioned = new Map<string, Voice>()
  private version = 0
  private snap: AudioStatus

  constructor() {
    this.snap = this.makeSnap()
    if (typeof window === 'undefined') return
    this.engine.on((e) => {
      if (e === 'created') this.build()
      this.notify()
    })
    this.engine.attach()
    // ?test=1 exposes the facade for the e2e tests (the same switch the game uses).
    try {
      if (new URLSearchParams(window.location.search).get('test') === '1') (window as unknown as { __audio?: AudioFacade }).__audio = this
    } catch {
      /* no location */
    }
    void fetchManifest().then((m) => {
      this.manifest = m
      this.manifestReady = true
      this.build()
      this.notify()
    })
  }

  private build(): void {
    if (this.director || !this.engine.ctx || !this.manifestReady) return
    this.graph = new WebMusicGraph(this.engine)
    this.director = new MusicDirector(this.graph, this.manifest)
    // The polling only reads the audio clock (retiring fades, the charge failsafe); every musical event is scheduled on that clock.
    this.timer = setInterval(() => this.director?.tick(), 100)
    if (this.manifest.tracks.length > 0) this.director.preloadCues()
    if (this.mood) this.director.setMood(this.mood)
  }

  // ---- the API the game uses
  setMood(m: Mood): void {
    if (m === this.mood) return
    this.mood = m
    if (m === 'victory' || m === 'defeat') this.clearChargeTimer()
    this.director?.setMood(m)
    this.notify()
  }
  /** Fade all music out. */
  silence(): void {
    this.mood = null
    this.clearChargeTimer()
    this.director?.silence()
    this.notify()
  }
  getMood(): Mood | null {
    return this.mood
  }
  /** Play an effect or a sting. Returns whether it sounded (false with no file, before the first gesture, or when rate-limited). */
  play(cue: CueId): boolean {
    return this.director?.play(cue) ?? false
  }
  /** Lay the charge layer over the battle bed for `seconds` (a cavalry charge), then let it fade. */
  chargeFor(seconds: number, kind: CutinKind = 'short'): void {
    if (!this.director) return
    this.director.cutinStart(kind, seconds)
    this.clearChargeTimer()
    this.chargeTimer = setTimeout(() => {
      this.chargeTimer = null
      this.director?.cutinEnd()
    }, Math.max(0.5, seconds) * 1000)
  }
  private clearChargeTimer(): void {
    if (this.chargeTimer) clearTimeout(this.chargeTimer)
    this.chargeTimer = null
    this.director?.cutinSkip()
  }

  // ---- settings and status
  setSettings(p: Partial<AudioSettings>): void {
    this.engine.setSettings(p)
  }
  hasFiles(): boolean {
    return this.manifest.tracks.length > 0
  }
  /** Immutable snapshot, replaced only when something changes (for useSyncExternalStore). */
  status(): AudioStatus {
    return this.snap
  }
  private makeSnap(): AudioStatus {
    return {
      manifestReady: this.manifestReady,
      trackCount: this.manifest.tracks.length,
      ctx: this.engine.state,
      settings: this.engine.settings,
      mood: this.mood,
      version: this.version,
    }
  }
  private notify(): void {
    this.version++
    this.snap = this.makeSnap()
    this.listeners.forEach((f) => f())
  }
  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }
  levels(): { bed: number; charge: number } {
    return this.director?.levels() ?? { bed: 0, charge: 0 }
  }
  debug(): DirectorDebug | null {
    return this.director?.debug() ?? null
  }
  now(): number {
    return this.engine.now()
  }

  // ---- audition (sounds.html): play one manifest entry on its own, outside the director
  async audition(track: TrackEntry): Promise<boolean> {
    this.engine.unlock()
    if (!this.graph) return false
    this.stopAudition(track.id)
    const info = await this.graph.load(track)
    if (!info) return false
    const g = dbToGain(track.gainDb)
    const now = this.graph.now()
    if (track.role === 'stinger' || track.role === 'sfx') return this.graph.startOnce(track, now, track.role === 'sfx' ? 'sfx' : 'music', g) !== null
    const v = this.graph.startLoop(track, now, 0, g)
    if (!v) return false
    this.auditioned.set(track.id, v)
    this.notify()
    return true
  }
  stopAudition(id?: string): void {
    const now = this.graph?.now() ?? 0
    for (const [k, v] of this.auditioned) {
      if (id === undefined || k === id) {
        v.stop(now)
        this.auditioned.delete(k)
      }
    }
    this.notify()
  }
  auditioning(): string[] {
    return [...this.auditioned.keys()]
  }
  /** Await pending loads in tests. */
  async settled(): Promise<void> {
    await this.director?.settled()
  }
}

export const audio = new AudioFacade()
export type { AudioFacade }
export type { Mood, CutinKind }
