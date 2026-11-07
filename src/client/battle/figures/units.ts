// Rigs for battle units: a generic officer (black lacquer armour, ochre trim, a faction-pigment sash and plume) and a few troop figures in the same pigment.
// Everything is compacted to one skinned mesh per figure for the phone budget.
import type { TroopType } from '../../../contracts/data'
import { compactRig } from './compact'
import { buildOfficer, defaultStyle } from './officerKit'
import type { Rig, TroopKind } from './rig'
import { buildTroopRig, registerPalette } from './troops'

export function hashOf(id: string): number {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619)
  return h >>> 0
}

const kindOf = (t: TroopType): TroopKind => (t === 'archer' ? 'archer' : t === 'cavalry' ? 'cavalry' : 'infantry')

export function paletteKey(pigment: string): string {
  const key = `p${pigment}`
  registerPalette(key, pigment)
  return key
}

export function buildUnitOfficer(id: string, type: TroopType, pigment: string): Rig {
  const key = paletteKey(pigment)
  const kind = kindOf(type)
  const base = defaultStyle(id, kind, key)
  const rig = buildOfficer(id, {
    type: kind,
    side: key,
    mounted: type === 'cavalry',
    sash: pigment,
    style: { ...base, armour: '#2a211c', trim: '#d9a441', skirt: '#1c1613', headColor: '#4a4540', plume: pigment },
  })
  compactRig(rig)
  return rig
}

export function buildUnitTrooper(id: string, type: TroopType, pigment: string, n: number): Rig {
  const rig = buildTroopRig(kindOf(type), paletteKey(pigment), (hashOf(id) + n) % 3)
  compactRig(rig)
  return rig
}
