// Fetches the Wikipedia article for the modern city/county of each historical seat and compares its coordinates with src/data/cities.json.
// Usage: npx tsx tools/data/verify/verify-cities.ts   (needs network the first time; pages cached in docs/sources/cities)
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
const ROOT = join(import.meta.dirname, '..', '..', '..')
const DIR = join(ROOT, 'docs', 'sources', 'cities')
mkdirSync(DIR, { recursive: true })
// city id -> Wikipedia article for the modern place that sits on the ancient seat
export const ARTICLE: Record<string, string> = {
  luoyang: 'Luoyang', 'chang-an': "Chang'an", hongnong: 'Lingbao, Henan', hedong: 'Xia County, Shanxi', ye: 'Linzhang County', nanpi: 'Nanpi County',
  ji: 'Xicheng District', beiping: 'Zunhua', xiangping: 'Liaoyang', pingyuan: 'Pingyuan County, Shandong', beihai: 'Changle County',
  puyang: 'Puyang', chenliu: 'Kaifeng', xuchang: 'Xuchang', runan: 'Pingyu County', xiaopei: 'Pei County', xiapi: 'Pizhou', langya: 'Linyi',
  shouchun: 'Shou County', lujiang: 'Shucheng County', jianye: 'Nanjing', wu: 'Suzhou', kuaiji: 'Shaoxing', yuzhang: 'Nanchang', chaisang: 'Jiujiang',
  xiangyang: 'Xiangyang', wan: 'Nanyang, Henan', xinye: 'Xinye County', jiangling: 'Jingzhou District', jiangxia: 'Wuhan', changsha: 'Changsha',
  wuling: 'Changde', lingling: 'Yongzhou', guiyang: 'Chenzhou', shangyong: 'Zhushan County', hanzhong: 'Hanzhong', zitong: 'Zitong County',
  chengdu: 'Chengdu', jiangzhou: 'Chongqing', yongan: 'Fengjie County', jianning: 'Kunming', tianshui: 'Tianshui', anding: 'Pingliang',
  wuwei: 'Wuwei, Gansu', jinyang: 'Jinyuan District', shangdang: 'Changzhi', jiaozhi: 'Thuận Thành, Bắc Ninh', nanhai: 'Guangzhou',
}
const get = (t: string): string => {
  const f = join(DIR, t.replace(/[^A-Za-z0-9]+/g, '_') + '.wiki')
  if (existsSync(f)) return readFileSync(f, 'utf8')
  let txt = ''
  for (let n = 0; n < 4; n++) {
    txt = execFileSync('curl', ['-sS', '-m', '60', '-G', 'https://en.wikipedia.org/w/index.php', '--data-urlencode', `title=${t}`, '--data-urlencode', 'action=raw']).toString()
    const m = /^#REDIRECT\s*\[\[([^\]#|]*)/i.exec(txt)
    if (m) { txt = get(m[1]!); break }
    if (!txt.startsWith('<!DOCTYPE')) break
    execFileSync('sleep', [String(2 + n * 3)])
  }
  writeFileSync(f, txt)
  return txt
}
const dms = (p: string[]): number => { const n = p.filter((x) => /^-?[\d.]+$/.test(x)).map(Number); return n.length === 3 ? n[0]! + n[1]! / 60 + n[2]! / 3600 : n.length === 2 ? n[0]! + n[1]! / 60 : n[0]! }
export function coordOf(txt: string): [number, number] | null {
  const m = /\{\{\s*(?:coord|Coord)\s*\|([^}]*)\}\}/.exec(txt)
  if (m) {
    const parts = m[1]!.split('|').map((s) => s.trim())
    const iN = parts.findIndex((x) => x === 'N' || x === 'S'), iE = parts.findIndex((x) => x === 'E' || x === 'W')
    if (iN > 0 && iE > 0) {
      const lat = dms(parts.slice(0, iN)) * (parts[iN] === 'S' ? -1 : 1), lon = dms(parts.slice(iN + 1, iE)) * (parts[iE] === 'W' ? -1 : 1)
      return [lat, lon]
    }
  }
  const dec = /\{\{\s*(?:coord|Coord)\s*\|\s*(-?[\d.]+)\s*\|\s*(-?[\d.]+)\s*\|/.exec(txt)
  if (dec) return [Number(dec[1]), Number(dec[2])]
  const f = (k: string) => { const r = new RegExp(`\\|\\s*${k}\\s*=\\s*([\\d.]+)`).exec(txt); return r ? Number(r[1]) : 0 }
  if (f('latd') && f('lond')) return [f('latd') + f('latm') / 60 + f('lats') / 3600, f('lond') + f('lonm') / 60 + f('lonss') / 3600 + f('lons') / 3600]
  return null
}
if (process.argv[1]?.endsWith('verify-cities.ts')) {
  const cities = JSON.parse(readFileSync(join(ROOT, 'src/data/cities.json'), 'utf8')) as { id: string; lat: number; lon: number }[]
  for (const c of cities) {
    const art = ARTICLE[c.id]
    if (!art) { console.log(`NOARTICLE ${c.id}`); continue }
    const co = coordOf(get(art))
    if (!co) { console.log(`NOCOORD   ${c.id.padEnd(10)} ours ${c.lat},${c.lon}  [${art}]`); continue }
    const d = Math.max(Math.abs(co[0] - c.lat), Math.abs(co[1] - c.lon))
    console.log(`${d <= 0.05 ? 'ok   ' : 'DIFF '} ${c.id.padEnd(10)} ours ${c.lat},${c.lon}  wiki ${co[0].toFixed(3)},${co[1].toFixed(3)} d=${d.toFixed(3)} [${art}]`)
  }
}
