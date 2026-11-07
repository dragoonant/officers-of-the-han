import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../client/theme.css'
import { installNoSelect } from '../client/ui'
import { Lab } from './Lab'

installNoSelect()
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Lab />
  </StrictMode>,
)
