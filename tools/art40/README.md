# tools/art40 — the 40 px character sets (production kit, bake)

Offline tools (Python 3 + Pillow) that draw the characters of mission ams at 40 px and bake them
into checked-in TypeScript (plan: `docs/design/ams40.md` "Pipeline"). CI needs no Python: the game
reads only the generated `src/game/content/art40/<slug>.gen.ts` files.

| Path | What |
|---|---|
| `kit/` | Production copies of the approved spikes (never import from `docs/`): the squad rig (`rig`, `pose`, `parts`, `anims`, `ext*`, `comp`, `hero`, `groups`, `heroes/`) and the cast kit (`castkit`, `limbs`, `samples/handhaver`). 1× only. |
| `art40.py` | The character module API (`Set`, `Frame`, `char()`, `humanoid()`, `full()`, `plant()`), validation, palette indexing, the pixel stream, the TypeScript writer, the joint sidecar. |
| `bake.py` | `npm run art40 -- <slug> \| --all [--check] [--sheet] [--out dir] [--list]` |
| `sheet.py` | Contact sheets: `tmp/art40/<slug>/sheet.png` (1× and 4×, the hold under each frame) and `<strip>.gif` (real timing). |
| `selftest.py` | Proof that `kit/` renders pixel-identical to the frozen spikes (`--heroes`: all five heroes). |
| `rules.json` | GENERATED copy of `check/rules.ts` + `check/classes.ts` (the ONE action class table, the budgets of plan D1 and the slugs allowed 40 / 64, the shared FX ramp). Write it with `npm run art40-check -- --write-rules`; a test pins it. |
| `joints/<slug>.json` | GENERATED joint track of a game set (every rig joint per frame): read by the smoothness gate, never shipped. |
| `chars/<slug>/` | One set per folder (a character, or one look of it). `_` slugs are test fixtures (baked to `tests/fixtures/art40/`). |
| `contract/`, `check/`, `review/` | Other tools (the strip contract, `npm run art40-check`, the review page). |

## Commands

```sh
npm run art40 -- handhaver            # bake one set -> src/game/content/art40/handhaver.gen.ts
npm run art40 -- handhaver --sheet    # + tmp/art40/handhaver/sheet.png and <strip>.gif: LOOK at them
npm run art40 -- --all --check        # exit 1 when any checked-in file differs from its set (gates)
python3 tools/art40/selftest.py       # the kit still matches the spikes (VINCENT 47 groups, handhaver)
```

Every set runs in a process of its own (`--all` runs four at a time): set modules patch the shared
rig tables in place, exactly as the spikes did. The output is byte-identical across runs and
`PYTHONHASHSEED` values; never use `random`, time or set iteration order in a set.

## The character module API

A set is a folder `chars/<slug>/` whose `__init__.py` defines `SET = art40.Set(...)` and
`build(s)`. Folders without a `build` function are shared helper code. The folder is a package:
its own files import each other relatively (`from . import parts`). `tools/art40` and
`tools/art40/kit` are on `sys.path`, so `import art40 as X`, `import castkit as K`,
`import rig, pose, parts, anims` work.

**The slug rule.** The slug is the last segment of the id prefix: `enemy/handhaver` →
`chars/handhaver/`, `boss/ams-mayor` → `chars/ams-mayor/`, `char/vincent` → `chars/vincent/`. A
numeric last segment joins the one before it: `npc/ams/ams-staff/0` → `chars/ams-staff-0/`.

**`X.Set(prefix, budget, face=1, outline='K', hl='', fx='', colours=None)`**

- `prefix` — strip `walk` becomes the sprite id `<prefix>/walk` (strip names: `a-z 0-9 - _ /`).
- `budget` — plan D1: `28` for figures, `40` for machines and multi-part sprites, `64` for the
  mayor. 40 and 64 only for the slugs in `rules.json` `budgetSlugs` (40: beer-bike, ams-scan,
  swan, ...; 64: ams-mayor; add a slug in `check/rules.ts` when a machine set lands). Counted over
  the distinct colours of the palette (and of every variant) without transparent and without the
  indices that only `fx` letters use (a body letter with an FX colour is counted).
- `face` — draw every frame facing RIGHT (the rig does). `1`: the game's unflipped sprite faces
  right; `-1`: it faces left (most enemies), the bake mirrors every frame and point (dx → −dx).
  Baked as `SET.face` / `strip.face`: the direction a walk cycle moves (the foot gate reads it).
- `outline` — the letter of the one warm near-black outline colour (`K` in the rig).
- `hl` — letters allowed as single pixels (eyes, glints); the check reads them.
- `fx` — letters of the shared FX ramp (flash, flame, splash, soot): in the palette, outside the
  budget, allowed as single pixels. Their colours (base and every variant) must be colours of
  `rules.json` `fxRamp` (10 fixed colours: white to deep orange, two blues, two warm greys).
- `colours` — letter → `'#rrggbb'`; default: the kit palette `rig.PAL` as it is after `build`
  (so `K.palette({...})` is all a set needs).

**`s.strip(name, frames, durations, loop=True, cls=None, why=None, defer=False, face=None)`**

- `frames` — `X.Frame(rows, root, pts=None, smear=False, joints=None)` or `(rows, root[, pts])`.
  `rows` = strings over palette letters, `'.'` empty. `root` = the anchor in rows (a standing
  figure: the ground point under its centre, the 'feet' anchor: the soles' last pixel row is
  `root_y - 1`). **Kit figures: use `X.humanoid` / `X.full`, which return `(RX, RY + 1)`**: the
  rig draws the soles' bottom outline ON row `RY`, so the rig's own `(RX, RY)` would sink every
  figure 1 px into the floor. `pts` = the named points the GAME reads, in rows coordinates (the
  bake makes them relative to the anchor and rounds half up). `joints` = every rig joint of the
  frame (not shipped: written to `joints/<slug>.json`; the smoothness gate measures every joint,
  like `tests/art/motion.ts`; without joints it measures `pts`, without either the outline box as
  a warning). `smear` marks a smear frame (at most 2 per strip). The bake crops each frame to its
  pixels; an empty frame becomes one transparent pixel.
- `durations` — ticks (60 Hz) per frame, or one int for all.
- `cls` — the plan's action class (required; `rules.json`, names or aliases). Fewer frames than
  the class count needs `why='the logged reason'` (e.g. a 1-frame hold the code keeps for 30
  ticks); class `other` always needs one.
- `defer` — a rare cosmetic strip (not in the boot preload).

**`s.variant(prefix, {letter: '#rrggbb'})`** — a palette variant (skins, P2): another id prefix
with the same pixels; the letters not named keep their colour. **Looks** (part swaps: fatbike
looks 1–3, stag 0 / 2, crew 0–2) are separate slugs that share code: `base = X.char('stag-partier')`
imports the other set's package; call its functions to draw with your own parts.

**`s.event('THROW_RELEASE', 3)`** — a named frame index or tick the game code reads
(UPPER_SNAKE). The generated file exports `export const THROW_RELEASE = 3;` and
`SET.events.THROW_RELEASE`; game code imports the constant, never a magic number (plan rule 4).

**Action classes** (ONE table for the bake, the check and the contract: `check/classes.ts`, copied
to `rules.json`): `idle-breathing` 4, `idle-fidget` 8 (max 18), `locomotion` 12 (foot gate),
`ride` 12 (pedalling, a flap cycle: no foot gate), `crouch-walk` 7 (foot gate), `shoot` 10,
`throw` 6, `melee` 6, `death-shot` 10 (max 12), `death-blast` 10, `death-burn` 7, `death-crush` 5,
`victory` 6 (max 8), `respawn` 6, `jump` 6 (max 7), `fall` 2, `land` 3, `mount` 5 (max 6), `hop`
5; no reference count (1): `mechanical`, `held`, `prop`, `telegraph`, `reaction` (max 18), `turn`,
`aim`, `overlay`, `piece`, `roles`, `ui`; `other` (always a `why`). Aliases: `idle`, `fidget`,
`loco`, `walk`, `run`, `die`, `die-blast`, `cheer`, `get-up`, `mech`, `pedal`, `flap`,
`mount-hop`, `idle-breath` and more (`rules.json` `aliases`). Use the contract's class of the id
(`docs/design/ams40/contract.json` `class`) unless you log why not.

**Walk cycles and the foot gate.** A `locomotion` / `crouch-walk` strip with a contract speed
needs the point `plant` (the planted foot's floor contact) on every frame with a foot down:
`X.plant(frames)` sets it from the leg joints of `X.humanoid` (the lowest ankle; with both feet
down the foot planted before stays planted). The gate walks the cycle the way the set faces and
asks for at most 1 px drift per plant at the contract speed. (`plantL` / `plantR` also work.)

## Worked example

```python
# tools/art40/chars/handhaver/__init__.py
import art40 as X
import castkit as K
from . import parts                     # this set's own drawn parts (HEAD, TORSO, TICKET, ...)

SET = X.Set(prefix='enemy/handhaver', budget=28, face=-1, hl='w')

PAL = {'J': '#4c64a4', 'j': '#33467c', 'q': '#222f56', 'Y': '#ffe040', 'V': '#e0b018', 'U': '#9a700e'}
DARK = {'Y': 'U', 'V': 'U', 'U': 'Q'}


def figure(upper, lower):
    """One frame: the upper pose on the lower pose, the point the game reads, every joint."""
    rows, root, j = X.humanoid(upper, lower)
    return X.Frame(rows, root, pts={'hand': j['armN.wrist']}, joints=j)


def build(s):
    K.palette(PAL, dark=DARK, letters='YVU')
    K.P.HEADS['fwd'] = (parts.HEAD, {'neck': (6, 14)})
    K.pose.RAMP['arm'] = ['J', 'j', 'q', 'Q']
    idle = [figure(K.A.up(torso='up', head='fwd', tor=(0, dy)), K.A.legs((0, -17), (-5, -4), (5, -4)))
            for dy in (0, 0, 1, 1)]
    s.strip('idle', idle, [10, 8, 10, 8], cls='idle')
    walk = X.plant([figure(K.A.up(...), lower) for lower in WALK_LEGS])   # 12 frames, 'plant' set
    s.strip('walk', walk, 4, cls='locomotion')             # 12 x 4 ticks at 0.6 px/tick: 28.8 px stride
    throw = [...]                                          # 6 frames: wind-up, release, settle
    s.strip('throw', throw, [6, 4, 2, 2, 4, 6], loop=False, cls='throw')
    s.event('THROW_RELEASE', 2)                            # the frame the ticket leaves the hand
    s.variant('enemy/handhaver-b', {'J': '#5a4a8a', 'j': '#3c3064', 'q': '#261e44'})
```

Then `npm run art40 -- handhaver --sheet`, look at `tmp/art40/handhaver/sheet.png` and the GIFs,
and register the set in the game: `defineBakedSet(SET)` from `src/engine/baked.ts`
(docs/api/media.md "Baked sets"). Points: `rows, root, j = X.humanoid(upper, lower)` gives every
rig joint moved like the pixels (`'armN.muzzle'`, `'armN.wrist'`, `'head.neck'`, `'pel'`,
`'legN.knee'`, `'legN.ankle'`, `'legN.ground'` ...); pass them all as `joints=j` and the ones the
game reads under their game names as `pts`: `X.Frame(rows, root, pts={'muzzle': j['armN.muzzle']},
joints=j)`. Then `npm run art40-check -- handhaver` (all gates; docs/api/media.md "Baked sets").

The fixture set `chars/_probe/` is a complete small example (2 strips, a variant, an event, a
point, a smear frame, one frame drawn with the rig's `Canvas.tube` + `finish`).

## The baked format (v2)

The baked set format is fixed in `src/engine/baked.ts` (`BakedSet`, `BAKED_FORMAT` 2).

- **Pixel stream** (`px`): pairs of characters over a 91-character alphabet (`'#'`..`'~'` without
  the backslash, value = position): (run length − 1, palette index), row-major, runs continue
  across rows. One character per byte keeps the data byte-aligned for gzip (the v1 base64 hid the
  repeats: VINCENT's 601 frames are 64 KB gzip now, 93 KB in base64). A palette holds at most 91
  entries (index 0 transparent). Streams used by more than one frame are written once
  (`const P = [...]`, `px: P[i]`).
- `face` (set) and `face` (strip, when it differs): the way the unflipped frames face.
- `fx?: number[]` — the indices only fx letters use: in the palette, outside the colour budget.
- The bake orders palette indices by first use (the outline first, index 1), merges letters with
  the same colour in the base palette and in every variant, and writes `#000000` at index 0.
- Fixture sets (`_` slugs) also write `<slug>.render.json` (the letters of every frame after crop
  and mirror, the palettes): the loader test compares the decoded pixels with it.
