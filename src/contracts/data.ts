// FROZEN CONTRACT (M0, 2026-11-07). Content types for src/data/*.json (docs/spec/12-data.md).
// Changes go in docs/spec/00-architecture.md "Change log" and need the coordinator's ok.
// All data is plain JSON: no classes, functions or Maps.

export type Temperament = 'righteous' | 'ambitious' | 'cautious' | 'reckless' | 'steady'
export type TroopType = 'spear' | 'cavalry' | 'archer'
export type Aptitude = 'A' | 'B' | 'C'
export type RoadTerrain = 'plain' | 'hills' | 'mountain' | 'river' | 'marsh' | 'forest'
export type Post = 'ruler' | 'prefect' | 'officer' | 'wanderer'
export type Sex = 'm' | 'f'
export type StatKey = 'war' | 'ldr' | 'int' | 'pol' | 'cha'

export interface Stats {
  war: number
  ldr: number
  int: number
  pol: number
  cha: number
}

export interface CityDef {
  id: string // kebab-case, e.g. "luoyang"
  name: string // "Luoyang"
  province: string // "Sili"
  lat: number
  lon: number
  x: number // map units (12-data.md §4)
  y: number
  nudged?: boolean
  farmMax: number
  tradeMax: number
  wallsMax: number
  source: string
}

export interface RoadDef {
  a: string // city id
  b: string
  days: number // 5..25
  terrain: RoadTerrain
}

export interface KinDef {
  id: string
  role: 'parent' | 'child' | 'sibling' | 'spouse'
}

export interface OfficerDef {
  id: string // kebab-case pinyin, e.g. "zhang-fei"
  name: string // "Zhang Fei"
  courtesy?: string // "Yide"
  sex: Sex
  born: number
  died: number | null
  estimate?: boolean // birth/death years are estimates
  appears?: number // default born + 16 (W-OFF-6)
  stats: Stats
  temperament: Temperament
  aptitude: Record<TroopType, Aptitude>
  kin: KinDef[]
  portrait?: string // file name under public/portraits/ (no extension); else the medallion
  source: string
  basis: string // why these stats/dates (12-data.md §3)
}

/** Where an officer is at a scenario's start. Officers absent from this list have not appeared yet or are elsewhere by `appears`. */
export interface OfficerStart {
  id: string
  faction: string | null // null = wanderer
  city: string
  post: Post
  loyalty: number | null // null for rulers and wanderers
  merit: number
  gold: number
  hidden?: boolean // found by W-ACT-SEARCH
}

/** An officer who comes of age (or first appears) after the start. */
export interface OfficerAppearance {
  id: string
  year: number
  city: string
  faction: string | null // joins this faction if it still exists, else wanderer
  hidden?: boolean
}

export interface CityStart {
  id: string
  faction: string | null // null = vacant
  population: number
  farm: number
  trade: number
  walls: number
  order: number
  troops: number
  training: number
  gold: number
  rice: number
}

export interface FactionDef {
  id: string // usually the ruler's id prefixed "f-", e.g. "f-cao-cao"
  name: string // "Cao Cao"
  ruler: string
  capital: string
  color: number // 1..14 -> CSS --f-N (50-presentation.md)
  glyph: string // the surname character drawn on its banner disc, e.g. "曹"
}

export interface ScenarioDef {
  id: string // "190"
  name: string // "The Coalition against Dong Zhuo"
  year: number
  month: number
  blurb: string
  factions: FactionDef[]
  relations: { a: string; b: string; value: number }[]
  cities: CityStart[]
  officers: OfficerStart[]
  appearances: OfficerAppearance[]
  oaths: string[][]
  friendships: { a: string; b: string; value: number }[]
  rivals: [string, string][]
  flags: string[]
}

// ---- Events (docs/spec/40-events.md) ----
export interface YM {
  year: number
  month: number
}

export type EventCond =
  | { kind: 'officerAlive'; id: string }
  | { kind: 'officerDead'; id: string }
  | { kind: 'officerInFaction'; id: string; faction: string }
  | { kind: 'officerIsRuler'; id: string }
  | { kind: 'factionExists'; id: string }
  | { kind: 'factionHoldsCity'; faction: string; city: string }
  | { kind: 'flag'; id: string }
  | { kind: 'notFlag'; id: string }
  | { kind: 'date'; from?: YM; to?: YM }
  | { kind: 'relationBelow'; a: string; b: string; value: number }

export type EventEffect =
  | { kind: 'setFlag'; id: string }
  | { kind: 'moveOfficer'; id: string; city: string }
  | { kind: 'joinFaction'; id: string; faction: string; post?: Post }
  | { kind: 'makeWanderer'; id: string; city?: string }
  | { kind: 'killOfficer'; id: string }
  | { kind: 'transferCity'; city: string; faction: string }
  | { kind: 'moveCapital'; faction: string; city: string }
  | { kind: 'setRuler'; faction: string; id: string }
  | { kind: 'alliance'; factions: string[]; months: number }
  | { kind: 'endAlliance'; factions: string[] }
  | { kind: 'relation'; a: string; b: string; delta: number }
  | { kind: 'cityDelta'; city: string; field: 'population' | 'farm' | 'trade' | 'walls' | 'order' | 'troops' | 'gold' | 'rice'; delta: number }
  | { kind: 'friendship'; a: string; b: string; delta: number }
  | { kind: 'merit'; id: string; delta: number }
  | { kind: 'oath'; ids: string[] }
  | { kind: 'marry'; a: string; b: string }
  | { kind: 'item'; officer: string; item: string }

export interface EventOption {
  label: string // what the button says (names what it decides, KB rule 8)
  text: string // the result line
  effects: EventEffect[]
  contest?: { kind: 'duel' | 'debate'; a: string; b: string; onWin: EventEffect[]; onLoss: EventEffect[] } // a = the player's side
}

export interface EventDef {
  id: string
  title: string
  from: YM
  to: YM
  chance: number // 1..100 per month while open
  conditions: EventCond[]
  text: string // the letter, our own words
  effects: EventEffect[] // the historical course (applied when there is no choice, or with option 0)
  involves?: string[] // officer ids that get the choice when the player is one of them
  involvesFaction?: string[] // factions whose ruler (if the player) gets the choice
  options?: EventOption[] // option 0 = the historical course (its effects replace `effects` when chosen)
  major?: boolean // always sent to the player as a letter
  source: string
}

export interface GameData {
  cities: CityDef[]
  roads: RoadDef[]
  officers: OfficerDef[]
  events: EventDef[]
  scenarios: ScenarioDef[]
  genericPortraits: string[]
}
