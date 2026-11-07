// Rig contract for hero, officer and troop figures (docs/spec/31-hero-figures.md "Animation joints").
// The board and the battle cut-ins (docs/spec/51-battle-cutins.md) animate ONLY through these joint names, so a
// procedural body can later be swapped for a GLB without touching either. This file holds the contract plus a
// deliberately plain placeholder builder; the real builders live in heroes.ts / troops.ts / horse.ts.
import { BoxGeometry, CapsuleGeometry, Group, Mesh, MeshStandardMaterial, SphereGeometry, type Object3D } from 'three'

export const HUMAN_JOINTS = ['root', 'hips', 'torso', 'head', 'armL', 'armR', 'handL', 'handR', 'legL', 'legR', 'weapon', 'offhand'] as const
export const OPTIONAL_JOINTS = ['cape', 'beard', 'footL', 'footR'] as const
export const HORSE_JOINTS = ['body', 'neck', 'head', 'legFL', 'legFR', 'legBL', 'legBR', 'tail'] as const

export type HumanJoint = (typeof HUMAN_JOINTS)[number] | (typeof OPTIONAL_JOINTS)[number]
/** Optional pasterns: the hoof hangs from the leg so it can stay level on the sand while the leg swings. */
export const HOOF_JOINTS = ['hoofFL', 'hoofFR', 'hoofBL', 'hoofBR'] as const
export type HorseJoint = (typeof HORSE_JOINTS)[number]
export type HoofJoint = (typeof HOOF_JOINTS)[number]

export interface HorseRig {
  group: Group
  joints: Record<HorseJoint, Object3D> & Partial<Record<HoofJoint, Object3D>>
  /** Height of the saddle above the horse's root, in figure units. */
  saddleY: number
}

export interface Rig {
  /** Root group: origin on the ground plane under the figure (soles and hooves rest on y = 0; there is no base), +Z is "forward", 1 unit = one tile width. */
  group: Group
  joints: Partial<Record<HumanJoint, Object3D>> & Record<(typeof HUMAN_JOINTS)[number], Object3D>
  /** Present when the figure is mounted; the rider's `root` sits on `mount.joints.body` at `saddleY`. */
  mount?: HorseRig
  /** Total figure height from the ground, including headgear and weapons (for camera framing). */
  height: number
  /** Radius of the ground ring decal the board paints under the figure (optional; defaults to 0.35, 0.44 mounted). */
  footprint?: number
  /** Uniform scale already built into the body (the brothers differ in height: Guan Yu 1.15, Zhang Fei 1.07, Liu Bei 1). Gait distances are in unscaled rig units, so a caller moving the figure `d` tiles passes `d / bodyScale` to the clips. Default 1. */
  bodyScale?: number
  /** Which kind of figure this is (for clips that differ by kind). */
  kind: 'hero' | 'officer' | 'infantry' | 'archer' | 'cavalry' | 'rebel'
  dispose(): void
}

export type TroopKind = 'infantry' | 'archer' | 'cavalry' | 'rebel'
/** Side palette key, matching the theme tokens (--han, --yellow, --cao, --dong, --lu, --court). */
export type SidePalette = string

