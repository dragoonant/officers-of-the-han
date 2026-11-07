// createBattle: field, deployment, morale, day-1 initiative.
import type { BattleSetup, BattleSide } from '../contracts/battle'
import { clamp, seedRng } from '../shared/rng'
import { ATTACKER_COLS, DEFENDER_COLS, KEEP_COL, KEEP_ROW, generateField } from './field'
import { FIELD_ROWS, offsetToAxial } from './hex'
import { checkEnd, advance, rollOrder } from './step'
import type { BattleEvent, BattleState, BUnit } from './types'

/** Deployment hexes for a side, best first (attackers: front column first; defenders: front column first, no keep). */
export function deployHexes(side: BattleSide): { q: number; r: number }[] {
  const cells: { col: number; row: number }[] = []
  const cols = side === 'attacker' ? [...ATTACKER_COLS].reverse() : DEFENDER_COLS
  for (const col of cols) {
    const rows = Array.from({ length: FIELD_ROWS }, (_, i) => i).sort((a, b) => Math.abs(a - KEEP_ROW) - Math.abs(b - KEEP_ROW) || a - b)
    for (const row of rows) {
      if (col === KEEP_COL && row === KEEP_ROW) continue
      cells.push({ col, row })
    }
  }
  return cells.map((c) => offsetToAxial(c.col, c.row))
}

export function createBattle(setup: BattleSetup): BattleState {
  const hexes = generateField(setup)
  const units: BUnit[] = []
  const seen = new Set<string>()
  for (const su of setup.units) {
    let id = su.officer.id
    for (let n = 2; seen.has(id); n++) id = `${su.officer.id}~${n}`
    seen.add(id)
    const tr = su.side === 'attacker' ? setup.attackerTraining : setup.defenderTraining
    const troops = Math.max(0, Math.floor(su.troops))
    units.push({
      id, officer: su.officer, side: su.side, type: su.type, commander: su.commander,
      troopsStart: troops, troops, morale: clamp(Math.floor(40 + tr / 2), 0, 100), health: su.officer.health,
      q: 0, r: 0, routed: troops <= 0, captured: false, slain: false, wounded: 0, merit: 0, kills: 0, duelWins: 0,
      moved: false, movedDist: 0, fromQ: 0, fromR: 0, acted: false, confused: false, taunted: null,
    })
  }
  // exactly one commander per side: keep the first flagged, else promote the best LDR
  for (const side of ['attacker', 'defender'] as const) {
    const mine = units.filter((u) => u.side === side)
    if (!mine.length) continue
    let cmd = mine.find((u) => u.commander)
    if (!cmd) cmd = mine.slice().sort((a, b) => b.officer.stats.ldr - a.officer.stats.ldr)[0]!
    for (const u of mine) u.commander = u === cmd
  }
  // deployment: archers to the rear (attackers) / the wall (defenders); the defender commander at the back
  for (const side of ['attacker', 'defender'] as const) {
    const spots = deployHexes(side)
    const mine = units.filter((u) => u.side === side && !u.routed)
    const rank = (u: BUnit): number => {
      if (side === 'attacker') return u.type === 'archer' ? 2 : u.commander ? 0.5 : 0
      return u.commander ? 3 : u.type === 'archer' ? 0 : 1
    }
    const ordered = mine.slice().sort((a, b) => rank(a) - rank(b))
    ordered.forEach((u, i) => {
      let spot = spots[i] ?? spots[spots.length - 1]!
      if (side === 'defender' && u.commander) {
        // back of the city, not on the keep
        spot = offsetToAxial(DEFENDER_COLS[DEFENDER_COLS.length - 1]!, KEEP_ROW - 1)
        if (ordered.some((o) => o !== u && o.q === spot.q && o.r === spot.r)) spot = spots[i] ?? spot
      }
      u.q = spot.q
      u.r = spot.r
    })
  }
  // resolve any accidental stack from the commander tweak
  const used = new Set<string>()
  for (const side of ['attacker', 'defender'] as const) {
    const spots = deployHexes(side)
    for (const u of units.filter((x) => x.side === side && !x.routed)) {
      let k = `${u.q},${u.r}`
      if (used.has(k)) {
        const free = spots.find((s) => !used.has(`${s.q},${s.r}`))
        if (free) { u.q = free.q; u.r = free.r; k = `${u.q},${u.r}` }
      }
      used.add(k)
    }
  }
  const player = units.find((u) => setup.playerControls.includes(u.officer.id))
  const state: BattleState = {
    setup, rng: seedRng(setup.seed), day: 1, hexes, units, order: [], cursor: 0, active: null,
    pendingDuel: null, duels: [], outcome: null, playerSide: player ? player.side : null, actionCount: 0,
  }
  const ev: BattleEvent[] = []
  state.order = rollOrder(state)
  ev.push({ kind: 'dayStart', day: 1, order: state.order.slice() })
  if (!checkEnd(state, ev, 'attacker')) advance(state, ev)
  return state
}
