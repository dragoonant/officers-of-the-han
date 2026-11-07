// Presentation director: plays the events of one engine step as timed beats and commits each one to the presented state (pres.ts).
// No React. Instant speed (?speed=instant, or the Instant button) applies every beat at once; used by e2e.
import type { BattleEvent } from '../../battle/types'

export type Speed = 'normal' | 'fast' | 'instant'
export interface Beat {
  ev: BattleEvent
  ms: number
}

/** Non-reactive clock read by the 3D layer every frame. */
export const anim: { beat: Beat | null; t0: number; ms: number } = { beat: null, t0: 0, ms: 1 }
export function animProgress(): number {
  if (!anim.beat) return 0
  return Math.min(1, Math.max(0, (performance.now() - anim.t0) / Math.max(1, anim.ms)))
}

/** Duration of a beat at Normal speed, in ms. */
export function baseMs(ev: BattleEvent): number {
  switch (ev.kind) {
    case 'dayStart': return 700
    case 'turnStart': return 260
    case 'move': return Math.min(1500, 220 + 230 * Math.max(0, ev.path.length - 1))
    case 'undoMove': return 260
    case 'attack': return 800
    case 'gate': return 700
    case 'tactic': return ev.tactic === 'fire' ? 1100 : 950
    case 'volley': return 600
    case 'burn': return 550
    case 'ignite': return 400
    case 'ash': return 300
    case 'confusedSkip': return 600
    case 'challenge': return 700
    case 'duel': return 800
    case 'rout': return 900
    case 'morale': return 260
    case 'wait': return 260
    case 'end': return 900
  }
}

export function beatMs(ev: BattleEvent, speed: Speed): number {
  if (speed === 'instant') return 0
  return Math.round(baseMs(ev) * (speed === 'fast' ? 0.38 : 1))
}

export interface DirectorIO {
  speed(): Speed
  /** A beat starts (feed line, floater). */
  start(b: Beat): void
  /** A beat ends: apply it to the presented state. */
  commit(b: Beat): void
  /** The whole batch is over. */
  idle(): void
}

export class Director {
  private queue: Beat[] = []
  private timer: ReturnType<typeof setTimeout> | null = null
  private running = false
  constructor(private io: DirectorIO) {}

  get playing(): boolean {
    return this.running
  }

  play(events: BattleEvent[]): void {
    if (this.running) this.skip()
    const sp = this.io.speed()
    this.queue = events.map((ev) => ({ ev, ms: beatMs(ev, sp) }))
    this.running = true
    this.pump()
  }

  /** Snap to the end of the batch. */
  skip(): void {
    if (!this.running) return
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    const cur = anim.beat
    if (cur) this.io.commit(cur)
    anim.beat = null
    for (const b of this.queue) {
      this.io.start(b)
      this.io.commit(b)
    }
    this.queue = []
    this.running = false
    this.io.idle()
  }

  /** Forget everything (the screen unmounts). */
  dispose(): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    this.queue = []
    this.running = false
    anim.beat = null
  }

  private pump(): void {
    for (;;) {
      const b = this.queue.shift()
      if (!b) {
        anim.beat = null
        this.running = false
        this.io.idle()
        return
      }
      this.io.start(b)
      if (b.ms <= 0) {
        this.io.commit(b)
        continue
      }
      anim.beat = b
      anim.t0 = performance.now()
      anim.ms = b.ms
      this.timer = setTimeout(() => {
        this.timer = null
        anim.beat = null
        this.io.commit(b)
        this.pump()
      }, b.ms)
      return
    }
  }
}
