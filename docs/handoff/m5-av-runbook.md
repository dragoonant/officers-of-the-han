# M5 runbook: generate the portraits, music and sound effects on evilaegis

For a later session running **on the owner's Windows GPU PC ("evilaegis")**. Everything below was built and tested in the cloud container against fake studios; **no real generation has been run**, so the first run is the real test and every time and size here is an estimate. Specs: `docs/spec/55-portraits.md` (portraits) and `docs/spec/60-audio.md` (audio). Credit the owner as "evilgouki" in anything written; never write the real name, email or a home path into the repo.

## 0. Rules to follow (KB `rules.md`)
- **Rule 10: announce GPU work first** and wait for a go if the owner may be using the PC (the owner waived the gate for Fell-in on 2026-10-17; do not assume it applies here). **Never run two GPU jobs at once.** The two runners send one job at a time and wait while their studio reports other jobs, but you must also not run the portrait and audio pipelines at the same time, and not alongside a Hunyuan batch.
- **Rule 17: stop the studios when you are done** (section 8). **Never `taskkill /F /IM node.exe`**: it kills every studio.
- **Rule 9:** audio is judged by ear on `sounds.html`; write "not verified by ear" until the owner has listened. **Rule 7:** art direction is set once; check the image, not the prompt; contact sheets go to the owner as FYI.
- **Rule 23:** never put the banned words in any prompt; the prompt tables are linted, so do not edit prompts by hand around the lint.

## 1. Prerequisites
1. Repo checked out on branch `m-av` (or `main` once merged), `git submodule update --init` (the KB submodule), **Node 22** (`node -v`), `npm install`.
2. **Flux Studio** on `http://localhost:7880` (FLUX.2 klein) and **Audio Studio** on `http://localhost:7890` (ACE-Step music, Stable Audio Open effects). Check `http://localhost:7890/api/status` in a browser; Flux answers `GET /api/jobs`. Both share one ComfyUI on 8188 and queue GPU work one job at a time. Start only the studio you need now.
3. **ffmpeg** with libvorbis, libwebp and aac: `ffmpeg -version`. If missing: `winget install Gyan.FFmpeg`, open a new shell, or pass `--ffmpeg <full path to ffmpeg.exe>` (or set `FFMPEG`).
4. Prompts are already in the repo: `tools/gen/portraits/portrait-prompts.json` (291 entries) and `tools/audio/music-cues.json` (13 music cues, 18 effects). `npm run portraits:prompts` rebuilds the first from `src/data`; it should change nothing.
5. Dry runs first, which touch nothing and need no studio:
   ```
   npm run portraits:gen -- --dry-run
   node tools/audio/gen-music.mjs --dry-run
   ```

## 2. Expected GPU time (an estimate, not measured on the real studios)
- **Portraits:** 582 images (291 entries × 2 candidates). The KB measured about 6 s per 832×1216 image on klein; a 1:1 megapixel image should be similar, plus model load once (`freeAfter:false` keeps it loaded). About **60 to 90 minutes**. Do the first 8 ids first (section 3) and look at them before committing the rest to the GPU.
- **Audio:** 31 cues × 2 candidates. The donor's real first run was 10 jobs in about 3 minutes. Here 13 music jobs (20 to 44 s of audio, two takes each) and 18 effect jobs: about **6 to 12 minutes**, plus a model switch between ACE-Step and Stable Audio. Mastering is CPU only (2 to 4 minutes) and can run after the studio is stopped.

## 3. Portraits (Flux Studio, port 7880)
Run from the repo root in PowerShell or cmd.
```
npm run portraits:gen -- --only liu-bei,guan-yu,zhang-fei,diaochan,face-01,face-02,face-03,face-04
npm run portraits:sheets
```
1. Open `tools\out\portraits\sheets\sheet-01.png`. Check every image against the review list in `55-portraits.md` section 4 (lettering, sex and age match the data, head near the centre, role-appropriate dress, realistic proportions). If Flux rejects `aspect: '1:1'`, note the error, use the nearest aspect the studio lists (edit `aspect` in the generated prompts file through `tools/gen/portraits/lib.mjs`, then `npm run portraits:prompts`).
2. If the style is wrong, fix `STYLE` or the clauses in `tools/gen/portraits/lib.mjs`, run `npm test -- portrait-pipeline` (lint and the committed-file check), `npm run portraits:prompts`, and regenerate the test ids with `--force`. Changing the style starts a new set: delete `tools\out\portraits\raw` first.
3. When the first sheet is good, generate everything (resumable: interrupt and re-run at will, finished images are skipped; one job at a time; waits while the studio is busy):
   ```
   npm run portraits:gen
   npm run portraits:sheets
   ```
4. **Review all 37 sheets.** Reject with `npm run portraits:gen -- --only <id> --force` (the old file is archived) or pick candidate b.
5. Pick and post-process (crops square on the face centre, 256 and 128 px WebP, manifest):
   ```
   npm run portraits:pick -- --pick liu-bei=b --face guan-yu=0.5:0.40 --zoom zhang-fei=0.85
   npm run portraits:pick
   ```
   The second line (re)processes everything at the recorded picks; choices live in `tools/gen/portraits/portrait-picks.json`.
6. Check the game: `npm run dev`, open `http://localhost:5173/sounds.html` (the Portraits section lists every portrait and its state: generated, older file, medallion; the summary should say 291 generated) and the officer card, a duel screen and the create-officer picker on the main page.

## 4. Music and effects (Audio Studio, port 7890)
Stop the Flux Studio first if the owner wants the VRAM back (one GPU job at a time, and the studios share ComfyUI).
```
node tools/audio/gen-music.mjs --only bed-battle,sfx-clash
node tools/audio/master-audio.mjs --audition --only bed-battle,sfx-clash
```
Listen to those two first on `sounds.html` (section 6) to make sure the pipeline is sound, then everything:
```
node tools/audio/gen-music.mjs
```
`gen-music.mjs` is resumable (a second run makes zero requests), writes the raw FLACs to `tools\out\audio\raw\<id>-a|b.flac` and the full request per cue to `generation-log.json`; Ctrl-C cancels the running studio job. If two cues fail in a row it stops.

## 5. Master in audition mode
```
node tools/audio/master-audio.mjs --audition
```
Trims head silence so bar 1 is at 0.000 s, cuts loops to whole bars, normalises (beds and charge −16 LUFS, jingles −14, stings −15, effects peak −3 dBFS), encodes OGG q4, measures the decoded file and writes `public/audio/*.ogg`, `manifest.json`, `candidates.json` and `tools\out\audio\report.json` (LUFS, true peak, crest, length, tempo check, shipped size). Read the warnings it prints: a tempo drift above 2.5 percent, a late first sound, a loudness more than 1 LU off target, a low crest factor on a hit. Add `--alt` only if the owner wants the M4A fallback for old Safari (it doubles the size).

## 6. Listen on `sounds.html`
`npm run dev`, then `http://localhost:5173/sounds.html`. In audition mode every cue shows **both** candidates (`<id>` and `<id>-b`) with Play/Stop. Check, by ear: loop seams (does each bed repeat cleanly?), the mood tester (2 s crossfades, the charge layer over the battle bed: does it lock on the beat?), the jingles' endings, every effect against its description, and that no effect has music or a voice in it. Play the game too: map (peace, winter, war), a council letter, a battle, a duel, a debate. Note choices; report the result as "not verified by ear" until the owner listens.

## 7. Pick, prune, commit
```
node tools/audio/master-audio.mjs --pick bed-battle=b,sfx-clash=b --prune
```
Cues not named keep candidate a; `--prune` deletes every unpicked file and rewrites the manifest without the audition rows. **Never commit audition mode** (the budget is about 5 MB; the master prints "Shipped audio" and warns above 5.5 MB; if over, lower `OGG_QUALITY` in `tools/audio/lib.mjs` or shorten a bed and re-master). To redo one cue: edit its prompt or seed in `music-cues.json`, `node tools/audio/gen-music.mjs --only <id> --force`, then master it again.

Run the gates, then commit **only these paths**:
```
npm run typecheck ; npm test ; npm run build
git add public/audio public/portraits/gen tools/gen/portraits/portrait-picks.json tools/gen/portraits/portrait-prompts.json tools/audio/music-cues.json
git commit -m "M5: generated portraits, music and effects (not verified by ear)"
```
- Commit: `public/audio/*.ogg` (and `*.m4a` if `--alt`), `public/audio/manifest.json`, `public/audio/candidates.json`, `public/portraits/gen/*.webp` and `manifest.json`, `portrait-picks.json`, any edited prompt or cue table. Put the key lines of `report.json` (per file LUFS, true peak, length) and the line "not verified by ear" in the commit message or `docs/handoff/`.
- **Do not commit** `tools/out/` (raw PNGs and FLACs, sheets, reports; git-ignored), the fake studios' output, or `node_modules`. Use `git commit -- <paths>`, never `git add -A`.
- Update `docs/spec/60-audio.md` and `55-portraits.md` with a "Generated files" section (seeds, takes picked, measurements) and the KB entry `tabletop-kb/officers-of-the-han.md` (KB rule 19): record the real GPU times and any API surprise (job status words, the 1:1 aspect, file names) so the estimates above become facts.

## 8. Stop the studios (KB rule 17)
Close the Flux Studio and Audio Studio windows, or stop each by its own launcher or PID. If the Audio Studio started ComfyUI, stop that too. **Never `taskkill /F /IM node.exe`.** Confirm nothing is listening: `netstat -ano | findstr "7880 7890 8188"`.

## 9. If something fails
- "cannot reach the Flux/Audio Studio": the studio is not running or the port differs; pass `--base http://localhost:<port>` (or `FLUX_STUDIO_URL`, `AUDIO_STUDIO_URL`).
- A job never finishes: the runner cancels it after `--timeout` seconds (300 portraits, 900 audio) and moves on; the status words and the file list are read leniently, so if the real studio's `GET /api/jobs/<id>` differs, adjust `classifyStatus` and `jobImageNames` (portraits) or `jobFileNames` (audio) and add a test.
- "ffmpeg … no libwebp / libvorbis": use a full build (Gyan.FFmpeg or BtbN).
- Lettering or marks in portraits: the style says "wordless, untitled, no lettering, no border"; raise the seed (`--force` after changing `seedFor` input, or pick candidate b), and never add a name to a prompt.
