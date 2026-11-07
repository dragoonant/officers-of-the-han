import type { ReactNode } from 'react'
import { CloudBand } from './CloudBand'

/** A black lacquer box with chamfered corners, a red-lacquer field 6 px in and a cloud band across its top. The lid lifts in 180 ms. */
export function LacquerBox({ title, children, className, style }: { title?: string; children?: ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div className="lbox-wrap" style={style}>
      <div className={`lbox ${className ?? ''}`}>
        <div className="cloud">
          <CloudBand height={14} />
        </div>
        <div className="lbox-in" style={{ marginTop: 14 }}>
          {title && <div className="lbox-title">{title}</div>}
          {children}
        </div>
      </div>
    </div>
  )
}
