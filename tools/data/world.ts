// Generator source: cities and roads (docs/spec/12-data.md §4, §5). Run via tools/data/build.ts.
import type { CityDef, RoadDef, RoadTerrain } from '../../src/contracts/data'

// [id, name, province, lat, lon, farmMax, tradeMax, wallsMax, source-note]
type CityRow = [string, string, string, number, number, number, number, number, string]

const CITY_ROWS: CityRow[] = [
  ['luoyang', 'Luoyang', 'Sili', 34.72, 112.6, 800, 999, 950, 'Wikipedia: Luoyang; Hou Hanshu: capital of the Later Han'],
  ['chang-an', "Chang'an", 'Sili', 34.32, 108.88, 850, 950, 999, "Wikipedia: Chang'an; Hou Hanshu: Western Capital"],
  ['hongnong', 'Hongnong', 'Sili', 34.52, 110.88, 500, 400, 700, 'Wikipedia: Hongnong Commandery'],
  ['hedong', 'Hedong', 'Sili', 35.15, 111.2, 600, 500, 450, 'Wikipedia: Hedong Commandery (seat Anyi)'],
  ['ye', 'Ye', 'Ji', 36.33, 114.55, 900, 850, 900, 'Wikipedia: Ye (city); seat of Wei Commandery, Ji Province capital from 190'],
  ['nanpi', 'Nanpi', 'Ji', 38.03, 116.71, 700, 650, 500, 'Wikipedia: Bohai Commandery (seat Nanpi)'],
  ['ji', 'Ji', 'You', 39.89, 116.35, 600, 750, 700, 'Wikipedia: Ji (ancient city); seat of You Province'],
  ['beiping', 'Beiping', 'You', 40.19, 117.96, 400, 350, 450, 'Wikipedia: Youbeiping Commandery'],
  ['xiangping', 'Xiangping', 'You', 41.27, 123.17, 350, 300, 400, 'Wikipedia: Liaodong Commandery (seat Xiangping)'],
  ['pingyuan', 'Pingyuan', 'Qing', 37.2, 116.4, 550, 450, 450, 'Wikipedia: Pingyuan Commandery'],
  ['beihai', 'Beihai', 'Qing', 36.71, 118.83, 600, 550, 500, 'Wikipedia: Beihai Commandery (seat Yingling)'],
  ['puyang', 'Puyang', 'Yan', 35.76, 115.03, 650, 550, 500, 'Wikipedia: Dong Commandery; Puyang'],
  ['chenliu', 'Chenliu', 'Yan', 34.8, 114.3, 650, 650, 550, 'Wikipedia: Chenliu Commandery'],
  ['xuchang', 'Xuchang', 'Yu', 34.04, 113.85, 700, 600, 600, 'Wikipedia: Xuchang; Yingchuan Commandery'],
  ['runan', 'Runan', 'Yu', 33.0, 114.6, 650, 450, 450, 'Wikipedia: Runan Commandery'],
  ['xiaopei', 'Xiaopei', 'Yu', 34.73, 116.93, 450, 350, 350, 'Wikipedia: Pei (county) / Xiaopei'],
  ['xiapi', 'Xiapi', 'Xu', 34.33, 117.95, 600, 600, 650, 'Wikipedia: Xiapi; Xu Province'],
  ['langya', 'Langya', 'Xu', 35.05, 118.35, 450, 400, 400, 'Wikipedia: Langya Commandery'],
  ['shouchun', 'Shouchun', 'Yang', 32.55, 116.78, 750, 650, 650, 'Wikipedia: Shou County (Anhui); Jiujiang Commandery'],
  ['lujiang', 'Lujiang', 'Yang', 31.46, 117.0, 600, 400, 400, 'Wikipedia: Lujiang Commandery'],
  ['jianye', 'Jianye', 'Yang', 32.06, 118.79, 600, 700, 600, 'Wikipedia: Nanjing (Moling, later Jianye)'],
  ['wu', 'Wu', 'Yang', 31.3, 120.62, 700, 700, 450, 'Wikipedia: Wu Commandery (Suzhou)'],
  ['kuaiji', 'Kuaiji', 'Yang', 30.0, 120.58, 600, 500, 400, 'Wikipedia: Kuaiji Commandery (Shanyin, Shaoxing)'],
  ['yuzhang', 'Yuzhang', 'Yang', 28.68, 115.86, 600, 450, 400, 'Wikipedia: Yuzhang Commandery (Nanchang)'],
  ['chaisang', 'Chaisang', 'Yang', 29.7, 116.0, 400, 400, 400, 'Wikipedia: Chaisang (Jiujiang)'],
  ['xiangyang', 'Xiangyang', 'Jing', 32.01, 112.12, 800, 800, 900, 'Wikipedia: Xiangyang'],
  ['wan', 'Wan', 'Jing', 33.0, 112.53, 800, 800, 700, 'Wikipedia: Nanyang, Henan; Nanyang Commandery (seat Wan)'],
  ['xinye', 'Xinye', 'Jing', 32.52, 112.35, 400, 350, 400, 'Wikipedia: Xinye County'],
  ['jiangling', 'Jiangling', 'Jing', 30.35, 112.19, 700, 750, 650, 'Wikipedia: Jiangling County; Nan Commandery'],
  ['jiangxia', 'Jiangxia', 'Jing', 30.55, 114.3, 500, 600, 600, 'Wikipedia: Jiangxia Commandery (Xiakou, Wuhan)'],
  ['changsha', 'Changsha', 'Jing', 28.2, 112.97, 650, 550, 500, 'Wikipedia: Changsha Commandery'],
  ['wuling', 'Wuling', 'Jing', 29.03, 111.69, 350, 300, 300, 'Wikipedia: Wuling Commandery (Changde)'],
  ['lingling', 'Lingling', 'Jing', 26.23, 111.61, 350, 300, 300, 'Wikipedia: Lingling Commandery (Yongzhou)'],
  ['guiyang', 'Guiyang', 'Jing', 25.8, 113.03, 300, 280, 300, 'Wikipedia: Guiyang Commandery (Chenzhou)'],
  ['shangyong', 'Shangyong', 'Yi', 32.22, 110.23, 300, 200, 350, 'Wikipedia: Shangyong County; Hanzhong Commandery until 219'],
  ['hanzhong', 'Hanzhong', 'Yi', 33.07, 107.03, 550, 400, 750, 'Wikipedia: Hanzhong Commandery (seat Nanzheng)'],
  ['zitong', 'Zitong', 'Yi', 31.64, 105.17, 450, 350, 400, 'Wikipedia: Zitong County; Guanghan Commandery'],
  ['chengdu', 'Chengdu', 'Yi', 30.66, 104.07, 950, 900, 700, 'Wikipedia: Chengdu; Shu Commandery'],
  ['jiangzhou', 'Jiangzhou', 'Yi', 29.56, 106.55, 600, 550, 700, 'Wikipedia: Ba Commandery (Jiangzhou, Chongqing)'],
  ['yongan', "Yong'an", 'Yi', 31.02, 109.46, 300, 300, 500, "Wikipedia: Fengjie County (Yong'an, Baidi)"],
  ['jianning', 'Jianning', 'Yi', 25.04, 102.71, 300, 250, 250, 'Wikipedia: Yizhou Commandery (Jianning, Kunming)'],
  ['tianshui', 'Tianshui', 'Liang', 34.58, 105.72, 450, 350, 450, 'Wikipedia: Tianshui; Hanyang Commandery'],
  ['anding', 'Anding', 'Liang', 35.55, 106.67, 350, 250, 400, 'Wikipedia: Anding Commandery (Pingliang)'],
  ['wuwei', 'Wuwei', 'Liang', 37.93, 102.64, 400, 400, 400, 'Wikipedia: Wuwei, Gansu (Guzang)'],
  ['jinyang', 'Jinyang', 'Bing', 37.72, 112.47, 600, 500, 600, 'Wikipedia: Taiyuan Commandery (Jinyang)'],
  ['shangdang', 'Shangdang', 'Bing', 36.19, 113.12, 450, 300, 650, 'Wikipedia: Shangdang Commandery (Changzhi)'],
  ['jiaozhi', 'Jiaozhi', 'Jiao', 21.08, 106.07, 600, 500, 300, 'Wikipedia: Jiaozhi (Luy Lau, Long Bien)'],
  ['nanhai', 'Nanhai', 'Jiao', 23.13, 113.27, 450, 500, 300, 'Wikipedia: Nanhai Commandery (Panyu, Guangzhou)'],
]

// [a, b, terrain]
const ROAD_ROWS: [string, string, RoadTerrain][] = [
  ['luoyang', 'hongnong', 'hills'],
  ['hongnong', 'chang-an', 'hills'],
  ['luoyang', 'chenliu', 'plain'],
  ['luoyang', 'xuchang', 'hills'],
  ['luoyang', 'hedong', 'river'],
  ['hedong', 'hongnong', 'river'],
  ['luoyang', 'ye', 'river'],
  ['luoyang', 'wan', 'hills'],
  ['hongnong', 'wan', 'mountain'],
  ['chang-an', 'hanzhong', 'mountain'],
  ['chang-an', 'tianshui', 'hills'],
  ['chang-an', 'anding', 'hills'],
  ['tianshui', 'anding', 'hills'],
  ['anding', 'wuwei', 'hills'],
  ['tianshui', 'hanzhong', 'mountain'],
  ['tianshui', 'wuwei', 'mountain'],
  ['hedong', 'jinyang', 'hills'],
  ['jinyang', 'shangdang', 'mountain'],
  ['shangdang', 'ye', 'mountain'],
  ['shangdang', 'hedong', 'mountain'],
  ['ye', 'puyang', 'plain'],
  ['ye', 'nanpi', 'plain'],
  ['ye', 'ji', 'plain'],
  ['nanpi', 'ji', 'plain'],
  ['nanpi', 'pingyuan', 'plain'],
  ['pingyuan', 'puyang', 'plain'],
  ['pingyuan', 'beihai', 'plain'],
  ['beihai', 'langya', 'hills'],
  ['langya', 'xiapi', 'hills'],
  ['xiapi', 'xiaopei', 'marsh'],
  ['xiaopei', 'chenliu', 'plain'],
  ['xiaopei', 'shouchun', 'marsh'],
  ['xiapi', 'shouchun', 'marsh'],
  ['xiapi', 'jianye', 'river'],
  ['chenliu', 'puyang', 'plain'],
  ['chenliu', 'xuchang', 'plain'],
  ['xuchang', 'runan', 'plain'],
  ['runan', 'shouchun', 'marsh'],
  ['runan', 'wan', 'hills'],
  ['xuchang', 'wan', 'hills'],
  ['ji', 'beiping', 'plain'],
  ['beiping', 'xiangping', 'hills'],
  ['hanzhong', 'zitong', 'mountain'],
  ['zitong', 'chengdu', 'hills'],
  ['chengdu', 'jiangzhou', 'hills'],
  ['jiangzhou', 'yongan', 'river'],
  ['yongan', 'jiangling', 'river'],
  ['hanzhong', 'shangyong', 'mountain'],
  ['shangyong', 'xiangyang', 'river'],
  ['chengdu', 'jianning', 'mountain'],
  ['xiangyang', 'wan', 'plain'],
  ['xiangyang', 'xinye', 'plain'],
  ['xinye', 'wan', 'plain'],
  ['xiangyang', 'jiangling', 'river'],
  ['jiangling', 'jiangxia', 'river'],
  ['xiangyang', 'jiangxia', 'river'],
  ['jiangling', 'wuling', 'marsh'],
  ['jiangling', 'changsha', 'marsh'],
  ['wuling', 'changsha', 'hills'],
  ['changsha', 'lingling', 'hills'],
  ['changsha', 'guiyang', 'mountain'],
  ['lingling', 'guiyang', 'hills'],
  ['guiyang', 'nanhai', 'mountain'],
  ['jiangxia', 'chaisang', 'river'],
  ['chaisang', 'lujiang', 'river'],
  ['chaisang', 'yuzhang', 'marsh'],
  ['yuzhang', 'changsha', 'mountain'],
  ['yuzhang', 'kuaiji', 'mountain'],
  ['lujiang', 'shouchun', 'marsh'],
  ['lujiang', 'jianye', 'river'],
  ['jianye', 'wu', 'plain'],
  ['wu', 'kuaiji', 'plain'],
  ['nanhai', 'jiaozhi', 'forest'],
]

function hav(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const rad = (d: number) => (d * Math.PI) / 180
  const dLat = rad(lat2 - lat1)
  const dLon = rad(lon2 - lon1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

export function buildCities(): CityDef[] {
  const cities: CityDef[] = CITY_ROWS.map(([id, name, province, lat, lon, farmMax, tradeMax, wallsMax, src]) => ({
    id,
    name,
    province,
    lat,
    lon,
    x: Math.round((lon - 97) * 30),
    y: Math.round((41.5 - lat) * 36),
    farmMax,
    tradeMax,
    wallsMax,
    source: src,
  }))
  // Nudge pass: cities closer than 25 units are pushed apart (the smaller city moves).
  const weight = (c: CityDef) => c.farmMax + c.tradeMax + c.wallsMax
  for (let pass = 0; pass < 20; pass++) {
    let moved = false
    for (let i = 0; i < cities.length; i++) {
      for (let j = i + 1; j < cities.length; j++) {
        const a = cities[i]!
        const b = cities[j]!
        const dx = b.x - a.x
        const dy = b.y - a.y
        const d = Math.hypot(dx, dy)
        if (d < 25) {
          const mover = weight(a) < weight(b) ? a : b
          const anchor = mover === a ? b : a
          let vx = mover.x - anchor.x
          let vy = mover.y - anchor.y
          let vd = Math.hypot(vx, vy)
          if (vd === 0) {
            vx = 1
            vy = 1
            vd = Math.SQRT2
          }
          mover.x = Math.round(anchor.x + (vx / vd) * 26)
          mover.y = Math.round(anchor.y + (vy / vd) * 26)
          mover.nudged = true
          moved = true
        }
      }
    }
    if (!moved) break
  }
  return cities
}

export function buildRoads(cities: CityDef[]): RoadDef[] {
  const byId = new Map(cities.map((c) => [c.id, c]))
  return ROAD_ROWS.map(([a, b, terrain]) => {
    const ca = byId.get(a)
    const cb = byId.get(b)
    if (!ca || !cb) throw new Error(`road ${a}-${b}: unknown city`)
    let days = (hav(ca.lat, ca.lon, cb.lat, cb.lon) * 1.3) / 30
    if (terrain === 'mountain') days *= 1.5
    days = Math.max(5, Math.min(25, Math.round(days)))
    return { a, b, days, terrain }
  })
}
