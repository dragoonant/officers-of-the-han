import { useMemo } from 'react'
import { BufferGeometry, DoubleSide, Float32BufferAttribute, RingGeometry } from 'three'
import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import type { Mesh, MeshBasicMaterial } from 'three'
import { hexIndexSafe } from './util'
import { SIZE, tileTop, tileXZ } from './layout'
import type { Mark, MarkKind } from './marks'
import { useBattle } from './store'

const R = SIZE * 0.95

function hexRing(inner: number, outer: number): BufferGeometry {
  return new RingGeometry(inner, outer, 6, 1).rotateZ(Math.PI / 6).rotateX(-Math.PI / 2)
}
function hexFill(r: number): BufferGeometry {
  return new RingGeometry(0.0001, r, 6, 1).rotateZ(Math.PI / 6).rotateX(-Math.PI / 2)
}
/** A dashed hex outline: two dashes per edge. */
function dashedHex(r: number, w: number): BufferGeometry {
  const pos: number[] = []
  const idx: number[] = []
  const vert = (i: number, rr: number): [number, number] => {
    const a = (i / 6) * Math.PI * 2
    return [Math.sin(a) * rr, Math.cos(a) * rr]
  }
  let n = 0
  for (let i = 0; i < 6; i++) {
    const [x0, z0] = vert(i, r)
    const [x1, z1] = vert(i + 1, r)
    const [ix0, iz0] = vert(i, r - w)
    const [ix1, iz1] = vert(i + 1, r - w)
    for (const [t0, t1] of [[0.06, 0.46], [0.54, 0.94]] as const) {
      const lerp = (a: number, b: number, t: number): number => a + (b - a) * t
      pos.push(lerp(x0, x1, t0), 0, lerp(z0, z1, t0), lerp(x0, x1, t1), 0, lerp(z0, z1, t1), lerp(ix0, ix1, t1), 0, lerp(iz0, iz1, t1), lerp(ix0, ix1, t0), 0, lerp(iz0, iz1, t0))
      idx.push(n, n + 1, n + 2, n, n + 2, n + 3)
      n += 4
    }
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  return g
}

const STYLE: Record<MarkKind, { fill?: string; fillOp?: number; ring?: string; dashed?: boolean; w: number; y: number }> = {
  move: { fill: '#d9a441', fillOp: 0.3, ring: '#e8bb55', w: 0.05, y: 0.012 },
  attack: { fill: '#6e1d12', fillOp: 0.35, ring: '#e0562a', dashed: true, w: 0.075, y: 0.016 },
  tactic: { fill: '#d9a441', fillOp: 0.28, ring: '#d9a441', dashed: true, w: 0.075, y: 0.016 },
  chosen: { fill: '#c4471d', fillOp: 0.5, ring: '#ff7a45', w: 0.1, y: 0.02 },
  selected: { ring: '#c4471d', w: 0.08, y: 0.02 },
  active: { ring: '#d9a441', w: 0.07, y: 0.024 },
  hover: { ring: '#efe3c8', w: 0.035, y: 0.028 },
}

function MarkMesh({ mark, top }: { mark: Mark; top: number }) {
  const st = STYLE[mark.kind]
  const { x, z } = tileXZ(mark.q, mark.r)
  const ring = useMemo(() => (st.ring ? (st.dashed ? dashedHex(R * 0.97, st.w) : hexRing(R * 0.97 - st.w, R * 0.97)) : null), [st])
  const fill = useMemo(() => (st.fill ? hexFill(R * 0.94) : null), [st])
  const ref = useRef<Mesh>(null)
  const fillRef = useRef<Mesh>(null)
  useFrame((s) => {
    if (mark.kind === 'active' && ref.current) {
      const m = ref.current.material as MeshBasicMaterial
      m.opacity = 0.6 + 0.4 * Math.sin(s.clock.elapsedTime * 3)
    }
    if (mark.kind === 'move' && fillRef.current) {
      const m = fillRef.current.material as MeshBasicMaterial
      // the slow ochre shimmer of an available tile (50-presentation.md)
      m.opacity = 0.2 + 0.16 * (0.5 + 0.5 * Math.sin(s.clock.elapsedTime * 1.6 + mark.q * 0.5 + mark.r * 0.7))
    }
  })
  return (
    <group position={[x, top + st.y, z]}>
      {fill && (
        <mesh ref={fillRef} geometry={fill} renderOrder={3}>
          <meshBasicMaterial color={st.fill} transparent opacity={st.fillOp} depthWrite={false} side={DoubleSide} />
        </mesh>
      )}
      {ring && (
        <mesh ref={ref} geometry={ring} position={[0, 0.003, 0]} renderOrder={4}>
          <meshBasicMaterial color={st.ring} transparent opacity={1} depthWrite={false} side={DoubleSide} />
        </mesh>
      )}
    </group>
  )
}

export function Marks({ marks }: { marks: Mark[] }) {
  const hexes = useBattle((s) => s.pres?.hexes)
  return (
    <group>
      {marks.map((m, i) => {
        const h = hexes?.[hexIndexSafe(m.q, m.r)]
        return <MarkMesh key={`${m.kind}-${m.q}-${m.r}-${i}`} mark={m} top={tileTop(h?.terrain ?? 'plain')} />
      })}
    </group>
  )
}
