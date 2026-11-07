import { Mirror } from './Mirror'

/** A mirror-back dial for one number: the arc is value/max, the number sits in the face, the label under it. */
export function StatDial({ label, value, max = 100, size = 46, color = 'var(--vermilion)' }: { label: string; value: number; max?: number; size?: number; color?: string }) {
  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <Mirror size={size} rings={[{ value: value / max, color }]} knob={false}>
        <span className="num" style={{ color: 'var(--ink)', fontWeight: 800, fontSize: size * 0.3 }}>{Math.round(value)}</span>
      </Mirror>
      <span className="caps dust" style={{ fontSize: 10 }}>{label}</span>
    </span>
  )
}
