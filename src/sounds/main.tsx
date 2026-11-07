// sounds.html: the owner's ear test (KB rule 9) and the portrait state list. Every music slot, sting and effect with Play/Stop and "no file yet"
// rows, a mood tester, and the state of every portrait (generated, older file, or medallion). Reads only the manifests.
import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { GAME_DATA } from '../data'
import { audio } from '../client/audio'
import { SoundPanel, useAudioStatus } from '../client/audio/SoundControl'
import { entriesForSlot, MOODS, SLOTS, type TrackEntry } from '../client/audio/manifest'
import { Portrait } from '../client/ui/Portrait'
import { fetchPortraitManifest, portraitState, type PortraitManifest, EMPTY_PORTRAITS } from '../client/ui/portraitSource'
import '../client/theme.css'
import './sounds.css'

document.body.classList.add('sounds')
const BASE = import.meta.env.BASE_URL

function Take({ t }: { t: TrackEntry }) {
  const s = useAudioStatus()
  const [on, setOn] = useState(false)
  const playing = s.manifestReady && on
  const once = t.role === 'sfx' || t.role === 'stinger'
  return (
    <div className="take">
      <button
        type="button"
        className={playing && !once ? 'on' : ''}
        data-testid={`play-${t.id}`}
        onClick={async () => {
          if (on && !once) {
            audio.stopAudition(t.id)
            setOn(false)
            return
          }
          const ok = await audio.audition(t)
          if (ok && !once) setOn(true)
        }}
      >
        {on && !once ? 'Stop' : 'Play'}
      </button>
      <b>{t.id}</b>
      <span>{t.file}</span>
      <span>{t.loopEnd > t.loopStart ? `loop ${t.loopEnd.toFixed(3)} s` : 'one shot'}</span>
      {t.bpm > 0 && <span>{t.bpm} bpm</span>}
      <span>gain {t.gainDb} dB</span>
    </div>
  )
}

function Audio() {
  const s = useAudioStatus()
  const [mood, setMood] = useState<string | null>(null)
  return (
    <>
      <h2>Volume</h2>
      <SoundPanel />
      <p className="lede" data-testid="manifest-state">
        {!s.manifestReady ? 'Reading public/audio/manifest.json ...' : s.trackCount === 0 ? 'The manifest lists no files yet: every slot below says "no file yet". Nothing here has been verified by ear.' : `${s.trackCount} track(s) in the manifest. Nothing here has been verified by ear until you listen.`}
      </p>
      <h2>Mood tester</h2>
      <p className="lede">Sets the music mood the way the game does (2 s crossfade). The charge layer button lays it over the battle bed.</p>
      <div className="moods">
        {MOODS.map((m) => (
          <button key={m} type="button" className={mood === m ? 'on' : ''} data-testid={`mood-${m}`} onClick={() => { audio.setMood(m); setMood(m) }}>{m}</button>
        ))}
        <button type="button" data-testid="mood-charge" onClick={() => audio.chargeFor(4)}>charge 4 s</button>
        <button type="button" data-testid="mood-stop" onClick={() => { audio.silence(); audio.stopAudition(); setMood(null) }}>stop all</button>
      </div>
      <h2>Every cue</h2>
      {SLOTS.map((slot) => {
        const entries = entriesForSlot(s.manifestReady ? audio.manifest : { version: 1, tracks: [] }, slot)
        return (
          <div className="slot" key={slot.key} data-testid={`slot-${slot.key}`} data-files={entries.length}>
            <div className="head">
              <span className="name">{slot.label}</span>
              {entries.length === 0 && <span className="miss">no file yet</span>}
            </div>
            {entries.map((t) => <Take key={t.id} t={t} />)}
          </div>
        )
      })}
    </>
  )
}

function Portraits() {
  const [m, setM] = useState<PortraitManifest>(EMPTY_PORTRAITS)
  useEffect(() => { void fetchPortraitManifest(BASE).then(setM) }, [])
  const officers = GAME_DATA.officers.map((o) => ({ id: o.id, name: o.name, portrait: o.portrait }))
  const faces = Array.from({ length: 96 }, (_, i) => `face-${String(i + 1).padStart(2, '0')}`).map((id) => ({ id, name: id, portrait: undefined as string | undefined }))
  const all = [...officers, ...faces]
  const count = (k: string): number => all.filter((p) => portraitState(p, m) === k).length
  return (
    <>
      <h2>Portraits</h2>
      <p className="lede" data-testid="portrait-summary">
        {all.length} portraits: <span className="st-generated">{count('generated')} generated</span>, <span className="st-file">{count('file')} older file</span>, <span className="st-medallion">{count('medallion')} medallion</span>. A generated portrait wins when the manifest lists it; otherwise the older file, otherwise the medallion.
      </p>
      <div className="pgrid">
        {all.map((p) => {
          const st = portraitState(p, m)
          return (
            <div className="pcell" key={p.id} data-state={st} data-testid={`portrait-${p.id}`}>
              <Portrait id={p.id} name={p.name} {...(p.portrait ? { portrait: p.portrait } : {})} size={56} />
              <span><b>{p.name}</b><br /><span className={`st-${st}`}>{st}</span></span>
            </div>
          )
        })}
      </div>
    </>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <div className="snp">
      <h1>Sounds and portraits</h1>
      <p className="lede">The audition page. Music and effects play through the same director the game uses.</p>
      <Audio />
      <Portraits />
    </div>
  </StrictMode>,
)
