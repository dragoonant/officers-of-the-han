import { beforeEach, describe, expect, it } from 'vitest'
import { fakeStorage } from './helpers'

const st = fakeStorage()
;(globalThis as unknown as { localStorage: unknown }).localStorage = st

const opts = { scenario: '190', seed: 1, officer: 'liu-bei', options: { lifespans: true, events: true } }

describe('store: the sole caller of world.step, with autosave after every accepted action', () => {
  beforeEach(() => st.data.clear())

  it('saves at game start and after each accepted action; a rejected one saves nothing new', async () => {
    const { useGame } = await import('../../../src/client/store/game')
    const { readSave } = await import('../../../src/client/save/save')
    useGame.getState().startNew(opts)
    let r = readSave(st)
    expect(r.kind === 'ok' && r.env.actions.length).toBe(0)
    expect(useGame.getState().act({ kind: 'work', work: 'farm' }).ok).toBe(true)
    r = readSave(st)
    expect(r.kind === 'ok' && r.env.actions.length).toBe(1)
    const before = st.data.get('oth-save')
    const bad = useGame.getState().act({ kind: 'travel', to: 'nowhere' })
    expect(bad.ok).toBe(false)
    expect(st.data.get('oth-save')).toBe(before)
    expect(useGame.getState().lastError).toBeTruthy()
  })

  it('Continue restores the same state, and replaying the saved actions reaches it', async () => {
    const { useGame } = await import('../../../src/client/store/game')
    const { world } = await import('../../../src/world')
    useGame.getState().startNew(opts)
    useGame.getState().act({ kind: 'work', work: 'farm' })
    useGame.getState().act({ kind: 'endMonth' })
    const live = useGame.getState().state!
    useGame.setState({ state: null, screen: 'title' })
    expect(useGame.getState().continueSaved()).toBe(true)
    const g = useGame.getState()
    expect(g.state).toEqual(live)
    expect(g.screen).toBe('game')
    expect(world.replay(g.opts!, g.actions)).toEqual(live)
  })

  it('answers pendings through the store and keeps a battle in progress', async () => {
    const { useGame } = await import('../../../src/client/store/game')
    const { readSave } = await import('../../../src/client/save/save')
    useGame.getState().startNew(opts)
    useGame.getState().act({ kind: 'endMonth' })
    for (let i = 0; i < 20 && useGame.getState().state!.pending.length; i++) {
      const p = useGame.getState().state!.pending[0]!
      if (p.kind === 'letter') useGame.getState().act({ kind: 'ack', pending: p.id })
      else if (p.kind === 'offer') useGame.getState().act({ kind: 'answerOffer', pending: p.id, accept: false })
      else break
    }
    useGame.getState().setBattle({ marker: 2 } as never)
    const r = readSave(st)
    expect(r.kind === 'ok' && (r.env.presentation.battle as unknown as { marker: number }).marker).toBe(2)
    useGame.getState().act({ kind: 'study', stat: 'int' })
    expect(useGame.getState().battle).toBeUndefined()
  })
})
