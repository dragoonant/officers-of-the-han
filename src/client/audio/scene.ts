// Which full-screen scene is open, for the music (docs/spec/60-audio.md section 3). A screen calls `useAudioScene(kind)` once; the flag is
// raised while it is mounted. Counters, not booleans, so a duel overlay opening inside a battle and closing again leaves the battle flag alone.
import { useEffect } from 'react'
import { create } from 'zustand'
import type { SceneKind } from './moods'

type Counted = Exclude<SceneKind, 'map'>
export interface SceneStore {
  open: Record<Counted, number>
}

export const useScene = create<SceneStore>(() => ({ open: { battle: 0, duel: 0, debate: 0 } }))

const bump = (k: Counted, d: number): void =>
  useScene.setState((s) => ({ open: { ...s.open, [k]: Math.max(0, s.open[k] + d) } }))

export function useAudioScene(kind: Counted): void {
  useEffect(() => {
    bump(kind, 1)
    return () => bump(kind, -1)
  }, [kind])
}

/** The scene that wins when several are open: a duel over a debate over a battle over the map. */
export function activeScene(open: SceneStore['open']): SceneKind {
  return open.duel > 0 ? 'duel' : open.debate > 0 ? 'debate' : open.battle > 0 ? 'battle' : 'map'
}
