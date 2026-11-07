import { useEffect } from 'react'
import { installNoSelect } from './ui'
import './theme.css'
import { useGame } from './store/game'
import { useUi } from './store/ui'
import { world } from '../world'
import { End } from './world/End'
import { Game } from './world/Game'
import { NewGame } from './world/NewGame'
import { Title } from './world/Title'
import './world/world.css'

declare global {
  interface Window { __game?: typeof useGame; __ui?: typeof useUi; __world?: typeof world }
}

export function App() {
  useEffect(() => installNoSelect(), [])
  // test hooks (the e2e text sweep drives the stores; the engine is pure)
  useEffect(() => { window.__game = useGame; window.__ui = useUi; window.__world = world }, [])
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
