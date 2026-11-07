#!/usr/bin/env node
// Writes portrait-prompts.json from src/data (officers.json + scenarios/190.json) plus 96 generic faces. Fixed seed per id.
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { buildPromptTable, isMain, PROMPTS_FILE, REPO_ROOT } from './lib.mjs'

const readJson = (p) => JSON.parse(readFileSync(path.join(REPO_ROOT, p), 'utf8'))

/** Names and courtesy names that must never appear in a prompt (proper nouns invite lettering). */
export function namesOf(officers) {
  const out = new Set()
  for (const o of officers) {
    for (const part of [o.name, o.courtesy, ...String(o.name).split(' ')]) if (part && part.length >= 4) out.add(part)
  }
  return [...out]
}

export function build() {
  const officers = readJson('src/data/officers.json')
  const scenario = readJson('src/data/scenarios/190.json')
  return buildPromptTable(officers, scenario, namesOf(officers))
}

if (isMain(import.meta.url)) {
  const table = build()
  writeFileSync(PROMPTS_FILE, `${JSON.stringify(table, null, 2)}\n`)
  const n = table.entries
  console.log(`Wrote ${n.length} prompts (${n.filter((e) => e.kind === 'officer').length} officers, ${n.filter((e) => e.kind === 'generic').length} generic) to ${path.relative(REPO_ROOT, PROMPTS_FILE)}`)
}
