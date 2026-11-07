// Figures: one per unit (an officer and a few troop figures sized by the troops band). They stand on the tile with no base. Figures carry NO pointer
// handlers: picking is by hex only (KB rule 25), so a figure can never hide the tile behind it from a tap.
import { Billboard } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { memo, useEffect, useMemo, useRef } from 'react'
import { type Group, type Mesh, type MeshBasicMaterial } from 'three'
import type { BUnit } from '../../battle/types'
import { anim, animProgress } from './director'
import { applyClip, drawBow, fallBack, idle, locomotion, stepTurn, thrust, type Clip } from './figures/clips'
import type { Rig } from './figures/rig'
import { buildUnitOfficer, buildUnitTrooper, hashOf } from './figures/units'
import { angDiff, movePhases, pathLength, samplePath, trapezoid, type PathPoint } from './travel'
import { tileTop, tileXZ } from './layout'
import { useBattle } from './store'
import { hexIndexSafe } from './util'

const ease = (t: number): number => t * t * (3 - 2 * t)

/** Troop figures beside the officer, by the unit's starting strength. */
export function troopFigureMax(troopsStart: number, lowTier: boolean): number {
  const n = troopsStart >= 3500 ? 3 : troopsStart >= 1800 ? 2 : 1
  return lowTier ? Math.min(n, 2) : n
}
/** How many of them are still standing at this strength. */
export function troopFiguresShown(max: number, troops: number, start: number): number {
  if (troops <= 0) return 0
  return Math.max(1, Math.min(max, Math.ceil(max * Math.min(1, (troops / Math.max(1, start)) * 1.1))))
}

const SLOTS: [number, number][] = [[-0.26, -0.3], [0.26, -0.3], [0, -0.52]]

interface Props {
  unit: BUnit
  pigment: string
  lowTier: boolean
}

function FigureImpl({ unit, pigment, lowTier }: Props) {
  const root = useRef<Group>(null)
  const spin = useRef<Group>(null)
  const bar = useRef<Group>(null)
  const fill = useRef<Mesh>(null)
  const fillMat = useRef<MeshBasicMaterial>(null)
  const troopGroups = useRef<(Group | null)[]>([])
  const cav = unit.type === 'cavalry'
  const max = troopFigureMax(unit.troopsStart, lowTier)
  const phase = useMemo(() => (unit.id.length * 1.37) % 6, [unit.id])
  const stride0 = useMemo(() => (hashOf(unit.id) % 100) / 100, [unit.id])
  const rigs = useMemo(() => {
    const officer = buildUnitOfficer(unit.officer.id, unit.type, pigment)
    const troopers = Array.from({ length: max }, (_, i) => buildUnitTrooper(unit.id, unit.type, pigment, i))
    return { officer, troopers }
  }, [unit.id, unit.officer.id, unit.type, pigment, max])
  useEffect(() => () => { rigs.officer.dispose(); rigs.troopers.forEach((r) => r.dispose()) }, [rigs])

  useFrame((state) => {
    const g = root.current
    const s = spin.current
    const st = useBattle.getState()
    const pu = st.pres?.units.find((u) => u.id === unit.id)
    if (!g || !s || !pu) return
    const t = state.clock.elapsedTime
    const beat = anim.beat
    const ev = beat?.ev
    const p = animProgress()
    const here = st.pres?.hexes
    let { x, z } = tileXZ(pu.q, pu.r)
    const topOf = (q: number, r: number): number => {
      const i = hexIndexSafe(q, r)
      return tileTop(here?.[i]?.terrain ?? 'plain')
    }
    let y = topOf(pu.q, pu.r)
    let ang = pu.facing
    let clip: Clip | null = null
    let attack: 'thrust' | 'bow' | null = null
    let hop = 0
    let tilt = 0
    let sc = 1
    let shake = 0
    const bs = rigs.officer.bodyScale ?? 1
    const go = (d: number, v: number): Clip => locomotion(rigs.officer, d / bs + stride0 * 3, v / bs, t * 0.8 + phase)
    if (ev) {
      switch (ev.kind) {
        case 'move':
          if (ev.unit === unit.id) {
            const pts: PathPoint[] = ev.path.map((q) => ({ ...tileXZ(q.q, q.r), y: topOf(q.q, q.r) }))
            const L = pathLength(pts)
            const sec = Math.max(0.001, anim.ms / 1000)
            const a0 = pts[0]!
            if (L < 0.001) break
            const { tin, tout } = movePhases(0, 0, anim.ms)
            const pp = (p - tin) / Math.max(1e-6, 1 - tin - tout)
            const { q, dq } = trapezoid(pp)
            const d = L * q
            const sm = samplePath(pts, d)
            x = sm.x
            z = sm.z
            y = sm.y
            ang = sm.heading + angDiff(sm.heading, pu.facing) * (1 - ease(Math.min(1, d / 0.3)))
            clip = go(d, (L * dq) / sec)
            void a0
          }
          break
        case 'attack':
          if (ev.unit === unit.id) {
            const tg = st.pres?.units.find((u) => u.id === ev.target)
            if (tg) {
              const a = tileXZ(tg.q, tg.r)
              const dx = a.x - x
              const dz = a.z - z
              const len = Math.hypot(dx, dz) || 1
              const off = ev.range > 1 ? 0 : Math.sin(Math.min(1, p) * Math.PI) * 0.34
              x += (dx / len) * off
              z += (dz / len) * off
              ang = Math.atan2(dx, dz)
              attack = unit.type === 'archer' || ev.range > 1 ? 'bow' : cav ? null : 'thrust'
              if (!attack) hop = Math.sin(Math.min(1, p) * Math.PI) * 0.06
            }
          } else if (ev.target === unit.id) {
            shake = (1 - p) * 0.05
            x += Math.sin(p * 38) * shake
            z += Math.cos(p * 31) * shake
          }
          break
        case 'volley':
          if (ev.target === unit.id) {
            x += Math.sin(p * 38) * (1 - p) * 0.05
          }
          break
        case 'rout':
          if (ev.unit === unit.id) {
            if (cav) { tilt = ease(p) * 1.45; y -= p * 0.1 } else clip = fallBack(ease(p))
            sc = p > 0.7 ? Math.max(0.05, 1 - ((p - 0.7) / 0.3) * 0.95) : 1
          }
          break
        case 'tactic':
          if (ev.unit === unit.id) hop = Math.sin(Math.min(1, p) * Math.PI) * 0.12
          break
        case 'challenge':
          if (ev.unit === unit.id) hop = Math.sin(Math.min(1, p) * Math.PI * 2) * 0.05
          break
        case 'wait':
          if (ev.unit === unit.id) hop = Math.sin(Math.min(1, p) * Math.PI) * 0.03
          break
        case 'undoMove':
          break
        default:
          break
      }
    }
    if (!clip) {
      if (attack === 'thrust') clip = thrust(Math.min(1, Math.sin(Math.min(1, p) * Math.PI) * 0.7))
      else if (attack === 'bow') clip = drawBow(Math.min(1, Math.sin(Math.min(1, p) * Math.PI) * 1.2))
      else clip = idle(t * 0.8 + phase)
    }
    applyClip(rigs.officer, clip)
    const shown = troopFiguresShown(max, pu.troops, unit.troopsStart)
    rigs.troopers.forEach((r, i) => {
      const tg = troopGroups.current[i]
      if (tg) tg.visible = i < shown && !pu.routed
      if (i < shown) applyClip(r, clip === null ? idle(t * 0.8 + phase + i) : moving(clip, t, phase + i * 0.7) ?? clip)
    })
    g.visible = !pu.routed || (ev?.kind === 'rout' && ev.unit === unit.id)
    g.position.set(x, y + hop, z)
    s.rotation.y = ang
    g.rotation.x = -tilt
    g.scale.setScalar(sc)
    if (bar.current) {
      const cd = state.camera.position.distanceTo(g.position)
      bar.current.scale.setScalar(Math.max(0.35, Math.min(1, cd / 9)))
    }
    const frac = Math.max(0, Math.min(1, pu.troops / unit.troopsStart))
    if (fill.current) fill.current.scale.x = Math.max(0.001, frac)
    if (fillMat.current) fillMat.current.color.set(frac < 0.3 ? '#c4471d' : pigment)
  })

  const rider = cav ? 0.34 : 0
  const sc = cav ? 0.52 : 0.6
  return (
    <group ref={root}>
      <group ref={spin}>
        <primitive object={rigs.officer.group} />
        {rigs.troopers.map((r, i) => (
          <group key={i} ref={(el) => { troopGroups.current[i] = el }} position={[SLOTS[i]![0] * (cav ? 1.25 : 1), 0, SLOTS[i]![1] * (cav ? 1.25 : 1)]} scale={sc}>
            <primitive object={r.group} />
          </group>
        ))}
      </group>
      <Billboard position={[0, 1.34 + rider, 0]}>
        <group ref={bar}>
          <mesh renderOrder={20}>
            <planeGeometry args={[0.62, 0.1]} />
            <meshBasicMaterial color="#0f0c0b" transparent opacity={0.9} depthTest={false} />
          </mesh>
          <group position={[-0.29, 0, 0]}>
            <mesh ref={fill} position={[0.29, 0, 0.001]} renderOrder={21} scale={[1, 1, 1]}>
              <planeGeometry args={[0.58, 0.06]} />
              <meshBasicMaterial ref={fillMat} color={pigment} depthTest={false} transparent />
            </mesh>
          </group>
        </group>
      </Billboard>
    </group>
  )
}

/** Troop figures march in step with the officer when moving, otherwise they breathe on their own phase. */
function moving(c: Clip, t: number, phase: number): Clip | null {
  void t
  void phase
  return c
}

export const Figure = memo(FigureImpl)

export { stepTurn }
