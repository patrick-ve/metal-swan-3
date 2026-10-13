# Metal Swan 3 — Art Guide

Owner: art director. This guide explains the house style and the procedural art rigs in
`src/game/art/`. Read it before you draw anything. The media toolkit itself (PixelBuffer,
palette, sprite registry, renderers) is documented in `docs/api/media.md`; the IP rules are in
`docs/ORIGINALITY.md` (mandatory).

**Look at your work.** `npm run sprites -- <prefix> [--marks]` writes contact sheets to
`tmp/sprites/` (3× zoom; `--marks` shows anchors in cyan and points in magenta). Open the PNG
with the Read tool and judge it at 1× size too. `npm run sprites -- demo` shows the background
stacks (`demo/bg`), every background generator (`demo/bg-layers`) and every terrain style
(`demo/terrain`).

---

## 1. Style rules

| Rule | Detail |
|---|---|
| Palette only | Every pixel is a colour of `PAL` (64 colours). Tests check this (`tests/art/sprites.test.ts`). No alpha-blended pixels inside sprites; translucency is a renderer effect. |
| Outline | 1-px `INK` outline around the silhouette (4-connected). Internal lines between overlapping parts use the **darkest shade of the part behind** (a cast-shadow edge), not black. The `Composer` in `paint.ts` does both. |
| Light | From the **top-left**. Lit edges one shade lighter, bottom/right edges one shade darker, the ramp's darkest colour for creases and internal lines. Far limbs are one shade darker than near limbs. Flipped sprites keep the same pixels (the light then comes from the top-right — accepted). |
| Tones | 3–4 tones per material: base, highlight, shadow, deepest. Glints (one extra-light pixel) only on metal, boots and helmets. |
| Clean clusters | No single-pixel noise. Texture comes from 2×2 clusters, seams, rivets, strata. Dither only with the ordered Bayer pattern and only at band borders (skies, explosions, smoke). `despeckle()` removes stray pixels from shaded parts. |
| Readability | Big heads (10–12 px), big boots and gloves, exaggerated poses, faces never hidden by the near arm (the rig moves a face-crossing arm behind the head). |
| Bloodless | Deaths are cartoon: stagger and fall, scorch-black tumble, soot statue that crumbles to ash, dizzy stars. Never blood. |
| Originality | Our own designs only (see `docs/ORIGINALITY.md` §Art). No look-alikes of any existing game's characters, vehicles, crates or HUD. |

### Palette ramps per material

| Material | Ramp (`PAL.*`) | Notes |
|---|---|---|
| Skin | `skinA` fair, `skinB` tan, `skinC` deep | face template uses all 4 tones |
| Hair | `hairA` black, `hairB` brown, `hairC` blond | 3 tones |
| Field cloth | `olive`, `sand` (khaki), `stone` (grey), `slate` (blue-grey) | `slate` added by the art agent |
| Uniform accents | `red`, `navy`, `brass` (= gold), `cloth` (warm white) | `brass`, `cloth` added by the art agent |
| Leather, boots, belts | `brown`, `black` | `black` (added) is lighter than the outline, so black boots still read |
| Metal | `steel` (cool), `stone` (warm concrete), `rust` | 5-tone steel for guns and armour |
| Wood | `brown` | crates, planks, stocks |
| Fire, flashes | `fire` (deep red → white), `gold`, `orange` | explosions use `fire` only, then greys |
| Smoke, soot | `ink`, `stone`, `steel[0]` | |
| Foliage | `green` (dark tone leans teal) | |
| Water, ice, sky | `sky`, `navy`, `teal`, `snow` | |

### Sizes per entity class

| Class | Size | Anchor |
|---|---|---|
| Standing human | 35–37 px tall (feet to head top); hats add 1–6 px (helmet 38, bobble hat 40, plumed shako 42) | feet |
| Crouching human | ~27 px (legs + torso stacked) | feet |
| Head | 10–12 px tall, 12 px wide (3/4 view facing right) | — |
| Torso frames | about 22–30 px above the hip, 2–3 px below it | hip |
| Pickups | 16×14 plates, 12–18 px items | feet (rest on the ground) |
| Crate | 20×18 (+ outline) | feet |
| Bullets | 5–12 px tracers, 16-direction strips | centre |
| Explosions | visible size s ≈ 23, m ≈ 35, l ≈ 60, xl ≈ 88 px | centre |
| Portrait | 32×32 | top-left |

### Anchors and points (contract: `docs/ARCHITECTURE.md` §6.1)

- **feet** anchor: the frame stands ON line y (its lowest row, the outline under the soles, is
  y − 1). Ground contact is automatic in the rig (`grounded`, default true).
- **hip** anchor (torso frames): the pelvis pixel. Legs frames carry a `hip` point; the game
  draws the torso at `legs.hip`. The hip bobs during runs.
- **centre** anchor: projectiles and fx.
- Points: `hip`, `muzzle` (first pixel past the barrel tip), `hand` (near hand, or the item it
  holds — the grenade spawn point on throw frames, the gift on give frames), `head` (head
  centre — put stun stars at `head` − 8 px).

### Frame counts and default timing (ticks at 60 Hz)

| Animation | Frames | Timing |
|---|---|---|
| legs-run / enemy run | 8 (contact, down, passing, push-off ×2) | 4 per frame |
| walk | 8 | 6 |
| crouch-walk | 6 | 6 |
| idle (breathing) | 2 | 20–24 |
| shoot | 2 (recoil, rest) | 3–4, no loop |
| throw | 5 (wind-up, cock, release, follow-through, recover) | 5,4,3,5,6 |
| knife | 5 (raise, slash, follow-through ×2, recover) | 3,3,3,4,5 |
| die | 6 (hit, fall back, airborne, land, bounce, still) | last frame long |
| die-burn | 7 (2 on fire, smoking statue, statue, crumble ×2, ash) | |
| explosions | 7–12 | 3–4 |

Each sprite registers its own defaults (`ticksPerFrame`, `durations`, `loop`), so
`Animator.play(id)` plays it correctly.

---

## 2. Files

| File | What |
|---|---|
| `src/game/art/paint.ts` | ramps (`R`), hashes and seamless noise (`hash2`, `noise1`, `fbm1`, `noise2`, `noise2x`), `bayer`, `shadeLayer`, `despeckle`, `Composer` |
| `src/game/art/humanoid.ts` | the human rig: `HumanStyle`, `Pose`, `renderHuman`, `stackFrames` |
| `src/game/art/humanoid-head.ts` | head templates: skull/face, 11 hair styles, 12 headgear, 10 expressions, face extras |
| `src/game/art/humanoid-gear.ts` | guns (pistol, heavy, rifle), hands, held items (grenade, knife, snack, gift) |
| `src/game/art/poses.ts` | keyframed pose tables (run, walk, crouch, jump, throw, knife, deaths, panic, victory …) |
| `src/game/art/human-sprites.ts` | `definePlayerSprites`, `defineSoldierSprites`, `poseFrames`, `withSwing`, `burnFrames`, `blastFrames`, `portrait` |
| `src/game/art/human-fx.ts` | `withPieces`, `sootify`, `scorch`, `withFlames`, `crumble`, `speckle` |
| `src/game/art/machines.ts` | machines kit + `machine/demo-tank`, `machine/demo-heli` |
| `src/game/art/bg.ts` | 11 background generators |
| `src/game/art/terrain-art.ts` | the terrain painter |
| `src/game/art/demo-art.ts` | `demo/bg`, `demo/bg-layers`, `demo/terrain`; `renderBackground`, `paintTerrainArea`, `DEMO_BACKGROUNDS` |
| `src/game/content/characters/art.ts` | `char/recruit/*` (`RECRUIT_STYLE`) |
| `src/game/content/infantry/art.ts` | `enemy/rifleman/*` (`RIFLEMAN_STYLE`) |
| `src/game/content/items/*.art.ts` | hostage, crate, pickups |
| `src/game/content/weapons/art.ts` | projectiles, muzzle flashes, HUD icons |
| `src/game/content/fx/art.ts` | explosions and small fx; imports bg + terrain + demos |

---

## 3. The humanoid rig

A figure is **style + pose**. `renderHuman(style, pose, part)` solves a skeleton, draws each
body part as a shaded layer (far arm, far leg, near leg, coat tails, torso, belt, accessories,
head, gun, near arm, hand), stacks them with internal lines and outlines the silhouette.

```ts
import { renderHuman } from '../../art/humanoid';
const f = renderHuman(MY_STYLE, { weapon: 'heavy', aim: 'up', expr: 'shout' }, 'upper');
// f.buf, f.ox/f.oy (hip anchor for 'upper'), f.pts.muzzle / hand / head
```

`part`: `'full'` (feet anchor, everything), `'lower'` (feet anchor, legs + pelvis, `hip`
point), `'upper'` (hip anchor, torso + arms + head + gun).

### HumanStyle

| Field | Values |
|---|---|
| `skin`, `hair` | ramps (`'skinA'`, `'hairB'` …) |
| `hairStyle` | `short`, `buzz`, `spiky`, `mohawk`, `bald`, `long`, `ponytail`, `bob`, `parted`, `curly`, `puffs` |
| `headgear` | `none`, `helmet`, `cap`, `beret`, `bandana`, `goggles`, `hood`, `shako`, `bobble`, `rainhat`, `headset`, `fur-hat` |
| `gear`, `accent` | headgear colour; accent for plumes, bands, armbands, scarves, buttons, pompoms |
| `top`, `topType` | ramp + `vest` (shirt shows at the neck and as short sleeves), `jacket`, `tank`, `coat` (tails), `tunic` (brass buttons, high collar), `sweater`, `shirt` |
| `shirt` | colour under a vest (default sand) |
| `pants`, `boots`, `belt` | ramps |
| `gloves` | ramp, or `null` for bare hands |
| `build` | `slim`, `normal`, `heavy` |
| `accessories` | `pouches`, `armband`, `scarf`, `backpack`, `radio`, `ammo-belt`, `cross-belt`, `bowtie`, `satchel`, `epaulettes` |
| `face` | `moustache`, `beard`, `glasses`, `shades`, `freckles`, `stubble`, `blush` |

### Pose

Body space: origin at the feet centre, x forward (sprites face right), y down; degrees.

| Field | Meaning |
|---|---|
| `legN`, `legF` | near / far leg `{ hip, knee, foot? }`: hip = thigh angle from straight down (+ forward), knee = bend (+ shin swings back), foot = boot angle (+ toe up) |
| `armN`, `armF` | `{ sh, el, hand? }` (upper arm from straight down, + forward, 180 = up; elbow + turns the forearm up) or `{ to: [x, y], bend? }` = hand target relative to the shoulder (two-bone IK) |
| `hand` (in an arm) | `fist`, `grip`, `open`, `point`, `thumb` |
| `weapon` | `pistol`, `heavy`, `rifle`, `none` — places the gun and both hands |
| `aim` | `fwd`, `up`, `down`, `diag-up` (45° up: pistol and heavy gun, the up + forward aim), `diag-down` (45° down, heavy gun only: the machine-gun sweep); `recoil` (px), `lowGun` (rifle at the hip), `gunAngle`, `gunHand: 'far'` (gun carried low while the near arm throws or stabs) |
| `held` | `grenade`, `knife` (`heldAngle`), `snack`, `gift` |
| `expr` | `normal`, `shout`, `panic`, `hurt`, `happy`, `blink`, `yawn`, `chew`, `dazed`, `soot` |
| `lean`, `hunch` | torso tilt (+ forward); shorten the torso (breathing) |
| `head` | `{ dx, dy, tilt }` (tilt ≥ 8° rotates the head) |
| `headScale` | `2` = Helium Head (GDD §4.13): head and headgear drawn at 2× with Scale2x; the neck stays put |
| `crouch`, `legScale` | blend toward a deep crouch; foreshorten folded legs |
| `grounded`, `bob`, `dx`, `dy`, `rot` | feet on the ground (default) or airborne; pelvis drop; whole-figure offset; whole-figure rotation about the pelvis (falls) |
| `flutter` | scarf / coat-tail phase (set it in running frames) |

Rules the rig applies for you: feet rest on the ground line (or a kneeling knee); the gun
follows the hand that holds it; a near arm whose hand or forearm crosses the face is drawn
behind the head; far limbs are a shade darker. A grounded pose with `rot` (falls, lying
corpses) is re-grounded after the turn: its lowest pixel rests on the ground line, then `dy`
applies — so death frames lie ON the floor. Use `grounded: false` for frames that must float
(blown into the air).

Every rig frame carries the points `hand` (near wrist, or the held item) and `head` (head
centre); gun frames also carry `muzzle`. Points are relative to the anchor.

Pistol aim-up frames hold the pistol two-handed at the chin (the face stays visible). Both guns
have 45° up frames (`torso-<w>-diag-up`, `torso-<w>-shoot-diag-up`: the pistol two-handed in
front of the chest, tilted up, the barrel clear of the face) for the up + forward aim; only the
heavy gun has the 45° down frames (`torso-heavy-diag-down` …) for the machine-gun sweep. A
status effect may swap a strip for `<art>/<infix>-<anim>` (`StatusDef.art`; e.g.
`char/<id>/helium-legs-run`). The Helium Head strips are not drawn yet: render them with
`headScale: 2` and register them under that infix — the player falls back to the normal
strip for every id that is missing.

### Pose tables (`poses.ts`)

`STAND`, `RUN` (8), `WALK` (8), `CROUCH`, `CROUCH_WALK` (6), `JUMP` (2), `FALL`, `LAND`,
`BREATH` (2), `THROW` (5), `KNIFE` (5), `DIE` (6), `DIE_BLAST` (5), `DIE_KNIFE` (5), `BURN` (2),
`PANIC_COWER` (4, hands up, knees knocking), `PANIC_FLAIL` (4, arm-flail run for civilians),
`VICTORY` (4), `SPAWN` (4), `MOUNT` (2). Merge them over a base with `seq(base, frames)`;
`swapLegs(p)` mirrors a leg phase; `withSwing(poses, k, elbow)` adds arm swing to leg cycles.

### Adding a playable character (≈ 30 lines)

```ts
// src/game/content/characters/art.ts
import { definePlayerSprites, BORED_STRETCH } from '../../art/human-sprites';
import type { HumanStyle } from '../../art/humanoid';
import * as P from '../../art/poses';

export const SCOUT_STYLE: HumanStyle = {
  skin: 'skinC', hair: 'hairA', hairStyle: 'ponytail', headgear: 'goggles',
  gear: 'brown', accent: 'gold', top: 'teal', topType: 'jacket', pants: 'slate',
  boots: 'black', gloves: 'brown', build: 'slim', accessories: ['scarf', 'pouches'],
};

definePlayerSprites('scout', SCOUT_STYLE, {
  // Optional: own fidget and victory (full-body poses).
  bored: BORED_STRETCH,
  victory: P.seq(P.STAND, [
    { armN: { sh: 175, el: 10, hand: 'thumb' }, expr: 'happy' },
    { armN: { sh: 160, el: 40, hand: 'fist' }, expr: 'shout', bob: 1 },
  ]),
});
```

This registers the whole `char/scout/…` contract (legs, torsos for pistol and heavy, deaths,
victory, spawn, bored, mount, portrait).

### Adding an enemy soldier

```ts
// src/game/content/infantry/art.ts
defineSoldierSprites('sapper', { ...RIFLEMAN_STYLE, headgear: 'helmet', gear: 'steel', build: 'heavy',
  accessories: ['ammo-belt', 'backpack'] }, { gag: MY_GAG_POSES, panic: P.PANIC_FLAIL });
```

The default gag is `GAG_SNACK` (a sneaky sandwich); the default panic is `PANIC_COWER`.
For other weapons pass `weapon: 'heavy'`. Hostage-like civilians: see
`src/game/content/items/hostage.art.ts` (sitting pose, chair, ropes clipped to the
silhouette).

### Death helpers

`burnFrames(style)` (flames → soot statue → crumble → ash), `blastFrames(style)` (scorched
tumble), `scorch(frame, steps)`, `sootify(frame)`, `withFlames(frame, phase)`,
`crumble(frame, t)`, `withPieces(frame, pieces)` (add props: chairs, ropes, hats).

### Props and instruments (`withPieces`)

The rig draws only `held: 'grenade' | 'knife' | 'snack' | 'gift'`. Anything else a figure
holds or sits on — a tuba, a baton, a chair, a camera, a banner — is a **piece** stacked onto
a rig frame:

```ts
import { withPieces, type Piece } from '../../art/human-fx';
// 1. Pose the figure WITHOUT a gun; reach the near hand to where the prop is held.
const f = renderHuman(STYLE, { weapon: 'none', armN: { to: [9, -2], hand: 'grip' } }, 'full');
// 2. Draw the prop once (shaded, outlined on its own: withPieces does not outline).
const tuba = drawTuba(); // PixelBuffer, already buf.outline(INK)
// 3. Place it relative to the frame anchor; the rig's points are relative to it as well.
const [hx, hy] = f.pts!.hand;
const pieces: Piece[] = [{ buf: tuba, x: hx - 5, y: hy - 12 }];
const out = withPieces(f, pieces, { muzzle: [hx + 8, hy - 14] }); // the bell = where shots leave
```

- `behind: true` draws the piece behind the figure (chair backs, a cape, the far half of a
  drum); otherwise it is drawn in front (the near hand will be covered — draw the fingers on
  the piece, or re-draw the hand with a second piece).
- The frame grows to fit; the anchor and all points stay correct. Pass extra points (the
  `muzzle` of an instrument that fires, a `hand` for a throw) as the third argument.
- Build the prop buffer **once** per strip and reuse it in every frame; move it with the
  hand point so it follows the walk bob. Example in the code: `content/items/hostage.art.ts`
  (chair behind, ropes in front).

---

---

## 4. Weapons, projectiles, pickups

- Gun graphics: `gunArt('pistol' | 'heavy' | 'rifle')` with `grip`, `grip2`, `muzzle`. The
  heavy gun is ONE shared graphic for every special weapon.
- **Direction strips** (for `src/game/projectile.ts`, `look: 'angle'`): 16 frames, frame 0
  points right, clockwise. `weapon/bullet` (= `bullet-pistol`), `weapon/mg-bullet`
  (= `bullet-mg`), `weapon/vulcan-bullet`, `weapon/shell`, `weapon/rocket`.
- Round shots (any direction): `weapon/pellet`, `weapon/enemy-bullet` (alias `enemy/bullet`,
  2-frame pulse; high contrast: white core, hot ring, ink rim).
- Spinning strips (`look: 'anim'`): `weapon/grenade` (8), `weapon/enemy-grenade` (4, alias
  `enemy/grenade`).
- Muzzle flashes are anchored at their base: `fx/muzzle`, `fx/muzzle-heavy` point right,
  `fx/muzzle-up`, `fx/muzzle-heavy-up` point up, `fx/muzzle-diag`, `fx/muzzle-heavy-diag` point
  up-right at 45° (the game flips them for the other directions); also
  `weapon/muzzle-pistol`, `weapon/muzzle-heavy`.
- Pickups: `defineWeaponPickup(weaponId, letter, accent)` registers `item/pickup-<letter>` and
  `item/pickup-<weaponId>` (GDD §7.1: a round 17-px ivory band-uniform button, gold rim, navy
  letter, glint + bob). Letters: M machine-gun, R rocket-launcher, S shotgun, F flamethrower,
  L laser, H homing, T tuba, B bounce-mine (old ids `rocket`, `bouncer` still draw).
- HUD icons (top-left anchor): `ui/icon-<weaponId>`, `ui/icon-bomb`, `ui/icon-life`,
  `ui/icon-hostage`, `ui/icon-shell`.

## 5. FX

`explosionFrames({ radius, frames, seed, puffs, chunky })` — flash, billowing fireball of
seeded puffs (each lit from the top-left), cooling to smoke that frays with ordered dither.
`chunky: true` renders at half resolution and doubles the pixels (use for l / xl).
`cloudFrames(radius, frames, ramp, outline)` — smoke, soot and dust puffs.
All fx are centre-anchored. Debris: `fx/debris-<kind>` has 4 frames = the piece turned in
quarter steps (random frame = random orientation; playing them = tumbling).

## 6. Machines kit (`machines.ts`)

Parts return shaded buffers **without** outlines; stack them in one buffer (leave a 1-px
margin) and outline once: `buf.outline(INK)`.

| Part | Use |
|---|---|
| `wheel(r, phase, { tyre, rim, bolts, steps })` | road wheels; bolts turn with the phase |
| `tread(len, h, phase, { period, wheels })` | track loop; `period` phases = one seamless loop (3 by default) |
| `plate(w, h, ramp, { bevel, rivets, spacing })` | armour plates; rivets `corners`, `edges`, `grid` |
| `hull(w, h, points, ramp)` | polygon plates with bevel |
| `barrel(len, thick, ramp)` | gun barrels (ring + muzzle brake), pointing right |
| `rotor(len, phase)`, `tailRotor(r, phase)` | 4-phase rotor blur |
| `glass(w, h, { bars })` | cockpit glass with a reflection streak |
| `hazard(w, h, { stripe })` | warning stripes |
| `damage(buf, amount, seed)` | bullet holes, scorch smudges, dents on a finished machine |

`demoTank(phase, damaged)` and `demoHeli(phase)` show how the parts combine.

## 7. Backgrounds (`bg.ts`)

`defineBgGenerator(id, (w, h, params, seed) => PixelBuffer)`. Rules for every generator:
exactly w × h; horizontally seamless (only use functions with period w — `noise1`, `fbm1`,
`noise2x`, `sin(2πkx/w)` with integer k — and draw shapes that cross the edge again at
x − w with `setW`); deterministic per seed; palette colours. Prefer widths that are a
multiple of 4 (the Bayer dither repeats every 4 px). Tests check the seam.

| Generator | Main params (all optional) |
|---|---|
| `sky-gradient` | `colors` (top → bottom) or `ramp` + `reverse` or `top` + `bottom`; `bands`, `dither`, `y0`, `y1`, `stars`, `sun: {x, y, r}`, `moon` |
| `clouds` | `ramp`, `y`, `spread`, `count`, `size` |
| `mountains` | `ramp`, `y`, `height`, `layers` (1–3), `scale`, `snow` (true / snow line), `snowRamp` |
| `hills` | `ramp`, `y`, `height`, `scale`, `bushes` |
| `treeline` | `ramp`, `y`, `height`, `size`, `trunks` |
| `jungle` | `ramp`, `y`, `height`, `vines`, `fronds` |
| `city` | `ramp`, `y`, `height`, `windows`, `lit`, `night` |
| `ruins` | `ramp`, `y`, `height`, `rebar` |
| `dunes` | `ramp`, `y`, `height`, `waves` |
| `ice-peaks` | `ramp`, `y`, `height`, `scale` |
| `sea` | `ramp`, `y` (horizon), `sparkle`, `foam` |

`y` and `height` accept px or fractions of h (≤ 1). Ready-made stacks: `DEMO_BACKGROUNDS`
in `demo-art.ts` (grassland, desert, snow, city at night, jungle, ruins at dusk, sea); copy and
adapt. Far layers get small `factorX` (0–0.15), near layers larger (0.3–0.5).

Layer fields (`BgLayerDef` in `art-registry.ts`): `gen`, `params`, `width` (default 512),
`height` (default 216), `factorX`, `factorY`, `offsetX`, `offsetY`, `repeatX` (default true),
`repeatY` (default false), `alpha` (0–1, e.g. 0.7 for front clouds), `driftX` / `driftY` (px
per tick on top of the parallax: clouds that move while the camera is locked), `front` (draw
in front of the entities).

**Tall sections** (`scroll: 'up'` / `'down'`): a layer that should not repeat vertically must
be `216 + (sectionHeight − 216) × factorY` px tall, or the view runs off its bottom (the clear
colour shows). Either size it so, or make it vertically seamless and set `repeatY: true`.
Keep `factorY` small for far layers (0–0.2) like `factorX`.

## 8. Terrain painter (`terrain-art.ts`)

Registered with `setTerrainPainter`. A `TerrainStyleDef` picks materials:

| Kind | Materials |
|---|---|
| `ground` | `dirt`, `sand`, `rock`, `snow`, `ice`, `mud`, `metal`, `concrete` (darker deeper underground) |
| `edge` | `grass` (tufts + overhanging lips), `snow`, `sand`, `moss`, `rust` (streaks), `tiles` |
| `platform` | `wood`, `metal` (grating + brackets), `rock` (drips), `ice` (icicles) |
| `solid` | `metal` (panels, rivets), `concrete`, `crate` (16-px crates from the block corner), `rock`, `brick` |

How it stays seamless: the painter samples `cellAt` over the chunk plus a margin (96 px left
and right, 52 above, 8 below) and measures for every pixel how far the region continues up,
down, left and right. The distances are clamped below the margins, so a pixel's colour depends
only on its world position, the terrain and the style. Painting in any chunk size gives the
same pixels (tested). Cost: about (w + 192) × (h + 60) samples per chunk — paint at load
time, not per frame.

Adding a material: add an entry to `GROUND`, `EDGE`, `PLATFORM` or `SOLID`. A material is a
function of `Px` (world x, y and the run lengths `up`, `down`, `left`, `right`). Use world
coordinates for patterns (`hash2(p.x, p.y, seed)`, `noise2`), never chunk coordinates.

---

## 9. Checklist for art agents

1. Read `docs/ORIGINALITY.md`; invent your own shapes, names and emblems.
2. Use palette ramps only; add a ramp to `palette.ts` only from existing colours (dark → light).
3. 1-px INK silhouette outline; light from the top-left; 3–4 tones; no single-pixel noise.
4. Follow the sprite contract ids, frame counts, anchors and points (`ARCHITECTURE.md` §6.1);
   put a `muzzle` on every aim/shoot frame and a `hand` on throw/give frames.
5. Projectiles: direction strips (16 frames, frame 0 right, clockwise) or round shots.
6. Register timing defaults with `defineSprite` (`ticksPerFrame` / `durations`, `loop`).
7. Generators are deterministic: `hash2`, `noise*`, `seededRand` — never `Math.random`.
8. Run `npm run sprites -- <prefix> --marks` and look at the PNG at 1× and 3×; critique
   silhouette, readability against busy backgrounds, and motion between frames.
9. Add tests in `tests/art/` (frame counts, points, palette, seams for tiling art).
10. Keep generation fast (a whole character set builds in well under a second).
