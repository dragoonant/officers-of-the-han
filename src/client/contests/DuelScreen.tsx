import { useCallback, useMemo, useState } from 'react'
import type { DuelOutcome, DuelSetup } from '../../contracts/contest'
import { createDuel, hitBase, query as duelQuery, stepDuel, STANCE_NAME, type DuelRound, type DuelState, type Side, type Stance } from '../../duel'
import { audioHooks } from '../audio/hooks'
import { useAudioScene } from '../audio/scene'
import { CloudBand, LacquerButton, Portrait } from '../ui'
import './contests.css'

const STANCE_HELP: Record<Stance, string> = {
  strike: 'Hits Feint hard; is countered by Guard',
  guard: 'Blocks Strike and counters it; broken by Feint',
  feint: 'Slips past Guard; loses to Strike',
  mighty: 'Hits for 2.5x. Uses all your spirit',
  yield: 'End the duel as a loss',
}

function describeRound(setup: DuelSetup, r: DuelRound): string {
  const an = setup.a.name
  const bn = setup.b.name
  const sa = STANCE_NAME[r.a]
  const sb = STANCE_NAME[r.b]
  if (r.a === 'yield' || r.b === 'yield') return `${r.a === 'yield' ? an : bn} yields.`
  const dealt = (n: string, d: number, o: string): string => (d > 0 ? `${n} hits ${o} for ${d}` : `${n} lands nothing`)
  return `${an} ${sa}, ${bn} ${sb}. ${dealt(an, r.dealtByA, bn)}; ${dealt(bn, r.dealtByB, an)}.`
}

/** Text the result line uses (also used by the lab and the battle feed). */
export function duelResultLine(setup: DuelSetup, o: DuelOutcome): string {
  if (!o.winner) return 'The duel ends in a draw.'
  const w = setup[o.winner].name
  const l = setup[o.winner === 'a' ? 'b' : 'a'].name
  return o.how === 'yield' ? `${l} yields to ${w}.` : `${w} knocks ${l} out.`
}

/**
 * The duel screen (30-duel-debate.md §1; 50-presentation.md "Duel"). Two mirrors face each other with vigor (outer ring) and spirit (inner ring);
 * the AI's stance odds come from duel.query.duelTells. If neither side is the player, a Next round button steps it. Calls onDone once, after
 * the player presses Continue on the result.
 */
export function DuelScreen({ setup, onDone }: { setup: DuelSetup; onDone: (o: DuelOutcome) => void }) {
  useAudioScene('duel')
  const [st, setSt] = useState<DuelState>(() => createDuel(setup))
  const [last, setLast] = useState<DuelRound | null>(null)
  const [msg, setMsg] = useState('')
  const me: Side | null = setup.a.player ? 'a' : setup.b.player ? 'b' : null
  const them: Side = me === 'a' ? 'b' : 'a'
  const play = useCallback(
    (stance?: Stance) => {
      const r = stepDuel(st, { stance })
      if (!r.ok) {
        setMsg(r.message)
        return
      }
      setMsg('')
      for (const e of r.events) if (e.kind === 'round') { setLast(e.record); audioHooks.duelRound(e.record) }
      setSt(r.state)
    },
    [st],
  )
  const legal = useMemo(() => (me ? duelQuery.legalStances(st, me) : []), [st, me])
  const tellsOf = (s: Side) => duelQuery.duelTells(st, s)
  const sideView = (s: Side) => {
    const c = setup[s]
    const vmax = st.vigorMax[s]
    return (
      <div className="side" data-side={s}>
        <Portrait id={c.id} name={c.name} portrait={c.portrait} size={150} rings={[{ value: st.vigor[s] / vmax, color: 'var(--vermilion)' }, { value: st.spirit[s] / 100, color: 'var(--ochre)' }]} />
        <div className="nm caps">{c.name}{c.player ? ' (you)' : ''}</div>
        <div className="meter">
          <span>Vigor <b className="num" data-testid={`vigor-${s}`}>{Math.max(0, st.vigor[s])}</b>/{vmax}</span>
          <span>Spirit <b className="num">{st.spirit[s]}</b>/100</span>
        </div>
        <div className="dust" style={{ fontSize: 11.5 }}>Hit {hitBase(c)}+ · {c.temperament}</div>
        {!st.outcome && !c.player && (
          <div className="tells" aria-label={`${c.name}'s stance odds`}>
            {tellsOf(s).tells.map((t) => (
              <div key={t.stance} className="t">
                <span>{STANCE_NAME[t.stance]}</span>
                <span className="bar"><i style={{ width: `${t.pct}%` }} /></span>
                <span className="num">{t.pct}%</span>
              </div>
            ))}
            {tellsOf(s).forced && <div className="dust" style={{ fontSize: 11 }}>Certain this round.</div>}
          </div>
        )}
      </div>
    )
  }
  const out = st.outcome
  return (
    <div className="contest" data-testid="duel-screen">
      <div className="rim"><CloudBand /></div>
      <div className="head">
        <h2 className="caps">Duel</h2>
        <span className="dust" style={{ fontSize: 12 }}>{out ? 'Finished' : `Round ${st.round} of 10`}</span>
      </div>
      <div className="faceoff">
        {sideView('a')}
        <div className="vs caps">vs</div>
        {sideView('b')}
      </div>
      <div className="log" data-testid="duel-log">{msg || (last ? describeRound(setup, last) : 'Choose a stance. The odds under the mirror show how your opponent will choose.')}</div>
      {!out && me && (
        <div className="actions">
          {(['strike', 'guard', 'feint', 'mighty'] as Stance[]).map((s) => (
            <LacquerButton
              key={s}
              id={`stance-${s}`}
              name={STANCE_NAME[s]}
              cost={s === 'mighty' && !legal.includes('mighty') ? `Needs spirit 100 (you have ${st.spirit[me]})` : STANCE_HELP[s]}
              disabled={!legal.includes(s)}
              state={legal.includes(s) ? 'available' : 'none'}
              onClick={() => play(s)}
            />
          ))}
          <LacquerButton id="stance-yield" name="Yield" cost={STANCE_HELP.yield} onClick={() => play('yield')} />
        </div>
      )}
      {!out && !me && <LacquerButton id="duel-next" name="Next round" cost="Both duelists are the AI" primary onClick={() => play()} />}
      {out && (
        <div className="result" data-testid="duel-result">
          <div className="caps ochre">{out.winner ? `${setup[out.winner].name} wins` : 'Draw'}</div>
          <div className="dust" style={{ fontSize: 12.5 }}>{duelResultLine(setup, out)} Rounds {out.rounds}. Vigor left {out.vigorLeft.a} to {out.vigorLeft.b}.</div>
          <LacquerButton id="duel-done" name="Continue" cost="Return" primary state="available" onClick={() => onDone(out)} />
        </div>
      )}
    </div>
  )
}
