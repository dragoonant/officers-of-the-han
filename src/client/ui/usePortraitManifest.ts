import { useSyncExternalStore } from 'react'
import { EMPTY_PORTRAITS, fetchPortraitManifest, type PortraitManifest } from './portraitSource'

let current: PortraitManifest = EMPTY_PORTRAITS
let started = false
const listeners = new Set<() => void>()

const BASE = (() => {
  try {
    return import.meta.env.BASE_URL ?? '/'
  } catch {
    return '/'
  }
})()

function start(): void {
  if (started || typeof window === 'undefined') return
  started = true
  void fetchPortraitManifest(BASE).then((m) => {
    current = m
    listeners.forEach((f) => f())
  })
}

/** The generated-portrait manifest, read once at runtime. Empty (so every portrait falls back) until it loads or when it lists nothing. */
export function usePortraitManifest(): PortraitManifest {
  start()
  return useSyncExternalStore(
    (f) => {
      listeners.add(f)
      return () => listeners.delete(f)
    },
    () => current,
    () => EMPTY_PORTRAITS,
  )
}
