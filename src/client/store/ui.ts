// View state that is not part of the world: which panel is open, which city is selected, which officer card is showing.
import { create } from 'zustand'
import type { ActionGroup } from '../../world/types'

export type Panel = 'factions' | 'chronicle' | 'menu' | 'help' | null

export interface UiStore {
  panel: Panel
  city: string | null
  officer: string | null
  group: ActionGroup
  /** a kind of action whose picker is open */
  dialog: string | null
  setPanel(p: Panel): void
  setCity(c: string | null): void
  openOfficer(id: string | null): void
  setGroup(g: ActionGroup): void
  setDialog(k: string | null): void
}

export const useUi = create<UiStore>((set) => ({
  panel: null,
  city: null,
  officer: null,
  group: 'Work',
  dialog: null,
  setPanel: (panel) => set({ panel }),
  setCity: (city) => set({ city }),
  openOfficer: (officer) => set({ officer }),
  setGroup: (group) => set({ group }),
  setDialog: (dialog) => set({ dialog }),
}))
