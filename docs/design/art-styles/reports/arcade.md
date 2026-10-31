# Style `arcade` — ARCADE 90S (VINCENT, `?char=vincent-arcade`)

## The idea

VINCENT as a confident, hand-pixeled 90s cabinet sprite rebuilt for 4K: chunky heroic
proportions, a thick dark outline coloured by the part it wraps, and three hard, hue-shifted cel
bands per material (cool purple / teal shadows, warm tan / yellow lights) with crisp glints. The
face is a bold caricature that reads at a glance: a strong raised brow, heavy-lidded smug eyes, a
big nose, the lopsided smirk and the stubble as one clean grey-violet band.

## How it is built (own drawer)

Own drawer, not a post-process. Files (all mine, `src/game/content/characters/styles/`):

| File | What |
|---|---|
| `arcade.ts` | `STYLE.renderPose`: the frame contract, a small memo, 1×/2×/4× frames |
| `arcade-rig.ts` | a copy of the rig's `solve` / `weaponRig` / IK with the arcade dims, bigger boots and guns, the sturdy stance, the up-aim gun flip, the thumbs-up nudge |
| `arcade-body.ts` | the painter: legs, boots, torso + tie + belt, arms, hands, guns, held items on ONE `HdCanvas`; own outline, tweed weave, glints |
| `arcade-head.ts` | VINCENT's head drawn natively on the body canvas (no rig head image) |
| `arcade-pal.ts` | the cel ramps (5 PAL_HD tones each: deep, shade, mid, light, glint) and the outline colour per material |

Main tricks:

- **Cel bands from the HD light model.** Every material is a custom 5-tone ramp of PAL_HD colours
  with `lo 1 / hi 3`, `wrap 0`: the canvas's lighting quantises to exactly three hard bands, tone
  0 is used for separations and crevices, tone 4 for speculars. The hue shift lives in the ramps
  (tweed: maroon-purple shade → brown mid → tan / caramel light; olive: canal-teal shade → olive →
  yellow-olive; skin: dusky rose deep → salmon → peach → cream; boots: purple-black → steel-blue
  sheen). Far limbs drop the light band (2 bands), so they read one step darker.
- **Coloured thick outline.** The canvas renders with `outline: 'none'`; the painter then draws
  its own 1-logical-px outline (4 art px at 4×) and colours each outline px by the NEAREST part's
  material: dark brown round the tweed, deep olive round the trousers, deep red-brown round the
  skin, dark hair-brown round the hair, ink only round the boots, belt, gun and soles. Interior
  separations are 2 art px (at 4×) in the deep tone of the part behind. The Helium Head's outline
  turns pink (as the rig).
- **Glints.** Painted fixed-colour glints (kept by the clean-up, only on their own part): the boot
  toe and heel, laces, the belt buckle, two on the pistol slide, three on the heavy gun, the
  knife, the grenade, and two warm dashes on the top hair locks; plus the steel specular band.
- **Tweed weave** as a post-pass on the rendered tweed px: a herringbone of short broken threads
  one band darker (4×), a sparse fleck (2× / 1×), anchored to the pelvis so it moves with him.
- **Face.** Head space = the rig's head layout (origin at the neck pixel), scaled 1.15 (2.3 for
  the Helium Head) and turned with the tilt + `rot`, so the head is lit consistently at any tilt.
  The skull is one soft volume; the stubble is a material switch on the same surface (no line
  inside the face); the ear is its own part with a crescent fold; the hair is a mass plus eight
  sculpted lock blobs (each lit as its own chunk); the eyes, brows, lids, nostril and mouth are
  crisp fixed-colour shapes in head space. Every expression is drawn: normal (raised brow +
  heavy lid + smirk), blink, happy, smile, shout, panic, hurt, dazed (ring eye), yawn, chew, soot.
- **Frame contract.** Each (pose, part) is painted once at 4× on a region round the skeleton;
  its opaque box in whole logical px IS the frame rectangle at every density. 4× = that drawing
  cropped; 2× and 1× are painted natively at their density on the same region and trimmed to
  the room inside the outline of the same box (the 1× colours snapped to the nearest PAL colour).
  Anchor = the feet (full / lower) or the pelvis pixel (upper, pelvis drawn at the pixel centre);
  `hip`, `muzzle`, `hand`, `head` = the pixels that hold the painter's continuous points. Turned
  grounded figures (deaths) are re-grounded like the rig (lowest px on the ground line + `dy`).
  Checked over all 119 strips / 465 frames: 1× all PAL, 2× / 4× all PAL_HD, no translucent px,
  every dense frame has its 1× frame's size, anchor and points (`tmp/styles/work-arcade/check.ts`);
  `npm run sprites -- char/vincent-arcade/ --density 4 | 2 | 1` reports no fallback or warning.

## Proportions (what changed)

- Head about 15 % bigger (×1.15 on the rig's head layout; the Helium Head ×2.3), a strong chin, a
  bigger nose.
- Heroic torso: broad chest (`chestB 4`, `chestF 4.4`), a V to the waist, round deltoid caps.
- Chunkier limbs (`thighW 5.2/4.4`, `shinW 4.3/3.9`, `armW 4.4/4`, `foreW 4/3.6`), same lengths as
  the rig (`slim`), so the figure's height and the hip / muzzle heights stay close to today's.
- Big boots (about 7.6 × 5.3 px against the rig's 7 × 5) with a thick sole and a toe cap.
- Big natively drawn hands (fist about 4.6 px against 4): fist / grip with knuckle grooves and a
  wrapped thumb, open (four fingers), point, thumbs-up (the thumb always points up).
- Bigger guns: pistol ×1.3, the heavy gun ×1.15 (the heavy's fore-grip span grows with it).
- A sturdy stance: standing poses plant the feet a little wider (near hip +6°, far hip −5°), so
  the two legs read with a gap.
- Up aims (pistol and heavy) hold the gun upright with the slide / receiver to the FRONT of the
  grip and the near arm behind the big head, so the face stays visible behind the gun (the
  muzzle point moves with it: pistol up muzzle at about (+4, −40) vs the rig's (+5, −37)).
- A thumbs-up in front of the face is nudged forward of the nose (victory), so the face reads.
- A gesturing hand (thumb / open / point) of a raised arm is drawn in front of the head (salute,
  thumbs-up); fists and held props of a raised arm go behind it, as the rig does.
- A gun carried low in the far hand (knife, throw strips) is drawn behind the body.

## Simplified or kept strips

- Kept the rig by design of the switch: `die-burn`, `die-blast`, `die-drown`, `die-flat`, the Swan
  rider strips `ride-*` and the portrait.
- Rare props other than the plan, knife and grenade (umbrella, pan, snack, gift …) would use the
  rig's HD prop art as an image; VINCENT never holds them.
- The upright heavy gun (aim up) leaves off its drum (that side faces the face).
- 1×: the hair locks are left off (the mass alone reads cleaner) and feature lines are at least
  one px wide. The 1× look is serviceable, not designed for (ams is drawn at 2× / 4×).
- No coat tails / scarf / cape / other accessories: only VINCENT's own (`tie`, `tweed`).

## Build time (node, one thread, warm)

- 4× paint: about 2.5 ms per frame (3.3 ms cold), against the rig's 0.8–1.6 ms.
- 2× paint: about 0.7 ms per frame; 1× paint about 0.2 ms (+ the 4× paint for the geometry,
  memoised: a strip's 1× request paints the 4× once, the 4× request then hits the memo).
- `npm run sprites -- char/vincent-arcade/ --density 4`: 119 strips, 465 frames in about 6.7–9.3 s
  (rig VINCENT: 5.7 s); `--density 1` alone 7.6 s (rig 3.5 s), because each 1× frame needs the 4×
  drawing for its geometry.
- Memo: up to 48 4× buffers per process (a few MB).

## How to see it

- `python3 tmp/styles/capture.py arcade --street` → `tmp/styles/out/arcade/`, `tmp/styles/out/arcade-street.png`
  (note: that still lands at t = 151, on a bored / fidget frame without the gun).
- Same moment as the reference `vincent-street.png` (t = 41, gun out):
  `tmp/styles/work-arcade/street-t40.png`; side by side rig | arcade: `tmp/styles/work-arcade/street-ab.png`.
- Overview (idle, run, heavy, up, six faces, street): `tmp/styles/work-arcade/overview.png`.
- All strips with marks: `tmp/styles/work-arcade/sheets/char@4x*.png`.
- Preview tools (mine): `npx tsx tmp/styles/work-arcade/preview.ts arcade main|full|faces`,
  `big.ts idle|run|heavy|up [scale]` (`D=2` for 2×), `face.ts expr,expr [scale]`, `bench2.ts`, `check.ts`.

## Open issues

- The legs of the standing / running figure are fine at game size, but at big zoom the near and
  far trouser legs can merge into one olive mass in some frames (the separation line is thin
  there).
- The tweed weave is visible at 4K; at 2× it is a sparse dark fleck, at 1× almost gone.
- The 4× paint is about 2× the rig's cost per frame (still small: one hero ≈ 1 s single-threaded).
- The 1× art is a clean but plain reduction of the design (eye = 2 px, brow = 1 px line).
- Only VINCENT is drawn (head shapes, hair, stubble are his); other heroes need their own head
  data and ramps before the style could carry the squad.
- The Swan rider strips stay the rig look, so riding the Swan switches style (by the switch's design).

## Shared-file requests

None.
