# Assets

Runtime art lives here, under `src/`. The dev preview server serves `src` as its web root,
so this is the only location where the same relative path resolves both in Electron
(file://) and in the preview. The root `assets/` folder holds build-time source art and is
excluded from the packaged app.

## Sprite sheets

A sheet replaces the CSS-art figure whenever a weapon of its **style** is equipped — the
same thing that switches Combat's attack style, so what you see matches how you fight.
`SHEETS` in `src/game/sprites.js` is keyed by that style, so adding a class means adding
one entry there; a style with no sheet just keeps the CSS art.

| Sheet | Style | Worn with | Grid | Poses |
| --- | --- | --- | --- | --- |
| `warrior-sheet.png` | `melee` | a sword, or bare fists | 8 × 3 | 20 |
| `monk-sheet.png` | `monk` | Monk's Gauntlets | 5 × 4 | 19 |
| `cleric-sheet.png` | `cleric` | Prayer Book | 7 × 4 | 25 |
| `gunslinger-sheet.png` | `gunslinger` | Dual Revolvers | 8 × 5 | 31 |

**None of these files is edited by hand.** All are generated from the source art:

```bash
python3 scripts/build-warrior-sheet.py
python3 scripts/build-monk-sheet.py
python3 scripts/build-cleric-sheet.py
python3 scripts/build-gunslinger-sheet.py
```

Re-run the relevant one after replacing its source. All need Pillow and numpy.

Frames are numbered left-to-right, top-to-bottom from 0. Rows shorter than the grid leave
trailing cells empty and **no animation may name one**. If a sheet is missing or fails to
load, the game keeps its CSS-art character — a missing asset never breaks a screen.

### Why the sheets are rebuilt rather than sliced

Both sources put their poses on an opaque grey checkerboard and neither lays them on an
even grid, so slicing them directly cuts figures in half and paints a grey box on screen.
The build scripts key out the checkerboard, find each pose by its own content, and
recompose onto a uniform grid with feet on a shared baseline. Notes on the tricky parts:

- **The colour key alone is not enough.** Compression noise smears the background across
  the whole grey range, overlapping the art's own dark outlines and the grey shading on
  white robes. Both scripts nominate candidates by colour but only remove what is
  *reachable from the border*, so anything enclosed by a figure stays opaque.
- **The cleric needs a second pass.** Her spell circles and healing glows ring the figure
  completely, trapping checkerboard squares the border fill can't reach. Those pockets are
  flat, exact checkerboard tones unlike any shading in the art, so they're removed by tone.
- **Feet sit on a per-row ground line, offset from it** rather than bottom-aligned, so
  airborne and kneeling poses keep their height instead of being planted on the baseline.
- **Poses are anchored on the lower body**, not the full bounding box, so an outstretched
  staff or arm doesn't drag the figure sideways between frames.
- **The cleric's source has a title and row labels baked in.** They're cropped away by
  position; the title is white and would otherwise survive the key and read as a pose.
- **The warrior's frames are not cut to a grid at all.** A raised sword reaches far past the
  body, and any box drawn around the body clips the blade. Instead each figure is grown out
  from its own armour until its ink runs out, so a pose takes exactly the room its own sword
  needs. That only works because the **printed rule lines are removed first**: they span the
  full width of the sheet, and with them in place growing from any one body floods the entire
  row, since every figure is joined to every other through them.
- **A pose is clamped inside its cell's padding, not merely inside the cell.** The lower-body
  anchor can push a wide pose flush against the edge, and a frame flush with its cell bleeds
  a sliver of its neighbour once the sheet is scaled.
- **Sheets are resampled down at build time**, with a proper filter, to roughly 2x the size
  the game draws them. Nearest-neighbour sampling from a much larger source throws away over
  half the pixels and looks grainy. For the same reason the warrior and gunslinger — detailed
  illustration rather than chunky pixel art — are flagged `smooth` in `sprites.js`, so what
  scaling remains is filtered instead of point-sampled.
- **The warrior's source is a labelled animation sheet** whose labels state each row's
  frame count, which gives ground truth to segment against. Its body is both saturated and
  dark, while the effects are saturated but bright and the labels are dark but grey, so that
  pair of tests isolates the figures. Three of its rows are **skipped**: WALK (no movement
  animations in the game) and the OVERHEAD STRIKE, MAGIC THRUST and AETHER BLAST attacks,
  whose effects are large enough to occlude the bodies and overlap the neighbouring pose —
  every segmentation that hits the stated count does so by cutting figures in half or
  grouping three together. Re-exporting those rows one pose per cell, or without the effect
  layer, would make them usable.
- **The gunslinger's cards leak muzzle flash into each other.** The cards sit shoulder to
  shoulder and a flash runs straight out of its own card into the next, where it reads in
  game as a flare hanging in the air behind the following pose. Nothing about the flare
  itself gives it away: it runs to hundreds of pixels, it abuts the figure as closely as his
  own flash does, and for the charge shot it is even joined to him through the beam, so
  neither size, distance, direction nor connectivity separates it.
  What does is provenance. Cards are lifted **left to right**, and each one claims its own
  spill — the flash flooded outward past its right-hand edge — so the card to its right
  subtracts what has already been accounted for. The flood is confined to effect-coloured
  pixels, which is what makes crossing the card boundary safe: a beam can be followed out,
  but the neighbouring gunslinger is not effect-coloured and can never be claimed by
  mistake.
- **The gunslinger's source is a character *design* sheet**, not a sheet of frames: a cream
  page with a portrait, printed headings, frame numbers, and poses in beige cards of
  varying size in groups of varying length. Every usable pose is inside a card, so the
  script finds the cards rather than assuming a grid. Its MOVE SET row (running, dodge
  roll, jump) is **skipped** — those poses are printed straight onto the page with no card
  to key against, and the game has no use for movement animations.

### Scale

`figureRatio` in each sheet definition is how much of a cell's height the character
occupies in an idle frame — the build scripts print it. Sheets pad their cells differently
(the cleric reserves room for symbols above her head: 72% vs the monk's 88%), so scaling by
*cell* height would render her noticeably smaller. Sprites are scaled so the **figure** is
`TARGET_FIGURE_H` tall instead, which also means a sheet can be re-exported at any
resolution without a code change.

### Animations

`ANIMATIONS` per sheet in `src/game/sprites.js`. The monk's sheet is unordered poses, so
its animations name frames from across the rows; the cleric's came labelled by row, so each
row *is* an animation in the artist's own order.

**Warrior (melee)**

| Animation | Frames | Reads as |
| --- | --- | --- |
| `idle` | 0–7 | standing, cape and hair shifting |
| `attack` | 8–15 | an eight-frame lunging sword slash |
| `defense` | 16–19 | shield up and braced |

**Monk**

| Animation | Frames | Reads as |
| --- | --- | --- |
| `idle` | 0 → 1 → 10 | standing still, breathing |
| `strike` | 11 → 3 → 5 | guard, hit, hit |
| `attack` | 14 → 4 → 6 → 7 | guard, cock the palm back, open-handed thrust, recover |
| `kick` | 2 → 9 → 12 → 8 → 14 | step in, knee up, high kick, flying kick, land in guard |
| `fury` | 11 → 3 → 5 → 15 → 16 | a flurry of fists, no recovery frame to pause it |
| `special` | 17 → 13 → 18 → 14 | gather, leap, palm strike with energy blast, settle |

**Cleric**

| Animation | Frames | Reads as |
| --- | --- | --- |
| `idle` | 0–6 | standing with the staff, breathing |
| `attack` | 7–12 | staff thrust and follow-through |
| `spell` | 14–19 | holy magic builds in both hands, sigil rings her feet |
| `heal` | 21–26 | hands raised, healing crosses gathering overhead |

**Gunslinger**

| Animation | Frames | Reads as |
| --- | --- | --- |
| `idle` | 0–4 | standing under the hat, coat shifting |
| `attack` | 8–15 | dual shot: both revolvers up, alternating muzzle flash |
| `hip_fire` | 16–20 | fired from the waist, faster and looser |
| `trick_shot` | 24–28 | a flourish and a spin into the shot |
| `charge_shot` | 32–39 | winds up a glowing round, then a beam of a muzzle flash |

**Every action animation currently just takes its turn.** Each sheet's `cycle` lists them,
and each plays through once before handing over to the next, so all the artwork gets seen —
in combat and while gathering alike. `idle` sits outside the cycle.

To tie animations to specific moves later: `MONK_TECHNIQUES` and `CLERIC_SPELLS` in
`data.js` each carry an `animation` field recording which one suits them, and `Combat`
exposes `getActiveTechnique()`. Feed that into `Sprites.setAnimation(el, name)`, which pins
one animation and takes that character out of the cycle.

Every skill module marks "acting" by putting `.swinging` on the character's front arm, so
mining, smithing, cooking, fletching, woodcutting, hunting and combat all animate the
sprite without knowing it exists.
