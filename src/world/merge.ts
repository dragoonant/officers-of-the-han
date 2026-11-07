// W-DIP-4: on a yes to "demand surrender", every city and officer of the target joins the demander.
import { C, F, O, type Ctx, factionName, log, sortedIds } from './core'

export function mergeFaction(c: Ctx, from: string, into: string): void {
  const f = F(c, from)
  if (!f.alive || !F(c, into).alive) return
  for (const cid of c.d.cityIds) if (C(c, cid).faction === from) C(c, cid).faction = into
  for (const id of sortedIds(c.s.officers)) {
    const o = O(c, id)
    if (o.faction !== from) continue
    if (o.status === 'dead' || o.status === 'unborn') continue
    o.faction = into
    if (o.post === 'ruler') { o.post = 'officer'; o.loyalty = 60 } else if (o.loyalty === null && o.status !== 'captive') o.loyalty = 60
    o.mission = null
  }
  for (const a of c.s.armies) if (a.faction === from) a.faction = into
  c.s.pacts = c.s.pacts.filter((p) => p.a !== from && p.b !== from)
  f.alive = false
  log(c, 'fall', `${f.name} submitted to ${factionName(c, into)}.`, [f.ruler])
}
