// Seeded RNG: sfc32 (4 x uint32 state), stored in plain-JSON state (world, battle, duel, debate each own one).
// Copied from three-kingdoms-tactics src/engine/rng.ts (same algorithm, same seeding).
// Each engine documents its own DRAW ORDER at the top of its step file; replay depends on it.

export type RngState = [number, number, number, number]

/** Initialise from an integer seed (splitmix32-style scrambling) and warm up. */
export function seedRng(seed: number): RngState {
  let s = seed >>> 0
  const sm = (): number => {
    s = (s + 0x9e3779b9) >>> 0
    let z = s
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b) >>> 0
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35) >>> 0
    return (z ^ (z >>> 16)) >>> 0
  }
  const st: RngState = [sm(), sm(), sm(), sm()]
  for (let i = 0; i < 12; i++) nextFloat(st)
  return st
}

/** Advances `st` in place and returns a float in [0, 1). Only call on a working copy. */
export function nextFloat(st: RngState): number {
  let a = st[0]
  let b = st[1]
  let c = st[2]
  let d = st[3]
  let t = (a + b) | 0
  a = b ^ (b >>> 9)
  b = (c + (c << 3)) | 0
  c = (c << 21) | (c >>> 11)
  d = (d + 1) | 0
  t = (t + d) | 0
  c = (c + t) | 0
  st[0] = a >>> 0
  st[1] = b >>> 0
  st[2] = c >>> 0
  st[3] = d >>> 0
  return (t >>> 0) / 4294967296
}

/** 1..100 inclusive. */
export function d100(st: RngState): number {
  return 1 + Math.floor(nextFloat(st) * 100)
}

/** A "chance p%" check: passes when d100 <= p (10-rules.md preamble). */
export function chance(st: RngState, pct: number): boolean {
  return d100(st) <= pct
}

/** Derive a child seed (battle, duel, debate) from a parent stream: one draw. */
export function childSeed(st: RngState): number {
  return Math.floor(nextFloat(st) * 4294967296) >>> 0
}

export function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x
}
