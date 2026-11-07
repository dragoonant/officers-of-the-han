// The lacquered hex board: raised mineral-coloured tiles on a black lacquer tray, with carved trees, umber hill steps, azurite river with ochre ripples,
// vermilion-and-black wall blocks and an ochre keep (50-presentation.md "Battle"). Static meshes only; picking is done in the camera rig by hex (KB rule 25).
import { useLayoutEffect, useMemo, useRef } from 'react'
import { BoxGeometry, ConeGeometry, CylinderGeometry, DoubleSide, FrontSide, InstancedMesh, MeshStandardMaterial, Object3D, RingGeometry, Color, type BufferGeometry } from 'three'
import { indexToHex } from '../../battle/hex'
import { BOARD_H, BOARD_W, SIZE, TERRAIN_COLOUR, tileTop, tileXZ } from './layout'
import type { PHex } from './pres'

const R = SIZE * 0.95
const unitHex = (): CylinderGeometry => new CylinderGeometry(1, 1, 1, 6).translate(0, 0.5, 0)

const dummy = new Object3D()
const col = new Color()

interface Inst {
  x: number
  y: number
  z: number
  sx: number
  sy: number
  sz: number
  color: string
  ry?: number
}

function Inst({ geo, items, rough = 0.35, metal = 0.1, double = false }: { geo: BufferGeometry; items: Inst[]; rough?: number; metal?: number; double?: boolean }) {
  const ref = useRef<InstancedMesh>(null)
  const mat = useMemo(() => new MeshStandardMaterial({ roughness: rough, metalness: metal, side: double ? DoubleSide : FrontSide }), [rough, metal, double])
  useLayoutEffect(() => {
    const m = ref.current
    if (!m) return
    items.forEach((it, i) => {
      dummy.position.set(it.x, it.y, it.z)
      dummy.rotation.set(0, it.ry ?? 0, 0)
      dummy.scale.set(it.sx, it.sy, it.sz)
      dummy.updateMatrix()
      m.setMatrixAt(i, dummy.matrix)
      m.setColorAt(i, col.set(it.color))
    })
    m.count = items.length
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
    m.computeBoundingSphere()
  }, [items])
  if (items.length === 0) return null
  return <instancedMesh ref={ref} args={[geo, mat, Math.max(1, items.length)]} castShadow receiveShadow frustumCulled={false} />
}

function rnd(i: number, k: number): number {
  const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453
  return x - Math.floor(x)
}

export function Terrain({ hexes }: { hexes: PHex[] }) {
  const hexG = useMemo(() => unitHex(), [])
  const coneG = useMemo(() => new ConeGeometry(1, 1, 7).translate(0, 0.5, 0), [])
  const ringG = useMemo(() => new RingGeometry(0.8, 1, 20).rotateX(-Math.PI / 2), [])
  const boxG = useMemo(() => new BoxGeometry(1, 1, 1).translate(0, 0.5, 0), [])

  const parts = useMemo(() => {
    const tiles: Inst[] = []
    const steps: Inst[] = []
    const cones: Inst[] = []
    const trees: Inst[] = []
    const ripples: Inst[] = []
    const bands: Inst[] = []
    const blocks: Inst[] = []
    hexes.forEach((h, i) => {
      const { q, r } = indexToHex(i)
      const { x, z } = tileXZ(q, r)
      const top = tileTop(h.terrain)
      const burning = h.burn > 0
      const base = burning ? '#7a2f14' : TERRAIN_COLOUR[h.terrain]
      // gates that are broken stand open: a low black threshold
      const broken = h.terrain === 'gate' && h.gateHp <= 0
      const topH = broken ? 0.1 : top
      tiles.push({ x, y: 0, z, sx: R, sy: topH, sz: R, color: broken ? '#2a201b' : base })
      switch (h.terrain) {
        case 'hill':
          steps.push({ x, y: topH, z, sx: R * 0.72, sy: 0.1, sz: R * 0.72, color: '#8a6445' })
          steps.push({ x, y: topH + 0.1, z, sx: R * 0.42, sy: 0.09, sz: R * 0.42, color: '#a87c58' })
          break
        case 'mountain':
          cones.push({ x, y: topH - 0.02, z, sx: R * 0.85, sy: 0.7, sz: R * 0.85, color: '#77777a' })
          cones.push({ x: x + 0.18, y: topH - 0.02, z: z + 0.1, sx: R * 0.45, sy: 0.45, sz: R * 0.45, color: '#8a8a8c' })
          break
        case 'forest':
          for (let k = 0; k < 3; k++) {
            const a = rnd(i, k) * Math.PI * 2
            const d = 0.14 + rnd(i, k + 5) * 0.2
            const hgt = 0.34 + rnd(i, k + 9) * 0.14
            trees.push({ x: x + Math.cos(a) * d, y: topH, z: z + Math.sin(a) * d, sx: 0.12, sy: hgt, sz: 0.12, color: k === 0 ? '#0f3a2b' : '#14452f' })
            trees.push({ x: x + Math.cos(a) * d, y: topH + hgt * 0.55, z: z + Math.sin(a) * d, sx: 0.09, sy: hgt * 0.7, sz: 0.09, color: '#1d6a47' })
          }
          break
        case 'river':
        case 'ford':
          for (let k = 0; k < 2; k++) ripples.push({ x: x + (rnd(i, k) - 0.5) * 0.4, y: topH + 0.004, z: z + (rnd(i, k + 3) - 0.5) * 0.4, sx: 0.12 + k * 0.05, sy: 1, sz: 0.12 + k * 0.05, color: '#d9a441' })
          break
        case 'wall':
          bands.push({ x, y: topH - 0.08, z, sx: R * 1.01, sy: 0.08, sz: R * 1.01, color: '#c4471d' })
          steps.push({ x, y: topH, z, sx: R * 0.86, sy: 0.07, sz: R * 0.86, color: '#2a201b' })
          break
        case 'gate':
          if (!broken) {
            bands.push({ x, y: topH - 0.07, z, sx: R * 1.01, sy: 0.07, sz: R * 1.01, color: '#c4471d' })
            blocks.push({ x, y: topH, z, sx: 0.32, sy: 0.28, sz: 0.22, color: '#c4471d' })
          }
          break
        case 'keep':
          steps.push({ x, y: topH, z, sx: R * 0.72, sy: 0.16, sz: R * 0.72, color: '#e8bb55' })
          steps.push({ x, y: topH + 0.16, z, sx: R * 0.5, sy: 0.16, sz: R * 0.5, color: '#c4471d' })
          cones.push({ x, y: topH + 0.3, z, sx: R * 0.62, sy: 0.32, sz: R * 0.62, color: '#17110e' })
          break
        case 'town':
          blocks.push({ x: x + 0.12, y: topH, z: z - 0.08, sx: 0.22, sy: 0.14, sz: 0.2, color: '#6b4a33' })
          break
        default:
          break
      }
    })
    return { tiles, steps, cones, trees, ripples, bands, blocks }
  }, [hexes])

  const trayW = BOARD_W + 1.1
  const trayH = BOARD_H + 1.1
  return (
    <group>
      {/* the black lacquer tray the tiles sit in, with a vermilion inlay line round the rim */}
      <mesh position={[0, -0.12, 0]} receiveShadow>
        <boxGeometry args={[trayW, 0.24, trayH]} />
        <meshStandardMaterial color="#0b0807" roughness={0.18} metalness={0.2} />
      </mesh>
      <TrayRim w={trayW} h={trayH} />
      <Inst geo={hexG} items={parts.tiles} rough={0.28} metal={0.12} />
      <Inst geo={hexG} items={parts.steps} rough={0.4} />
      <Inst geo={hexG} items={parts.bands} rough={0.3} />
      <Inst geo={coneG} items={parts.cones} rough={0.55} />
      <Inst geo={coneG} items={parts.trees} rough={0.6} />
      <Inst geo={boxG} items={parts.blocks} rough={0.35} />
      <Inst geo={ringG} items={parts.ripples} rough={0.5} double />
    </group>
  )
}

/** Inlaid vermilion line round the tray. */
function TrayRim({ w, h }: { w: number; h: number }) {
  const t = 0.05
  const y = 0.002
  return (
    <group>
      {[
        [0, y, -h / 2 + 0.12, w - 0.24, t],
        [0, y, h / 2 - 0.12, w - 0.24, t],
      ].map((a, i) => (
        <mesh key={i} position={[a[0]!, a[1]!, a[2]!]}>
          <boxGeometry args={[a[3]!, 0.02, a[4]!]} />
          <meshStandardMaterial color="#c4471d" roughness={0.4} />
        </mesh>
      ))}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (w / 2 - 0.12), y, 0]}>
          <boxGeometry args={[t, 0.02, h - 0.24]} />
          <meshStandardMaterial color="#c4471d" roughness={0.4} />
        </mesh>
      ))}
    </group>
  )
}

