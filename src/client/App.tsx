import { useEffect } from 'react'
import { useGame } from './store/game'
import { End } from './world/End'
import { Game } from './world/Game'
import { NewGame } from './world/NewGame'
import { Title } from './world/Title'
import './world/world.css'

/** KB rule 24 fallback for browsers that ignore the CSS: no selection or callout unless someone is typing. */
function useNoSelect(): void {
  useEffect(() => {
    const typing = (t: EventTarget | null): boolean => t instanceof HTMLElement && (t.matches('input, textarea, select') || t.isContentEditable)
    const stop = (e: Event): void => { if (!typing(e.target)) e.preventDefault() }
    document.addEventListener('selectstart', stop)
    document.addEventListener('contextmenu', stop)
    return () => { document.removeEventListener('selectstart', stop); document.removeEventListener('contextmenu', stop) }
  }, [])
}

export function App() {
  useNoSelect()
  const screen = useGame((g) => g.screen)
  return (
    <div className="app">
      {screen === 'title' && <Title />}
      {screen === 'new' && <NewGame />}
      {screen === 'game' && <Game />}
      {screen === 'end' && <End />}
    </div>
  )
}
