// Board camera: fitted so the whole board sits inside the free part of the window; pan, rotate and zoom are the MapController's.
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import { PerspectiveCamera, Vector3 } from 'three'
import { distFor } from './cameraModel'
import { BOARD_H, BOARD_W, hexAtWorld, tileXZ, tileTop } from './layout'
import { MapController } from './mapController'
import { useBattle } from './store'
import { hexIndexSafe } from './util'

export interface Insets {
  left: number
  right: number
  top: number
  bottom: number
}

/** Pixels of the window the HUD leaves for the board. Pure. */
export function insetsFor(width: number, height: number): Insets {
  if (width >= 800) return { left: 12, right: 300, top: 86, bottom: 150 }
  return { left: 4, right: 4, top: 112, bottom: Math.max(200, Math.round(height * 0.27)) }
}

const POLAR = 0.78

function corners(): [number, number, number][] {
  const hw = BOARD_W / 2 + 0.6
  const hh = BOARD_H / 2 + 0.6
  const out: [number, number, number][] = []
  for (const x of [-hw, hw]) for (const z of [-hh, hh]) for (const y of [0, 0.9]) out.push([x, y, z])
  return out
}

function projectedBounds(cam: PerspectiveCamera, dist: number, az: number, pts: [number, number, number][]): { minx: number; maxx: number; miny: number; maxy: number } {
  const dir = new Vector3(Math.sin(az) * Math.sin(POLAR), Math.cos(POLAR), Math.cos(az) * Math.sin(POLAR))
  cam.position.copy(dir).multiplyScalar(dist)
  cam.lookAt(0, 0, 0)
  cam.updateMatrixWorld(true)
  cam.updateProjectionMatrix()
  let minx = Infinity
  let maxx = -Infinity
  let miny = Infinity
  let maxy = -Infinity
  const v = new Vector3()
  for (const c of pts) {
    v.set(c[0], c[1], c[2]).project(cam)
    minx = Math.min(minx, v.x)
    maxx = Math.max(maxx, v.x)
    miny = Math.min(miny, v.y)
    maxy = Math.max(maxy, v.y)
  }
  return { minx, maxx, miny, maxy }
}

/** Distance and pixel shift that place the board inside the inset rectangle. */
export function fitBoard(fov: number, w: number, h: number, ins: Insets): { dist: number; shiftX: number; shiftY: number } {
  const pts = corners()
  const cam = new PerspectiveCamera(fov, w / h, 0.5, 200)
  const freeW = Math.max(120, w - ins.left - ins.right)
  const freeH = Math.max(120, h - ins.top - ins.bottom)
  let lo = 4
  let hi = 90
  for (let i = 0; i < 28; i++) {
    const mid = (lo + hi) / 2
    const b = projectedBounds(cam, mid, 0, pts)
    const pw = ((b.maxx - b.minx) / 2) * w
    const ph = ((b.maxy - b.miny) / 2) * h
    if (pw <= freeW && ph <= freeH) hi = mid
    else lo = mid
  }
  const dist = hi
  const b = projectedBounds(cam, dist, 0, pts)
  const cx = w / 2 + ((b.minx + b.maxx) / 2) * (w / 2)
  const cy = h / 2 - ((b.miny + b.maxy) / 2) * (h / 2)
  return { dist, shiftX: ins.left + freeW / 2 - cx, shiftY: ins.top + freeH / 2 - cy }
}

export interface ViewApi {
  camera(): { x: number; y: number; z: number; tx: number; tz: number; az: number; zoom: number; tilt: number; dist: number }
  tileToScreen(q: number, r: number): { x: number; y: number } | null
  focusTile(q: number, r: number, zoom?: number): void
  rotate(dir: number): void
  reset(): void
  setView(p: Partial<{ x: number; z: number; az: number; zoom: number; tilt: number }>): void
}
export const viewApi: ViewApi = {
  camera: () => ({ x: 0, y: 0, z: 0, tx: 0, tz: 0, az: 0, zoom: 0, tilt: 0, dist: 0 }),
  tileToScreen: () => null,
  focusTile: () => {},
  rotate: () => {},
  reset: () => {},
  setView: () => {},
}

export function CameraRig({ onTap, onHover, onLeave, onLongPress }: { onTap: (q: number, r: number) => void; onHover: (q: number, r: number | null) => void; onLeave: () => void; onLongPress: (q: number, r: number) => void }) {
  const { camera, size, gl } = useThree()
  const ctl = useMemo(() => new MapController(camera as PerspectiveCamera, gl.domElement), [camera, gl])
  const lim = useMemo(() => ({ x: BOARD_W / 2 - 1, z: BOARD_H / 2 - 1 }), [])

  useEffect(() => {
    ctl.attach()
    return () => ctl.detach()
  }, [ctl])

  useEffect(() => {
    ctl.surface = (x, z) => {
      if (Math.abs(x) > BOARD_W / 2 + 0.3 || Math.abs(z) > BOARD_H / 2 + 0.3) return 0
      const h = hexAtWorld(x, z)
      const st = useBattle.getState().pres
      const cell = st?.hexes[0] ? st.hexes[hexIndexSafe(h.q, h.r)] : undefined
      return cell ? tileTop(cell.terrain) : 0.14
    }
  }, [ctl])

  useEffect(() => {
    const pick = (cx: number, cy: number): { q: number; r: number } | null => {
      const g = ctl.groundAt({ x: cx, y: cy })
      if (!g) return null
      const h = hexAtWorld(g.x, g.z)
      return hexIndexSafe(h.q, h.r) >= 0 ? h : null
    }
    ctl.onTap = (x, y) => {
      const h = pick(x, y)
      if (h) onTap(h.q, h.r)
    }
    ctl.onHover = (x, y) => {
      const h = pick(x, y)
      onHover(h ? h.q : 0, h ? h.r : null)
    }
    ctl.onLeave = onLeave
    ctl.onLongPress = (x, y) => {
      const h = pick(x, y)
      if (h) onLongPress(h.q, h.r)
    }
  }, [ctl, onTap, onHover, onLeave, onLongPress])

  useEffect(() => {
    const cam = camera as PerspectiveCamera
    const ins = insetsFor(size.width, size.height)
    const fit = fitBoard(cam.fov, size.width, size.height, ins)
    const freeW = Math.max(120, size.width - ins.left - ins.right)
    const freeH = Math.max(120, size.height - ins.top - ins.bottom)
    ctl.interactive = true
    ctl.lim = lim
    ctl.setFit({ overview: fit.dist, shiftX: fit.shiftX, shiftY: fit.shiftY, centreX: ins.left + freeW / 2 - size.width / 2, centreY: ins.top + freeH / 2 - size.height / 2 })
  }, [ctl, camera, size.width, size.height, lim])
  useEffect(() => {
    ctl.reset(false)
  }, [ctl])

  useEffect(() => {
    const cam = camera as PerspectiveCamera
    viewApi.tileToScreen = (q, r) => {
      const p = tileXZ(q, r)
      cam.updateMatrixWorld(true)
      const v = new Vector3(p.x, 0.14, p.z).project(cam)
      const rc = gl.domElement.getBoundingClientRect()
      return { x: rc.left + ((v.x + 1) / 2) * rc.width, y: rc.top + ((1 - v.y) / 2) * rc.height }
    }
    viewApi.rotate = (dir) => ctl.rotateBy(dir)
    viewApi.reset = () => ctl.flyHome()
    viewApi.camera = () => {
      const v = ctl.view
      const c = camera.position
      return { x: c.x, y: c.y, z: c.z, tx: v.x, tz: v.z, az: v.az, zoom: v.zoom, tilt: v.tilt, dist: distFor(v.zoom, ctl.fit.overview) }
    }
    viewApi.setView = (p) => ctl.setView(p)
    viewApi.focusTile = (q, r, zoom = 0.6) => {
      const p = tileXZ(q, r)
      ctl.flyTo(p.x, p.z, zoom)
    }
  }, [camera, gl, ctl])

  useFrame((_, dt) => ctl.update(Math.min(dt, 0.1)))

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.target instanceof HTMLElement && /input|textarea/i.test(e.target.tagName)) return
      if (e.key === 'q' || e.key === 'Q') viewApi.rotate(-1)
      if (e.key === 'e' || e.key === 'E') viewApi.rotate(1)
      if (e.key === 'r' || e.key === 'R' || e.key === 'Home') viewApi.reset()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return null
}

