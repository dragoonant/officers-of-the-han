// Fire, ash smoke, floating numbers and per-beat flourishes. No pointer handlers anywhere here (KB rule 25).
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { CanvasTexture, Color, SRGBColorSpace, type Group, type Mesh, type MeshBasicMaterial, type Sprite, type SpriteMaterial } from 'three'
import { indexToHex } from '../../battle/hex'
import { anim, animProgress } from './director'
import { tileTop, tileXZ } from './layout'
import { floaters, useBattle } from './store'
import { hexIndexSafe } from './util'

/** Flames on every burning hex. */
export function Flames() {
  const hexes = useBattle((s) => s.pres?.hexes)
  const burning = useMemo(() => (hexes ?? []).map((h, i) => ({ h, i })).filter((x) => x.h.burn > 0), [hexes])
  return (
    <group>
      {burning.map(({ h, i }) => {
        const { q, r } = indexToHex(i)
        const p = tileXZ(q, r)
        return <Flame key={i} x={p.x} y={tileTop(h.terrain)} z={p.z} seed={i} />
      })}
    </group>
  )
}

function Flame({ x, y, z, seed }: { x: number; y: number; z: number; seed: number }) {
  const g = useRef<Group>(null)
  useFrame((s) => {
    const t = s.clock.elapsedTime
    g.current?.children.forEach((c, k) => {
      const f = 0.75 + 0.35 * Math.sin(t * (7 + k * 2.3) + seed * 1.7 + k)
      c.scale.set(1, f, 1)
      c.rotation.y = t * (1 + k)
    })
  })
  return (
    <group ref={g} position={[x, y, z]}>
      {[
        { dx: 0, dz: 0, h: 0.55, r: 0.17, c: '#ff5a1f' },
        { dx: 0.17, dz: 0.08, h: 0.38, r: 0.12, c: '#ff8a2a' },
        { dx: -0.15, dz: -0.1, h: 0.42, r: 0.12, c: '#ffb23a' },
      ].map((f, k) => (
        <mesh key={k} position={[f.dx, f.h / 2, f.dz]}>
          <coneGeometry args={[f.r, f.h, 6]} />
          <meshBasicMaterial color={f.c} transparent opacity={0.85} />
        </mesh>
      ))}
      <pointLight position={[0, 0.5, 0]} intensity={0} distance={2} color="#ff7a30" />
    </group>
  )
}

// ---------------------------------------------------------------- floating numbers
const texCache = new Map<string, CanvasTexture>()
function labelTexture(text: string, color: string): CanvasTexture {
  const key = `${text}|${color}`
  let t = texCache.get(key)
  if (t) return t
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 96
  const x = c.getContext('2d')!
  x.font = '700 54px "Josefin Sans", "Segoe UI", sans-serif'
  x.textAlign = 'center'
  x.textBaseline = 'middle'
  x.lineWidth = 9
  x.strokeStyle = '#0f0c0b'
  x.strokeText(text, 128, 50)
  x.fillStyle = color
  x.fillText(text, 128, 50)
  t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  if (texCache.size > 80) {
    const first = texCache.keys().next().value
    if (first) {
      texCache.get(first)?.dispose()
      texCache.delete(first)
    }
  }
  texCache.set(key, t)
  return t
}

const POOL = 12
export function Floaters() {
  const refs = useRef<(Sprite | null)[]>([])
  useFrame(() => {
    const now = performance.now()
    const live = floaters.filter((f) => now - f.t0 < 1500).slice(-POOL)
    const hexes = useBattle.getState().pres?.hexes
    for (let i = 0; i < POOL; i++) {
      const sp = refs.current[i]
      if (!sp) continue
      const f = live[i]
      if (!f) {
        sp.visible = false
        continue
      }
      const age = (now - f.t0) / 1500
      const p = tileXZ(f.q, f.r)
      const top = tileTop(hexes?.[hexIndexSafe(f.q, f.r)]?.terrain ?? 'plain')
      sp.visible = true
      sp.position.set(p.x, top + 1.1 + age * 0.7, p.z)
      const m = sp.material as SpriteMaterial
      m.map = labelTexture(f.text, f.color)
      m.opacity = age < 0.7 ? 1 : 1 - (age - 0.7) / 0.3
      m.needsUpdate = true
    }
  })
  return (
    <group>
      {Array.from({ length: POOL }, (_, i) => (
        <sprite key={i} ref={(el) => { refs.current[i] = el }} scale={[1.1, 0.41, 1]} visible={false} renderOrder={30}>
          <spriteMaterial transparent depthTest={false} />
        </sprite>
      ))}
    </group>
  )
}

// ---------------------------------------------------------------- per-beat flourishes
const TACTIC_COLOUR: Record<string, string> = { fire: '#ff7a30', confuse: '#a07ad8', taunt: '#c4471d', rally: '#d9a441', volley: '#efe3c8' }

export function BeatFx() {
  const ring = useRef<Mesh>(null)
  const ringMat = useRef<MeshBasicMaterial>(null)
  const shot = useRef<Mesh>(null)
  useFrame(() => {
    const ev = anim.beat?.ev
    const p = animProgress()
    const pres = useBattle.getState().pres
    const rm = ring.current
    const sh = shot.current
    if (rm) rm.visible = false
    if (sh) sh.visible = false
    if (!ev || !pres) return
    const hexTop = (q: number, r: number): number => {
      return tileTop(pres.hexes[hexIndexSafe(q, r)]?.terrain ?? 'plain')
    }
    if (ev.kind === 'tactic' && rm && ringMat.current) {
      const pt = tileXZ(ev.q, ev.r)
      rm.visible = true
      rm.position.set(pt.x, hexTop(ev.q, ev.r) + 0.05, pt.z)
      const k = ev.tactic === 'rally' ? 1 : 0.4 + 0.9 * p
      rm.scale.set(k * (ev.tactic === 'rally' ? 2.2 * p + 0.3 : 1), 1, k * (ev.tactic === 'rally' ? 2.2 * p + 0.3 : 1))
      ringMat.current.color = new Color(TACTIC_COLOUR[ev.tactic] ?? '#ffffff')
      ringMat.current.opacity = ev.success ? 1 - p * 0.8 : 0.3 * (1 - p)
    }
    if ((ev.kind === 'attack' && ev.range > 1) || ev.kind === 'volley') {
      const from = pres.units.find((u) => u.id === ev.unit)
      const to = ev.kind === 'attack' ? pres.units.find((u) => u.id === ev.target) : pres.units.find((u) => u.id === ev.target)
      if (from && to && sh) {
        const a = tileXZ(from.q, from.r)
        const b = tileXZ(to.q, to.r)
        const k = Math.min(1, p / 0.7)
        sh.visible = p < 0.75
        sh.position.set(a.x + (b.x - a.x) * k, 0.8 + Math.sin(k * Math.PI) * 0.5, a.z + (b.z - a.z) * k)
        sh.rotation.y = Math.atan2(b.x - a.x, b.z - a.z)
      }
    }
  })
  return (
    <group>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} visible={false} renderOrder={5}>
        <ringGeometry args={[0.38, 0.5, 28]} />
        <meshBasicMaterial ref={ringMat} transparent depthWrite={false} />
      </mesh>
      <mesh ref={shot} visible={false}>
        <boxGeometry args={[0.025, 0.025, 0.4]} />
        <meshBasicMaterial color="#efe3c8" />
      </mesh>
    </group>
  )
}
