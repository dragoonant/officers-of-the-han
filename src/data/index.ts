// Typed loader for the shipped content (docs/spec/12-data.md). M0 stub: the M1 data agent fills the JSON files.
import type { CityDef, EventDef, GameData, OfficerDef, RoadDef, ScenarioDef } from '../contracts/data'
import cities from './cities.json'
import roads from './roads.json'
import officers from './officers.json'
import events from './events.json'
import genericPortraits from './generic-portraits.json'
import s190 from './scenarios/190.json'

export const GAME_DATA: GameData = {
  cities: cities as CityDef[],
  roads: roads as RoadDef[],
  officers: officers as OfficerDef[],
  events: events as EventDef[],
  scenarios: [s190 as ScenarioDef],
  genericPortraits: genericPortraits as string[],
}
