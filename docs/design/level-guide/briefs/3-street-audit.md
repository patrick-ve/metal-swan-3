# Level 1 street pass — brief for one section (shared by all section painters), 2026-11-11

## The request

The user looked at the "Level 1 Repainted" page (v2) and asked for a port to the game, and: "I want you to fix the
road/path that the player is walking on from start to finish. There are elements that dont make any sense (bent
bike path, light poles that intersect the street, the drawbridge that doesnt make sense, etc.). Do a full audit".

The cause: the game's floor layout bends both kerbs around everything that stands on the walk line (pavement
"bulbs") and crosses the street with slanted bands. The user's answers:

- **Straight street, hero on it.** Both kerbs are straight lines for the whole level. The hero and the bike
  enemies move on the lane or the cobbles. Lamps, trees, benches, flags and planters stand on the pavements.
- **Art only, play unchanged.** Terrain, platforms, hitbox objects, spawns and scripts keep their numbers.
- Section a's side canal gets a **lift bridge** in place of the drawbridge (see "Section a").

You fix the street of your section(s) in the paint kit, as you would for a picky art director who will scroll
through the whole section. A later wave bakes the kit's layers into the game.

Read first: `L1-BRIEF.md` and `SCALE-BRIEF.md` (every rule still holds: your files, the camera, the gates, the
hours, no people, no reference game names, no git, no other agents), then `street.py` (the lead's street rules,
already applied to the layout the kit paints from) and the street part of `level.py` `floor_paint` (`squares`,
`bays`). `docs/design/canal-look.md` §3 and §6 bind the look.

## What the lead already did (shared files, read-only for you)

`street.py` rewrites the layout when `level.py` loads it (`L1_OLD_STREET=1` in the environment shows the old one):

- The far kerb is at depth 5 and the near kerb at depth −16.3 everywhere (screen y 171 and 192.3). No bulbs.
- `squares` ([u0, u1]): the band is paved from back to front with the street kind, with no kerbs.
- `bays` ([u0, u1]): a white dashed parking bay on the lane under a hitbox object that stands in the lane.
- Slanted `crossings` are gone from the data. The street kind changes along a straight line across the street.
- Lamps stand at depth 7.5 (kerbside) unless they stand on a square; they are 72 px tall again (`LAMP_H`; grey
  lamps 84), because a gull of the game perches at 70 px on some of them. Decor bike racks stand at depth −22.
- Amsterdammertjes: even rows on the granite of both kerbs (depth 6.2 and −18.4), outside bridges, water, squares,
  lamps and bays.
- `check_l1.py` has four new street gates.

Your section's own corrections of the layout go in a NEW file `street_<id>.py` with `fix(L, fl)` (`L` = the
section's dump, `fl` = its floor layout; `street.py` calls it after its own rules). Use it for kerb steps, squares,
bays, street kinds, depths of decor items and post rows. Do not edit `street.py`, `level.py`, `parts_ams.py`,
`check_l1.py`; a need there goes into your report.

## The street grammar (binding)

1. **Kerbs are straight.** A kerb line is one depth, or flat pieces joined by square corners at a hard break (the
   end of a bridge, a water edge, a building corner). No kerb, lane edge, lawn edge, path edge or material border
   runs at a slant or in a curve across the walk band. The only curves are the humps of bridges, in height.
2. **A lane connects.** The red lane starts and ends at a straight threshold (a granite band across the street,
   shark teeth on the lane side where riders give way): at a bridge deck, a square, the edge of the water with a
   reason to stop, or the section's edge. No lane stub, no lane that fades out, no lane under furniture.
3. **Nothing stands between the kerbs** except traffic, the hitbox objects of the game (they keep x and depth 0:
   crates, stalls, carts, breakable racks, hostages, secrets) and what stands on a square. Give a hitbox object
   that stands in a lane a `bay`, and one on cobbles nothing (a market street). Scenery that the old layout kept
   on the walk line (lamps, an elm, flags, benches) moves to a pavement.
4. **Furniture has feet on its ground.** A lamp, a tree, a post, a bench, a rack stands fully on one surface
   (pavement, kerbstone, square, deck): its base never straddles a kerb, a joint between materials or a water edge,
   and its shade falls on the floor under it. Amsterdammertjes stand on kerbstones only.
5. **Bridges** span between the kerbs: a deck is as wide as the street (depth 5 … −16.3) unless your section says
   otherwise; its railings stand on the kerb lines; its ends are straight thresholds; the pavements run up to the
   bridgeheads; the quay wall and the water close everything under and beside it (no sky, no floor showing through).
6. **Perspective is one.** A thing at depth d stands on row 176 − d and moves at s(176 − d). A piece that spans
   depths (a deck, an awning, a ramp, a parapet) is built from depth slices or planes that meet without gaps or
   double edges at every camera position. Check this while you scroll (item 3 of "Done when").
7. Gull perches (render-shifted in the game to their lamp's depth): a lamp that carries a gull keeps its x, is
   72 px tall, and its lantern cap is its highest part.

## Section notes (the lead's audit; your own audit must go further)

**a (Grachtengordel).**
- Lane 0–720, bridge 1, lane 880–1060, the side canal, the Pleintje (square 1340–1904), the shop street (cobbles),
  bridge 2, lane 2760–3190, a small klinker square before FABEL FRIET (3190–3584: the counter stands on it).
  The old cobble stubs and slanted crossing bands at 645, 975 and 2782 go.
- **The lift bridge** replaces the drawbridge at the side canal (water 1060–1340): a Dutch *hefbrug*. One riveted
  steel lattice tower on each bank (legs on both pavements, a portal over the street; the towers may leave the
  screen at the top), sheaves and cables, counterweights on the towers, and the whole deck hanging level high
  between them (its underside clearly above a jumping hero: about y 62 or higher on the screen; a steel truss deck
  as wide as the street, with the lane's red on it only if it shows). The lane runs to a steel threshold at each
  quay edge. Before each bank: a stop line and shark teeth, half-barrier arms from both kerbs that leave the middle
  of the street open (red-white, with red lamps), a red signal light. Nothing of the bridge blocks the hero's way
  along depth 0 to the quay edge at 1060 and from 1340 on. The far towers' legs and the far girder are behind the
  hero; near legs and the near girder are front planes. The houseboats, the rowing boat's range (x 1090–1312,
  y 172) and every platform keep their place. Make it the set piece of the stretch: it must read at one glance as
  "the bridge is up for the boats".
- Lamps with a gull at 470 and 920 (kerbside), 1360 (on the Pleintje, depth 0). A gull also perches at x 2730,
  y 92 on bridge 2: give it a lantern on the far parapet there. The elm at 620 stands at depth 9 now: a bough must
  carry the bike of the game's tree-bike secret at x 646, y 128 (the bike itself is not painted).
- The breakable rack at 690 stands in the lane: it has a bay (652–718; tune it).

**b (Museumplein).**
- Lane 0–800 through the passage (400–720), the tiled square 800–1116, the gravel path of the Museumplein, lane
  again from 2196. The path's edges are straight now (they were bent around hostages): the lawn edges, the lawn
  chains and the path must follow. The slanted crossings at 800 and 2196 go.
- Lamps with a gull at 110, 2300, 2620 (kerbside). The grey lamps (936, 1034) and the red flag stand on the square.
- The herring cart at 2340 stands in the lane: a bay.
- The key hue gate of b fails at 0.28 (needs 0.45); the lead accepted that. Do not make it worse.

**c (Amstel) and c1 (Brug).**
- c: lane 0–470, the quay-head square 470–600, the canal with the houseboats, the shop quay 1400–2368 (cobbles: a
  market street with stalls and the scan-car arena), the fork square from 2368. The crossing at 470 is straight now.
  Lamps with a gull at 520 (on the square, depth 0) and 2000 (kerbside).
- c1: the white plank bridge lands at 860 with a square corner (its deck runs from depth 21.5 to −2.1); the quay
  (lane 860–1004), the Blauwbrug (1020–1220), the market. The lamp with a gull at 920 is kerbside. The Blauwbrug's
  deck may stay wider than the street if its parapets start at square corners; say what you chose.

**d (Stopera).**
- The flea market and the forecourt are one paved ground (`squares` covers the section): no roadway edge bends at
  824–860 any more. Redo the areas (the fan of the market, the granite band, the stone forecourt) with straight
  borders, the post rows of the market's edge on kerbstones or gone, and the lamp sizes (72 px on the walk plane;
  your size gates name 104).

## Done when

1. `street_<id>.py` holds your layout corrections, and for u in 1 2 4 `U=$u python3 check_l1.py l1<id>` prints
   `ALL GATES PASS` (b: all but its known key hue gate).
2. **The full audit.** `U=2 python3 audit_strip.py l1<id> <dir>` writes strips of the whole section (camera steps
   of 336 px, the lower part of the frame; make `<dir>` first). Open every strip with the Read tool, before and
   after. Walk the section from x 0 to its end and write down, per screen, every thing that makes no sense for a
   person who knows a street: a bend, a stub, a lane under a tree, a post in the road, feet that hang over an edge,
   a railing that ends in the air, a wall that does not meet the ground, water that shows through, a shadow
   without a thing, a thing without ground, a sign that points nowhere, a double edge between two depth planes.
   Fix each one. Repeat until a full pass finds nothing. The list (finding → fix) is part of your report.
3. Scroll check: for each set piece that spans depths (bridges, the lift bridge, ramps, decks, awnings), compose
   frames at five camera positions 40 px apart around it at tier 4 and look for gaps, double edges and parts that
   drift apart.
4. Previews at tier 1 and 4 (`U=1 python3 l1<id>.py`, `U=4 …`), every frame opened, beside the same frame in
   `out-prescale/` or the v2 frames in `out/` before your change: nothing outside the street got worse; the level
   of detail did not drop (a new surface gets the same wear, stains, joints and lit edges as its neighbours).
5. A tier-4 build stays under about 90 s. Other agents build at the same time: run one tier-4 build at a time; if
   a build dies from memory, wait a minute and run it again.

Report (short): the audit list (finding → fix), what you changed in the layout (the exact numbers of
`street_<id>.py`: the game's layout files will take them over), the gate output at tiers 1, 2, 4, the tier-4
build time, what you kept and why, what you did not do.
