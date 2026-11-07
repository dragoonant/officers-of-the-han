import { useCallback, useState } from 'react'
import type { DebateOutcome, DebateSetup } from '../../contracts/contest'
import { createDebate, debateTells, force, KIND_NAME, MAX_ROUNDS, parseTablet, stepDebate, type ArgKind, type DebateRound, type DebateState, type Side, type TabletId } from '../../debate'
import { audioHooks } from '../audio/hooks'
import { useAudioScene } from '../audio/scene'
import { CloudBand, LacquerButton, Portrait } from '../ui'
import './contests.css'

function Glyph({ kind }: { kind: ArgKind }) {
  const c = 'var(--ochre)'
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {kind === 'reason' && <path d="M4 7h16M4 12h16M4 17h10" />}
      {kind === 'precedent' && <path d="M6 4h10a2 2 0 0 1 2 2v14H8a2 2 0 0 1-2-2zM9 9h6M9 13h6" />}
      {kind === 'appeal' && <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.4A4 4 0 0 1 19 10c0 5.600-7 10-7 10z" />}
      {kind === 'scorn' && <path d="M12 3l3 8h6l-5 4 2 7-6-4-6 4 2-7-5-4h6z" />}
    </svg>
  )
}

function Tally({ id, c, hint, onPlay, chosen, hidden }: { id: TabletId; c: DebateSetup['a']; hint?: string; onPlay?: () => void; chosen?: boolean; hidden?: boolean }) {
  const t = parseTablet(id)
  if (!t) return null
  if (hidden) {
    return <div className="tally back"><span className="kn">Committed</span><span className="sub">Face down until you play</span></div>
  }
  return (
    <button type="button" id={`tablet-${id}`} data-kind={t.kind} className={`tally ${onPlay ? 'play' : ''} ${chosen ? 'chosen' : ''}`} disabled={!onPlay} onClick={onPlay} aria-label={`${KIND_NAME[t.kind]} ${t.power}`}>
      <span className="kn">{KIND_NAME[t.kind]}</span>
      <Glyph kind={t.kind} />
      <span className="pw num">{t.power}</span>
      <span className="sub">force {force(t, c)}{hint ? <><br />{hint}</> : null}</span>
    </button>
  )
}

function describe(setup: DebateSetup, r: DebateRound): string {
  const ta = r.a ? parseTablet(r.a) : null
  const tb = r.b ? parseTablet(r.b) : null
  if (!ta || !tb) return 'Nothing was played.'
  const head = `${setup.a.name} plays ${KIND_NAME[ta.kind]} ${ta.power}, ${setup.b.name} plays ${KIND_NAME[tb.kind]} ${tb.power}.`
  if (r.damageToA === 0 && r.damageToB === 0) return `${head} Neither gains ground.`
  return `${head} ${r.damageToB > 0 ? `${setup.b.name} loses ${r.damageToB} composure.` : ''}${r.damageToA > 0 ? ` ${setup.a.name} loses ${r.damageToA} composure.` : ''}`
}

/**
 * The debate screen (30-duel-debate.md §2). Both hands face up as lacquered tallies; the AI's committed odds (debate.query.debateTells) show
 * as percentages over its tablets. If neither side is the player, a Next round button steps it. onDone fires once on Continue.
 */
export function DebateScreen({ setup, onDone }: { setup: DebateSetup; onDone: (o: DebateOutcome) => void }) {
  useAudioScene('debate')
  const [st, setSt] = useState<DebateState>(() => createDebate(setup))
  const [last, setLast] = useState<DebateRound | null>(null)
  const [msg, setMsg] = useState('')
  const me: Side | null = setup.a.player ? 'a' : setup.b.player ? 'b' : null
  const play = useCallback(
    (tablet?: TabletId) => {
      const r = stepDebate(st, { tablet })
      if (!r.ok) {
        setMsg(r.message)
        return
      }
      setMsg('')
      for (const e of r.events) if (e.kind === 'round') setLast(e.record)
      audioHooks.debateTally()
      if (r.state.outcome) audioHooks.debateResult(me ? r.state.outcome.winner === me : null)
      setSt(r.state)
    },
    [st],
  )
  const out = st.outcome
  const portrait = (s: Side) => {
    const c = setup[s]
    return (
      <div className="side" data-side={s}>
        <Portrait id={c.id} name={c.name} portrait={c.portrait} size={104} rings={[{ value: Math.max(0, st.composure[s]) / st.start[s], color: 'var(--vermilion)' }]} />
        <div className="nm caps">{c.name}{c.player ? ' (you)' : ''}</div>
        <div className="meter"><span>Composure <b className="num" data-testid={`composure-${s}`}>{Math.max(0, st.composure[s])}</b>/{st.start[s]}</span></div>
      </div>
    )
  }
  const other: Side = me === 'a' ? 'b' : 'a'
  const oppTells = !out ? debateTells(st, other) : []
  const myTells = me && !out ? debateTells(st, me) : []
  return (
    <div className="contest" data-testid="debate-screen">
      <div className="rim"><CloudBand /></div>
      <div className="head">
        <h2 className="caps">Debate</h2>
        <span className="dust" style={{ fontSize: 12 }}>{out ? 'Finished' : `Round ${st.round} of ${MAX_ROUNDS}`} · Reason beats Appeal, Appeal beats Scorn, Scorn beats Reason</span>
      </div>
      <div className="faceoff">
        {portrait('a')}
        <div className="vs caps">vs</div>
        {portrait('b')}
      </div>
      {!out && (
        <div className="tray" aria-label="Opponent's tablets">
          <div className="lbl caps"><span>{setup[me ? other : 'b'].name}'s tablets (face up)</span></div>
          <div className="hand">
            {st.hands[me ? other : 'b'].map((id) => {
              const tl = (me ? oppTells : debateTells(st, 'b')).find((t) => t.tablet === id)
              return <Tally key={id} id={id} c={setup[me ? other : 'b']} hint={tl ? `will play ${tl.pct}%` : undefined} />
            })}
          </div>
        </div>
      )}
      <div className="log" data-testid="debate-log">{msg || (last ? describe(setup, last) : 'Play a tablet. The percentages over your opponent\'s tablets show how it will choose.')}</div>
      {!out && me && (
        <div className="tray" aria-label="Your tablets">
          <div className="lbl caps"><span>Your tablets</span><span className="dust">{st.deck.length} left in the deck</span></div>
          <div className="hand">
            {st.hands[me].map((id) => {
              const tl = myTells.find((t) => t.tablet === id)
              return <Tally key={id} id={id} c={setup[me]} hint={tl ? `expect +${tl.expectedDealt.toFixed(1)} / -${tl.expectedTaken.toFixed(1)}` : undefined} onPlay={() => play(id)} />
            })}
          </div>
        </div>
      )}
      {!out && !me && <LacquerButton id="debate-next" name="Next round" cost="Both debaters are the AI" primary onClick={() => play()} />}
      {out && (
        <div className="result" data-testid="debate-result">
          <div className="caps ochre">{setup[out.winner].name} wins the argument</div>
          <div className="dust" style={{ fontSize: 12.5 }}>Rounds {out.rounds}. Composure left {out.composureLeft.a} to {out.composureLeft.b}.</div>
          <LacquerButton id="debate-done" name="Continue" cost="Return" primary state="available" onClick={() => onDone(out)} />
        </div>
      )}
    </div>
  )
}
