# STATUS — Officers of the Han

**2026-11-07, end of the first overnight run.** M0–M3 done and M4a done, all committed locally. Not on Pages yet: the repo `dragoonant/officers-of-the-han` does not exist (PLAN D1), and the cloud session cannot create it.

## Playable now (`npm run dev`)
- Title, new game in 190: pick any of 159 officers, or create your own. Map framing centres on you, with a "Find me" button.
- The lacquer map of 48 cities and 73 roads, with city boxes, officer cards, houses and chronicle panels, and letters. Months have 30 days per officer, spent on work, people, court, travel and self.
- Hex field battles in 3D (R3F) inside the world, with an AI switch and Normal / Fast / Instant speed. Duels and debates (open-information AI tells).
- Autosave to `localStorage['oth-save']` and Continue, including mid-battle.
- `lab.html`: a standalone Battle / Duel / Debate lab.

## Gates (main, 2026-11-07)
- typecheck clean
- 337 unit tests
- `validate:data` ok
- build ok
- 20 e2e passed, 2 skipped (screenshot specs, run with `SHOTS=1`)
  - The lab "mouse" pan test flaked once and passed on rerun.

## Sim (10 seeds × 10 years, `npm run sim`)
| Metric | Value |
|---|---|
| Invariant failures | 0 |
| Famine | 0.09 per faction-year |
| Wars | 0.59 per faction-year |
| Captures | 0.18 per battle |
| AI wars in the first 3 months | none |

**Open:** Dong Zhuo's house dominates (about 12 cities by 200), and Cao Cao survives only 4 of 10 seeds. M4b is working on it.

## Known gaps
- **Feedback and engine:**
  - No battle result letter yet; the outcome shows only in the ticker and chronicle. M4b is adding one.
  - The `war` and `propose` dialogs crash if opened while unavailable; the UI disables them. M4b is fixing this.
  - `suggestArmy` takes no proposer. M4b is adding it.
- **Rendering:**
  - Each battle mounts its own WebGL canvas. The persistent-renderer recipe from the KB is not applied yet.
- **Art and audio:**
  - Art is debt: portraits and battle figures come from the three-kingdoms-tactics procedural kit, the older style that KB rule 7 replaced. House-style art needs a session on the owner's PC (M5).
  - No audio (M6).
- **Screenshots:** the older M3a screenshots in `docs/screens/` (`map-midgame.png`, `phone-portrait.png`, `city-box.png`, `letter.png`, `officer-picker.png`) predate M3c's map framing. The current ones are `title.png`, `map-on-open-*.png`, `world-battle-mid-fight.png` and `battle-result-chronicle.png`.

## Next
1. The owner creates `dragoonant/officers-of-the-han`: empty and public, with Pages set to Source: GitHub Actions. The session then pushes main, and `.github/workflows/deploy.yml` deploys it.
2. Merge M4b: the result letter, the dialog guard, the proposer for `suggestArmy`, and the Dong Zhuo balance.
3. M5 art on the owner's PC.
