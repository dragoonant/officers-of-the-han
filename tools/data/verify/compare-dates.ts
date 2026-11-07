// Compares officers.json birth/death with (a) Wikipedia infobox in docs/sources/bio and (b) the A-Z list tables.
// Usage: npx tsx tools/data/verify/compare-dates.ts
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseAll } from './parse-lists'
const ROOT = join(import.meta.dirname, '..', '..', '..')
const off = JSON.parse(readFileSync(join(ROOT, 'src/data/officers.json'), 'utf8')) as any[]
const lists = parseAll()
const field = (t: string, k: string) => {
  const m = new RegExp(`^\\|\\s*${k}\\s*=\\s*(.*)$`, 'm').exec(t)
  if (!m) return ''
  return m[1]!.replace(/\{\{efn[\s\S]*$/, '').replace(/<ref[\s\S]*$/, '').replace(/<!--.*?-->/g, '').replace(/\{\{[^}]*\}\}/g, '').replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1').trim().slice(0, 60)
}
const year = (s: string) => { const m = /(?:^|[^\d])([12]\d\d)(?!\d)/.exec(s); return m ? +m[1]! : null }
for (const o of off) {
  const f = join(ROOT, 'docs/sources/bio', `${o.id}.wiki`)
  const t = existsSync(f) ? readFileSync(f, 'utf8') : ''
  const bi = field(t, 'birth_date') || field(t, 'birth_year'), de = field(t, 'death_date') || field(t, 'death_year')
  const by = year(bi), dy = year(de)
  const L = lists.filter((r) => r.name.toLowerCase() === o.name.toLowerCase() && (r.born || r.died) && (!o.courtesy || !r.courtesy || r.courtesy.toLowerCase().startsWith(o.courtesy.toLowerCase().slice(0, 4))))
  const lb = L[0]?.born ? +L[0].born : null, ld = L[0]?.died ? +L[0].died : null
  const ok = (a: number | null, b: number | null) => a == null || b == null || a === b
  const bad = !ok(by, o.born) || !ok(dy, o.died) || !ok(lb, o.born) || !ok(ld, o.died)
  const known = by != null || lb != null
  console.log(`${bad ? 'DIFF' : known ? 'ok  ' : 'none'} ${o.id.padEnd(16)} ours ${o.born}-${o.died}${o.estimate ? 'e' : ' '} | info "${bi}"~"${de}" | list ${L[0]?.born || '?'}-${L[0]?.died || '?'}`)
}
