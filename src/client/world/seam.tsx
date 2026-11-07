// THE SEAM with the board agent. Everything the world client takes from src/client/ui/**, src/client/battle/** and
// src/client/contests/** is imported here and nowhere else. The real lacquerware components are adapted to the
// props the world screens use (data-testid, close buttons, label plus cost as children).
import { Children, isValidElement, type ReactNode } from 'react'
import {
  CloudBand as RealCloudBand, LacquerBox as RealBox, Portrait as RealPortrait, SilkLetter as RealSilk, StatDial as RealDial,
} from '../ui'

export { BattleScreen, DebateScreen, DuelScreen } from '../contests'
export { CloudBand } from '../ui'
export { Mirror } from '../ui'

export function Portrait({ id, name, portrait, size = 56, ring }: { id?: string | undefined; name: string; portrait?: string | undefined; size?: number; ring?: string | undefined }) {
  return <RealPortrait name={name} {...(id ? { id } : {})} {...(portrait ? { portrait } : {})} size={size} {...(ring ? { faction: ring } : {})} />
}
export function StatDial({ label, value, size = 46 }: { label: string; value: number; size?: number }) {
  return <span data-stat={label}><RealDial label={label} value={value} size={size} /></span>
}

/** Label first, then the lines under it: the first text child is the name, everything else is the cost block. */
export function LacquerButton({ children, onClick, primary, disabled, available, selected, big, small, className, testid, type = 'button' }: {
  children: ReactNode; onClick?: () => void; primary?: boolean; disabled?: boolean; available?: boolean; selected?: boolean; big?: boolean; small?: boolean; className?: string; testid?: string; type?: 'button' | 'submit'
}) {
  const kids = Children.toArray(children)
  const nameParts: ReactNode[] = []
  const rest: ReactNode[] = []
  for (const k of kids) (isValidElement(k) ? rest : nameParts).push(k)
  const cls = ['lbtn', primary ? 'primary' : '', available && !disabled ? 'avail' : '', selected ? 'selected' : '', big ? 'big' : '', small ? 'small' : '', className ?? ''].filter(Boolean).join(' ')
  return (
    <button type={type} className={cls} disabled={disabled} onClick={onClick} data-testid={testid}>
      <span className="lbtn-name">{nameParts}</span>
      {rest.length > 0 && <span className="lbtn-cost">{rest}</span>}
    </button>
  )
}

/** A lacquer box that opens over the map (a bottom sheet on phones, via world.css). */
export function LacquerBox({ title, onClose, children, wide, testid, footer }: { title: string; onClose?: () => void; children: ReactNode; wide?: boolean; testid?: string; footer?: ReactNode }) {
  return (
    <div className="overlay" data-testid={testid}>
      <div className={`boxwrap${wide ? ' wide' : ''}`} role="dialog" aria-label={title}>
        <RealBox title={title}>
          {onClose && <button className="boxclose" onClick={onClose} aria-label="Close">×</button>}
          <div className="boxbody">{children}{footer && <div style={{ marginTop: 12 }}>{footer}</div>}</div>
        </RealBox>
      </div>
    </div>
  )
}

/** A pale silk letter edged in vermilion; answers are lacquer buttons. */
export function SilkLetter({ title, from, children, testid }: { title: string; from?: ReactNode; children: ReactNode; testid?: string }) {
  return (
    <div className="overlay letterbg">
      <div className="silkwrap" role="dialog" aria-label="Letter" data-testid={testid ?? 'letter'}>
        <RealSilk title={title}>
          {from && <div className="from">{from}</div>}
          {children}
        </RealSilk>
      </div>
    </div>
  )
}

/** The tray rim: a cloud band drifting slowly sideways (decoration; reduced motion stops it in theme.css users). */
export function CloudRim() {
  return <div className="drift" style={{ width: 'calc(100% + 96px)' }}><RealCloudBand height={14} /></div>
}
