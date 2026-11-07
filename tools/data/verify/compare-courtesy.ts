// Compares officers.json courtesy names with Wikipedia infobox/lead (docs/sources/bio) and the A-Z lists.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseAll } from './parse-lists'
const ROOT = join(import.meta.dirname, '..', '..', '..')
const off = JSON.parse(readFileSync(join(ROOT, 'src/data/officers.json'), 'utf8')) as any[]
const lists = parseAll()
const norm = (s: string) => s.toLowerCase().replace(/[^a-zü]/g, '')
for (const o of off) {
  const f = join(ROOT, 'docs/sources/bio', `${o.id}.wiki`)
  const t = existsSync(f) ? readFileSync(f, 'utf8') : ''
  const m = /courtesy name\W*'''([^']+)'''/i.exec(t)
  const fromBio = m?.[1]?.trim() ?? ''
  const fromList = lists.filter((r) => norm(r.name) === norm(o.name) && r.courtesy).map((r) => r.courtesy)
  const cands = [fromBio, ...fromList].filter(Boolean)
  const ours = o.courtesy ?? ''
  if (!cands.length) { if (ours) console.log(`UNVERIFIED ${o.id} ours "${ours}"`); continue }
  if (!ours) { console.log(`MISSING   ${o.id} ours "" sources ${cands.join(' | ')}`); continue }
  if (!cands.some((c) => norm(c).startsWith(norm(ours)) || norm(ours).startsWith(norm(c)) || norm(c.replace(/\s/g, '')) === norm(ours))) console.log(`DIFF      ${o.id} ours "${ours}" sources ${cands.join(' | ')}`)
}
