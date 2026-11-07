// The store is the sole caller of world.step. It keeps the opts, the action list, the snapshot and the screen.
import { create } from 'zustand'
import type { BattleState } from '../../battle/types'
import type { NewGameOptions, RejectCode, WorldAction, WorldState } from '../../contracts/world'
import { world } from '../../world'
import { clearSave, readSave, writeSave, type SaveEnvelope, type SaveRead } from '../save/save'

export type Screen = 'title' | 'new' | 'game' | 'end'

export interface StepFail { code: RejectCode; message: string }

export interface GameStore {
  screen: Screen
  state: WorldState | null
  opts: NewGameOptions | null
  actions: WorldAction[]
  battle: BattleState | undefined
  saveRead: SaveRead
  /** A problem storing the save (refused storage, quota), shown in the HUD. */
  saveProblem: string | null
  lastError: string | null
  refreshSave(): void
  goTitle(): void
  goNew(): void
  startNew(opts: NewGameOptions): void
  continueSaved(): boolean
  discardSave(): void
  act(a: WorldAction): { ok: true } | { ok: false; fail: StepFail }
  setBattle(b: BattleState | undefined): void
  clearError(): void
}

function envelope(opts: NewGameOptions, actions: WorldAction[], state: WorldState, battle: BattleState | undefined): SaveEnvelope {
  return { version: 1, savedAt: Date.now(), opts, actions, snapshot: state, presentation: battle ? { battle } : {} }
}

export const useGame = create<GameStore>((set, get) => {
  const persist = (opts: NewGameOptions, actions: WorldAction[], state: WorldState, battle: BattleState | undefined): void => {
    const r = writeSave(envelope(opts, actions, state, battle))
    set({ saveProblem: r.ok ? null : r.reason })
  }
  return {
    screen: 'title',
    state: null,
    opts: null,
    actions: [],
    battle: undefined,
    saveRead: readSave(),
    saveProblem: null,
    lastError: null,
    refreshSave: () => set({ saveRead: readSave() }),
    goTitle: () => set({ screen: 'title', saveRead: readSave(), lastError: null }),
    goNew: () => set({ screen: 'new', lastError: null }),
    startNew: (opts) => {
      const state = world.newGame(opts)
      set({ screen: 'game', state, opts, actions: [], battle: undefined, lastError: null })
      persist(opts, [], state, undefined)
    },
    continueSaved: () => {
      const r = readSave()
      set({ saveRead: r })
      if (r.kind !== 'ok') return false
      const { env } = r
      set({ screen: env.snapshot.phase === 'ended' || env.snapshot.ended ? 'end' : 'game', state: env.snapshot, opts: env.opts, actions: env.actions, battle: env.presentation.battle, lastError: null })
      return true
    },
    discardSave: () => {
      clearSave()
      set({ saveRead: { kind: 'none' } })
    },
    act: (a) => {
      const { state, opts, actions } = get()
      if (!state || !opts) return { ok: false, fail: { code: 'not-legal', message: 'No game is open.' } }
      const r = world.step(state, a)
      if (!r.ok) {
        set({ lastError: r.message })
        return { ok: false, fail: { code: r.code, message: r.message } }
      }
      const next = actions.concat(a)
      if (r.state.ended || r.state.phase === 'ended') {
        clearSave() // a finished game clears its save (KB rule 22)
        set({ state: r.state, actions: next, battle: undefined, screen: 'end', lastError: null, saveRead: { kind: 'none' }, saveProblem: null })
      } else {
        set({ state: r.state, actions: next, battle: undefined, lastError: null })
        persist(opts, next, r.state, undefined)
      }
      return { ok: true }
    },
    setBattle: (b) => {
      const { state, opts, actions } = get()
      set({ battle: b })
      if (state && opts && b) persist(opts, actions, state, b)
    },
    clearError: () => set({ lastError: null }),
  }
})
