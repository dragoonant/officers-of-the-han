// The lacquer tray: SVG in the data's map units. Pan (one finger / drag), pinch, wheel zoom.
import { useEffect, useMemo, useRef, useState } from 'react'
import type { WorldState } from '../../contracts/world'
import { GAME_DATA } from '../../data'
import { riverBrush, RIVERS } from './geo'
import { CloudBand } from './seam'

const CITY = new Map(GAME_DATA.cities.map((c) => [c.id, c]))
const MAP = { x: 90, y: -30, w: 800, h: 820 }
const MIN_W = 150
const MAX_W = 900

interface VB { x: number; y: number; w: number }

export interface MapProps {
  state: WorldState
  factionColor: (id: string | null) => number | null
  selected: string | null
  travelTo: Set<string>
  onSelect: (id: string | null) => void
}


export function MapView({ state, factionColor, selected, travelTo, onSelect }: MapProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState({ w: 800, h: 600 })
  const player = state.officers[state.player]
  const home = player?.city ? CITY.get(player.city) : undefined
  const [vb, setVb] = useState<VB>(() => ({ x: (home?.x ?? 450) - 320, y: (home?.y ?? 350) - 240, w: 640 }))
  const vbRef = useRef(vb)
  vbRef.current = vb
  const boxRef = useRef(box)
  boxRef.current = box

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(() => setBox({ w: Math.max(1, el.clientWidth), h: Math.max(1, el.clientHeight) }))
    ro.observe(el)
    setBox({ w: Math.max(1, el.clientWidth), h: Math.max(1, el.clientHeight) })
    return () => ro.disconnect()
  }, [])

  const aspect = box.h / box.w
  const vh = vb.w * aspect

  // centre on the player's city when it changes (travel, new game)
  const lastCity = useRef<string | null>(null)
  useEffect(() => {
    const c = player?.city ?? null
    if (c && c !== lastCity.current) {
      lastCity.current = c
      const d = CITY.get(c)
      if (d) setVb((v) => ({ ...v, x: d.x - v.w / 2, y: d.y - (v.w * boxRef.current.h) / boxRef.current.w / 2 }))
    }
  }, [player?.city])

  const clampVb = (v: VB): VB => {
    const w = Math.min(MAX_W, Math.max(MIN_W, v.w))
    const h = w * (boxRef.current.h / boxRef.current.w)
    return { w, x: Math.min(MAP.x + MAP.w - w * 0.25, Math.max(MAP.x - w * 0.75, v.x)), y: Math.min(MAP.y + MAP.h - h * 0.25, Math.max(MAP.y - h * 0.75, v.y)) }
  }

  const ptrs = useRef(new Map<number, { x: number; y: number }>())
  const gesture = useRef<{ moved: boolean; startTarget: Element | null; dist: number; downAt: { x: number; y: number } } | null>(null)

  const zoomAt = (clientX: number, clientY: number, factor: number): void => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const v = vbRef.current
    const fx = (clientX - r.left) / r.width
    const fy = (clientY - r.top) / r.height
    const nw = Math.min(MAX_W, Math.max(MIN_W, v.w * factor))
    const h = v.w * (r.height / r.width)
    const nh = nw * (r.height / r.width)
    setVb(clampVb({ w: nw, x: v.x + fx * (v.w - nw), y: v.y + fy * (h - nh) }))
  }

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onWheel = (e: WheelEvent): void => {
      e.preventDefault()
      zoomAt(e.clientX, e.clientY, Math.exp(e.deltaY * 0.0015))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  })

  const onDown = (e: React.PointerEvent): void => {
    if ((e.target as Element).closest?.('button')) return
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
    if (ptrs.current.size === 1) gesture.current = { moved: false, startTarget: e.target as Element, dist: 0, downAt: { x: e.clientX, y: e.clientY } }
    else {
      const [a, b] = [...ptrs.current.values()]
      if (gesture.current && a && b) { gesture.current.moved = true; gesture.current.dist = Math.hypot(a.x - b.x, a.y - b.y) }
    }
  }
  const onMove = (e: React.PointerEvent): void => {
    const prev = ptrs.current.get(e.pointerId)
    if (!prev || !gesture.current) return
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (ptrs.current.size >= 2) {
      const [a, b] = [...ptrs.current.values()]
      if (!a || !b) return
      const d = Math.hypot(a.x - b.x, a.y - b.y)
      if (gesture.current.dist > 0 && d > 0) zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, gesture.current.dist / d)
      gesture.current.dist = d
      return
    }
    const dxPx = e.clientX - prev.x
    const dyPx = e.clientY - prev.y
    if (!gesture.current.moved && Math.hypot(e.clientX - gesture.current.downAt.x, e.clientY - gesture.current.downAt.y) < 6) return
    gesture.current.moved = true
    const v = vbRef.current
    const k = v.w / r.width
    setVb(clampVb({ ...v, x: v.x - dxPx * k, y: v.y - dyPx * k }))
  }
  const onUp = (e: React.PointerEvent): void => {
    ptrs.current.delete(e.pointerId)
    const g = gesture.current
    if (ptrs.current.size === 0 && g) {
      if (!g.moved) {
        const hit = g.startTarget?.closest?.('[data-city]')
        onSelect(hit ? hit.getAttribute('data-city') : null)
      }
      gesture.current = null
    }
  }

  const pops = useMemo(() => Object.values(state.cities).map((c) => c.population), [state.cities])
  const popMax = Math.max(...pops, 1)
  const zoomedIn = vb.w < 460
  const veryIn = vb.w < 300

  return (
    <div ref={ref} className="mapwrap" data-testid="map" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
      <svg viewBox={`${vb.x} ${vb.y} ${vb.w} ${vh}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Map of the realm">
        <defs>
          <filter id="brush"><feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="2" seed="3" result="n" /><feDisplacementMap in="SourceGraphic" in2="n" scale="3" /></filter>
        </defs>
        {/* the tray and its cloud-scroll rim */}
        <rect x={MAP.x} y={MAP.y} width={MAP.w} height={MAP.h} rx="18" fill="#151110" stroke="#3a2a22" strokeWidth="2" />
        <rect x={MAP.x + 8} y={MAP.y + 8} width={MAP.w - 16} height={MAP.h - 16} rx="12" fill="none" stroke="var(--red-lacquer)" strokeWidth="1.5" />
        <g style={{ color: 'var(--vermilion)' }} opacity="0.8">
          <svg x={MAP.x + 14} y={MAP.y + 12} width={MAP.w - 28} height="14"><CloudBand height={14} /></svg>
          <svg x={MAP.x + 14} y={MAP.y + MAP.h - 26} width={MAP.w - 28} height="14" style={{ transform: 'scaleY(-1)', transformOrigin: 'center', transformBox: 'fill-box' }}><CloudBand height={14} /></svg>
        </g>
        {/* rivers: ochre brush */}
        <g fill="none" stroke="var(--ochre)" strokeLinecap="round" strokeLinejoin="round" opacity="0.55" filter="url(#brush)">
          {RIVERS.map((r) => <path key={r.id} d={riverBrush(r)} strokeWidth={r.width} />)}
        </g>
        {/* roads */}
        <g>
          {GAME_DATA.roads.map((r) => {
            const a = CITY.get(r.a)
            const b = CITY.get(r.b)
            if (!a || !b) return null
            const near = player?.city === r.a || player?.city === r.b
            return (
              <g key={r.a + r.b}>
                <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="var(--vermilion)" strokeWidth={near ? 1.6 : 0.9} opacity={near ? 0.95 : 0.5} />
                {(zoomedIn || near) && <text className="roaddays" x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 + 2} textAnchor="middle" fontSize={veryIn ? 6 : 7}>{r.days}</text>}
              </g>
            )
          })}
        </g>
        {/* armies on the march */}
        <g>
          {state.armies.map((ar) => {
            const a = CITY.get(ar.from)
            const b = CITY.get(ar.to)
            if (!a || !b) return null
            const col = ar.faction && state.factions[ar.faction] ? `var(--f-${state.factions[ar.faction]!.color})` : 'var(--vermilion)'
            const dx = b.x - a.x
            const dy = b.y - a.y
            const len = Math.hypot(dx, dy) || 1
            const ux = dx / len
            const uy = dy / len
            const sx = a.x + ux * 14
            const sy = a.y + uy * 14
            const ex = b.x - ux * 16
            const ey = b.y - uy * 16
            return (
              <g key={ar.id} data-army={ar.id}>
                <line x1={sx} y1={sy} x2={ex} y2={ey} stroke={col} strokeWidth="3" strokeDasharray={ar.uprising ? '4 3' : undefined} />
                <path d={`M${ex} ${ey} l${-ux * 8 - uy * 5} ${-uy * 8 + ux * 5} l${uy * 10} ${-ux * 10} z`} fill={col} />
              </g>
            )
          })}
        </g>
        {/* cities: bronze mirrors with faction inlay rings */}
        {GAME_DATA.cities.map((d) => {
          const c = state.cities[d.id]
          if (!c) return null
          const r = 5 + 6 * Math.sqrt(c.population / popMax)
          const col = c.faction ? factionColor(c.faction) : null
          const sel = selected === d.id
          const trav = travelTo.has(d.id)
          const showName = zoomedIn || c.population > popMax * 0.35 || sel
          return (
            <g key={d.id} className="city-g" data-city={d.id} transform={`translate(${d.x} ${d.y})`} data-faction={c.faction ?? ''}>
              <circle r={r + 7} fill="transparent" />
              {col ? <circle r={r + 1.5} fill="none" stroke={`var(--f-${col})`} strokeWidth="3.4" /> : null}
              <circle r={r - 1} fill="var(--bronze-face)" stroke="#3b2a18" strokeWidth="0.8" />
              <circle r={r - 1.6} fill="none" stroke="#6a5530" strokeWidth="1.8" strokeDasharray="1.1 1.1" />
              <circle r={r * 0.55} fill="none" stroke="#8d7440" strokeWidth="0.6" />
              <circle r={Math.max(1.6, r * 0.2)} fill="#6a5530" />
              {sel && <circle r={r + 5} fill="none" stroke="var(--vermilion)" strokeWidth="1.8" />}
              {trav && !sel && <circle r={r + 5} fill="none" stroke="var(--vermilion)" strokeWidth="1.3" strokeDasharray="3 2.5" />}
              {showName && <text className="cityname" y={r + 9} textAnchor="middle" fontSize={veryIn ? 7 : 8.5}>{d.name}</text>}
            </g>
          )
        })}
        {/* the player's token */}
        {home && (
          <g transform={`translate(${home.x} ${home.y - 20})`} data-testid="player-token" pointerEvents="none">
            <path d="M0 11 L-6 0 A7 7 0 1 1 6 0 Z" fill="var(--vermilion)" stroke="var(--ochre)" strokeWidth="1.2" />
            <circle cy="-3.5" r="2.4" fill="var(--ochre)" />
          </g>
        )}
      </svg>
      <div style={{ position: 'absolute', left: 8, bottom: 8, display: 'flex', gap: 6 }}>
        <button className="lbtn small" aria-label="Zoom in" onClick={() => { const r = ref.current?.getBoundingClientRect(); if (r) zoomAt(r.left + r.width / 2, r.top + r.height / 2, 0.7) }}>+</button>
        <button className="lbtn small" aria-label="Zoom out" onClick={() => { const r = ref.current?.getBoundingClientRect(); if (r) zoomAt(r.left + r.width / 2, r.top + r.height / 2, 1.4) }}>-</button>
      </div>
    </div>
  )
}
