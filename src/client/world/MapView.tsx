// The lacquer tray: SVG in the data's map units. Pan (one finger / drag), pinch, wheel zoom.
import { memo, useEffect, useMemo, useRef, useState } from 'react'
import type { WorldState } from '../../contracts/world'
import { GAME_DATA } from '../../data'
import { placeLabels, rangeTufts, RANGES, riverBrush, RIVERS } from './geo'
import { CloudBand } from './seam'

const TUFTS = RANGES.flatMap((r) => rangeTufts(r))
const RIVER_PATHS = RIVERS.map((r) => ({ id: r.id, width: r.width, d: riverBrush(r) }))
const CITY = new Map(GAME_DATA.cities.map((c) => [c.id, c]))
const MAP = { x: 90, y: -30, w: 800, h: 820 }
const MIN_W = 150
const MAX_W = 1700
/** Level of detail from the viewBox width: 0 far, 1 zoomed in (names, road days), 2 very close (smaller type). */
const lodOf = (w: number): number => (w < 300 ? 2 : w < 640 ? 1 : 0)

interface VB { x: number; y: number; w: number }

export interface MapProps {
  state: WorldState
  factionColor: (id: string | null) => number | null
  selected: string | null
  travelTo: Set<string>
  onSelect: (id: string | null) => void
}


/** The tray, its cloud-scroll rim, the faint ranges and the ochre rivers: static, so one memoised element for the life of the map. */
const Backdrop = memo(function Backdrop() {
  return (
    <>
      {/* the tray and its cloud-scroll rim */}
        <rect x={MAP.x} y={MAP.y} width={MAP.w} height={MAP.h} rx="18" fill="#151110" stroke="#3a2a22" strokeWidth="2" />
        <rect x={MAP.x + 8} y={MAP.y + 8} width={MAP.w - 16} height={MAP.h - 16} rx="12" fill="none" stroke="var(--red-lacquer)" strokeWidth="1.5" />
        <g style={{ color: 'var(--vermilion)' }} opacity="0.8">
          <svg x={MAP.x + 14} y={MAP.y + 12} width={MAP.w - 28} height="14"><CloudBand height={14} /></svg>
          <svg x={MAP.x + 14} y={MAP.y + MAP.h - 26} width={MAP.w - 28} height="14" style={{ transform: 'scaleY(-1)', transformOrigin: 'center', transformBox: 'fill-box' }}><CloudBand height={14} /></svg>
        </g>
        {/* mountain ranges (approximate): faint cloud-scroll hatching */}
        <g fill="none" stroke="var(--dust)" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.28" pointerEvents="none" data-testid="ranges">
          {TUFTS.map((u, i) => <path key={i} d="M0 12 H2 Q7 12 9 8 Q11 3 16 4 Q20 5 19 8.5 Q18 11 14.8 10.2 Q12.8 9.4 14 8" transform={`translate(${u.x.toFixed(1)} ${u.y.toFixed(1)}) rotate(${u.angle.toFixed(0)}) scale(0.5) translate(-11 -8)`} />)}
        </g>
        {/* rivers: ochre brush */}
        <g fill="none" stroke="var(--ochre)" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.55">
          {RIVER_PATHS.map((r) => <path key={r.id} d={r.d} strokeWidth={r.width} />)}
        </g>
    </>
  )
})

/** Roads and their day counts. Re-renders only when the player's city or the zoom detail changes. */
const Roads = memo(function Roads({ playerCity, zoomedIn, veryIn }: { playerCity: string | null; zoomedIn: boolean; veryIn: boolean }) {
  return (
    <g>
      {GAME_DATA.roads.map((r) => {
        const a = CITY.get(r.a)
        const b = CITY.get(r.b)
        if (!a || !b) return null
        const near = playerCity === r.a || playerCity === r.b
        return (
          <g key={r.a + r.b}>
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="var(--vermilion)" strokeWidth={near ? 1.6 : 0.9} opacity={near ? 0.95 : 0.5} />
            {(zoomedIn || near) && <text className="roaddays" x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 + 2} textAnchor="middle" fontSize={veryIn ? 5.5 : 6.2}>{r.days}</text>}
          </g>
        )
      })}
    </g>
  )
})

interface CityMirrorProps { id: string; name: string; x: number; y: number; r: number; faction: string | null; color: number | null; sel: boolean; trav: boolean; dx: number; dy: number; anchor: 'start' | 'middle' | 'end'; showName: boolean; fs: number }
/** One city: a bronze mirror with its faction inlay ring and name. Memoised on primitives so a selection redraws two, not 48. */
const CityMirror = memo(function CityMirror({ id, name, x, y, r, faction, color, sel, trav, dx, dy, anchor, showName, fs }: CityMirrorProps) {
  return (
    <g className="city-g" data-city={id} transform={`translate(${x} ${y})`} data-faction={faction ?? ''}>
      <circle r={r + 7} fill="transparent" />
      {color ? <circle r={r + 1.5} fill="none" stroke={`var(--f-${color})`} strokeWidth="3.4" /> : null}
      <circle r={r - 1} fill="var(--bronze-face)" stroke="#3b2a18" strokeWidth="0.8" />
      <circle r={r - 1.6} fill="none" stroke="#6a5530" strokeWidth="1.8" strokeDasharray="1.1 1.1" />
      <circle r={r * 0.55} fill="none" stroke="#8d7440" strokeWidth="0.6" />
      <circle r={Math.max(1.6, r * 0.2)} fill="#6a5530" />
      {sel && <circle r={r + 5} fill="none" stroke="var(--vermilion)" strokeWidth="1.8" />}
      {trav && !sel && <circle r={r + 5} fill="none" stroke="var(--vermilion)" strokeWidth="1.3" strokeDasharray="3 2.5" />}
      {showName && <text className="cityname" x={dx} y={dy} textAnchor={anchor} fontSize={fs}>{name}</text>}
    </g>
  )
})

export function MapView({ state, factionColor, selected, travelTo, onSelect }: MapProps) {
  const ref = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const player = state.officers[state.player]
  const home = player?.city ? CITY.get(player.city) : undefined
  // The view lives in refs, not React state: a pan or pinch writes the viewBox attribute straight to the <svg> (at most once
  // per frame) so the map's ~1000 nodes are not re-rendered or diffed per pointer move. Only the zoom level of detail
  // (`lod`: 0 far, 1 zoomed in, 2 very close) is state, because labels and road days depend on it.
  const vbRef = useRef<VB>({ x: MAP.x - 20, y: MAP.y - 20, w: MAP.w + 40 })
  const boxRef = useRef({ w: 800, h: 600 })
  const rectRef = useRef<DOMRect | null>(null)
  const worldRef = useRef<SVGGElement>(null)
  const boxKey = useRef('')
  const lodRef = useRef(lodOf(vbRef.current.w))
  const [lod, setLod] = useState(lodRef.current)
  const paintRaf = useRef(0)
  const paint = (): void => {
    paintRaf.current = 0
    const v = vbRef.current
    const b = boxRef.current
    // The <svg> viewBox is the box in screen pixels and never changes while panning; the view is one matrix on the world group.
    // (A viewBox change re-lays-out every <text> in the map, about 1.4 ms desktop, 6+ ms on a phone, per frame; a translate
    // on a group costs 0.04 ms, and a scale 0.7 ms.)
    const key = `${b.w} ${b.h}`
    if (key !== boxKey.current) { boxKey.current = key; svgRef.current?.setAttribute('viewBox', `0 0 ${b.w} ${b.h}`) }
    const k = b.w / v.w
    worldRef.current?.setAttribute('transform', `matrix(${k} 0 0 ${k} ${-v.x * k} ${-v.y * k})`)
  }
  /** Set the view (map units: left, top, width). `now` paints at once (tweens already run inside a frame); otherwise one paint is coalesced per frame. */
  const setVb = (v: VB, now = false): void => {
    vbRef.current = v
    const l = lodOf(v.w)
    if (l !== lodRef.current) { lodRef.current = l; setLod(l) }
    if (now) { cancelAnimationFrame(paintRaf.current); paint() } else if (!paintRaf.current) paintRaf.current = requestAnimationFrame(paint)
  }

  const anim = useRef(0)
  const fitFor = (b: { w: number; h: number }): VB => {
    const w = Math.max(MAP.w + 40, ((MAP.h + 40) * b.w) / b.h)
    return { w, x: MAP.x + MAP.w / 2 - w / 2, y: MAP.y + MAP.h / 2 - (w * b.h) / b.w / 2 }
  }
  /** A comfortable zoom for this screen: about 2.2 screens of tray across. */
  const comfy = (b: { w: number; h: number }): number => Math.min(620, Math.max(250, b.w / 1.9))
  const flyTo = (cx: number, cy: number, w: number, instant = false): void => {
    cancelAnimationFrame(anim.current)
    const b = boxRef.current
    const to = (ww: number): VB => ({ w: ww, x: cx - ww / 2, y: cy - (ww * b.h) / b.w / 2 })
    const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
    if (instant || reduce) { setVb(to(w), true); return }
    const from = vbRef.current
    const fcx = from.x + from.w / 2
    const fcy = from.y + (from.w * b.h) / b.w / 2
    const t0 = performance.now()
    const tick = (now: number): void => {
      const k = Math.min(1, (now - t0) / 650)
      const e = k * k * (3 - 2 * k)
      // zoom geometrically so the move feels even
      const ww = from.w * Math.pow(w / from.w, e)
      setVb({ w: ww, x: fcx + (cx - fcx) * e - ww / 2, y: fcy + (cy - fcy) * e - (ww * b.h) / b.w / 2 }, true)
      if (k < 1) anim.current = requestAnimationFrame(tick)
    }
    anim.current = requestAnimationFrame(tick)
  }
  const framed = useRef(false)
  useEffect(() => () => { cancelAnimationFrame(anim.current); cancelAnimationFrame(paintRaf.current) }, [])
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = (): void => {
      const nb = { w: Math.max(1, el.clientWidth), h: Math.max(1, el.clientHeight) }
      boxRef.current = nb
      rectRef.current = el.getBoundingClientRect()
      if (!framed.current && el.clientWidth > 1 && el.clientHeight > 1) {
        // on open and on Continue: the whole tray, then in to the player's city
        framed.current = true
        setVb(fitFor(nb), true)
        const c = playerCityRef.current
        if (c) flyTo(c.x, c.y, comfy(nb))
      } else setVb(vbRef.current, true) // the aspect changed: repaint the same view
    }
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    measure()
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // centre on the player's city when it changes (travel)
  const playerCityRef = useRef(home)
  playerCityRef.current = home
  const lastCity = useRef<string | null>(player?.city ?? null)
  useEffect(() => {
    const c = player?.city ?? null
    if (c && c !== lastCity.current) {
      lastCity.current = c
      const d = CITY.get(c)
      if (d) flyTo(d.x, d.y, vbRef.current.w)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    const r = rectRef.current ?? el.getBoundingClientRect()
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
      cancelAnimationFrame(anim.current)
      rectRef.current = el.getBoundingClientRect()
      zoomAt(e.clientX, e.clientY, Math.exp(e.deltaY * 0.0015))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  })

  const onDown = (e: React.PointerEvent): void => {
    cancelAnimationFrame(anim.current)
    if ((e.target as Element).closest?.('button')) return
    if (ref.current) rectRef.current = ref.current.getBoundingClientRect()
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
    const r = rectRef.current ?? el.getBoundingClientRect()
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
  const zoomedIn = lod >= 1
  const veryIn = lod >= 2

  const fs = veryIn ? 7 : 8
  const radius = (id: string): number => 5 + 6 * Math.sqrt((state.cities[id]?.population ?? 0) / popMax)
  const nameShown = (id: string): boolean => zoomedIn || (state.cities[id]?.population ?? 0) > popMax * 0.35 || selected === id
  const labels = useMemo(() => {
    const items = GAME_DATA.cities.filter((d) => state.cities[d.id] && nameShown(d.id)).map((d) => ({
      id: d.id, x: d.x, y: d.y, r: radius(d.id) + 3.5, w: d.name.length * fs * 0.6 + 4, h: fs + 2, weight: (state.cities[d.id]?.population ?? 0) + (selected === d.id ? 1e9 : 0) + (home?.id === d.id ? 5e8 : 0),
    }))
    const circles = GAME_DATA.cities.filter((d) => state.cities[d.id]).map((d) => ({ x: d.x, y: d.y, r: radius(d.id) + 2 }))
    const tok = home ? [{ x: home.x + radius(home.id) + 1, y: home.y - radius(home.id) - 10, w: 14, h: 22 }] : []
    const days = GAME_DATA.roads.flatMap((r) => { const a = CITY.get(r.a); const b = CITY.get(r.b); return a && b ? [{ x: (a.x + b.x) / 2 - 5, y: (a.y + b.y) / 2 - 5, w: 10, h: 8 }] : [] })
    return placeLabels(items, circles, MAP, [...tok, ...days])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.cities, fs, zoomedIn, selected, home?.id])
  const homeR = home ? radius(home.id) : 0

  return (
    <div ref={ref} className="mapwrap" data-testid="map" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
      <svg ref={svgRef} viewBox="0 0 800 600" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Map of the realm">
        <g ref={worldRef} data-testid="map-world">
        <Backdrop />
        <Roads playerCity={player?.city ?? null} zoomedIn={zoomedIn} veryIn={veryIn} />
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
          const showName = zoomedIn || c.population > popMax * 0.35 || selected === d.id
          const lp = showName ? labels.get(d.id) ?? { dx: 0, dy: r + 9, anchor: 'middle' as const } : null
          return <CityMirror key={d.id} id={d.id} name={d.name} x={d.x} y={d.y} r={r} faction={c.faction} color={c.faction ? factionColor(c.faction) : null} sel={selected === d.id} trav={travelTo.has(d.id)} dx={lp?.dx ?? 0} dy={lp?.dy ?? 0} anchor={lp?.anchor ?? 'middle'} showName={showName} fs={fs} />
        })}
        {/* the player's token */}
        {home && (
          <g transform={`translate(${home.x + homeR + 1} ${home.y - homeR - 10})`} data-testid="player-token" pointerEvents="none">
            <path d="M0 11 L-6 0 A7 7 0 1 1 6 0 Z" fill="var(--vermilion)" stroke="var(--ochre)" strokeWidth="1.2" />
            <circle cy="-3.5" r="2.4" fill="var(--ochre)" />
          </g>
        )}
        </g>
      </svg>
      <div style={{ position: 'absolute', left: 8, bottom: 8, display: 'flex', gap: 6 }}>
        <button className="lbtn small" aria-label="Find me" data-testid="find-me" onClick={() => { if (home) flyTo(home.x, home.y, comfy(boxRef.current)) }}>Find me</button>
        <button className="lbtn small" aria-label="Zoom in" onClick={() => { const r = ref.current?.getBoundingClientRect(); if (r) zoomAt(r.left + r.width / 2, r.top + r.height / 2, 0.7) }}>+</button>
        <button className="lbtn small" aria-label="Zoom out" onClick={() => { const r = ref.current?.getBoundingClientRect(); if (r) zoomAt(r.left + r.width / 2, r.top + r.height / 2, 1.4) }}>-</button>
      </div>
    </div>
  )
}
