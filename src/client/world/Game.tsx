import { useMemo } from 'react'
import { world } from '../../world'
import { useGame } from '../store/game'
import { useUi } from '../store/ui'
import { ymText } from '../save/save'
import { ActionBar } from './ActionBar'
import { ActionDialog } from './Dialogs'
import { Hud } from './Hud'
import { Letters } from './Letters'
import { MapView } from './MapView'
import { HowToPlay } from './Title'
import { LacquerBox, LacquerButton } from './seam'
import { ChroniclePanel, CityBox, FactionsPanel, LogRow, OfficerCard } from './Views'

export function Game() {
  const s = useGame((g) => g.state)
  const goTitle = useGame((g) => g.goTitle)
  const saveProblem = useGame((g) => g.saveProblem)
  const lastError = useGame((g) => g.lastError)
  const clearError = useGame((g) => g.clearError)
  const ui = useUi()
  const travelTo = useMemo(() => {
    if (!s) return new Set<string>()
    return new Set(world.query.actionsHere(s).filter((a) => a.kind === 'travel' && a.available && a.action.kind === 'travel').map((a) => (a.action.kind === 'travel' ? a.action.to : '')))
  }, [s])
  if (!s) return null
  const last = s.log[s.log.length - 1]
  const report = world.query.monthReport(s)
  const factionColor = (f: string | null): number | null => (f ? s.factions[f]?.color ?? null : null)
  const blocked = s.pending.length > 0
  return (
    <div className="app" data-testid="game">
      <Hud s={s} />
      <div style={{ position: 'relative', flex: '1 1 auto', minHeight: 0, display: 'flex' }}>
        <MapView state={s} factionColor={factionColor} selected={ui.city} travelTo={travelTo} onSelect={ui.setCity} />
        {ui.city && <CityBox s={s} id={ui.city} onClose={() => ui.setCity(null)} />}
        {lastError && <div className="toast" role="alert" onClick={clearError}>{lastError}</div>}
      </div>
      <button className="wticker" style={{ border: 'none', textAlign: 'left', color: 'inherit', font: 'inherit' }} onClick={() => ui.setPanel('chronicle')} data-testid="ticker" aria-label="Open the chronicle">
        <span className="dust">{ymText(s.ym)}</span>
        <span className="tx" data-testid="ticker-text">{last ? last.text : 'The chronicle is empty.'}</span>
        <span className="dust">{report.length} this month</span>
      </button>
      {saveProblem && <div className="notice" style={{ margin: 6 }} data-testid="save-problem">{saveProblem}</div>}
      <ActionBar s={s} />
      {ui.officer && <OfficerCard s={s} id={ui.officer} onClose={() => ui.openOfficer(null)} />}
      {ui.panel === 'factions' && <FactionsPanel s={s} onClose={() => ui.setPanel(null)} />}
      {ui.panel === 'chronicle' && <ChroniclePanel s={s} onClose={() => ui.setPanel(null)} />}
      {ui.panel === 'help' && <HowToPlay onClose={() => ui.setPanel(null)} />}
      {ui.panel === 'menu' && (
        <LacquerBox title="Menu" onClose={() => ui.setPanel(null)} testid="menu-panel">
          <p className="dust">The game saves after every action. Leaving now loses nothing.</p>
          <div className="row">
            <LacquerButton onClick={() => ui.setPanel('help')}>How to play</LacquerButton>
            <LacquerButton primary testid="to-title" onClick={() => { ui.setPanel(null); ui.setCity(null); goTitle() }}>Save and return to the title<span className="sub">Continue reopens this very spot</span></LacquerButton>
          </div>
          <div className="sec">Recent chronicle</div>
          {s.log.slice(-5).reverse().map((e, i) => <LogRow key={i} s={s} e={e} />)}
        </LacquerBox>
      )}
      {ui.dialog && !blocked && <ActionDialog s={s} kind={ui.dialog} onClose={() => ui.setDialog(null)} />}
      {blocked && <Letters s={s} />}
    </div>
  )
}
