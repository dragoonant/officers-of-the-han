// Deterministic sample BattleSetups for tests and the bench (no Math.random). Not used by the engine itself.
import type { BattleOfficer, BattleSetup, BattleUnitSetup } from '../contracts/battle'
import type { Aptitude, RoadTerrain, Temperament, TroopType } from '../contracts/data'
import { nextFloat, seedRng, type RngState } from '../shared/rng'

export interface SampleOpts {
  seed: number
  terrain?: RoadTerrain
  walls?: number
  attackers?: number
  defenders?: number
  attackerTroops?: number // average per unit
  defenderTroops?: number
  playerControls?: string[]
  maxDays?: number
  training?: [number, number]
  statBias?: [number, number] // added to every stat of [attacker, defender]
}

const TERRAINS: RoadTerrain[] = ['plain', 'hills', 'mountain', 'river', 'marsh', 'forest']
const TEMPS: Temperament[] = ['righteous', 'ambitious', 'cautious', 'reckless', 'steady']
const TYPES: TroopType[] = ['spear', 'cavalry', 'archer']
const APTS: Aptitude[] = ['A', 'B', 'B', 'C']

function r(st: RngState, lo: number, hi: number): number {
  return lo + Math.floor(nextFloat(st) * (hi - lo + 1))
}

export function sampleOfficer(st: RngState, id: string, bias = 0): BattleOfficer {
  const s = (): number => Math.max(20, Math.min(100, r(st, 40, 92) + bias))
  return {
    id, name: id, stats: { war: s(), ldr: s(), int: s(), pol: s(), cha: s() },
    temperament: TEMPS[r(st, 0, 4)]!,
    aptitude: { spear: APTS[r(st, 0, 3)]!, cavalry: APTS[r(st, 0, 3)]!, archer: APTS[r(st, 0, 3)]! },
    health: r(st, 60, 100), oathGroup: [],
  }
}

export function sampleSetup(o: SampleOpts): BattleSetup {
  const st = seedRng(o.seed * 7919 + 13)
  const nA = o.attackers ?? r(st, 4, 8)
  const nD = o.defenders ?? r(st, 4, 8)
  const units: BattleUnitSetup[] = []
  const mk = (side: 'attacker' | 'defender', n: number, avg: number, bias: number): void => {
    for (let i = 0; i < n; i++) {
      const id = `${side[0]}${i}`
      const off = sampleOfficer(st, id, bias)
      units.push({
        officer: off, side, commander: i === 0,
        troops: Math.max(200, Math.floor(avg * (0.6 + 0.8 * nextFloat(st)))),
        type: TYPES[r(st, 0, 2)]!,
      })
    }
  }
  mk('attacker', nA, o.attackerTroops ?? r(st, 1500, 6000), o.statBias?.[0] ?? 0)
  mk('defender', nD, o.defenderTroops ?? r(st, 1500, 6000), o.statBias?.[1] ?? 0)
  // a couple of oath siblings per side
  for (const side of ['a', 'd']) {
    const ids = units.filter((u) => u.officer.id.startsWith(side)).map((u) => u.officer.id)
    if (ids.length >= 3) {
      const grp = ids.slice(0, 3)
      for (const u of units) if (grp.includes(u.officer.id)) u.officer.oathGroup = grp.filter((x) => x !== u.officer.id)
    }
  }
  return {
    id: `sample-${o.seed}`, seed: o.seed >>> 0, attackerFaction: 'f-a', defenderFaction: 'f-d', cityId: 'city', cityName: 'City',
    terrain: o.terrain ?? TERRAINS[r(st, 0, 5)]!, siege: true, walls: o.walls ?? r(st, 20, 120),
    attackerTraining: o.training?.[0] ?? r(st, 40, 90), defenderTraining: o.training?.[1] ?? r(st, 40, 90),
    maxDays: o.maxDays ?? 20, units, playerControls: o.playerControls ?? [],
  }
}
