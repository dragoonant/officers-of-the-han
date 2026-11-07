import type { ReactNode } from 'react'

/** A letter on pale yellow silk edged in vermilion. Unrolls from the top in 260 ms. Put <LacquerButton>s in `actions`. */
export function SilkLetter({ title, children, actions, style }: { title?: string; children?: ReactNode; actions?: ReactNode; style?: React.CSSProperties }) {
  return (
    <div className="silk" style={style}>
      {title && <h3>{title}</h3>}
      <div>{children}</div>
      {actions && <div className="row" style={{ marginTop: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>{actions}</div>}
    </div>
  )
}
