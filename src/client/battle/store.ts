// Battle controller + store (zustand). One battle at a time. Owns the engine state, the presented state, the director, the AI driver and the UI mode.
import { create } from 'zustand'
import { chooseBattleAction, chooseRandomAction } from '../../ai/battle'
import type { BattleOutcome } from '../../contracts/battle'
import type { DuelOutcome, DuelSetup } from '../../contracts/contest'
import { autoDuel } from '../../duel'
import { createBattle, legalActions, outcomeOf, query, step, type BattleAction, type BattleEvent, type BattleState, type TacticId } from '../../battle'
import type { BattleSetup } from '../../contracts/battle'
import { inField } from '../../battle/hex'
import { audioHooks } from '../audio/hooks'
import { Director, type Beat, type Speed } from './director'
import { eventLine, terrainName } from './eventLines'
import { tileXZ } from './layout'
import { applyEvent, presFrom, type Pres } from './pres'

export type Mode =
  | { kind: 'idle' }
  | { kind: 'attack'; target?: string; gate?: { q: number; r: number } }
  | { kind: 'tacticMenu' }
  | { kind: 'tactic'; tactic: TacticId; target?: { q: number; r: number } }
  | { kind: 'challenge'; target?: string }
  | { kind: 'retreat' }

export interface FeedLine {
  id: number
  text: string
  kind: BattleEvent['kind']
}
export interface Floater {
  id: number
  q: number
  r: number
  text: string
  color: string
  t0: number
}

export interface BattleStore {
  setup: BattleSetup | null
  state: BattleState | null
  pres: Pres | null
  presV: number
  playing: boolean
  speed: Speed
  speedLocked: boolean
  aiCommand: boolean
  mode: Mode
  selected: string | null
  hover: { q: number; r: number } | null
  feed: FeedLine[]
  duelOpen: boolean
  ended: boolean
  rejected: string
}

const urlSpeed = (): Speed | null => {
  try {
    const s = new URLSearchParams(window.location.search).get('speed')
    return s === 'instant' || s === 'fast' || s === 'normal' ? s : null
  } catch {
    return null
  }
}

export const useBattle = create<BattleStore>(() => ({
  setup: null, state: null, pres: null, presV: 0, playing: false, speed: 'normal', speedLocked: false, aiCommand: false,
  mode: { kind: 'idle' }, selected: null, hover: null, feed: [], duelOpen: false, ended: false, rejected: '',
}))

export const floaters: Floater[] = []
let fid = 1
let feedId = 1
let cb: { onChange?: (s: BattleState) => void; onDone?: (o: BattleOutcome) => void } = {}
let timer: ReturnType<typeof setTimeout> | null = null
let alive = false
let failures = 0

const set = useBattle.setState
const get = useBattle.getState

function name(id: string): string {
  const s = get().state
  return s?.units.find((u) => u.id === id)?.officer.name ?? id
}

function pushFloater(q: number, r: number, text: string, color: string): void {
  floaters.push({ id: fid++, q, r, text, color, t0: performance.now() })
  if (floaters.length > 40) floaters.splice(0, floaters.length - 40)
}
const unitHex = (id: string): { q: number; r: number } | null => {
  const u = get().pres?.units.find((x) => x.id === id)
  return u ? { q: u.q, r: u.r } : null
}

const director = new Director({
  speed: () => get().speed,
  start(b: Beat) {
    const st = get()
    const state = st.state
    if (!state) return
    const ev = b.ev
    const text = eventLine(ev, {
      name,
      terrainAt: (q, r) => {
        const h = query.hexAt(state, q, r)
        return h ? terrainName(h.terrain) : undefined
      },
    })
    set((s) => ({ feed: [...s.feed.slice(-199), { id: feedId++, text, kind: ev.kind }] }))
    if (st.speed === 'instant') return
    audioHooks.battleEvent(ev, (id) => state.units.find((u) => u.id === id)?.type)
    switch (ev.kind) {
      case 'attack': {
        const t = unitHex(ev.target)
        const a = unitHex(ev.unit)
        if (t) pushFloater(t.q, t.r, `-${ev.damage}`, '#ffd9b0')
        if (a && ev.counter > 0) pushFloater(a.q, a.r, `-${ev.counter}`, '#d9a441')
        break
      }
      case 'volley': { const t = unitHex(ev.target); if (t) pushFloater(t.q, t.r, `-${ev.damage}`, '#ffd9b0'); break }
      case 'burn': { const t = unitHex(ev.unit); if (t) pushFloater(t.q, t.r, `-${ev.troops} fire`, '#ff9a5a'); break }
      case 'gate': pushFloater(ev.q, ev.r, `-${ev.damage}`, '#ffd9b0'); break
      case 'tactic': pushFloater(ev.q, ev.r, ev.success ? (ev.tactic === 'rally' ? 'Rally' : 'Hit') : 'Failed', ev.success ? '#9fd8c0' : '#9b8a72'); break
      case 'rout': { const t = unitHex(ev.unit); if (t) pushFloater(t.q, t.r, 'Routed', '#c4471d'); break }
      default: break
    }
  },
  commit(b: Beat) {
    const p = get().pres
    if (!p) return
    const ev = b.ev
    if (ev.kind === 'move') {
      const u = p.units.find((x) => x.id === ev.unit)
      const a = ev.path[ev.path.length - 2]
      const z = ev.path[ev.path.length - 1]
      if (u && a && z) {
        const pa = tileXZ(a.q, a.r)
        const pz = tileXZ(z.q, z.r)
        u.facing = Math.atan2(pz.x - pa.x, pz.z - pa.z)
      }
    } else if (ev.kind === 'attack' || ev.kind === 'challenge' || (ev.kind === 'tactic' && ev.tactic !== 'rally')) {
      const u = p.units.find((x) => x.id === ev.unit)
      const tgt = ev.kind === 'tactic' ? { q: ev.q, r: ev.r } : unitHex(ev.target)
      if (u && tgt && (u.q !== tgt.q || u.r !== tgt.r)) {
        const pa = tileXZ(u.q, u.r)
        const pz = tileXZ(tgt.q, tgt.r)
        u.facing = Math.atan2(pz.x - pa.x, pz.z - pa.z)
      }
    }
    applyEvent(p, ev)
    set((s) => ({ presV: s.presV + 1 }))
  },
  idle() {
    const st = get()
    if (!st.state) return
    // re-sync to the authoritative state
    set((s) => ({ pres: presFrom(s.state!, s.pres ?? undefined), presV: s.presV + 1, playing: false }))
    schedule()
  },
})

function schedule(): void {
  if (timer) clearTimeout(timer)
  timer = setTimeout(pump, get().speed === 'instant' ? 0 : 320)
}

/** Decide what happens next: end, a duel, the AI's move, or wait for the player. */
function pump(): void {
  timer = null
  if (!alive) return
  const s = get()
  const state = s.state
  if (!state || director.playing) return
  if (state.outcome) {
    if (!s.ended) set({ ended: true })
    return
  }
  if (state.pendingDuel) {
    if (s.aiCommand) {
      const { challenger: _c, target: _t, ...setup } = state.pendingDuel
      void _c
      void _t
      submit({ kind: 'duelResolved', result: autoDuel(setup) })
    } else if (!s.duelOpen) set({ duelOpen: true })
    return
  }
  const u = query.activeUnit(state)
  if (!u) return
  const mine = query.isPlayerUnit(state, u.id) && !s.aiCommand
  if (mine) {
    if (s.selected !== u.id && s.mode.kind === 'idle') set({ selected: u.id })
    return
  }
  let act: BattleAction
  try {
    act = failures > 0 ? chooseRandomAction(state, u.id) : chooseBattleAction(state, u.id)
  } catch {
    act = { kind: 'wait', unit: u.id }
  }
  if (!submit(act)) {
    failures++
    if (failures > 3) submit({ kind: 'wait', unit: u.id })
    schedule()
  }
}

/** Run one action through the engine and play its events. Returns false when the engine rejects it. */
export function submit(action: BattleAction): boolean {
  const s = get()
  if (!s.state || s.playing) return false
  const r = step(s.state, action)
  if (!r.ok) {
    set({ rejected: r.message })
    return false
  }
  failures = 0
  set({ state: r.state, rejected: '', mode: { kind: 'idle' }, playing: true, duelOpen: false })
  cb.onChange?.(r.state)
  director.play(r.events)
  return true
}

export function resolveDuel(o: DuelOutcome): void {
  set({ duelOpen: false })
  submit({ kind: 'duelResolved', result: o })
}

// ---------------------------------------------------------------- UI intents
export function setMode(mode: Mode): void {
  if (get().playing) return
  set({ mode })
}

export function setSpeed(sp: Speed): void {
  if (get().speedLocked) return
  set({ speed: sp })
}

export function setAiCommand(on: boolean): void {
  set({ aiCommand: on })
  if (on) schedule()
}

export function hoverTile(h: { q: number; r: number } | null): void {
  const cur = get().hover
  if (cur?.q === h?.q && cur?.r === h?.r) return
  set({ hover: h })
}

export function skipPlayback(): void {
  director.skip()
}

/** The unit standing on a hex in the presented state, if any. */
export function presentedUnitAt(q: number, r: number): string | null {
  return get().pres?.units.find((u) => !u.routed && u.q === q && u.r === r)?.id ?? null
}

export function tapTile(q: number, r: number): void {
  const s = get()
  const state = s.state
  if (!state || s.playing || s.duelOpen || state.outcome || !inField(q, r)) return
  const au = query.activeUnit(state)
  const myTurn = !!au && query.isPlayerUnit(state, au.id) && !s.aiCommand
  const here = state.units.find((u) => !u.routed && u.q === q && u.r === r) ?? null
  if (!myTurn || !au) {
    set({ selected: here ? here.id : null })
    return
  }
  const legal = legalActions(state)
  const m = s.mode
  if (m.kind === 'attack') {
    const gate = legal.find((a) => a.kind === 'attackGate' && a.q === q && a.r === r)
    const hit = here ? legal.find((a) => a.kind === 'attack' && a.target === here.id) : null
    if (hit && here) {
      if (m.target === here.id) return void confirm()
      set({ mode: { kind: 'attack', target: here.id }, selected: here.id })
      return
    }
    if (gate) {
      if (m.gate?.q === q && m.gate?.r === r) return void confirm()
      set({ mode: { kind: 'attack', gate: { q, r } } })
      return
    }
  } else if (m.kind === 'tactic') {
    const hit = legal.find((a) => a.kind === 'tactic' && a.tactic === m.tactic && a.q === q && a.r === r)
    if (hit) {
      if (m.target?.q === q && m.target?.r === r) return void confirm()
      set({ mode: { kind: 'tactic', tactic: m.tactic, target: { q, r } }, selected: here?.id ?? s.selected })
      return
    }
  } else if (m.kind === 'challenge') {
    const hit = here ? legal.find((a) => a.kind === 'challenge' && a.target === here.id) : null
    if (hit && here) {
      if (m.target === here.id) return void confirm()
      set({ mode: { kind: 'challenge', target: here.id }, selected: here.id })
      return
    }
  } else {
    const mv = legal.find((a) => a.kind === 'move' && a.q === q && a.r === r)
    if (mv) {
      submit(mv)
      return
    }
    const atk = here ? legal.find((a) => a.kind === 'attack' && a.target === here.id) : null
    if (atk && here) {
      set({ mode: { kind: 'attack', target: here.id }, selected: here.id })
      return
    }
  }
  set({ selected: here ? here.id : au.id, mode: m.kind === 'idle' ? m : { kind: 'idle' } })
}

/** The action the current mode would play, or null. */
export function modeAction(state: BattleState, m: Mode): BattleAction | null {
  const au = query.activeUnit(state)
  if (!au) return null
  switch (m.kind) {
    case 'attack':
      if (m.target) return { kind: 'attack', unit: au.id, target: m.target }
      if (m.gate) return { kind: 'attackGate', unit: au.id, q: m.gate.q, r: m.gate.r }
      return null
    case 'tactic':
      return m.target ? { kind: 'tactic', unit: au.id, tactic: m.tactic, q: m.target.q, r: m.target.r } : null
    case 'challenge':
      return m.target ? { kind: 'challenge', unit: au.id, target: m.target } : null
    case 'retreat':
      return { kind: 'retreat', side: au.side }
    default:
      return null
  }
}

export function confirm(): void {
  const s = get()
  if (!s.state) return
  const a = modeAction(s.state, s.mode)
  if (a) submit(a)
}

export function escape(): void {
  if (!get().playing) set({ mode: { kind: 'idle' } })
}

// ---------------------------------------------------------------- lifecycle
export function initBattle(setup: BattleSetup, initial: BattleState | undefined, callbacks: typeof cb): void {
  cb = callbacks
  alive = true
  failures = 0
  floaters.length = 0
  const state = initial ?? createBattle(setup)
  const forced = urlSpeed()
  set({
    setup, state, pres: presFrom(state), presV: 0, playing: false, speed: forced ?? get().speed, speedLocked: forced === 'instant',
    aiCommand: get().aiCommand, mode: { kind: 'idle' }, selected: state.active, hover: null, feed: [], duelOpen: false, ended: !!state.outcome, rejected: '',
  })
  if (forced === 'instant') set({ speed: 'instant' })
  schedule()
}

export function disposeBattle(): void {
  alive = false
  if (timer) clearTimeout(timer)
  timer = null
  director.dispose()
  cb = {}
}

export function finishBattle(): void {
  const s = get()
  if (s.state) cb.onDone?.(outcomeOf(s.state))
}

export type { DuelSetup }
