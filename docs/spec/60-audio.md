# 60 — Audio: music, effects and the director (v0.1, 2026-11-07, PLAN D20)

**Status:** the system and the PC runner are built and tested; **there are no audio files yet** (`public/audio/manifest.json` lists none). The game is silent, without errors, until files are added. The studios run only on the owner's PC ("evilaegis"); a later session there follows `docs/handoff/m5-av-runbook.md`. **Every claim about how anything sounds is not verified by ear**: the owner judges audio on `sounds.html` (KB rule 9).

Donor: the sibling game's `docs/spec/60-audio.md` and `tools/audio/` (proven against the real Audio Studio on 2026-11-01). We reuse the mechanics (resumable runner, loops cut to whole bars, loudnorm mastering, audition and pick-and-prune, the director's crossfades and phase-locked layer). We do **not** reuse its sound: the palette, cues, prompts and mood map are ours.

**Owner decisions (KB, do not re-ask):** real generated audio only, no procedural score and no stand-in (2026-10-17 "the music sucks"); original music, no imitation of any existing soundtrack, no prompt naming a game, studio or composer; music from ACE-Step on the Audio Studio (port 7890), effects from Stable Audio Open on the same studio; run GPU jobs one at a time and announce them (KB rule 10); stop the studios when done (KB rule 17).

## 1. The palette
Han court and field, described by instruments and mechanism (never by label): **guqin** (low plucked notes, harmonics), **pipa** (plucked ostinato, tremolo), **xiao** (end-blown flute, held like wind) and **dizi** (bright flute), **bianzhong** bronze bells (struck on downbeats and phrase ends), **zheng** (arpeggios), **war drums** and frame drums, bronze **gongs**, **low strings** (drones, a bare fifth), a little **suona** for calls. Pentatonic material. Every music prompt ends with the table's exclusions: `instrumental, no vocals, no lyrics, no choir, no electronic synth, no modern drum kit, no pop beat`. Every effect prompt says "no music, no voices" and carries a negative prompt against music, melody, voices, speech, singing and crowd chatter.

## 2. The cue list (`tools/audio/music-cues.json` is the single source for prompts, seeds, bars, targets)
Loops are cut to whole bars: `bars × beatsPerBar × 60 / bpm` seconds. Each is generated 2 to 6 s longer than its loop.

| Id | Mood / use | BPM | Key | Bars | Loop (s) | Notes |
|---|---|---|---|---|---|---|
| `bed-title` | `title`: title and new-game screens | 72 | D minor | 12 | 40.0 | solemn court hall |
| `bed-peace` | `peace`: the map, no war near | 90 | G major | 12 | 32.0 | open countryside |
| `bed-winter` | `winter`: the map in months 12, 1 and 2, no war near | 72 | A minor | 12 | 40.0 | sparse, cold |
| `bed-war` | `war`: the map with an enemy army on or beside your city | 100 | E minor | 12 | 28.8 | gathering armies |
| `bed-court` | `court`: council moments | 80 | F major | 12 | 36.0 | formal and calm |
| `bed-battle` | `battle`: the hex battle | 120 | D minor | 20 | 40.0 | driving, space for a layer |
| `charge` | layer over `bed-battle` for a cavalry charge | 120 | D minor | 8 | 16.0 | same BPM, key and meter as the battle bed (phase-lock) |
| `bed-duel` | `duel`: the duel screen, also inside a battle | 108 | A minor | 8 | 17.8 | sparse hits, silences |
| `bed-debate` | `debate`: the debate screen | 88 | C major | 8 | 21.8 | measured, sly |
| `jingle-victory` | `victory` (one shot) | 100 | D major | 4 | 9.6 + ring-out | |
| `jingle-defeat` | `defeat` (one shot) | 66 | D minor | 3 | 10.9 + ring-out | |
| `sting-letter` | a council letter arrives (one shot, music bus) | 90 | G major | 2 | 5.3 + ring-out | |
| `sting-month` | the month turns (one shot, music bus) | 80 | F major | 2 | 6.0 + ring-out | |

Effects (Stable Audio Open, `kind: sfx`, `role: sfx`, cue name = id without `sfx-`; generated 2 to 6 s, trimmed to `keepSeconds`): `ui-tap` (fingertip on lacquered wood), `ui-chime` (bronze mirror struck once), `letter-unroll` (silk scroll), `gong-month` (one bronze gong), `march` (soldiers on packed earth), `clash` (polearms), `volley` (arrow volley), `charge-hooves` (cavalry charge), `fire`, `wall-hit` (rammed-earth wall), `rally-horn` (bronze horn), `duel-strike`, `duel-guard`, `duel-feint`, `duel-mighty`, `debate-tally` (a wooden tally set on a lacquer tray), `debate-win`, `debate-loss`. Hits (`clash`, `wall-hit`, the strikes) carry `minCrestDb: 6`; the master warns when a take is squashed below it.

## 3. The mood map (what plays when)
`src/client/audio/moods.ts` (`moodFor`, tested). Crossfade 2 s between beds; a jingle takes over in 1 s.

| Game state | Mood |
|---|---|
| title or new-game screen | `title` |
| end screen, chronicle `unified` | `victory`; any other end | `defeat` |
| a duel screen is open (world duel or the field duel inside a battle) | `duel` |
| a debate screen is open | `debate` |
| battle open, undecided | `battle`; end banner up and the player's side won | `victory`; lost | `defeat` (no sound when the player had no unit) |
| map, a council moment: Houses or Chronicle panel, or an event, offer, captive or successor letter | `court` |
| map, `warNear` (an army not of your house, or any army for a wanderer, marching to or from your city or a city one road away) | `war` |
| map, months 12, 1, 2 | `winter` |
| map otherwise | `peace` |
Priority: duel, then debate, then battle, then the map rules top to bottom. A mood with no file falls back (first loadable wins): `winter → peace → court`, `peace → court`, `war → peace`, `court → peace`, `title → court`, `duel → battle`, `debate → court`; `battle`, `victory`, `defeat` have none, so a missing file is silence.

The charge layer (`charge`) is laid over the battle bed for 2.5 s when a cavalry unit attacks in melee: the bed ducks 6 dB over 0.3 s, the layer fades in over 0.25 s (phase-locked to the next beat of the bed when BPM and meter match) and out over 0.8 s; a chain of attacks keeps one voice. No file means no layer and no duck.

## 4. When each effect plays
`audio.play(cue)` through `audioHooks` and `bindGameAudio()`; each is rate-limited per cue (default 0.15 s; `ui-tap` 0.06, `march` 1.2, `fire` 0.8, `volley` 0.4, `charge-hooves` 0.8), at most 6 at once, and skipped (never queued late) if its file is not decoded yet. All effects and stings are preloaded when audio unlocks (about 0.5 MB).

| Cue | Trigger |
|---|---|
| `ui-tap` | any enabled button is clicked (a capture listener on the document) |
| `ui-chime` | a city mirror is selected or an officer card is opened |
| `letter-unroll` | a new letter is the first pending item (not for battle, duel, debate or choose-defenders) |
| `sting-letter` | the same, for council letters (event choice, offer, captive, successor) |
| `gong-month` and `sting-month` | the month turns after a player action (not at a new game or Continue) |
| `march` | a battle move |
| `clash` | a melee attack (spear); `charge-hooves` + `clash` + the charge layer for cavalry |
| `volley` | an archer attack, any attack from range 2 or more, and the volley tactic |
| `wall-hit` | a gate attack |
| `fire` | the fire tactic, ignition, burning |
| `rally-horn` | the rally and taunt tactics |
| `duel-mighty` / `duel-strike` / `duel-feint` / `duel-guard` | each duel round: a mighty blow, else the stance that landed (feint or strike), else the guard that held; a yield makes no sound |
| `debate-tally` | each tablet round |
| `debate-win` / `debate-loss` | the debate ends, for the player's side (none when the AI debates the AI) |
Battle effects are skipped at the Instant speed (the e2e setting).

## 5. Loudness, format and the size budget
- **Loudness:** beds and the charge layer −16 LUFS integrated, jingles −14, stings −15, all true peak ≤ −1 dBTP; effects peak −3 dBFS (per-cue `gainDb` trims, for example −3 for the tap, chime and tally). The report lists LUFS, loudness range, true peak, sample peak, RMS, **crest factor**, length, first-sound offset and the tempo check for every take.
- **Loops:** trimmed so the first sound is at 0.000 s and the length is the exact bar length (nearest sample), a 10 ms declick at the seam (`--seam-fade-ms 0` turns it off); jingles and stings keep their natural tail with a 250 ms fade-out; `loopEnd` in the manifest bounds the loop. The rough tempo check warns above 2.5 percent drift.
- **Format:** OGG Vorbis **q4** (about 128 kbps), 44.1 kHz stereo, as `file`. An M4A (AAC 128k) `alt` is written only with `master-audio.mjs --alt` (older Safari without Vorbis); it roughly doubles the shipped size, so it is off by default and the decision is the owner's.
- **Size budget: about 5 MB shipped.** Estimate from the table: loops, jingles and stings add up to about 304 s of music (about 4.7 MB at 128 kbps) plus about 30 s of effects (about 0.5 MB): about 5.2 MB. The master prints the shipped size, warns above 5.5 MB, and reports it in `report.json`. Beds are fetched lazily when a mood is first needed. Audition mode lists both candidates and is over budget by design: `--pick … --prune` before committing. If the real total is over, lower `OGG_QUALITY` in `tools/audio/lib.mjs` or shorten a bed (fewer bars).

## 6. Settings and the manifest
- **Settings:** music volume, effects volume, mute, in the Menu (and a "Sound" slip on the title and new-game screens). Stored in `localStorage` key **`oth-audio`** as `{music, sfx, muted}` (0 to 1; slider position squared is the gain; mute zeroes the master and keeps the sliders). Every read and write is in try/catch.
- **Unlock:** the `AudioContext` is created on the first gesture (`pointerup`, `touchend`, `click`, `keydown`; listeners stay for the session; suspend on a hidden tab). Nothing is fetched or decoded before then; calls made earlier are remembered and applied on unlock.
- **Silent until files exist:** `public/audio/manifest.json` is committed as `{"version":1,"tracks":[]}` (so there is never a 404) and read at runtime. Invalid entries are dropped with a one-time `console.warn`; a missing or undecodable file is logged once and is silence. A page with no files has 0 console errors.
- **Manifest entry:** `{id, file, alt?, bpm, beatsPerBar, loopStart, loopEnd, gainDb, role: bed|charge|stinger|sfx, mood?, cue?}`. Beds and jingles carry a `mood`; stings and effects carry a `cue` (`sting-letter`, `ui-tap`, …). The master writes it; do not edit it by hand.
- **`sounds.html`** (built as a third page): volume panel, a mood tester (with a 4 s charge button and Stop), one slot per cue with Play/Stop or "no file yet" (31 slots), both candidates in audition mode, and the portrait state of every officer and face (generated, older file or medallion).

## 7. Code and tests
`src/client/audio/`: `audioEngine.ts` (context, buses, settings), `manifest.ts`, `webGraph.ts` (lazy fetch and decode, voices), `musicDirector.ts` (pure scheduling on a fake-able clock: beds, crossfades, the charge layer, one-shot cues), `moods.ts` (mood map, `warNear`, battle and duel cue maps), `scene.ts` (which scene is open), `gameAudio.ts` (binds the stores), `hooks.ts`, `index.ts` (facade; `?test=1` exposes it as `window.__audio`), `SoundControl.tsx`, `audio.css`. Screen edits are one line each: `BattleScreen`, `DuelScreen` and `DebateScreen` call `useAudioScene`; the battle director, duel and debate screens call `audioHooks`; `App.tsx` binds and shows the slip; `Game.tsx` shows the panel in the Menu.
Tests: `tests/unit/audio-director.test.ts` (ramps, crossfades, fallbacks, silence, phase-lock, chains, failsafe, cue limits), `tests/unit/audio-support.test.ts` (manifest, settings, mood map, hooks), `tests/unit/audio-runner.test.ts` (cue table against this spec, prompt lint, the whole pipeline against the fake studio), `tests/e2e/audio.spec.ts` (no files: 0 console errors, settings work and persist; with a manifest: the bed plays after the first gesture).

## 8. The runner (PC)
`tools/audio/`: `music-cues.json`, `gen-music.mjs` (asks the studio for every cue, one job at a time, 2 candidates, fixed seeds, resumable, waits while the studio has other jobs, cancels on Ctrl-C), `master-audio.mjs` (ffmpeg only: trim, cut to bars, loudnorm two-pass, encode, measure the decoded file, re-encode if the lossy peak overshoots, manifest, `candidates.json`, `report.json`), `fake-audio-studio.mjs` (click tracks and noise bursts for tests; **never copy its output into `public/audio`**), `lib.mjs`, `dsp.mjs`. Commands and the order of work are in `docs/handoff/m5-av-runbook.md`. Flags: `gen-music.mjs --only --candidates --limit --base --force --timeout --dry-run`; `master-audio.mjs --only --audition --pick id=a|b --prune --alt --seam-fade-ms --jobs --ffmpeg --dry-run`.
**Expected time (estimate, not measured here):** from the KB (an 11 s cold 30 s ACE-Step take, 8 s warm; 5 s for two 6 s effects) and the donor's real first run (10 jobs, about 3 minutes): 13 music jobs of 20 to 44 s with two candidates each, plus 18 effect jobs, about **6 to 12 minutes of GPU time** including a model switch. Mastering 62 takes is 2 to 4 minutes of CPU.

## Change log
- 2026-11-07 v0.1 written with the system and runner (PLAN D20).
