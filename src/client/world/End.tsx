// W-END-1..3: the end of the chronicle, with a summary of the player's officers from the log.
import type { LogEntry, WorldState } from '../../contracts/world'
import { useGame } from '../store/game'
import { ymText } from '../save/save'
import { LogRow } from './Views'
import { factionNameOf, nameOf } from './lookup'
import { CloudBand, LacquerButton } from './seam'

/** Every officer the player has been: the current one, the first ("begins" line) and anyone named in a succession. */
export function lineage(s: WorldState, first?: string): string[] {
  const ids = new Set<string>([s.player])
  if (first) ids.add(first)
  for (const e of s.log) {
    if (e.kind === 'succession') e.officers.forEach((o) => ids.add(o))
    if (e.kind === 'event' && /begins\.$/.test(e.text) && e.officers[0]) ids.add(e.officers[0])
  }
  return [...ids]
}

export interface Summary {
  lines: LogEntry[]
  counts: Record<string, number>
  first: string | null
  last: string | null
}

export function summarise(s: WorldState, ids: string[]): Summary {
  const set = new Set(ids)
  const lines = s.log.filter((e) => e.officers.some((o) => set.has(o)))
  const counts: Record<string, number> = {}
  for (const e of lines) counts[e.kind] = (counts[e.kind] ?? 0) + 1
  return { lines, counts, first: s.log[0] ? ymText(s.log[0].ym) : null, last: lines.length ? ymText(lines[lines.length - 1]!.ym) : null }
}

export function End() {
  const s = useGame((g) => g.state)
  const opts = useGame((g) => g.opts)
  const goTitle = useGame((g) => g.goTitle)
  if (!s || !s.ended) return null
  const firstId = opts && typeof opts.officer === 'string' ? opts.officer : undefined
  const ids = lineage(s, firstId)
  const sum = summarise(s, ids)
  const e = s.ended
  const winner = e.faction ? factionNameOf(s, e.faction) : null
  const title = e.kind === 'unified' ? 'The realm is yours' : e.kind === 'another-unified' ? 'Another house unites the realm' : 'The chronicle closes'
  const text = e.kind === 'unified'
    ? `Every city flies the colours of ${winner}, the house you served. The age of war is over.`
    : e.kind === 'another-unified'
      ? `${winner} holds every city. Your tale ends under another banner.`
      : 'Your line has ended and no one remains to carry it on. The chronicle is closed.'
  const c = sum.counts
  return (
    <div className="title" data-testid="end-screen">
      <div className="rim top"><CloudBand drift /></div>
      <div className="lbox wide" style={{ maxHeight: '88dvh' }}>
        <div className="band"><CloudBand /></div>
        <div className="inner">
          <h1 style={{ fontSize: 22, color: 'var(--ochre)', textAlign: 'left' }}>{title}</h1>
          <p>{text} It is {ymText(s.ym)}.</p>
          <div className="sec">Your officers</div>
          <div>{ids.map((i) => nameOf(s, i)).join(', ')}</div>
          <div className="kv" style={{ marginTop: 6 }}>
            <div><span>Chronicle entries</span><span>{sum.lines.length}</span></div>
            <div><span>Battles</span><span>{(c.battle ?? 0) + (c.war ?? 0)}</span></div>
            <div><span>Duels</span><span>{c.duel ?? 0}</span></div>
            <div><span>Oaths and marriages</span><span>{(c.oath ?? 0) + (c.marry ?? 0)}</span></div>
            <div><span>Posts and houses</span><span>{(c.join ?? 0) + (c.appoint ?? 0) + (c.claim ?? 0) + (c.resign ?? 0) + (c.defect ?? 0)}</span></div>
            <div><span>Captures</span><span>{c.capture ?? 0}</span></div>
          </div>
          <div className="sec">Their chronicle</div>
          <div style={{ maxHeight: '32dvh', overflow: 'auto' }}>
            {sum.lines.length === 0 && <div className="dust">Nothing was recorded.</div>}
            {sum.lines.slice(-200).map((l, i) => <LogRow key={i} s={s} e={l} />)}
          </div>
          <div style={{ marginTop: 12 }}><LacquerButton primary big testid="end-title" onClick={goTitle}>Return to the title<span className="sub">The finished game's save is cleared</span></LacquerButton></div>
        </div>
      </div>
    </div>
  )
}
