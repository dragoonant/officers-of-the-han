import type { ReactNode } from 'react'
import { Portrait } from './Portrait'

/** A small portrait + name (+ one line under it). `faction` is a CSS colour for the lacquer dot. */
export function OfficerChip({ id, name, portrait, sub, faction, size = 36, children }: { id?: string; name: string; portrait?: string; sub?: ReactNode; faction?: string; size?: number; children?: ReactNode }) {
  return (
    <span className="row" style={{ gap: 8, minWidth: 0 }}>
      <Portrait id={id} name={name} portrait={portrait} size={size} faction={faction} />
      <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <span className="caps" style={{ fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
        {sub !== undefined && <span className="dust" style={{ fontSize: 11 }}>{sub}</span>}
      </span>
      {children}
    </span>
  )
}
