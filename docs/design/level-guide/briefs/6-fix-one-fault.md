# Level 1 canal look — house fronts that hide each other (shared brief for the section agents, 2026-11-11)

## The report

The owner played the ported level (`?mission=ams`, the baked canal scenes) and likes it. One visual bug, in their
words: "the houses that are standing next to each other: it seems they overlap each other". Their screenshot is the
shop street of section a (BLOEMEN, KOFFIE, BOEKEN): the right window column of a front is cut in half by the next
front, a cornice and a dormer roof run under the neighbour's gable, a shop fascia is cut.

The same fault shows in b (the house row from x 2197) and c (the shop quay). See the game shots before the fix:
`tmp/l1/port/shots/a/c2120.png`, `tmp/l1/port/shots/b/b-x2420-u4.png`, `tmp/l1/port/shots/c/c-x1700-t4.png`.

## The cause (measured by the lead)

The street houses stand on the plane of floor depth 14: s = s_d(14) = 0.879. `Sec.put(part, x, 14, ax)` blits a
front at `sec.at(x, s) - ax`, so two neighbours whose game boxes are Δx apart are only Δx · 0.879 apart on the
plane. The fronts are painted at the full width of the game's box (57–64 px, the old sprites' size), so each front
is 9–13 px wider than the room it has, and the next front is drawn over its right edge. The game's old boxes also
overlap by 4–7 px on their own. Section a passes a `clip_r` to the shopfront, computed in world px (too small) and
used by the shop sign only. Section d paints one row of its own (`market_row`) and has no fault: use it as the
picture of "right".

## The rule (binding)

**On one plane, the fronts of a row tile.** Front j owns the span from its own left edge to the left edge of front
j+1 on that plane (its *slot*), and everything of it is painted inside that slot: the brick body, every window
with its frame, lintel, shutters and flower box, the cornice, the gable and its roof, the shop fascia with its
whole word, the door, the steps, the awning on the facade. No front hides a part of another front, at any camera
position. A party line between two fronts is one clean vertical edge from the foot to the lower of the two eaves;
above it the taller front shows a side (brick or roof) that ends cleanly, not a cut-off ornament.

How you get there is yours to choose per section, for example: paint each front at its slot width (a 42–56 px
front has two or three window columns: the kit picks by width), or lay the row out again from the row's first
left edge to its last right edge with your own widths (as d does), or let one wide front take two of the game's
boxes. The game's house boxes are not gameplay and are not drawn in a canal scene; only the things below bind you.

## What must still hold

- **Play and the port.** You change kit art only (your section's `l1<id>.py`, `parts_l1<id>.py`). No game source
  changes except generated files from the bake. If an opt-in number in `section-<id>.ts` must follow the art, say so
  in your report first line and make that one edit.
- **Everything the game hangs on the fronts keeps its place and its meaning** (read `tmp/l1/port/SECTION-PORT.md`
  step 2 and `docs/api/canal.md`): each window waver sits in a real window of one front, whole, not across a party
  line; awning platforms and the balcony of section a sit on a shop front or sill at their y (`AWNINGS`, `BALCONY`,
  `LINES` in `l1a.py`); the hoist beam of the hoist secret; the side walls and flanks at the ends of a row
  (`side_wall` in a, `house_flank` in b) meet the end fronts without a gap or a step; FABEL FRIET, its sign and
  its neighbour in a; the passage, the Rijksmuseum front and the stands in b; the route signs and the pontoon in c.
- **The look.** Scale rule of `tmp/l1/kit/SCALE-BRIEF.md` (storey 40 s, sc = 2 s). The level of detail does not
  drop: a narrower front keeps lintels, keystones, shutters, string courses, flower boxes, wall anchors, steps.
  The row keeps its rhythm of low and tall fronts, of gable kinds and brick colours, and its shops with whole,
  readable words. Hours, colour tables, planes, speeds unchanged. No people. Amsterdammertjes on kerbstones only.
  Never name a reference game anywhere; write "the arcade reference".
- Shared files (`level.py`, `parts.py`, `parts_ams.py`, `street.py`, `bake_game.py`, `game_sprites.py`, the engine,
  shared tests): do not edit. Two other agents work beside you on other sections. No git commands that change
  state, no other agents. Never revert or reformat anything in the tree.

## Steps

1. **Measure.** Print, for every house row of your section on every plane (the street fronts, and also far-bank
   rows, side-street rows, anything built from `house`, `house_a`, `house_row*`, `golden_house`, `house_front`),
   each front's left edge and painted width on its plane and the overlap with the next. Keep the script; its output
   after the fix (overlap 0 everywhere) goes in your report.
2. **Fix** to the rule. Add a gate to your section's `checks(sec)`: `('house fronts tile: no front hides
   another (max overlap 0 px)', ok, value)`, computed from the same numbers you paint with.
3. **Look.** Before and after, at tier 4, at five or more cameras that together show every front of every row
   (`U=4 python3 l1<id>.py` writes the previews of `GAME_CAMS`; `compose_level(sec, cam, 0, hero)` gives any
   camera, see `audit_strip.py`). Open every frame with the Read tool and walk every party line from the foot to
   the roof. Also 40 px apart around each waver and each awning (parallax must not open a seam). Repeat until a
   full pass finds nothing.
4. **Bake and gates** (from `tmp/l1/kit`; one tier-4 build at a time, a bake that dies from memory is run again
   after a minute):
   `for U in 1 2 4; do U=$U python3 bake_game.py l1<id> --out ../../../public/art/ams --manifest-dir ../../../src/game/content/missions/ams/canal --fixtures ../../../tests/fixtures/canal; done`
   - `for u in 1 2 4; do U=$u python3 check_l1.py l1<id>; done`: ALL GATES PASS (b: all but its known key hue gate).
   - `npx vitest run tests/art/canal-fidelity.test.ts -t "ams <id> "`: exact at tiers 1, 2, 4.
   - `npx vitest run tests/game/canal-optin.test.ts tests/game/canal-sprites.test.ts tests/content/ams-dense-budget.test.ts`
     and your section's own canal test if it has one; `npm run typecheck`. Do NOT run the whole suite.
   - Game shots after the bake, tier 4, of the same cameras as the three "before" shots named above and two more:
     `npm run shot -- --mission ams --section <k> --x <x> --ticks 40 --god --char vincent --res 4 --art 4 --out <file>`
     into `tmp/l1/port/shots/<id>/fit/`. Open them: wavers in their windows, awnings on their fronts.
5. **Report** (to the lead, under 400 words): deviations and any non-kit edit first; what you chose (slot widths,
   a new layout, merged fronts) and why; the overlap table after the fix; what moved for wavers, awnings, signs;
   the gate results; the paths of five "after" shots; what you did not check.
