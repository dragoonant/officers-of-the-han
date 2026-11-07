# 50 — Presentation: "Han Lacquerware" (owner yes, 2026-11-07, PLAN D5)

**Concept:** the world is laid out on a **painted Han lacquer tray**: black lacquer ground, vermilion and ochre brushwork, and cloud-scroll bands flowing round the rim. Cities are **bronze mirrors** set into the tray. Every panel is a **lacquer box** that opens. Dials are **mirror backs** with their concentric bands. Letters (missions, events, proposals) arrive on **pale yellow silk** edged in vermilion. Every surface comes from this one idea (KB rule 21).

## Must not look like
- **three-kingdoms-tactics** (the donor): no sand, no tent, no lanterns, no bamboo slips, no cinnabar seal stamp, no hanging silk banner, no Ma Shan Zheng brush type, no dark brown "night" ground, no jade/ochre banner colours as its pair.
- **assembly-forge** and **virtually-off** (the last two siblings): no industrial plates, rivets, hazard stripes, HUD brackets, neon or broadcast chrome.
- lorecannae: no gold filigree, no centred serif menu.
Gate before the first playable ships: screenshots of the title, the map and a mid-battle board beside three-kingdoms-tactics' title, battle select and board. If one could be mistaken for the other, it is not done.

## Palette (CSS tokens in `src/client/theme.css`)
| Role | Token | Value |
|---|---|---|
| Lacquer black (ground) | `--lacquer` | #0f0c0b |
| Lacquer raised (panels) | `--lacquer-2` | #1c1613 |
| Vermilion (bands, primary action) | `--vermilion` | #c4471d |
| Deep red lacquer (inner fields) | `--red-lacquer` | #6e1d12 |
| Ochre (brush accents, gold) | `--ochre` | #d9a441 |
| Verdigris bronze (mirrors, dials) | `--verdigris` | #5f8f7f |
| Polished bronze (mirror face) | `--bronze-face` | #b79a62 |
| Yellow silk (letters) | `--silk` | #eadbab |
| Ink (text on silk) | `--ink` | #231a12 |
| Text on lacquer | `--paper` | #efe3c8 |
| Muted text | `--dust` | #9b8a72 |

Faction colours are 14 lacquer pigments (`--f-1` … `--f-14`: vermilion is never one; the set includes malachite, azurite, orpiment, lead white, carbon grey, madder, indigo, umber, ochre-pale, cinnabar-brown, celadon, plum, sienna, slate). A faction shows its colour as the **inlay ring** of its city mirrors and as a lacquer dot on officer cards; never as a panel border.

**Interaction colours come from `legalActions` only.** *Available* is a slow ochre shimmer along the cloud-scroll band of a button or a mirror's rim. *Selected* is a vermilion ring. *Target* is a dashed vermilion ring.

## Type
- Display: **Cinzel Decorative is not allowed** (serif filigree). Display is **Josefin Sans** 600, uppercase, tracked +0.12em: it reads as letters inlaid in a box lid.
- Body: **Nunito Sans**, tabular figures for every number.
- Chinese characters appear only as ornaments drawn in SVG (cloud scrolls, the character for each faction's surname on its banner disc, rendered from **Noto Serif SC** subset). Never as a body font.
All from Google Fonts with system fallbacks.

## Ornament
- **Cloud-scroll band** (`<CloudBand>` SVG, one path repeated): the rim of the tray, the top of every box, the edge of every button. Drawn in vermilion on black or ochre on red.
- **Mirror** (`<Mirror>` SVG): concentric rings, a central knob, a rim of tiny triangles (the "saw-tooth" band). Used for cities, the officer portrait frame, stat dials and the month dial.
- **Box** (`<LacquerBox>`): a black rounded rectangle with chamfered corners, a red-lacquer inner field 6 px in, a cloud band across the top edge; opening animation is the lid lifting (translateY −8 px, fade) in 180 ms.
- No drop shadows except one: boxes cast a soft warm shadow onto the tray (`0 8px 24px rgba(0,0,0,.6)`).

## Surfaces
- **Title:** a lacquer tray filling the screen, cloud scrolls drifting slowly round the rim, the title inlaid in ochre caps in the middle, three box-lid buttons below: Continue (naming the save, KB rule 22), New Officer, How to Play. A line: "Unofficial, non-commercial fan project by evilgouki. Not affiliated with Koei Tecmo."
- **New game:** pick a start (190) → pick an officer from a grid of portrait mirrors filtered by faction (with their post, city and stats as mirror-back dials) or **Create an officer** (name, birth year, five stats with a points pool, temperament, troop type, portrait, start city).
- **Map:** the painted tray with China's rivers as thin ochre brush lines (Yellow River, Yangtze, Han, Huai), mountain ranges as cloud-scroll hatching, cities as mirrors (size by population) with faction inlay rings, roads as fine vermilion lines with their days written on them. Your officer is a small vermilion lacquer token on their city. Tap a mirror for the city box. Phone-first: one-finger pan, pinch zoom, the box opens as a bottom sheet on phones.
- **HUD:** a top strip with the month dial (a mirror whose rim moves one segment per month, the year in the knob), your officer's days left as 30 tick marks round a small mirror, purse gold, post and rank. A bottom bar of action boxes for the current city, grouped: Work, People, Court, Travel, Self. Each button names what it does and its cost in days and gold (KB rule 8; numbers from `query.*`).
- **Officer card:** a mirror-framed portrait (or the medallion), name, post, rank, five stats as mirror-back dials, temperament, aptitude A/B/C, loyalty (if any), ties (oath, spouse, kin, rivals, top friends with the friendship numbers).
- **Letters:** silk sheets that unroll from the top, vermilion edge, ink text, one or two vermilion-lacquer answer buttons. Missions, event choices, proposals, captures and battle reports are all letters.
- **Battle:** the 3D hex board is a **lacquered gaming board**: each hex a slightly raised lacquer tile, painted in mineral colours by terrain (malachite plain, celadon grass, darker malachite forest with small carved trees, umber hill steps, azurite river with ochre ripple lines, vermilion-and-black wall blocks, an ochre keep). Figures stand on the tiles in the house style (KB rule 7) with a faction-pigment sash; no bases. The initiative order is a row of small mirrors across the top. Picking is by tile only (KB rule 25); mouse and touch controls per KB rule 27.
- **Duel:** two large mirrors facing each other, the duelists' portraits inside, vigor and spirit as rings round them; the AI's stance odds shown under its mirror; four stance buttons. **Debate:** two lacquer trays; argument tablets are small lacquered wooden tallies with the kind's glyph and power in ochre; both hands face up; the opponent's odds shown over its tablets.

## Motion
- Lids lift in 180 ms; letters unroll in 260 ms; nothing bounces. The month change is the dial rim turning one segment (400 ms). Battle moves follow the presentation-director pattern from three-kingdoms-tactics (presented-state cursor; Instant speed for e2e).

## Phone
Everything works at 390 × 844 portrait and 844 × 390 landscape: boxes become bottom sheets, the action bar scrolls horizontally, the map pans and pinches. KB rule 24 CSS in the base stylesheet.

## Change log
- 2026-11-07 v0.1 written at M0.
