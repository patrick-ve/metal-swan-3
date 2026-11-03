# Extension wave: shared brief (VINCENT first, then the other four heroes)

The squad (VINCENT, THOM, DIRK, BOB, PATRICK) has 12 core animation groups at 40 px on a 384x216
grid (1x pixels). The user approved that look. This wave adds every animation family the game still
needs, so that no animation is missing. Work only in:

    SPIKE = docs/design/squad40 (the spike ran in a session scratchpad)

Read first: `heroes/BRIEF.md` (the hero rules: palette roles, parts, hooks, likeness, privacy; all of
it still binds), then `ext.py` (how a family plugs in, the step format, the head fallbacks),
`anims.py`, `pose.py`, `parts.py`, `rig.py`, `build.py`, `comp.py`, `sheet.py`. Look at VINCENT's
approved sheets `out/g_*.png` first (do not regenerate the core sheets without a filter).

## The families and who owns them

| Module | Families | Categories on the page |
|---|---|---|
| `ext_heavy.py` | heavy-weapon torso set with the 45-degree sweep; pistol diagonals; crouch throw and crouch melee (pistol and heavy) | Pistol extras, Heavy weapon |
| `ext_moves.py` | legs fall, land, crouch-up, dangle; deaths burn, blast, drown, flat; victory, respawn, bored, second fidget, time-out yawn and sleep, mount, Swan hop, somersault; the intro parachute | Moves, Deaths, Full body |
| `ext_ride.py` | the nine Swan rider poses with a Swan to sit on; Helium Head (balloon heads + the helium sets) | Swan ride, Status |
| `ext_status.py` | pick-up flash, invulnerable blink (done, page-side palettes) | Status |

Each owner writes only `ext_<module>.py` (more files `ext_<module>_*.py` are fine) and its own
sheets. Keys are fixed (the game maps them 1:1 to its strips), see the module task. A module adds
poses with `ext.add(table, key, value)` (a hero's own entry with the same key wins).

## Rules for the extension modules

- Your module is imported in EVERY hero's process, after the hero module. So build poses from the
  hero's current tables where it makes sense (for example `h_slash` from the hero's own
  `A.UPPER['slash']`, swapping the near hand to the heavy gun), so the other heroes inherit their own
  melee item, torso and look. Do not hard-code VINCENT-only part names where a generic route exists.
- Parts: add with `ext.add(P.GUNS, ...)` etc. New shared stage sprites (not part of the hero: the
  parachute canopy, the Swan, water, snore letters) go in `P.STAGE[name] = [(rows, {'c': (x, y),
  ...}), ...]` (one entry per frame; `c` is the placement anchor; extra named points are exported).
  Stage sprites are drawn with VINCENT's palette on the page; give them their own outline 'K' in the
  rows (copy the 6-line `outlined()` of `build.py`, which uses `rig.Canvas.finish`; do not import
  `build` from your module, that import is circular).
- Palette letters: the hero letters keep their roles (see `heroes/BRIEF.md`). New SHARED non-hero
  letters are digits: `ext_moves` owns `0 1 2 3 4`, `ext_ride` owns `5 6 7 8 9`. Add them with
  `rig.PAL[d] = '#rrggbb'` and, if they ever touch a hero part, a `rig.DARK[d]` entry. `ext_heavy`
  uses only the gun ramp `G g n N`, the outline `K` and the effect letters. Never recolour existing
  letters. Never add hero letters.
- New head expressions: use only the names in `ext.HEAD_FALLBACK` (happy, panic, yawn, sleep, soot,
  bored) or add a name with `ext.HEAD_FALLBACK.setdefault(name, core_head)` in your module. Draw
  VINCENT's version with `ext.add(P.HEADS, name, ...)` in the style of `parts.HEADS` (about 14 x 13,
  'neck' anchor). The other heroes draw their own in the next wave; until then the fallback shows.
- Hit, shots, grenades: the page counts a melee hit on the first frame with an effect of any upper key
  that ends in `slash` or `stab`. It spawns a bullet for each effect named in `A.SHOT_FX` that sits on
  `('armN'|'armF', 'muzzle', dx, dy)`; add your first-flash names to `A.SHOT_FX` and their bullet
  direction in degrees to `A.SHOT_DIR` (0 forward, -45 diagonal up, -90 up, 45 diagonal down, 90
  down). A grenade throw releases at the far wrist on frame 3 of any key that ends in `grenade`.
- Room: a step must fit 116 px above the ground and 66 px left and right of the hero's centre (that
  is the padded canvas in `comp.py`). One pose canvas is 80 x 76 with the ground point at (36, 70):
  keep each FULL or LOWER pose inside it (heights and arcs go in the step's `oy`, not in the pose).
- Style: the approved look. Hand-drawn rigid parts, IK limbs, selout, one outline, no stray pixels,
  light from the upper front, the hero faces right, a straight back. Rotated full-body frames use the
  `rot` key (rotsprite), then check the pixels at zoom. No gore, no blood: deaths are comic.
- Originality: never name any commercial game, studio, artist, celebrity, brand or comedy character
  in files, code, comments or reports. The reference sheet `../ref-ms/in/sheet.png` and its slices
  `../ref-ms/inv/L0..L7.png, R0..R7.png` are private reference for poses, frame counts and timing
  only; never copy or trace them.
- The game is read-only reference: `src/game/art/poses.ts`
  and `human-sprites.ts` (the strip semantics and timings of the current game rig),
  `src/game/player/player.ts` (when each strip plays), `docs/design/` (look docs). Never write to
  the repo, never run git, never open `.env.local`, never touch any API key or network service.
- Other agents work in this folder at the same time. Write only your own files. Do not run
  `build.py` without `--dry` (it writes the shared `out/sprites.json`). Do not edit the shared files
  (`rig.py pose.py parts.py parts2.py anims.py build.py hero.py ext.py comp.py sheet.py ...`). If you
  need a change there, monkeypatch inside your module only when it cannot change any existing frame,
  and say so in the report.

## Loop

    cd $SPIKE
    EXT_ONLY=heavy python3 sheet.py --cat Heavy 5      # your groups as contact sheets -> out/g_*.png
    EXT_ONLY=heavy python3 sheet.py "heavy run" 8      # one group at a bigger scale
    EXT_ONLY=heavy python3 build.py --dry               # composes every frame, checks the steps
    HERO=bob EXT_ONLY=heavy python3 sheet.py --cat Heavy 5   # how another hero inherits it

View the PNGs with the Read tool. Iterate until each group reads well at 1x and at zoom. At the end,
also run every hero once (`HERO=<name> python3 build.py --dry` for vincent thom dirk bob patrick,
without EXT_ONLY) so you know nothing crashes.

Report (short, plain English) in your final message: the keys and frame counts, the groups, the new
parts and letters, what other heroes inherit automatically and what each hero must still adapt
(this list drives the next wave), any monkeypatch, and the known weak spots.
