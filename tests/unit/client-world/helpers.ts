import type { KV } from '../../../src/client/save/save'

export function fakeStorage(opts: { throwOnSet?: boolean; throwOnGet?: boolean } = {}): KV & { data: Map<string, string> } {
  const data = new Map<string, string>()
  return {
    data,
    getItem: (k) => { if (opts.throwOnGet) throw new Error('blocked'); return data.get(k) ?? null },
    setItem: (k, v) => { if (opts.throwOnSet) throw new Error('QuotaExceededError'); data.set(k, v) },
    removeItem: (k) => { data.delete(k) },
  }
}
