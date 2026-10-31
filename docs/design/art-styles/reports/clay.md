# Style `clay` — CLAY TOY (report)

## The idea

VINCENT as a plasticine stop-motion puppet: every part is a soft, rounded volume of matte clay with a
broad satin sheen. You can see the hand-made marks: thumb-pressed surfaces, tool-scored hair, a smirk
carved in, stubble pricked in with a needle. Saturated toy colours, dark crevices and a soft contact
shade where the parts meet, and a thin dark outline.

Material decision (the brief asked to pick one): **matte clay** with a satin sheen and tool marks.
I did not use glossy vinyl. The only glossy parts are the red tie (a glossy ribbon), the boots, the
gun and the eye.

## Look

- Arena clip: `tmp/styles/out/clay/f000.png` … `f167.png`. The 4K street: `tmp/styles/out/clay-street.png`.
- Side by side with the game's VINCENT, at 4× (rows 1 and 3: the game; rows 2 and 4: clay):
  `tmp/styles/work-clay/showcase.png`.
- Expressions on the Helium Head: `tmp/styles/work-clay/look-faces.png` (4×, 2×, 1×).
- Outline A/B on the street: `tmp/styles/work-clay/street-A.png`, `street-B.png`.
- All strips: `npm run sprites -- char/vincent-clay/ --density 4 --marks --out tmp/styles/work-clay/s4`.

## How it is built: its own drawer (no post-process)

Files (all new, all mine):

- `src/game/content/characters/styles/clay.ts`: the `STYLE` and the frame pipeline (`renderClay`).
- `clay.rig.ts`: a copy of the rig's skeleton solve (`solve`, `weaponRig`, `offhandRig`, IK,
  `placedGun`). It is unchanged, so the joints, `hip` and `muzzle` are exactly the game's.
- `clay.paint.ts`: the painter (`ClayPainter` on an `HdCanvas`): materials, legs, boots, torso,
  arms, mitten hands, the clay guns and the held items.
- `clay.head.ts`: the sculpted head, built from height fields.

Main tricks:

- **One drawer for all densities.** The same code draws the 1× frame (`HdCanvas` at d 1 with `PAL`
  ramps) and the 2× / 4× frames (`PAL_HD` ramps). The 1× render sets the frame geometry: its trimmed
  rectangle, the anchor and the points (cached per style and pose). The 2× / 4× frames are drawn
  into that rectangle with the rig's `fitFrame` rule (a copy). A small FIFO memo (64) keeps recent
  HD renders, as the rig does.
- **Clay volumes.** Limbs are capsule chains that swell in the middle of each bone ("puffy" clay
  sausages). The torso is a pear-shaped capsule with a flat hem. The boots are heel and toe balls
  on a darker sole welt. The hands are mittens: a ball fist with a thumb nub, a paddle (open), a
  sausage finger (point), and a thumb that always points up the screen (thumbs-up).
- **Head = height fields in the head's own frame.** The ball cranium and the egg jaw are melted
  together with a smooth max, plus the brow ridge, cheek and chin bumps. Tool grooves are real
  relief: they cut into the height, so each groove gets a lit lip and a dark trough. This gives
  the smirk, the lid line, the ear cup, the nostril and the hair strokes. The head turns
  (tilt / rot) and scales (Helium Head) as one sculpture.
- **Light.** Each material uses a wide wrap, a low contrast and a broad satin specular (shine 5–6).
  The tie, boots, gun and eye get a tighter gloss. I use ramp slices (for example
  `PAL_HD.hairB.slice(0, 5)`) so that the sheen tops out at a warm mid tone, not near-white.
- **Contact shade.** A wide, soft occlusion pass (`contactShade`) runs on the G-buffer before the
  canvas render: 1.4 logical px, 1 / distance falloff, toward nearer parts only. On top of it come
  the canvas's own AO, a short key-light cast shadow (`shadow: 0.16`) and 1-art-px crevices (the
  separations).
- **Hand-made marks (4× only; at 2× and 1× they would read as noise).**
  - Thumb-mark normal wobble on the limbs, torso and boots, stable in each part's own coordinates
    (no "boil" between frames).
  - Faint diagonal tool marks on the tweed (the herringbone, sculpted) and one thumbprint whorl on
    the back panel.
  - Stubble as a jittered grid of needle pricks that fades out above a wobbly cheek line.
  - Hair as a smooth pressed cap with a lumpy rim, a few long swept strokes and a front tuft.
- **Fixed details stay on their own part.** The pupil, catchlight and dizzy spiral only paint over
  px of the eye part, so a gun or hand in front of the face never gets a pupil painted on it.
- **Outline B** (ink, ½ logical px) at 2× / 4×; 1 px at 1×. I compared it with A on the street
  (`street-A.png` / `street-B.png`). A is bolder, but it turns the puppet back into a game sprite.
  B still separates him from the busy street.
- Colours: the tweed is `PAL_HD.wood` (a saturated warm brown), the tie a darker gloss red (red
  0–6), the trousers olive 2–5, the boots one-hue black, the skin skinA 2–6 and the stubble brown
  3–5 with pricks.

## Proportions

- The skeleton is unchanged (the game's slim VINCENT), so the hip, muzzle, gun grips and aim
  heights are identical.
- The volumes on that skeleton are stubbier and rounder:
  - limbs are about 0.5 px thicker, and swell at mid-bone;
  - the head is about 15 % bigger (cranium about 12.3 × 11.9 px plus the hair cap, against the
    rig's 12 × 11);
  - the nose is a ball and the ear a cup;
  - the mittens and the round bean boots are bigger.
- The frame rectangles grow a little (about 1–2 px at the head and boots). They come from the clay
  1× render, so the frame contract holds. The hitbox does not change (it is gameplay).
- Point check against the game's VINCENT at 1× (`tmp/styles/work-clay/ptcheck.ts`, 1274 points):
  - `muzzle`: identical in every frame.
  - `hip`: identical, except in 3 `die` frames. There the lying figure rests its own lowest px on
    the ground, so the anchor shifts by 1 px (the rig's own rule).
  - `hand` and `head` differ by about 1 px on prop tips and tilted heads. Game logic uses neither
    point for the player (only art decorations and the snore letters).

## Strips simplified

- **Every rig strip goes through the clay drawer**, including all expressions (normal, blink,
  happy, smile, shout, panic, hurt, yawn, dazed/soot, chew), all aims, both guns, the Helium twins,
  the knife bonk with the rolled plan, throw, victory, bored, fidgets, salute, mount, spawn, flip
  and time-outs.
- **Kept by the switch (not mine):** `die-burn`, `die-blast` and `die-drown`, `die-flat`,
  `portrait`, the Swan `ride-*` strips and `select`. These still show the game's pixel VINCENT.
- **Simplified:**
  - The rifle (never a hero gun) is a plain clay bar.
  - Props other than the plan (knife, snack, gift, the other knife-look props) are simple clay
    shapes; VINCENT never uses them.
  - The open battle-plan sheet in `bored` / `fidget-a` is the game's HD piece, drawn by
    VINCENT's `decorate` on top of the clay hands.

## Build time (node, one thread)

- **Main strips** (57 strips without Helium, rides and the rig deaths; 266 frames at 4×):
  about 1.6 s, or **≈ 6.0 ms per 4× frame**. The rig takes 0.42 s (1.6 ms per frame), so clay is
  about 3.8× the rig's cost.
- **1×** (the same 266 frames): 0.13 s.
- **Everything** (all 119 `vincent-clay` ids at 1×, 2× and 4×; 1395 frames, rig deaths included):
  5.6 s.
- **Where the time goes:**
  - head height fields: about 1/3;
  - limb capsules with the thumb-mark texture: about 1/4;
  - the canvas render: about 1/4;
  - the contact shade: < 10 %.
- Possible speed-ups (not done): cache the head's G-buffer per expression, tilt and sub-px offset,
  and replace `vnoise` with a lookup table.

## Checks

- `npx tsc -p tsconfig.json --noEmit`: zero errors in `clay*.ts`. Errors remain in the arcade and
  painted files (another agent's work in progress).
- Palette (`tmp/styles/work-clay/palcheck.ts`): every px of all 1395 frames is `PAL` at 1× and
  `PAL_HD` at 2× / 4×. No `spriteErrors` for `vincent-clay`; the frame contract holds (no engine
  throws).

## Open issues

- **Victory thumbs-up.** The forearm crosses the face, as in the rig. I keep the thumb mitten in
  front of the head so the gesture reads, but it covers the nose and mouth for those two frames.
- **The low-carried gun** (throw / knife strips) draws in front of the jacket, the same as the rig.
- **The 1× art.** It is the same drawer at d 1: readable, but cruder than the hand-pixelled 1×
  heads. Its jacket is `PAL.brown` (darker than the HD caramel `wood`).
- **The hair** reads as a sculpted cap with strokes at play size. On the Helium Head (2× size), the
  strokes are big and graphic.
- **`CLAY_OPTS.dither`** (in `clay.paint.ts`) is a switch for smoother gradients. I tried 0.15 and
  0.3 at 4K: they read as grain, so it stays 0.
- **Build cost** is about 4× the rig's. That is fine for a trial; for all heroes the speed-ups
  above would be needed.

## Shared-file requests

None.
