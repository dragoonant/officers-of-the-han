import type { ReactNode } from 'react'

export type ButtonState = 'available' | 'selected' | 'target' | 'none'

/**
 * A button that names what it does (`name`) and shows its cost or preview in a second line (`cost`), numbers taken from query.* (KB rule 8).
 * `state`: available = ochre shimmer along the bottom band, selected = vermilion ring, target = dashed vermilion ring.
 */
export function LacquerButton({
  name,
  cost,
  onClick,
  disabled,
  primary,
  state = 'none',
  id,
  title,
  children,
}: {
  name: string
  cost?: ReactNode
  onClick?: () => void
  disabled?: boolean
  primary?: boolean
  state?: ButtonState
  id?: string
  title?: string
  children?: ReactNode
}) {
  const cls = ['lbtn', primary ? 'primary' : '', state === 'available' && !disabled ? 'avail' : '', state === 'selected' ? 'selected' : '', state === 'target' ? 'target' : ''].join(' ')
  return (
    <button type="button" id={id} className={cls} onClick={onClick} disabled={disabled} aria-label={title}>
      <span className="lbtn-name">{name}</span>
      {cost !== undefined && cost !== '' && <span className="lbtn-cost">{cost}</span>}
      {children}
    </button>
  )
}
