# SWAN-3 "Metal Swan" as a ridden mount — levels

> **Status:** design proposal, 2026-10-09. **Owner:** levels (mission layout).
> **Scope:** where the ridden `swan` is used, the re-laid sections `m1-c` River Run and `m3-a`
> Yodel Valley, one optional new appearance (`m3-c`), the set pieces, and every place in
> `docs/GAME_DESIGN.md` (the GDD) that depends on the old swan.
> **Inputs:** the user's request (a ridden "Metal Swan" in the role of the reference game's
> ostrich mount: fast, very high jumps, an aimable gun), `feel.md` and `look.md` in this folder,
> GDD §8 and §11, `docs/ORIGINALITY.md`, research §14 and §23.
> **Edits:** this file only. The orchestrator copies the replacement texts into the GDD.
> **Status (review, 2026-10-09):** applied to the GDD. The review fixes are listed in
> `decisions.md` ("Review fixes"); the sections they touch are updated below. Where this file and
> the GDD still differ (for example the old §2 replacement texts), the GDD wins. The float line is
> 16 px (decisions #6), so the low-corner reach from the water is 78.7 − 16 = 62.7 px, not the
> 48.7 px (30 px float line) used in some checks below: every such margin grows by 14 px.

**Units.** px, ticks (60 per second), px/tick, px/tick². y grows downward. `@X` = the camera's
left edge reaches world x X (GDD conventions). "Nominal" = the current `feel.md` numbers.
"Engine" values in [brackets] come from a tick-by-tick simulation with the engine's
semi-implicit Euler step (`vy += g`, then `y += vy`); they are 3–4 % lower than the formulas.

---

## 0. Decisions at a glance

| Topic | Decision |
|---|---|
| Design band | Every coordinate in this file works from −15 % to +15 % of the targets: top speed 2.04–2.76 px/tick, apex 81.6–110.4 px, glide extra 51–115 px. Margins are shown for each check. |
| `m1-c` River Run | Same river and on-foot path. New: a stomp tutorial (DRUM LINE), a tank hurdle, a regatta **slipway** to leap from, a judges' box with a glide trail, a BOAT HOP, the Mk1 stomp gag, a **TIMPANI MINEFIELD** before the boss, and an arena wall for THE ENCORE. |
| `m3-a` Yodel Valley | Same village, chalets and pond. The second half is new: a long piste with moguls, a chasing avalanche, a low **kicker** (lip at y 190) so the swan's huge jump stays on screen, a landing valley with K-lines. |
| AVALANCHE fix | A pursuit rule replaces the fixed 1.0 px/tick: it holds the left edge of the view at any player speed (front 104–125 px behind the players), but it gains on a player only at 1.0 px/tick and only while that player is slower. Nobody who keeps moving is caught; a player who stops is caught after 89–113 ticks. |
| SKI JUMP fix | Take off from the kicker. On foot: land past the blue K-line (x 2420). Riding: open the wings and land past the red K-line (x 2540, the foot of the climb; review fix F9). No hit in the air. The red line needs the tuning floor (the 8.2 values or more). |
| One addition | **SHE TOOK THE LIFT:** a swan that survives `m3-a` waits at the summit in `m3-c` and can be ridden into THE WINDBAG fight. |
| Originality | No glide over a broken bridge: the reference game's ostrich route crosses one (research §19, §23.6). Our glide beats use a slipway, a judges' box, a minefield and a ski kicker. |

---

## 1. Numbers used, and the tolerance band

### 1.1 Inputs

| Quantity | Task target | Band (±15 %) | Nominal (`feel.md`) | Note |
|---|---|---|---|---|
| Top speed | 2.4 px/tick | 2.04–2.76 | 2.6 | inside the band |
| Jump apex | ≈ 96 px | 81.6–110.4 | 96.7 [93.8] | gravity 0.18, vy −5.9 |
| Glide extra distance | 60–100 px | 51–115 | +95 on a full-speed jump | 169 → 264 px |
| Swim speed | — | 1.7–2.3 (±15 % of nominal) | 2.0 | |
| Gravity | — | 0.153–0.207 (±15 % of nominal) | 0.18 | used for the band corners |
| Float line | — | 16 px (`feel.md`) or 30 px (`look.md`) under the surface | 16 | the two docs disagree; the levels work for both |

The **low corner** combines speed 2.04, apex 81.6 and gravity 0.207 (the shortest, lowest jump).
The **high corner** combines 2.76, 110.4 and 0.153 (the longest, highest jump). If a check
passes at both corners it passes for any final numbers inside the band.

### 1.2 Derived numbers

Formulas: apex h = v0² / 2g; air time T = 2·v0 / g; length L = s·T.

| Quantity | Target (2.4 / 96) | Nominal (`feel.md`) | Low corner | High corner | On foot |
|---|---|---|---|---|---|
| Apex from the ground [engine] | 96 [93.1] | 96.7 [93.8] | 81.6 [78.7] | 110.4 [107.5] | 47 [45.4] |
| Air time on flat ground | 65.3 [65] | 65.6 [65] | 56.2 [56] | 76.0 [76] | 54 [53] |
| Jump length at top speed | 157 [156] | 170 [169] | 115 [114] | 210 [210] | 108 [106] |
| With a full glide | [251] | 264 | 114 + 51 = 165 | 210 + 115 = 325 | — |
| Feet above the water surface at the apex (float line 16 / 30) | 77 / 63 | 77.8 / 63.8 | 62.7 / **48.7** | 91.5 / 77.5 | — |
| Jump length from water (swim speed × T) | 130 | 130 | 95 | 175 | — |
| STOMP bounce (vy −3.4): ticks; length at 2.0 / at top speed | 37; 74 / 89 | 37; 74 / 96 | 32; 54 / 65 | 44; 101 / 121 | — |
| Crossing the 384 px view | 160 | 148 | 188 | 139 | 256 |
| Space ahead of her hurtbox at full speed (camera lead 38) | 202 px = 84 ticks | 202 px = 78 ticks | 204 px = 100 ticks | 201 px = 73 ticks | 217 px = 145 ticks |

Space ahead: the camera trails a target that moves at speed s by 4s px (smoothing 0.2), so her
anchor sits at view x 192 − 38 + 4s (164 at 2.6). Her hurtbox front is 18 px ahead of the anchor.
Space = 384 − (154 + 4s) − 18. With the requested swan camera lead of 64 (`feel.md` §11) she sits
26 px further left and every "space ahead" value grows by 26 px.

### 1.3 Level rules for swan sections

These rules follow from the table. Both re-laid sections obey them.

1. **Reach.** A surface the swan must reach in one jump is at most 70 px above her take-off on
   land (low corner 78.7 → 8.7 px margin) and at most 40 px above the water surface from the
   water (low corner with the 30 px float line: 48.7 → 8.7 px margin).
2. **No pits.** Swan sections have no pits. Every gap she can fall into is water, which is safe
   for her. A "glide gap" is optional: falling short costs time or a reward, never a life.
3. **Headroom.** Sections are 216 px tall and never scroll up. Her rider's head is 66 px above
   her feet. A full jump from y 176 lifts the head to y 16 (nominal) and y 2 (high corner)
   [engine]: in view at every corner. Her main line therefore stays at y ≥ 176 (ground
   y 176, water float line y 196, kicker lip y 190). Jetties (y 168) and islands (y 172) cost at
   most 17 ticks off-screen at the high corner. Higher surfaces (roofs, the judges' box) are
   allowed, but a full jump from them lifts her top half out of the view for a while (table 1.4).
   Nothing she must hit or collect is placed above y 24.
4. **Tells.** Every attack keeps its GDD telegraph (at least 18 ticks). Moving threats must be in
   view for at least 14 ticks before they can hit a swan at 2.76 px/tick. Static hazards come into
   view at least 73 ticks before she reaches them (table 1.2).
5. **No blind jumps.** At take-off the landing point is in view: a full-speed jump lands 114–210 px
   ahead, and her anchor sits at view x 162–165, so the landing is at view x ≤ 375 (< 384). The
   glide is chosen at the apex; from there the landing is at most 220 px ahead (view x ≤ 385 at the
   high corner with lead 38, ≤ 359 with lead 64), and it scrolls into view during the glide.
6. **On foot always works.** Every section keeps an on-foot path with no gap wider than 48 px
   (on-foot jump 106 px) and no step higher than 32 px (on-foot apex 45 px). The swan can be lost
   at any time.

### 1.4 Headroom table (ticks with the top of the swan above the view)

| Take-off surface | Rider's head off-screen (nominal / low / high) | Hull top off-screen | Where |
|---|---|---|---|
| y 176 (ground), y 190 (kicker lip), y 196 (float line) | 0 / 0 / 0 | 0 | main line |
| y 172 (islands) | 0 / 0 / 8 | 0 | `m1-c` |
| y 168 (jetties) | 0 / 0 / 17 | 0 | `m1-c` |
| y 136 (`m3-c` hut roof) | 32 / 18 / 44 | 13 / 0 / 30 | `m3-c` |
| y 120 (chalet roof 1, `m3-c` station roof) | 42 / 31 / 52 | 30 / 14 / 42 | `m3-a`, `m3-c` |
| y 116 (judges' box) | 44 / 34 / 54 | 32 / 18 / 44 | `m1-c` (made for a run-off glide, which stays in view) |
| y 110 (chalet roof 2) | 47 / 36 / 58 | 36 / 24 / 48 | `m3-a` |

These raised surfaces are optional. A HUD request (§7.1, GDD 13.7; required since the review): a
small swan-head marker at the top edge while her hull or rider is above the view.

---

## 2. GDD dependencies (task 1)

Line numbers are those of `docs/GAME_DESIGN.md` on 2026-10-09 (3006 lines). "Owner" names the
document whose final numbers win. "Only with §5" = needed only if the orchestrator adopts the
`m3-c` addition.

### 2.1 Story and overview

| # | Lines | Now | Change (exact replacement text) | Owner |
|---|---|---|---|---|
| D1 | 63–65 (1.1) | "that bites, on foot and in the **SWAN-3**: a walking, swimming, honking tank on two long legs, the third prototype of the "Metal Swan" programme. (Mk1 sank. Mk2 flew south for the winter and never came back.)" | "that bites, on foot and on the back of the **SWAN-3**: a robot swan that sprints, leaps, glides, swims and honks, with a machine gun in her beak. She is the third prototype of the "Metal Swan" programme. (Mk1 sank. Mk2 flew south for the winter and never came back.)" | levels |
| D2 | 97 (1.4 table, m3 row) | Vehicle cell "SWAN-3 (`a`)" | "SWAN-3 (`a`; `c` if she survives `a`)" (only with §5) | levels |
| D3 | 105–106 (1.4) | "- Vehicle sections: `m1-c`, `m2-b` (…), `m3-a`, `m4-b`, `m5-a` (horizontal shoot-em-up flight)." | "- Vehicle sections: `m1-c`, `m2-b` (and optionally `m2-c1`/`m2-c2`/`m2-d`), `m3-a` (and `m3-c` when a swan survives `m3-a`), `m4-b`, `m5-a` (horizontal shoot-em-up flight)." (the `m3-c` part only with §5) | levels |
| D4 | 119 (1.5 rule 5) | "m2 adds hidden creatures, a fast vehicle and the first mini-boss" | "m2 adds hidden creatures, a heavy vehicle and the first mini-boss" (the swan, 2.6, is now faster than the van, 2.4) | levels |
| D5 | 193 (2.4, m5 briefing) | `GRAMPS SAYS THE SWAN CAN FLY NOW. ...SINCE WHEN, GRAMPS?` | No change. The walker glides but never gains height (`feel.md` §5.3), so the joke still works. | — |
| D6 | 197–199, 206, 214 (2.5, 2.6) | Mk1, Mk2, accounting, splashdown | No change. The glide gets its own `DON'T TELL ACCOUNTING.` line in the new `m1-c` start row. | — |
| D7 | 313–318 (3.6) | "…`bored`, `mount`, `portrait`) plus Helium Head variants…" | "…`bored`, `mount`, `portrait`), the eight Swan rider strips `char/<id>/ride-sit`, `ride-lean`, `ride-up`, `ride-hold`, `ride-brace`, `ride-skid`, `ride-ears`, `ride-cheer` (`look.md` §6.3), plus Helium Head variants…" | look |

### 2.2 Rules, controls, shells

| # | Lines | Now | Change (exact replacement text) | Owner |
|---|---|---|---|---|
| D8 | 331 (4.1 up) | "aim up (turret/neck)" | "aim up (turret; the Swan's neck: up −90°, up + forward −45°, up + back −135°)" | feel §7.1 |
| D9 | 332 (4.1 down) | "crouch (Swan) / aim down where possible" | "crouch (the Swan: crouch on the ground, duck in water, aim forward-down +45° in the air) / aim down where possible" | feel §7.1 |
| D10 | 334 (4.1 jump) | "hop" | "hop (the Swan: a full jump; hold jump while she falls to glide)" | feel §5.1 |
| D11 | 335 (4.1 down + jump) | "**eject**" | "**eject** (the Swan: on the ground or in water only)" | feel §9.1 |
| D12 | 362 (4.2 deep water) | "the Swan floats" | "the Swan floats and swims (8.2)" | levels |
| D13 | 454–455 (4.9) | "A player can stand on the top of a Swan or the Bandwagon stage (moving one-way platforms)." | "A player can stand on a Swan's tail perch or on the Bandwagon stage (moving one-way platforms)." | feel §10 |
| D14 | 619 (6.3 swan row) | Behaviour "fired from the beak along the neck angle, speed 4.0, gravity 0.06; explodes on contact or terrain" | add at the end: "; the shell adds the Swan's horizontal speed (×1)" | feel §7.5 |

### 2.3 Vehicles (§8)

| # | Lines | Now | Change (exact replacement text) | Owner |
|---|---|---|---|---|
| D15 | 718 (8.1 Enter) | "land on the vehicle's hatch zone (its top 16 px) while falling." | "land on the vehicle's hatch zone (its top 16 px; on the Swan, the seat on her back) while falling." | look §13.6 |
| D16 | 723–724 (8.1) | "The pilot's head and shoulders show in the cockpit (rig `mount` pose)." | "The pilot's head and shoulders show in the cockpit (rig `mount` pose). A Swan rider sits on her back and shows from the hips up (`ride-*` strips, `look.md` §6); a shot that touches the rider costs the Swan cells like any other hit." | feel §2, look §6 |
| D17 | 736–737 (8.1 Eject) | "Eject: down + jump. …can be re-entered." | add: "The Swan ejects only on the ground or in water; in the air a jump press is her glide." | feel §9.1 |
| D18 | 738–741 (8.1 Ram) | "…The vehicle is lost." | add: "Exception: the Swan's SWAN DIVE costs her one cell, not the whole Swan (8.2)." | feel §9.2 |
| D19 | 751 (8.1 Bonuses) | "(possible in m1 and m2)" | "(possible in m1, m2 and m3)" (only with §5) | levels |
| D20 | 753 (8.2 heading) | "### 8.2 `swan` — SWAN-3 "Metal Swan" walker" | "### 8.2 `swan` — SWAN-3 "Metal Swan" (ridden)" | levels |
| D21 | 757–770 (8.2 table) | the walker: canopy, walk 1.3, hop 39 px, 5 neck angles, swim 1.0, ram 3.0, hull-top co-op | replace the whole table with §2.6 below | feel, look, levels |
| D22 | 809–810 (8.5 Look, Size) | "…two small jet nozzles under the wings (…). P2 flies **the Mute**…" · "72×40; hurtbox 28×14" | Look: insert before "P2 flies": "The rider sits astride the open seat as on the walker (`look.md` §14): `ride-lean` in flight, `ride-hold` on a dive bomb, `ride-ears` on the HONK." · Size: "72×58 with the rider (the hull 72×40); hurtbox 28×14 (the hull only: shoot-em-up fairness)" | look §14 |
| D23 | 825 (8.6 swan row) | Sections "m1-c, m3-a"; Main gun "beak gun (aimed neck)"; Ram "3.0 / 192" | Sections "m1-c, m3-a (m3-c if she survives)"; Main gun "beak gun (180° neck arc)"; Ram "3.4 / 192 (costs 1 cell)"; the other cells stay | feel §9.2, levels |

### 2.4 Enemies, props, bosses

| # | Lines | Now | Change (exact replacement text) | Owner |
|---|---|---|---|---|
| D24 | 1208–1211 (9.4 Golden Goose) | Mk2 with a Legion pilot "in the cockpit" | No change: Mk2 keeps its canopy (`look.md` §16.8). Optional: Gramps' bubble gets a second line `MK2 HAD A CANOPY. IT FOGGED UP.` (it explains the open seat of Mk3). | look |
| D25 | 1269 (9.5 `willow-tree`) | "…becomes a solid bridge 160×12 (m1-c); crushes what it lands on" | "…becomes a solid bridge 160×12 (m1-c); crushes the enemies it lands on; a player or a swan under it is pushed out to the nearest side, unhurt" | levels |
| D26 | 1270 (9.5 `avalanche`) | "moves right at its speed; its leading 24 px are a `kill` zone; swallows enemies (…)" | "chases (m3-a): every tick its front moves by clamp(target − front, `speed`, `maxSpeed`) px, where target = min(view left + `holdX`, the rearmost living player's x − `gap`); its leading 24 px are a `kill` zone; swallows enemies (a hat pops out, +200 SET PIECE each); at `stopX` it stops and its kill zone switches off" | levels §4.3 |
| D27 | 1326–1328 (10.1 arena) | "The Swan can swim anywhere." | "The Swan can swim anywhere left of the bow: an invisible wall at x 2844 (y 0–216) stands from the boss entrance to the death sequence, so nothing swims, jumps or glides under or onto the boat." | levels §3.4 |
| D28 | after 1425 (10.3 Windbag, Parts bullet) | — | new bullet (only with §5): "**Riding a Swan** (`m3-c`): the Gust pushes her like a player (she still makes 2.0 px/tick into it); she crouches under the Pendulum Gondola (her crouched top is 20 px; the gondola passes 24 px above the ground); her stomp never hits the airship; Leak Dash contact is a big hit." | levels §5 |

### 2.5 Missions, audio, UI, scoring, indexes, revision notes

| # | Lines | Now | Change (exact replacement text) | Owner |
|---|---|---|---|---|
| D29 | 1657–1659 (11.0) | "`hatch` …, `sign` (text decor), `mk1-head` (m1-c), `organ-distant` (…)" | add after `mk1-head` (m1-c): "`drum-mine` (m1-c, 11.1)," | levels §3.2 |
| D30 | 1765–1796 (11.1 `m1-c`) | the old River Run | replace with §3.2 | levels |
| D31 | 1935–1937 (11.3 runtime need) | "an `ice` flag on ground ranges (…) (drawn with an `ice` decor sheet over the snow)." | add: "Also: the avalanche pursuit rule (9.5, `m3-a`) and a record of the swans that end `m3-a` in one piece (`{variant, cells, shells}`), read by `m3-c`." (the record only with §5) | levels |
| D32 | 1939–1969 (11.3 `m3-a`) | the old Yodel Valley | replace with §4.2 | levels |
| D33 | 2029–2031, 2038 (11.3 `m3-c`) | terrain; start row | only with §5: the texts in §5.2 | levels |
| D34 | 2336–2343 (12.1 vehicles) | `swan/step`, `swan/paddle`, `swan/fire`, `swan/honk`, `swan/squeak` | add the new ids of `feel.md` §12 (`swan/jump`, `swan/land`, `swan/skid`, `swan/flap`, `swan/glide`, `swan/tired`, `swan/fold`, `swan/stomp`, `swan/splash`, `swan/hiss`, `swan/dazed`, `swan/migrate`). The levels add no sound: the drum-mine uses `explosion/m` + `hit/drum`; the summit cabin uses `env/train-bell`. | feel §12 |
| D35 | 2497–2499 (13.3 title scene) | "The SWAN-3 glides across the water from left to right at 0.25 px/tick, its legs paddling like mad under the surface." | "The SWAN-3 glides across the water from left to right at 0.25 px/tick with Captain Grace sitting perfectly still on her back (`ride-sit`, scarf lifting in the breeze), while the legs paddle like mad under the surface." | look §16.6 |
| D36 | 2511 (13.3 HOW TO PLAY) | "`JUMP   JUMP` ·" | "`JUMP   JUMP` · `HOLD JUMP   GLIDE (SWAN)` ·" (9 lines; the last one at y 136) | levels |
| D37 | 2574 (13.7 callouts) | "…`STYLE POINTS 9.5! +2000`, …" | add `DRUM ROLL! +1000` | levels |
| D38 | 2710 (14.2) | "STYLE POINTS 9.5! (clean ski-jump landing, m3-a)" / points "+2,000" | "STYLE POINTS 9.5! (the m3-a ski jump: on foot past the blue K-line; riding, with the wings opened, past the red K-line; no hit in the air)" / points "+2,000", and a new row "DRUM ROLL! (a player's shot or blast sets off the whole 5-mine barrage of the m1-c minefield in one chain)" / points "+1,000" | levels |
| D39 | 2716 (14.3) | "`crate` broken · `breakable-wall` · `helium-tank` · `rolling-drum`" / points "100 each" | "`crate` broken · `breakable-wall` · `helium-tank` · `rolling-drum` · `drum-mine`" / points "100 each" | levels |
| D40 | 2825–2827 (15.4) | "`avalanche` (param `speed`, `stopX`)" · "Mission-local: `hatch`, `sign`, `mk1-head` (m1), `organ-distant` (m5)" | "`avalanche` (params `speed`, `maxSpeed`, `holdX`, `gap`, `stopX`)" · "Mission-local: `hatch`, `sign`, `mk1-head` and `drum-mine` (m1), `organ-distant` (m5)" | levels |
| D41 | 2864, 2868 (15.6) | `char/<id>/…` row; `vehicle/<id>/…` row | `char/<id>/…`: add "the Swan rider strips `ride-<pose>`" · `vehicle/<id>/…`: add "the Swan's strips of `look.md` §9 (`idle`, `run`, `squat`, `jump`, `fall`, `flap`, `glide`, `land`, `skid`, `crouch`, `crouch-walk`, `swim`, `water-takeoff`, `honk`, `neck…`, `empty…`, `dive`, `wreck`)" · `prop/<id>`: `drum-mine` · `decor/<mission>/<id>`: the new decor of §7.1 | look §9 |
| D42 | 2889–2890 (15.7) | the swan sfx ids | add the ids of D34 | feel §12 |
| D43 | 2919–2934 (15.9) | requests 1–6 | add the requests of §7.1 to items 1 (art), 3 (mission runtime) and 5 (HUD) | levels |
| D44 | 2949–2950 (15.10 item 2) | "The SWAN-3 is a mechanical swan with an enclosed canopy, not a ridden animal." | "The SWAN-3 is a riveted robot swan ridden on her back (user request, 2026-10-09). She never reads as an armoured ostrich: no feathers, helmet, saddle rig, stirrups or flank gun; her gun is her beak (`look.md` §15)." | look §15 |
| D45 | 2985–2986 (16) | "- The SWAN-3 pilot sits under an enclosed canopy (never astride a bird). Panicking infantry…" | "- The SWAN-3 is now ridden on her back at the user's request (2026-10-09); this replaces the earlier canopy rule, and her look stays our own (`look.md` §15). Panicking infantry…" plus a new bullet: "- Swan mount (2026-10-09): 8.2 rewritten (`feel.md`, `look.md`); `m1-c` and `m3-a` re-laid; the avalanche chases; ski-jump K-lines; drum-mines; THE ENCORE arena wall (`docs/design/swan-mount/levels.md`)." | levels |

**Checked, no change:** 1.2 (line 76), 1.3 taglines, 3.2 socks (259), 3.4 Gramps (291, 303),
4.3 aim sweep (374), 4.5 invulnerability (409–410), 7.1 pickups, 12.3 `"SWAN-3, READY!"`,
13.5 Gramps line (2538), 13.7 HUD vehicle block (2566), 13.12 credits, 14.4 tally, 15.5, 15.8.

### 2.6 Replacement for the GDD 8.2 table (D21)

Numbers come from `feel.md` (2026-10-09). If the feel owner changes them, its values win; the
level geometry in §3 and §4 stays valid inside the band.

| Item | Value |
|---|---|
| Look | A riveted robot swan, ridden on her back (`look.md` §1–§5). A long, low, boat-shaped ivory hull (`snow`, `steel` shading, `gold` rivets) with a `navy` waterline stripe and a navy `3` on the rump; an upturned tail with a small navy rudder fin; big folded wing plates that stand up beside the seat (steel blades, navy tips); a thick neck of six ivory rings, always curved (lowered and forward on land, an S on water); a smooth ivory head with one lens eye and a navy face patch; a long `orange` beak that is the gun barrel; steel legs with a backward joint and pistons; big `orange` webbed paddles. The rider sits astride a quilted navy seat sunk into her back between the wing plates and holds two brass handles; only the hips up show. Never an armoured ostrich: no feathers, no helmet, no saddle rig or stirrups, no gun on the flank (`look.md` §15). P2's swan is "the Mute" (black neck and beak). |
| Size | About 80×64 at rest. Body 28×48 (crouched or parked 28×20). Hurtboxes: legs (−8, −28, 16, 28), hull (−22, −48, 40, 20), rider (−10, −66, 12, 18); crouched one box (−22, −20, 40, 20). The neck, head, wings and tail are never hurtboxes (`feel.md` §2). |
| Move | Run 2.6 px/tick (trot 1.5 after 6 ticks; full speed after 25 ticks and 45 px); a reverse above 1.6 px/tick is a 7-tick SKID; crouch-waddle 0.8; step-up 12 px. Jump: a 4-tick squat, then vy −5.9 with her own gravity 0.18 (apex ≈ 97 px, 65 ticks in the air, 169 px long at full speed; fixed height). GLIDE: hold jump while she falls; one glide per airtime, at most 60 ticks, fall ≤ 1.0 px/tick, speed ≤ 2.2 (a full-speed jump grows to ≈ 264 px). STOMP: landing on a soft enemy, a crate or a knifeable slow projectile while falling at ≥ 1.5 px/tick: 100 `crush`, bounce vy −3.4 (`feel.md` §3–§5). |
| Aim | The neck sweeps 180°: from +45° (forward-down, in the air) to −135° (up and back over the rider), 22.5° every 2 ticks. Up locks her facing and lets her back-pedal (`feel.md` §7). |
| Water | Floats on every `water` rect (feet 16 px under the surface) and swims at 2.0 px/tick, turning on the spot; down = duck (chest-high shots pass over); a jump from water starts after an 8-tick paddle-up (her feet reach ≈ 78 px above the surface); ground shockwaves miss her while she swims; the legs paddle like mad under the hull (the title-screen image) (`feel.md` §6). |
| Ice (m3) | Wears Mittens' knitted socks (red-and-cream striped feet). On ice she slides: brake and skid deceleration 0.05 px/tick², 67 px to stop from full speed. |
| HP cells | 3 |
| Main gun | (unchanged) |
| Heavy | **BEAK SHELL** (`swan-beak-shell`, 6.3), 10 shells; the shell adds her horizontal speed. |
| Special | (unchanged) and: "In the air she hangs still with spread wings for the 10-tick wind-up." |
| Ram | **SWAN DIVE**: the empty Swan hisses, then charges at 3.4 px/tick for up to 192 px with her wings beating. She tramples soft enemies (100 each) and BEAK-BASHES the first hard target, a wall or the end of her run (400 in r 40). It costs her 1 cell: she lands on her back, dazed, for 180 ticks, then rights herself and can be ridden again. With 1 cell left she migrates instead (flies off honking: lost). Refused in or over water (`feel.md` §9.2). |
| Empty gag | (unchanged) |
| Co-op | PERCH: her tail is a moving one-way platform (14×4) that a partner can stand on; it is off while she jumps (`feel.md` §10). |
| Appears | `m1-c` (parked at x 160; `[2P]` the Mute at x 112), `m3-a` (cargo parachute at x 200; `[2P]` the Mute at x 152) and `m3-c` when she survives `m3-a` (SHE TOOK THE LIFT, 11.3). |

---

## 3. `m1-c` River Run, re-laid (task 2)

### 3.1 What changes and why

The river and its on-foot path stay (they work and they are tested on paper). The old layout was
built for a 1.0 px/tick swimmer with a 39 px hop. The new one gives each strength a moment:

| Beat | Strength shown | Where |
|---|---|---|
| DRUM LINE (new) | stomp (the shields stop the beak gun from the front) | bank, x 380–560 |
| Tank hurdle | very high jump over a 44 px tank (a clean hurdle at the nominal numbers; at the low corner she lands on its hull) | bank, x 610–760 |
| SLIPWAY LEAP (new slipway) | speed + jump + shooting down at a rowboat | x 780–1014 |
| Judges' box (new) and glide trail | very high jump (56 px), then a glide to jetty 2 | island 1, x 1196–1403 |
| BOAT HOP | stomp chain from the water | lily pads, x 1572–1692 |
| Mk1 stomp gag | personality | x 1520 |
| TIMPANI MINEFIELD (new) | swimming and shooting at water level, chain explosions, the glide | x 2421–2535 |
| THE ENCORE | swimming; an arena wall stops her swimming under the boat | 2616–3000 |

### 3.2 Replacement text for GDD 11.1 `m1-c` (D30)

#### `m1-c` — River Run · 3000×216 · scroll right · checkpoints 900, 1900, 2616 · vehicles allowed: `swan`

- **Terrain:** riverbank `at(0,176).flat(780).slope(120,24)`: the bank, then the regatta
  **slipway** (780–900), which runs down into the water (y 200 at x 900). River: hazard `water`
  x 800–3000, y 180–216 (surface y 180; the slipway is under water from x 800, shallow enough to
  wade). An on-foot path with no gap wider than 48 px: lily pads (`lily-pad`, y 178) 924–948,
  1328–1352, 1530–1554, 1580–1604, 1630–1654, 1680–1704, 1730–1754, 1990–2014, 2040–2064,
  2330–2354, 2380–2404, 2560–2584; jetties (platforms `wood`, y 168) 980–1120, 1380–1500,
  1790–1960; islands (ground pieces, y 172) 1160–1300 and 2100–2300; on island 1 the **judges'
  box** (platforms `wood`): a ladder step 1196–1232 at y 144 and the box 1240–1296 at y 116; a
  `duck-float` at 2430–2530 (drift ±40); the boss pontoon (platform) 2616–2840 at y 176 and two
  floating crates (platforms 32 wide, bob ±4) at (2700, 150) and (2760, 136).
- **Background:** `sky-gradient {morning sky}` 0 · `clouds` 0.1 · `hills` 0.2 · `treeline {willows}`
  0.35 · `far-bank` *(custom: the far river bank with Puddlewick's church spire and a strip of
  cheering crowd)* 0.5 · `reeds` *(custom, front: true, along the bottom edge, offsetY 180)* 1.2.
- **Terrain style:** `mud / grass / wood / crate`.
- **Decor:** Swan Mk1's head sticks out of the water at x 1520 (`mk1-head`), a rusty lifebuoy
  stencilled `MK1` round its neck and river weed on its dome (no hat of any kind). A
  sign `NO DIVING` at the top of the slipway (x 772). The judges' box stands on stilts under a
  crimson-and-gold `JUDGES` banner, with three empty chairs. A Legion sign `DANGER: TIMPANI` at
  the right edge of island 2 (x 2288).
- **`drum-mine`** (mission-local): a floating Legion kettledrum mine: an upturned copper timpani
  bowl 20×12 with a crimson rim, gold studs and a brass spike on top. It bobs ±2 px (40-tick
  period) and never moves. 10 HP, team `enemy`, not knifeable, hurtbox 18×10 centred on y 178.
  It explodes (r 24, `explosion/m` + `hit/drum`) when a player or a swan touches it, when a
  player's shot or blast hits it, or 6 ticks after another mine's blast reaches it (a chain).
  The blast deals 100 to enemies and props inside it. It hurts players only when a player or a
  swan set it off by touch (on foot: death; a swan: a big hit); a mine set off by a player's shot
  or blast belongs to that player (no friendly fire), and a chain keeps the owner of the mine that
  started it. Enemy shots pass through mines. 100 points per mine.

| Trigger | Events |
|---|---|
| start | The `swan` sits parked at x 160, head tucked, with a note `SWAN-3. PLEASE RETURN BY 6 PM. -G.` (`[2P]` the Mute, `params.variant: 'mute'`, at x 112). When a player comes within 64 px: bubble from Gramps on the radio `BE GENTLE WITH HER!` (if Gramps is a player: `THERE SHE IS!`). The first time anyone mounts a swan in this mission: radio `SHE GLIDES NOW.` / `HOLD JUMP IN THE AIR.`, then `DON'T TELL ACCOUNTING.` |
| @0 | 3 `rifleman` walk from `R+16` (first targets for the Swan). |
| @100 | **DRUM LINE** from `R+16`: 3 `drummer` 36 px apart, marching left at 0.5 px/tick on the beat (`params.column: 'c1'`), with a `baton-major` keeping 60–120 px behind them. Kill the first drummer and the line stumbles for 60 ticks. Their drums soak up the beak gun from the front (`hit/drum`), but a stomp lands on the body (30 HP): one stomp each. If no drummer has been stomped 240 ticks after the first one entered the view, a `STOMP!` hint (the word and three gold chevrons pointing down) blinks over the front drummer. On foot: grenades, the knife or shots from behind. hostage `critic/chair @640 (M)`. |
| @360 | `oompah-tank` from `R+48` to stopX 720, `params.maxX: 744` (review fix F5: pushed back by a player within 160 px it would otherwise back down the slipway into the river): it parks on the bank in front of the slipway (a swan can leap it). `[N]` 2 `rifleman` walk in behind it from `R+16`. |
| @560 | **SLIPWAY LEAP:** a `rowboat` with 2 `rifleman` rows in from `R+48` to x 960 (crew at 948 and 972). 2 `bullfrog` hop out of the reeds onto the slipway @800 and @850. 1 `bullfrog` on the jetty @1090. |
| @700 | hostage `tourist/sack @1200 (auto)` on the island. `crate @1268 (H)` in the judges' box (y 116). **Glide trail:** 5 `golden-note` at (1333, 117), (1351, 124), (1368, 132), (1386, 140), (1403, 148): the line a swan glides from the box to jetty 2. |
| @900 | Checkpoint. `piano-bomber` crosses right to left at y 32 and drops 3 pianos near the nearest player; **on water the pianos float** as platforms for 600 ticks. |
| @1200 | **BOAT HOP:** 2 `rowboat` (4 `rifleman`) row in from `R+48` and `R+120` and stop over the lily pads at x 1596 and 1668 (each crew 12 px either side of its boat's centre). |
| @1300 | **Mk1 gag:** if Swan Mk1's head (`mk1-head` @1520, hurtbox 16×16) is hit 3 times, it surfaces, honks sadly and a `pickup-bombs` floats up. A swan's stomp on its dome counts as 3 hits, and then the two swans honk at each other (`swan/honk` at pitch 1.0, then 0.8). Once. |
| @1500 | **Tank barge:** an `oompah-tank` on a `tank-barge` floats left at 0.3 px/tick from `R+48`. **Willow:** a `willow-tree` stands at the end of the jetty @1940 (trunk 200 HP, red target ring); 2 `rowboat` (4 `rifleman`) wait in its fall zone at x 2000 and 2060. `oompah-trooper` on the jetty @1900. |
| @1700 | **Willow set piece:** a `SHOOT!` chevron appears over the willow after 180 ticks if nobody hits it. Broken, it falls right in 40 ticks (its shadow shows on the water) and becomes a solid bridge 160×12 at y 170 over x 1950–2110. It crushes the enemies under it (+200 SET PIECE each); a player or a swan under it is pushed out to the nearest side, unhurt. hostage `roadie/cage @2200 (T)` on a fishing post on island 2 (rope top y 100) — the tuba arrives just before a boss full of projectiles. `crate @2280 (bombs)` on island 2. |
| @1900 | Checkpoint. 3 `bullfrog` hop out @2014, @2150, @2200. 1 `rowboat` with 2 `rifleman`, placed now at x 2350 (crew at 2338 and 2362; out of view: the view's right edge is 2284), waiting over pad 2330–2354 in open water right of island 2 (review fix F4: from `R+48`, x 2332, it had to row through island 2). **TIMPANI MINEFIELD** (placed now, out of view): a barrage of 5 `drum-mine` at x 2430, 2454, 2478, 2502 and 2526 (centres, y 178; 24 px apart, so one blast sets off the next), all in the water under the duck-float's drift range. If a player's shot or blast starts a chain that sets off all 5: `DRUM ROLL!` +1,000 to that player. |
| @2300 | `[N]` `piano-bomber` crosses left to right. |
| @2616 | Checkpoint. `LOCK 2616–3000`. `crate @2640 (S)` on the pontoon. Boss `encore` (10.1) steams in from the right (300-tick entrance: horn toots, the far-bank crowd cheers). Music `boss`. An invisible wall at x 2844 (y 0–216) keeps players and swans out from under and off the boat until its death sequence. |
| boss dead | `MISSION COMPLETE!` → tally (13.11). |

Hostages in the section: 3 (critic, tourist, roadie), as before. Spawn rows place still props
(crates, notes, mines, the willow) before they come into view where possible.

### 3.3 Checks (with the band margins)

**On-foot path.** Unchanged except at the slipway, the judges' box (optional) and the minefield:

- From the wadeable foot of the slipway (x 900, y 200) to pad 924: 24 px across, 22 px up.
  An on-foot player's head stays above water on the slipway (the water there is at most 20 px
  deep; the hitbox is 30 px).
- Judges' box: island (y 172) → ladder step (y 144) → box (y 116): 28 + 28 px. On-foot apex 45 px:
  17 px margin each.
- Drum-mines float only under the duck-float's drift range (hurtboxes x 2421–2535, tops at
  y 171–175 with the bob). The nearest pad edges are 17 px (pad 2404) and 25 px (pad 2560) away,
  more than a player's half-width (7 px): standing at a pad's edge never touches a mine. A jump
  from pad 2404 reaches x 2421 after about 5 ticks, when the feet are already 16 px up (y 162),
  above the mine tops. A player on the duck (top y 159–165) stands at least 6 px above them.
  (A mine in a 26–30 px pad gap would touch a player standing at the pad's edge, so there are
  none.)

**Swan geometry.**

| Check | Need | Low corner | Nominal | High corner |
|---|---|---|---|---|
| Island top from the water (y 172) | 24 px up | reach 48.7: ✓ 24.7 | 77.8: ✓ | 91.5: ✓ |
| Judges' box from island 1 | 56 px up | reach 78.7: ✓ 22.7 | 93.8: ✓ 37.8 | 107.5: ✓ |
| Judges' box straight from the water | 64 px above the surface (80 above the float line) | low corner 78.7 from the float line: no | nominal 93.8: yes, 13.8 px | high: yes |
| Glide from the box (run off at x 1296, y 116) onto jetty 2 (1380–1500) | lands on the jetty | x 1392: ✓ 12 px in | x 1443: ✓ 63 px in | x 1447: ✓ |
| Same run-off without the wings | — | water at 1353 | water at 1374 | jetty edge 1382 |
| SLIPWAY LEAP: take-off window to stomp the boat crew (948–972) | inside the bank + wadeable slipway (x ≤ 880) | 830–880 ✓ | 771–849 ✓ | 740–808 ✓ |
| Tank hurdle (hull 688–752 top y 148, turret 708–732 top y 134) | clean take-off window | none: she lands on the hull top (safe, a standable solid) | 610–660 ✓ | 573–660 ✓ |
| Tank hurdle, tank pushed back to its leash (x 744: hull 712–776, turret 732–756) | clean take-off window | lands on the hull top (safe) | 634–684 ✓ [engine] | ✓ |
| Drummer stomp (top y 138) from a running jump | take off this far ahead | 98–102 px | 151–153 px | 188–193 px |
| BOAT HOP bounce, boat to boat (72 px) | bounce length at swim speed | 54: no chain (lands between) | 74: ✓ | 101: ✓ by steering back |
| Boss crate (2700, 150) from the water | 30 px above the surface | 48.7: ✓ 18.7 | ✓ | ✓ |
| Boss crate (2760, 136, bob ±4) from the water | 44–48 px | 48.7: 0.7–4.7 px (use the pontoon or the lower crate: 40 px from the pontoon, ✓ 38.7) | ✓ | ✓ |
| Minefield: shoot a lane | swim shot at 6 px above the surface (y 174) hits the mine hurtbox (y 173–183) | ✓ | ✓ | ✓ |
| Minefield: sprint jump + full glide from island 2 (x 2296) over the barrage (hurtboxes end at 2535; her body reaches 14 px back) | land past 2549 | x 2469: no (into the barrage; shoot instead) | x 2568: ✓ 19 | x 2597: ✓ 48 |
| Minefield: hop via the duck-float (top y 159–165) | 15–21 px above the surface | reach 48.7: ✓ 27.7 | ✓ | ✓ |

The robust answers in the minefield are the chain shot and a hop via the duck-float; the full
glide over it is a bonus at the nominal numbers and above. Every swan check that can fail at the
low corner fails safe: she lands in water or on a hull top, never in a pit.

**Tells against a 2.76 px/tick swan.**

| Threat | Tell (ticks) | Time in view before it can hit |
|---|---|---|
| Rifleman (bank, boats) | 18 (36 more if in a gag) | ≥ 18 after the tell starts in view |
| Drummer charge (within 72 px) | 30 | She passes or stomps him before the charge ends; the charge cannot reach her from behind |
| Oompah-tank shell / bass pulse | 45 / 24 | ✓ |
| Bullfrog croak / tongue | 40 / 20 | ✓ |
| Piano drop | 50 (shadow) | ✓; she moves 138 px in 50 ticks |
| Oompah-trooper | 36 | ✓ |
| Drum-mines (static) | — | in view ≥ 88 ticks before she swims into them (space 203 px at 2.3 px/tick) |
| THE ENCORE | 24–60 | ✓ (10.1) |

**Headroom.** Main line: bank y 176 (head at y 16 at the apex), float line y 196 (head at
y 36), jetties y 168 (head at y 8). Only the judges' box lifts her out of the view (§1.4), and it
is built for a run-off glide, which stays in view.

### 3.4 THE ENCORE arena (D27)

The pontoon (one-way, 2616–2840, y 176) covers the arena width left of the bow, and her view clamp
and the wall at x 2844 keep her over it. A swan that arrives swimming swims in front of it (it is
drawn behind actors, and her feet on the float line, y 196, stay under its top, y 176, so it never
blocks her from below) and ducks the high waves. Once she jumps she lands on the pontoon (vehicles
never drop through platforms) and fights from it for the rest of the fight. All attacks still read
for her:

- Foghorn: the low wave (y 160–176) hits her swimming hull (y 166–182): she jumps. The high wave
  (y 138–154) hits her swimming rider (y 148–166): she ducks (ducked hurtbox y 172–184). On the
  pontoon the on-foot rule holds: jump the low wave, crouch under the high one (crouched top 20 px,
  the wave starts 22 px above the deck).
- Paddle Wave and Slide Shot: jump or crouch as on foot. Barrels (16 px, knifeable): she stomps them.
- **Wall at x 2844.** The bow is at x 2848. A 97 px jump from the pontoon would carry her over the
  bow and onto the deck, next to the calliope. The wall stops that, and it also stops her
  swimming under the hull. The fight stays the same for swans and for players on foot.

---

## 4. `m3-a` Yodel Valley, re-laid (task 2)

### 4.1 What changes and why

- **Kept:** the parachute drop with the knitted socks, the village, the chalets, the frozen pond
  and its skating parade, the base camp, both exits and the cliff goodbye.
- **The pond** shrinks from 1400–1900 to 1340–1700, so the chase gets a longer piste.
- **The piste** (1700–2290): a gentle downhill with three moguls (8–10 px, she strides over them
  with her 12 px step-up) and one boulder to hurdle (review fix F2 removed a second one).
- **The kicker:** the old ramp rose to y 120. From there a 97 px jump would lift the swan's top
  half out of the view for about 40 ticks at the climax. The new kicker lip is low, at y 190, at
  the bottom of the valley: from it her rider's head peaks at y 30 (nominal) or y 16 (high
  corner), always in view.
- **The AVALANCHE** chases with the pursuit rule (§4.3) instead of crawling at 1.0 px/tick.
- **The SKI JUMP** scores against K-lines that work for every corner of the band (§4.4).

### 4.2 Replacement text for GDD 11.3 `m3-a` (D32)

#### `m3-a` — Yodel Valley · 3000×216 · scroll right · checkpoints 1300, 2300 · vehicles allowed: `swan`

- **Terrain:** `at(0,176)`, two snow bumps 12 px high at x 200–400 and 500–700, flat to 1700
  (the chalets and the frozen pond on it). **The piste**, a long gentle downhill with three moguls,
  through the ground points (1700,176) (1820,181) (1850,173) (1880,182) (1980,186) (2010,178)
  (2040,188) (2140,193) (2170,185) (2200,195) (2290,204). **The kicker** up to the lip (2330,190),
  a `step(14)` down to (2330,204), the flat **landing valley** at y 204 to 2540, a climb to
  (2620,176), flat base camp to 3000. The cliff at x 3000 is the section's right wall.
  Solids (`rock`): chalet 880–944 and chalet 1030–1094 (y 136–176) with roof platforms (`wood`)
  at y 120 (880–944) and y 110 (1030–1094). A third chalet at 1160–1240 is decor with its back
  door a `breakable-wall` (`solid: false`) at 1180–1204. A boulder on the piste: 1910–1958
  (y 162–186). (Review fix F2: a second boulder at 2232–2264, y 184–202, stood 14.2–17.4 px above
  the piste, over her 12 px step-up; sprint hurdles from x 2112–2212 landed at 2289–2386 [engine],
  mostly past the lip, so she skipped the kicker. It is gone.) **Ice range** 1340–1700 (the frozen
  pond).
  Cliff ladder steps (platforms `wood`): 2880–2930 y 140, 2900–2960 y 104.
- **Background:** `sky-gradient {cold blue sky[2] → pale peach horizon}` 0 · `ice-peaks {white and
  blue}` 0.1 · `clouds` 0.15 · `treeline {snowy pines}` 0.35 · `chalets` *(custom: wooden chalets
  with crimson banners)* 0.55.
- **Terrain style:** `snow / snow / wood / rock`.
- **Decor:** a Legion sign `PISTE CLOSED` at the top of the piste (x 1712); a blue K-line painted
  across the valley snow at x 2420 and a red one at x 2540 (the foot of the climb); a small judges' stand on the climb at
  x 2560 with three cardboard judges who hold up `9.5` cards after a STYLE landing.

| Trigger | Events |
|---|---|
| start | Card `MISSION 3`. The `swan` arrives by cargo parachute at x 200 wearing Mittens' knitted socks (`params.socks: true`; `[2P]` the Mute, also in socks, at x 152). Bubble: `MITTENS KNITTED HER SOCKS.` `crate @300 (M)`. |
| @0 | 3 `rifleman` (`outfit: snow`), entry `ski`, from `R+16` (each crashes into a snowbank first). |
| @250 | 4 `windup-bot` (variant `ski`) downhill from `R+16`. |
| @450 | 2 `cymbalist` from `R+16`. `triangle` @700, gag `counting`. `crate @620 (S)`. |
| @700 | 2 `ram-goat` on the chalet roofs @900 (y 120) and @1050 (y 110). (A swan lands on roof 1 with one jump, 56 px up, and stomps the goat on roof 2 from there.) |
| @900 | hostage `critic/chair @1100 (H)`. 2 `bassoonist` @1280, @1320 (they target the Swan). **Secret:** the chalet back door @1180 — broken, it reveals hostage `composer/chair @1200 (1up)`. |
| @1300 | Checkpoint. **Skating parade:** on the frozen pond a `baton-major` leads 4 `rifleman` skating in a line (entry `skate`); on alert they shoot while sliding. |
| @1460 | hostage `tourist/sack @1600 (auto)` on the ice. `crate @1934 (bombs)` on the first boulder (y 162). |
| @1600 | **AVALANCHE!** Rumble (`env/avalanche`), shake 2 px for 60 ticks, banner `AVALANCHE!`; then an `avalanche` (`speed: 1.0`, `maxSpeed: 3.0`, `holdX: 40`, `gap: 104`, `stopX: 2540`) rolls in at the left edge of the view (front at view x 8, and never closer than 104 px to a player) and **chases** (9.5): it holds the left part of the view at any player speed, but it gains on a player only at 1.0 px/tick and only while that player is slower. Anyone who keeps moving right (on foot 1.5 px/tick, a swan 2.0–2.8) is never caught; a player who stops is caught after about 90–110 ticks. It swallows enemies it touches (+200 SET PIECE each to the nearest player). Respawns land at least 160 px right of its front. When its front reaches x 2540 it smashes into the rock face at the foot of the base-camp climb (decor), shake 6 px, white flash 20 ticks, and stops: its kill zone switches off and a snow mound stays (decor). |
| @1660 | 3 `ram-goat` from `R+16`, 45 ticks apart (review fix F3: spawns at x 2060, 2177, 2294 behind a sprinting swan and 2060, 2128, 2195 on foot, all on the piste; at 90 ticks apart the third spawned at 2528, behind the kicker step): each trots in at 0.8 px/tick, paws for its full telegraph (T 40) and charges up the piste at 3 px/tick. A goat that misses runs on into the avalanche (+200 SET PIECE). |
| @1700 | 1 `baton-copter` (`mode: 'air'`) flies in from `R+16` at y 40 and crosses left over the piste at 1.2 px/tick (review fix F12). The swan shoots it up (−90°), then jumps and aims up and back (−135°) as it falls behind (in the air she keeps her forward drift). If it lives, the avalanche swallows it (+200 SET PIECE). |
| @1880 | 2 `bassoonist` in the landing valley @2450 and @2510 (y 204). `crate @2500 (bombs)`. **Glide trail:** 7 `golden-note` (`params.float: true`) at (2378, 110), (2404, 97), (2429, 95), (2451, 99), (2473, 108), (2495, 118), (2517, 128). |
| @2000 | **SKI JUMP:** take off from the kicker (x 2290–2330). On foot, land beyond the blue K-line (x 2420); riding a swan, open the wings in the air and land beyond the red K-line (x 2540); either way without taking a hit while airborne: `STYLE POINTS 9.5!` +2,000 (once per player); the cardboard judges raise their cards. |
| @2300 | Checkpoint. hostage `roadie/cage @2700 (F)`, hanging from a ski-lift pylon (rope top y 60). |
| @2616 | `LOCK 2616–3000`. **Base camp:** 5 `rifleman`, 2 `cymbalist`, 1 `baton-major` (from x 2992 and out of two tents at 2800 and 2900, entry `window`). `WAIT dead`. Signs `NORTH FACE ↑` (over the ladder) and `CAVES →` (over the cave mouth). `UNLOCK`. **The Swan can't climb** (review fix F8): after the `UNLOCK` a Swan-only body wall stands at x 2860; a ridden swan that touches it on the ground stops and her pilot is ejected, and in the air it only stops her (so she never reaches the ladder steps or the `b1` exit rect while ridden); no wall before the `UNLOCK`. Radio bubble `GRAMPS: "SHE DOESN'T DO CLIFFS. PARK HER."`; the Swan sits down and waves her head goodbye. (With §5: when the section ends, every swan still in one piece is recorded as `{variant, cells, shells}` for `m3-c`.) |
| exits | `b1`: rect (2930–2970, 40–100), the top of the rope ladder. `b2`: rect (2976–3000, 136–176), the cave mouth at the foot of the cliff. |

Hostages: 4 (critic, composer, tourist, roadie), as before.

### 4.3 The AVALANCHE pursuit rule (the speed fix)

**The old relation.** Avalanche 1.0, swan 1.3, on foot 1.5: a close race for the old walker. A
swan at 2.4–2.6 would leave a 1.0 px/tick avalanche behind at once, and a faster avalanche would
kill players on foot.

**The new rule.** Every tick:

```
target = min(view.left + holdX, rearmostLivingPlayer.x − gap)   // holdX 40, gap 104
front += clamp(target − front, speed, maxSpeed)                 // speed 1.0, maxSpeed 3.0
spawn:  front = min(view.left + 8, rearmostLivingPlayer.x − gap)
```

**Why it is fair (the math).**

1. It moves faster than 1.0 px/tick only while target − front > 1.0. The target is never closer
   than `gap` (104 px) to the rearmost player. So it can approach within 104 px of a player only at
   1.0 px/tick.
2. Inside 104 px it moves at exactly 1.0 px/tick. A player who moves right at s ≥ 1.0 opens or
   keeps the distance (s − 1.0 ≥ 0). On foot (1.5) and every swan in the band (2.04–2.76) are
   never caught while they move.
3. A player who stops is caught when the 24 px kill zone reaches the hitbox:
   (d − half width) / 1.0 ticks, where d is the distance when the player stopped.
4. In 2-player games a lagging partner on foot is the rearmost player, so the avalanche keeps
   104 px behind that partner, never the front player.

**Simulation** (camera smoothing 0.2; the swan with the current lead 38 and the requested lead 64):

| Player | Front in the view while running | Distance behind the player | Caught after stopping |
|---|---|---|---|
| On foot 1.5 | view x 40 | 120 px | 112 ticks |
| On foot, hopping 1.9 | view x 40 | 122 px | 113 ticks |
| Swan 2.04 (low), lead 38 / 64 | view x 40 / 32 | 122 / 104 px | 107 / 89 ticks |
| Swan 2.4 (target), lead 38 / 64 | view x 40 / 34 | 124 / 104 px | 107 / 89 ticks |
| Swan 2.6 (nominal), lead 38 / 64 | view x 40 / 34 | 124 / 104 px | 108 / 89 ticks |
| Swan 2.76 (high), lead 38 / 64 | view x 40 / 35 | 125 / 104 px | 109 / 92 ticks |

The front sits 32–40 px into the view: the player always sees the white wall and its powder. The
3.0 px/tick cap only matters in the first ticks after the spawn (it is above every swan speed in
the band, so the avalanche never falls behind the view). EASY and HARD use the same rule.

**Respawns** land at least 160 px right of the front (was 64): (160 − 7) / 1.0 = 153 ticks of slack
minus the 12-tick drop. **Stop:** front at x 2540, the foot of the climb.

**The chase in numbers.** It starts at @1600 (players at x ≈ 1760) and runs to the kicker lip
(x 2330): 570 px. A swan at 2.6 needs 220 ticks; on foot at 1.5, 380 ticks. On the way: 3 goats
(T 40 each), the boulder (21–23 px tall), the moguls and the baton-copter. On foot every goat can be
jumped (32 px tall; on-foot apex 45; the jump stays above 32 px for 29 ticks while the gap closes
at 4.5 px/tick, so 129 px pass under the player against the 50 px needed). Shooting a goat with
the pistol (80 HP, 64–80 ticks) costs 64–80 px of the 120 px lead, so jumping is the answer.

### 4.4 The SKI JUMP (the threshold fix)

**The old rule:** jump from the ramp top (x 2380–2400) and land beyond x 2470. A swan with a
169 px jump passes 2470 without trying, and from a ramp top at y 120 her top half leaves the
view for about 40 ticks.

**The new kicker:** lip at (2330, 190), landing valley at y 204, K-lines in the snow.

| Take-off at the lip (2330, 190) | Lands at x | Rule | Margin |
|---|---|---|---|
| On foot, run-up (air speed 2.0) | 2444 | blue K 2420 | +24 |
| On foot, standing jump | 2432 | blue K 2420 | +12 |
| Swan without wings: low / target / nominal / high | 2450 / 2493 / 2507 / 2545 | no STYLE (wings not opened) | — |
| Swan, nominal [engine]: a 1-tick flap / a 20-tick glide (forward held after it; 28 ticks with no input) | 2513 / 2541 | red K 2540 | −27 / +1 |
| Swan, `feel.md` full glide: low / nominal / high | 2546 / 2589–2595 / 2614 | red K 2540 | +6 / +49–55 / +74 |

- **Review fix F9: the red K-line moved from x 2480 to x 2540**, the foot of the climb. At x 2480
  it tested no distance at the nominal numbers: every jump from the lip lands past it (no wings
  2507). At x 2540 a jump with no wings misses by 33 px and a real glide (20 ticks or more with
  forward held) passes. The wings rule stays. The line assumes the tuning floor (GDD 15.9 item 7:
  the 8.2 values or more); at the low corner only a near-full glide passes it (2546).
- An early take-off (x 2310, on the kicker slope at y 197) lands about 20 px shorter. Take-off at
  the lip is the skill.
- **Headroom:** from y 190 the rider's head peaks at y 30 [nominal] and y 16 [high corner].
- **Blind-jump check:** at take-off her anchor is at view x ≈ 164, so the view reaches x 2550:
  both K-lines and most of the valley are in view. The glide is chosen near the apex (x ≈ 2410),
  when the view reaches ≈ 2630, past every landing.
- **The bassoonists** in the valley (x 2450, 2510) fire straight rockets at her (T 40). She can
  shoot down at +45° in the air, HONK (in the air she hangs still for the 10-tick wind-up), or fold
  the wings over one and stomp him (40 HP); the stomp bounce refreshes the glide.
- **The glide trail** follows the nominal glide arc. At the low corner her body (48 px tall) still
  sweeps the first five notes; the last two are a reward for longer glides. The notes have
  `params.float: true` (GDD 7.1): with gravity they would fall to the valley floor.

### 4.5 Other checks

| Check | Need | Low corner | Nominal | High corner |
|---|---|---|---|---|
| Roof 1 (y 120) / roof 2 (y 110) from the ground | 56 / 66 px | 78.7: ✓ 22.7 / 12.7 | ✓ | ✓ |
| Stomp the goat on roof 1 from the ground (goat top y 88) | feet above y 88 | reach y 97: no (land on roof 1 first) | y 82: ✓ 6 px | y 69: ✓ |
| Stomp the goat on roof 2 from roof 1 (goat top y 78) | feet above y 78 | y 41: ✓ | y 26: ✓ | y 13: ✓ |
| Moguls | walkable, ≤ 12 px | 8–10 px over 30 px: she strides over them | ✓ | ✓ |
| Boulder (21–23 px; the second boulder is gone, review fix F2) | hurdle | ✓ | ✓ | ✓ |
| Goats (32 px, charging at 3 px/tick) | hurdle or stomp | stays above 32 px for 42 ticks: 214 px of relative travel against 64 needed | ✓ | ✓ |
| Climb (2540 → 2620) | walkable | 28 px over 80 px (1:2.9) | ✓ | ✓ |
| Goat tell | ≥ 14 ticks in view | 40-tick paw; in view about 65 ticks before contact at 2.76 px/tick | ✓ | ✓ |

On foot: every step on the path is ≤ 24 px (boulder 1); the kicker step (14 px) is only met going
right (a drop); the chalet roofs are optional, as before.

---

## 5. Opportunity: one more place (task 3)

### 5.1 Options considered

| Option | Verdict | Why |
|---|---|---|
| The m1 boss arena through carry-over | already true | THE ENCORE is fought at the end of `m1-c` itself (LOCK 2616–3000), so she is already there. It only needs the arena wall (§3.4). |
| A swan route branch (a third exit in `m3-a`, a swan on the `m4-c2` rooftops or the `m2-c2` mesa) | no | It is a new section's worth of content. A 97 px jump plus a glide also flattens the on-foot platforming those routes are built on (gaps of 40–48 px, billboard tops at y 96), and the van and the Bandwagon own m2 and m4. |
| The vertical sections (`m3-b1`, `m3-b2`, `m5-b`) | no | Their ledges are 36 px apart; her jump is 97 px. The climbs would disappear. |
| The attract demo on `m1-c` | not now | It needs a bot that rides. Cheap to add later. |
| **The m3 summit (`m3-c`): SHE TOOK THE LIFT** | **yes** | below |

### 5.2 Recommended addition: SHE TOOK THE LIFT (`m3-c`)

**The idea.** At the cliff in `m3-a` the swan waves goodbye. When the players climb out at the
summit, she is already there. She came up on the cable car (the briefing says the Woodwinds took
the ski lift; she took it back). The players can ride her into THE WINDBAG fight.

**Why this one.**

1. A payoff: the goodbye at the cliff gets an answer. It also gives the avalanche run stakes:
   keep her alive and she meets you at the top.
2. Her 180° neck arc finally meets its best target: an airship overhead. (THE ENCORE sits at
   water level.)
3. m3 then follows rule 4 of GDD 1.5 (vehicle, then boss), like m1 and m2.
4. It is cheap: one decor sprite, one start row, one small runtime record. No new swan art and no
   new sound.
5. Players who lost her fight THE WINDBAG on foot, exactly as designed now.

**Rules.**

- **Record.** When `m3-a` ends, the mission runtime records every swan that is still in one
  piece (parked, empty or ridden; not destroyed, not migrated): `{variant, cells, shells}`, at
  most 2. `m3-c` reads the record at its start.
- **`m3-c` terrain (add):** "a cable-car cabin (decor `decor/m3/cable-car-cabin`, 64×40) at
  x 140–204 under the station cable, doors open".
- **`m3-c` start row (replace):** "Players climb out at (48, 176). **SHE TOOK THE LIFT:** for each
  swan recorded at the end of `m3-a`, a swan sits parked next to the cable-car cabin with the cells
  and shells she had, still in her socks: the first at x 120, the second (the Mute) at x 76.
  `env/train-bell` dings once; radio `GRAMPS: SHE TOOK THE LIFT.` (if Gramps is a player:
  `GOOD GIRL.`). With no record there is no swan and no bubble. 3 `rifleman` (`outfit: snow`)
  @240–320, one with gag `snowman` @300."
- **Header:** unchanged. Nothing carries into `m3-c` through an exit, so it needs no "vehicles
  allowed" entry.
- **Bonuses:** VEHICLE AT THE FINISH becomes possible in m3 (D19). NO SCRATCHES stays once per
  mission.

**Boss check (THE WINDBAG, 10.3) with a swan:**

| Attack | Swan answer | Numbers |
|---|---|---|
| A Gust | pushed like a player | 2.6 − 0.6 = 2.0 px/tick into the wind |
| B Drone Bolts (homing notes) | shoot them (neck up to −135°) or HONK (erases them) | 10 HP each |
| C Sheet-Music Mines | shoot them on the way down | ≥ 40 ticks in view |
| D Reel | jump the moving impact line when it reaches her | 65 ticks in the air; the line sweeps the arena in 60 |
| E Pendulum Gondola | crouch | gondola 24 px above the ground; her crouched top 20 px: 4 px margin |
| F Leak Dash | step off the dotted line | contact = big hit (1 cell) |
| Her stomp | never hits the airship | `feel.md` §4.5 |
| Raised spots | the hut roof (y 136) and the station roof (y 120) | a full jump from them lifts her rider's head out of the view for 32–42 ticks [nominal] (§1.4); she never needs to: her up-aimed beak reaches the airship from the ground |

No HP change. If the fight proves too easy, the reunion swan can arrive with at most 2 cells
("she had a rough ride") instead of her recorded cells.

**Cost.** Art: one decor cabin. Runtime: the record (D31). Text: one start row, one Gramps line.
Tests: the record survives the section change; `m3-c` without a record has no swan.

### 5.3 The m5 TRUMPETER stays consistent

- **Same machine:** the walker's glide uses the same wing plates the TRUMPETER opens in m5; the
  flush vents under her wing roots become the m5 jet nozzles (`look.md` §14).
- **Rider:** astride the open seat in flight too (D22); the hurtbox stays the hull only (28×14).
- **Story:** in m1 and m3 she glides but never gains height, and with §5 she takes the cable car
  up the mountain. So the m5 briefing `GRAMPS SAYS THE SWAN CAN FLY NOW. ...SINCE WHEN, GRAMPS?`
  still surprises.
- **P2:** the Mute in `m1-c` and `m3-a` (`params.variant: 'mute'`) matches the Mute TRUMPETER.
- **`m5-a` layout:** unchanged (auto-scroll 1.0, free flight 2.0).

---

## 6. Fun beats (task 4)

Five set pieces, all placed in the wave tables above.

### 6.1 DRUM LINE (`m1-c` @100, bank x ≈ 380–560): the stomp lesson

- **Beat.** Three drummers march at her behind their drum shields, with the officer behind. Her
  beak gun just booms off the drums. She leaps and lands on the first busby: a pancake, a bounce,
  and the next one.
- **Math.** From a running jump the stomp lands 98–193 px ahead of the take-off (band). The bounce
  (vy −3.4) lasts 37 ticks [nominal]. At full air speed it carries her 96 px, plus 18 px of the
  line marching into her (0.5 × 37): about 115 px down the line, over the other two drummers
  (36 and 72 px back). She lands behind them, and the officer (60–120 px further back, 100 HP)
  is her next stomp. To chain drummer to drummer she needs only 36 − 18 = 18 px of her own travel
  per bounce (0.5 px/tick). From a full-speed approach she cannot brake that much in the air
  (0.1 px/tick²: 34 px to stop from 2.6), so the chain is the reward for a slow, standing-jump
  approach (air speed ≤ 1.5). After 3 stomps without touching the ground she waggles her tail and
  honks (`feel.md` §12).
- **On foot:** grenades, the knife (it hits the body), or shots from behind.

### 6.2 SLIPWAY LEAP (`m1-c` @560, x 740–1014): fly off the regatta slipway

- **Beat.** Under the `NO DIVING` sign she sprints down the slipway and launches over the reeds.
  Tap jump: she comes down on the rowboat crew, a double stomp (the crew stand 24 px apart; her
  stomp box is 28 px wide), and the empty boat sinks under her. Hold jump: she glides high over
  the shallows and strafes the boat at +45° on the way down.
- **Math.** The take-off window for the stomp is 830–880 (low corner), 771–849 (nominal) and
  740–808 (high corner); the bank plus the wadeable slipway (x ≤ 880) holds every window. A glide
  from x 790 lands on the first jetty (y 168) at x ≈ 1044 (nominal) or 1076 (high corner); at the
  low corner it ends in the water at x ≈ 961, in front of the boat.
- **On foot:** wade down, hop to pad 924 and knife the crew from the pad.

### 6.3 TIMPANI MINEFIELD (`m1-c` @1900, x 2421–2535): the drum roll

- **Beat.** Five copper kettledrum mines bob on the water under the drifting rubber duck, just
  before the boss. From the water her beak fires 6 px above the surface: one shot at the first
  mine and the five go off one by one, 6 ticks apart: BOOM-BOOM-BOOM, `DRUM ROLL!` +1,000. Or she
  hops onto the duck and jumps on, or (nominal numbers) sprints off island 2 and glides over the
  whole barrage to land at x 2568.
- **Math.** Mines 24 px apart, blast r 24: each blast reaches the next mine. A swim shot at y 174
  hits the mine hurtbox (y 173–183). The full glide from x 2296 lands at 2469 / 2568 / 2597 (low /
  nominal / high); she is clear of the barrage past x 2549.
- **On foot:** pad 2404 → the duck → pad 2560, as before (the mines stay 17–25 px from the pad
  edges and at least 6 px below the duck's top); a grenade into the barrage also starts the chain
  and earns the DRUM ROLL.

### 6.4 AVALANCHE RUN (`m3-a` @1600, x 1760–2330): out-run the mountain

- **Beat.** The wall of snow roars at the left edge of the screen. She sprints down the piste at
  2.6 px/tick, strides over the moguls, hurdles the boulder, leaps or stomps three charging
  goats and shoots a baton-copter overhead, up and then up and back (−135°) from a jump. Every stop costs distance: after about 1.5–1.8 s standing still, the snow takes her.
  Goats that miss her run straight into the avalanche (+200 SET PIECE).
- **Math.** §4.3: the front holds view x 32–40, 104–125 px behind her; it gains only at
  1.0 px/tick. The run is 570 px: 220 ticks for the swan, 380 on foot.
- **On foot:** the same rule, 120 px of lead; jump the goats.

### 6.5 SKI JUMP (`m3-a` @2000, x 2290–2620): the glide finale

- **Beat.** At the bottom of the piste the kicker throws her up 97 px. She spreads the wing
  plates, collects the golden notes along the arc, shoots the two bassoonists below at +45° (or
  folds the wings and stomps one, which refreshes the glide), and touches down past the red
  K-line. The cardboard judges hold up 9.5. Behind her the avalanche smashes into the rock face.
- **Math.** §4.4: the red K-line (x 2540) needs a real glide (20 ticks or more with forward held;
  a full glide passes by 49–55 px [engine]); a jump with no wings lands 33 px short. Her head stays
  in view (y 16–30 at the apex).
- **On foot:** past the blue K-line (x 2420) from a run-up: +24 px.

Also in the wave tables: the tank hurdle, the judges' box glide trail, the BOAT HOP, the Mk1
stomp gag and the chalet "stomp staircase".

---

## 7. Requests and open conflicts

### 7.1 Requests to other owners (for GDD 15.9, D43)

- **Mission runtime:** the avalanche pursuit rule (params `speed`, `maxSpeed`, `holdX`, `gap`,
  `stopX`; respawns ≥ 160 px right of the front); the willow crushes only team `enemy` and pushes
  players and swans out of the trunk; an invisible body wall at x 2844 for the ENCORE fight (a
  clamp like the view edges, not a `SolidBox`, so it never stops shots: decisions #35); the
  Swan-only body wall at x 2860 in `m3-a` after the `UNLOCK` (review fix F8); with §5, the swan
  record from `m3-a` to `m3-c`, one entry per swan, `{ variant: 'ivory' | 'mute', cells, shells }`.
- **Props (m1 mission folder):** `drum-mine` (§3.2): bob, chain after 6 ticks, owner-based damage.
- **Art:** `prop/drum-mine` (2 frames), `decor/m1/sign-no-diving`, `decor/m1/judges-box` (stilts,
  banner, three chairs), `decor/m1/sign-timpani`, `decor/m3/sign-piste-closed`, `decor/m3/k-line-blue`,
  `decor/m3/k-line-red`, `decor/m3/judges-stand` (3 cardboard judges, a card-raise frame),
  `decor/m3/snow-mound`, and with §5 `decor/m3/cable-car-cabin`. The swan strips and the
  `ride-*` rider strips are already requested by `look.md`; the crouch needs the flat rider strip
  `ride-duck` (`look.md` §6.4; it replaces the `mount-duck` frame of `feel.md` §2), because the
  ENCORE high wave and the WINDBAG gondola depend on it.
- **HUD:** the `STOMP!` hint (the style of the willow's `SHOOT!` chevron); the `DRUM ROLL! +1000`
  callout; the swan-head marker at the top edge while her hull or rider is above the view (§1.4;
  required since review fix F9-offscreen-marker, GDD 13.7).
- **Camera** (`feel.md` §11): the view clamp of a driven vehicle already exists
  (`Vehicle.keepInView`); lead 64 and max speed 4 while a swan is ridden. The levels work with
  lead 38 and with lead 64.

### 7.2 Conflicts between `feel.md` and `look.md` that touch the levels

All three are closed: the float line is 16 px (decisions #6), the apex is 96.7 [93.8] with no cap
(#3, #42), and the crouched rider lies flat in `ride-duck` (#11, #42).

| Topic | `feel.md` | `look.md` | How the levels stay safe |
|---|---|---|---|
| Float line | feet 16 px under the surface | 30 px under | Reach checks from water use 30 px at the low corner (48.7 px); every must-reach surface is ≤ 40 px above the surface. |
| Apex | 96.7 [93.8] | cap ≈ 85–88 on standard ground | Main line at y ≥ 176 (ground 176, kicker lip 190, float line 196). Both values work. |
| Crouch height | hurtbox top 20 px, rider lies flat (`mount-duck`) | crouch pose keeps the rider seated (head at 52 px) | Gameplay uses the 20 px hurtbox; the art must show the flat rider, or the gondola and the high foghorn wave look like they pass through her. |

---

## 8. Originality check

- **The reference ostrich route** crosses a broken bridge, reached through a tunnel at a missile
  wall (research §19, §23.6). We build no bridge glide and no route like it. Our glide beats are a
  regatta slipway, a judges' box, a kettledrum minefield and a ski kicker.
- **Layouts** are our own: a river regatta and an alpine resort with a marching band. No set
  piece, boss or branch puzzle of the reference game is rebuilt.
- **Names** are new: DRUM LINE, SLIPWAY LEAP, BOAT HOP, TIMPANI MINEFIELD, `drum-mine`,
  `DRUM ROLL!`, AVALANCHE RUN, K-line (a generic ski-jumping term), SHE TOOK THE LIFT. No banned
  name from `docs/ORIGINALITY.md` or research §23 appears in this file.
- **The ride** is a genre mechanic (riding a creature or a creature-shaped robot). The expression
  is ours: a riveted robot swan that swims, glides, stomps and honks, with the gun in her beak
  (`look.md` §15).
- **Sound:** no new sound ids; existing synthesized ones only.
