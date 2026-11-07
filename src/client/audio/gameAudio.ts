// Binds the game to the sound: the music follows the screen, the scene and the world; cues follow taps, letters, the month turn and the map
// selection. Nothing here reads rules numbers beyond what the screens already show. Every call is a no-op while no audio file exists.
import { query } from '../../battle'
import { GAME_DATA } from '../../data'
import { useBattle } from '../battle/store'
import { useGame } from '../store/game'
import { useUi } from '../store/ui'
import { audio } from './index'
import type { Mood } from './manifest'
import { moodFor, warNear as warNearOf, type MoodInput } from './moods'
import { activeScene, useScene } from './scene'

const NEIGHBOURS = new Map<string, string[]>()
for (const r of GAME_DATA.roads) {
  ;(NEIGHBOURS.get(r.a) ?? NEIGHBOURS.set(r.a, []).get(r.a)!).push(r.b)
  ;(NEIGHBOURS.get(r.b) ?? NEIGHBOURS.set(r.b, []).get(r.b)!).push(r.a)
}
const neighbours = (c: string): readonly string[] => NEIGHBOURS.get(c) ?? []

const COUNCIL = new Set(['eventChoice', 'offer', 'captured', 'chooseSuccessor'])

/** The player's battle result while a battle is open: 'win' | 'loss' once the end banner is up, else null. */
function battleResult(): 'win' | 'loss' | null {
  const b = useBattle.getState()
  const st = b.state
  if (!b.ended || !st?.outcome) return null
  const mine = st.units.find((u) => query.isPlayerUnit(st, u.id))
  if (!mine) return null
  return st.outcome.winner === mine.side ? 'win' : 'loss'
}

export function currentInput(): MoodInput {
  const g = useGame.getState()
  const ui = useUi.getState()
  const s = g.state
  const me = s ? s.officers[s.player] : undefined
  const p0 = s?.pending[0]
  return {
    screen: g.screen,
    endKind: s?.ended?.kind ?? null,
    month: s?.ym.month ?? 1,
    warNear: s ? warNearOf(me?.city ?? null, me?.faction ?? null, s.armies, neighbours) : false,
    scene: activeScene(useScene.getState().open),
    court: ui.panel === 'factions' || ui.panel === 'chronicle' || (p0 ? COUNCIL.has(p0.kind) : false),
    battleResult: battleResult(),
  }
}

export function currentMood(): Mood {
  return moodFor(currentInput())
}

const isButton = (t: EventTarget | null): boolean => {
  const el = t instanceof Element ? t.closest('button, [role="button"]') : null
  return !!el && !(el as HTMLButtonElement).disabled && el.getAttribute('aria-disabled') !== 'true'
}

/** Subscribe the sound to the stores. Returns the unsubscribe function. */
export function bindGameAudio(): () => void {
  const apply = (): void => audio.setMood(currentMood())
  apply()
  const unsubs: (() => void)[] = []

  let prev = useGame.getState()
  unsubs.push(
    useGame.subscribe((g) => {
      const s = g.state
      const p = prev.state
      if (s && p && g.actions.length > prev.actions.length) {
        if (s.ym.year !== p.ym.year || s.ym.month !== p.ym.month) {
          audio.play('gong-month')
          audio.play('sting-month')
        }
        const id = s.pending[0]?.id
        const k = s.pending[0]?.kind
        if (id && id !== p.pending[0]?.id && k !== 'battle' && k !== 'duel' && k !== 'debate' && k !== 'chooseDefenders') {
          audio.play('letter-unroll')
          if (k && COUNCIL.has(k)) audio.play('sting-letter')
        }
      }
      prev = g
      apply()
    }),
  )
  let ui = useUi.getState()
  unsubs.push(
    useUi.subscribe((u) => {
      if ((u.city && u.city !== ui.city) || (u.officer && u.officer !== ui.officer)) audio.play('ui-chime')
      ui = u
      apply()
    }),
  )
  unsubs.push(useScene.subscribe(apply))
  unsubs.push(useBattle.subscribe(apply))

  if (typeof document !== 'undefined') {
    const tap = (e: Event): void => {
      if (isButton(e.target)) audio.play('ui-tap')
    }
    document.addEventListener('click', tap, true)
    unsubs.push(() => document.removeEventListener('click', tap, true))
  }
  return () => unsubs.forEach((f) => f())
}
