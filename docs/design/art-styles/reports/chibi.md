# Style `chibi` — CHIBI (VINCENT)

## The idea

VINCENT as a super-deformed little soldier: a big round head on a small soft body with stubby limbs, little round hands and big round boots, while his gun stays real size and looks huge. He stays THE CONSULTANT: short dark-brown hair in a few rounded locks, big glossy eyes, the one raised eyebrow, a small lopsided smirk, a soft stubble shadow, the brown tweed jacket with the thin red tie, olive trousers and black boots, in soft colours, three gentle bands and a thin warm outline.

Play it with `?char=vincent-chibi`. Captures: `tmp/styles/out/chibi/` and `tmp/styles/out/chibi-street.png`.

## How it is built (own drawer)

- **`chibi-rig.ts`, the skeleton.** A copy of the rig's solve (`solve`, `armChain`, `solveIK`, `weaponRig`) with chibi bone lengths. Every Pose field the contract uses works: legs, crouch / legScale, grounded, bob, lean, hunch, FK and IK arms, head offsets, aims, recoil, gunHand, rot, dx and dy.
  - The poses were keyed for the rig's 12 px arm, so IK targets scale to the chibi arm. Whole-figure offsets (dx, dy) scale to the short legs.
  - Gun grips are re-placed where the short arms can hold a real-size gun. The support hand rests on the gun as far along it as the arm reaches.
- **`chibi-head.ts`, the head.** It is drawn on its own HdCanvas:
  - A soft round skull, an ear and a small nose bump.
  - A smooth hair cap with seven rounded locks (two at the back, three on the crown, three fringe tufts swept forward) and a broken shine arc at 2× / 4×.
  - Big glossy eyes with a deep top, a warm glow at the bottom, two catchlights and a lash flick.
  - The raised near brow as a high arch over open forehead, with the far brow low and flat.
  - The smirk with its back corner pulled up and a dimple.
  - The stubble as a material switch on the skull, so there is no line around it. A density field covers the jaw, the chin and the upper lip, with a ragged edge and speckled hairs at HD.
  - Expressions: normal, blink, happy, smile, shout, yawn, dazed (swirl eyes), hurt / soot (squeezed > <), panic and chew.
  - At 1× the eyes, brows and mouth are placed by hand, px by px.
  - The head is cached per expression, density and scale, and snapped to the art grid, so the face is pixel-identical in every frame (no shimmer).
- **`chibi-body.ts`, the figure.** It uses lit volumes on an HdCanvas at every density: 1× with PAL paints, 2× / 4× with PAL_HD paints.
  - The parts: capsule limbs, a soft bell-shaped jacket (`blob`) with a tweed fleck, lapels, a shirt V, the tie and a pocket flap, white shirt cuffs, round mitten hands (fist, open, thumb, point and grip), and rotated-ellipsoid boots with a sole band.
  - Gear is the game's own art: `gunArt` / `gunHd`, the `plan` prop, the knife and the grenade.
  - **Warm outline.** This is a custom pass after the render. Each outline px takes the LINE tone of the part it wraps (a dark tone of that part's own colour). It is ½ logical px wide at 2× / 4× and 1 px at 1×. Separations inside the figure use the same line tones, also on the fixed-colour head and gun. The Helium Head's outline turns pink.
  - **Frame contract.** The 1× render fixes each frame: the trimmed px plus 1 px of room, the anchor and the points. The 2× / 4× frame is drawn on the same logical canvas, trimmed inside that rectangle less the outline width, then cropped to it. Lying poses are re-grounded like the rig's.
- **`chibi-paint.ts`, the paints.** Each part has three soft bands, a line tone and an optional sheen, for 1× and HD. The toon material has a high ambient, a wide wrap and a low gain.
- **Small acting rules (drawing only).**
  - The head looks up along a raised gun (tilt −20° for up, −9° for the up diagonal) and down along a lowered one.
  - A steeply raised gun is mirrored, so its grip faces the face and the gun reaches forward, away from the big head.
  - The short near arm stays in front of the head unless its hand would cover the eyes. In a tumble it goes behind the head when it lies over the face.
  - A thumbs-up is shown under the chin.
  - The head bob is ×1.5, so the run is bouncier.

## Proportions

| | rig VINCENT | chibi |
|---|---|---|
| height (feet to hair top, 1×) | 37 px | about 38 px (bored frame 40 including 1 px of room on each side) |
| head | about 12 px tall, 11 wide | 17 px tall, about 18.5 wide (about 1.4× taller, 1.65× wider) |
| heads tall | about 3 | about 2.3 |
| hip point (legs) | −16 | −11 (crouch −6, as before) |
| arm reach | 12 px | 6.4 px |
| torso, pelvis to neck | 9 | 8.4 |

The brief asks for both "about 2.5 heads" and "a head about 1.7–1.8× today's". Together these give a figure of about 55 px. I kept the height near the game's 37 px, because the hitbox stays. The head is 1.65× wider (the chibi read) and 1.4× taller.

## Simplified strips

- **salute.** The short arm cannot reach the brow under the big head, so the open hand comes up to the cheek. It reads more as a gasp than a salute.
- **The default fist pump (P.VICTORY).** The fist sits beside the head. VINCENT's own victory (the plan tap, then the thumbs-up) is fine.
- **die-burn, die-blast, die-drown, the ride-\* strips, die-flat and the portrait** keep the rig art, as the switch defines.
- **The open battle-plan sheet in bored / fidget-a** is VINCENT's rig decoration, placed at the chibi's `hand` point.

## Build time (rough, tsx, one process)

| | chibi | rig VINCENT |
|---|---|---|
| main 15 strips, 103 frames, 1× + 4× (legs idle / run / jump / crouch, pistol idle / run / shoot / up / crouch, heavy idle / run, flip, die, bored, victory) | about 370 ms | about 245 ms |
| all 119 strips at 4× (465 frames) | +1.36 s | +1.0 s |

Every strip is deferred, as before. My work script: `tmp/styles/work-chibi/bench.ts`.

## Checks

- `npx tsc -p tsconfig.json --noEmit`: no errors in the chibi files.
- `npm run sprites -- char/vincent-chibi/` at 1×, `--density 2` and `--density 4`: all 119 strips build with no contract error.
- Palette: all 1242 chibi-drawn frames at 1× / 2× / 4× pass. 1× uses PAL only, 2× / 4× use PAL_HD only, and every px is opaque. Script: `tmp/styles/work-chibi/palcheck.ts`.

## Open issues

- **Muzzle line.** The muzzle follows the drawn gun, as the brief asks. Bullets now leave lower: forward at −19 px above the feet instead of −23, straight up from −28 instead of −37. If the shot line must stay as it is, the fix is to raise the chibi hip or the grips (chibi-rig.ts `weaponRig`). That costs some of the stubby look.
- **The heavy gun aimed straight up** still covers the front of the face (the gun is 8 px wide). The pistol up-aim leaves the face clear.
- Raised arms (yawn, spawn, the die flail) can only reach cheek height, so hands come to the face. This reads as cartoon acting, but it is not the rig's motion.
- **1×** is clean and readable, but simpler than 4×: no stubble speckle, no hair shine, no tweed fleck.

## Shared-file requests

None.

## Files

- `src/game/content/characters/styles/chibi.ts`: the STYLE entry.
- `chibi-rig.ts`, `chibi-head.ts`, `chibi-body.ts`, `chibi-paint.ts`, in the same folder.
- Sheets in `tmp/styles/work-chibi/`:
  - `overview-4x.png` (main poses, the run cycle, full-body poses) and `overview-1x.png`.
  - `heads.png` (expressions at 4×).
  - `char@4x*.png`, `d2/char@2x*.png` and `d1/char*.png` (every strip).
  - `track.png` (in-game frames).
