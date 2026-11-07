// FROZEN CONTRACT (M0, 2026-11-07). World engine API, actions, pending decisions and the core state shape.
// docs/spec/00-architecture.md, docs/spec/10-rules.md. The world agent may ADD optional fields to the state
// interfaces (log them in 00-architecture.md "Change log"); renaming or removing needs the coordinator.
// WorldState is plain JSON (KB rule 22: the snapshot is what reopens).
import type { Post, StatKey, Stats, Temperament, TroopType, Aptitude, YM } from './data'
import type { BattleOutcome, BattleSetup } from './battle'
import type { DebateOutcome, DebateSetup, DuelOutcome, DuelSetup } from './contest'
import type { RngState } from '../shared/rng'

export type WorkKind = 'farm' | 'trade' | 'walls' | 'order' | 'train' | 'draft'
export type CityFocus = 'balanced' | 'farm' | 'trade' | 'military' | 'defense'
export type DiploKind = 'alliance' | 'truce' | 'surrender'
export type Rank = 0 | 1 | 2 | 3 | 4 // Attendant, Captain, Colonel, General, Grand General (W-OFF-4)

export type Mission =
  | { kind: 'develop'; city: string; work: WorkKind; count: number; done: number; deadline: YM }
  | { kind: 'recruit'; officer: string; deadline: YM }
  | { kind: 'scout'; city: string; reached: boolean; deadline: YM }
  | { kind: 'envoy'; faction: string; proposal: DiploKind; deadline: YM }

export type OfficerStatus = 'unborn' | 'active' | 'army' | 'captive' | 'dead'

export interface OfficerState {
  id: string
  /** Created officers carry their full definition here; historical ones read src/data. */
  custom?: {
    name: string
    sex: 'm' | 'f'
    born: number
    temperament: Temperament
    aptitude: Record<TroopType, Aptitude>
    portrait?: string
  }
  status: OfficerStatus
  stats: Stats // live stats (growth applied)
  xp: Stats
  faction: string | null
  city: string | null // where they are (captive: the holding city; army: the source city)
  post: Post
  loyalty: number | null
  merit: number
  gold: number
  health: number
  days: number // left this month (W-TIME-2)
  hidden: boolean
  mission: Mission | null
  spouse: string | null
  oathGroup: number | null // index into WorldState.oaths
  deathYM: YM | null // W-DEATH-1
  visitedThisMonth: string[] // W-ACT-VISIT once per pair per month
  proposedThisMonth: boolean // W-PROP-1
  items: string[]
}

export interface CityState {
  id: string
  faction: string | null
  prefect: string | null
  population: number
  farm: number
  trade: number
  walls: number
  order: number
  troops: number
  training: number
  gold: number
  rice: number
  focus: CityFocus
}

export interface FactionState {
  id: string
  name: string
  ruler: string
  capital: string
  color: number
  glyph: string
  alive: boolean
}

export interface Pact {
  a: string
  b: string
  kind: 'alliance' | 'truce'
  until: YM
}

export interface ArmyUnit {
  officer: string
  troops: number
  type: TroopType
  commander: boolean
}

export interface Army {
  id: string
  faction: string | null // null: an uprising's rebels
  from: string
  to: string
  units: ArmyUnit[]
  rice: number
  uprising?: boolean
}

/** Decisions the player must make before anything else (legalActions offers only their answers). */
export type Pending =
  | { kind: 'letter'; id: string; title: string; text: string } // acknowledge only
  | { kind: 'eventChoice'; id: string; eventId: string; title: string; text: string; options: { label: string }[] }
  | { kind: 'offer'; id: string; from: string; offer: 'recruit' | 'oath' | 'marry' | 'mission'; text: string; mission?: Mission }
  | { kind: 'captured'; id: string; captor: string; canJoin: boolean; text: string }
  | { kind: 'chooseDefenders'; id: string; armyId: string; city: string; max: number; candidates: string[] }
  | { kind: 'battle'; id: string; armyId: string; setup: BattleSetup }
  | { kind: 'duel'; id: string; setup: DuelSetup; context: 'challenge' | 'event' }
  | { kind: 'debate'; id: string; setup: DebateSetup; context: 'recruit' | 'diplomacy' | 'event' }
  | { kind: 'chooseSuccessor'; id: string; candidates: string[] }

export interface LogEntry {
  ym: YM
  kind: string // e.g. 'work', 'travel', 'battle', 'death', 'event', 'oath', 'join', 'defect', 'capture'
  text: string // the player-facing line (every kind has one: a test enforces it)
  officers: string[]
  city?: string
}

export type EndKind = 'unified' | 'another-unified' | 'chronicle-closes'

export interface WorldOptions {
  lifespans: boolean // W-DEATH-1
  events: boolean // W-EVT-1
}

export interface WorldState {
  version: 1
  scenario: string
  ym: YM
  phase: 'player' | 'world' | 'ended'
  /** Resumable month-end cursor (the pipeline pauses on a pending battle/duel/debate and resumes on its answer). */
  cursor: { stage: string; index: number } | null
  rng: RngState
  seed: number
  options: WorldOptions
  player: string // the officer the player plays (changes on succession)
  cities: Record<string, CityState>
  officers: Record<string, OfficerState>
  factions: Record<string, FactionState>
  relations: Record<string, number> // key "a|b" with a < b
  friendships: Record<string, number> // key "a|b" with a < b; missing = 20 (W-TIE-1)
  rivals: string[] // keys "a|b"
  oaths: string[][]
  pacts: Pact[]
  armies: Army[]
  flags: string[]
  firedEvents: string[]
  pending: Pending[]
  log: LogEntry[]
  ended: { kind: EndKind; faction: string | null } | null
  nextId: number // for armies, pendings, battle ids
}

export interface NewGameOptions {
  scenario: string // "190"
  seed: number
  officer: string | CreatedOfficer
  options?: Partial<WorldOptions>
}

export interface CreatedOfficer {
  name: string
  sex: 'm' | 'f'
  born: number // 150..174 (W-NEW-1)
  stats: Stats // 20..95 each, sum <= 320
  temperament: Temperament
  bestType: TroopType // aptitude A; others B
  portrait?: string
  city: string
}

export type WorldAction =
  // pending answers
  | { kind: 'ack'; pending: string }
  | { kind: 'choose'; pending: string; option: number }
  | { kind: 'answerOffer'; pending: string; accept: boolean }
  | { kind: 'answerCaptured'; pending: string; join: boolean }
  | { kind: 'setDefenders'; pending: string; officers: string[] }
  | { kind: 'resolveBattle'; pending: string; outcome: BattleOutcome }
  | { kind: 'resolveDuel'; pending: string; outcome: DuelOutcome }
  | { kind: 'resolveDebate'; pending: string; outcome: DebateOutcome }
  | { kind: 'chooseSuccessor'; pending: string; officer: string }
  // city work (W-WORK-*)
  | { kind: 'work'; work: WorkKind }
  // personal (W-ACT-*)
  | { kind: 'travel'; to: string }
  | { kind: 'visit'; officer: string }
  | { kind: 'banquet' }
  | { kind: 'gift'; officer: string; gold: number; fromCity?: boolean }
  | { kind: 'search' }
  | { kind: 'study'; stat: Extract<StatKey, 'int' | 'pol'> }
  | { kind: 'drill'; stat: Extract<StatKey, 'war' | 'ldr'> }
  | { kind: 'rest' }
  | { kind: 'recruit'; officer: string; mode: 'persuade' | 'debate' }
  | { kind: 'serve' }
  | { kind: 'resign' }
  | { kind: 'challenge'; officer: string }
  | { kind: 'oath'; officer: string }
  | { kind: 'marry'; officer: string }
  | { kind: 'claim' }
  | { kind: 'uprise' }
  // court (W-CRT-*, W-PROP-1)
  | { kind: 'appoint'; officer: string }
  | { kind: 'transfer'; officer: string; to: string }
  | { kind: 'mission'; officer: string; mission: Mission }
  | { kind: 'transport'; from: string; to: string; gold: number; rice: number; troops: number }
  | { kind: 'war'; from: string; to: string; units: ArmyUnit[] }
  | { kind: 'diplomacy'; envoy: string; faction: string; proposal: DiploKind; mode: 'roll' | 'debate' }
  | { kind: 'captive'; officer: string; decision: 'recruit' | 'release' | 'execute' }
  | { kind: 'focus'; city: string; focus: CityFocus }
  | { kind: 'propose'; proposal: 'war' | 'alliance' | 'truce' | 'prefect'; to?: string; faction?: string; units?: ArmyUnit[] }
  // the month
  | { kind: 'endMonth' }

export type RejectCode = 'not-legal' | 'no-days' | 'no-gold' | 'pending-first' | 'bad-target' | 'ended' | 'bad-outcome'

export type WorldEvent = LogEntry

export type StepResult =
  | { ok: true; state: WorldState; events: WorldEvent[] }
  | { ok: false; code: RejectCode; message: string }

/** The world engine's public API (src/world/index.ts implements it). */
export interface WorldApi {
  newGame(opts: NewGameOptions): WorldState
  legalActions(state: WorldState): WorldAction[] // never empty unless state.ended
  step(state: WorldState, action: WorldAction): StepResult // never throws
  replay(opts: NewGameOptions, actions: WorldAction[]): WorldState
}
