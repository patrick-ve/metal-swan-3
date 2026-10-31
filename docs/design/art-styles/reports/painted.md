# Style `painted` — PAINTED (report)

Character: `vincent-painted` (`?char=vincent-painted`, arena / shot `--char vincent-painted`).

## The idea

VINCENT as a hand-painted figure, like a painted cel or a storybook illustration: no ink line, the
edges come from value and colour, with a soft dark edge only on the shadow side. Warm light from
the upper left, cool blue-violet shadows, a little warm light bounced up from the ground, and
visible brush strokes that break every gradient into dabs.

## How it is built (own drawer on the rig's skeleton, own render pass)

Files (all in `src/game/content/characters/styles/`):

| file | what |
|---|---|
| `painted.ts` | `STYLE` + `renderPose`: the frame geometry, the 2×/4× path, the 1× repaint |
| `painted-rig.ts` | a copy of the rig's style resolve and pose solve (`resolve`, `solve`, `weaponRig`, `offhandRig`, builds) + `frameRect` (where the 1× frame lies on the rig's working canvas) |
| `painted-body.ts` | a pruned copy of the HD body (`hd/body.ts`): the same volumes on the same skeleton and 1× footprint, with painted materials and part-local brushes |
| `painted-head.ts` | VINCENT's painted head, drawn straight into the body's canvas |
| `painted-paint.ts` | the painter: reads the HdCanvas G-buffer and paints it (replaces `HdCanvas.render`) |
| `painted-ramps.ts` | the colour script: painted ramps (PAL_HD only) |
| `painted-soften.ts` | softens the bands of the rig's gear images; remaps hand skin onto the painted skin ramp |

Main tricks:

- **G-buffer repaint.** The figure is drawn with the HD kit's primitives (`HdCanvas`: capsules,
  blobs, height fields), but the canvas's own banded render is never called. `paintRender` lights
  each art px itself: one warm key light with a wide soft wrap, a "form bend" (normals bent a
  little sideways so cloth reads rounder), reflected light on the side turned away (the darkest
  value sits at the core shadow, not at the edge), a warm ground bounce on downward faces.
- **Painted ramps.** Each material has a ramp of PAL_HD colours whose darks are cool and lights
  warm (tweed: violet-grey → wine → brown → honey; olive: slate → olive → sun-bleached olive; skin:
  rose-violet → peach), plus a warm "bounce" twin used where the ground light wins.
- **Stroke dither.** The tone between two ramp colours is chosen per brush stroke, not per px:
  the art grid is cut into short strokes (about 1.6 × 0.5 logical px) along a direction, each
  stroke has one threshold and a small value jitter. The brush frame is attached to the part
  (trouser strokes run down each leg segment, sleeve strokes down the arm, tweed strokes slant
  across the torso, the hair's brush runs in arcs round the crown), so strokes move with the limb
  and never swim or boil between frames.
- **No outline.** The form grows by about 1 logical px into the rig's outline room, with normals
  turning away (a rolled edge); the outer half of that ring is broken where strokes stop short (a
  dry-brush edge; gear keeps a clean edge). Only the right / lower edge gets a soft dark edge.
  Parts are separated by soft contact shadows (AO) and short cast shadows, never by a line.
- **Painted head** (head-local implicit forms mapped by one similarity: neck point, tilt, Helium
  scale 2): a skull / jaw / chin / nose mass blended with a smooth max; a close-cropped hair cap
  whose hairline is a polygon with the temple recess and a sideburn (a smooth convex hairline read
  as a helmet); a warm ear. Likeness cues as painted value shapes: the RAISED BROW is one dark
  arched stroke in the hair's paint, the SMIRK a dark mouth line climbing to the back corner with
  a crease, a lit lower lip and a lifted cheek, the HEAVY STUBBLE a dark, greyed glaze over jaw,
  chin and upper lip with a brushy border (the lips stay clear). The face has its own, more
  frontal key light (a painter's cheat: a right-facing face lit from the upper left sits in back
  light). All 11 expressions are drawn (normal, shout, blink, happy, smile, yawn, dazed, hurt,
  panic, chew, soot).
- **Gear**: the rig's HD gun, hands, knife, held items and props are placed as images; their
  hard bands are softened (dabs cross the band borders) and the hand skin is remapped to the
  painted skin ramp (rose shade instead of orange).
- **Helium Head**: the pink rim is kept (status cue), painted as a dabbed ring of two pinks on
  the head's grown edge.
- **1×**: the rig's 1× frame with its ink outline repainted: on the lit side the outline px take
  the colour of the form beside them, on the shadow side a darker tone of that form's PAL ramp.
  Same size, anchor and points; PAL only.

Frame contract: the d = 1 frame is the rig's 1× frame (repainted), so its size, anchor and points
are the rig's. The 2× / 4× frame is drawn on the same working-canvas rectangle the rig's HD render
uses (`frameRect`, from the 1× frame and the 1× solve) and cropped to exactly w·d × h·d. Checked:
all 465 frames at 4× and at 2× build without error, and the muzzle / hand / head / hip points sit
on the same places in the 1× and 4× drawings (pistol and heavy, all aims, run, crouch, die).

## Proportions

Unchanged: the rig's builds, skeleton, footprint and points. The head keeps the rig's 18 × 19
layout; the nose is a little longer and the hair a close crop with a temple recess.

## Simplified / not restyled

- `die-burn`, `die-blast`, `die-drown`, the Swan rider strips (by the switch's design) and
  `die-flat`, `portrait` (index.ts) keep the rig look.
- The open battle-plan sheet in `bored` / `fidget-a` is VINCENT's own 1× decoration piece
  (`decorate` in vincent.art.ts), not repainted.
- Gear (gun, hands, props) is the rig's art, softened and recoloured, not natively painted.
- The torso supports VINCENT's top (jacket, tie, tweed); other top types / accessories of other
  heroes (vest, cape, scarf, backpack, pouches …) are not drawn by this copy.

## Build time (4×)

- Per frame: painted ≈ 4.0 ms, rig ≈ 2.1 ms (same poses, memo defeated; `tmp/styles/work-painted/bench.ts`).
- Whole contract (`npm run sprites -- char/vincent-painted/ --density 4`, 465 frames incl. the
  rig deaths): ≈ 7.0–7.6 s vs ≈ 5.2 s for `char/vincent/`.
- VINCENT's main strips (legs idle / run / jump / fall / land / crouch, pistol torso idle / shoot /
  aims / run / crouch, flip; about 75 frames): roughly 0.3 s painted vs 0.16 s rig. All strips
  are deferred, so a strip costs this on first use (a run strip ≈ 50 ms).

## Open issues

- Readability: softer than the inked look; on mid-value warm backgrounds (the red bike path) the
  brown jacket separates less. The shadow-side edge and value contrast carry it, and it reads at
  game size (arena clip and street still), but it never pops like an ink line. A cool light rim
  on the lit side would be the next knob if the user wants more pop.
- Victory frames 2–3: the thumbs-up hand sits behind the face (rig pose rule) and merges with the
  nose more than with an ink line.
- The nose is a deliberate caricature cue; it may want to be a touch smaller.
- 1× is only a light repaint (no outline, darker shadow edge), not a full painted look.
- To use this style for the other heroes, the head needs their hair / face traits as polygons
  and value shapes (this head is VINCENT's), and the torso copy needs their tops and accessories.
- Observation (not this style): the street still of every trial style shows VINCENT in a
  non-aiming idle pose at t = 151, while the baseline still `vincent-street.png` shows him aiming.

## Shared-file requests

None.

## Review images

`tmp/styles/work-painted/`: `final-main-4x.png` (main poses on three backgrounds),
`final-special-4x.png` (knife bonk, bored, victory, salute, Helium Head, crouch shot, die),
`final-heads-4x.png` (all expressions), `final-idle-closeup.png`, `final-street-vs-rig.png`,
`arena-a.png` / `arena-c.png` (arena frames, rig above, painted below), `runseq.png` (run cycle),
`marks.png` (1× vs 4× points). Captures: `tmp/styles/out/painted/`, `tmp/styles/out/painted-street.png`.
