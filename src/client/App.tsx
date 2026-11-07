import { useEffect } from 'react'
import { installNoSelect } from './ui'
import './theme.css'
import { useGame } from './store/game'
import { End } from './world/End'
import { Game } from './world/Game'
import { NewGame } from './world/NewGame'
import { Title } from './world/Title'
import './world/world.css'

export function App() {
  useEffect(() => installNoSelect(), [])
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
