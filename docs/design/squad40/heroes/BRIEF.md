# Squad at 40 px: shared brief for one hero

You build ONE hero of a five-friend squad as pixel-art sprites for an original run-and-gun game,
at the same look and fidelity as the approved hero VINCENT. Work only in this folder:

    SPIKE = docs/design/squad40 (the spike ran in a session scratchpad)

## What VINCENT is (the approved bar)

- A ~40 px tall hero on a 384x216 logical grid (1x pixels). Stats today: height 42, idle upper sprite
  28x27, standing legs 20x22, 23 hero colours.
- Two sprites per frame, joined at the pelvis: UPPER (torso, head, arms, hand items) and LOWER (legs and
  shoes). The death is one FULL sprite. A hero may also have a BACK sprite per upper frame (a cape),
  drawn behind both.
- Hand-drawn rigid parts (heads, torsos, shoes, hands, guns, items, effects) in `parts.py`, as
  character grids. Limbs are not drawn: they are two-bone IK tubes, rasterised with 3D cylinder shading
  (`rig.Canvas.tube`, `pose.leg`, `pose.arm`), with crease marks at bent joints.
- One selout pass (a far part's edge next to a nearer part takes its dark tone, see `rig.DARK`), one
  1 px exterior outline 'K', a lone-pixel clean-up of the tubes.
- Light from the upper front. The hero faces right. Posture: straight back, square shoulders, the head
  centred above the torso with a little neck (the user disliked an earlier hunched look a lot).
- Look at VINCENT's contact sheets before you start: `out/g_*.png` (already rendered; do NOT re-render
  VINCENT, other agents work in this folder at the same time). The reference sheet the look is based
  on is `../../images/2.png` (private analysis only; never name its game, studio or artist anywhere).

Read these files first: `rig.py`, `pose.py`, `parts.py`, `anims.py`, `build.py`, `hero.py`, `sheet.py`,
`prev.py`. `parts.py` and `anims.py` are VINCENT; use them as your template.

## How a hero plugs in

Create `heroes/<name>.py` (more files `heroes/<name>_*.py` are fine). `hero.py` imports it when the
environment has `HERO=<name>`. On import, your module changes the shared tables IN PLACE for this
process only:

- Palette: `rig.apply_hero(pal, hero_letters, dark)`. Recolour hero letters and/or add new letters.
  Keep the ramp roles so selout works: `AHh->Q` hair, `LSs->z` skin, `bB->B` beard, `Jjq->Q` jacket and
  arm sleeves, `Tt->t` shirt, `Rr->r` accent, `Ppo->O` trousers and legs, `Xx->v` shoes, `Ggn->N` gun.
  Free letters for new colours: `C E U V Y Z a k l` and digits. Never recolour the effect letters
  `F f c e W I i m D d M u y` (flashes, smoke, grenade, slash arcs) or 'K'. Every new hero letter needs
  a `dark` entry. Budget: about 24 hero colours (VINCENT has 23); 26 is the hard cap.
- Parts: replace entries of `parts.HEADS`, `parts.TORSOS` (rebuild lean/lean2/back with
  `parts.shear`), `parts.SHOES`, `parts.GUNS`, `parts.FISTS`, `parts.HANDS`, `parts.ITEMS`, `parts.FX`.
  Keep the anchor names (neck, pelvis, shN, shF, wrist, muzzle, tip, ankle, c). Keep the grenade items
  `gren0..3` (the page uses them).
- Poses: replace entries of `anims.UPPER`, `anims.LOWER`, `anims.FULL` (reuse the helpers `up`, `gun`,
  `hand`, `legs`, `shoot_set` ... or write your own). Set `anims.MELEE_TITLE` if the melee weapon is
  not a knife. Add flash names to `anims.SHOT_FX` if you make new first-flash effects.
- Body: `pose.THIGH`, `pose.SHIN`, `pose.UPPER`, `pose.FORE` (limb lengths), `pose.PEL_DY` (moves the
  body down by n px: a shorter hero), `pose.RAMP` (limb colour ramps; `arm2`/`armF2`/`leg2`/`legF2`
  give the forearm or shin its own ramp, for short sleeves or shorts), `pose.CUT`.
- Hooks in `pose.HOOKS`: `pat` (a cloth pattern that sticks to the limb tubes, e.g. camouflage),
  `back` (the BACK layer, e.g. a cape; it gets the torso/head/pelvis anchors of the pose), `post`
  (any extra drawing before the outline pass). See the comments in `pose.py` and `rig.Canvas.tube`.
- If you need something the hooks do not give, monkeypatch inside your own module (it only affects
  your process). Do NOT edit the shared files (`rig.py pose.py parts.py parts2.py anims.py build.py
  hero.py sheet.py prev.py page*.* script.js`). Do not touch other heroes' files or VINCENT's `out/`
  files. Write only `heroes/<name>*.py` and `out/<name>/`.

## The animation set (all 12 groups, same keys as VINCENT)

LOWER: `stand run jump jumprun crouchdown crouch crawl`. UPPER: `idle fidget run jump shoot aimup
shootup aimdown shootdown crouchidle crouchshoot grenade slash stab`. FULL: `death`.
The page pairs run upper k with run lower k (keep 12 + 12), jump upper k with jump/jumprun lower k
(keep 6), crouchidle 4. Shoot, shoot up, shoot down and crouch shoot stay 10 frames. Fidget and the
two melee animations (`slash`, `stab`) may have any length. The demo spawns a bullet for each effect
in `anims.SHOT_FX` that sits on `('armN'|'armF', 'muzzle', dx, dy)`, and releases the grenade at the
far wrist on grenade frame 3 (keep the throw on the far arm, frame 3).

The legs, run cycle, jump and crawl from VINCENT are good; reuse them unless the body differs. Each
hero needs his own head set (expressions `fwd blink shout hurt up down` plus the fidget ones; head
about 14 x 13, neck anchor at the bottom), his own torso(s), shoes, colours, and his own fidget.

## Likeness and privacy (binding)

- The hero's real photo is for likeness only. View it with the Read tool. Never copy, trace, sample,
  crop, resize or save the photo or any part of it, never put it in a file, page or report. Draw the
  face by hand as a caricature from what you see (hair shape, brows, eyes, nose, mouth, beard, skin
  tone). Read the photo as often as you like.
- Never name any commercial game, studio, artist, celebrity, brand or comedy character in files,
  code, comments or your report. No brand logos (a cap patch is a plain shape).
- Do not touch the git repo, `.env.local`, any API
  key or any network service. No git commands.

## Your loop

1. `cd $SPIKE && HERO=<name> python3 sheet.py` writes `out/<name>/g_<group>.png` (one sheet per
   group; `python3 sheet.py run 8` = only Run at scale 8). `HERO=<name> python3 prev.py <upper> <lower>`
   pairs one upper and one lower animation. View the PNGs with the Read tool. Compare with VINCENT's
   `out/g_*.png` side by side.
2. Iterate until each group reads well at 1x and at zoom: a clear silhouette, the face reads as the
   person, no stray pixels, no hunched back, hands hold things believably, weapons read.
3. `HERO=<name> python3 build.py` must run clean and write `out/<name>/sprites.json`.
4. Report (short, plain English): what you drew and why, the colour count, frame counts per group,
   anything you had to monkeypatch, and the weak spots you know about. Put the same report in
   `out/<name>/REPORT.md`.
