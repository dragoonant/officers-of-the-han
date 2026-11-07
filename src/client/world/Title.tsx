import { useState } from 'react'
import { useGame } from '../store/game'
import { useUi } from '../store/ui'
import { LacquerButton, SilkLetter } from './seam'

export function HowToPlay({ onClose }: { onClose: () => void }) {
  return (
    <SilkLetter title="How to play" from="A letter for a new officer" testid="howto">
      <p>You are one officer in a living realm of nearly two hundred, in the winter of 190. Every other officer lives under the same rules as you.</p>
      <p><b>A month has 30 days.</b> Each action costs days, and sometimes gold. Spend them on work in your city, on visiting and winning friends, on travel, or on your own training. When you are done, press End Month and the whole world takes its turn.</p>
      <p><b>Rank comes from merit.</b> Rise from attendant to grand general and you may lead more troops. A prefect rules a city, a ruler rules a house and may send armies and envoys. A wanderer serves no one and may recruit, claim an empty city, or raise a rebellion.</p>
      <p>Letters arrive when something needs your answer: offers, events, captures, battles, duels and debates. The map shows cities as bronze mirrors, ringed in the colour of their house. Tap one to read its numbers. Drag to move the map, pinch or use the wheel to zoom.</p>
      <p><b>Saving.</b> The game saves after every action, and Continue on the title page reopens it. Saves live in this browser, per site address: the same game opened from another address, or in another browser, starts empty.</p>
      <div className="answers"><LacquerButton primary onClick={onClose} testid="howto-close">Understood<span className="sub">Close this letter</span></LacquerButton></div>
    </SilkLetter>
  )
}

export function Title() {
  const saveRead = useGame((g) => g.saveRead)
  const goNew = useGame((g) => g.goNew)
  const cont = useGame((g) => g.continueSaved)
  const discard = useGame((g) => g.discardSave)
  const panel = useUi((u) => u.panel)
  const setPanel = useUi((u) => u.setPanel)
  const [confirmNew, setConfirmNew] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const hasSave = saveRead.kind === 'ok'
  const broken = saveRead.kind === 'corrupt' || saveRead.kind === 'missing-content'
  return (
    <div className="title" data-testid="title">
      <div className="lacq" aria-hidden="true" data-testid="title-tray">
        <div className="flow top" /><div className="flow right" /><div className="flow bottom" /><div className="flow left" />
      </div>
      <h1><small>An officer's life in the Han</small><span className="inlay">Officers of the Han</span></h1>
      <div className="menu">
        <LacquerButton big primary={hasSave} disabled={!hasSave} available={hasSave} testid="continue" onClick={() => cont()}>
          Continue
          <span className="continue-line" data-testid="continue-line">
            {saveRead.kind === 'ok' ? saveRead.line.text : saveRead.kind === 'none' ? 'No saved game in this browser' : 'The saved game cannot be opened'}
          </span>
        </LacquerButton>
        <LacquerButton big available testid="new-officer" onClick={() => (hasSave || broken ? setConfirmNew(true) : goNew())}>New Officer<span className="continue-line dust">Choose an officer or create your own</span></LacquerButton>
        <LacquerButton big testid="howto-open" onClick={() => setPanel('help')}>How to Play</LacquerButton>
      </div>
      {saveRead.kind === 'refused' && <div className="notice" data-testid="save-refused">{saveRead.reason}</div>}
      {broken && (
        <div className="notice" data-testid="save-broken">
          {saveRead.kind === 'corrupt' ? 'The saved game is damaged. ' : 'The saved game uses content that is no longer in the game. '}
          {saveRead.reason}
          <div style={{ marginTop: 6 }}><LacquerButton small testid="discard-broken" onClick={() => setConfirmDiscard(true)}>Discard this save</LacquerButton></div>
        </div>
      )}
      {hasSave && (
        <div style={{ textAlign: 'center' }}>
          <LacquerButton small testid="discard-save" onClick={() => setConfirmDiscard(true)}>Discard the saved game</LacquerButton>
        </div>
      )}
      <div className="fine">Unofficial, non-commercial fan project by evilgouki. Not affiliated with Koei Tecmo.</div>
      <div className="fine"><a href={`${import.meta.env.BASE_URL}lab.html`} style={{ color: 'var(--dust)' }} data-testid="lab-link">Battle lab</a></div>
      {panel === 'help' && <HowToPlay onClose={() => setPanel(null)} />}
      {confirmNew && (
        <SilkLetter title="Replace the saved game?" testid="confirm-new">
          <p>Starting a new officer replaces the save{saveRead.kind === 'ok' ? `: ${saveRead.line.text}` : ''}. It is only replaced once the new game starts.</p>
          <div className="answers">
            <LacquerButton primary testid="confirm-new-yes" onClick={() => { setConfirmNew(false); goNew() }}>Start a new officer<span className="sub">The old save is replaced when the new game begins</span></LacquerButton>
            <LacquerButton className="plain" onClick={() => setConfirmNew(false)}>Keep the saved game<span className="sub">Go back to the title</span></LacquerButton>
          </div>
        </SilkLetter>
      )}
      {confirmDiscard && (
        <SilkLetter title="Discard the saved game?" testid="confirm-discard">
          <p>This deletes the save from this browser. It cannot be undone.</p>
          <div className="answers">
            <LacquerButton primary testid="confirm-discard-yes" onClick={() => { discard(); setConfirmDiscard(false) }}>Discard it<span className="sub">Delete the save for good</span></LacquerButton>
            <LacquerButton className="plain" onClick={() => setConfirmDiscard(false)}>Keep it<span className="sub">Leave the save as it is</span></LacquerButton>
          </div>
        </SilkLetter>
      )}
    </div>
  )
}
