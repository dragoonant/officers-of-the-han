// Downloads Wikipedia raw wikitext for each officer into docs/sources/bio/<id>.wiki (follows #REDIRECT, with title overrides).
// Usage: npx tsx tools/data/verify/fetch-bios.ts   (needs network; output dir is gitignored)
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
const ROOT = join(import.meta.dirname, '..', '..', '..')
const OUT = join(ROOT, 'docs', 'sources', 'bio')
mkdirSync(OUT, { recursive: true })
const OVERRIDE: Record<string, string> = {
  'yan-yan': 'Yan Yan (Three Kingdoms)', 'dong-cheng': 'Dong Cheng (Han dynasty)', 'zou-jing': 'Zou Jing (Eastern Han)',
  'xu-you': 'Xu You (Han dynasty)', 'yang-xiu': 'Yang Xiu (Han dynasty)', 'dong-zhao': 'Dong Zhao (Three Kingdoms)',
  'chen-wu': 'Chen Wu (Han dynasty)', 'han-fu': 'Han Fu (warlord)', 'li-jue': 'Li Jue (Han dynasty)', 'li-yan': 'Li Yan (Three Kingdoms)',
  'liu-yan': 'Liu Yan (Han dynasty warlord)', 'liu-ye': 'Liu Ye (Three Kingdoms)', 'liu-zhang': 'Liu Zhang (warlord)', 'lu-zhi': 'Lu Zhi (Han dynasty)',
  'shi-yi': 'Shi Yi (Eastern Wu)', 'tao-qian': 'Tao Qian (Han dynasty)', 'wang-lang': 'Wang Lang (Cao Wei)', 'wang-ling': 'Wang Ling (Three Kingdoms)',
  'wang-yun': 'Wang Yun (Han dynasty)', 'yang-hong': 'Yang Hong (Yuan Shu)', 'yang-qiu': 'Yang Qiu (warlord)', 'zhang-hong': 'Zhang Hong (Han dynasty)',
  'zhang-lu': 'Zhang Lu (Han dynasty)', 'zhang-miao': 'Zhang Miao (politician)', 'zhang-xiu': 'Zhang Xiu (warlord)', 'zhang-yan': 'Zhang Yan (Han dynasty)',
  'zhang-yang': 'Zhang Yang (warlord)', 'zhang-zhao': 'Zhang Zhao (Eastern Wu)', 'zhu-jun': 'Zhu Jun (Han dynasty)', 'lady-wu': 'Lady Wu (Sun Jian\'s wife)',
  'huang-quan': 'Huang Quan (general)',
  'lu-xun': 'Lu Xun (Three Kingdoms)', 'liu-xie': 'Emperor Xian of Han', 'zhang-ji': 'Zhang Ji (Han dynasty)', 'wu-jing': 'Wu Jing (Han dynasty)',
  'chen-lin': 'Chen Lin (Han dynasty)', 'liu-yu': 'Liu Yu (warlord)',
  'yang-fu': 'Yang Fu (Han dynasty)', 'kuai-yue': 'Kuai Yue (Han dynasty)', 'lady-bian': 'Empress Dowager Bian', 'zhen-luo': 'Lady Zhen',
}
const raw = (title: string) => execFileSync('curl', ['-sS', '-m', '60', '-G', 'https://en.wikipedia.org/w/index.php', '--data-urlencode', `title=${title}`, '--data-urlencode', 'action=raw'], { maxBuffer: 1 << 26 }).toString()
const get = (title: string): string => {
  for (let i = 0; i < 4; i++) {
    const t = raw(title)
    if (!t.startsWith('<!DOCTYPE')) return t
    execFileSync('sleep', [String(2 + i * 3)])
  }
  return ''
}
const SKIP = new Set(['yang-hong', 'zhang-xun', 'zhang-chao', 'zhang-wei']) // modern namesakes or no article // no article of its own; the list table is the source
const off = JSON.parse(readFileSync(join(ROOT, 'src/data/officers.json'), 'utf8')) as { id: string; name: string }[]
for (const o of off) {
  const f = join(OUT, `${o.id}.wiki`)
  if (existsSync(f) || SKIP.has(o.id)) continue
  let title = OVERRIDE[o.id] ?? o.name
  let t = get(title)
  for (let i = 0; i < 3; i++) {
    const m = /^#REDIRECT\s*\[\[([^\]#|]*)/i.exec(t)
    if (!m) break
    title = m[1]!; t = get(title)
  }
  writeFileSync(f, `<!-- title: ${title} -->\n` + t)
}
