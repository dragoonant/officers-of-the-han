// B-MAP-2 terrain table.
import type { TroopType } from '../contracts/data'
import type { Terrain } from './types'

export interface TerrainInfo {
  /** Move cost per troop type; null = impassable. */
  cost: Record<TroopType, number> | null
  def: number // damage-taken multiplier
  burns: boolean
  name: string
}

const c = (spear: number, cavalry: number, archer: number) => ({ spear, cavalry, archer })

export const TERRAIN: Record<Terrain, TerrainInfo> = {
  plain: { cost: c(1, 1, 1), def: 1.0, burns: true, name: 'Plain' },
  grass: { cost: c(1, 1, 1), def: 1.0, burns: true, name: 'Grass' },
  forest: { cost: c(2, 3, 2), def: 0.8, burns: true, name: 'Forest' },
  hill: { cost: c(2, 2, 2), def: 0.85, burns: false, name: 'Hill' },
  mountain: { cost: null, def: 1.0, burns: false, name: 'Mountain' },
  river: { cost: null, def: 1.0, burns: false, name: 'River' },
  ford: { cost: c(2, 3, 2), def: 1.15, burns: false, name: 'Ford' },
  marsh: { cost: c(3, 4, 3), def: 1.1, burns: false, name: 'Marsh' },
  road: { cost: c(1, 1, 1), def: 1.0, burns: false, name: 'Road' },
  wall: { cost: null, def: 1.0, burns: false, name: 'Wall' },
  gate: { cost: c(1, 1, 1), def: 0.8, burns: false, name: 'Gate' }, // only when broken
  keep: { cost: c(1, 1, 1), def: 0.7, burns: false, name: 'Keep' },
  town: { cost: c(1, 1, 1), def: 0.85, burns: false, name: 'Town' },
  ash: { cost: c(1, 1, 1), def: 1.0, burns: false, name: 'Ash' },
}

export const MOVE_POINTS: Record<TroopType, number> = { spear: 4, cavalry: 6, archer: 4 }
