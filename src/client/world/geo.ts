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

// APPROXIMATE mountain ranges, hand-traced from memory, drawn as faint cloud-scroll hatching along the line.
// Decoration only. Points are [lon, lat].
export interface Range { id: string; name: string; points: [number, number][] }
export const RANGES: Range[] = [
  { id: 'qinling', name: 'Qinling', points: [[104.2, 34.1], [106, 33.9], [108, 33.9], [110, 33.9], [111.8, 34]] },
  { id: 'taihang', name: 'Taihang', points: [[112.4, 40.2], [113, 38.8], [113.5, 37.2], [113.7, 35.8], [113.5, 34.9]] },
  { id: 'qilian', name: 'Qilian', points: [[97.5, 39.3], [99.5, 38.5], [101.5, 37.8], [103.5, 37]] },
  { id: 'minshan', name: 'Min and Hengduan', points: [[103.2, 34.2], [103, 32.4], [102.2, 30.5], [101.4, 28.6]] },
  { id: 'daba', name: 'Daba', points: [[106.4, 32.4], [107.8, 31.8], [109.2, 31.4], [110.6, 31.2]] },
]

export interface Tuft { x: number; y: number; angle: number }
/** Tufts of hatching along a range: two staggered rows either side of the line, every `step` map units. */
export function rangeTufts(r: Range, step = 11): Tuft[] {
  const p = r.points.map(([lon, lat]) => [projectX(lon), projectY(lat)] as const)
  const out: Tuft[] = []
  let carry = 0
  let row = 0
  for (let i = 0; i < p.length - 1; i++) {
    const [x0, y0] = p[i]!
    const [x1, y1] = p[i + 1]!
    const len = Math.hypot(x1 - x0, y1 - y0)
    const ang = (Math.atan2(y1 - y0, x1 - x0) * 180) / Math.PI
    const nx = -(y1 - y0) / (len || 1)
    const ny = (x1 - x0) / (len || 1)
    for (let d = carry; d < len; d += step) {
      const f = d / (len || 1)
      const off = row % 2 ? 5 : -5
      out.push({ x: x0 + (x1 - x0) * f + nx * off, y: y0 + (y1 - y0) * f + ny * off, angle: ang })
      row++
    }
    carry = ((carry + Math.ceil((len - carry) / step) * step) - len)
  }
  return out
}

export interface LabelBox { id: string; x: number; y: number; r: number; w: number; h: number; weight: number }
export interface LabelPlace { dx: number; dy: number; anchor: 'start' | 'middle' | 'end' }

/** Collision pass: for each label (heaviest first) pick below / above / right / left of its mirror, whichever overlaps least
 *  against the mirrors and the labels already placed. Map units; `bounds` is the tray. Ties keep the order below, above, right, left. */
export function placeLabels(items: LabelBox[], circles: { x: number; y: number; r: number }[], bounds: { x: number; y: number; w: number; h: number }, avoid: { x: number; y: number; w: number; h: number }[] = []): Map<string, LabelPlace> {
  const placed: { x: number; y: number; w: number; h: number }[] = [...avoid]
  const out = new Map<string, LabelPlace>()
  const inter = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }): number =>
    Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y))
  for (const it of [...items].sort((a, b) => b.weight - a.weight)) {
    const cands: { p: LabelPlace; box: { x: number; y: number; w: number; h: number } }[] = [
      { p: { dx: 0, dy: it.r + it.h * 0.95, anchor: 'middle' }, box: { x: it.x - it.w / 2, y: it.y + it.r + 1, w: it.w, h: it.h } },
      { p: { dx: 0, dy: -it.r - 3, anchor: 'middle' }, box: { x: it.x - it.w / 2, y: it.y - it.r - 3 - it.h, w: it.w, h: it.h } },
      { p: { dx: it.r + 3, dy: it.h * 0.35, anchor: 'start' }, box: { x: it.x + it.r + 3, y: it.y - it.h / 2, w: it.w, h: it.h } },
      { p: { dx: -it.r - 3, dy: it.h * 0.35, anchor: 'end' }, box: { x: it.x - it.r - 3 - it.w, y: it.y - it.h / 2, w: it.w, h: it.h } },
      // diagonals, only when the four straight places all collide
      { p: { dx: it.r * 0.8 + 2, dy: it.r * 0.8 + it.h, anchor: 'start' }, box: { x: it.x + it.r * 0.8 + 2, y: it.y + it.r * 0.8 + 1, w: it.w, h: it.h } },
      { p: { dx: -it.r * 0.8 - 2, dy: it.r * 0.8 + it.h, anchor: 'end' }, box: { x: it.x - it.r * 0.8 - 2 - it.w, y: it.y + it.r * 0.8 + 1, w: it.w, h: it.h } },
      { p: { dx: it.r * 0.8 + 2, dy: -it.r * 0.8 - 2, anchor: 'start' }, box: { x: it.x + it.r * 0.8 + 2, y: it.y - it.r * 0.8 - 2 - it.h, w: it.w, h: it.h } },
      { p: { dx: -it.r * 0.8 - 2, dy: -it.r * 0.8 - 2, anchor: 'end' }, box: { x: it.x - it.r * 0.8 - 2 - it.w, y: it.y - it.r * 0.8 - 2 - it.h, w: it.w, h: it.h } },
    ]
    let best = cands[0]!
    let bestCost = Infinity
    for (const c of cands) {
      let cost = 0
      for (const q of placed) cost += inter(c.box, q) * 3
      for (const k of circles) {
        const cx = Math.max(c.box.x, Math.min(k.x, c.box.x + c.box.w))
        const cy = Math.max(c.box.y, Math.min(k.y, c.box.y + c.box.h))
        const d = Math.hypot(cx - k.x, cy - k.y)
        if (d < k.r + 1.5) cost += (k.r + 1.5 - d) * c.box.h * 1.2
      }
      const out2 = Math.max(0, bounds.x + 4 - c.box.x) + Math.max(0, c.box.x + c.box.w - (bounds.x + bounds.w - 4)) + Math.max(0, bounds.y + 4 - c.box.y) + Math.max(0, c.box.y + c.box.h - (bounds.y + bounds.h - 4))
      cost += out2 * c.box.h * 4
      if (c !== cands[0] && cands.indexOf(c) > 3) cost += 0.01 // prefer the straight places
      if (cost < bestCost - 1e-9) { bestCost = cost; best = c }
    }
    out.set(it.id, best.p)
    placed.push(best.box)
  }
  return out
}
