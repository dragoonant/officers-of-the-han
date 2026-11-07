import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ACESFilmicToneMapping, PCFShadowMap, SRGBColorSpace } from 'three'
import { query, type BattleState } from '../../battle'
import type { BattleOutcome, BattleSetup } from '../../contracts/battle'
import type { DuelSetup } from '../../contracts/contest'
import { DuelScreen } from '../contests/DuelScreen'
import { CameraRig, viewApi } from './CameraRig'
import { BeatFx, Floaters, Flames } from './Effects'
import { Figure } from './Figures'
import { ActionBar, CardPanel, Controls, EndBanner, Feed, Initiative, LogDrawer, Ticker } from './Hud'
import { LacquerBox } from '../ui'
import { Terrain } from './Terrain'
import { Marks } from './Marks'
import { sidePigments } from './layout'
import { computeMarks } from './marks'
import { useAudioScene } from '../audio/scene'
import { disposeBattle, hoverTile, initBattle, resolveDuel, tapTile, useBattle } from './store'
import './battle.css'

const Q = new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search)
const PERF = Q.get('perf') === '1'
const PRESERVE = Q.get('preserve') === '1'
const AA = Q.get('aa') !== '0'

function isLowTier(): boolean {
  if (Q.get('q') === 'low') return true
  if (Q.get('q') === 'high') return false
  return typeof window !== 'undefined' && Math.min(window.innerWidth, window.innerHeight) < 600
}

function PerfHud() {
  const el = useRef<HTMLDivElement | null>(null)
  const acc = useRef({ n: 0, t: 0 })
  useFrame((_, dt) => {
    acc.current.n++
    acc.current.t += dt
    if (acc.current.t >= 1 && el.current) {
      el.current.textContent = `${(acc.current.n / acc.current.t).toFixed(1)} fps`
      acc.current = { n: 0, t: 0 }
    }
  })
  useEffect(() => {
    const d = document.createElement('div')
    d.className = 'perf'
    document.body.appendChild(d)
    el.current = d
    return () => d.remove()
  }, [])
  return null
}

function hexSig(hexes: { terrain: string; burn: number; gateHp: number }[]): string {
  let s = ''
  for (const h of hexes) s += h.terrain.charCodeAt(0) + (h.burn > 0 ? 'b' : '') + (h.gateHp > 0 ? 'g' : '') + ','
  return s
}

function Scene({ lowTier, pigments }: { lowTier: boolean; pigments: { attacker: string; defender: string } }) {
  const state = useBattle((s) => s.state)!
  const mode = useBattle((s) => s.mode)
  const selected = useBattle((s) => s.selected)
  const hover = useBattle((s) => s.hover)
  const playing = useBattle((s) => s.playing)
  const duelOpen = useBattle((s) => s.duelOpen)
  const ai = useBattle((s) => s.aiCommand)
  const sig = useBattle((s) => (s.pres ? hexSig(s.pres.hexes) : ''))
  const hexes = useMemo(() => useBattle.getState().pres!.hexes.map((h) => ({ ...h })), [sig]) // eslint-disable-line react-hooks/exhaustive-deps
  const three = useThree()
  if (typeof window !== 'undefined') (window as unknown as { __three?: unknown }).__three = three
  const au = query.activeUnit(state)
  const interactive = !!au && query.isPlayerUnit(state, au.id) && !ai && !playing && !duelOpen
  const marks = useMemo(() => computeMarks(state, mode, selected, hover, interactive), [state, mode, selected, hover, interactive])
  if (typeof window !== 'undefined') (window as unknown as { __marks?: unknown }).__marks = marks
  const onTap = useCallback((q: number, r: number) => {
    hoverTile(null)
    tapTile(q, r)
  }, [])
  const onHover = useCallback((q: number, r: number | null) => hoverTile(r === null ? null : { q, r }), [])
  const onLeave = useCallback(() => hoverTile(null), [])
  const onLong = useCallback((q: number, r: number) => {
    hoverTile({ q, r })
    useBattle.setState({ selected: useBattle.getState().state?.units.find((u) => !u.routed && u.q === q && u.r === r)?.id ?? null })
  }, [])
  return (
    <>
      <color attach="background" args={['#0f0c0b']} />
      <ambientLight intensity={0.75} color="#fff0da" />
      <hemisphereLight args={['#ffe9c8', '#1a1210', 0.55]} />
      <directionalLight
        position={[5, 12, 7]}
        intensity={2.1}
        color="#fff1dc"
        castShadow={!lowTier}
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={8}
        shadow-camera-bottom={-8}
        shadow-camera-near={1}
        shadow-camera-far={34}
        shadow-bias={-0.0006}
      />
      <Terrain hexes={hexes} />
      {state.units.map((u) => (
        <Figure key={u.id} unit={u} pigment={u.side === 'attacker' ? pigments.attacker : pigments.defender} lowTier={lowTier} />
      ))}
      <Marks marks={marks} />
      <Flames />
      <BeatFx />
      <Floaters />
      <CameraRig onTap={onTap} onHover={onHover} onLeave={onLeave} onLongPress={onLong} />
      {PERF && <PerfHud />}
    </>
  )
}

declare global {
  interface Window {
    __oth?: { store: typeof useBattle; view: typeof viewApi }
  }
}

/**
 * The hex battle (docs/spec/20-battle.md; presentation 50-presentation.md "Battle"). FROZEN SEAM for the world client:
 * `setup` starts a battle (or `initial` resumes one); `onChange` receives the engine state after every step; `onDone` is called once, with
 * `outcomeOf(state)`, when the player presses Continue on the end banner. The player's units are chosen by `setup.playerControls`; the rest are the AI.
 */
export function BattleScreen({ setup, initial, onChange, onDone }: { setup: BattleSetup; initial?: BattleState; onChange?: (s: BattleState) => void; onDone: (o: BattleOutcome) => void }) {
  const cbs = useRef({ onChange, onDone })
  cbs.current = { onChange, onDone }
  const [ready, setReady] = useState(false)
  const lowTier = useMemo(() => isLowTier(), [])
  useEffect(() => {
    initBattle(setup, initial, { onChange: (s) => cbs.current.onChange?.(s), onDone: (o) => cbs.current.onDone(o) })
    window.__oth = { store: useBattle, view: viewApi }
    setReady(true)
    return () => {
      disposeBattle()
      setReady(false)
    }
  }, [setup, initial])
  useAudioScene('battle') // after the init effect: the music must not read the last battle's result
  const pigments = useMemo(() => sidePigments(setup.attackerFaction, setup.defenderFaction), [setup])
  const state = useBattle((s) => s.state)
  const ended = useBattle((s) => s.ended)
  const duelOpen = useBattle((s) => s.duelOpen)
  const [logOpen, setLogOpen] = useState(false)
  const duelSetup = useMemo<DuelSetup | null>(() => {
    const p = state?.pendingDuel
    if (!p) return null
    const { challenger: _c, target: _t, ...rest } = p
    void _c
    void _t
    return rest
  }, [state?.pendingDuel])
  if (!ready || !state) return <div className="battle" />
  const outcome = ended && state.outcome ? state.outcome : null
  return (
    <div className="battle" data-testid="battle-screen" data-ended={ended ? '1' : '0'}>
      <Canvas
        shadows={lowTier ? false : { type: PCFShadowMap }}
        dpr={lowTier ? 1 : [1, 1.5]}
        camera={{ fov: 36, near: 0.3, far: 160, position: [0, 14, 14] }}
        gl={{ antialias: AA && !lowTier, preserveDrawingBuffer: PRESERVE, toneMapping: ACESFilmicToneMapping, outputColorSpace: SRGBColorSpace }}
        style={{ position: 'absolute', inset: 0 }}
      >
        <Scene lowTier={lowTier} pigments={pigments} />
      </Canvas>
      <div className="hud hud-top">
        <Initiative pigments={pigments} />
        <Controls onToggleLog={() => setLogOpen((o) => !o)} logOpen={logOpen} />
      </div>
      <div className="hud hud-side">
        <CardPanel pigments={pigments} />
        <LacquerBox title="Battle log"><Feed max={30} /></LacquerBox>
      </div>
      <div className="hud hud-bottom">
        <div className="card-phone"><CardPanel pigments={pigments} phone /></div>
        <Ticker />
        <ActionBar />
      </div>
      <LogDrawer open={logOpen} />
      {outcome && <EndBanner outcome={outcome} />}
      {duelOpen && duelSetup && (
        <div className="duel-overlay" data-testid="field-duel">
          <DuelScreen setup={duelSetup} onDone={resolveDuel} />
        </div>
      )}
    </div>
  )
}
