import { useMemo, useState } from 'react'
import { legalActions, query, type BattleState, type BUnit, type TacticId } from '../../battle'
import type { BattleOutcome } from '../../contracts/battle'
import { CloudBand, LacquerBox, LacquerButton, Mirror, Portrait, StatDial } from '../ui'
import { TACTIC_NAME } from './eventLines'
import { PIGMENTS } from './layout'
import { confirm, escape, finishBattle, hoverTile, modeAction, setAiCommand, setMode, setSpeed, submit, useBattle } from './store'
import type { Speed } from './director'

const TROOP_NAME = { spear: 'Spearmen', cavalry: 'Cavalry', archer: 'Archers' } as const

function UnitCardBody({ state, id, pigments }: { state: BattleState; id: string; pigments: { attacker: string; defender: string } }) {
  const v = query.unitView(state, id)
  if (!v) return null
  const u = state.units.find((x) => x.id === id) as BUnit
  const hex = query.hexAt(state, v.q, v.r)
  const col = v.side === 'attacker' ? pigments.attacker : pigments.defender
  return (
    <div className="card" data-testid="unit-card">
      <div className="top">
        <Portrait id={u.officer.id} name={v.name} portrait={v.portrait} size={54} faction={col} rings={[{ value: v.troops / v.troopsStart, color: 'var(--vermilion)' }, { value: v.morale / 100, color: 'var(--ochre)' }]} />
        <div>
          <div className="nm">{v.name}</div>
          <div className="dust">{TROOP_NAME[v.type]} · {v.side}{v.commander ? ' · commander' : ''}</div>
        </div>
      </div>
      <div className="kv">
        <span>Troops</span><span className="num"><b>{v.troops}</b> / {v.troopsStart}</span>
        <span>Morale</span><span className="num">{v.morale}</span>
        <span>Health</span><span className="num">{v.health}</span>
        <span>Aptitude</span><span>{v.aptitudeRank} (x{v.aptitude.toFixed(2)}) · range {v.range} · move {v.movePoints}</span>
        <span>Terrain</span><span>{hex ? `${hex.name}, takes x${hex.defence.toFixed(2)}` : '-'}</span>
        {hex?.gateHp != null && (<><span>Gate</span><span className="num">{hex.gateHp} / {hex.gateMax}</span></>)}
      </div>
      <div className="stats">
        <StatDial label="War" value={v.stats.war} size={38} />
        <StatDial label="Ldr" value={v.stats.ldr} size={38} />
        <StatDial label="Int" value={v.stats.int} size={38} />
      </div>
      <div className="badges">
        {v.tactics.map((t) => <span className="badge" key={t}>{TACTIC_NAME[t]}</span>)}
        {v.confused && <span className="badge">Confused</span>}
        {v.taunted && <span className="badge">Taunted</span>}
        {v.onFire && <span className="badge">On fire</span>}
        {v.routed && <span className="badge">Routed</span>}
      </div>
    </div>
  )
}

function HexInfo({ state, q, r }: { state: BattleState; q: number; r: number }) {
  const h = query.hexAt(state, q, r)
  if (!h) return null
  return (
    <div className="card">
      <div className="nm">{h.name}</div>
      <div className="kv">
        <span>Takes</span><span>x{h.defence.toFixed(2)} damage</span>
        <span>Move cost</span><span>{h.passable ? `spear ${h.moveCost.spear} · cav ${h.moveCost.cavalry} · archer ${h.moveCost.archer}` : 'impassable'}</span>
        {h.burning > 0 && (<><span>Fire</span><span>burning, {h.burning} days</span></>)}
        {h.gateHp != null && (<><span>Gate</span><span className="num">{h.gateHp} / {h.gateMax}</span></>)}
      </div>
    </div>
  )
}

/** The hover / long-press card: the unit on the hovered tile, else the selected unit, else the active unit. */
export function CardPanel({ pigments, phone }: { pigments: { attacker: string; defender: string }; phone?: boolean }) {
  const state = useBattle((s) => s.state)
  const hover = useBattle((s) => s.hover)
  const selected = useBattle((s) => s.selected)
  const presV = useBattle((s) => s.presV)
  void presV
  if (!state) return null
  const onHex = hover ? state.units.find((u) => !u.routed && u.q === hover.q && u.r === hover.r) : null
  const id = onHex?.id ?? selected ?? state.active
  const unit = id ? state.units.find((u) => u.id === id && !u.routed) : null
  const body = unit ? <UnitCardBody state={state} id={unit.id} pigments={pigments} /> : hover ? <HexInfo state={state} q={hover.q} r={hover.r} /> : null
  if (!body) return null
  return <LacquerBox>{body}</LacquerBox>
  void phone
}

export function Initiative({ pigments }: { pigments: { attacker: string; defender: string } }) {
  const state = useBattle((s) => s.state)
  const pres = useBattle((s) => s.pres)
  const selected = useBattle((s) => s.selected)
  if (!state) return null
  const order = query.initiative(state)
  return (
    <div className="initiative" data-testid="initiative">
      <span className="day caps">Day {pres?.day ?? state.day}<br />of {state.setup.maxDays}</span>
      {order.map((id, i) => {
        const u = state.units.find((x) => x.id === id)
        if (!u) return null
        const col = u.side === 'attacker' ? pigments.attacker : pigments.defender
        return (
          <span key={id} className={`chip ${i === 0 ? 'active' : ''}`} data-unit={id} data-active={i === 0 ? '1' : '0'}>
            <Portrait id={u.officer.id} name={u.officer.name} portrait={u.officer.portrait} size={i === 0 ? 40 : 32} selected={i === 0 || selected === id} />
            <span className="sd" style={{ background: col }} />
          </span>
        )
      })}
    </div>
  )
}

export function Controls({ onToggleLog, logOpen }: { onToggleLog: () => void; logOpen: boolean }) {
  const speed = useBattle((s) => s.speed)
  const locked = useBattle((s) => s.speedLocked)
  const ai = useBattle((s) => s.aiCommand)
  const sp: Speed[] = ['normal', 'fast', 'instant']
  return (
    <div className="hud-ctl">
      <div className="seg" role="group" aria-label="Playback speed">
        {sp.map((s) => (
          <button key={s} type="button" id={`speed-${s}`} aria-pressed={speed === s} disabled={locked && s !== 'instant'} onClick={() => setSpeed(s)}>{s}</button>
        ))}
      </div>
      <button type="button" className="tgl" id="ai-toggle" aria-pressed={ai} onClick={() => setAiCommand(!ai)}><i />Let the AI command</button>
      <button type="button" className="tgl" id="log-toggle" aria-pressed={logOpen} onClick={onToggleLog}>Battle log</button>
    </div>
  )
}

export function Feed({ max = 60 }: { max?: number }) {
  const feed = useBattle((s) => s.feed)
  const lines = feed.slice(-max)
  return (
    <div className="feed" data-testid="feed" ref={(el) => { if (el) el.scrollTop = el.scrollHeight }}>
      {lines.length === 0 && <div className="dim">The battle has not begun.</div>}
      {lines.map((l) => (
        <div key={l.id} className={l.kind === 'dayStart' || l.kind === 'end' ? 'hi' : l.kind === 'turnStart' || l.kind === 'move' ? 'dim' : ''}>{l.text}</div>
      ))}
    </div>
  )
}

function range(min: number, max: number): string {
  return min === max ? `${min}` : `${min}-${max}`
}

/** Attack / Tactic / Challenge / Wait / Undo move / Retreat. Every button names its effect and shows numbers from query.*. */
export function ActionBar() {
  const state = useBattle((s) => s.state)
  const mode = useBattle((s) => s.mode)
  const playing = useBattle((s) => s.playing)
  const ai = useBattle((s) => s.aiCommand)
  const duelOpen = useBattle((s) => s.duelOpen)
  const rejected = useBattle((s) => s.rejected)
  const legal = useMemo(() => (state && !state.outcome && !state.pendingDuel ? legalActions(state) : []), [state])
  if (!state || state.outcome) return null
  const au = query.activeUnit(state)
  const mine = !!au && query.isPlayerUnit(state, au.id) && !ai
  if (!au) return null
  if (!mine || playing || duelOpen) {
    return (
      <div className="hint" data-testid="hint">
        {playing ? 'Playing the turn...' : ai ? `The AI commands: ${au.officer.name}'s turn.` : `${au.officer.name} (${au.side}) acts.`}
      </div>
    )
  }
  const name = (id: string): string => state.units.find((u) => u.id === id)?.officer.name ?? id
  const attacks = legal.filter((a) => a.kind === 'attack')
  const gates = legal.filter((a) => a.kind === 'attackGate')
  const challenges = legal.filter((a) => a.kind === 'challenge')
  const canWait = legal.some((a) => a.kind === 'wait')
  const canUndo = legal.some((a) => a.kind === 'undoMove')
  const canMove = legal.filter((a) => a.kind === 'move').length
  const known = query.knownTactics(state, au.id)
  const tacticLegal = (t: TacticId): number => legal.filter((a) => a.kind === 'tactic' && a.tactic === t).length
  const anyTactic = known.some((t) => tacticLegal(t) > 0)

  // the confirm line for the target the player has picked
  const act = modeAction(state, mode)
  let confirmBtn: React.ReactNode = null
  let hint = ''
  if (mode.kind === 'attack') {
    if (mode.target) {
      const pv = query.attackPreview(state, au.id, mode.target)
      confirmBtn = (
        <LacquerButton id="confirm" primary state="available" name={`${pv && pv.range > 1 ? 'Shoot' : 'Strike'} ${name(mode.target)}`}
          cost={pv ? `${range(pv.min, pv.max)} damage${pv.counter ? `, counter ${range(pv.counterMin, pv.counterMax)}` : ', no counter'}${pv.kills ? ', may rout them' : ''}` : ''} onClick={confirm} />
      )
    } else if (mode.gate) {
      const g = query.hexAt(state, mode.gate.q, mode.gate.r)
      confirmBtn = <LacquerButton id="confirm" primary state="available" name="Batter the gate" cost={g?.gateHp != null ? `Gate strength ${g.gateHp} of ${g.gateMax}` : ''} onClick={confirm} />
    } else hint = attacks.length + gates.length > 0 ? 'Tap an enemy or a gate in reach (dashed red).' : 'No target in reach.'
  } else if (mode.kind === 'tactic') {
    if (mode.target) {
      const pv = query.tacticPreview(state, au.id, mode.tactic, mode.target.q, mode.target.r)
      confirmBtn = (
        <LacquerButton id="confirm" primary state="available" name={`Cast ${TACTIC_NAME[mode.tactic]}`}
          cost={pv ? `${pv.chance}% to work. ${pv.hits.length ? `Damage ${pv.hits.map((h) => `${name(h.unit)} ${range(h.min, h.max)}`).join(', ')}. ` : ''}${pv.text}` : ''} onClick={confirm} />
      )
    } else hint = `${TACTIC_NAME[mode.tactic]}: tap a marked tile.`
  } else if (mode.kind === 'challenge') {
    if (mode.target) confirmBtn = <LacquerButton id="confirm" primary state="available" name={`Challenge ${name(mode.target)}`} cost="Fight a duel; the loser's unit loses 40 morale" onClick={confirm} />
    else hint = 'Tap an adjacent enemy officer.'
  } else if (mode.kind === 'retreat') {
    confirmBtn = <LacquerButton id="confirm" primary name="Retreat now" cost="Give up the battle: the enemy wins" onClick={() => act && submit(act)} />
    hint = 'Really retreat?'
  }

  const tacticRow = mode.kind === 'tacticMenu' || mode.kind === 'tactic'
  return (
    <>
      {(hint || rejected) && <div className="hint">{rejected || hint}</div>}
      {tacticRow && (
        <div className="actions sub" data-testid="tactic-bar">
          {known.map((t) => {
            const n = query.tacticTargets(state, au.id, t)
            const lg = tacticLegal(t)
            const ch = n.map((x) => x.chance)
            return (
              <LacquerButton key={t} id={`tactic-${t}`} name={TACTIC_NAME[t]} disabled={lg === 0}
                state={mode.kind === 'tactic' && mode.tactic === t ? 'selected' : lg ? 'available' : 'none'}
                cost={lg === 0 ? 'No target' : t === 'rally' ? '+15 morale to you and neighbours' : `${lg} target${lg > 1 ? 's' : ''}, ${range(Math.min(...ch), Math.max(...ch))}% to work`}
                onClick={() => setMode({ kind: 'tactic', tactic: t })} />
            )
          })}
          {known.length === 0 && <span className="dust" style={{ padding: 8 }}>This officer knows no tactics.</span>}
        </div>
      )}
      <div className="actions" data-testid="action-bar">
        {confirmBtn}
        <LacquerButton id="act-attack" name="Attack" state={mode.kind === 'attack' ? 'selected' : attacks.length + gates.length ? 'available' : 'none'} disabled={attacks.length + gates.length === 0}
          cost={attacks.length + gates.length ? `${attacks.length} unit${attacks.length === 1 ? '' : 's'}${gates.length ? ` and ${gates.length} gate${gates.length > 1 ? 's' : ''}` : ''} in reach` : 'Nothing in reach'}
          onClick={() => setMode(mode.kind === 'attack' ? { kind: 'idle' } : { kind: 'attack' })} />
        <LacquerButton id="act-tactic" name="Tactic" state={tacticRow ? 'selected' : anyTactic ? 'available' : 'none'} disabled={!anyTactic}
          cost={known.length ? (anyTactic ? `${known.map((t) => TACTIC_NAME[t]).join(', ')}` : 'No target') : 'Knows none'}
          onClick={() => setMode(tacticRow ? { kind: 'idle' } : { kind: 'tacticMenu' })} />
        <LacquerButton id="act-challenge" name="Challenge" state={mode.kind === 'challenge' ? 'selected' : challenges.length ? 'available' : 'none'} disabled={challenges.length === 0}
          cost={challenges.length ? `Duel ${challenges.map((c) => (c.kind === 'challenge' ? name(c.target) : '')).join(' or ')}` : 'Needs WAR 60 and an adjacent officer'}
          onClick={() => setMode(mode.kind === 'challenge' ? { kind: 'idle' } : { kind: 'challenge' })} />
        <LacquerButton id="act-wait" name="Wait" cost="End the turn without acting" disabled={!canWait} onClick={() => submit({ kind: 'wait', unit: au.id })} />
        <LacquerButton id="act-undo" name="Undo move" cost="Return to where the turn began" disabled={!canUndo} onClick={() => submit({ kind: 'undoMove', unit: au.id })} />
        <LacquerButton id="act-retreat" name="Retreat" state={mode.kind === 'retreat' ? 'selected' : 'none'} cost="Give up the battle" onClick={() => setMode(mode.kind === 'retreat' ? { kind: 'idle' } : { kind: 'retreat' })} />
        {canMove > 0 && mode.kind === 'idle' && <span className="dust" style={{ alignSelf: 'center', fontSize: 11.5, padding: '0 6px', whiteSpace: 'nowrap' }}>Tap a green tile to move</span>}
        {mode.kind !== 'idle' && <LacquerButton id="act-cancel" name="Cancel" cost="Back to moving" onClick={escape} />}
      </div>
    </>
  )
}

export function EndBanner({ outcome }: { outcome: BattleOutcome }) {
  const state = useBattle((s) => s.state)
  const side = state?.playerSide ?? null
  const won = side ? outcome.winner === side : null
  const REASON: Record<string, string> = { 'commander-routed': 'The enemy commander routed.', 'all-routed': 'Every enemy unit routed.', 'keep-taken': 'The keep was taken.', time: 'Time ran out and the defender held.', retreat: 'A side retreated.' }
  const lost = outcome.units.filter((u) => u.routed).length
  return (
    <div className="banner" data-testid="end-banner">
      <LacquerBox>
        <div className="bx">
          <h2 className="caps">{won === null ? `The ${outcome.winner} wins` : won ? 'Victory' : 'Defeat'}</h2>
          <div>{REASON[outcome.reason] ?? ''}</div>
          <div className="dust num">{outcome.days} days · {lost} units routed · {outcome.duels.length} duels</div>
          <LacquerButton id="battle-done" name="Continue" cost="Report the outcome" primary state="available" onClick={finishBattle} />
        </div>
      </LacquerBox>
    </div>
  )
}

export function Rim() {
  return <div style={{ position: 'absolute', left: 0, right: 0, top: 0, pointerEvents: 'none', zIndex: 6 }}><CloudBand /></div>
}

export function LogDrawer({ open }: { open: boolean }) {
  if (!open) return null
  return (
    <div className="hud" style={{ right: 8, bottom: 160, width: 'min(320px, calc(100% - 16px))', zIndex: 9 }}>
      <LacquerBox title="Battle log"><Feed max={40} /></LacquerBox>
    </div>
  )
}

export function Ticker() {
  const feed = useBattle((s) => s.feed)
  const last = feed[feed.length - 1]
  return <div className="ticker">{last?.text ?? ''}</div>
}

export function useLog(): [boolean, () => void] {
  const [open, setOpen] = useState(false)
  return [open, () => setOpen((o) => !o)]
}

export const _x = { PIGMENTS, Mirror, hoverTile }
