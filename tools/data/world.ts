// Generator source: cities and roads (docs/spec/12-data.md §4, §5). Run via tools/data/build.ts.
import type { CityDef, RoadDef, RoadTerrain } from '../../src/contracts/data'

// [id, name, province, lat, lon, farmMax, tradeMax, wallsMax, source-note]
type CityRow = [string, string, string, number, number, number, number, number, string]

const CITY_ROWS: CityRow[] = [
  ['luoyang', 'Luoyang', 'Sili', 34.62, 112.45, 800, 999, 950, 'Wikipedia: Luoyang; Hou Hanshu: capital of the Later Han; lat/lon checked against Wikipedia: Luoyang'],
  ['chang-an', "Chang'an", 'Sili', 34.32, 108.88, 850, 950, 999, "Wikipedia: Chang'an; Hou Hanshu: Western Capital; lat/lon checked against Wikipedia: Chang'an"],
  ['hongnong', 'Hongnong', 'Sili', 34.52, 110.88, 500, 400, 700, 'Wikipedia: Hongnong Commandery; lat/lon checked against Wikipedia: Lingbao, Henan'],
  ['hedong', 'Hedong', 'Sili', 35.15, 111.2, 600, 500, 450, 'Wikipedia: Hedong Commandery (seat Anyi); lat/lon checked against Wikipedia: Xia County, Shanxi'],
  ['ye', 'Ye', 'Ji', 36.33, 114.62, 900, 850, 900, 'Wikipedia: Ye (city); seat of Wei Commandery, Ji Province capital from 190; lat/lon checked against Wikipedia: Linzhang County'],
  ['nanpi', 'Nanpi', 'Ji', 38.03, 116.71, 700, 650, 500, 'Wikipedia: Bohai Commandery (seat Nanpi); lat/lon checked against Wikipedia: Nanpi County'],
  ['ji', 'Ji', 'You', 39.89, 116.35, 600, 750, 700, 'Wikipedia: Ji (ancient city); seat of You Province; lat/lon checked against Wikipedia: Xicheng District'],
  ['beiping', 'Beiping', 'You', 40.19, 117.96, 400, 350, 450, 'Wikipedia: Youbeiping Commandery; lat/lon checked against Wikipedia: Zunhua'],
  ['xiangping', 'Xiangping', 'You', 41.27, 123.17, 350, 300, 400, 'Wikipedia: Liaodong Commandery (seat Xiangping); lat/lon checked against Wikipedia: Liaoyang'],
  ['pingyuan', 'Pingyuan', 'Qing', 37.2, 116.4, 550, 450, 450, 'Wikipedia: Pingyuan Commandery; lat/lon checked against Wikipedia: Pingyuan County, Shandong'],
  ['beihai', 'Beihai', 'Qing', 36.7, 118.75, 600, 550, 500, 'Wikipedia: Beihai Commandery (seat Yingling); lat/lon checked against Wikipedia: Changle County'],
  ['puyang', 'Puyang', 'Yan', 35.76, 115.03, 650, 550, 500, 'Wikipedia: Dong Commandery; Puyang; lat/lon checked against Wikipedia: Puyang'],
  ['chenliu', 'Chenliu', 'Yan', 34.8, 114.3, 650, 650, 550, 'Wikipedia: Chenliu Commandery; lat/lon checked against Wikipedia: Kaifeng'],
  ['xuchang', 'Xuchang', 'Yu', 34.04, 113.85, 700, 600, 600, 'Wikipedia: Xuchang; Yingchuan Commandery; lat/lon checked against Wikipedia: Xuchang'],
  ['runan', 'Runan', 'Yu', 33.0, 114.6, 650, 450, 450, 'Wikipedia: Runan Commandery; lat/lon checked against Wikipedia: Pingyu County'],
  ['xiaopei', 'Xiaopei', 'Yu', 34.73, 116.93, 450, 350, 350, 'Wikipedia: Pei (county) / Xiaopei; lat/lon checked against Wikipedia: Pei County'],
  ['xiapi', 'Xiapi', 'Xu', 34.4, 117.89, 600, 600, 650, 'Wikipedia: Xiapi; Xu Province; lat/lon checked against Wikipedia: Pizhou'],
  ['langya', 'Langya', 'Xu', 35.1, 118.36, 450, 400, 400, 'Wikipedia: Langya Commandery; lat/lon checked against Wikipedia: Linyi'],
  ['shouchun', 'Shouchun', 'Yang', 32.55, 116.78, 750, 650, 650, 'Wikipedia: Shou County (Anhui); Jiujiang Commandery; lat/lon checked against Wikipedia: Shou County'],
  ['lujiang', 'Lujiang', 'Yang', 31.46, 116.95, 600, 400, 400, 'Wikipedia: Lujiang Commandery; lat/lon checked against Wikipedia: Shucheng County'],
  ['jianye', 'Jianye', 'Yang', 32.06, 118.79, 600, 700, 600, 'Wikipedia: Nanjing (Moling, later Jianye); lat/lon checked against Wikipedia: Nanjing'],
  ['wu', 'Wu', 'Yang', 31.3, 120.62, 700, 700, 450, 'Wikipedia: Wu Commandery (Suzhou); lat/lon checked against Wikipedia: Suzhou'],
  ['kuaiji', 'Kuaiji', 'Yang', 30.05, 120.58, 600, 500, 400, 'Wikipedia: Kuaiji Commandery (Shanyin, Shaoxing); lat/lon checked against Wikipedia: Shaoxing'],
  ['yuzhang', 'Yuzhang', 'Yang', 28.68, 115.86, 600, 450, 400, 'Wikipedia: Yuzhang Commandery (Nanchang); lat/lon checked against Wikipedia: Nanchang'],
  ['chaisang', 'Chaisang', 'Yang', 29.7, 116.0, 400, 400, 400, 'Wikipedia: Chaisang (Jiujiang); lat/lon checked against Wikipedia: Jiujiang'],
  ['xiangyang', 'Xiangyang', 'Jing', 32.01, 112.12, 800, 800, 900, 'Wikipedia: Xiangyang; lat/lon checked against Wikipedia: Xiangyang'],
  ['wan', 'Wan', 'Jing', 33.0, 112.53, 800, 800, 700, 'Wikipedia: Nanyang, Henan; Nanyang Commandery (seat Wan); lat/lon checked against Wikipedia: Nanyang, Henan'],
  ['xinye', 'Xinye', 'Jing', 32.52, 112.35, 400, 350, 400, 'Wikipedia: Xinye County; lat/lon checked against Wikipedia: Xinye County'],
  ['jiangling', 'Jiangling', 'Jing', 30.35, 112.19, 700, 750, 650, 'Wikipedia: Jiangling County; Nan Commandery; lat/lon checked against Wikipedia: Jingzhou District'],
  ['jiangxia', 'Jiangxia', 'Jing', 30.55, 114.3, 500, 600, 600, 'Wikipedia: Jiangxia Commandery (Xiakou, Wuhan); lat/lon checked against Wikipedia: Wuhan'],
  ['changsha', 'Changsha', 'Jing', 28.2, 112.97, 650, 550, 500, 'Wikipedia: Changsha Commandery; lat/lon checked against Wikipedia: Changsha'],
  ['wuling', 'Wuling', 'Jing', 29.03, 111.69, 350, 300, 300, 'Wikipedia: Wuling Commandery (Changde); lat/lon checked against Wikipedia: Changde'],
  ['lingling', 'Lingling', 'Jing', 26.23, 111.61, 350, 300, 300, 'Wikipedia: Lingling Commandery (Yongzhou); lat/lon checked against Wikipedia: Yongzhou (district article has no coordinates)'],
  ['guiyang', 'Guiyang', 'Jing', 25.8, 113.03, 300, 280, 300, 'Wikipedia: Guiyang Commandery (Chenzhou); lat/lon checked against Wikipedia: Chenzhou'],
  ['shangyong', 'Shangyong', 'Yi', 32.22, 110.23, 300, 200, 350, 'Wikipedia: Shangyong County; Hanzhong Commandery until 219; lat/lon checked against Wikipedia: Zhushan County'],
  ['hanzhong', 'Hanzhong', 'Yi', 33.07, 107.03, 550, 400, 750, 'Wikipedia: Hanzhong Commandery (seat Nanzheng); lat/lon checked against Wikipedia: Hanzhong'],
  ['zitong', 'Zitong', 'Yi', 31.64, 105.17, 450, 350, 400, 'Wikipedia: Zitong County; Guanghan Commandery; lat/lon checked against Wikipedia: Zitong County'],
  ['chengdu', 'Chengdu', 'Yi', 30.66, 104.07, 950, 900, 700, 'Wikipedia: Chengdu; Shu Commandery; lat/lon checked against Wikipedia: Chengdu'],
  ['jiangzhou', 'Jiangzhou', 'Yi', 29.56, 106.55, 600, 550, 700, 'Wikipedia: Ba Commandery (Jiangzhou, Chongqing); lat/lon checked against Wikipedia: Chongqing'],
  ['yongan', "Yong'an", 'Yi', 31.02, 109.46, 300, 300, 500, "Wikipedia: Fengjie County (Yong'an, Baidi); lat/lon checked against Wikipedia: Fengjie County"],
  ['jianning', 'Jianning', 'Yi', 25.04, 102.71, 300, 250, 250, 'Wikipedia: Yizhou Commandery (Jianning, Kunming); lat/lon checked against Wikipedia: Kunming'],
  ['tianshui', 'Tianshui', 'Liang', 34.58, 105.72, 450, 350, 450, 'Wikipedia: Tianshui; Hanyang Commandery; lat/lon checked against Wikipedia: Tianshui'],
  ['anding', 'Anding', 'Liang', 35.55, 106.67, 350, 250, 400, 'Wikipedia: Anding Commandery (Pingliang); lat/lon checked against Wikipedia: Pingliang'],
  ['wuwei', 'Wuwei', 'Liang', 37.93, 102.64, 400, 400, 400, 'Wikipedia: Wuwei, Gansu (Guzang); lat/lon checked against Wikipedia: Wuwei, Gansu'],
  ['jinyang', 'Jinyang', 'Bing', 37.72, 112.47, 600, 500, 600, 'Wikipedia: Taiyuan Commandery (Jinyang); lat/lon checked against Wikipedia: Jinyuan District'],
  ['shangdang', 'Shangdang', 'Bing', 36.19, 113.12, 450, 300, 650, 'Wikipedia: Shangdang Commandery (Changzhi); lat/lon checked against Wikipedia: Changzhi'],
  ['jiaozhi', 'Jiaozhi', 'Jiao', 21.08, 106.07, 600, 500, 300, 'Wikipedia: Jiaozhi (Luy Lau, Long Bien); lat/lon checked against Wikipedia: Thuận Thành, Bắc Ninh'],
  ['nanhai', 'Nanhai', 'Jiao', 23.13, 113.27, 450, 500, 300, 'Wikipedia: Nanhai Commandery (Panyu, Guangzhou); lat/lon checked against Wikipedia: Guangzhou'],
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
