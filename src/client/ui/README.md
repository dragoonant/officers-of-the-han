# src/client/ui — Han lacquerware components

Import the theme once (`import '../client/theme.css'`) and call `installNoSelect()` at startup (KB rule 24). All colours are tokens in `theme.css`.

| Component | Props | Notes |
|---|---|---|
| `<CloudBand height? color? />` | height 14, color `var(--vermilion)` | One curl path repeated; fills its parent's width. |
| `<Mirror size? face? rim? rings? knob? selected? target? >children</Mirror>` | `rings: {value 0..1, color}[]` outermost first | Concentric rings and saw-tooth rim; children sit in the face. |
| `<LacquerBox title? >children</LacquerBox>` | | Chamfered black box, red field, cloud band; lid-lift 180 ms. |
| `<SilkLetter title? actions? >children</SilkLetter>` | | Yellow silk, vermilion edge, unrolls 260 ms. |
| `<LacquerButton name cost? onClick disabled? primary? state? />` | `state: 'available' \| 'selected' \| 'target' \| 'none'` | `name` says what it does; `cost` is the second line (numbers from `query.*`). Min 44 px tall. |
| `<StatDial label value max? size? color? />` | | A mirror-back dial for one number. |
| `<Portrait id? name portrait? size? faction? rings? selected? target? />` | portrait file `public/portraits/<portrait ?? id>.webp` | Falls back to the medallion (surname initial + cloud scroll). |
| `<OfficerChip id? name portrait? sub? faction? size? />` | | Small portrait + name + a line. |
| `installNoSelect()` | | `selectstart` / `contextmenu` fallback listeners. |
