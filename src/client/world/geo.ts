// APPROXIMATE river courses, hand-traced from memory of real geography for the painted tray. They are
// decoration, not data: do not read distances from them. Points are [lon, lat]; the projection is the data's
// (docs/spec/12-data.md): x = (lon - 97) * 30, y = (41.5 - lat) * 36.
export const projectX = (lon: number): number => (lon - 97) * 30
export const projectY = (lat: number): number => (41.5 - lat) * 36

export interface River { id: string; name: string; points: [number, number][]; width: number }

export const RIVERS: River[] = [
  { id: 'yellow', name: 'Yellow River', width: 3.2, points: [[101.8, 36.2], [103.8, 36.1], [105.2, 37.4], [106.3, 38.5], [107, 40.2], [109, 40.7], [111, 40.6], [111.3, 39.4], [110.7, 37.6], [110.5, 36], [110.3, 34.7], [111.5, 34.8], [112.6, 34.95], [114.3, 34.95], [115.4, 35.4], [116.5, 36.2], [117.2, 36.9], [118.3, 37.6]] },
  { id: 'yangtze', name: 'Yangtze', width: 3.4, points: [[101, 27.4], [103, 28.4], [104.6, 28.8], [106.5, 29.6], [108.4, 30.8], [110.5, 30.8], [111.3, 30.7], [112.2, 30.3], [113.4, 29.7], [114.3, 30.6], [115.6, 29.9], [116.6, 29.7], [117.4, 30.6], [118.4, 31.7], [119.4, 32.2], [121.2, 31.8]] },
  { id: 'han', name: 'Han River', width: 2.2, points: [[106.8, 33.2], [108.2, 33], [109.5, 32.7], [111, 32.6], [112.1, 32.1], [112.6, 31.4], [113.5, 30.7], [114.3, 30.55]] },
  { id: 'huai', name: 'Huai River', width: 2.2, points: [[113.3, 32.5], [114.6, 32.4], [115.8, 32.7], [116.9, 32.9], [117.7, 33.1], [118.6, 33.3]] },
  { id: 'wei', name: 'Wei River', width: 2.2, points: [[104.3, 35.1], [105.7, 34.6], [107.2, 34.4], [108.9, 34.4], [110.2, 34.65]] },
]

export const riverPath = (r: River): string => r.points.map(([lon, lat], i) => `${i ? 'L' : 'M'}${projectX(lon).toFixed(1)} ${projectY(lat).toFixed(1)}`).join(' ')

/** Smooth the polyline with quadratic midpoints so it reads as a brush stroke. */
export function riverBrush(r: River): string {
  const p = r.points.map(([lon, lat]) => [projectX(lon), projectY(lat)] as const)
  if (p.length < 3) return riverPath(r)
  let d = `M${p[0]![0].toFixed(1)} ${p[0]![1].toFixed(1)}`
  for (let i = 1; i < p.length - 1; i++) {
    const [x, y] = p[i]!
    const [nx, ny] = p[i + 1]!
    d += ` Q${x.toFixed(1)} ${y.toFixed(1)} ${((x + nx) / 2).toFixed(1)} ${((y + ny) / 2).toFixed(1)}`
  }
  const last = p[p.length - 1]!
  return d + ` L${last[0].toFixed(1)} ${last[1].toFixed(1)}`
}
