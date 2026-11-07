// Generates src/data/*.json from the tables in tools/data/. Run: npx tsx tools/data/build.ts
import { copyFileSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Aptitude, OfficerDef, StatKey, Temperament } from '../../src/contracts/data'
import { buildCities, buildRoads } from './world'
import { ROWS_A, type Row } from './officers-a'
import { ROWS_B } from './officers-b'
import { ROWS_C } from './officers-c'
import { applyKin, buildScenario } from './scenario'
import { EVENTS } from './events'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const SRC_PORTRAITS = process.env.PORTRAIT_SRC ?? join(ROOT, '..', 'three-kingdoms-tactics', 'public', 'portraits')
const TEMP: Record<string, Temperament> = { R: 'righteous', A: 'ambitious', C: 'cautious', X: 'reckless', S: 'steady' }
const APT: Record<string, Aptitude> = { A: 'A', B: 'B', C: 'C' }
const TAGS: [StatKey, string, string][] = [
  ['war', 'WAR', 'no combat record; civil career (rubric: below 50 for civilians)'],
  ['ldr', 'LDR', 'never held an independent command (rubric: below 55)'],
  ['int', 'INT', 'shown as rash or easily fooled in the record (rubric)'],
  ['pol', 'POL', 'fighter only, no governing record (rubric: below 40)'],
  ['cha', 'CHA', 'disliked or unremarkable in the record (rubric: below 40)'],
]

const rows: Row[] = [...ROWS_A, ...ROWS_B, ...ROWS_C]
const ids = new Set<string>()
const officers: OfficerDef[] = []
const locs: { id: string; loc: string }[] = []

// Portraits available in the sibling game that are not historical officers of ours: the generic set.
const HISTORICAL_OTHERS = new Set(['cheng-yuanzhi', 'deng-mao', 'gong-jing', 'zhang-bao', 'zhang-liang'])
const portraitFiles = existsSync(SRC_PORTRAITS) ? readdirSync(SRC_PORTRAITS).filter((f) => f.endsWith('.webp')).map((f) => f.slice(0, -5)) : []
const outPortraits = join(ROOT, 'public', 'portraits')
mkdirSync(outPortraits, { recursive: true })

for (const [id, name, courtesy, sex, born, died, flags, [war, ldr, int, pol, cha], temp, apt, source, basisText, loc] of rows) {
  if (ids.has(id)) throw new Error(`duplicate officer ${id}`)
  ids.add(id)
  const stats = { war, ldr, int, pol, cha }
  const segs = basisText.split(';').map((s) => s.trim()).filter(Boolean)
  for (const [k, tag, why] of TAGS) {
    const v = stats[k]
    if (v <= 30 && !segs.some((s) => s.includes(tag))) segs.push(`${tag} ${v}: ${why}`)
  }
  const def: OfficerDef = {
    id, name, sex, born, died,
    stats,
    temperament: TEMP[temp]!,
    aptitude: { spear: APT[apt[0]!]!, cavalry: APT[apt[1]!]!, archer: APT[apt[2]!]! },
    kin: [],
    source,
    basis: segs.join('; '),
  }
  if (courtesy) def.courtesy = courtesy
  if (flags.includes('e')) def.estimate = true
  const app = /^@(\d+) /.exec(loc)
  if (app && Number(app[1]) !== born + 16) def.appears = Number(app[1])
  if (portraitFiles.includes(id)) {
    def.portrait = id
    copyFileSync(join(SRC_PORTRAITS, `${id}.webp`), join(outPortraits, `${id}.webp`))
  }
  officers.push(def)
  locs.push({ id, loc })
}
applyKin(officers)

const cities = buildCities()
const roads = buildRoads(cities)
const scenario = buildScenario(cities, roads, officers, locs)

// Generic portraits: every sibling-game portrait that is not one of our historical officers.
const generic = portraitFiles.filter((p) => !ids.has(p) && !HISTORICAL_OTHERS.has(p)).sort()
for (const g of generic) copyFileSync(join(SRC_PORTRAITS, `${g}.webp`), join(outPortraits, `${g}.webp`))

const out = (p: string, v: unknown) => {
  const full = join(ROOT, 'src', 'data', p)
  mkdirSync(dirname(full), { recursive: true })
  writeFileSync(full, JSON.stringify(v, null, 1) + '\n')
}
out('cities.json', cities)
out('roads.json', roads)
out('officers.json', officers)
out('events.json', EVENTS)
out('generic-portraits.json', generic)
out('scenarios/190.json', scenario)
console.log(`cities ${cities.length}, roads ${roads.length}, officers ${officers.length} (start ${scenario.officers.length}, appear ${scenario.appearances.length}, hidden ${scenario.officers.filter((o) => o.hidden).length + scenario.appearances.filter((o) => o.hidden).length}), events ${EVENTS.length}, factions ${scenario.factions.length}, portraits ${officers.filter((o) => o.portrait).length} + ${generic.length} generic`)
