// The bottom bar: Work / People / Court / Travel / Self, from query.actionsHere. Every button names what it does,
// its days and gold, and the chance where rolled; an unavailable one shows the engine's reason inline.
import { useMemo } from 'react'
import type { WorldState } from '../../contracts/world'
import { world } from '../../world'
import type { ActionGroup, ActionItem } from '../../world/types'
import { useGame } from '../store/game'
import { useUi } from '../store/ui'
import { chanceText, costText } from './format'
import { DIALOG_KINDS } from './Dialogs'
import { LacquerButton } from './seam'

export const GROUPS: ActionGroup[] = ['Work', 'People', 'Court', 'Travel', 'Self']

/** Unavailable items of one kind that share a reason collapse into one button (a wanderer's ten travel targets, say). */
export function collapseItems(items: ActionItem[]): ActionItem[] {
  const out: ActionItem[] = []
  const seen = new Set<string>()
  for (const it of items) {
    if (!it.available) {
      const key = `${it.kind}|${it.reason}`
      if (items.filter((x) => !x.available && x.kind === it.kind && x.reason === it.reason).length > 1) {
        if (seen.has(key)) continue
        seen.add(key)
        out.push({ ...it, label: it.kind === 'travel' ? 'Travel' : it.label.replace(/ (to|INT|POL|WAR|LDR).*$/, '') })
        continue
      }
    }
    out.push(it)
  }
  return out
}

export function ActionBar({ s }: { s: WorldState }) {
  const act = useGame((g) => g.act)
  const group = useUi((u) => u.group)
  const setGroup = useUi((u) => u.setGroup)
  const setDialog = useUi((u) => u.setDialog)
  const items = useMemo(() => world.query.actionsHere(s), [s])
  const mine = collapseItems(items.filter((i) => i.group === group))
  const me = s.officers[s.player]
  const days = me?.days ?? 0
  const counts = (g: ActionGroup): number => items.filter((i) => i.group === g && i.available).length
  const run = (it: ActionItem): void => {
    if (!it.available) return
    if (DIALOG_KINDS.has(it.kind)) setDialog(it.kind)
    else act(it.action)
  }
  return (
    <div className="actionbar" data-testid="actionbar">
      <div className="tabs">
        {GROUPS.map((g) => <button key={g} className={`tab${g === group ? ' on' : ''}`} onClick={() => setGroup(g)} data-testid={`tab-${g}`}>{g} <span className="dust">{counts(g)}</span></button>)}
        <LacquerButton small primary className="endm" testid="end-month" available onClick={() => (days > 0 ? setDialog('endMonth') : act({ kind: 'endMonth' }))}>End Month<span className="sub">{days > 0 ? `${days} days unspent` : 'All days spent'}</span></LacquerButton>
      </div>
      <div className="actions">
        {mine.map((it, i) => {
          const ch = it.available ? it.chance : null
          const what = it.available && it.chance !== null ? world.query.chanceOf(s, it.action)?.what : undefined
          return (
            <LacquerButton key={`${it.kind}${i}${it.label}`} testid={`act-${it.kind}`} disabled={!it.available} available={it.available} onClick={() => run(it)}>
              {it.label}
              <span className="sub">{costText(it.days, it.gold)}</span>
              {ch !== null && <span className="sub">{chanceText(ch, what)}</span>}
              {!it.available && it.reason && <span className="why">{it.reason}</span>}
            </LacquerButton>
          )
        })}
        {mine.length === 0 && <span className="dust">Nothing to show here.</span>}
      </div>
    </div>
  )
}
