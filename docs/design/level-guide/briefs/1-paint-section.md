# Level 1 in the canal look — brief for one section (shared by all section agents)

## The request (the user, 2026-11-10)

"Use the design guide and paint kit to redesign the first level. Use the existing layout and entities that are
present in the first level." The user's answers:

- Output: **kit + preview page**. You paint in the kit. No game code changes. Nothing in `src/` changes.
- Scope: all six sections of mission `ams` (a, b, c, c1, c2, d). You do the section(s) named in your prompt.
- Hours: **keep the level's hours**: a morning, b noon, c / c1 / c2 golden afternoon, d sunset. Their key and air
  tables are `HOURS` in `level.py`. Use them as they are (other agents share them). You may tune the air AMOUNT per
  plane in your own file.
- Decor: **repaint all decor, same shapes**. Backgrounds AND the gameplay decor (bridges, houseboats, awnings, ledges,
  facades, stands, stalls, the passage, set-piece buildings) in the canal look. Every platform, ledge height, water
  hazard and x position stays exactly as the game has it. Characters, enemies, pickups and fx are not painted.
  Breakables (stalls, carts, bike racks spawned by the script) and boats that are platforms: paint their intact
  state at their spawn x (a moving boat at its spawn x).

## Read first

1. `docs/design/canal-look.md` (repo root) — the look contract (§3), the build steps (§4), the defects the user
   rejected (§6). Its numbers bind you. Its kit is copied here; the reference frames are in
   `docs/design/canal-look/ref/` (open `a-u4.png`, `b-u4.png`, `c-u4.png`, `d-u4.png` with the Read tool).
2. `tmp/l1/kit/level.py` — the game's floor camera, long sections, the floor painter, the hours, the preview.
3. `tmp/l1/kit/parts_ams.py` — shared Amsterdam parts and `standard_decor` (it stands the common decor and the post
   rows of the game on the floor and returns the items it did not handle: your set pieces).
4. `tmp/l1/kit/l1test.py` — a block-out of section a with the shared parts only: the template of a section file.
5. The layout: `tmp/l1/kit/ams-layout.json` (dumped from the game: terrain, every decor item with x, y, sprite box
   `box` {w, h, ox, oy} and floor depth `floorDepth`, the floor layout with kerb lines, street kinds, canals,
   bridges, areas, prop rows). The game's own files: `src/game/content/missions/ams/terrain.ts`,
   `section-<id>.ts`, `docs/design/amsterdam.md` §5–§6, `docs/design/floor.md` §4.4. Read the game's art files only
   to learn shapes and sizes of gameplay pieces; paint everything new with the kit.
6. What the level looks like today: `tmp/l1/cur/<section>-<x>.png` (the game at 2×; the label gives the player x;
   the camera's left edge is about x − 192). `tmp/l1/cur-<section>.png` joins them.

## The camera (do not change it)

Walk line y 176. The floor runs from y 146 (back edge) to 216; a floor row at y scrolls at s(y) = (y − 60) / 116.
A thing at depth d stands on row 176 − d and scrolls at s(176 − d); drawn at its own size. Use `sec.put(part, x, depth,
base=..., front=...)`: x is the world x of the game; depth is the item's `floorDepth` (0 = walk plane; negative = in
front, drawn over the hero; `front=True` = the game's front decor at depth 0). Far planes need speeds below 0.741.
Platform art goes in the walk plane (depth 0, not front): the gate checks it under every platform line.

## Your files

- Write ONLY `tmp/l1/kit/l1<id>.py` (with `build()` returning the `Sec`, a module-level `NOTE` string of 2–4 short
  sentences for the page, and optional `checks(sec)`) and `tmp/l1/kit/parts_l1<id>.py` for your new parts.
- `level.py`, `parts_ams.py`, the kit files and the other agents' files are read-only for you. Need a change in a
  shared function? Copy it into your parts file, change it there, and name it in your report.
- Floor additions of your section (a pool, a crossing's shark teeth, a passage shade): `floor_layer(sec, extra=fn)`
  where `fn(u, d, v, rgb)` paints in place (daylight ramp colours).
- Section ids for `Sec(...)`: 'a', 'b', 'c', 'c1', 'c2', 'd'. The name: the game's section name (GRACHTENGORDEL,
  MUSEUMPLEIN, AMSTEL, BRUG, RONDVAART, STOPERA) in normal case.

## Done when

1. `for u in 1 2 4; do U=$u python3 check_l1.py l1<id>; done` prints `ALL GATES PASS` three times. A gate you
   think is wrong for your section: keep it failing and explain why in the report (do not edit check_l1.py).
2. `U=1 python3 l1<id>.py` and `U=4 python3 l1<id>.py` write `out/l1<id>-<i>-u<U>.png` (call `preview(sec, cams=...)`
   with 5–8 camera positions that show every set piece; the layout frame shows the game's terrain over your art).
   You opened every frame with the Read tool at tier 1 and tier 4, put each beside the nearest `ref/` frame, and
   fixed every defect of §6 of the guide and every place that looks emptier, flatter or noisier than the reference.
   A tier-4 build stays under about 60 s.
3. Each gameplay piece sits on its terrain: the layout frame shows the yellow ground and cyan platform lines lying
   on your art's walk surfaces, decks, roofs and ledges.

## Rules

- Scenery only. Vincent and all figures stay as they are; do not draw people (a dim figure in a far window is fine).
- Amsterdammertjes (the street posts with XXX) stand on kerbstones only. The post rows of the game data are on kerbs.
- Never name a reference game in code, ids, comments or docs; write "the arcade reference". Real Amsterdam names
  (Rijksmuseum, Museumplein, Amstel, Stopera, Carré, Magere Brug, Blauwbrug, Waterlooplein) are allowed. Lettering:
  the kit's `FONT` (add letters in your parts file if you need them), generic words or the game's own words
  (FABEL FRIET, HOTDOGS, KOFFIE, KAAS ...). A real building is an own impression, painted by the kit.
- No commit, no push, no deploy. Do not touch `src/`, `docs/` or git. Do not spawn other agents.
- Report (short): what you built, the gate output at tiers 1, 2, 4, the build time at tier 4, what differs from the
  guide or the game layout and why, what you did not do.
