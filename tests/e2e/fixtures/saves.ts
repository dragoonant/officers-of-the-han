// Spec-side helper: runs make-saves.ts under tsx once and seeds localStorage before the page loads.
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import type { Page } from '@playwright/test'
import type { Env, Kind } from './make-saves'

let cache: Record<Kind, Env> | null = null
export function saves(): Record<Kind, Env> {
  cache ??= JSON.parse(execFileSync('npx', ['tsx', join(process.cwd(), 'tests/e2e/fixtures/make-saves.ts')], { encoding: 'utf8', maxBuffer: 64 << 20 })) as Record<Kind, Env>
  return cache
}

/** Seed `oth-save` once per browser context (a reload keeps whatever the game has saved since). */
export async function seed(page: Page, env: Env): Promise<void> {
  await page.addInitScript((text) => {
    try {
      if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem('oth-save', text) }
    } catch { /* storage refused */ }
  }, JSON.stringify(env))
}

export const saved = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('oth-save') ?? 'null'))
