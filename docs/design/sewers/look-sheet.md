# RATTENJONG MET DE RATTENITEMS — look sheet (Phase 2, draft 2026-11-11)

The look sheet of level `sewers` (`docs/design/level-guide/look.md`, "The look sheet"). It becomes §6 of the spec.
Inputs: the approved level card `docs/design/sewers/brainstorm.md`; the canal look `docs/design/canal-look.md` for
the street; the look sample of the sewer (section d) for the sewer. Numbers marked *sample* come from the look
sample and wait for the user's choice of variant.

```
Place:            De Wallen at night in the rain (a, b): Amsterdam canal quays, alleys, the church square;
                  then the brick sewer under it (c, d, e): vaults, a channel, walkways, grates, a hall under a canal.
Hours:            a 23:00 quay, rain, late October; key: red/pink neon on wet blue-black (nearest approved hour:
                  the De Wallen night of the canal study, canal-look.md §3.2; differs: rain, wet mirrors, no BAR/
                  CAFE/LIVE signs, red light on the ground floor only).
                  b 01:00 alleys and square, rain; the same neon, colder and darker in the alleys, one warm wall
                  lamp per alley.
                  c 01:30, d 02:30 sewer: variant V2 BLACK (user): ambient key dark (2,3,12), light (42,56,98),
                  amount .93, desat .30; air (8,12,26)-(40,50,80), far amount .30; water glow strength .90
                  (16,70,46)-(34,140,80)-(100,230,120); eyes (255,246,160)-(255,48,32)-(170,10,22). Grate shafts
                  faint cold white (214,222,236)-(82,92,118), strength .42 crown / .30 manhole, only a faint pink
                  inside the grate (user: "the red light coming from the sewer drain is too much"). Lit (the
                  flashlight) key (26,18,14)-(255,240,214) amount .24, air .10. Kit: tools/levelkit/missions/
                  sewers/mission.py (HOURS 'v2', 'v2l', EM_V2, LIGHTS_V2).
                  e 05:00 trash hall: green water glow below, cold grey light and water from the cracks above.
                  end 07:15 dawn after rain: cold pale pink and blue.
Planes:           street: as level 1 (sky, skyline, far rows, the canal, the floor, depth planes).
                  sewer: back wall and side tunnels (far), the far walkway, the channel (rows), the near walkway
                  (walk band), near arches/ribs that close the top (over the hero) — speeds: sample.
Lines:            walk line y 176 (both); the street's far foot and water line as level 1; sewer: sample.
Scale:            13 px per metre × s (the method). Street: as level 1 (storey 40, ground floor 54, window 14 on
                  the walk plane). Sewer: tunnel size in m and px per plane: sample.
Building grammar: street: the canal look's fronts (canal-look.md §3); windows of De Wallen: closed curtains, red
                  tubes, ground floor only; neon words our own and generic, never BAR, CAFE, LIVE.
                  sewer: round brick arches, side arches, side tunnels, pipe mouths, iron ladders, grates (sample).
Materials:        street: canal-look ramps. sewer: brick, mortar, slime, moss, grease (fatberg), iron, water
                  ramps (sample).
Ground grammar:   street: quay with a straight kerb, the canal beside it; alley cobbles with a central gutter;
                  the paved square. sewer: the near walkway (straight edges) beside the channel; nothing on the
                  walk band but play.
Beside the band:  street: the canal (mirror of the neon, rain rings). sewer: the channel of dark water with a
                  green glow; e: the hall floor of trash and water.
Emitters:         neon (red, pink), wall lamps, red window tubes (ground floor only); sewer: grate shafts
                  (pink/red neon and rain falling in), green water glow, red eyes, the heroes' flashlight cones.
Motion:           rain, canal rings, neon flicker, reflections, steam; sewer: water flow, drips, falling rain in
                  the shafts, floating lost things, blinking eyes; e: falling trash, leaking water.
Set pieces:       a GOUDEN GERRIT's white limo on a bridge · b the rat eruption on the square · c the fall down the
                  shaft · d the fatberg · e the trash throne under the cracking canal roof.
Local things:     a krul urinals, chained bikes on bridge rails, closed red-tube windows, neon puddles, a moored
                  boat under a tarp, umbrellas · b rattling grates, roller shutters, bins with cans, steam, a krul
                  · c rungs, pipes, rain through the grate, drips, moss, eyes · d fatbergs, lost things, eyes,
                  outfalls, ladders · e the trash mountain, Gerrit's gold chain, water jets, rats, lost things.
Rules of the place (gates): sex workers never shown (window figures: 0); red light only on the ground floor
                  (red tube pixels above the ground floor: 0); no lettering of real names; no blood colour on any
                  hit or rat; no sky in the sewer (sky pixels: 0); a grate shaft only under a grate; eyes only in a
                  carrier; arches and fronts tile (overlap 0 px); the church is backdrop only.
Not in this place: can collectors; drug use; the Metal Swan; handhavers; BAR/CAFE/LIVE signs.
```
