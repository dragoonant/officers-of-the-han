# m-mobile handoff: the map on phones

Branch `m-mobile` (worktree `oth-mobile`), not pushed, not merged.

## How it was measured
`tools/perf/map-perf.mjs` (not part of `npm run e2e`): `npm run build && PW_PORT=5331 node tools/perf/map-perf.mjs --label x --rates 1,4,6 [--shot file.png] [--battle]`. Pixel 7 emulation, CDP CPU throttle, a New Game as Liu Bei, the opening letter accepted, then a scripted 90-move pan and a 124-move pinch (one pointer move per animation frame, driven in the page so a slow frame shows as a long frame), a city tap, and End Month. Reports rAF frame median/p95/count over 50 ms, long tasks, main-thread ms (script/style/layout) and **raster ms** (sum of `RasterTask` from a trace). CDP throttling slows the main thread only, so raster work is reported as its own number; it is the filter's cost and it is not in the frame times. Raw runs: `tools/perf/out/*.json`.

## Causes found
1. **The `#brush` filter** (confirmed, biggest). feTurbulence + feDisplacementMap over the rivers re-rasterised on every viewBox change. Raster fell from 1.5 s to 0.46 s over the same pan once removed.
2. **viewBox changes relayout every `<text>`** (found by probing, not in the suspect list). Changing the svg `viewBox` costs 1.4 ms per frame on desktop (about 6 ms at 4x) because all city names and road days are re-laid-out; a `translate` on a `<g>` costs 0.04 ms, a `scale` 0.7 ms.
3. **Pan and zoom through React state** (confirmed). Script time per pan 413 ms -> 100 ms at 4x; the 1000-node SVG re-rendered per pointer move.
4. **Infinite `.lbtn.avail::after` shimmer** animated `background-position` (main-thread repaint every frame on every available button, all through a pan).
5. **Group `opacity`** on ranges and rivers forces offscreen layers each raster: small gain from `stroke-opacity`.
6. Not causes: `placeLabels` and `pops` (memoised, per month or per zoom step only); `.drift` (End screen only); the title flow animations (the title unmounts when the map is up; the `.title` is not rendered in `Game`); `drop-shadow` on `.lbox` (invisible, see below, removed anyway). Map cities do not use `Mirror` (five plain circles each), so no `<symbol>` was needed.

## Fixes
1. `geo.ts` `riverBrush`: samples the smoothed course every 3 units and pushes each sample sideways with two seeded sines (wavelength about 25 and 12, amplitude 1.5 in all). Filter and `<defs>` deleted.
2. `MapView.tsx`: the view lives in refs. The `<svg>` viewBox is the box in pixels and constant; the view is one `matrix()` on `<g data-testid="map-world">`, written at most once per frame (rAF coalescing; tweens write inside their own frame). Only the level of detail (`lod`: 0 far, 1 zoomed in, 2 very close, the same thresholds 640 and 300) is state, so labels and road days re-render at those two crossings only. The rect is cached at pointer down.
3. Static layers memoised: `Backdrop` (tray, cloud rim, ranges, rivers), `Roads`, and `CityMirror` per city on primitive props. River paths and tufts are computed once at module load.
4. `theme.css`: shimmer is a `transform` sweep with `will-change: transform` (compositor); on `(pointer: coarse)` it plays 4 times and rests as the static ochre band. `.lbox` `filter: drop-shadow` removed: a filter runs before `clip-path`, so the shadow was clipped away (screenshot of the Houses panel is byte-identical); `.lbox-wrap` still draws the visible shadow.
5. Range and river alpha moved from group `opacity` to `stroke-opacity`.

Kept: Find me, label collision (`placeLabels` untouched), the framing tween, reduced motion (instant fly), picking by tile only (`closest('[data-city]')`), no text selection. New e2e: `world.spec.ts` "the map pans by drag, zooms by wheel, and Find me flies back".

## Before / after (Pixel 7, ms; frame = rAF interval, 16.7 is one frame at 60 Hz)
| | CPU | before | after |
|---|---|---|---|
| Pan median / p95 | 1x | 16.7 / 16.7 | 16.7 / 16.8 |
| | 4x | 16.8 / 33.4 | 16.7 / 16.8 |
| | 6x | 33.3 / 50.1 | 16.7 / 33.4 |
| Pinch median / p95 | 1x | 16.7 / 16.7 | 16.7 / 16.7 |
| | 4x | 33.3 / 50.0 | 16.7 / 33.4 |
| | 6x | 33.4 / 50.1 | 16.8 / 50.0 |
| Raster per pan (ms) | any | 1235-1527 | 356-408 |
| Raster per pinch (ms) | any | 2115-2308 | 674-889 |
| Main-thread work per pan (ms, 1x) | 1x | 475 | 188 |
| Longest long task in a gesture | 4x / 6x | 70 / 60 | none / none |
| First map render after New Game | 1x / 4x / 6x | 58 / 309 / 396 | 69 / 326 / 391 |
| City box open, longest long task | 4x / 6x | 55 / 77 | 53 / 73 |
| End Month, longest long task | 4x / 6x | 182 / 248 | 157 / 257 |

Targets at 4x: pan median 16.7 (<= 20), p95 16.8 (<= 40), pinch median 16.7, p95 33.4 (<= 40), no long task over 100 ms in a gesture, city box and End Month under 300 ms of blocking. All met. At 6x pinch p95 is 50 (not a target).

End Month is engine-bound: `world.step(endMonth)` alone is 93 ms at 4x; the rest is the letters' render and the save (`JSON.stringify` of the snapshot plus `setItem` about 8 ms for 98 KB). No engine change was made.

Intermediate runs (rivers only, matrix, css, opacity) are in `tools/perf/out/`.

## Battle (phone profile)
Already tuned: `isLowTier()` (short side under 600 px) gives dpr 1, no shadows, no antialias and at most 2 figures per unit; larger screens get dpr [1, 1.5] with PCF shadows. Verified the canvas is 412x839 on the Pixel 7 profile (dpr 1 on a 2.6 device, so it is soft). The Canvas mounts with `BattleScreen` and is disposed with it, so it is re-created per battle (a context creation, once). The headless sandbox only has SwiftShader software GL (170-250 ms frames at any throttle), so GPU frame time on a real phone could not be measured; `--battle` in the script reports the sandbox figure only. No change made.

## Open
- Pinch still re-lays-out text on each scale step (about 5 ms per frame at 4x); a CSS-transform-during-pinch scheme would remove it but shows blank edges when zooming out. Not needed for the targets.
- Raster is still about 4 ms per frame on this CPU (cities, halo text, dashed circles, the cloud-band pattern). Not throttled by CDP; a real mid-range phone should be checked by hand. Next steps if needed: cache the static backdrop as a bitmap, drop the halo to a lighter stroke at far zoom.
- Battle: real-device GPU numbers; consider dpr 1.5 on phones if the soft canvas matters more than fill rate.
- Title screen flow animations are unchanged (not on the map screen).
