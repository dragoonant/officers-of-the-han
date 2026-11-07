// Public result types of the world engine's `query.*` (docs/spec/00-architecture.md "Queries the client needs at least").
import type { Aptitude, Post, Sex, Stats, Temperament, TroopType, YM } from '../contracts/data'
import type { ArmyUnit, CityFocus, Mission, OfficerStatus, WorldAction } from '../contracts/world'

export interface TieView {
  other: string
  name: string
  kind: 'oath' | 'spouse' | 'kin' | 'rival' | 'friend' | 'acquaintance'
  /** Friendship 0..100 (always present) */
  value: number
  note: string
}

export interface OfficerView {
  id: string
  name: string
  courtesy?: string
  portrait?: string
  sex: Sex
  born: number
  age: number
  stats: Stats
  xp: Stats
  temperament: Temperament
  aptitude: Record<TroopType, Aptitude>
  status: OfficerStatus
  post: Post
  rank: number
  rankName: string
  /** merit needed for the next rank (null at the top) */
  nextRankMerit: number | null
  troopCap: number
  salary: number
  faction: string | null
  factionName: string | null
  city: string | null
  cityName: string | null
  loyalty: number | null
  merit: number
  gold: number
  health: number
  days: number
  hidden: boolean
  mission: Mission | null
  missionText: string | null
  spouse: string | null
  oathGroup: string[] // the others in the oath group
  ties: TieView[]
  items: string[]
  isPlayer: boolean
}

export interface CityOfficerRow {
  id: string
  name: string
  post: Post
  rankName: string
  status: OfficerStatus
  faction: string | null
}

export interface CityView {
  id: string
  name: string
  province: string
  faction: string | null
  factionName: string | null
  prefect: string | null
  prefectName: string | null
  population: number
  farm: number
  farmMax: number
  trade: number
  tradeMax: number
  walls: number
  wallsMax: number
  order: number
  troops: number
  training: number
  gold: number
  rice: number
  focus: CityFocus
  officers: CityOfficerRow[] // active (non-hidden) officers present
  captives: CityOfficerRow[]
  neighbors: { id: string; name: string; days: number; terrain: string; faction: string | null }[]
  /** gold gained at the next month start (W-ECO-1) */
  incomeGold: number
  /** rice gained at the next harvest (W-ECO-2) */
  harvestRice: number
  /** rice paid per month (W-ECO-3) */
  upkeepRice: number
  defencePower: number
}

export interface FactionView {
  id: string
  name: string
  glyph: string
  color: number
  alive: boolean
  ruler: string
  rulerName: string
  capital: string
  cities: string[]
  officers: string[]
  totalTroops: number
  totalGold: number
  totalRice: number
  relations: { faction: string; name: string; value: number; pact: 'alliance' | 'truce' | null; until: YM | null }[]
}

export type ActionGroup = 'Work' | 'People' | 'Court' | 'Travel' | 'Self'

export interface ActionItem {
  group: ActionGroup
  kind: WorldAction['kind']
  label: string
  /** a canonical instance (a valid one when `available`) */
  action: WorldAction
  days: number
  gold: number
  available: boolean
  reason: string | null
  /** chance in percent for rolled actions, else null */
  chance: number | null
}

export interface ChanceInfo {
  pct: number
  /** what the number is the chance of */
  what: string
  /** second number for actions with two rolls (search: gold) */
  alt?: { pct: number; what: string }
}

export interface PowerInfo {
  power: number
  troops: number
  units: number
  breakdown: string
}

export interface MonthReportRow {
  ym: YM
  kind: string
  text: string
  officers: string[]
  city?: string
}

export interface SaveSummary {
  line: string
  ym: YM
  playerName: string
  factionName: string | null
  post: Post
  rankName: string
  cities: number
}

export interface CanResult {
  ok: boolean
  reason: string | null
  days: number
  gold: number
}

export interface CostInfo {
  days: number
  gold: number
}
