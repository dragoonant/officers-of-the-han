// Volume panel (music, effects, mute). `SoundPanel` is the body, shown in the Menu; `SoundButton` is a slip that opens it on the title and
// new-game screens. No native tooltips (aria-labels only), saved in localStorage `oth-audio`.
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { audio, type AudioStatus } from './index'
import './audio.css'

export function useAudioStatus(): AudioStatus {
  return useSyncExternalStore(audio.subscribe, () => audio.status(), () => audio.status())
}

/** One line saying what the music is doing, for the panel. */
export function musicNote(s: AudioStatus): string {
  if (!s.manifestReady) return 'Music: checking files'
  if (s.trackCount === 0) return 'Music: files pending'
  if (s.ctx === 'none') return 'Music: touch the page to start'
  if (s.ctx !== 'running') return 'Music: paused by the browser'
  return `Music: ${s.trackCount} ${s.trackCount === 1 ? 'track' : 'tracks'} ready`
}

const ROWS = [
  { key: 'music', label: 'Music' },
  { key: 'sfx', label: 'Effects' },
] as const

export function SoundPanel({ note = true }: { note?: boolean }) {
  const s = useAudioStatus()
  const st = s.settings
  return (
    <div className="snd-panel" data-testid="sound-panel" data-sound-ui>
      {ROWS.map((r) => (
        <label key={r.key} className="snd-row">
          <span className="snd-label">{r.label}</span>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={Math.round(st[r.key] * 100)}
            aria-label={`${r.label} volume`}
            data-testid={`vol-${r.key}`}
            onChange={(e) => audio.setSettings({ [r.key]: Number(e.target.value) / 100 })}
          />
          <span className="snd-val" data-testid={`vol-${r.key}-val`}>{Math.round(st[r.key] * 100)}</span>
        </label>
      ))}
      <div className="snd-foot">
        <button type="button" className="snd-mute" aria-pressed={st.muted} data-testid="sound-mute" onClick={() => audio.setSettings({ muted: !st.muted })}>
          {st.muted ? 'Unmute' : 'Mute'}
        </button>
        {note && <span className="snd-note" data-testid="music-note">{musicNote(s)}</span>}
      </div>
    </div>
  )
}

/** A "Sound" slip that opens the panel (title and new-game screens, where there is no Menu). */
export function SoundButton() {
  const [open, setOpen] = useState(false)
  const wrap = useRef<HTMLSpanElement>(null)
  const muted = useAudioStatus().settings.muted
  useEffect(() => {
    if (!open) return
    const down = (e: PointerEvent): void => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false)
    }
    const key = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('pointerdown', down)
    window.addEventListener('keydown', key)
    return () => {
      window.removeEventListener('pointerdown', down)
      window.removeEventListener('keydown', key)
    }
  }, [open])
  return (
    <span ref={wrap} className="snd-float" data-sound-ui>
      <button type="button" className="snd-btn" aria-expanded={open} aria-haspopup="dialog" aria-label="Sound settings" data-testid="sound-btn" onClick={() => setOpen(!open)}>
        {muted ? 'Sound off' : 'Sound'}
      </button>
      {open && (
        <div className="snd-pop" role="dialog" aria-label="Sound settings">
          <SoundPanel />
        </div>
      )}
    </span>
  )
}
