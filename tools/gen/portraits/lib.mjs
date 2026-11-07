// Pure parts of the portrait pipeline (docs/spec/55-portraits.md): the style line, the prompt builder, the lint, seeds, crop maths, a tiny
// PNG writer and the flag parsing. No network here. Node 22, no dependencies, paths with node:path so it runs from a Windows shell.
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { deflateSync } from 'node:zlib'

export const TOOL_DIR = path.dirname(fileURLToPath(import.meta.url))
export const REPO_ROOT = path.resolve(TOOL_DIR, '..', '..', '..')
export const DEFAULT_BASE = 'http://localhost:7880'
export const DEFAULT_OUT = path.join(REPO_ROOT, 'tools', 'out', 'portraits')
export const DEFAULT_PUBLIC = path.join(REPO_ROOT, 'public', 'portraits', 'gen')
export const PROMPTS_FILE = path.join(TOOL_DIR, 'portrait-prompts.json')
export const PICKS_FILE = path.join(TOOL_DIR, 'portrait-picks.json')
export const CANDIDATE_LETTERS = ['a', 'b']
export const SIZE_LARGE = 256
export const SIZE_SMALL = 128
/** Where the face sits in a generated square image, as fractions of width and height (the prompt centres the head; a reviewer can nudge per id). */
export const DEFAULT_FACE = [0.5, 0.44]
/** Fraction of the short side kept by the square crop (1 = the whole image). */
export const DEFAULT_ZOOM = 0.92

export class UsageError extends Error {
  constructor(message) {
    super(message)
    this.name = 'UsageError'
    this.exitCode = 2
  }
}

// ---- the style line (docs/spec/55-portraits.md section 1) ------------------------------------------------------------------------------------

/**
 * ONE style sentence, byte-identical on every prompt. Plain materials and measurements, no proper nouns (a proper noun in a clause invites
 * lettering, KB local-ai-studios), no art-style labels from the owner's banned list, no game names.
 */
export const STYLE =
  'Head-and-shoulders portrait of a real historical person, realistic adult proportions, painted in mineral pigments on black lacquer with visible brush texture, ' +
  'a warm palette of vermilion, ochre, black lacquer and bone white, plain dark lacquer background, the head centred in the frame with clear space round it for a circular crop, ' +
  'second-century Chinese court and field dress. Wordless, untitled, no lettering, no border, full-bleed.'

// ---- the lint ---------------------------------------------------------------------------------------------------------------------------

// KB rules.md rule 23 list, stored encoded so a grep of the repo for those words finds only rules.md. Decoded for the check only.
const BANNED_B64 =
  'WyJjaGliaSIsIk1HU0QiLCJTRCIsInN1cGVyLWRlZm9ybWVkIiwiTWFzdGVyIEdyYWRlIFNEIiwiR3VuZGFtIiwiTmVuZG9yb2lkIiwiY3V0ZSIsImthd2FpaSIsInRveSIsImNhcnRvb255Iiwic3R1YmJ5IiwidGlueSBsZWdzIl0='
const NEVER = ['koei', 'tecmo', 'dynasty warriors', 'romance of the three kingdoms', 'total war', 'three kingdoms', 'sangoku', 'shin sangoku', 'warriors orochi', 'nobunaga']

export function bannedWords() {
  return JSON.parse(Buffer.from(BANNED_B64, 'base64').toString('utf8'))
}

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Problems found in one prompt (empty = clean): rule 23 words, game names, officer names (`names`), digits that would invite lettering. */
export function lintPrompt(text, names = []) {
  const problems = []
  for (const w of bannedWords()) {
    if (new RegExp(`(^|[^a-z0-9])${esc(w)}($|[^a-z0-9])`, 'i').test(text)) problems.push('uses a word from KB rule 23')
  }
  for (const w of NEVER) if (text.toLowerCase().includes(w)) problems.push(`names a game, studio or franchise (${w})`)
  for (const n of names) {
    if (n.length >= 4 && new RegExp(`(^|[^a-z])${esc(n)}($|[^a-z])`, 'i').test(text)) problems.push(`contains the name "${n}" (a proper noun invites lettering)`)
  }
  return [...new Set(problems)]
}

// ---- seeds ------------------------------------------------------------------------------------------------------------------------------

/** A fixed 31-bit seed per id (FNV-1a), so a re-run asks for the same image. Candidate b uses seed + 1. */
export function seedFor(id) {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619)
  return (h >>> 0) & 0x7fffffff
}
export const candidateSeed = (seed, index) => (seed + index) & 0x7fffffff
export const candidateLetter = (index) => CANDIDATE_LETTERS[index] ?? String(index)
export const rawFileName = (id, index) => `${id}-${candidateLetter(index)}.png`

const hashInt = (s) => seedFor(s)
const pick = (list, key) => list[hashInt(key) % list.length]

// ---- the officer clauses ----------------------------------------------------------------------------------------------------------------

const EXPRESSION = {
  righteous: 'a steady, level gaze and a composed mouth',
  ambitious: 'a sharp, calculating look, eyes narrowed a little, one brow slightly raised',
  cautious: 'a guarded look, eyes watchful, lips closed and thoughtful',
  reckless: 'a fierce look, a hard stare, jaw set',
  steady: 'a calm, even look and a relaxed mouth',
}

/** Sourced physical traits only (the novel or the histories); an officer not listed here gets no trait clause. */
export const TRAITS = {
  'liu-bei': { clause: 'very long earlobes', source: 'Sanguozhi, Shu 2 (Biography of Liu Bei); Romance ch.1' },
  'guan-yu': { clause: 'a very long, full black beard falling to the chest and a ruddy face', source: 'Romance ch.1 (a beard two chi long); Sanguozhi, Shu 6' },
  'zhang-fei': { clause: 'a broad dark face, round wide eyes and stiff bristling whiskers like a tiger', source: 'Romance ch.1 (leopard head, round eyes, tiger whiskers)' },
  'dong-zhuo': { clause: 'a heavy, fleshy build and a broad face', source: 'Hou Hanshu, Biography of Dong Zhuo (corpulent)' },
  'zhou-yu': { clause: 'fine, handsome features', source: 'Sanguozhi, Wu 9 (Biography of Zhou Yu)' },
  'zhuge-liang': { clause: 'a tall, composed figure', source: 'Sanguozhi, Shu 5 (eight chi tall)' },
  'xu-chu': { clause: 'a huge, thick-necked build', source: 'Sanguozhi, Wei 18 (eight chi tall, a waist of ten spans)' },
  'dian-wei': { clause: 'a mighty, broad-shouldered build', source: 'Sanguozhi, Wei 18 (a powerful build)' },
}

function ageClause(age, sex) {
  const who = sex === 'f' ? 'woman' : 'man'
  if (age < 22) return `a young ${who} of about ${age}, smooth unlined skin`
  if (age < 30) return `a ${who} in the late twenties, firm clear skin`
  if (age < 40) return `a ${who} in the thirties, faint lines at the eyes`
  if (age < 50) return `a ${who} in the forties, lines at the brow and mouth`
  if (age < 62) return `an older ${who} in the fifties, deep lines and some grey in the hair`
  return `an elderly ${who}, deeply lined face and white hair`
}

const ROBE = ['madder red', 'deep ochre', 'umber brown', 'bone white with a dark border', 'dark indigo-black with a vermilion border', 'soot grey with an ochre border']
const ARMOUR_TRIM = ['vermilion cord', 'ochre cord', 'bone white cord', 'black silk cord']

function facialHair(sex, age, key) {
  if (sex === 'f') return ''
  if (age < 22) return 'clean-shaven'
  return pick(['a thin moustache and a short beard', 'a full black beard', 'a moustache and a pointed chin beard', 'a clean-shaven face with a thin moustache', 'a short trimmed beard'], key)
}

function dressClause({ sex, role, troop, post, age, key }) {
  const robe = pick(ROBE, `${key}:robe`)
  const trim = pick(ARMOUR_TRIM, `${key}:trim`)
  const hair = sex === 'f' ? 'dark hair coiled in a high bun held by a bone hairpin' : age >= 62 ? 'white hair in a topknot' : 'black hair in a topknot'
  if (role === 'wanderer') {
    return sex === 'f'
      ? `${hair}, plain undyed hemp clothing and a worn travelling cloak, no ornaments`
      : `a plain cloth headwrap, plain undyed hemp clothing and a worn travelling cloak, no ornaments`
  }
  if (role === 'civil') {
    const cap = post === 'ruler' ? 'a tall black gauze cap with a jade-bead band' : 'a black gauze official\'s cap tied under the chin'
    return sex === 'f' ? `${hair}, layered wide-sleeved robes in ${robe}` : `${cap}, layered wide-sleeved robes in ${robe} with a high crossed collar`
  }
  if (role === 'general') {
    const head = troop === 'cavalry' ? 'a plumed iron helmet with cheek guards' : troop === 'archer' ? 'a plain iron helmet with a vermilion tassel' : 'an iron helmet with a tall crest'
    const body =
      troop === 'cavalry'
        ? `lacquered iron lamellar armour with ${trim} lacing, shoulder guards and a short riding cloak`
        : troop === 'archer'
          ? `lighter lamellar armour over a leather vest with ${trim} lacing and a bracer on the forearm`
          : `heavy lacquered iron lamellar armour with ${trim} lacing and broad shoulder guards`
    return sex === 'f' ? `${hair} under a light iron cap, ${body}` : `${head}, ${body}`
  }
  // officer
  return sex === 'f' ? `${hair}, a belted robe in ${robe} with a leather vest` : `a soft cloth cap, a belted robe in ${robe} under a leather-and-lamellar vest`
}

/** The role of an officer from the data: wanderer from the scenario faction, civil / general / officer from the stats and best troop aptitude. */
export function roleOf({ stats, wanderer }) {
  if (wanderer) return 'wanderer'
  const civil = Math.max(stats.int, stats.pol)
  if (civil >= stats.war + 15 && stats.war < 70) return 'civil'
  if (stats.war >= 65 || (stats.ldr >= 72 && stats.war >= 50)) return 'general'
  return 'officer'
}

const RANK = { A: 3, B: 2, C: 1 }
export function bestTroop(aptitude) {
  let best = 'spear'
  for (const t of ['spear', 'cavalry', 'archer']) if ((RANK[aptitude?.[t]] ?? 0) > (RANK[aptitude?.[best]] ?? 0)) best = t
  return best
}

/**
 * The prompt for one person. `spec` = { key, sex, age, role, troop, temperament, post, trait? }. Builds subject first, then dress and
 * expression, then the one STYLE constant. Never contains a name.
 */
export function buildPrompt(spec) {
  const { key, sex, age, role, troop, temperament, post, trait } = spec
  const parts = []
  parts.push(ageClause(age, sex))
  // A sourced trait that describes the beard or face hair replaces the generic facial-hair pick, so the two never contradict.
  const face = trait && /beard|moustache|whisker|shaven/i.test(trait) ? '' : facialHair(sex, age, `${key}:hair`)
  if (face) parts.push(face)
  if (trait) parts.push(trait)
  parts.push(dressClause({ sex, role, troop, post, age, key }))
  parts.push(EXPRESSION[temperament] ?? EXPRESSION.steady)
  const subject = parts.join(', ')
  return `${subject.charAt(0).toUpperCase()}${subject.slice(1)}. ${STYLE}`
}

// ---- the officer list (src/data/officers.json + src/data/scenarios/190.json) -------------------------------------------------------------

/** Every officer as a prompt spec, in officers.json order. `officers` and `scenario` are the parsed JSON files. */
export function officerSpecs(officers, scenario) {
  const start = new Map(scenario.officers.map((o) => [o.id, o]))
  const later = new Map(scenario.appearances.map((o) => [o.id, o]))
  const year = scenario.year ?? 190
  return officers.map((o) => {
    const s = start.get(o.id)
    const a = later.get(o.id)
    const shownYear = s ? year : a ? a.year : (o.appears ?? o.born + 16)
    const age = Math.max(16, shownYear - o.born)
    const wanderer = s ? s.faction === null : a ? a.faction === null : false
    const post = s ? s.post : 'officer'
    const role = roleOf({ stats: o.stats, wanderer })
    const t = TRAITS[o.id]
    return {
      id: o.id,
      kind: 'officer',
      sex: o.sex,
      age,
      role,
      troop: bestTroop(o.aptitude),
      temperament: o.temperament,
      post,
      trait: t?.clause,
      traitSource: t?.source,
      appearsYear: shownYear,
    }
  })
}

/** 96 generic faces for created officers: face-01 .. face-96, varied in sex, age, role and temperament. Deterministic. */
export function genericSpecs(count = 96) {
  const AGES = [19, 24, 29, 33, 38, 44, 51, 58, 66]
  const ROLES = ['civil', 'general', 'wanderer', 'officer', 'general', 'civil', 'officer', 'wanderer']
  const TEMPS = ['righteous', 'ambitious', 'cautious', 'reckless', 'steady']
  const TROOPS = ['spear', 'cavalry', 'archer']
  const out = []
  for (let i = 0; i < count; i++) {
    const n = i + 1
    out.push({
      id: `face-${String(n).padStart(2, '0')}`,
      kind: 'generic',
      sex: i % 5 < 2 ? 'f' : 'm',
      age: AGES[(i * 4 + (i >> 3)) % AGES.length],
      role: ROLES[(i * 3 + (i >> 2)) % ROLES.length],
      troop: TROOPS[(i * 7 + (i >> 1)) % 3],
      temperament: TEMPS[(i * 2 + (i >> 4)) % TEMPS.length],
      post: 'officer',
    })
  }
  return out
}

/** The prompts file content: { version, style, entries: [{ id, kind, seed, prompt, spec }] }. */
export function buildPromptTable(officers, scenario, names = []) {
  const specs = [...officerSpecs(officers, scenario), ...genericSpecs()]
  const entries = specs.map((sp) => {
    const prompt = buildPrompt({ key: sp.id, ...sp })
    const problems = lintPrompt(prompt, names)
    if (problems.length) throw new Error(`prompt for ${sp.id} failed the lint: ${problems.join('; ')}`)
    const { id, kind, trait, traitSource, ...rest } = sp
    return { id, kind, seed: seedFor(id), prompt, spec: { ...rest, ...(trait ? { trait, traitSource } : {}) } }
  })
  const ids = new Set()
  for (const e of entries) {
    if (ids.has(e.id)) throw new Error(`duplicate id ${e.id}`)
    ids.add(e.id)
  }
  const problems = lintPrompt(STYLE, names)
  if (problems.length) throw new Error(`the STYLE constant failed the lint: ${problems.join('; ')}`)
  return {
    version: 1,
    note: 'Generated by tools/gen/portraits/build-prompts.mjs from src/data. Do not edit by hand: edit the builder in lib.mjs and rebuild (npm run portraits:prompts).',
    model: 'klein',
    aspect: '1:1',
    megapixels: 1,
    style: STYLE,
    entries,
  }
}

export function loadPromptTable(file = PROMPTS_FILE) {
  const doc = JSON.parse(readFileSync(file, 'utf8'))
  if (!doc || !Array.isArray(doc.entries)) throw new Error(`${file}: no "entries" array`)
  return doc
}

// ---- crop maths ---------------------------------------------------------------------------------------------------------------------------

/** The square crop box { x, y, side } in pixels: centred on the face (fractions), `zoom` of the short side, kept inside the image. */
export function cropBox(width, height, face = DEFAULT_FACE, zoom = DEFAULT_ZOOM) {
  const z = Math.min(1, Math.max(0.3, zoom))
  const side = Math.max(1, Math.round(Math.min(width, height) * z))
  const cx = face[0] * width
  const cy = face[1] * height
  const x = Math.min(Math.max(0, Math.round(cx - side / 2)), width - side)
  const y = Math.min(Math.max(0, Math.round(cy - side / 2)), height - side)
  return { x, y, side }
}

/** Width and height from a PNG file's header, or null. */
export function pngSize(buf) {
  if (buf.length < 24 || buf.readUInt32BE(0) !== 0x89504e47 || buf.toString('latin1', 12, 16) !== 'IHDR') return null
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) }
}

// ---- a tiny PNG writer (solid colours for the fake studio, contact sheets) ----------------------------------------------------------------

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()
function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type, 'latin1'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}
/** Encode 8-bit RGB pixels (width*height*3 bytes) as a PNG. */
export function encodePng(width, height, rgb) {
  const stride = width * 3
  const raw = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0
    rgb.copy ? rgb.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride) : raw.set(rgb.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 2
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}
export function solidPng(width, height, [r, g, b]) {
  const px = Buffer.alloc(width * height * 3)
  for (let i = 0; i < px.length; i += 3) {
    px[i] = r
    px[i + 1] = g
    px[i + 2] = b
  }
  return encodePng(width, height, px)
}

// ---- command lines ------------------------------------------------------------------------------------------------------------------------

function parse(argv, options) {
  try {
    return parseArgs({ args: argv, options, allowPositionals: false, strict: true }).values
  } catch (e) {
    throw new UsageError(e instanceof Error ? e.message : String(e))
  }
}
const intIn = (name, text, lo, hi) => {
  const n = Number(text)
  if (!Number.isInteger(n) || n < lo || n > hi) throw new UsageError(`--${name} must be a whole number from ${lo} to ${hi} (got "${text}")`)
  return n
}
const list = (text) => String(text).split(',').map((s) => s.trim()).filter(Boolean)

export function selectOnly(only, entries) {
  if (only === undefined) return null
  const ids = list(only)
  if (ids.length === 0) throw new UsageError('--only needs at least one id')
  const known = new Set(entries.map((e) => e.id))
  const bad = ids.filter((id) => !known.has(id))
  if (bad.length) throw new UsageError(`unknown id: ${bad.slice(0, 5).join(', ')}${bad.length > 5 ? ', ...' : ''}`)
  return ids
}

export const GEN_HELP = `Usage: node tools/gen/portraits/gen-portraits.mjs [options]

Asks the local Flux Studio (FLUX.2 klein) for two candidate portraits per entry of tools/gen/portraits/portrait-prompts.json, one job at a time,
and saves the PNGs to tools/out/portraits/raw/<id>-a.png and <id>-b.png. Candidates whose file exists are skipped, so a stopped run resumes.

  --only <id,id>      only these ids
  --set officers|generic|all   which entries (default all)
  --candidates 1|2    takes per id (default 2)
  --limit <n>         generate at most n images this run
  --dry-run           print the plan and the first request; no network at all
  --base <url>        the studio address (default ${DEFAULT_BASE}, or FLUX_STUDIO_URL)
  --force             regenerate even if a file exists (the old one is archived)
  --timeout <sec>     give up on one job after this long (default 300)
  --out <dir>         work folder (default tools/out/portraits)
  --help
`

export function parseGenArgs(argv, entries) {
  const v = parse(argv, {
    only: { type: 'string' },
    set: { type: 'string' },
    candidates: { type: 'string' },
    limit: { type: 'string' },
    'dry-run': { type: 'boolean' },
    base: { type: 'string' },
    force: { type: 'boolean' },
    timeout: { type: 'string' },
    'poll-ms': { type: 'string' },
    out: { type: 'string' },
    help: { type: 'boolean', short: 'h' },
  })
  const base = (v.base ?? process.env.FLUX_STUDIO_URL ?? DEFAULT_BASE).replace(/\/+$/, '')
  try {
    const u = new URL(base)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('not http')
  } catch {
    throw new UsageError(`--base must be an http(s) URL such as ${DEFAULT_BASE} (got "${base}")`)
  }
  const set = v.set ?? 'all'
  if (!['officers', 'generic', 'all'].includes(set)) throw new UsageError('--set must be officers, generic or all')
  return {
    help: v.help === true,
    only: selectOnly(v.only, entries),
    set,
    candidates: v.candidates === undefined ? 2 : intIn('candidates', v.candidates, 1, 2),
    limit: v.limit === undefined ? null : intIn('limit', v.limit, 1, 100000),
    dryRun: v['dry-run'] === true,
    base,
    force: v.force === true,
    timeoutMs: (v.timeout === undefined ? 300 : intIn('timeout', v.timeout, 5, 86400)) * 1000,
    pollMs: v['poll-ms'] === undefined ? 1500 : intIn('poll-ms', v['poll-ms'], 1, 60000),
    out: path.resolve(v.out ?? DEFAULT_OUT),
  }
}

export const SHEETS_HELP = `Usage: node tools/gen/portraits/contact-sheets.mjs [options]

Makes 4x4 labelled contact sheets (tools/out/portraits/sheets/sheet-01.png ...) from the raw candidates, ordered by id so a and b sit side by side.

  --only <id,id>   only these ids
  --ffmpeg <path>  ffmpeg executable (default ffmpeg on PATH, or FFMPEG)
  --tile <px>      tile size (default 240)
  --out <dir>      work folder (default tools/out/portraits)
  --help
`
export function parseSheetsArgs(argv, entries) {
  const v = parse(argv, { only: { type: 'string' }, ffmpeg: { type: 'string' }, tile: { type: 'string' }, out: { type: 'string' }, help: { type: 'boolean', short: 'h' } })
  return {
    help: v.help === true,
    only: selectOnly(v.only, entries),
    ffmpeg: v.ffmpeg ?? process.env.FFMPEG ?? 'ffmpeg',
    tile: v.tile === undefined ? 240 : intIn('tile', v.tile, 64, 512),
    out: path.resolve(v.out ?? DEFAULT_OUT),
  }
}

export const PICK_HELP = `Usage: node tools/gen/portraits/pick-portraits.mjs [options]

Crops the picked candidate of every id square on the face centre, resizes to 256 and 128 px, writes WebP to public/portraits/gen/<id>.webp and
<id>-128.webp, and rewrites public/portraits/gen/manifest.json. Picks default to candidate a; record choices in portrait-picks.json.

  --pick <id=a|b,..>     choose a candidate (saved in tools/gen/portraits/portrait-picks.json)
  --face <id=x:y,..>     face centre as fractions of the image (default 0.50:0.44), saved with the pick
  --zoom <id=0.8,..>     share of the short side kept (default ${DEFAULT_ZOOM}), saved with the pick
  --only <id,id>         only these ids
  --ffmpeg <path>        ffmpeg executable (needs libwebp)
  --out <dir>            work folder (default tools/out/portraits)
  --public <dir>         where the WebP files and manifest go (default public/portraits/gen)
  --picks-file <file>    the picks file (default tools/gen/portraits/portrait-picks.json)
  --dry-run              print what would be written
  --help
`
export function parsePickArgs(argv, entries) {
  const v = parse(argv, {
    pick: { type: 'string' },
    face: { type: 'string' },
    zoom: { type: 'string' },
    only: { type: 'string' },
    ffmpeg: { type: 'string' },
    out: { type: 'string' },
    public: { type: 'string' },
    'picks-file': { type: 'string' },
    'dry-run': { type: 'boolean' },
    help: { type: 'boolean', short: 'h' },
  })
  const known = new Set(entries.map((e) => e.id))
  const picks = {}
  const patch = (id) => {
    if (!known.has(id)) throw new UsageError(`unknown id ${id}`)
    return (picks[id] ??= {})
  }
  if (v.pick !== undefined) {
    for (const pair of list(v.pick)) {
      const m = /^([a-z0-9-]+)=([ab])$/.exec(pair)
      if (!m) throw new UsageError(`--pick takes id=a or id=b pairs (got "${pair}")`)
      patch(m[1]).pick = m[2]
    }
  }
  if (v.face !== undefined) {
    for (const pair of list(v.face)) {
      const m = /^([a-z0-9-]+)=(0?\.\d+|0|1):(0?\.\d+|0|1)$/.exec(pair)
      if (!m) throw new UsageError(`--face takes id=x:y with fractions between 0 and 1 (got "${pair}")`)
      patch(m[1]).face = [Number(m[2]), Number(m[3])]
    }
  }
  if (v.zoom !== undefined) {
    for (const pair of list(v.zoom)) {
      const m = /^([a-z0-9-]+)=(0?\.\d+|1)$/.exec(pair)
      if (!m) throw new UsageError(`--zoom takes id=0.8 style pairs (got "${pair}")`)
      patch(m[1]).zoom = Number(m[2])
    }
  }
  return {
    help: v.help === true,
    picks,
    only: selectOnly(v.only, entries),
    ffmpeg: v.ffmpeg ?? process.env.FFMPEG ?? 'ffmpeg',
    out: path.resolve(v.out ?? DEFAULT_OUT),
    publicDir: path.resolve(v.public ?? DEFAULT_PUBLIC),
    picksFile: path.resolve(v['picks-file'] ?? PICKS_FILE),
    dryRun: v['dry-run'] === true,
  }
}

export const FAKE_HELP = `Usage: node tools/gen/portraits/fake-flux-studio.mjs [--port 7880] [--delay-ms 100] [--size 64]

A stand-in for the Flux Studio API (POST /api/jobs, GET /api/jobs, GET /api/jobs/<id>, GET /files/<id>/<image>, POST /api/settings) that answers
with a solid-colour PNG per seed. For testing the runner only: its output is not a portrait and must never be committed.
`
export function parseFakeArgs(argv) {
  const v = parse(argv, { port: { type: 'string' }, 'delay-ms': { type: 'string' }, size: { type: 'string' }, help: { type: 'boolean', short: 'h' } })
  return {
    help: v.help === true,
    port: v.port === undefined ? 7880 : intIn('port', v.port, 0, 65535),
    delayMs: v['delay-ms'] === undefined ? 100 : intIn('delay-ms', v['delay-ms'], 0, 600000),
    size: v.size === undefined ? 64 : intIn('size', v.size, 8, 2048),
  }
}

// ---- processes ----------------------------------------------------------------------------------------------------------------------------

/** Run a program and collect its output: { code, stdout: Buffer, stderr: string }; rejects only when it cannot be started. */
export function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true, ...opts })
    const out = []
    const err = []
    child.stdout.on('data', (d) => out.push(d))
    child.stderr.on('data', (d) => err.push(d))
    child.on('error', reject)
    child.on('close', (code) => resolve({ code: code ?? -1, stdout: Buffer.concat(out), stderr: Buffer.concat(err).toString('utf8') }))
  })
}

/** ffmpeg must run, and (for the pick step) have the libwebp encoder. The message says how to fix it on Windows. */
export async function checkFfmpeg(ffmpeg, { webp = false } = {}) {
  const hint = 'Install ffmpeg (for example: winget install Gyan.FFmpeg), open a new shell so it is on PATH, or pass --ffmpeg <full path to ffmpeg.exe>.'
  let ver
  try {
    ver = await run(ffmpeg, ['-hide_banner', '-version'])
  } catch (e) {
    if (e && e.code === 'ENOENT') throw new UsageError(`ffmpeg was not found ("${ffmpeg}"). ${hint}`)
    throw new UsageError(`ffmpeg could not be started ("${ffmpeg}"): ${e instanceof Error ? e.message : e}. ${hint}`)
  }
  if (ver.code !== 0) throw new UsageError(`"${ffmpeg} -version" failed. ${hint}`)
  if (webp) {
    const enc = await run(ffmpeg, ['-hide_banner', '-encoders'])
    if (!/\slibwebp\s/.test(enc.stdout.toString('utf8'))) throw new UsageError('this ffmpeg has no libwebp encoder. Use a full build (the Gyan.FFmpeg or BtbN builds have it).')
  }
  return { version: (ver.stdout.toString('utf8').split('\n')[0] ?? '').trim() }
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** True when this module file was started directly with `node file.mjs` (not imported). Works with Windows paths. */
export function isMain(metaUrl) {
  if (!process.argv[1]) return false
  return path.resolve(process.argv[1]) === path.resolve(fileURLToPath(metaUrl))
}
