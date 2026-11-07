// npm run validate:data: runs every check of docs/spec/12-data.md §6 against src/data/. Exit 1 on failure.
import { GAME_DATA } from '../src/data/index'
import { checkData } from './data/checks'

const errs = checkData(GAME_DATA)
if (errs.length) {
  console.error(`validate:data FAILED with ${errs.length} problem${errs.length === 1 ? '' : 's'}:`)
  for (const e of errs) console.error(`  - ${e}`)
  process.exit(1)
}
const d = GAME_DATA
const sc = d.scenarios[0]!
console.log(
  `validate:data ok: ${d.cities.length} cities, ${d.roads.length} roads, ${d.officers.length} officers (${sc.officers.length} at start, ${sc.appearances.length} later), ${d.events.length} events, ${sc.factions.length} factions, ${d.genericPortraits.length} generic portraits`,
)
