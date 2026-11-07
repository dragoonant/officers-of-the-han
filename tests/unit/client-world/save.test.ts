import { describe, expect, it } from 'vitest'
import { clearSave, describeSave, readSave, SAVE_KEY, whenText, writeSave, type SaveEnvelope } from '../../../src/client/save/save'
import { world } from '../../../src/world'
import { fakeStorage } from './helpers'

const opts = { scenario: '190', seed: 7, officer: 'liu-bei', options: { lifespans: true, events: true } }
function env(): SaveEnvelope {
  const snapshot = world.newGame(opts)
  return { version: 1, savedAt: 1_000_000, opts, actions: [], snapshot, presentation: {} }
}

describe('KB rule 22 saves', () => {
  it('reads nothing from an empty slot', () => {
    expect(readSave(fakeStorage()).kind).toBe('none')
  })
  it('round trips the snapshot exactly and names the officer, post, house, city and date on Continue', () => {
    const st = fakeStorage()
    const e = env()
    expect(writeSave(e, st)).toEqual({ ok: true })
    const r = readSave(st, 1_000_000 + 5 * 60_000)
    expect(r.kind).toBe('ok')
    if (r.kind !== 'ok') return
    expect(r.env.snapshot).toEqual(e.snapshot)
    expect(r.line.text).toContain('Liu Bei')
    expect(r.line.text).toContain('Gongsun Zan')
    expect(r.line.text).toContain('Pingyuan')
    expect(r.line.text).toContain('January 190')
    expect(r.line.text).toContain('5 min ago')
  })
  it('keeps a battle in progress in the presentation slot', () => {
    const st = fakeStorage()
    const e = { ...env(), presentation: { battle: { marker: 1 } as never } }
    writeSave(e, st)
    const r = readSave(st)
    expect(r.kind === 'ok' && (r.env.presentation.battle as unknown as { marker: number }).marker).toBe(1)
  })
  it('explains an unreadable save', () => {
    const st = fakeStorage()
    st.data.set(SAVE_KEY, '{nope')
    const r = readSave(st)
    expect(r.kind).toBe('corrupt')
    st.data.set(SAVE_KEY, JSON.stringify({ version: 9 }))
    expect(readSave(st).kind).toBe('corrupt')
    st.data.set(SAVE_KEY, JSON.stringify({ ...env(), snapshot: { version: 1 } }))
    expect(readSave(st).kind).toBe('corrupt')
  })
  it('explains a save whose content is gone', () => {
    const st = fakeStorage()
    const e = env()
    e.snapshot = { ...e.snapshot, scenario: '999' }
    writeSave(e, st)
    expect(readSave(st).kind).toBe('missing-content')
    const e2 = env()
    e2.snapshot.officers['ghost-officer'] = { ...e2.snapshot.officers['liu-bei']!, id: 'ghost-officer' }
    writeSave(e2, st)
    const r = readSave(st)
    expect(r.kind).toBe('missing-content')
  })
  it('says so when the browser refuses to store or to read', () => {
    expect(writeSave(env(), fakeStorage({ throwOnSet: true })).ok).toBe(false)
    expect(writeSave(env(), null).ok).toBe(false)
    expect(readSave(fakeStorage({ throwOnGet: true })).kind).toBe('refused')
    expect(readSave(null).kind).toBe('refused')
  })
  it('discard removes the save', () => {
    const st = fakeStorage()
    writeSave(env(), st)
    clearSave(st)
    expect(readSave(st).kind).toBe('none')
  })
  it('a saved wanderer is described without a house', () => {
    const e = env()
    const w = world.newGame({ scenario: '190', seed: 3, officer: { name: 'Lin Wei', sex: 'f', born: 165, stats: { war: 60, ldr: 60, int: 60, pol: 60, cha: 80 }, temperament: 'steady', bestType: 'archer', city: 'luoyang' } })
    const line = describeSave({ ...e, snapshot: w }, 1_000_000)
    expect(line.text).toContain('Lin Wei')
    expect(line.text).toContain('Wanderer')
    expect(line.text).toContain('Luoyang')
  })
  it('whenText steps through units', () => {
    expect(whenText(0, 10_000)).toBe('just now')
    expect(whenText(0, 2 * 3600_000)).toBe('2 h ago')
    expect(whenText(0, 3 * 86400_000)).toBe('3 d ago')
  })
})
