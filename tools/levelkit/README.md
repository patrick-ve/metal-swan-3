# Level kit

The level kit paints the scenery of a game section in the **canal look** and bakes it for the game. A section is a
stack of layers (sky, clouds, skyline, far rows, the floor, depth planes of houses and furniture, front things),
painted in Python from the game's own layout (section width, ground line, platforms, decor at their x and depth),
previewed as PNG frames, checked against the gates of the look, and baked to PNG packs, a TypeScript manifest and
fidelity fixtures that the game draws with the same maths (`docs/api/canal.md`). Level 1 (mission `ams`, sections
a, b, c, c1, c2, d) is the worked example: its baked files in `public/art/ams/` come from this folder, byte for byte.

## Requirements

- Python 3.13 (3.10 or newer should work), macOS or Linux (the bake's file lock uses `fcntl`).
- `pip install numpy pillow` (tested: numpy 2.5, Pillow 12.2; the page export needs Pillow with WebP).
- Node and the repo's `npm install` for the layout dump (`npx tsx`) and the tests.

## File map

| Path | What |
|---|---|
| `lk.py` | the one entry point: `python3 tools/levelkit/lk.py <mission> <command> …` |
| `dump.ts` | dumps a game mission's layout to `work/<mission>/layout.json` |
| `core/kit.py` | `Layer` (RGBA at the tier), `U`, `P()`, colour maths, noise, `sky`, `cumulus`, `grader`, `curve`, `snap5`, `save` |
| `core/parts.py`, `parts2.py`, `parts3.py`, `parts4.py` | painters: ramps `R`, bricks, windows, `house`, `house_row`, trees, boats, bridges, `lamp`, `bench`, `bike`, `post`, water, mirrors |
| `core/build.py`, `core/sets.py` | the study's scene machinery (`hero_frames`, `glow`, `flatten`) and set pieces (`far_roofs`, `far_bank`, `vista3d`, light pools) |
| `core/level.py` | the level model: `Sec`, `s_d`, `sky_layers`, `skyline_layer`, `floor_layer`, `canal_far`, `canal_water`, `compose_level`, `preview`, `decor` |
| `core/street.py` | the straight street: rewrites the layout's kerbs and post rows from the mission's `STREET`; the street gates |
| `core/game_sprites.py` | `entity()`: paintings of things the game draws as entities (racks, stalls, boats) become canal sprites |
| `core/check_level.py`, `core/check.py` | the gates (`check.py`: the colour grid `ON` and `keyhue`) |
| `core/audit_strip.py` | audit strips of a whole section |
| `core/export_level.py`, `pack_level.py`, `mkpage_level.py`, `level.tpl.html` | the review page (layer tiles, sheets, HTML) |
| `core/bake_game.py` | the game bake (tiles, packs, manifest, fidelity fixtures) |
| `core/lkpath.py` | paths and module loading for the scripts |
| `core/vin/` | the hero's run and idle strips for previews and the page |
| `missions/ams/mission.py` | level 1's tables: `HOURS`, `KEY_SHARE`, `STREET`, `STREET_IDS`, `FURNITURE`, `PAGE`, bake folders |
| `missions/ams/l1<id>.py` | the six section modules (`build()`, `GAME_CAMS`, `checks(sec)`) |
| `missions/ams/parts_ams.py`, `parts_l1*.py` | level 1's furniture (`standard_decor`) and each section's painters |
| `missions/ams/street_<id>.py` | each section's street corrections (`fix(L, fl)`, called after `street.py`'s rules) |
| `missions/ams/fit_l1b.py`, `fit_l1c.py`, `fronts_l1a.py` | measuring scripts (house fits) |
| `missions/sample/` | a pseudo-mission with a stub layout (no game mission): the look sample |
| `template/section.py` | a small commented section to start from |
| `work/` | outputs, git-ignored: `<mission>/layout.json`, `<mission>/out/` previews, `strips/`, `site/`, `.bake.lock` |

## The model in ten lines

1. The screen is 384 × 216 logical px; the floor camera has its horizon at y 60, the walk line at y 176, the floor's back edge at y 146.
2. A thing at **depth** d (px behind the walk line; negative: in front) stands on screen row 176 − d and scrolls at `s_d(d) = (116 − d) / 116`; world x sits at layer x `192 + (x − 192) · s`.
3. `Sec(id, name, hour)` holds one section: its layout `sec.L`, its width `sec.W`, the camera travel `sec.cam`, the hour's tables `sec.H`, `sec.KEY`, `sec.AIR`.
4. `sec.add(id, layer, speed, y=0, kind=…)` appends a layer; the draw order is the add order (far first). `over=True` draws over the hero.
5. Layer kinds: `img` (one speed), `tile` (wraps, may `drift`: clouds), `rows` (one speed per row from `s0` to `s1`: the floor, water), `frames` (n images, a step every 10 ticks).
6. `sec.put(part, x, depth, ax=…, base=…, front=…)` stands a part on the **plane** of that depth (rounded to 0.5); `sec.flush()` grades every plane with the key and curve of the hour and adds it as layer `d<depth>` (depth < 0 or `front`: over the hero).
7. The depth-0 plane is the **walk plane**: the art under platforms and raised ground goes there.
8. Tiers: `U=1|2|4` (env) is the art tier; positions stay logical, arrays are real px (`P(v)` = v · U); tier 4 is 1536 × 864.
9. Every colour sits on the **5-bit grid** (`snap5`: each channel `(q << 3) | (q >> 2)`); `sec.add` snaps every layer.
10. In a game bake (`L1_GAME=1`, set by the bake) `entity(sec, '<sprite id>', painting, x, depth)` leaves the scene and becomes a canal sprite; previews paint it in place.

## Commands, in the order of use

All from the repo root. `U` defaults to 1. Every command names its mission; `<module>` is a module of the mission
folder (`l1d`) or a path to a `.py` file.

```sh
npx tsx tools/levelkit/dump.ts ams                       # 1. the layout: work/ams/layout.json (re-run after a game change)
                                                         #    [--out <file>] [--prefix decor/ams/ --prefix npc/ams/ ...]
U=1 python3 tools/levelkit/lk.py ams preview l1d         # 2. previews: work/ams/out/l1d-<i>-u1.png and a layout frame
U=4 python3 tools/levelkit/lk.py ams check l1a l1b       # 3. the gates (no names: the mission's SECTIONS); ALL GATES PASS
U=2 python3 tools/levelkit/lk.py ams strip l1d [<dir>]   # 4. audit strips (default work/ams/strips/)
python3 tools/levelkit/lk.py ams run fit_l1b -v          #    any mission script (fit_l1c l1c, fronts_l1a)
for U in 1 2 4; do U=$U python3 tools/levelkit/lk.py ams export; done   # 5. the review page: layer tiles, tier 1 first
python3 tools/levelkit/lk.py ams pack                    #    tiles -> sheets
python3 tools/levelkit/lk.py ams page                    #    work/ams/site/index.html (+ page.html: the body only)
python3 -m http.server -d tools/levelkit/work/ams/site --bind 127.0.0.1 8000
for U in 1 2 4; do U=$U python3 tools/levelkit/lk.py ams bake l1d; done # 6. the game bake, tiers 1, 2, 4
npx vitest run tests/art/canal-fidelity.test.ts -t "ams d "             # 7. the game frame equals the kit frame
```

The bake's defaults come from `mission.py` (`ART`, `MANIFEST_DIR`, `FIXTURES`), else `public/art/<id>`,
`src/game/content/missions/<id>/canal`, `tests/fixtures/canal/<id>`. `--out`, `--manifest-dir`, `--fixtures` (or
`--no-fixtures`) bake elsewhere; `--stats` prints the resident pixels per camera. A scratch bake is checked with
`CANAL_FIXTURES=<dir> CANAL_PUBLIC=<dir holding art/<id>> CANAL_MANIFEST=<dir> CANAL_MISSION=<id> npx vitest run
tests/art/canal-fidelity.test.ts`. The bake is deterministic: the same kit gives the same bytes. Always bake art and
fixtures together, and all three tiers: when a section's layer or sprite list changes, the bake drops its other tiers.

Other env switches: `L1_OLD_STREET=1` paints the game's bent street (without `street.py`), `LK_LAYOUT=<file>` reads
another layout.

## Add a mission

1. The game has the mission with its sections and floors. Dump it: `npx tsx tools/levelkit/dump.ts <id>` (pass
   `--prefix` when its sprite ids do not start with `decor/<id>/`, `npc/<id>/`, `vehicle/`).
2. Create `tools/levelkit/missions/<id>/mission.py` (copy `missions/ams/mission.py` and cut it down):
   - `ID` (the game's mission id), `SECTIONS` (module names in order), `HOURS` (one dict per hour: `KEY`, `AIR`,
     `sky`, `cloud`, `water`, `shadow`, `cast`, `shade`, `fg`, `curve`, `sun`), `KEY_SHARE` (per hour, default 0.45);
   - optional: `STREET` (per section id: the straight street; leave it out to keep the game's kerbs) with
     `STREET_IDS` and `FURNITURE` (the mission's lamp, tree, rack ids and post prop), `PAGE` (title, section labels,
     `header`, `route`), `FIXTURE_CAMS`, `ART`, `MANIFEST_DIR`, `FIXTURES`.
3. Add a section: copy `template/section.py` to `missions/<id>/<module>.py`, set `SID`, `NAME`, `HOUR` as constants,
   write `GAME_CAMS` (five or more cameras on the screens that matter). Shared painters for the mission go in
   `missions/<id>/parts_<id>.py`; street corrections in `missions/<id>/street_<section id>.py` (`fix(L, fl)`).
   Never name a mission file like a core file (`level.py`, `parts.py`, …): the mission folder comes first on the
   import path and would hide the core file.
4. Preview, check, bake (above). No shared file changes for a new mission.
5. Game side: `src/game/content/missions/<id>/canal/index.ts` registers the baked manifest,
   `defineCanalManifest('<id>', CANAL_MANIFEST)` (import it from `./manifest.gen`; see `missions/ams/canal/index.ts`),
   and each section opts in with `canal: { scene: '<id>/<section id>' }` (and imports that index). The fidelity test
   finds `tests/fixtures/canal/<id>/` on its own; tests named `<id> <section> at tier <U>`.

## A look sample without a mission

To sample the look of a place before the game has a layout for it, use the pseudo-mission `sample`: its
`mission.py` points `LAYOUT` at a stub (`missions/sample/layout.json`: one flat section `a`, 960 px, ground at
y 176, straight kerbs at 5 and −16.3, cobbles, no decor, no platforms) and has one hour `day`. Build the template on
it at the three tiers, with previews and the gates:

```sh
for U in 1 2 4; do
  U=$U python3 tools/levelkit/lk.py sample preview tools/levelkit/template/section.py   # work/sample/out/l1tpl-a-*-u$U.png
  U=$U python3 tools/levelkit/lk.py sample check tools/levelkit/template/section.py
done
```

For your own place: copy `missions/sample/` to `missions/<place>/` (or to any folder: `lk.py <path> …` takes a path),
set `ID`, the hours, and the stub (width, `far` / `near` kerbs or `null` for none, `street` kinds, `areas`, `canals`);
copy `template/section.py` into it and paint. `sample` has `BAKE = False`: it never bakes into `public/` or `src/`.
The template also runs on a real layout: `LK_SECTION=d LK_HOUR=sunset U=1 python3 tools/levelkit/lk.py ams check
tools/levelkit/template/section.py`.

## The gates (`check`)

| Gate | Meaning |
|---|---|
| colours in a frame ≤ 560 | five cameras; a frame stays a palette-sized picture |
| key hue share ≥ `KEY_SHARE[hour]` | the hour's hue rules the frame (worst of five cameras) |
| darkest tone: skyline > far ≥ near | air: far planes are lighter; the darkest tones are in front (needs layers `skyline` and `far`; `near` = planes at depth ≤ 0) |
| light range: skyline < far | far planes are flatter |
| every pixel on the 5-bit grid | no colour off the grid in any layer |
| every platform has art at its line | the walk plane (depth 0) shows each platform; the depth-0 plane must exist |
| every raised ground has a deck | bridges and ramps have art at their line in the walk plane |
| every layer covers the camera travel | no layer ends before the last screen |
| street: … | only for sections in the mission's `STREET`: straight kerbs, no furniture in the lane, posts on kerbstones |
| the module's `checks(sec)` | the section's own rules (house fit, scale, sign rules) |

After the bake, the fidelity test (gate 3 of the port) must show 0 px different at every fixture camera and tier.
Level 1 today: every gate passes at tiers 1, 2, 4 except section b's key hue share (0.28; accepted by the owner).

## Known limits

- A tier-4 build is heavy: 20–55 s and up to ~21 GB virtual memory (section a). Run one tier-4 build at a time; a
  build that dies from memory is run again after a minute. Tiers 1 and 2 take seconds.
- The bake's writes run under one file lock (`work/.bake.lock`), so bakes of different sections may run in parallel,
  but the builds themselves are not limited: the lock does not protect memory.
- The layout dump is generated and ignored: run it first in a fresh checkout, and again after any change to the
  mission's sections or sprites (the bake refuses a canal sprite id or frame the dump does not know).
- Modules use `from level import *` and the painters' star imports: a new top-level name can shadow another. Keep
  section-local names in your module, prefixed or lower case.
- Preview files keep level 1's `l1` prefix (`level.preview`); the page's data folder is `site/l1/` for every mission.
- Painting code is level 1's, not a library with a stable API: read the section modules for working examples
  (`l1d.py` is the shortest real one).
