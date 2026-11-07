# 55 — Portraits: the painted mirror faces (v0.1, 2026-11-07, PLAN D20)

**Status:** the pipeline is built and tested against a fake Flux Studio. **No portrait has been generated yet**: the studio runs only on the owner's Windows PC ("evilaegis"). Until files exist the game shows the older portrait or the lacquer medallion (PLAN D15) and says nothing about it. Every claim about how a portrait *looks* is **not verified by eye** until the owner has looked at the app (KB rule 7: art direction is set once; check the image, not the prompt).

Presentation parent: `50-presentation.md` ("Han lacquerware"; the officer card and duel mirrors show portraits inside a round bronze-mirror frame). KB rule 21: this is our own look; nothing here is borrowed from a sibling game's art.

## 1. The style (one constant, byte-identical on every prompt)
`STYLE` in `tools/gen/portraits/lib.mjs`:

> Head-and-shoulders portrait of a real historical person, realistic adult proportions, painted in mineral pigments on black lacquer with visible brush texture, a warm palette of vermilion, ochre, black lacquer and bone white, plain dark lacquer background, the head centred in the frame with clear space round it for a circular crop, second-century Chinese court and field dress. Wordless, untitled, no lettering, no border, full-bleed.

Rules behind it:
- **Plain materials and measurements** (KB rule 7/23): mineral pigment, brush texture, lacquer, bone white. Realistic adult proportions (head about one seventh of body height in a head-and-shoulders crop, normal eyes and jaw), never a stylised large-head figure.
- **No proper nouns in a clause** (KB local-ai-studios: a proper noun invites lettering). The style says "second-century Chinese", not an era or dynasty name, and no prompt contains an officer's name or courtesy name (a lint enforces this).
- **Flux has no negative prompt**, so the exclusions are in the positive text: "wordless, untitled, no lettering, no border".
- **No word from KB `rules.md` rule 23, and no game, studio, franchise or art-style label.** `lintPrompt` decodes the rule 23 list from an encoded constant, so a grep of this repo finds those words only in the KB. The prompts file is linted when it is built and again by a test.
- Palette matches the Han lacquerware tokens (vermilion, ochre, lacquer black, bone white).

## 2. Per-person prompt rules
A prompt is `Subject, dress, expression. STYLE`. Built from `src/data/officers.json` plus `src/data/scenarios/190.json` by `tools/gen/portraits/build-prompts.mjs` (`npm run portraits:prompts` writes `tools/gen/portraits/portrait-prompts.json`, 195 officers + 96 generic faces = 291 entries; the file is committed and a test checks it equals the builder's output).

| Part | Source and rule |
|---|---|
| Sex | `sex`. A woman: dark hair coiled in a high bun with a bone hairpin, robes or a belted robe; no beard clause. |
| Age | Age in 190 for officers on the scenario's start list; for an officer in `appearances` the age **at that appearance year** (the portrait is how they look when they first enter play); minimum 16. Worded as a decade with one skin clause ("in the thirties, faint lines at the eyes", "elderly, deeply lined face and white hair"). |
| Role | `civil` when INT or POL exceeds WAR by 15 and WAR is below 70: black gauze official's cap (a taller cap for a ruler) and layered wide-sleeved robes. `general` when WAR is 65 or more, or LDR 72 or more with WAR 50 or more: iron helmet and lacquered lamellar armour with cord lacing. `officer` otherwise: soft cloth cap, belted robe, leather-and-lamellar vest. `wanderer` (scenario faction null): plain undyed hemp clothing, cloth headwrap, worn travelling cloak, no ornaments. |
| Troop type | For generals only, from the best aptitude: cavalry (plumed helmet with cheek guards, short riding cloak), archer (plain helmet with a vermilion tassel, lighter armour, a bracer), spear (crested helmet, heavy armour and broad shoulder guards). |
| Temperament | righteous: "a steady, level gaze and a composed mouth"; ambitious: "a sharp, calculating look, eyes narrowed a little, one brow slightly raised"; cautious: "a guarded look, eyes watchful, lips closed and thoughtful"; reckless: "a fierce look, a hard stare, jaw set"; steady: "a calm, even look and a relaxed mouth". |
| Facial hair | Men from 22: one of five clauses chosen by a hash of the id (so it is stable); under 22 clean-shaven. |
| Sourced traits | **Only** the table `TRAITS` in `lib.mjs`, each with its source: Liu Bei (very long earlobes; Sanguozhi Shu 2, Romance ch.1), Guan Yu (very long full black beard, ruddy face; Romance ch.1, Sanguozhi Shu 6), Zhang Fei (broad dark face, round wide eyes, bristling whiskers; Romance ch.1), Dong Zhuo (heavy fleshy build; Hou Hanshu), Zhou Yu (fine features; Sanguozhi Wu 9), Zhuge Liang (tall; Sanguozhi Shu 5), Xu Chu and Dian Wei (huge or mighty build; Sanguozhi Wei 18). An officer not in the table gets no trait clause; nothing is invented. Add a row (with its source) to extend it. |
| Dress colour | One of six pigment colours chosen by id hash, so neighbours differ. |
| Seed | A fixed 31-bit FNV-1a hash of the id (`seedFor`). Candidate b uses seed + 1. A re-run asks for the same image. |

**Generic faces for created officers:** `face-01` to `face-96`, 96 portraits (the brief asked for 89 or more), varied by a fixed pattern in `genericSpecs()`: 40 percent women, nine ages from 19 to 66, four roles, three troop types, five temperaments. The create-officer picker lists them first once the manifest has them (`NewGame.tsx`); the older generic portraits follow.

## 3. Crop and output
- Request: Flux Studio `POST /api/jobs {model:'klein', prompt, aspect:'1:1', megapixels:1, batch:1, seed}` (FLUX.2 klein, Apache-2.0, about 6 s per 832×1216 image on the RTX 5080; a 1:1 megapixel image should be about the same). If the studio rejects `1:1`, use the nearest square-ish aspect it lists and tell the owner; the crop handles any aspect.
- **Square crop on the face centre.** The prompt centres the head, so the default face centre is (0.50, 0.44) of the image and the crop keeps 0.92 of the short side, clamped inside the image (`cropBox`). A reviewer can nudge one portrait: `--face id=0.5:0.40 --zoom id=0.85`, stored in `tools/gen/portraits/portrait-picks.json`.
- Output: **256 px and 128 px WebP** (libwebp quality 82), `public/portraits/gen/<id>.webp` and `<id>-128.webp`, plus `public/portraits/gen/manifest.json`. About 15 KB plus 5 KB per person, about 6 MB for all 291 (an estimate); sizes of 64 px and under use the 128 file. Generated files live in `gen/` so the older portrait remains a real fallback.
- The circular crop is done by the game's mirror frame (CSS), not baked into the file.

## 4. Review process
1. `npm run portraits:sheets` makes 4×4 labelled contact sheets of the raw candidates (`tools/out/portraits/sheets/sheet-NN.png`, 16 tiles each, a and b side by side, 37 sheets for all 582 images).
2. **Review every sheet** (KB rule 13: a measurable check per image, not a glance). Reject on: lettering or marks in the image, wrong sex or age for the data, missing or fused features, a head not near the centre, armour or headwear wrong for the role, a modern look, a child-like or oversized head. Check the first sheet before running the rest of the batch.
3. Choose with `--pick id=b,...` (default is a), nudge with `--face`/`--zoom`, then `npm run portraits:pick`. Re-run `gen-portraits.mjs --only <id> --force` with a changed prompt or seed for a reject (the old file is archived).
4. The first-look gate for the owner: `sounds.html` lists every portrait with its state; the officer card and duel screen show the real thing. Approval of the look is delegated to Claude with contact sheets sent as FYI (KB rule 7); the owner can still veto.

## 5. How the game resolves a portrait
`src/client/ui/portraitSource.ts` (pure, tested) and `Portrait.tsx`:
1. `public/portraits/gen/manifest.json` is read once at runtime. A committed manifest lists nothing, so there is never a 404 and never a console error.
2. If the manifest lists the officer's **id**, or the officer's `portrait` name (created officers carry `face-NN`), the generated `gen/<name>.webp` (or `-128`) is shown.
3. Otherwise the older file `portraits/<portrait>.webp`, only when the data names a `portrait` (the copied tactics portraits, PLAN D15); never guessed from the id.
4. If that fails to load, or there is none, the lacquer medallion.
A generated file that fails to load falls through to steps 3 and 4.

## 6. Files
`tools/gen/portraits/`: `lib.mjs` (style, lint, prompts, seeds, crop maths, PNG writer), `build-prompts.mjs`, `portrait-prompts.json`, `gen-portraits.mjs` (the Flux Studio runner: two candidates per entry, one job at a time, resumable, waits while the studio is busy, keeps the model loaded with `freeAfter:false` and restores it), `contact-sheets.mjs`, `pick-portraits.mjs`, `fake-flux-studio.mjs` (solid-colour PNGs; never ship its output), `portrait-picks.json` (created by the pick step). Commands: `npm run portraits:prompts | portraits:gen | portraits:sheets | portraits:pick | portraits:fake`. Tests: `tests/unit/portrait-pipeline.test.ts` (prompts, lint, runner, sheets and pick against the fake studio), `tests/unit/portrait-source.test.ts`, `tests/e2e/audio.spec.ts` (generated portrait wins).

## Change log
- 2026-11-07 v0.1 written with the pipeline (PLAN D20).
