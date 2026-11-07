import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

function Placeholder() {
  return <p style={{ fontFamily: 'sans-serif', padding: 16 }}>Officers of the Han: scaffold (M0). Unofficial, non-commercial fan project by evilgouki.</p>
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Placeholder />
  </StrictMode>,
)
