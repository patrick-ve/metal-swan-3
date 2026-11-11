# Level 1 scale pass — brief for one section (shared by all section agents), 2026-11-11

## The request

The user looked at the "Level 1 Repainted" page: "I think the scale of the houses is incorrect now relative to the
player character. Leave the height of the player character, but scale the houses so that they are in proportion."

Measured: the hero is 42 px tall (40 px body). A far-bank storey is about 11–12 px, a street-side storey 14–16 px:
the hero is as tall as 2.5–3 storeys. The houses are far too small.

The user's answers:
- **Target: the arcade reference ratio (about ×1.6 of today).** A storey on the walk plane is about as tall as the
  hero. Far-bank houses about 95–110 px including the gable; the sky band over the far roofs shrinks from ~45 px to
  ~10–25 px. Most roofs and some sky stay in view.
- **What scales: buildings and landmarks, plus the scenery that stands with them**: trees, lamps, far cars, far
  bikes, far boats. Everything on a plane stays in proportion to the houses of that plane.

Read `L1-BRIEF.md` first: every rule of it still holds (files you may write, camera, gates, hours, no people,
Amsterdammertjes on kerbs only, no reference game names, no git, no other agents).

## The scale rule

**Scenery scale = 13 px per metre × s**, where s is the plane's speed (a thing standing on floor depth d has
s = s_d(d) = (116 − d) / 116). The hero has his own scale (22 px/m); the scenery is drawn at 0.6 of it, the
compromise the arcade reference makes.

| Plane speed s | storey | ground floor | window w | kit `sc` | house width (3 bays) | far tree h |
|---|---|---|---|---|---|---|
| 0.10 (skyline) | 4 | 5 | 1–2 | 0.2 | 6–9 | 20 |
| 0.30 | 12 | 16 | 4 | 0.6 | 18–28 | 60 |
| 0.50 (canal far bank) | **20** | 27 | 7 | **1.0** | 30–46 | 100 |
| 0.741 (back edge of the floor, y 146) | 30 | 40 | 10 | 1.48 | 44–68 | 150 |
| 1.0 (walk plane) | **40** | 54 | 14 | 2.0 | 60–92 | crown leaves the screen |

- With the kit's `house()` / `house_row()` pass **`sc = 2 × s`**, house widths `wmin = 60 s`, `wmax = 92 s`, and
  `hmin`/`hmax` that give 3–4 upper storeys plus the ground floor (at s = 0.5 that is the kit default 62–86).
  Your own facade painters: storey = 40 s px (±15 %), ground floor ≈ 1.35 storeys, a front door ≈ 1.1 storeys
  tall, windows 14 s wide.
- Real sizes for the rest (× 13 s px): a tree 14–18 m, a street lamp 4.5–5 m (far bank, s 0.5: ~30 px), a car
  4.3 × 1.5 m, a bike 1.8 × 1 m, a houseboat 15–20 m long, a tour boat 20–25 m, a sloop 6 m, a tram 30 m.
  Landmarks by their real size: Westertoren ~85 m, Rijksmuseum front ~30 m to the ridge (towers ~60 m),
  Carré front ~20 m, Stopera ~25 m, Blauwbrug / Magere Brug lamps 4–6 m.
- Things may leave the screen at the top. A near facade on the walk plane shows its ground floor, its first floor
  and part of the second; that is right. A far roof may be cut by the top edge where the row is tall, but most far
  roofs stay in view. The skyline layer may disappear behind the far houses; a tower that still shows must stand
  on something (no floating tops).
- Shared parts already done by the lead in `parts_ams.py`: `elm` is now 166 × 218 (`ELM_W`, `ELM_H`), the walk-plane
  lamps 104 / 112 (`LAMP_H`, `LAMP_GREY_H`), the flag pole 96 (`FLAG_H`). `standard_decor` uses them. If your section
  calls `lamp(84)`, `grey_lamp(84)`, `blauwbrug_lamp(86)`, `flag_pole(..., 64)` or its own elm/tree sizes, bring them
  to the same scale.

## What does NOT change

- The hero (Vincent): size and walk line. Never scaled.
- Every gameplay piece and its shape: platforms, ledges, awnings that are platforms, bridges and their decks, the
  boats that carry the player (their hull, deck and roof lines), breakable stalls, carts and racks, the FABEL FRIET
  counter, the passage roof slices and the vault bottom (b), the Stopera doors at x 1190 (d). The layout frame must
  still show every yellow and cyan line on your art.
- Street furniture beside the hero keeps the hero's scale: Amsterdammertjes, barrier posts, bikes, bike racks,
  benches, planters, bins, signs at hand height.
- Where a facade carries a gameplay ledge or awning (the shopping street in a, stalls in front of houses), the
  ledge stays at its y. Grow the facade around it: the ledge reads as a balcony, a sill, a cornice or a shop
  fascia at its height. Storey lines may move ±15 % to meet a ledge.
- The hours, colour tables, planes, speeds and section widths.

## Done when

1. Every building and every tree, lamp, car, bike and boat of the scenery in your section is at the scale rule.
   Add to your `checks(sec)` one entry per building plane: `('storey on <plane id> (s=0.50): 20 px, target 20 ±15%',
   ok, value)`, measured from the parameters you paint with (not guessed), plus one for each landmark
   (`'Carré front 20 m at s=0.62: 161 px'`).
2. `for u in 1 2 4; do U=$u python3 check_l1.py l1<id>; done` prints `ALL GATES PASS` three times.
3. You re-ran `U=1` and `U=4` previews and opened every frame with the Read tool. Put each beside the same frame
   before the change in `out-prescale/` (read-only) and beside the nearest `docs/design/canal-look/ref/` frame. The
   hero now stands about one storey tall against the near facades; far houses fill the screen to about y 0–25.
   Fix anything that now looks empty, stretched, cramped or broken (a gable cut in half by another layer, a tree
   crown that hides the whole far bank, a tower floating on nothing, too much repeated texture on large walls:
   large walls need more detail per storey, not the same detail stretched).
4. A tier-4 build stays under about 90 s. Five agents run at the same time on this machine; a tier-4 build of
   section a peaked at ~21 GB virtual memory. If a build dies from memory, wait a minute and run it again.

Report (short): what changed per plane (old → new storey px), the landmark sizes, the gate output at tiers 1, 2, 4,
the tier-4 build time, what you kept and why, what you did not do.
