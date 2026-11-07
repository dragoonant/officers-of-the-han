# Officers of the Han — agent orientation

An original browser strategy game set in the Three Kingdoms era, where you play one officer in a living world (spiritual successor to the officer-play Three Kingdoms strategy games; not a port or recreation, not affiliated with Koei Tecmo). Owner credit: **evilgouki**. Never write the owner's real name, email or home path into this repo.

- **Read first:** `PLAN.md` (decisions D1–D19, milestones), `STATUS.md`, `docs/spec/00-architecture.md` (frozen contracts in `src/contracts/`), `10-rules.md` (world), `20-battle.md` (hex battles), `30-duel-debate.md`, `40-events.md`, `12-data.md`, `50-presentation.md` (Han lacquerware skin).
- **Knowledge base:** `docs/knowledge-base/` (submodule of `dragoonant/tabletop-kb`; `git submodule update --init`). `rules.md` there holds the owner's standing rules. Update `tabletop-kb/officers-of-the-han.md` at the end of every milestone.
- **Engine rules:** `src/world`, `src/battle`, `src/duel`, `src/debate` are pure and deterministic (no DOM, React, three, timers, `Date` or `Math.random`). `step` never throws, `legalActions` is never empty before the end, and `query.*` owns every number the UI shows.
- **Rules changes:** edit the spec first, log it in PLAN.md "Rulings / balance log", then change the code. Tests are named by rule id.
- **Skin:** everything visual follows `50-presentation.md`. Never copy three-kingdoms-tactics' sand-table skin.
- **Commands:** `npm run dev | typecheck | test | build | e2e | validate:data | sim`. Playwright uses `/opt/pw-browsers/chromium` when it exists. Set `PW_PORT` per worktree.
- **Git:** commit and push after each stage. Gate the commit, not the working tree. While agents run, commit only your own paths (`git commit -- <paths>`).
