# Style `comic` — COMIC INK (VINCENT, `?char=vincent-comic`)

## The idea

VINCENT as a comic-book panel come alive: bold black brush ink whose weight swells on the side
away from the light (thin 3 px holding line up/left, a 6–7 px heavy stroke down/right at 4×), flat
colour in two tones per material, halftone dot screens in the shadows and a few white glints. The
face is drawn with a confident ink line: the raised brow as one bold arch, a black iris with a
white catchlight, the smirk, the ear's curl, and the heavy stubble as short ink hatching that is
dense on the jaw and thins out towards the cheekbone.

## How it is built (post-process of the rig's G-buffer, plus an inked head and drawn folds)

Not a pixel filter: the rig's HD drawing is kept as a G-buffer (material, part, depth, normal,
tone per art px) and lit, toned and inked again. Same skeleton, parts and proportions as the rig.

| File (`src/game/content/characters/styles/`) | What |
|---|---|
| `comic.ts` | `STYLE.renderPose`: 1× → `comic-1x`; 2×/4× → capture the rig canvas, swap in the comic head, ink it, draw the folds, crop to the rig's frame (same size, anchor, points). |
| `comic-capture.ts` | `captureHd`: runs `renderHuman` once with two short-lived hooks on `HdCanvas.prototype` (`render` keeps the last canvas = the body and still returns the rig's own pixels, so every rig cache stays exact; `image` lets the caller swap the head buffer). Restored in a `finally`. A fresh HumanStyle copy per call makes the rig's HD memo miss, so there is always a canvas to capture. |
| `comic-ink.ts` | `inkRender`: the comic renderer (below). Also `edt` (exact Euclidean distance transform). |
| `comic-head.ts` | `comicHead(style, expr, d, glint)`: the rig's head G-buffer (asked for with a no-op `hatDy` so `renderHeadHd` repaints instead of returning its cache) painted as a comic face; cached per style/expr/density/glint. d 2, 4 and 8 (Helium Head at 4×). |
| `comic-folds.ts` | Inker's cloth folds from `poseJoints`: tapered strokes inside a bent elbow (sleeve), behind a bent knee (trousers), trousers bunching over the near boot; clipped to the limb's own part. |
| `comic-1x.ts` | The 1× frame: the top lit-edge tone of each cloth/skin ramp folds into the tone below (flat colour; metal/brass/snow keep glints) and the contour grows 1 px into the figure on its lower-right edge. PAL only. |

Main tricks in `inkRender`:

- **Two flat tones per material** from the normals and the key light (hard terminator), plus a
  *form band*: each part turns to shadow along its own lower-right edge (40 % of a thin limb, at
  most 2.2 logical px of a broad panel), so every form gets a clean comic crescent. Far limbs (the
  far arm and leg, `pz ≤ −7.5`) sit in shadow as a whole — depth reads at a glance.
- **Cast shadows** from nearer parts (march towards the light); right under the occluder the
  shadow is a **spot black** (under the chin, the arm, the jacket hem).
- **Halftone**: a 45° (quincunx) dot lattice, cell 6 art px at 4× / 4 at 2×, dots centred on art-px
  corners (2×2 → rounded 4×4 in the deep shadow), tied to the pelvis so the grid lines up across
  the belt (torso anchor = legs' hip point). Never on the face (only the neck's shadow under the
  jaw gets dots).
- **Weighted ink**: the silhouette is a signed distance (two EDTs) with a per-px weight from the
  outward normal of a blurred mask (lit side thin, shadow side heavy, partly eating into the fill,
  never past the rig's `d` px of frame room). Every overlapping part draws the same weighted line
  onto the part behind it (1 px lit, 2.6 px shadow at 4×). Material seams inside a part (boot sole,
  belt) get 1 px. Fixed-colour gear (gun, hands, plan roll) is re-toned by its ramp (vote per
  part) and its deepest tones become ink (slide seams, finger creases).
- **Tweed**: a sparse herringbone of 2-px ticks in the shadow tone on the lit jacket (4× only).
- **White glints**: near-white specular on the boots, the gun's top tone, eye catchlights.
- Helium Head: the outer ink within reach of the big head becomes the status pink (`HELIUM_RIM`).
- Every 2×/4× px is PAL_HD, every 1× px PAL, all opaque.

## Proportions

Unchanged: the rig's slim build, head, boots and gear. The style is in the rendering, not the
silhouette.

## Simplified / not styled

- 1×: only flat colour + the heavier lower-right contour (no halftone, hatching or folds at 40 px).
- Kept by the contract (index.ts / human-sprites.ts): `die-burn`, `die-blast`, `die-drown`, the
  Swan rider strips, `die-flat` and `portrait` stay the rig's art.
- The open battle-plan sheet in `bored` / `fidget-a` is added by `VINCENT_ART.decorate` after
  `renderPose`, so that one prop keeps the rig look (the rolled plan in the hand is inked).
- Fold strokes need a bend: straight limbs get none.

## Build time (node, one thread)

- 20 main strips (legs idle/run/jump/fall/land/crouch, pistol torso idle/shoot/run/up/down/diag/
  crouch/knife, flip, die, victory, bored), 104 frames: **4×: 4.3 ms/frame, 0.45 s** (game: 2.0
  ms/frame, 0.21 s); **2×: 1.1 ms/frame** (game 0.4).
- All 119 ids / 465 frames at 4× via `npm run sprites`: ~6.1 s vs ~5.0 s for `char/vincent/`.
- The overhead is the rig's own HD render (kept for exact caches) + a repeated 1× geometry
  render (fresh style copy) + the ink passes (EDTs, band and interior-line scans).

## Checks

- `npx tsc -p tsconfig.json --noEmit`: zero errors in comic files (the only 2 errors are in
  `gritty-paint.ts`, another style).
- Palette: 1395 frames (119 ids × 1/2/4×) → 0 px outside PAL / PAL_HD, no translucent px
  (`tmp/styles/work-comic/palcheck.ts`).
- Sprite registry: 0 errors, 0 warnings for `char/vincent-comic/*` at 1/2/4× (points and sizes
  equal the 1× frames).
- `python3 tmp/styles/capture.py comic --street` → `tmp/styles/out/comic/`, `comic-street.png`.

## Where to look

- `tmp/styles/work-comic/final-arena-4k.png` — game (top) vs comic (bottom), arena at 4K scale.
- `tmp/styles/work-comic/final-street-cmp.png` — the Amsterdam street, game vs comic.
- `tmp/styles/work-comic/final-poses-4x.png` (and `-4x-game`, `-2x`, `-1x`) — 16 poses incl. aims,
  crouch, heavy gun, knife bonk, flip, victory, bored, die, Helium Head.
- `tmp/styles/work-comic/final-strips.png` — victory, die, flip, knife, helium-bored at 4×.
- `tmp/styles/work-comic/heads-comic-{2,4,8}.png` — the comic face per expression.
- `tmp/styles/work-comic/sheets/char@4x*.png`, `char@2x*.png`, `char*.png` — every strip with marks.
- Tools: `preview.ts` (pose sheet: `npx tsx tmp/styles/work-comic/preview.ts comic 4`),
  `heads2.ts`, `strip.ts`, `track.py`, `bench.ts`, `palcheck.ts`, `errs.ts`.

## Open issues

- The hooks on `HdCanvas.prototype` (`render`, `image`) are runtime-only and restored at once,
  but they are a trick, not an API. They depend on `drawBodyHd` rendering the body canvas LAST
  and on the head being the only `image()` of head size.
- Each comic frame makes the rig's HD memo (64 FIFO) and head cache (192 FIFO) hold entries that
  are never hit again: a small speed cost for other characters built in the same worker, no
  change of pixels.
- `comic-head.ts` tones (skin, stubble, hair) are tuned for VINCENT's fair skin and brown hair; the
  zone logic reads the rig's stubble flecks. Other heroes need their own tone rows.
- The halftone grid hangs on the pelvis, so dots on swinging limbs crawl a little in the run cycle
  (like a printed screen); the jacket's heavy-line + tweed + dots can look busy at 2× on small
  screens (tweed is already off at 2×).
- The lit-side line is 3 px at 4× (6 screen px at 4K): readable on the street, but thinner than
  the game's outline A, so the hair can sit close to brown props (bollards).

## Shared-file requests

None needed. Optional, if this style is picked: replace the prototype hooks with a real seam.
Exact diff (a canvas painter passed through the HD path):

```diff
--- a/src/game/art/hd/body.ts
+++ b/src/game/art/hd/body.ts
@@ export interface BodyRig {
+  /** Paint the finished G-buffer instead of the rig's render (an art-direction trial). */
+  paint?: (c: HdCanvas) => PixelBuffer;
@@ export function drawBodyHd(r: BodyRig): PixelBuffer {
-  const out = p.c.render({ outline: 'A', ao: 0.3, rimLight: 2 });
+  const out = r.paint ? r.paint(p.c) : p.c.render({ outline: 'A', ao: 0.3, rimLight: 2 });
--- a/src/game/art/humanoid.ts
+++ b/src/game/art/humanoid.ts
@@ function renderHd(
-  frame: { x: number; y: number; w: number; h: number },
+  frame: { x: number; y: number; w: number; h: number },
+  paint?: (c: HdCanvas) => PixelBuffer,
 ): PixelBuffer {
@@
-  return drawBodyHd({ d, w: region[2], h: region[3], st, sk, pose, part, rot, T, frame });
+  return drawBodyHd({ d, w: region[2], h: region[3], st, sk, pose, part, rot, T, frame, paint });
```

(`renderHuman` would take `paint` as a 5th argument and skip its HD memo when it is set; the
head swap would want a matching `head?: (buf: PixelBuffer) => PixelBuffer` on `BodyRig`, used in
`drawHead` before `p.c.image(...)`.)
