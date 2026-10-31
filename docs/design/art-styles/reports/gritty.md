# Style `gritty` — GRITTY (report)

## The idea

VINCENT as a grounded, serious soldier in a late-90s realistic-shooter mood: a tall, lean man in
real proportions, muted dusty colours, one hard key light from the upper left with deep shadows
and a cool rim light on the edges turned away from it. Same man (dark crop, heavy dark stubble,
one raised brow, the smirk, brown tweed, dull red tie, olive fatigues, black boots), no longer a
cartoon: seams, pockets, patches, scuffs, dirt and a sweat-dark collar carry the grit.

Play it: `?char=vincent-gritty`. Captures: `tmp/styles/out/gritty/`, `tmp/styles/out/gritty-street.png`.
Work sheets: `tmp/styles/work-gritty/summary-4x.png` (native 4K scale), `s4/`, `s4m/` (marks),
`s2/`, `s1/`, `heads.png` (every expression).

## How it is built — our own drawer (no rig pictures)

Files (all `src/game/content/characters/styles/`):
- `gritty.ts` — `renderPose`: the frame contract. The 1× frame is drawn first and fixes the
  rectangle, anchor and points (cached per part + pose); 2× / 4× draw the same figure natively on
  that rectangle (+2 px margin), trimmed inside the outline width, never moved. A small FIFO memo of
  HD frames (strips repeat poses).
- `gritty-rig.ts` — a copy of the rig's `solve` / `weaponRig` with GRITTY's bones. The rig's pose
  tables are used as they are: angles unchanged, lengths in rig px scaled (IK targets ×1.21,
  hunch ×1.56, bob ×1.3, dx / dy ×1.2, head offsets ×0.7). IK targets ABOVE the shoulder are
  compressed (the rig's head is huge), so a salute, a hand on the tie or a yawn lands on the small
  head. The leg spread of near-straight legs is ×0.8 (long legs would straddle). Weapon holds are
  our own: the pistol in two hands (support hand cupped under the grip), the heavy gun low at the
  hip with the far hand on the fore-grip and the shoulders leaning back 3° under its weight.
- `gritty-paint.ts` — every part is a lit volume on one `HdCanvas` (src/game/art/hd/canvas.ts:
  depth, separations, AO, cast shadows): legs, boots, jacket, shirt, tie, belt, sleeves, hands,
  guns, held items. Materials are hard: no wrap, a NEGATIVE ambient and a steep gain
  (`HARD`), so the planes turned from the key fall straight into the deepest tones. Then two
  passes of our own on the G-buffer:
  - rim: a silhouette px with open space to its right / upper right / above gets a cool tone
    (steel / snow from PAL_HD) by how much its picture-plane normal faces the rim direction
    (right, a little up), 1–2 art px at 4×, full on the head and shoulders and fading down the legs;
  - outline: thin; on the lit (upper-left) side the material's deepest tone, 1 art px at 4×; on the
    shadow side ink, 2 art px, where it sinks into the shade. Helium Head: pink round the head.
- `gritty-head.ts` — the head, turned three-quarters (both brows, the lopsided mouth read): height
  fields in head-local coordinates (so tilt and the 2× Helium Head are exact), flat-ish relief with
  the hard light painted on as tone (deep eye sockets, the nose's shadow on the lip, the fold to the
  mouth corner, the dark underside of the jaw). Features are unlit fixed px, painted only over the
  head's own px (an arm or gun in front keeps its px). Ten expressions map to eye / brow / mouth
  states (normal = squint + raised near brow + smirk; shout, panic, hurt, happy, smile, yawn,
  dazed, chew, blink, soot).
- `gritty-gun.ts` — our own guns drawn on the same canvas (they take the light, rim and outline):
  a compact service pistol (slide serrations, ejection port, sights, stippled grip) and a light
  machine gun for every special weapon (stock, receiver, feed cover, carry handle, olive ammo box,
  perforated shroud, flash hider, fore-grip). Grip hands close round the grip (finger creases,
  the thumb along the frame) and turn with the gun.
- `gritty-pal.ts` — the muted ramps (PAL_HD only) and hand-picked PAL ramps for 1× (a nearest
  snap turned the dusty greys into blue steel).

Detail per the brief: tweed herringbone with flecks (4×), folds from the armpit and across the
back, worn light front edge and hem, leather elbow patches, a breast-pocket welt, a hip pocket,
one horn button; the shirt's sweat-dark, grimy collar; the dull brick-red tie; a belt with a dull
buckle in the jacket's cutaway; fatigues with an outseam, a bellows cargo pocket, knee creases,
dirt patches and dust at the hems, bloused over the boots; field boots with flex creases, scuffed
toes, laces, a stitched welt and tread lugs; the heavy dark stubble as a grey-brown jaw with dark
speckles.

Checks: typecheck clean; no sprite warnings at 1× / 2× / 4×; every frame of every gritty strip
is PAL-only at 1× and PAL_HD-only at 2× / 4×, no translucent px
(`tmp/styles/work-gritty/palcheck.ts`).

## Proportions

- Standing figure about 45 px tall (today about 37). Legs 21 px to the hip (rig 15), torso 14
  (rig 9), arms 7.6 + 7.0 (rig 6 + 6), lean limbs (leg radius 2.35 → 1.45, arm 1.55 → 1.1).
- Head about 7.5 px chin to crown with the hair (today about 13): about 6 heads tall, not 7. A
  6.5 px head did not carry the raised brow and the smirk at 4K, so I stopped at 6.
- The hitbox is unchanged (14 × 30): the head and shoulders stand above it (art-only trial).

## Simplified / not mine

- No strip is skipped; the rare ones use the same drawer.
- 1×: no rim, a few deliberate face px (eyes, the raised brow, the mouth), stubble only on the jaw
  edge. It reads, but GRITTY is a 2× / 4× style.
- Kept from the rig by the switch (index.ts): die-burn, die-blast, die-drown, the Swan rider
  strips; die-flat and the portrait are copies of today's VINCENT. These show the small cartoon
  VINCENT for a moment (see the optional diff below).

## Build time (4×, cold, includes each frame's 1× pass)

- Main strips (legs idle / run / jump / crouch, torso pistol idle / run / shoot / up / crouch,
  heavy idle / run, flip, die: 86 frames): about 265 ms, 3.1 ms per frame (today's rig 160 ms,
  1.9 ms per frame).
- Every strip (465 frames, `npm run sprites -- char/vincent-gritty/ --density 4`): about 5.7 s
  with the tool's load (today's VINCENT about 5.2 s).

## Open issues

- Taller than the hitbox and than the 37 px cast: he looks like he comes from another game next
  to the cartoon enemies (by design for the trial; a real adoption would take the cast along or
  shrink `DIMS` in gritty-rig.ts to about 40 px).
- "Rim on the back edge": I read it as the silhouette edge turned away from the key (right / upper
  right of the right-facing sprite, light from behind). Like all baked light it mirrors when he
  faces left.
- The face is about 30 px at 4K: the expressions read up close; at play distance the raised brow
  is subtle, the stubble and the smirk carry him.
- Olive drab reads dark green; the lit planes go to a dusty grey. A greyer olive would need a new
  PAL_HD tone (none between olive and stone at that lightness).
- The two-handed pistol hides the support hand behind the gun hand (true to life, but invisible).

## Shared-file requests

None needed. Optional, to draw the burn, blast and drown deaths with a style's renderer too (the
body under the flames / soot / water would be GRITTY's), exact diff against the current
`src/game/art/human-sprites.ts` (not applied; also in `tmp/styles/work-gritty/deaths.diff`):

```diff
--- a/src/game/art/human-sprites.ts
+++ b/src/game/art/human-sprites.ts
@@ -23,6 +23,9 @@
 import type { ArmPose, Density, HumanStyle, Pose, RenderPart, WeaponPose } from './humanoid';
 import * as P from './poses';
 
+/** A pose renderer with renderHuman's frame contract (PlayerArtOpts.renderPose). */
+type RenderFn = (style: HumanStyle, pose: Pose, part: RenderPart, d: Density) => HumanFrame;
+
 export type FrameList = Frame[];
 
 /** Render a list of poses for one part (`density` 2 / 4: the UHD frames). */
@@ -46,12 +49,12 @@
  * the HD figure under the same flames and crumbling, drawn natively (`withFlamesDense`,
  * `crumbleDense`; the effect placed from the 1× frames, so the geometry is the 1× one).
  */
-export function burnFrames(style: HumanStyle, base: Pose = {}, seed = 9, density: Density = 1): FrameList {
+export function burnFrames(style: HumanStyle, base: Pose = {}, seed = 9, density: Density = 1, render: RenderFn = renderHuman): FrameList {
   const out: FrameList = [];
   const statuePose: Pose = { ...base, ...P.STAND, armN: { sh: 30, el: 60, hand: 'open' }, armF: { sh: -20, el: 50, hand: 'open' }, expr: 'soot' };
   if (density === 1) {
-    P.BURN.forEach((p, i) => out.push(withFlames(scorch(renderHuman(style, { ...base, ...p }, 'full'), 1), i * 2 + 1, seed)));
-    const statue = sootify(renderHuman(style, statuePose, 'full'), 1, true, seed);
+    P.BURN.forEach((p, i) => out.push(withFlames(scorch(render(style, { ...base, ...p }, 'full', 1), 1), i * 2 + 1, seed)));
+    const statue = sootify(render(style, statuePose, 'full', 1), 1, true, seed);
     out.push(withFlames(statue, 5, seed + 3, 3));
     out.push(statue);
     out.push(crumble(statue, 0.35, seed));
@@ -63,10 +66,10 @@
   const d = density;
   P.BURN.forEach((p, i) => {
     const pose = { ...base, ...p };
-    out.push(withFlamesDense(scorch(renderHuman(style, pose, 'full'), 1), scorch(renderHuman(style, pose, 'full', d), 1), i * 2 + 1, seed));
+    out.push(withFlamesDense(scorch(render(style, pose, 'full', 1), 1), scorch(render(style, pose, 'full', d), 1), i * 2 + 1, seed));
   });
-  const s1 = sootify(renderHuman(style, statuePose, 'full'), 1, true, seed);
-  const sd = sootify(renderHuman(style, statuePose, 'full', d), 1, true, seed);
+  const s1 = sootify(render(style, statuePose, 'full', 1), 1, true, seed);
+  const sd = sootify(render(style, statuePose, 'full', d), 1, true, seed);
   out.push(withFlamesDense(s1, sd, 5, seed + 3, 3));
   out.push(sd);
   for (const t of [0.35, 0.7, 1]) out.push(crumbleDense(s1, sd, t, seed));
@@ -74,8 +77,8 @@
 }
 
 /** Explosion death: a scorched (two shades darker), tumbling launch (DIE_BLAST). */
-export function blastFrames(style: HumanStyle, base: Pose = {}, density: Density = 1, poses: readonly Pose[] = P.DIE_BLAST): FrameList {
-  return poses.map((p) => scorch(renderHuman(style, { ...base, ...p }, 'full', density), 2));
+export function blastFrames(style: HumanStyle, base: Pose = {}, density: Density = 1, poses: readonly Pose[] = P.DIE_BLAST, render: RenderFn = renderHuman): FrameList {
+  return poses.map((p) => scorch(render(style, { ...base, ...p }, 'full', density), 2));
 }
 
 function def(id: string, gen: () => FrameList, opts: SpriteOpts): void {
@@ -237,8 +240,8 @@
     def(t + 'knife-b', torsoOf(P.seq(carry, o.knifeB ?? knifeBPoses(o.knife ?? P.KNIFE))), { durations: o.durations?.['knife-b'] ?? P.KNIFE6_TIMING, loop: false });
   }
   def(pre + 'die', deco('die', o.die ?? diePoses(style), 'full'), timing('die', { durations: o.die ? [6, 6, 6, 6, 8, 40] : P.DIE12_TIMING }, false));
-  def(pre + 'die-burn', (d) => burnFrames(style, {}, 9, d), { durations: [5, 5, 8, 12, 8, 8, 40], loop: false });
-  def(pre + 'die-blast', (d) => blastFrames(style, {}, d, blastPoses(style)), { durations: P.DIE_BLAST10_TIMING, loop: false });
+  def(pre + 'die-burn', (d) => burnFrames(style, {}, 9, d, render ?? renderHuman), { durations: [5, 5, 8, 12, 8, 8, 40], loop: false });
+  def(pre + 'die-blast', (d) => blastFrames(style, {}, d, blastPoses(style), render ?? renderHuman), { durations: P.DIE_BLAST10_TIMING, loop: false });
   def(pre + 'spawn', full(spawnPoses(style)), { durations: P.SPAWN6_TIMING, loop: false });
   // Idle fidgets (row 14): the hero's own tables, else the defaults; rare, so deferred.
   const fidgetA = o.fidgetA ?? tween(style, P.FIDGET_A_KEYS, { perKey: P.FIDGET_A_PER, ease: 'inOut' });
@@ -252,7 +255,7 @@
   def(pre + 'flip', full(flipPoses(style)), { ticksPerFrame: 2, loop: false });
   def(pre + 'mount-hop', full(P.MOUNT_HOP), { durations: MOUNT_HOP_TIMING, loop: false, defer: true });
   def(pre + 'legs-dangle', lower(danglePoses(style)), { ticksPerFrame: 6 });
-  def(pre + 'die-drown', (d) => drownFrames(style, d), { durations: P.DROWN_TIMING, loop: false, defer: true });
+  def(pre + 'die-drown', (d) => drownFrames(style, d, render ?? renderHuman), { durations: P.DROWN_TIMING, loop: false, defer: true });
   def(pre + 'salute', deco('salute', o.salute ?? P.SALUTE, 'full'), timing('salute', { durations: [8, 60] }, false));
   defineSprite(pre + 'portrait', () => portrait(style), { anchor: 'top-left', hi: () => portrait(style, 2) });
   defineRiderSprites(id, style);
@@ -386,9 +389,9 @@
  * (the water surface: nothing below it), a ripple on the surface, splash drops in frames 0–1,
  * bubbles at the end (frames 10–11 show no figure).
  */
-export function drownFrames(style: HumanStyle, d: Density = 1): FrameList {
+export function drownFrames(style: HumanStyle, d: Density = 1, render: RenderFn = renderHuman): FrameList {
   return P.DROWN.map((pose, i) => {
-    const fig = i < 10 ? renderHuman(style, pose, 'full', d) : null;
+    const fig = i < 10 ? render(style, pose, 'full', d) : null;
     const fw = fig ? fig.buf.w / d : 0;
     const left = Math.min(fig ? -fig.ox : 0, -10);
     const right = Math.max(fig ? fw - fig.ox : 0, 10);
```
