// Parses docs/sources/list-*.wiki (Wikipedia "List of people of the Three Kingdoms (A-Z)") and compares with src/data/officers.json.
// Usage: npx tsx tools/data/verify/parse-lists.ts [--json]
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
const ROOT = join(import.meta.dirname, '..', '..', '..')
const dir = join(ROOT, 'docs', 'sources')
export type Row = { name: string; courtesy: string; born: string; died: string; role: string; alleg: string; prev: string; notes: string }
const strip = (s: string) => s.replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1').replace(/<br\s*\/?>.*$/s, '').replace(/&ndash;/g, '-').replace(/\{\{[^}]*\}\}/g, '').trim()
export function parseAll(): Row[] {
  const rows: Row[] = []
  for (const f of readdirSync(dir).filter((f) => /^list-.\.wiki$/.test(f))) {
    const t = readFileSync(join(dir, f), 'utf8')
    for (const block of t.split(/\n\|-\s*\n/).slice(1)) {
      const line = block.trim().replace(/^\|/, '')
      if (!line || line.startsWith('}')) continue
      const c = line.split('||')
      if (c.length < 7) continue
      rows.push({ name: strip(c[0]!), courtesy: strip(c[1]!), born: strip(c[2]!), died: strip(c[3]!), role: strip(c[5] ?? ''), alleg: strip(c[6] ?? ''), prev: strip(c[7] ?? ''), notes: strip(c[8] ?? '') })
    }
  }
  return rows
}
if (process.argv[1]?.endsWith('parse-lists.ts')) {
  const rows = parseAll()
  const off = JSON.parse(readFileSync(join(ROOT, 'src/data/officers.json'), 'utf8')) as any[]
  const by = new Map<string, Row[]>()
  for (const r of rows) by.set(r.name.toLowerCase(), [...(by.get(r.name.toLowerCase()) ?? []), r])
  let missing = 0
  for (const o of off) {
    const m = by.get(o.name.toLowerCase().replace(/ /g, ' '))
    if (!m) { console.log(`NOTFOUND ${o.id} (${o.name})  ours ${o.born}-${o.died}${o.estimate ? 'e' : ''}`); missing++; continue }
    const lines = m.map((r) => `${r.born || '?'}-${r.died || '?'} [${r.alleg}]`).join(' | ')
    const flag = m.some((r) => (r.born && +r.born !== o.born) || (r.died && +r.died !== o.died)) ? 'DIFF' : 'ok  '
    console.log(`${flag} ${o.id.padEnd(16)} ours ${o.born}-${o.died}${o.estimate ? 'e' : ' '}  list ${lines}`)
  }
  console.log('rows', rows.length, 'missing', missing)
}
