# Player art-direction trial — common brief (all style agents)

## Goal

The user wants to EXPERIMENT with the art direction of the player characters: "propose 6
different styles of art direction for the player characters. Take one of players and create 6
variations of how to draw the player." We draw VINCENT (player 1's default hero) in six styles,
side by side. The user watches them, plays them, and maybe picks one (or mixes) for all heroes
later. Your job: ONE style, at a quality the user can judge as a real direction — a style with a
clear, confident identity, not a filter accident. It must look great at 4K (the 4× art).

Project: Metal Swan 3, an ORIGINAL run-and-gun (TypeScript + Vite, custom engine, Canvas 2D,
384×216 logical, all art procedural). Repo: /Users/everdingen/Projects/private/metal-swan-3,
branch main. VINCENT (src/game/content/characters/vincent.art.ts): "THE CONSULTANT" — short
dark-brown hair, heavy dark stubble, ONE RAISED EYEBROW and a lopsided smirk; slim; a brown
tweed jacket with a thin dark-red tie over his fatigues; olive trousers, black boots. He must
stay recognisably VINCENT in every style (hair, stubble, brow, smirk, tweed, tie, colours).

## Hard rules

- ORIGINALITY: never name any existing game, studio, franchise or artist in code, comments,
  docs, ids or reports. Describe styles in your own words. All art is ours, procedural.
- ART ONLY. No gameplay change: stats, hitbox, speeds and timings stay; only the pictures change.
- FILE OWNERSHIP: you may create and edit ONLY files in
  src/game/content/characters/styles/ whose names start with your style id
  (`<id>.ts` is yours already, a stub; add `<id>.*.ts` / `<id>-*.ts` as you like), and your own
  folders tmp/styles/work-<id>/. Do not edit kit.ts, index.ts, other styles, the rig
  (src/game/art/**), the engine, tools or tests. Five other agents work in the same tree at
  the same time. You MAY copy rig code into your own files and change the copy. If you truly
  need a shared change, do NOT make it: put the exact diff in your report.
- No git commits, no stash, no checkout/reset. Stay on main. Do not push. Never touch .env.local.
- Palette: 1× frames use PAL colours only; 2× / 4× frames use PAL_HD colours only (the project's
  style rule, docs/ART_GUIDE.md §1). Translucency only through the renderer, never in a sprite.

## The switch (already built — read it first)

- src/game/content/characters/styles/kit.ts (`ArtStyle`), index.ts (registers the hidden
  character `vincent-<id>` per style: every strip of the player contract through your
  `renderPose`, all deferred), and src/game/art/human-sprites.ts `PlayerArtOpts.renderPose`
  (read its doc comment: the frame contract).
- Your `renderPose(style, pose, part, d)` returns a `HumanFrame` (src/game/art/humanoid.ts):
  `part` 'full' (anchor at the feet), 'lower' (legs + pelvis, anchor at the feet, point `hip`),
  'upper' (torso, arms, head, gun; anchor at the pelvis, point `muzzle`, also `head`, `hand`,
  `harness` where the rig has them). `d` 1 = the 1× frame; `d` 2 / 4 = a frame with
  `density: d` whose LOGICAL size, anchor and points equal your d = 1 frame's for that pose
  (the engine throws otherwise). The game puts the torso's anchor on the legs' `hip` point and
  fires from `muzzle`, so keep those true to your drawing.
- Poses (src/game/art/poses.ts, humanoid.ts `Pose`): aims fwd / up / down / diag-up / diag-down,
  weapon 'pistol' / 'heavy', recoil, crouch, run cycle, jump / flip, knife (Vincent's battle-plan
  bonk via `held: 'plan'`), throw, die, victory, bored, fidgets, salute, `headScale: 2` (the
  Helium Head status), `expr` (normal, shout, blink, happy, yawn, dazed …). Your renderer must
  handle EVERY pose the contract uses without crashing; it may simplify rare ones.
- Two ways in (mix them freely):
  1. Post-process: call `renderHuman(style', pose', part, d)` (maybe with a changed HumanStyle
     copy or pose: build, headScale, colours), then repaint the buffer (outline, bands, hues,
     textures). Cheap and robust. Note: use your own HumanStyle OBJECT (a copy) if you change it —
     the rig caches by style object.
  2. Your own drawer: `poseJoints(style, pose)` (humanoid.ts) gives the solved skeleton; draw
     your own shapes on an `HdCanvas` (src/game/art/hd/canvas.ts; see hd/body.ts, hd/head.ts,
     hd/gear.ts, hd/shape.ts, light.ts, texture.ts) or on a PixelBuffer. More freedom (new
     proportions, new heads), more work. The gun art (`gunHd`, gear.ts) can be reused.
- Proportions may change (that is part of a style), as long as the frame contract holds.

## See your work (required, iterate until it is great)

- `python3 tmp/styles/capture.py <id> --street` → tmp/styles/out/<id>/fNNN.png (168 ticks of the
  arena at 4×: stand, run, jump + flip, shoot, aim up + shoot, crouch + shoot, run on; cropped
  around the player) and tmp/styles/out/<id>-street.png (Vincent on the Amsterdam street at 4K).
  `python3 tmp/styles/capture.py vincent --street` is the game today (already captured).
  One run takes ~35 s; do not run captures for other styles.
- All strips with anchors and points: `npm run sprites -- char/vincent-<id>/ --density 4 --marks
  --out tmp/styles/work-<id>` (and `--density 2`, and without --density for 1×).
- Look at frames with the Read tool; make contact sheets with PIL in tmp/styles/work-<id>/.
  Check the 4× look closely (face, hands, gun, tweed, tie), the motion (run, flip), the up and
  down aims, crouch, the knife bonk, die, victory, bored, Helium Head (`helium-` strips), and 1×.
- Typecheck: `npx tsc -p tsconfig.json --noEmit` — errors in OTHER styles' files are not yours;
  yours must be zero. Do NOT run the full vitest (machine load).

## Report (required)

Write tmp/styles/reports/<id>.md: the style's idea in two sentences, how you built it (post-process
or own drawer, the main tricks), what changed in proportions, any strips you simplified, the
build time of Vincent's main strips at 4× (rough), open issues, and any shared-file requests
(exact diffs). Then reply with a 5-line summary.
