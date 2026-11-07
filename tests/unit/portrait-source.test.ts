import { describe, expect, it } from 'vitest'
import { EMPTY_PORTRAITS, fetchPortraitManifest, generatedUrl, normalizePortraitManifest, portraitCandidates, portraitState } from '../../src/client/ui/portraitSource'

const BASE = '/officers-of-the-han/'
const m = normalizePortraitManifest({ version: 1, portraits: { 'liu-bei': { pick: 'a' }, 'face-03': {} } })

describe('portrait source (docs/spec/55-portraits.md section 5)', () => {
  it('an empty or broken manifest changes nothing: the older file, or the medallion', () => {
    expect(normalizePortraitManifest(undefined)).toBe(EMPTY_PORTRAITS)
    expect(normalizePortraitManifest({ portraits: [] })).toBe(EMPTY_PORTRAITS)
    expect(normalizePortraitManifest('x')).toBe(EMPTY_PORTRAITS)
    expect(portraitCandidates({ id: 'cao-cao', portrait: 'cao-cao' }, 56, EMPTY_PORTRAITS, BASE)).toEqual([`${BASE}portraits/cao-cao.webp`])
    expect(portraitCandidates({}, 56, EMPTY_PORTRAITS, BASE)).toEqual([])
  })
  it('prefers the generated portrait by id, then by portrait name, then falls back to the older file', () => {
    expect(portraitCandidates({ id: 'liu-bei', portrait: 'liu-bei' }, 120, m, BASE)).toEqual([`${BASE}portraits/gen/liu-bei.webp`, `${BASE}portraits/liu-bei.webp`])
    expect(portraitCandidates({ id: 'custom-1', portrait: 'face-03' }, 120, m, BASE)).toEqual([`${BASE}portraits/gen/face-03.webp`, `${BASE}portraits/face-03.webp`])
    expect(portraitCandidates({ id: 'cao-cao', portrait: 'cao-cao' }, 120, m, BASE)).toEqual([`${BASE}portraits/cao-cao.webp`])
  })
  it('uses the 128 px file for small sizes and the 256 px file for large ones', () => {
    expect(generatedUrl('liu-bei', 44, BASE)).toBe(`${BASE}portraits/gen/liu-bei-128.webp`)
    expect(generatedUrl('liu-bei', 64, BASE)).toBe(`${BASE}portraits/gen/liu-bei-128.webp`)
    expect(generatedUrl('liu-bei', 92, BASE)).toBe(`${BASE}portraits/gen/liu-bei.webp`)
  })
  it('reports each portrait state for the audition page', () => {
    expect(portraitState({ id: 'liu-bei', portrait: 'liu-bei' }, m)).toBe('generated')
    expect(portraitState({ id: 'cao-cao', portrait: 'cao-cao' }, m)).toBe('file')
    expect(portraitState({ id: 'li-ru' }, m)).toBe('medallion')
  })
  it('reads the manifest, and a failed fetch is an empty manifest, not an error', async () => {
    const ok = await fetchPortraitManifest(BASE, (async () => new Response(JSON.stringify({ portraits: { a: {} } }), { status: 200 })) as typeof fetch)
    expect([...ok.ids]).toEqual(['a'])
    expect(await fetchPortraitManifest(BASE, (async () => new Response('', { status: 404 })) as typeof fetch)).toBe(EMPTY_PORTRAITS)
    expect(await fetchPortraitManifest(BASE, (async () => { throw new Error('x') }) as typeof fetch)).toBe(EMPTY_PORTRAITS)
  })
})
