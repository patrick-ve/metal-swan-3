# The look of a level — the method, the look sheet, the look sample

Phase 2 and Phase 5 of `docs/LEVEL_GUIDE.md`. The user approved one look and one level in it: the canal look
(`docs/design/canal-look.md`) and level 1 (`ams`). Two things came out of that work:

- a **method** that holds for every place (this file, "The method" and "The grammar"), and
- one **look sheet**, for Amsterdam (`canal-look.md` §3: its hours, lines, sizes, surfaces, water).

A level in a new place keeps the method and gets its own look sheet. A new Amsterdam level reuses the sheet and
adds only its hours and set pieces.

The paint kit, its file map and every command: `tools/levelkit/README.md`.

## The method (fixed for every level)

- **Grid and tiers.** The layout is 384 × 216 logical pixels. Scenery is painted three times, at 1×, 2× and 4×
  (`U`), each for its own grid, never scaled from another. The user judges at 4×.
- **Figures are never scaled.** A hero is 40 px tall; no figure, enemy or pickup is enlarged or resampled.
  Scenery fits the figures, by the scale rule.
- **The scale rule.** Scenery scale = 13 px per metre × s, where s is the scroll speed of the plane. On the walk
  plane a storey is 40 px (about one hero), a ground floor 54, a window 14 wide; at s 0.5 everything is half.
  Things may leave the screen at the top. Street furniture at hand height (posts, benches, bikes, bins) keeps the
  hero's own scale. The table with every plane: `briefs/2-scale-pass.md`.
- **The camera of a level.** Walk line y 176. The floor runs from y 146 to 216; a floor row at y scrolls at
  s(y) = (y − 60) / 116. A thing at floor depth d stands on row 176 − d on the plane of speed
  s_d(d) = (116 − d) / 116, at plane x = 192 + (world x − 192) · s, drawn at its own size. Depth 0 is the walk
  plane; negative depth is in front of the hero.
- **Colour.** Every colour sits on the 5-bit grid. A surface takes its tones from one ramp of 7 (shade end
  cooler, light end warmer). Paint in daylight first; the hour comes from two colour tables: the **key** (the
  light) and the **air** (the haze of distance). One key hue owns a scene. Lights (**emitters**) skip both.
- **Depth.** A far plane takes the hue of the air and loses contrast; the darkest tones are in the nearest
  planes only. Dither is for air (sky, cloud base, halo, smoke, a light pool), never for objects.
- **Surfaces.** Edges are the dark tone of the thing's own ramp, no ink outline. Light from the upper left.
  Every surface has wear. A larger surface gets more detail per unit, not the same detail stretched.
- **Layers.** A scene is a stack of layers: `img` (one speed), `tile` (wraps and drifts: clouds), `frames`
  (animated), `rows` (each row its own speed: water, the floor, depth slices of decks and awnings). The game
  draws the same stack from baked image files (`docs/api/canal.md`).

## The grammar (fixed for every level; each rule was a defect the user rejected)

1. **The walk band makes sense as a place.** Its borders (kerbs, lawn edges, path edges, material changes) are
   straight lines or square corners. Nothing bends around an object. A lane, a path or a track starts and ends
   at a reason (a threshold, a square, a bridge, the section's edge), never as a stub.
2. **Nothing stands in the hero's way but play.** Between the borders of the walk band stand only traffic, the
   hitbox objects of the game and what belongs to a square. Lamps, trees, benches, flags and planters stand
   beside it.
3. **Feet on one ground.** Each thing stands fully on one surface. Its base never straddles a border, a joint
   between materials or a water edge. Its shade falls on the floor under it.
4. **Rows tile.** On one plane, every front of a row is painted inside its own slot: no front hides part of a
   neighbour. Lay a row out in plane coordinates: positions shrink with s, painted widths do not.
5. **Solid things are closed.** No sky or floor shows through or under a wall, a bridge or a deck. A span covers
   the gap only; walls and water close the rest.
6. **One perspective.** A thing that spans depths (a deck, a ramp, an awning, a bridge) is built from depth
   slices or planes that meet without gaps or double edges at every camera position. Depth that runs away from
   the viewer (a side street, a side canal) is drawn in true perspective and turns with the camera.
7. **A set piece reads at one glance** and works like the real thing. A person who knows such a place finds no
   nonsense in it (a bridge that could open, a door a person fits through, a sign that points somewhere).
8. **Play sits on its art.** Every platform, ledge, deck and counter of the game lies on a painted surface.
   Every entity that stands on or in scenery has its carrier at that spot: a perch has its lamp cap, a window
   figure its window, a vendor its hatch, a hanging secret its beam.
9. **A rule of a place is a gate.** What the user says about a place ("no red light above the ground floor",
   "street posts on kerbstones only") becomes a check in that section's `checks(sec)`, with a number.
10. **One fault, every section.** A fault found in one section is measured in all of them before it is fixed.

## The look sheet (one per place; part of the spec, §6)

Fill it in Phase 2, from the level card. Amsterdam's is `canal-look.md` §3 with the level 1 numbers of
`briefs/2-scale-pass.md` and `briefs/3-street-audit.md`.

```
Place:            <what the player must recognise>
Hours:            per section: hour, weather, season; key (dark, light, amount, desat); air (dark, light);
                  the key hue; the nearest approved hour (canal-look.md §3.2) and what differs
Planes:           far to near: layer id, speed, what it holds, air amount
Lines:            y of the far foot, the far edge, the water or ground line; the floor's back edge
Scale:            px per storey, ground floor, window and house width on each building plane (the scale rule)
Building grammar: what a front is made of here: storeys, roof forms, doors, windows, shops, signs, lettering
Materials:        each new ramp (name, OKLCH values), the wall, roof, ground and plant materials
Ground grammar:   the surfaces of the walk band and its borders, what stands where, the furniture of this place
Beside the band:  water (canal, river, still mirror, sea), a wall, a drop, fields: how it is drawn
Emitters:         lamps, lit rooms, signs, fire; light on surfaces and in air; reflections
Motion:           what moves and how fast
Set pieces:       one per section
Local things:     five or more per section
Rules of the place: each as a gate with a number
Not in this place: what the user ruled out
```

## The look sample (Phase 2)

One scene of the new level, painted for real, so the user approves the look before a spec is written.

1. Pick the section that tests the look hardest: the set piece, the strangest light or the newest material.
2. Build it in the kit on the stub layout (README, "A look sample without a mission"): every plane, the set
   piece, the ground, five local things, the hero standing in it for scale.
3. Where the level card left a choice of light or mood open, paint two or three variants of key and air of the
   same scene. A variant is cheap; a wrong hour found after six sections is not.
4. Run the kit's gates at tiers 1, 2 and 4. Open every frame with the Read tool, beside the nearest frame of
   `docs/design/canal-look/ref/`: it must not look emptier, flatter or noisier than that reference.
5. Show the user: a private artifact page with the frames at 4× (the kit's page export gives a scrolling
   view), the variants side by side, and the look sheet's main lines in words. Ask for the choice with
   `AskUserQuestion`, each variant an option.

Done when the user picked a variant and approved the look in their own words, the look sheet is filled, and both
are recorded in the level card's decisions.

## Paint a section (Phase 5)

The steps, the files an agent owns and the "done when" are in `briefs/1-paint-section.md` (the brief level 1 was
painted from). What that brief did not yet know is in the grammar above and in `briefs/2-scale-pass.md`,
`3-street-audit.md` and `6-fix-one-fault.md`: give a painter the grammar from the start, so those passes are not
needed again.

Gates of a painted section (`tools/levelkit/README.md` lists the command and each gate's meaning): all colours
on the 5-bit grid; the key hue share; darkest tone and light range by plane; colours in a frame; no hole at the
far line; art under every platform line; the scale rule per building plane; the ground grammar gates; fronts
tile with 0 px overlap; each entity carrier in place; each rule of the place.

## Defects the user has rejected

`canal-look.md` §6, plus, from level 1: houses too small beside the hero; a bent bike path and kerbs that bulge
around objects; lamp posts that stand in the street; a drawbridge that could not work; house fronts that overlap
their neighbours; scenery art that drops in detail after a change.
