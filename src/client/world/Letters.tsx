// Pending decisions as silk letters (and the hand-off to the battle, duel and debate screens).
import { useState } from 'react'
import type { Pending, WorldAction, WorldState } from '../../contracts/world'
import { world } from '../../world'
import { useGame } from '../store/game'
import { ymText } from '../save/save'
import { money } from './format'
import { cityNameOf, factionNameOf, nameOf } from './lookup'
import { BattleScreen, DebateScreen, DuelScreen, LacquerButton, SilkLetter } from './seam'
import { OfficerChip } from './Views'

function useAnswer() {
  const act = useGame((g) => g.act)
  const [err, setErr] = useState<string | null>(null)
  return { err, answer: (a: WorldAction): void => { const r = act(a); setErr(r.ok ? null : r.fail.message) } }
}

function Count({ s }: { s: WorldState }) {
  return s.pending.length > 1 ? <span> - letter 1 of {s.pending.length}</span> : null
}

function Answers({ children, err }: { children: React.ReactNode; err: string | null }) {
  return (
    <>
      {err && <div className="err" data-testid="letter-error">{err}</div>}
      <div className="answers">{children}</div>
    </>
  )
}

export function Letters({ s }: { s: WorldState }) {
  const p = s.pending[0]
  if (!p) return null
  return <Letter key={p.id} s={s} p={p} />
}

function Letter({ s, p }: { s: WorldState; p: Pending }) {
  const { err, answer } = useAnswer()
  const stored = useGame((g) => g.battle)
  const setBattle = useGame((g) => g.setBattle)
  const [open, setOpen] = useState(false)
  switch (p.kind) {
    case 'letter':
      return (
        <SilkLetter title={p.title} from={<>A letter<Count s={s} /></>}>
          <p>{p.text}</p>
          <Answers err={err}><LacquerButton primary testid="answer-ack" onClick={() => answer({ kind: 'ack', pending: p.id })}>Understood<span className="sub">Close this letter</span></LacquerButton></Answers>
        </SilkLetter>
      )
    case 'eventChoice':
      return (
        <SilkLetter title={p.title} from={<>Events of the age<Count s={s} /></>}>
          <p>{p.text}</p>
          <Answers err={err}>
            {p.options.map((o, i) => <LacquerButton key={i} primary={i === 0} testid={`answer-choose-${i}`} onClick={() => answer({ kind: 'choose', pending: p.id, option: i })}>{o.label}</LacquerButton>)}
          </Answers>
        </SilkLetter>
      )
    case 'offer': {
      const from = nameOf(s, p.from)
      const fo = s.officers[p.from]
      const house = factionNameOf(s, fo?.faction ?? null)
      const yes = { recruit: `Join the house of ${house}`, oath: `Swear the oath with ${from}`, marry: `Accept the marriage with ${from}`, mission: 'Accept the mission' }[p.offer]
      const no = { recruit: 'Decline and stay as you are', oath: `Refuse ${from}'s oath`, marry: 'Decline the marriage', mission: 'Refuse the mission' }[p.offer]
      const subYes = p.offer === 'mission' && p.mission ? `Due by the end of ${ymText(p.mission.deadline)}; merit and standing ride on it` : p.offer === 'recruit' ? `You leave your current post and serve ${from}` : undefined
      return (
        <SilkLetter title={{ recruit: 'An offer of service', oath: 'An offer of brotherhood', marry: 'An offer of marriage', mission: 'A mission from your lord' }[p.offer]} from={<>From {from}<Count s={s} /></>}>
          <div style={{ margin: '4px 0' }}><OfficerChip s={s} id={p.from} /></div>
          <p>{p.text}</p>
          <Answers err={err}>
            <LacquerButton primary testid="answer-accept" onClick={() => answer({ kind: 'answerOffer', pending: p.id, accept: true })}>{yes}{subYes ? <span className="sub">{subYes}</span> : null}</LacquerButton>
            <LacquerButton className="plain" testid="answer-decline" onClick={() => answer({ kind: 'answerOffer', pending: p.id, accept: false })}>{no}</LacquerButton>
          </Answers>
        </SilkLetter>
      )
    }
    case 'captured': {
      const c = nameOf(s, p.captor)
      return (
        <SilkLetter title="You are taken prisoner" from={<>Captor: {c}<Count s={s} /></>}>
          <p>{p.text}</p>
          <Answers err={err}>
            {p.canJoin && <LacquerButton primary testid="answer-join" onClick={() => answer({ kind: 'answerCaptured', pending: p.id, join: true })}>Swear service to {c}<span className="sub">You join their house</span></LacquerButton>}
            <LacquerButton className="plain" testid="answer-refuse" onClick={() => answer({ kind: 'answerCaptured', pending: p.id, join: false })}>Refuse and take what comes<span className="sub">Your captor decides your fate</span></LacquerButton>
          </Answers>
        </SilkLetter>
      )
    }
    case 'chooseDefenders':
      return <Defenders s={s} p={p} answer={answer} err={err} />
    case 'chooseSuccessor':
      return (
        <SilkLetter title="Who carries on your line?" from={<>Your officer has died<Count s={s} /></>}>
          <p>Choose the officer you will play from here. Their kin, oath siblings and close friends may take your place.</p>
          <div className="answers">
            {p.candidates.map((id) => {
              const v = world.query.officerView(s, id)
              return (
                <LacquerButton key={id} testid={`successor-${id}`} onClick={() => answer({ kind: 'chooseSuccessor', pending: p.id, officer: id })}>
                  Play as {nameOf(s, id)}
                  <span className="sub">{v ? `${v.rankName} at ${v.cityName ?? 'unknown'}; WAR ${v.stats.war} LDR ${v.stats.ldr} INT ${v.stats.int} POL ${v.stats.pol} CHA ${v.stats.cha}` : ''}</span>
                </LacquerButton>
              )
            })}
          </div>
          {err && <div className="err">{err}</div>}
        </SilkLetter>
      )
    case 'battle': {
      const mine = p.setup.units.filter((u) => p.setup.playerControls.includes(u.officer.id))
      const att = p.setup.units.filter((u) => u.side === 'attacker')
      const def = p.setup.units.filter((u) => u.side === 'defender')
      const sum = (us: typeof att): number => us.reduce((a, u) => a + u.troops, 0)
      if (!open && !stored) {
        return (
          <SilkLetter title={`Battle at ${p.setup.cityName}`} from={<>A battle letter<Count s={s} /></>} testid="battle-letter">
            <p>{factionNameOf(s, p.setup.attackerFaction)} marches on {p.setup.cityName}, held by {factionNameOf(s, p.setup.defenderFaction)}. The attackers field {att.length} units ({money(sum(att))} troops); the defenders {def.length} ({money(sum(def))}).</p>
            <p>{mine.length ? `You command ${mine.map((u) => u.officer.name).join(', ')}.` : 'You do not command in this battle.'}</p>
            <Answers err={err}><LacquerButton primary testid="battle-open" onClick={() => setOpen(true)}>Take the field<span className="sub">Open the battle board</span></LacquerButton></Answers>
          </SilkLetter>
        )
      }
      return (
        <div className="fullscreen" style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'var(--lacquer)' }} data-testid="battle-screen">
          <BattleScreen setup={p.setup} {...(stored ? { initial: stored } : {})} onChange={setBattle} onDone={(outcome) => answer({ kind: 'resolveBattle', pending: p.id, outcome })} />
          {err && <div className="toast">{err}</div>}
        </div>
      )
    }
    case 'duel':
      return (
        <div className="fullscreen" style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'var(--lacquer)' }} data-testid="duel-screen">
          <DuelScreen setup={p.setup} onDone={(outcome) => answer({ kind: 'resolveDuel', pending: p.id, outcome })} />
          {err && <div className="toast">{err}</div>}
        </div>
      )
    case 'debate':
      return (
        <div className="fullscreen" style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'var(--lacquer)' }} data-testid="debate-screen">
          <DebateScreen setup={p.setup} onDone={(outcome) => answer({ kind: 'resolveDebate', pending: p.id, outcome })} />
          {err && <div className="toast">{err}</div>}
        </div>
      )
  }
}

function Defenders({ s, p, answer, err }: { s: WorldState; p: Extract<Pending, { kind: 'chooseDefenders' }>; answer: (a: WorldAction) => void; err: string | null }) {
  const army = s.armies.find((a) => a.id === p.armyId)
  const city = world.query.cityView(s, p.city)
  const [chosen, setChosen] = useState<string[]>(() => p.candidates.slice(0, p.max))
  const toggle = (id: string): void => setChosen((c) => (c.includes(id) ? c.filter((x) => x !== id) : c.length < p.max ? [...c, id] : c))
  const power = army ? world.query.armyPower(s, army) : null
  return (
    <SilkLetter title={`${cityNameOf(p.city)} is attacked`} from={<>Chief of the guard<Count s={s} /></>} testid="defenders-letter">
      <p>{army ? `${factionNameOf(s, army.faction)} marches on ${cityNameOf(p.city)} with ${power ? `${money(power.troops)} troops (power ${money(power.power)})` : 'an army'}.` : ''} The city holds {money(city?.troops ?? 0)} troops, defence power {money(city?.defencePower ?? 0)}. Choose up to {p.max} officers to lead the defence; the rest of the garrison holds the walls.</p>
      <div className="chips">{p.candidates.map((id) => <OfficerChip key={id} s={s} id={id} selected={chosen.includes(id)} onClick={() => toggle(id)} />)}</div>
      <Answers err={err}>
        <LacquerButton primary testid="answer-defenders" onClick={() => answer({ kind: 'setDefenders', pending: p.id, officers: chosen })}>
          {chosen.length ? `Defend with ${chosen.map((c) => nameOf(s, c)).join(', ')}` : 'Leave the garrison to hold alone'}
          <span className="sub">{chosen.length} of {p.max} chosen</span>
        </LacquerButton>
      </Answers>
    </SilkLetter>
  )
}

