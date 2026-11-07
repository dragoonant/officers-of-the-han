// Which image an officer portrait shows (docs/spec/55-portraits.md section 5). Pure: no DOM, no fetch except `fetchPortraitManifest`.
// Order: a generated portrait the manifest lists (by officer id, then by the portrait name), then the older file `portraits/<name>.webp`
// (the copied tactics portraits and the medallion's fallback), then nothing (the caller draws the medallion).
export interface PortraitManifest {
  version: 1
  /** Ids (officer ids and `face-NN` names) that have a generated WebP in public/portraits/gen/. */
  ids: ReadonlySet<string>
}

export const EMPTY_PORTRAITS: PortraitManifest = { version: 1, ids: new Set() }

/** Validate untrusted JSON; anything odd is an empty manifest (never throws). */
export function normalizePortraitManifest(raw: unknown): PortraitManifest {
  const p = raw && typeof raw === 'object' ? (raw as { portraits?: unknown }).portraits : null
  if (!p || typeof p !== 'object' || Array.isArray(p)) return EMPTY_PORTRAITS
  const ids = Object.keys(p as object).filter((k) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(k))
  return { version: 1, ids: new Set(ids) }
}

/** Sizes up to this many CSS pixels use the 128 px file; larger ones the 256 px file. */
export const SMALL_MAX = 64

export function generatedUrl(key: string, size: number, base: string): string {
  const b = base.endsWith('/') ? base : `${base}/`
  return `${b}portraits/gen/${key}${size <= SMALL_MAX ? '-128' : ''}.webp`
}
export function legacyUrl(key: string, base: string): string {
  const b = base.endsWith('/') ? base : `${base}/`
  return `${b}portraits/${key}.webp`
}

/** The image URLs to try, best first. An empty list means "draw the medallion". */
export function portraitCandidates(p: { id?: string | undefined; portrait?: string | undefined }, size: number, m: PortraitManifest, base: string): string[] {
  const out: string[] = []
  if (p.id && m.ids.has(p.id)) out.push(generatedUrl(p.id, size, base))
  if (p.portrait && m.ids.has(p.portrait)) out.push(generatedUrl(p.portrait, size, base))
  const legacy = p.portrait ?? p.id
  if (legacy) out.push(legacyUrl(legacy, base))
  return [...new Set(out)]
}

/** Where each portrait comes from, for the audition page: 'generated' | 'file' (an older portrait name is set) | 'medallion'. */
export function portraitState(p: { id: string; portrait?: string | undefined }, m: PortraitManifest): 'generated' | 'file' | 'medallion' {
  if (m.ids.has(p.id) || (p.portrait && m.ids.has(p.portrait))) return 'generated'
  return p.portrait ? 'file' : 'medallion'
}

export async function fetchPortraitManifest(base: string, fetchFn: typeof fetch = (...a) => fetch(...a)): Promise<PortraitManifest> {
  try {
    const b = base.endsWith('/') ? base : `${base}/`
    const res = await fetchFn(`${b}portraits/gen/manifest.json`)
    if (!res.ok) return EMPTY_PORTRAITS
    return normalizePortraitManifest(await res.json())
  } catch {
    return EMPTY_PORTRAITS
  }
}
