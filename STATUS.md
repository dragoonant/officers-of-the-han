# STATUS — Officers of the Han

**2026-11-07, end of the first overnight run.** M0–M3, M4a and M4b done, all committed locally. Not on Pages yet: the repo `dragoonant/officers-of-the-han` does not exist (PLAN D1), and the cloud session cannot create it.

## Playable now (`npm run dev`)
- Title, new game in 190: pick any of 159 officers, or create your own. Map framing centres on you, with a "Find me" button.
- The lacquer map of 48 cities and 73 roads, with city boxes, officer cards, houses and chronicle panels, and letters. Months have 30 days per officer, spent on work, people, court, travel and self.
- Hex field battles in 3D (R3F) inside the world, with an AI switch and Normal / Fast / Instant speed. Duels and debates (open-information AI tells).
- Autosave to `localStorage['oth-save']` and Continue, including mid-battle.
- `lab.html`: a standalone Battle / Duel / Debate lab.

## Gates (main, 2026-11-07)
- typecheck clean
- 346 unit tests
- `validate:data` ok
- build ok
- 20 e2e passed, 2 skipped (screenshot specs, run with `SHOTS=1`)
  - Under the full suite's load, two lab tests have each failed once: the "mouse" pan and the rule-25 tile tap. Both passed on rerun. Treat them as timing flakes to harden.

## Sim (10 seeds × 10 years, `npm run sim`; after M4b)
| Metric | Value |
|---|---|
| Invariant failures | 0 |
| Famine | 0.08 per faction-year |
| Wars | 0.68 per faction-year (0.59 over 30 seeds) |
| Captures | 0.22 per battle |
| Dong Zhuo's successor house at 200 | 4.4 cities |
| Cao Cao alive at 200 | 10 of 10 (28 of 30) |
| Seeds with any house over 40% of cities | none |

**Open:** about 18 factions are left at 200 (the target band is 8–14), and battles fall from about 350 a year in 190 to about 30 by 198. The late game is too quiet and needs a pressure term. War count jumps sharply with the AI war chance (`docs/spec/13-balance.md`). Battle result letters can pile up when the player's house is attacked often.

## Known gaps
- **Feedback and engine:**
  - Done in M4b: a battle result letter (`W-WAR-10`), a guard in the war and propose dialogs, and `suggestArmy` with a proposer.
  - One data-level fix: the `burning-of-luoyang` event moves 20,000 troops from Luoyang to Chang'an (`docs/handoff/m4b.md`).
- **Rendering:**
  - Each battle mounts its own WebGL canvas. The persistent-renderer recipe from the KB is not applied yet.
- **Art and audio:**
  - Art is debt: portraits and battle figures come from the three-kingdoms-tactics procedural kit, the older style that KB rule 7 replaced. House-style art needs a session on the owner's PC (M5).
  - No audio (M6).
- **Screenshots:** the older M3a screenshots in `docs/screens/` (`map-midgame.png`, `phone-portrait.png`, `city-box.png`, `letter.png`, `officer-picker.png`) predate M3c's map framing. The current ones are `title.png`, `map-on-open-*.png`, `world-battle-mid-fight.png` and `battle-result-chronicle.png`.

## Next
1. The owner creates `dragoonant/officers-of-the-han`: empty and public, with Pages set to Source: GitHub Actions. The session then pushes main, and `.github/workflows/deploy.yml` deploys it.
2. M4c balance: late-game pressure, so the world keeps consolidating after 195. Add a digest for result letters.
3. M5 art on the owner's PC.
