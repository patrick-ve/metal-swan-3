# SWAN-3 "Metal Swan" — ridden look and sprite contract

> **Owner:** art (vehicle look). **Date:** 2026-10-09. **Status:** design, ready to build.
> **Scope:** the look, sizes, palette, frames and named points of the ridden `swan` (GDD §8.2),
> the rider frames it needs, and the look of the flight mode `trumpeter` (GDD §8.5).
> **Works with:** `docs/design/swan-mount/feel.md` (movement, aim, combat and hurtboxes). The
> logic numbers come from that file. This file matches them. §13 lists every place where the art
> differs, with the math.
> **Replaces:** the "Look" and "Size" rows of GDD §8.2, and the rule "the pilot sits under an
> enclosed canopy, never astride a bird" (GDD §15.10 item 2 and §16). The user asked for a Metal
> Swan that is ridden like the reference game's ostrich mount. That request overrides the canopy
> rule.
> **Read first:** `docs/ORIGINALITY.md`, `docs/research/mechanics.md` §14 and §23,
> `docs/ART_GUIDE.md`, `docs/ARCHITECTURE.md` §6.1.
> **How the numbers were checked:** a throw-away mock-up (scratch files only, nothing in the
> repo) built with the project's own rig and paint kit (`renderHuman`, `shadeLayer`, `Composer`,
> `rivet`). Rider heights in §6 are measured from the rig. Leg joints and neck points come from the
> formulas in §5.

---

## 0. Decisions at a glance

| Topic | Decision |
|---|---|
| What it is | A riveted ivory **robot** swan built by Gramps: a long boat hull, a thick ringed neck, wing plates, an upturned bladed tail, steel legs with a backward joint, big orange webbed paddles. The beak is the gun. |
| Rider | Sits **astride** a low quilted seat pad on the deck, between the wing roots. Holds two brass handles. Shown from the hips up. The near wing plate hides the legs. |
| Size | Deck 48 px above the ground (1.33 humans). Rider's head top 68–72 px (about 1.9 humans). 77 px from the tail fin to the beak tip. |
| Legs | 28 px clear under the keel. Telescoping struts: 15 + 17 px (+3 px piston kick) on land, 9 + 10 px in water, stowed when she sits. One step = 24 px. |
| Neck | A separate sprite: 9 aim frames (+45° … −135°, 22.5° steps) in 4 postures (land, water, crouch, water duck), plus a relaxed S. On land the default is the lowered "hiss" pose: the beak gun at 24 px. |
| Rider frames | New character strips `char/<id>/ride-*` (9 strips, 14 frames, hip anchor) and a new `Player.drawRide()`. |
| Draw order | body → rider → front overlay (near wing) → neck → fx. |
| Variants | P2 "the Mute" (black neck, head and beak; grey wing tips). m3 knitted socks. |
| Budget | About 120 body frames, 70 front overlays and 110 neck frames per colour. All lazy. |

---

## 1. The idea

SWAN-3 is the third robot swan of Gramps' "Metal Swan" programme. Mk1 sank. Mk2 flew south and
came back as the Legion's Golden Goose. SWAN-3 is made of riveted ivory enamel plates. The rider
sits on her back the way a cygnet rides on its parent.

On land she is a fast, proud runner. Her neck is lowered forward like a charging goose. Her
paddles slap the ground and her wing plates flutter. On water she is the calm swan of the title
screen. Her neck stands in an S, the rider sits still, and her legs paddle like mad under the
surface.

**"Calm on top. Furious underneath."**

She has a personality. She looks back at her rider. She hisses before a charge. She honks. She
lays a nervous egg when she is left alone. She gets dizzy when she crashes.

---

## 2. Signatures and silhouette

Five signatures. Every frame keeps at least four of them.

1. **Boat hull.** Long and low (about 2.4 : 1). A flat deck, a full breast, a flat keel and a short
   upturned tail of three blades with a navy rudder fin. A navy waterline stripe runs along it.
2. **The ringed neck.** Thick at the base, six ivory rings on a steel hose. It is always curved.
   On land it is lowered forward. On water it is an S. For back aims it telescopes.
3. **Wing plates.** The far wing stands in a low arch behind the rider, like a swan's raised-wing
   display. The near wing lies flush on the flank and hides the rider's legs. Navy tips.
4. **Webbed paddles.** Big orange feet. They spread flat on contact and fold shut when they lift.
5. **Machine honesty.** Rivets, panel seams, a navy collar at the neck base, pistons in the legs,
   a lens eye with a shutter lid. A robot, never an animal in armour.

**Never:** plumage or soft feathers on her body (her only feathers are the stiff, stamped
`fx/tin-feather` plates of her cues, §16 item 5), a helmet, visor, goggles, crest or plume on the
head, a control stick, lever or panel on her head or neck (she is steered by the two handles on
the deck, §15.3), a saddle frame, straps, stirrups, reins or a saddle blanket, any gun barrel or
gun pod on the body, a thin straight upright neck, thin bare legs, two-toed feet, a gold or yellow
body.

**Black-fill test.** Fill one frame with one colour. It must read as a swan: a long low hull, a
thick curved neck, an upturned tail. It must not read as an ostrich: a small round body high on
long legs, a thin straight neck, a small head on top. Run the test on `idle` f0, `run` f2,
`swim` f0 and `glide` f0.

---

## 3. Proportions and size

### 3.1 Coordinates

Body space for every frame: x points forward (sprites face right), y points down. The origin
(0, 0) is the **feet anchor**: the bottom centre of the physics body (28 × 48, feel §2). A frame
stands on line y = 0, so its lowest pixel row is y −1. The swan is not symmetric, so every
generator returns `{ buf, ox, oy, pts }` with (ox, oy) on body (0, 0). Never use the default
`'feet'` anchor of `defineSprite` (that is the buffer centre).

All numbers are for the rest pose (`idle` f0) unless noted.

### 3.2 Parts

| Part | Where (body px) | Notes |
|---|---|---|
| Hull | x −27..21, y −48..−28 | polygon in §5.1. The deck is flat at y −48 from x −26 to 12. The keel is flat at y −28 from x −14 to 13 |
| Perch deck | x −26..−12 at y −48 | flat and clear of wings and tail: the co-op PERCH (feel §10) |
| Seat pad | x −11..1, y −50..−49 | quilted navy pad on the deck |
| Handles | grips at (5, −53) near and (6, −53) far | brass stalks rise from the deck at x 4 and 6 |
| Neck socket (`neck`) | (16, −45) | navy collar 9 × 5, two gold rivets |
| Tail | root (−26, −46), blade tips (−34, −56), (−35, −53), (−34, −50) | rudder fin 4 × 6, tip at (−36, −59) |
| Near wing, folded | x −31..13, y −48..−38 | flush on the flank, front layer |
| Far wing, folded | arch behind the rider, top y −53 at x −16..−8, tips (−33, −46) | back layer |
| Hip bearings | near (−4, −31), far (−6, −32) | steel discs, r 3 |
| Legs | 15 + 17 px (+3 piston) | backward joint at rest: (−12, −18) |
| Paddles | 11 px long, 3 px thick with the outline | soles on y −1 |
| Head | dome 9 × 8 | lens eye, navy face patch, orange beak 8 px |
| Rider hip (`seat`) | (−4, −48) | see §6 |

**Whole sprite at rest** (neck at 0°): x −37 (rudder fin) .. +40 (muzzle) = **77 px wide**.
y −59 (fin tip) .. −1 = 59 px tall without a rider, **68–72 px with a rider**.

### 3.3 Vertical ruler (rest pose)

```
 y −72  Mittens' bobble hat (rider head tops: Gramps −68, Grace −70, Pip −70, Mittens −72)
 y −59  rudder fin tip (x −36)
 y −53  far-wing arch top (x −16..−8)                      handle grips (x 5..6)
 y −50  seat pad top (x −11..1)
 y −48  deck: perch x −26..−12 | seat pad | deck to x 12    rider hip (`seat`) (−4, −48)
 y −45  neck socket (16, −45), navy collar
 y −48..−38  near wing, flush on the flank (x −31..13)
 y −39..−35  bow number "3" (x 16..18)       jet vents (7, −37), (11, −37)
 y −34..−33  navy waterline stripe (x −23..20)
 y −31  hip bearing (−4, −31)
 y −28  keel (x −14..13)
 y −24  beak gun at 0°: head centre (28, −24), muzzle (40, −24)
 y −18  backward joint at rest (−12, −18)
 y  −4  foot joints; paddles 11 px long; soles on y −1
 y   0  ground
```

### 3.4 Heights against a 36 px human

| Point | Height above the ground | In human heights |
|---|---|---|
| Keel (belly) | 28 px | 0.78 (a soldier's chest) |
| Deck = rider's hip | 48 px | 1.33 |
| Rider's head top | Gramps 68, Grace 70, Pip 70, Mittens 72 (bobble hat) | 1.9–2.0 |
| Beak gun at 0° | 24 px | 0.67 |
| Beak tip straight up (−90°) | 76 px | 2.1 |
| Highest beak tip (−112.5°, sweep only) | 81 px | 2.25 |

A standing soldier's head top (36 px) is 8 px above her keel and 12 px below her deck.

### 3.5 Pose heights

| Pose | Hull offset dy | Deck y | Seat (rider hip) | Rider head top | Notes |
|---|---|---|---|---|---|
| Stand, run, air | 0 (run bob −1..+2) | −48 | (−4, −48) | −68..−72 | |
| Crouch, waddle, slide | +28 | −20 | (−4, −16) | −23..−25 | keel on the ground; rider lies flat (`ride-duck`) |
| Swim | +18 | −30 | (−4, −30) | −50..−54 | waterline stripe on the surface (y −16) |
| Water duck | +26 | −22 | (−4, −22) | −33..−37 | rider hunches (`ride-hunch`) |
| Parked (empty) | +28 | −20 | (−4, −20) | — | keel on the ground, legs stowed |

### 3.6 Legs and the long stride

- **Telescoping struts.** Each leg is a drumstick (hip to joint) and a shank (joint to foot). The
  shank slides into a sleeve. The visible chrome rod shows how far it is out.

  | Mode | Drumstick + shank | Used in |
  |---|---|---|
  | L (land) | 15 + 17 px, + 0..3 px piston kick | stand, run, jump, fall, skid, honk |
  | M | 13 + 15 px | squat-like transitions: settle f0, paddle-up f2, rise f1 |
  | S | 11 + 12 px | settle f1, paddle-up f1 |
  | W (water) | 9 + 10 px | swim, paddle-up f0, `honk-swim` |
  | T (stowed) | 7 + 8 px, drawn behind the hull | crouch, waddle, slide, parked, water duck |

- **IK rule.** Solve each leg with two-bone IK from the hip bearing to the foot joint. The joint
  bends **backward**: it sits behind the hip-to-foot line (a bird's ankle). Check values: rest near
  joint (−12, −18); `run` f0 near joint (−4, −16) at a reach of 29.7 of 32 px; `run` f4 far joint
  (−2, −18) at 31.5 of 32 px; `run` f5 near joint (−19, −26) (the swing fold).
- **Stride.** In `run`, the planted foot moves back **6 px per frame**: +8 → +2 → −4 → −10.
  One step (4 frames) = **24 px**. One cycle (8 frames) = 48 px, the length of the hull.
- At rest the hips are 27 px above the soles, so the legs stand in a soft Z.

### 3.7 Readability at 384 × 216

- With a rider she is about 77 × 72 px: 20 % of the view width and 33 % of its height. Keep big,
  simple shapes. Rivets and seams are 1 px and never break the silhouette.
- **m3 snow** is the hard case: the hull uses the same `snow` ramp as the snow ground. The INK
  outline, the 2 px darker band along the keel, the navy stripe, the navy wing tips and the red
  socks carry her. Check `idle` and `run` at 1× over the m3 snow terrain.
- The rider must stay visible in every ridden frame. No wing and no neck part covers the rider
  above the hip line (§5.3, §11.3).
- Shot heights: the 0° beak gun fires 24 px above the ground. It hits standing infantry (boxes
  0–28 px) and the drummer's drum.

---

## 4. Palette

Only `PAL` ramps (ART_GUIDE §1). Ramps run dark → light.

| Part | Ramp | Interior | Lit edge | Shadow edge | Lines / deepest |
|---|---|---|---|---|---|
| Hull, wing plates, neck rings, head dome ("ivory enamel") | `snow` | `snow[2]` | `snow[3]` (white) | `snow[1]` | `snow[0]`: seams; the 2 px keel band uses `snow[1]` |
| Waterline stripe, wing-tip bands, neck collar, rudder fin, bow "3", jet vents | `navy` | `navy[1]` | `navy[2]` | `navy[0]` | `ink[1]` |
| Seat pad (quilted) | `navy` | `navy[1]` | quilting dots `navy[2]` | `navy[0]` | — |
| Rivets | `gold` | — | dot `gold[3]` | shadow pixel `gold[0]` | the kit's `rivet()` |
| Legs, pistons, hip discs, beak nail, neck hose, blade edges | `steel` | `steel[2]` | `steel[3]`; piston rod `steel[4]` | `steel[1]` | `steel[0]` |
| Handle stalks, joint bolts, hip bolts, beak breech ring | `gold` | `gold[2]` | `gold[3]` | `gold[1]` | `gold[0]` |
| Handle grips | `black` | `black[2]` | `black[3]` | `black[1]` | `ink[0]` |
| Beak, paddles | `orange` | `orange[2]` | `orange[3]` | `orange[1]` | `orange[0]`: toe ridges |
| Eye lens | gold ring, 2 × 2 white, 1 ink pupil pixel, 1 white glint | | | | |
| Face patch (eye to beak base) | `navy[0]` | | | | `ink[1]` edge |
| Parts under the water line | steel → `navy`; orange → `teal`; hull → `sky[1]`/`sky[2]` | | | | outline `navy[0]`, not INK |
| Foam, bow wave, wake | `snow[3]`, `sky[3]` | | | | |

- **Gold is an accent only** (rivets, handles, bolts). The body is never gold or yellow: the gold
  swan is the enemy Golden Goose, and a yellow riding bird belongs to another franchise (§15).
- Riders keep their own palettes. Grace (navy jacket, ivory beret and scarf), Mittens (red
  sweater), Pip (gold vest, steel helmet) and Gramps (rust boiler suit) all read against ivory.

---

## 5. Parts and how to draw them

Use the existing toolkit only: `PixelBuffer` (`poly`, `taper`, `thickLine`, `ellipse`, `circle`,
`roundRect`), `shadeLayer`, `despeckle`, `Composer` (`paint.ts`) and `rivet`, `plate`, `hull`,
`damage` (`machines.ts`). No engine or kit change is needed.

Write a small swan rig in the vehicle's art module (suggested:
`src/game/content/vehicles/swan.art.ts`), on the model of `humanoid.ts`:

- `SwanStyle`: colour variant (`ivory` | `mute`) and `socks`.
- `SwanPose`: hull offset (dx, dy) and tilt, near and far foot targets with foot states, leg mode,
  near and far wing poses, tail lift, breast bulge, neck mode (separate, baked, or none).

Draw each part as a shaded layer and stack the layers with the `Composer`, so internal lines use
the darkest shade of the part behind. **Rotate vertices for tilt, never pixels.** The tilt pivot
is the `hull` point (−3, −38). Positive tilt = nose down. Every hull-attached point (seat, neck,
handles, hips, smoke, perch, wake) uses the same transform as the art, so art and points never
drift apart.

### 5.1 Hull

- **Polygon** (rest), clockwise from the deck's rear end: (−26, −48) · (12, −48) shoulder ·
  (15, −47) · (18, −45) neck root · (20, −41) · (21, −36) breast front · (20, −32) · (17, −29) ·
  (13, −28) keel front · (−14, −28) keel rear · (−19, −30) · (−23, −34) stern at the waterline ·
  (−26, −40) · (−27, −45) stern top.
- **Shading:** `shadeLayer(snow)`, then a 2 px band of `snow[1]` along the keel and the lower
  breast, so the hull has weight.
- **Details:** two panel seams (`snow[0]`, 1 px): one across the breast at x 15 (y −44..−30), one
  behind the seat pad at x −14 (y −47..−30). Gold rivets every 5 px on a line 3 px above the keel
  (y −31). Three gold rivets on the seat pad's front rim.
- **Waterline stripe:** y −34..−33, from the stern to the breast, `navy`. It is the waterline when
  she swims (§13.2).
- **Bow number "3":** a 3 × 5 navy stencil on the breast at x 16..18, y −39..−35, like the number
  on a boat's bow.
- **Jet vents** (a hint of the TRUMPETER): two flush round vents, 3 × 3 navy rings with a dark
  centre, at (7, −37) and (11, −37), under the wing root. Flush rings only. Never tubes, so nothing
  on the flank looks like a gun.
- **Smoke vent:** a 3 × 1 steel grille on the rump deck at x −21..−19, y −49. Damage smoke rises
  from the `smoke` point above it.
- **Honk bulge:** in `honk` frames the three breast vertices (20, −41), (21, −36), (20, −32) move
  forward by the "breast" value of the frame table (1–2 px).

### 5.2 Seat pad and handles

- The **seat pad** is a low quilted navy cushion on the deck, x −11..1, y −50..−49. It is part of
  the hull plating. No frame, no straps, no stirrups, no horn, no blanket.
- The pad's **near rim** (1 px) is drawn again in the front overlay (§7), so it hides the rider's
  hips.
- **Handles:** two brass stalks rise from the deck at x 4 (near) and x 6 (far), from y −48 to
  y −51. Each carries a 2 × 3 black grip; the grip centres are (5, −53) and (6, −53). The far one
  is one shade darker. Optional: a 1 px steel rod from the handle base to the neck collar, to show
  that the handles steer the neck. The rod ends at the collar on the deck: no stick, lever, panel
  or rod ever sits on her head or neck (§2, §15.3).
- **Folded handles:** in crouch, waddle and slide frames the stalks fold forward flat on the deck.
  The grips then sit at (8, −47) and (9, −47) in rest coordinates. The silhouette stays low.

### 5.3 Wings

Each wing has an **arm plate** (rounded ivory plate, three gold rivets along its top edge), **three
secondary blades** and **four primary blades** (ivory with `steel[3]` edges and navy tips: the last
3 px). The shoulder joint is hull-attached at (12, −46). Extended wings measure 40–46 px from the
shoulder to the tip. The far wing is one shade darker (`shift: −1`) and is always in the back
layer.

| Wing pose | Near wing tip | Far wing tip | Near wing layer | Use |
|---|---|---|---|---|
| `FOLD` | (−31, −43); flush, top edge at the deck line | arch top −53 at x −16..−8, tip (−33, −46) | front | rest, run, swim |
| `LIFT n` | `FOLD` with the rear half (x < −14) raised n px | arch raised n px | front | breathing, run inertia, landing |
| `HALF` | rear half raised, tip (−34, −52) | (−30, −62) | front | squat, jump, fall, stomp, honk start |
| `UP` | (−12, −84), raised behind the rider | (−20, −86) | back | flap up-beat, paddle-up, migrate |
| `MID` | (−40, −46), straight back | (−30, −72) | front | flap, migrate |
| `DOWN` | (−20, −14), swept down in front of the legs | (−36, −56) | front | flap down-beat |
| `SPREAD` | (−40, −34), low and back | (−26, −80), up and back | front | glide |
| `BRAKE` | (2, −76), raised forward-up as an air brake | (−6, −78) | back | skid |
| `BUSK` | (−24, −68), arched over the rider like a hood | (−28, −72) | back | honk wind-up, hiss |
| `BLAST` | (−30, −74), fanned wide | (−8, −88) | back | honk release, bash |
| `FLAT` | top edge −48 at x ≤ −6, sloping to −40 at x ≥ 2 (rest coordinates) | arch top −50 | front | crouch, waddle, slide |
| `LIMP` | (−24, −26), hanging | (−34, −44) | front | wreck, dazed |

**Cover rule.** In the front layer, inside the rider's x span (x −13..9), the near wing's top edge
stays at or below the deck line (y −48 at rest). Any pose that would rise higher draws the near
wing in the back layer, behind the rider. `FLAT` drops the front of the near wing so that the
ducked rider's face shows (§6.1).

### 5.4 Tail

Three short ivory blades rise back and up from the tail root to the tips in §3.2, with a navy
rudder fin (4 × 6) at the top blade. The "tail" column of the frame tables gives the lift of the
tip in px (+ = up). The fin wags 1 px in `run` and `swim`. The tail never covers the perch deck
(x −26..−12).

### 5.5 Legs and paddles

- **Hip bearing:** a steel disc (r 3) with a gold bolt (r 1), drawn on the lower hull side. Only
  the near one shows.
- **Drumstick:** `taper` 5 → 4 px, `steel`. **Joint:** a gold-capped bolt (r 2). **Shank:** a steel
  cylinder 4 px wide with a 2 px `steel[4]` rod that shows the piston (0..+3 px).
- **Foot joint:** on top of the paddle at the heel. The paddle reaches 2 px behind the joint and
  9 px ahead of it.
- The far leg is one shade darker and drawn behind the hull. The near leg is drawn in front of the
  hull. In mode T both legs are drawn behind the hull; only the near paddle's toe tips (4 × 2 px)
  show under the breast.

| Foot state | Shape |
|---|---|
| `S` | spread: paddle 11 px long, flat sole, three toe ridges (`orange[0]`), tiny claw pixels (`steel[1]`) at the toe tips |
| `S↑` / `S↑20` | spread with the toes up 15° / 20° (heel strike, skid) |
| `P` | push: on the toe tips, heel up 25° |
| `H` | half-folded: 8 px long |
| `F` | folded: 6 px long, toes down 40° (the web closes when the foot lifts) |
| `…w` | the same shape drawn under water (§5.8) |

### 5.6 Neck

- Six rings placed along a cubic Bézier from the socket (P0 = (0, 0)) to the head centre (P3).
  Control points per pose: §11.3.
- Ring thickness from the base: 7, 7, 6, 6, 5, 5 px. Draw each ring as a short `thickLine`
  between curve samples, shade it with `snow`, and add a 1 px `steel[3]` joint line across each
  ring boundary.
- The rings sit on a flexible steel hose (`steel[1]`). The hose shows 1 px on the inside of the
  curve. When the neck is longer than 24 px, the rings spread apart and the hose shows between
  them: **the neck telescopes**. This is a machine trait that no bird has (§15).
- The navy collar (9 × 5, two gold rivets) belongs to the body frame. Each neck frame starts with
  its first ring sitting in the collar.
- **2× and 4× (UHD art, `vehicles/swan/hd-head.art.ts`):** the same six rings on the same Bézier
  (`neckParts`: ring ends and widths), each drawn as a collar of stamped tin feathers: a lit
  enamel cylinder whose base end breaks into pointed feather tips that lie over the ring before it
  (alternate rings half a feather apart, like plumage), each feather with a lit and a shaded side,
  a groove between feathers and, at 4×, a pressed quill. The hose is dark steel, corrugated at 4×,
  and still shows between spread rings (the telescope). The collar is a padded navy band with two
  gold studs. The Mute: black enamel with steel glints. Frames: `renderNeckFrameHd(spec, colour,
  d, lo)`, exactly the 1× frame's size, anchor and points.

### 5.7 Head, beak and eye

- **Dome:** an ellipse 9 × 8 centred on P3, `snow`.
- **Beak = the gun.** Let u be the unit vector of the aim angle. The beak is a polygon from
  P3 + 3u (half width 2) to P3 + 11u (half width 1), `orange`, with a 1 px gold breech ring across
  it at P3 + 4u. The last 2 px are the steel "nail" with one ink bore pixel.
  **Muzzle = P3 + 12u** (the first pixel past the tip, ART_GUIDE §1).
- **Face patch:** a small `navy[0]` wedge from the lower front of the eye to the beak base, like the
  dark face skin of a real swan. Not a band around the head, not a visor.
- **Eye:** a 4 × 4 round lens (gold ring, 2 × 2 white, one ink pupil pixel, one white glint) on the
  upper half of the dome, 1 px toward the beak. A steel shutter lid (`steel[3]`) makes the
  expressions:

| Expression | Drawing | Used in |
|---|---|---|
| normal | pupil front-low | default |
| angry | the lid slants down toward the beak over the top row | firing, hiss, dive, honk wind-up |
| blink | the lid covers the lens, ink lash line | 6 ticks, every 150–210 ticks |
| half | the lid covers the top half | parked and sleepy |
| squint | an ink `>` in the lens, pointing back | hit (12 ticks) |
| happy | an ink `^` arc | greeting her rider, after laying the egg |
| wide | lens 5 × 5, pupil centred | surprise (egg, rise, wreck start) |
| dizzy | a 4 × 4 ink spiral | dazed, wreck |

- For aim angles past −90° the head turns to face backward. Draw it mirrored, so the eye stays on
  top and the beak points back.
- No helmet, no goggles, no crest, no plume, no knob on the beak. Head and neck stay smooth.

### 5.8 Under the water line

In `swim`, `settle`, `paddle-up`, `water-duck` and `honk-swim` frames the surface line is y −16
(the float line is 16 px under the surface, feel §6.1). Every pixel below that line is under water:

- Legs, paddles and the bottom 6 px of the hull use the water colours of §4.
- Outline the under-water layer with `navy[0]`, not INK. Outline it on its own, then blit it under
  the finished (INK-outlined) parts above the line.
- Add a 1 px Bayer smear on the trailing edge of moving legs (motion blur).
- Above the line: a 1 px foam line outside the hull, a 2–3 px bow wave at the breast and two wake
  dashes behind the stern. They alternate between two shapes per frame.

This reads as "under water" with or without a front water layer in the mission. (No water painter
exists yet. If a mission later draws an opaque water layer in front of entities, the legs simply
disappear under it.)

---

## 6. The rider

### 6.1 Seat and visibility

- The rider's **hip (the pelvis pixel) sits on the `seat` point**: (−4, −48) at rest, on the seat
  pad. The rider is drawn as an **upper body only** (rig part `'upper'`, hip anchor), astride the
  pad. The near wing plate and the pad's near rim hide everything below the hip. The viewer reads
  his legs as tucked under the wing plates.
- Visible part: from the hip to the head top, 20–24 px (§6.2).
- **Hands:** both on the handle grips, except in `ride-ears` (both hands open on the ears) and
  `ride-cheer` (near fist raised), §6.4. Grip targets relative to the hip: near (+9, −5), far
  (+10, −5). In `ride-duck` the handles are folded: near (+12, −3), far (+13, −3).
- In crouch frames the rider slides 4 px down into the seat and lies flat (`ride-duck`). His head
  rests forward over her shoulder. The near wing uses `FLAT` there, so his face shows.

### 6.2 Measured rider heights

Measured from the rig with the four heroes' styles (GDD §3). Tops are px above the hip.

| Pose | Gramps (bald, goggles) | Grace (beret) | Pip (helmet) | Mittens (bobble hat) | Head-top y on the swan |
|---|---|---|---|---|---|
| `ride-sit`, `ride-lean`, `ride-up` | 20 | 22 | 22 | 24 | standing −68..−72; swim −50..−54 |
| `ride-hold`, `ride-brace` | 17–18 | 19–20 | 19–20 | 21–22 | standing −65..−70 |
| `ride-hunch` | 11 | 13 | 13 | 15 | standing −59..−63; water duck −33..−37 |
| `ride-duck` | 7 | 8 | 8 | 9 | crouch −23..−25 |
| `ride-ears`, `ride-cheer` | 20–22 | 21–22 | 21–22 | 23–24 | standing −68..−72 |

The rig body sizes share the same torso (9 px) and shoulder offsets for every build, so the arm
targets in §6.4 work for slim, normal and heavy riders.

### 6.3 Which pose when

The swan class picks the rider pose every tick. The first rule that matches wins.

| # | Condition | Rider pose |
|---|---|---|
| 1 | mission complete or boss dead while riding | `cheer` |
| 2 | a `honk` strip is playing | `ears` (covers his ears: even the Cygnets find the honk loud) |
| 3 | crouch, waddle, belly slide | `duck` |
| 4 | water duck | `hunch` |
| 5 | neck at −112.5° or −135° | `hunch` (the neck arches over him; he ducks under it) |
| 6 | squat, jump f0, flap, glide-tired, paddle-up f0–f2, wreck | `hold` (holds on tight) |
| 7 | land f0, stomp, settle f0, hit (12 ticks) | `brace` |
| 8 | neck at −67.5° or −90°, or skid | `up` (looks up along the neck; thrown back in a skid) |
| 9 | run, glide, jump f1, paddle-up f3 | `lean` (frame 1 on `run` f1 and f5, else frame 0) |
| 10 | everything else: idle, fall, land f1, swim, settle f1, rise | `sit` |

On water the rider never leans: "calm on top".

### 6.4 Contract addition: character `ride-*` strips

Every playable character (and `recruit`) registers these strips in `definePlayerSprites`
(`src/game/art/human-sprites.ts`), with pose tables in `src/game/art/poses.ts`.

- Rig part `'upper'`, **hip anchor** (the pelvis pixel), `weapon: 'none'` (the rider's own weapon is
  stored, not drawn).
- Points: the rig adds `head` (head centre) and `hand` (near hand) by itself. No `muzzle`.
- **9 strips, 14 frames per character.**
- Arm `to` targets are relative to each shoulder. They were computed from the rig (torso 9 px,
  shoulder 1 px back and 2 px down from the neck base, far shoulder 2 px forward) and checked by
  rendering: every hand lands on its grip.

| Strip | Frames | Timing | lean | hunch | Near arm `to` / far arm `to` | Other fields |
|---|---|---|---|---|---|---|
| `char/<id>/ride-sit` | 2 | 20 ticks, loop | 4 | 0 / 1 | f0 (9.5, 2.1) / (8.5, 1.9); f1 (9.6, 1.1) / (8.6, 0.9); hands `grip` | `expr: 'normal'` |
| `char/<id>/ride-lean` | 2 | 6 ticks, loop (or synced to `run`) | 16 / 18 | 0 / 1 | f0 (8.0, 2.0) / (7.1, 1.5); f1 (8.1, 1.0) / (7.2, 0.4); `grip` | `head: { dx: 1 }`; `flutter` 1 / 3 (scarf, coat tails) |
| `char/<id>/ride-up` | 1 | 30 | −10 | 0 | (11.2, 1.7) / (10.2, 2.1); `grip` | `head: { tilt: −12 }` |
| `char/<id>/ride-hunch` | 1 | 30 | 40 | 3 | (7.2, −1.3) / (6.7, −2.6); `grip` | `head: { dy: 4, tilt: −20 }`, `expr: 'panic'` |
| `char/<id>/ride-hold` | 2 | 4 ticks, loop | 10 / 12 | 2 | f0 (9.1, 0.1) / (8.1, −0.2); f1 (8.9, 0.1) / (8.0, −0.3); `grip` | `expr: 'shout'` / `'panic'`; f1 `head: { dy: 1 }` |
| `char/<id>/ride-brace` | 1 | 30 | 8 | 2 | (9.3, 0.1) / (8.3, −0.2); `grip` | `expr: 'hurt'` |
| `char/<id>/ride-duck` | 1 | 30 | 80 | 3 | (8.2, −1.3) / (8.9, −3.3); `grip` (folded handles) | `head: { dy: 6, tilt: 30 }`, `expr: 'shout'` |
| `char/<id>/ride-ears` | 2 | 6 ticks, loop | 2 | 1 | both hands `open` on the ears: (−1, −8) / (−1, −9) | `expr: 'blink'` / `'panic'` |
| `char/<id>/ride-cheer` | 2 | 8 ticks, loop | 0 | 0 | near `{ sh: 170, el: 20, hand: 'fist' }` (f1 `{ sh: 155, el: 50 }`) / far (9, 2) `grip` | `expr: 'happy'` / `'shout'` |

All reaches are 7.2–11.3 px, inside the 12 px arm (upper 6 + fore 6). Helium Head players cannot
mount (GDD §8.1), so no `helium-ride-*` strips are needed.

### 6.5 Contract addition: `Player.drawRide`

Gameplay core (`src/game/player/player.ts`, documented in `docs/api/game.md`):

```ts
export type RidePose = 'sit' | 'lean' | 'up' | 'hunch' | 'hold' | 'brace' | 'duck' | 'ears' | 'cheer';
/** Draw the rider of an open-seat mount: `<art>/ride-<pose>` (hip anchor) with its hip on (x, y). */
drawRide(r: Renderer, x: number, y: number, flipX: boolean, pose: RidePose, frame?: number): void;
```

- `frame` omitted → the strip's own timing from `world.tick`.
- The same invulnerability blink as `drawSeated`.
- **Fallback chain:** `ride-<pose>` → `ride-sit` → `mount` frame 1 drawn at (x, y + 17). MOUNT
  frame 1 is rendered with `grounded: false` and `dy: −2`; its `hip` point is (0, −17) (measured).
- `drawSeated` stays as it is for cockpit vehicles (feet on `seat`).
- Until `drawRide` lands, the swan class can draw the strip `<driver.art>/ride-<pose>` itself with
  `r.sprite(...)` and use the same fallback.
- The swan needs to know when to cheer: `victory()` returns early when mounted, so the player
  should expose a flag (for example `cheering`), or the swan listens to the mission-complete
  event.

### 6.6 The `seat` point on an open-seat mount

For cockpit vehicles `seat` = the driver's feet (`vehicle.ts` header). **For the swan `seat` = the
rider's hip.** The point places and draws the rider (`drawRide`, §7) and starts the eject:

- `eject` drops the player with the feet 2 px above the pad, so he somersaults off the deck.
- **The driver's anchor is not the seat.** The base `syncDriver` would put the player's x, y on
  the seat (the hip, 48 px up). Enemy AI reads a player's y as his feet, so every rifleman within
  120 px would fire 45° up-shots (`this.y − t.y > 40`) that fly over her at his preferred
  80–120 px, and shots aimed at the target's centre (y − 15) would pass 11 px over her crouched
  box (top 20). So the swan overrides `syncDriver()` (a protected `Vehicle` hook, no shared
  change) and puts the mounted player's anchor on her own feet anchor (x, y). Enemy AI then sees
  a grounded target: chest shots hit her legs and her crouch dodges them, and aimed shots hit her
  legs, her crouched box or her swimming hull in every pose (GDD §8.2 Size).
- The TRUMPETER does the same with its anchor 15 px below its hull centre, so aimed shots fly at
  its 28 × 14 hull (GDD §8.5).

---

## 7. Layers and draw order

The swan class overrides `draw()` (the vehicle API allows it for turrets). Back to front:

1. **Body frame** `vehicle/<v>/<anim>`: far wing, far leg, tail, hull, trim, seat pad, both
   handles, near leg, and the near wing when its pose is a back-layer pose. Self-contained strips
   (`empty*`, `rise`, `sit-down`, `hiss`, `dive`, `bash`, `tumble`, `dazed`, `right`, `shake`,
   `migrate*`, `wreck`) also contain the neck and head.
2. **Scuffs** `vehicle/swan/scuffs` at the `hull` point, when cells ≤ 2 and the frame's tilt is
   3° or less (§12.3).
3. **Rider** `driver.drawRide(r, seat.x, seat.y, flip, pose, frame)`.
4. **Front overlay** `vehicle/<colour>/<anim>-front`, same frame index and anchor as step 1: the
   near wing (front-layer poses) and the seat pad's near rim. It hides the rider's hips.
5. **Neck** `vehicle/<colour>/<neck strip>` at the body frame's `neck` point (skipped for
   self-contained strips).
6. FX: muzzle flash, dust, splash, spray, smoke, tin feathers (the fx helpers).

The hit flash and the last-cell red tint apply to steps 1, 2, 4 and 5. Never to the rider.

---

## 8. Named points

### 8.1 Body frames

Hull-attached points move with the frame's hull offset and turn with its tilt about the `hull`
point. Compute them with the transform that draws the frame.

| Point | Rest position | Meaning |
|---|---|---|
| `seat` | (−4, −48) | the rider's hip (`drawRide`, `eject`; not the driver's anchor, §6.6); crouch frames (−4, −16) |
| `neck` | (16, −45) | neck socket: the anchor of every neck frame |
| `hull` | (−3, −38) | hull centre: tilt pivot, scuffs anchor, HONK ring centre, explosion centre |
| `smoke` | (−20, −50) | damage smoke and the sigh puff, behind the rider |
| `perch` | (−26, −48) | rear-left end of the perch deck top (co-op PERCH: 14 × 4 from here) |
| `wake` | (−27, −34) | the stern at the waterline (`swim`, `settle`, `paddle-up`) |
| `footN`, `footF` | per frame | sole centre of each paddle (foot joint + (3, 3)): dust, splash, step sounds |
| `bubble` | (−4, −29) in parked frames | tail tip of the `RIDE?` bubble, 8 px above the pad |
| `egg` | (−30, 0) | `empty-lay` f5–f7: where the egg lands |
| `head` | per frame, self-contained strips only | the swan's head centre (dizzy feathers, bubbles) |

Check values (from the transform): `run` f1 (dy +2, tilt +3): seat (−3, −46), neck (16, −42),
perch (−25, −47). `skid` f1 (dy +3, tilt −10): seat (−6, −45), neck (14, −45). `jump` f0 (dy −2,
tilt −4): seat (−5, −50), neck (15, −48).

### 8.2 Neck frames

Anchor = the socket. Points:

- `muzzle`: the beak gun (P3 + 12u).
- `cannon`: the BEAK SHELL exit. Same pixel as `muzzle`: the shell also leaves the beak.
- `head`: head centre.

World muzzle = body `neck` point + neck `muzzle` (both mirrored when she faces left). The base
class reads `muzzle` and `cannon` from the body frame, so the swan overrides `fireMain()` and
`fireCannon()` to use this sum.

---

## 9. Sprite list

**Prefixes.** Body strips: `vehicle/<v>/` with `<v>` = `swan`, `swan-mute`, `swan-socks` or
`swan-mute-socks`. Front overlays and neck strips use only the colour prefix (`swan` or
`swan-mute`), because socks never show in them. `scuffs` and `egg` are shared under
`vehicle/swan/`. All body strips use the feet anchor at body (0, 0).

**Columns.** R = has a rider and a matching `<anim>-front` strip. Priority 1 = needed for the first
playable build; 2 = polish.

| Id | Frames | Timing (ticks) | Loop | R | Prio | Content |
|---|---|---|---|---|---|---|
| `idle` | 2 | 24 | yes | R | 1 | standing, breathing |
| `run` | 8 | 1 frame per 6 px travelled (§13.4) | yes | R | 1 | the long-stride run; played backward for the back-pedal |
| `move` | 8 | alias of `run` | yes | R | 1 | so the base class works before the override |
| `squat` | 2 | 2, 2 | no | R | 1 | take-off squat (4 ticks) |
| `jump` | 2 | 4, hold | no | R | 1 | push-off, rising tuck |
| `fall` | 2 | 6 | yes | R | 1 | legs reaching down, ready to land or stomp |
| `stomp` | 1 | 4 | no | R | 2 | stomp impact; then `jump` f1 for the bounce |
| `land` | 2 | 2, 2 | no | R | 1 | impact squash (4 ticks) |
| `flap` | 2 | 3, 3 | no | R | 1 | the wings snap open: the glide starts |
| `glide` | 2 | 8 | yes | R | 1 | wings spread, legs trailing |
| `glide-tired` | 2 | 2 | yes | R | 2 | the last 12 glide ticks: wing tips tremble |
| `fold` | 1 | 2 | no | R | 2 | the wings snap shut |
| `skid` | 2 | 3, then hold | no | R | 1 | plant and slide; also the 6-tick glide landing |
| `crouch` | 2 | 24 | yes | R | 1 | low "nest" pose, keel on the ground |
| `waddle` | 6 | 1 frame per 3 px | yes | R | 1 | crouch-walk |
| `slide` | 2 | 3 | yes | R | 2 | belly slide with sparks |
| `settle` | 2 | 2, 2 | no | R | 1 | stand ↔ swim transition (played backward to stand up) |
| `swim` | 4 | 6 moving, 16 still | yes | R | 1 | hull on the water, legs paddling under it |
| `water-duck` | 2 | 24 | yes | R | 2 | 8 px lower, rider hunched |
| `paddle-up` | 4 | 2 each | no | R | 1 | take-off from water: running on the surface |
| `honk` | 5 | 4, 3, 3, 4, 6 | no | R | 1 | wind-up 10 ticks, HONK on f3 (ground legs) |
| `honk-air` | 5 | as `honk` | no | R | 2 | the same, legs tucked |
| `honk-swim` | 5 | as `honk` | no | R | 2 | the same, swim pose |
| `rise` | 3 | 4, 4, 4 | no | R | 1 | stands up with the new rider; neck baked in |
| `wreck` | 2 | 6 | yes | R | 1 | 0 cells: slumped, sparking, alarm; neck baked in |
| `<anim>-front` | as `<anim>` | — | — | — | 1 | front overlay for every R strip |
| `sit-down` | 3 | 6, 6, 8 | no | — | 1 | after an eject: sits down, sighs; neck baked in |
| `empty` | 2 | 30 | yes | — | 1 | parked, head tucked on the breast, eye half shut |
| `empty-look` | 5 | picked by code | — | — | 1 | eye open: back-low, front-low, back-high, front-high, blink |
| `empty-lay` | 8 | 20, 10, 10, 6, 6, 8, 20, 30 | no | — | 2 | the nervous egg gag |
| `hiss` | 2 | 3, 3 | no | — | 1 | SWAN DIVE wind-up: threat display |
| `dive` | 8 | 1 frame per 8 px | yes | — | 1 | the empty swan's charge |
| `bash` | 1 | 6 | no | — | 1 | BEAK BASH impact |
| `tumble` | 2 | 4, 4 | no | — | 2 | flips backward after the bash |
| `dazed` | 4 | 8 | yes | — | 1 | on her back, paddling the air (180 ticks) |
| `right` | 3 | 4, 4, 4 | no | — | 1 | rolls upright (12 ticks) |
| `shake` | 2 | 4, 4 | no | — | 2 | shakes off tin feathers |
| `migrate` | 4 | 4 | yes | — | 1 | flies away honking (the swan is lost) |
| `migrate-soot` | 4 | 4 | yes | — | 2 | the same, sooty (0-cell exit) |
| `scuffs` | 2 | — | — | — | 2 | damage decals: ≤ 2 cells, ≤ 1 cell (anchor = `hull`) |
| `egg` | 4 | 6, 10, 10, 20 | no | — | 2 | lands, wobbles, cracks, pops open (feet anchor) |
| `neck` | 9 | — | — | — | 1 | land posture; frame i ↔ angle +45° − 22.5°·i |
| `neck-fire` | 9 | 2 per round | — | — | 1 | gun recoil: head 1 px back along −u, beak gap 1 px, eye angry |
| `neck-shell` | 9 | 6 per shell | — | — | 1 | beak open 3 px, head 1 px forward, eye angry |
| `neck-blink` | 9 | 6 | — | — | 1 | lid shut |
| `neck-hurt` | 9 | 12 after a hit | — | — | 1 | squint |
| `swim-neck` (+ `-fire`, `-shell`, `-blink`, `-hurt`) | 9 each | as above | — | — | 1 | water posture; frames 0–1 = frame 2; frames 4–8 = the land frames |
| `crouch-neck` (+ 4 variants) | 1 each | as above | — | — | 1 | crouch, 0° only |
| `duck-neck` (+ 4 variants) | 1 each | as above | — | — | 2 | water duck, 0° only |
| `neck-relax`, `swim-neck-relax` | 2 each | blink f1 | — | — | 1 | the relaxed S (idle 40 ticks, feel §7.3) |
| `neck-honk` | 3 | follows `honk` | no | — | 1 | inhale, HONK (beak wide open), hold |

GDD §15.6 lists `body`, `legs`, `neck`, `special`, `wreck`, `empty-gag` for vehicles. For the swan,
`body` and `legs` are the animation strips above (legs included), `neck` is the neck strips,
`special` = `honk*` + `neck-honk`, `empty-gag` = `empty-lay` + `egg`. §16 asks the orchestrator to
update §15.6.

**Budget.** Ridden body strips: 70 frames + 70 front overlays. Riderless strips: 48 frames. Neck
strips: about 110 frames per colour. Everything is generated lazily, so a mission builds only the
variants it uses (m1-c: `swan`, plus `swan-mute` in 2P; m3-a: `swan-socks`, plus
`swan-mute-socks` in 2P).

---

## 10. Frame tables (body strips)

**Columns:** hull offset dx, dy · tilt in degrees (+ = nose down) · near foot target (x, y, state)
· far foot target · leg mode (§3.6) · wing pose (near / far) · tail lift (px) · default rider pose
and frame (§6.3 rules override it) · events.

Foot targets are body-space positions of the foot joint. Legs come from IK with the hips at
(−4, −31) and (−6, −32) after the frame transform. "Piston +n" = the shank rod out n px.

### 10.1 `idle` (2 f, 24 ticks, loop)

| f | dx,dy | tilt | near foot | far foot | legs | wings | tail | rider | events |
|---|---|---|---|---|---|---|---|---|---|
| 0 | 0,0 | 0 | −3,−4 S | −7,−4 S | L | FOLD | 0 | sit 0 | blink chance |
| 1 | 0,+1 | 0 | −3,−4 S | −7,−4 S | L | LIFT 1 | 0 | sit 1 | |

### 10.2 `run` (8 f, one frame per 6 px)

| f | dx,dy | tilt | near foot | far foot | legs | wings | tail | rider | events |
|---|---|---|---|---|---|---|---|---|---|
| 0 | 0,0 | +2 | 8,−4 S↑ | −14,−9 F | L | FOLD | +1 | lean 0 | near contact: dust at `footN`, `swan/step` |
| 1 | 0,+2 | +3 | 2,−4 S | −8,−13 F | L | LIFT 2 | 0 | lean 1 | |
| 2 | 0,+1 | +2 | −4,−4 S | 1,−14 H | L | LIFT 1 | −1 | lean 0 | |
| 3 | 0,−1 | +1 | −10,−5 P, piston +2 | 8,−9 S↑ | L | FOLD | 0 | lean 0 | |
| 4 | 0,0 | +2 | −14,−9 F | 8,−4 S↑ | L | FOLD | +1 | lean 0 | far contact: dust at `footF`, `swan/step` |
| 5 | 0,+2 | +3 | −8,−13 F | 2,−4 S | L | LIFT 2 | 0 | lean 1 | |
| 6 | 0,+1 | +2 | 1,−14 H | −4,−4 S | L | LIFT 1 | −1 | lean 0 | |
| 7 | 0,−1 | +1 | 8,−9 S↑ | −10,−5 P, piston +2 | L | FOLD | 0 | lean 0 | |

- Joint check values (IK): f0 near (−4, −16), far (−19, −25); f3 near (−16, −23), far (−6, −18);
  f4 near (−18, −25), far (−2, −18); f5 near (−19, −26), far (−10, −16). Every reach is inside
  the strut length.
- At ≤ 1 cell she limps (feel §8): every 4th contact frame holds 3 extra ticks.
- Back-pedal (up held, feel §3.4): the same frames, played backward by the odometer.

### 10.3 Jumps: `squat`, `jump`, `fall`, `stomp`, `land`

| strip f | dx,dy | tilt | near foot | far foot | legs | wings | tail | rider | events |
|---|---|---|---|---|---|---|---|---|---|
| squat 0 | 0,+3 | +2 | 1,−4 S | −5,−4 S | L | HALF | +1 | hold 0 | `fx/steam-puff` at both joints |
| squat 1 | 0,+6 | +3 | 1,−4 S | −5,−4 S | L | HALF | +2 | hold 1 | |
| jump 0 | 0,−2 | −4 | −10,−2 P, piston +3 | −13,−1 P, piston +3 | L | HALF | +2 | hold 0 | dust at both feet, `swan/jump` |
| jump 1 | 0,0 | −2 | −6,−14 F | −9,−15 F | L | HALF | +1 | lean 0 | |
| fall 0 | 0,0 | −2 | 4,−4 S | −1,−5 S | L | HALF | 0 | sit 0 | |
| fall 1 | 0,0 | −2 | 5,−4 H | 0,−5 S | L | HALF, tips +1 | −1 | sit 0 | |
| stomp 0 | 0,+3 | +3 | 2,−4 S | −4,−4 S | L | HALF | +2 | brace | `swan/stomp`; then `jump` f1 for the bounce |
| land 0 | 0,+6 | +4 | 2,−4 S | −3,−4 S | L | LIFT 2 | +2 | brace | dust at both feet; `swan/land` after a fall of 60 px or more |
| land 1 | 0,+2 | +1 | 1,−4 S | −4,−4 S | L | LIFT 1 | 0 | sit 0 | |

In the air the hull keeps its rest height over the anchor and the legs tuck. The `fall` paddles sit
at y −5..−1, so they touch the ground when the body lands, and they fill the STOMP box
(−14, −6, 28, 10) of feel §4.5.

### 10.4 Wings: `flap`, `glide`, `glide-tired`, `fold`

Legs in `flap` and `fold`: tucked as `jump` f1. Legs in `glide`: trailing, −14,−11 F / −16,−12 F.

| strip f | dx,dy | tilt | wings (near / far) | tail | rider | events |
|---|---|---|---|---|---|---|
| flap 0 | 0,0 | 0 | UP / UP | +2 | hold 0 | `swan/flap` (a mechanical clack and a whump); 4–6 `fx/tin-feather` from the wing roots |
| flap 1 | 0,−1 | +2 | DOWN / MID | +1 | hold 1 | two air puffs under the wing tips |
| glide 0 | 0,0 | +3 | SPREAD | −1 | lean 0 | 1 px `snow` wind streaks from both tips every 4 ticks |
| glide 1 | 0,0 | +3 | SPREAD, blade tips +1 | −1 | lean 1 | |
| glide-tired 0 | 0,0 | +3 | SPREAD, tips +1 | −1 | hold 0 | `fx/steam-puff` at the shoulder, `swan/tired` |
| glide-tired 1 | 0,0 | +3 | SPREAD, tips −1 | −1 | hold 1 | |
| fold 0 | 0,0 | −2 | HALF (snap) | 0 | sit 0 | `swan/fold`; then `fall` |

**Glide landing:** she skis in on her paddles for 6 ticks (feel §5.4). Show `skid` f1 without the
facing flip: dust on the ground, a spray line on water.

### 10.5 `skid` (turn at speed)

| f | dx,dy | tilt | near foot | far foot | legs | wings | tail | rider | events |
|---|---|---|---|---|---|---|---|---|---|
| 0 | 0,+2 | −8 | 12,−4 S↑20 | 8,−4 S↑20 | L | BRAKE | +3 | up | sparks and dust at both feet every 2 ticks, `swan/skid` |
| 1 | 0,+3 | −10 | 13,−4 S↑20 | 9,−4 S↑20 | L | BRAKE | +3 | up | hold until her speed is 0.5 px/tick; **flip the facing**; continue with `run` f4 |

f0 lasts 3 ticks. f1 holds for the rest of the skid: 4 ticks from 2.6 px/tick (feel §3.3: 7 ticks
in all). Joint check: f1 near (−1, −13), reach 28.7 of 32 px. Below 1.6 px/tick she turns at once:
no frames.

### 10.6 Low: `crouch`, `waddle`, `slide`

Legs: mode T, drawn behind the hull. Only the near paddle's toe tips (4 × 2 px) show under the
breast. Handles folded (§5.2). Wings `FLAT`. Rider `duck`, seat at the deck + 4 px (§6.1).

| strip f | dx,dy | tilt | toes | tail | events |
|---|---|---|---|---|---|
| crouch 0 | 0,+28 | 0 | front | 0 | |
| crouch 1 | 0,+29 | 0 | front | 0 | wings rear half +1 (breath) |
| waddle 0..5 | +28, +27, +28, +28, +27, +28 | −3, 0, +3, +3, 0, −3 | front, front, back, back, back, front | +1, 0, −1, −1, 0, +1 | small dust and a quiet `swan/step` on f0 and f3 |
| slide 0 / 1 | 0,+28 | +2 | tucked | −1 | sparks under the keel (two shapes, alternating), dust |

The waddle rocks the hull ±3°. It is comic and never looks like a crawl.

### 10.7 Water: `settle`, `swim`, `water-duck`, `paddle-up`

In every water frame the surface line is y −16 and the waterline stripe lies on it (§13.2). Parts
below the line use §5.8.

| strip f | dx,dy | tilt | near foot | far foot | legs | wings | tail | rider | events |
|---|---|---|---|---|---|---|---|---|---|
| settle 0 | 0,+6 | 0 | 0,−4 S | −5,−4 S | M | HALF | +1 | brace | splash at both feet, `swan/splash` |
| settle 1 | 0,+12 | 0 | 2,−4 Sw | −7,−4 Sw | S | LIFT 1 | 0 | sit 0 | ring of ripples |
| swim 0 | 0,+18 | 0 | 6,−4 Sw | −12,−5 Fw | W | FOLD | 0 | sit 0 | power stroke: `swan/paddle`, ripple at `wake` |
| swim 1 | 0,+19 | 0 | −3,−3 Sw | −6,−7 Fw | W | FOLD | +1 | sit 0 | |
| swim 2 | 0,+18 | 0 | −12,−5 Fw | 6,−4 Sw | W | FOLD | 0 | sit 0 | power stroke: `swan/paddle` |
| swim 3 | 0,+17 | 0 | −6,−7 Fw | −3,−3 Sw | W | FOLD | −1 | sit 0 | |
| water-duck 0 | 0,+26 | 0 | stowed | stowed | T | HALF (the far arch shields his back) | +1 | hunch | bubbles at `wake` |
| water-duck 1 | 0,+26 | 0 | stowed | stowed | T | HALF | 0 | hunch | |
| paddle-up 0 | 0,+15 | −10 | 6,−5 Sw | −10,−6 Fw | W | UP / UP | +2 | hold 0 | spray at the breast, `swan/paddle` |
| paddle-up 1 | 0,+10 | −8 | 6,−16 S (slaps the surface) | −8,−9 Hw | S | DOWN / MID | +1 | hold 1 | splash at `footN` |
| paddle-up 2 | 0,+5 | −6 | −8,−12 H | 7,−16 S (slap) | M | UP / UP | +1 | hold 0 | splash at `footF` |
| paddle-up 3 | 0,0 | −4 | −6,−16 P (push) | −12,−20 F | L | DOWN / MID | 0 | lean 0 | splash at `footN`; the launch follows (§13.3) |

- `settle` plays forward when she starts to float (from a fall or a bank) and backward when she
  stands up on a bank or in shallows.
- `swim` and the bob: the feel's ±1 px bob (48-tick period) is a draw offset on top of these
  frames.
- This is the swan's running take-off across water: paddles slapping the surface, wings beating.

### 10.8 `honk`, `honk-air`, `honk-swim`

Legs: `honk` braced 5,−4 S / −9,−4 S (L). `honk-air`: as `jump` f1. `honk-swim`: as `swim` f0, and
add +18 to every dy.

| f | dx,dy | tilt | wings | tail | breast | neck | rider | events |
|---|---|---|---|---|---|---|---|---|
| 0 | 0,+1 | 0 | HALF | +1 | 0 | `neck-honk` 0 | ears 0 | |
| 1 | 0,+2 | 0 | BUSK | +2 | +1 | `neck-honk` 0 | ears 0 | |
| 2 | 0,0 | −4 | BUSK | +2 | +2 | `neck-honk` 0 | ears 1 | |
| 3 | 0,−2 | −6 | BLAST | +3 | +2 | `neck-honk` 1 | ears 1 | **HONK**: `swan/honk`, ring from `hull`, shake; on water a ripple ring too |
| 4 | 0,−1 | −3 | HALF | +1 | +1 | `neck-honk` 2 | ears 1 | |

Wind-up = 4 + 3 + 3 = **10 ticks**, the GDD's "wings spread and the chest puffs for 10 ticks". In
`honk-air` she hangs with her wings spread (feel §7.6). With fewer than 3 shells: no strip; show
`neck-hurt` for 12 ticks and play `swan/squeak`.

### 10.9 Mount and dismount: `rise`, `sit-down`

| strip f | dx,dy | legs | wings | rider | neck (baked) |
|---|---|---|---|---|---|
| rise 0 | 0,+20 | T → M | FOLD | sit 0 | head lifts off the breast, eye wide |
| rise 1 | 0,+10 | M | FOLD | sit 0 | head turned back to look at her rider, eye happy |
| rise 2 | 0,+2 | L | FOLD | sit 0 | neck in the land 0° pose (= `neck` f2) |
| sit-down 0 | 0,+6 | L | FOLD | — | head turns forward and down |
| sit-down 1 | 0,+16 | M | FOLD | — | neck curling down |
| sit-down 2 | 0,+28 | T | FOLD | — | head on the breast, eye shuts; `fx/steam-puff` at `smoke` (a sigh) |

- **Mount:** the player lands on the pad. The rider appears at once on the `seat` point and the
  swan plays `rise` (12 ticks), then `idle`.
- **Eject:** she stands in `idle` for 20 ticks and looks around (`neck-relax`), then plays
  `sit-down` (6 + 6 + 8 = 20 ticks) and `empty` (feel §9.1).

### 10.10 Empty strips (no rider, neck baked in)

Parked pose for all: hull +28 (keel on the ground), legs stowed, the orange toe tips peeking out
under the breast. The neck rests in a low curl with the head tucked on the breast (head centre
about (24, −10)). The seat pad and the handles stay free and visible: the `RIDE?` bubble points at
them.

| Strip | Frames |
|---|---|
| `empty` | 0: eye half shut · 1: hull +29, wings LIFT 1 (a breath) |
| `empty-look` | eye open, pupil: 0 back-low, 1 front-low, 2 back-high, 3 front-high, 4 blink. Code picks the frame from the nearest player within 96 px (behind / ahead, above / level) |
| `empty-lay` | 0 head up, eye wide, looks around · 1 looks back · 2 looks ahead · 3 hull +26, tilt +3, eye shut tight (wiggle) · 4 tilt −3 (wiggle) · 5 hull +27, plop: the egg appears at `egg` · 6 head turned back to the egg, eye wide · 7 proud: eye happy, breast +1. Gramps' bubble `SHE DOES THAT WHEN SHE'S NERVOUS.` starts on f5 |

**The egg** (`vehicle/swan/egg`, 8 × 10, feet anchor): an ivory steel capsule with a gold rivet
band round its middle and a tiny navy "3". f0 lands · f1 wobbles (tilt 10°) · f2 cracks (an ink
zigzag along the band) · f3 the top half pops up 3 px like a lid, with a steam puff. The game spawns
`pickup-bombs` at the `egg` point on f3 and removes the egg 20 ticks later.

**Drop-in (m3-a cargo parachute):** `fall` + `neck-relax`, no rider. The parachute is the
mission's prop.

### 10.11 SWAN DIVE and after (no rider, neck baked in)

| Strip | Drawing |
|---|---|
| `hiss` (2 f) | She stands. Neck stretched low and straight forward (head at the socket + (20, 12)), beak open 2 px, eye angry, wings BUSK (the threat display), tail +3. `swan/hiss` |
| `dive` (8 f, 8 px per frame) | The run legs with a 32 px step (contact at +12). Tilt +6. Neck as `hiss`, beak open on f1 and f5. Wings HALF, MID, DOWN, MID, HALF, MID, DOWN, MID (a beat every 4 frames). Dust at each contact |
| `bash` (1 f) | Hull dy +4, tilt +10. Neck rammed forward (head at the socket + (22, 14)), eye squint, wings BLAST. At the impact: tin feathers and steel bolts as debris |
| `tumble` (2 f) | She flips backward: hull rotated −90°, then −180° (vertices, about `hull`) |
| `dazed` (4 f) | On her back: hull rotated 180° and set down so the deck rests on the ground. Legs up, paddling the air (alternating). Neck flopped on the ground, head on its side, eye dizzy. Three `fx/tin-feather` circle the `head` point. A dive that ends in water (GDD §8.2 Ram) draws the same strip with its anchor on the float line: she floats on her back with her paddles in the air (no new art) |
| `right` (3 f) | She rolls the rest of the way: −240°, −300°, 0° (12 ticks) |
| `shake` (2 f) | She stands; hull ±2 px; a puff of tin feathers. Then `sit-down` |
| `migrate` (4 f) | Flying off up and forward: wings UP, MID, DOWN, MID; legs trailing as `glide`; neck at −22.5° with the beak open on f0 and f2 (`swan/migrate`) |
| `migrate-soot` (4 f) | The `migrate` frames darkened with `scorch(frame, 2)`; smoke from the tail |
| `wreck` (2 f, R) | 0 cells (GDD §8.1, 60 ticks): hull dy +6, tilt +6; legs splayed (near 8,−4 S, far −12,−4 S); wings LIMP; neck drooping forward-down, eye dizzy; sparks and steam at the joints; smoke from `smoke`. The rider is still on board: `hold` until he ejects |

The dive works for every feel choice: it ends in BEAK BASH and the dazed landing, or in `migrate`
when she had 1 cell left (feel §9.2).

---

## 11. Neck strips

### 11.1 Angles

Frame i ↔ aim angle θ = +45° − 22.5°·i (i = 0..8). Angles follow the GDD: 0° = her facing,
negative = up.

| i | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|---|
| θ | +45 | +22.5 | 0 | −22.5 | −45 | −67.5 | −90 | −112.5 | −135 |

The neck turns 22.5° every 2 ticks (feel §7.2), so it shows one frame per 2 ticks during a sweep.
When she turns, the neck keeps its angle relative to her facing: the frame index does not change.

### 11.2 Postures

- **Land** (`neck`): for 0° and the + angles the neck arches out of the collar and bends forward and
  down into the head, like a charging goose (the "hiss pose"). This puts the beak gun at 24 px. For
  −22.5° to −90° it rises in an S. For −112.5° and −135° it arches back over the rider and
  telescopes.
- **Water** (`swim-neck`): 0° and −22.5° hold the head low over the water. Frames 0–1 equal frame 2
  (there is no down-aim in water). Frames 4–8 equal the land frames: the socket and the rider sink
  by the same 18 px, so the clearances do not change.
- **Crouch** (`crouch-neck`) and **water duck** (`duck-neck`): 0° only, the neck folded flat.
- **Relaxed S** (`neck-relax`, `swim-neck-relax`): the classic swan S. It shows only when she is
  parked, or ridden and idle for 40 ticks (feel §7.3). A fire press snaps to the aim frame on the
  same tick.

### 11.3 Geometry

P1, P2, P3 are relative to the socket (P0 = (0, 0)). Body positions are for the socket of that
posture at rest: land (16, −45), water (16, −27), crouch (16, −17), water duck (16, −19).
Muzzle = P3 + 12·(cos θ, sin θ), rounded. Length is measured along the Bézier.

| Posture, θ | P1 | P2 | P3 (head, rel.) | Head (body) | Muzzle (rel.) | Muzzle (body) | Length |
|---|---|---|---|---|---|---|---|
| land +45 | 7,−3 | 11,13 | 11,22 | 27,−23 | 19,30 | 35,−15 | 28 |
| land +22.5 | 7,−3 | 11,12 | 12,21 | 28,−24 | 23,26 | 39,−19 | 27 |
| land 0 | 7,−3 | 11,12 | 12,21 | 28,−24 | 24,21 | **40,−24** | 27 |
| land −22.5 | 6,−5 | 8,8 | 13,8 | 29,−37 | 24,3 | 40,−42 | 17 |
| land −45 | −3,−9 | 2,−14 | 11,−5 | 27,−50 | 19,−13 | 35,−58 | 22 |
| land −67.5 | −3,−8 | −1,−16 | 6,−14 | 22,−59 | 11,−25 | 27,−70 | 19 |
| land −90 | 1,−8 | −3,−14 | −2,−19 | 14,−64 | −2,−31 | 14,−76 | 19 |
| land −112.5 | 2,−12 | 2,−28 | −11,−25 | 5,−70 | −16,−36 | 0,−81 | 33 |
| land −135 | 3,−14 | −4,−34 | −20,−25 | −4,−70 | −28,−33 | −12,−78 | 42 |
| water 0 | 3,−7 | 11,−6 | 14,4 | 30,−23 | 26,4 | **42,−23** | 20 |
| water −22.5 | 0,−8 | 9,−11 | 13,−6 | 29,−33 | 24,−11 | 40,−38 | 19 |
| crouch 0 | 5,0 | 8,3 | 10,3 | 26,−14 | 22,3 | **38,−14** | 11 |
| water duck 0 | 5,−1 | 9,1 | 12,1 | 28,−18 | 24,1 | **40,−18** | 12 |
| relaxed S (beak +20°) | −4,−8 | 10,−14 | 7,−21 | 23,−66 (water 23,−48) | 18,−17 | 34,−62 | 23 |

**Clearance.** The mock-up checked every land angle against all four heroes in the rider pose of
§6.3. The closest gap is 3 px (the rider's hands on the grips against the neck base, at −45° …
−90°). At −112.5° and −135° the swan's head passes 4–5 px over the hunched rider, Mittens' bobble
hat included. Mittens is the worst case: test him first.

### 11.4 Special neck frames

- `neck-honk`: 0 inhale: the head pulled back over the breast, P3 (−4, −16), beak closed (+10°),
  eye angry · 1 HONK: the neck thrust up and forward, P3 (10, −16), beak at −20° with its two
  halves 4 px apart · 2 hold: P3 (11, −16), beak gap 2 px. During the honk the rider covers his
  ears, so his hands are clear of the pulled-back head.
- `neck-fire`: as `neck`, head 1 px back along −u, beak gap 1 px, eye angry. Its `muzzle` moves
  1 px back too.
- `neck-shell`: as `neck`, beak open 3 px, head 1 px forward (a spit), eye angry. `cannon` stays at
  the beak tip.
- Personality (feel §12): ridden and idle for 120 ticks, she preens a wing or looks back at her
  rider. Use `neck-relax` with the eye on the back-high pupil cell (a look back). The preen is
  optional polish.

---

## 12. Variants and damage

### 12.1 P2 colour variant: "the Mute"

The TRUMPETER already gives P2 "the Mute" (black neck and beak, grey wing tips). The walker
matches it, so both modes read as the same machine.

| Prefix | When | Changes |
|---|---|---|
| `vehicle/swan` | default | — |
| `vehicle/swan-mute` | the second swan in 2-player games (spawn param `variant: 'mute'`) | neck rings, head dome and beak in the `black` ramp with 1 px `steel[3]` glints on the lit edge of each ring; the beak keeps its gold breech ring and steel nail; a 1 px `steel[3]` rim round the eye replaces the face patch; wing-tip bands `steel[2]` instead of navy |

The hull stays ivory in both. Whoever mounts a swan rides it as it is: the paint does not change
with the rider.

### 12.2 m3 socks

`vehicle/swan-socks` and `vehicle/swan-mute-socks` (spawn param `socks: true` in `m3-a`): the
paddles and the shanks below the joint wear Mittens' knitted socks.

- 2 px stripes of `red[2]` and `cloth[2]` along the shank, a `cloth[3]` cuff under the joint bolt,
  a 2 × 2 `red[3]` pompom at the heel.
- The sock foot is a rounded mitten shape 10 × 4 with no web, no toe ridges and no claws. "Folded"
  squashes it to 8 × 4.
- Under water, socks use the water colours of §5.8 like the paddles.
- Front overlays and neck strips do not change (they use the colour prefix).

### 12.3 Damage

- **Scuffs** (`vehicle/swan/scuffs`): frame 0 (≤ 2 cells): 3 dents, 2 bullet holes. Frame 1
  (≤ 1 cell): 6 dents, 4 holes, 2 scorch smudges, a lifted panel corner on the rump. Make them by
  running `damage()` (0.3 and 0.7) on the rest hull layer alone and keeping only the changed
  pixels. Anchor = the `hull` point. Draw them only on frames with a tilt of 3° or less (the decal
  is not rotated; that is most frames).
- **Smoke at ≤ 1 cell:** one `smokeTrail` puff from `smoke` every 6 ticks. It rises behind the
  rider and never hides his face. Sparks at the near joint every 30 ticks. The limp of §10.2.
- **Hit:** the renderer's white `flash` on the swan's sprites (steps 1, 2, 4, 5 of §7), plus
  `neck-hurt` for 12 ticks, a 1 px jolt backward for 4 ticks and two `fx/tin-feather`. On an
  ivory hull the white silhouette mostly wipes out the outline, trim, legs and beak for a tick. That
  reads as a flicker. If it reads weak over m3 snow at 1×, draw `tint: PAL.navy[1], alpha: 0.6`
  over the frame instead (open point §17).
- **Last cell:** the base class's red tint (alpha 0.45) on the swan's sprites, never on the rider.

---

## 13. Art numbers and the feel doc (with the math)

### 13.1 Art against the logic boxes

| Item | `feel.md` (logic) | Art | Difference |
|---|---|---|---|
| Hull, standing | (−22, −48, 40, 20) | x −27..21, y −48..−28 | top and bottom match; the breast curve reaches 3 px further forward; the stern and the perch deck reach x −27 at the top (needed by the perch at x −26) |
| Legs | (−8, −28, 16, 28) | paddles sweep x −14..+21 in the run | a logic simplification; fine |
| Pilot | (−10, −66, 12, 18) | rider x −12..+9 (hands on the grips), top −68..−72 | the head top is 2–6 px above the box (hats); fine |
| Crouched | (−22, −20, 40, 20) | hull top −20; rider's head −23..−25 | §13.6 |
| Swimming | hull (−22, −30, 40, 16), pilot (−10, −48, 12, 18) | hull −30..−10; rider top −50..−54 | hull matches; head top +2..6 px (hats) |
| Water duck | (−22, −24, 40, 12) | hull top −22; hunched rider's top −33..−37 | the rider is 9–13 px above the box; suggest a pilot box (−10, −37, 12, 15) in the duck (§13.6) |
| Pilot hips | standing (−4, −48), crouched (−4, −20), swimming (−4, −30) | (−4, −48), **(−4, −16)**, (−4, −30); water duck (−4, −22) | crouched: 4 px lower, because he slides down to lie flat |
| Seat zone | parked (−10, −32, 20, 16), water (−10, −44, 20, 16) | pad x −11..1, top −21 (parked) and −31 (water) | the zones cover the pad; fine |
| Perch | (−26, hull top, 14, 4) | flat deck x −26..−12 on the deck line; exported per frame as `perch` | matches |
| STOMP box | (−14, −6, 28, 10) | `fall` paddles at y −5..−1, x −3..+14 | inside the box |
| Highest points | pilot −66, beak −76 | rider −68..−72; beak −76 (−90°), **−81 (−112.5°)**, −78 (−135°) | §13.5 |

### 13.2 Float line, waterline and settling

- The waterline stripe is at y −34 in rest coordinates. In water the surface is 16 px above the
  anchor (float line = surface + 16, feel §6.1). So the swim hull offset is
  −16 − (−34) = **+18 px**.
- Then the keel (−28 + 18 = −10) is 6 px under the surface: 6 / 20 = 30 % of the hull is under
  water, like a real swan. The deck (−48 + 18 = −30) is 14 px above the surface. The rider's head
  top is 34–38 px above the surface (50..54 − 16).
- Example `m1-c`: surface y 180 → float line y 196 → hull y 166..186, keel 6 px under the surface.
  The paddles (lowest at y 196) stay 20 px above the river bed (y 216).
- **Settling into water** (from a fall or a bank): the art drops 18 px in three steps, +6, +12,
  +18, over 4 ticks (`settle` f0, f1, then `swim`). The feel's cosmetic plunge (a dip of
  2 · min(vy, 5) px, at most 10 px, eased back over 16 ticks) goes on top. Worst case: a fall at
  5 px/tick dips 10 px more, so the hull offset peaks at +28. The deck is then at −20, still 4 px
  above the surface.

### 13.3 Take-off from water

- The anchor stays on the float line for the 8-tick paddle-up (feel §6.5). The art lifts the hull
  from +18 to 0 in four 2-tick frames: +15, +10, +5, 0. That is 18 / 8 = 2.25 px per tick on
  average.
- The launch is vy −5.9 with her gravity 0.18. The engine adds gravity first, then moves:
  tick 1 moves −5.9 + 0.18 = **−5.72 px**. `jump` f0 has a hull offset of −2. So the hull rises
  5.72 + 2 = 7.7 px between the last paddle-up frame and the first airborne frame. The motion keeps
  speeding up, with no step backward.
- In the air her feet peak 96.7 − 16 = 80.7 px above the surface (feel §6.5). The rider's head is
  then 80.7 + 68..72 = 149–153 px above the surface: in `m1-c` at y 27–31, inside the view.

### 13.4 Animation timing

- **Run odometer:** frame = floor(d / 6) mod 8, where d is the distance run along her facing
  (negative while back-pedalling). The planted foot never skates, even while she speeds up.
  Ticks per frame t = 6 / v.

| Speed v (px/tick) | t = 6 / v | Contact every (4t) | Note |
|---|---|---|---|
| 0.8 waddle (own 3 px stride, 6 frames) | 3.75 (3 / 0.8) | 11.25 (contacts on f0 and f3) | waddle cycle 18 px |
| 1.2 back-pedal | 5.0 | 20 | frames run backward |
| 1.5 trot | 4.0 | 16 | |
| 2.0 | 3.0 | 12 | |
| 2.6 sprint | 2.31 | 9.2 | |
| 3.4 dive (own 8 px stride) | 2.35 (8 / 3.4) | 9.4 | `dive` strip |

  `feel.md` §3.1 gives "a contact every 12 ticks (trot), every 8 ticks (sprint)". The art stride
  (24 px per step) gives 16 and 9.2. Sounds and dust come from the contact frames, so the art
  cadence wins.
- **Swim:** 4 frames with a power stroke on f0 and f2. Moving: 6 ticks per frame, a stroke every
  12 ticks = the feel's `swan/paddle` cadence. Still: 16 ticks per frame, a stroke every 32 ticks
  (feel §6.3).
- **Fixed lengths match the feel:** squat 2 + 2 = 4 ticks (§4.1); land 2 + 2 = 4 (§4.4); skid
  3 + 4 = 7 from 2.6 px/tick (§3.3); paddle-up 4 × 2 = 8 (§6.5); honk wind-up 4 + 3 + 3 = 10
  (§7.6); hiss 3 + 3 = 6 (§9.2); right 3 × 4 = 12 (§9.2); flap 3 + 3 = 6 (the glide opens in 2
  frames, §5.4).
- **Glide:** the art never shows a gain in height. `flap` f1 lifts the hull 1 px; the feel's
  opening flap lifts her 0.4² / (2 × 0.06) = 1.3 px. They agree.

### 13.5 Headroom at the top of the view

- Jump apex (feel §4.2): 5.9² / (2 × 0.18) = 96.7 px by the formula, [93.8] in the engine.
- From the standard ground (y 176) the anchor peaks at 176 − 93.8 = 82.2. Rider head tops:
  Mittens 82.2 − 72 = **10.2**, Grace and Pip 12.2, Gramps 14.2. Beak at −90°: 82.2 − 76 = 6.2.
  Beak at −112.5° (only during a sweep): 82.2 − 81 = 1.2. All are inside the view (y ≥ 0).
- From the `m1-c` jetties (y 168): Mittens' head at 168 − 93.8 − 72 = 2.2 (inside); the −112.5°
  beak at −6.8 (7 px out, only for the 2 ticks of a sweep).
- HUD: at a sprint her anchor sits at view x 164 (138 with the requested lead of 64, feel §11).
  The rider's head spans the anchor x −12..+9, so x 126..173. That is right of the P1 HUD block
  (it ends near x 110) and left of the timer frame (x 178..206). No overlap.

### 13.6 Crouch and water duck against chest-high shots

The standard enemy bullet flies 22.5–25.5 px above the shooter's ground (feel §2).

- **Land crouch.** Hull top 20. The rider's hip is 4 px under the deck (y −16). `ride-duck` reaches
  7–9 px above the hip, so his head top is at 23–25 px. The bullet passes over the hull (20) and
  grazes the top 0.5–2.5 px of hair and hats. That reads as a near miss, and the logic box (top 20)
  agrees. If the build team wants no overlap at all, put the crouch seat 6 px under the deck: the
  head tops drop to 21–23 px.
- **Water duck.** The deck is 6 px above the surface (hull +26). The rider hunches (11–15 px above
  his hip), so his head top is 17–21 px above the surface. A rowboat rifleman's chest shot
  (22.5–25.5 px above the surface) passes over by 1.5–5.5 px, as the feel wants. A rider lying
  flat would put his face in the water here, so the water duck uses `ride-hunch`.

### 13.7 Muzzle points against the feel's fallbacks

`feel.md` §7.3 says art frame points win. Differences:

| Aim | Feel fallback | Art (§11.3) | Difference |
|---|---|---|---|
| 0°, standing or running | (40, −24) | (40, −24) | 0 |
| −45° | (34, −58) | (35, −58) | 1 px |
| −90° | (14, −76) | (14, −76) | 0 |
| −135° | (−8, −74) | (−12, −78) | 4 / 4 px: the head must pass 4 px over the hunched rider's hat |
| +45° (air) | (36, −14) | (35, −15) | 1 / 1 px |
| 0°, crouched | (38, −12) | (38, −14) | 2 px |
| 0°, swimming | (40, −22) | (42, −23) | 2 / 1 px |
| 0°, ducked | (40, −18) | (40, −18) | 0 |

### 13.8 Mount zone and bubble

- The `RIDE?` bubble's tail tip is 8 px above the hatch: the `bubble` point (−4, −29) in parked
  frames (pad top at −21).
- On-foot jump apex [45.4] px (feel §4) puts a player's feet far above the parked zone top (32 px).
  He then falls into it with vy > 0, which mounts him (`canMount`).
- If the build team prefers to derive the zone from the art: {S.x − 10, S.y − 12, w 20, h 16} from
  the frame's `seat` point S. Parked S = (−4, −20) gives (−14, −32, 20, 16).

---

## 14. TRUMPETER continuity (GDD §8.5)

The TRUMPETER must read as the same swan in flight. Build it from the same part generators.

- **Same machine:** the same hull with the waterline stripe and the bow "3", the same rings, head,
  lens eye, face patch and beak, the same wing plates with navy tips, the same gold rivets.
- **Wings:** the walker's `UP`, `MID`, `DOWN` and `SPREAD` poses make the flight cycle. The 72 px
  span stays.
- **Jets:** the walker's two flush vents under the wing root (§5.1) open into two small jet nozzles
  with `fire`-ramp exhaust. These are the only new parts ("Wings AND jets. Don't tell
  accounting.").
- **Legs:** retracted (mode W) and trailing, as in `glide`. Optional gag: in m5 she still wears the
  m3 socks.
- **Neck:** stretched straight forward: P1 (6, −3), P2 (11, 0), P3 (16, 0); head at (32, −45) and
  muzzle at (44, −45) in walker body space. **TWIN BEAK GUN:** the bill tip is split and slightly
  open, with one bore in each half, so the two bullets leave 4 px apart (muzzle y −2 and +2).
- **Rider (change):** the pilot now rides astride on the seat pad, drawn with `drawRide`: `lean` in
  normal flight, `hold` on a dive bomb or a hard bank, `ears` on HONK, `cheer` when the boss dies.
  No canopy.
- **Size (change):** the rider adds 20–24 px above the deck. The sprite grows from 72 × 40 to about
  76 × 64. The hurtbox stays the hull only (28 × 14): shoot-em-up fairness.
- **P2:** the Mute uses the `swan-mute` colours (§12.1).
- **Bail out:** the rider somersaults off the pad and opens the swan-shaped parachute (an ivory
  canopy with two navy wing-tip panels). The empty Trumpeter flies on with the `hiss` neck.
- The enclosed canopy of the old GDD look now belongs only to the Golden Goose (Mk2). This makes the
  enemy and the hero machine differ even more (§16 item 9).

---

## 15. IP check

### 15.1 The reference mount, in words

From `docs/research/mechanics.md` §14.2 and §23.2 and general knowledge of the genre. Nobody
looks at, traces or copies its sprites, and this file does not name it.

The reference game's ostrich mount is a **real ostrich**, an animal, not a machine. It has a round,
fluffy body of dark plumage with pale plumes, a very long, thin, bare neck held upright, a small
head with big eyes and a short beak, and very long bare legs with two big toes. It wears a **metal
helmet** and a **metal saddle frame**. A **gatling-type gun is fixed to the saddle at the bird's
side** and sweeps a half circle. The soldier sits upright high on the saddle, **legs hanging down
the bird's sides**, his whole body visible. It runs with long bounding strides and a bobbing neck,
jumps very high, and turns slowly, which leaves the rider exposed. When it is sent off in a ram,
it runs away instead of exploding.

### 15.2 Point by point

| Aspect | Reference ostrich mount | SWAN-3 |
|---|---|---|
| What it is | a real animal wearing armour | a robot of riveted enamel plates; no plumage, no skin (her only feathers are stamped tin plates thrown off as effects) |
| Body | small, round, fluffy, dark, high on the legs | long, low boat hull (about 2.4 : 1), ivory, a navy waterline stripe, a bow number "3", an upturned bladed tail with a rudder fin |
| Neck | long, thin, bare, upright, bobbing | a thick stack of six rings on a steel hose; lowered forward like a charging goose on land, an S on water; telescopes for back aims |
| Head | small organic head, big eyes, a helmet | a smooth ivory dome, one lens eye with a shutter lid, a navy face patch; no helmet, visor, goggles, crest or plume |
| Beak | short, plain | a long orange beak that **is** the gun barrel (gold breech ring, steel nail with a bore) |
| Legs and feet | long bare legs, two big toes | steel telescoping struts with a piston and a gold joint bolt; orange webbed paddles that spread and fold |
| Wings | small, drooping, fluffy plumes | big ivory plates; the far wing stands in an arch behind the rider (a swan's raised-wing display); navy tips |
| Gun | a gatling on the saddle at the flank, sweeping 180° | **no gun on the body at all**; the beak aims with the neck (the 180° arc is a shared mechanic); only flush vents on the flank |
| Seat | a metal saddle frame strapped high on the back | a low quilted navy pad built into the deck between the wing roots; no frame, straps, stirrups, horn, reins or blanket |
| Rider | upright, legs dangling down the sides, whole body shown | astride, legs hidden under the wing plates, shown from the hips up; holds two brass handles |
| Colours | dark plumage, pale skin, grey metal | ivory, steel, navy trim, gold rivets, orange beak and paddles; P2 black neck |
| Motion | bounding stride, bobbing neck, slow turn | slapping paddles, fluttering plates, a short skid turn; a calm S-neck and furious paddling on water; a running take-off across the water; a wing-spread glide |
| Ram | runs off unhurt | hisses, charges, BEAK BASH, then crash-lands on her back, dazed (or migrates) |
| Extras | — | swims, glides, HONK shockwave, the nervous egg, knitted socks, looks back at her rider |

### 15.3 Other famous riding animals

| Famous mount | Its look | Why SWAN-3 does not echo it |
|---|---|---|
| The yellow riding birds of a famous RPG series (Final Fantasy's chocobos) | big, round, yellow, fluffy, a head crest, a saddle and reins, clawed feet; some breeds swim or fly | not yellow (gold only on rivets and handles), not fluffy, no crest, no reins, no saddle; webbed paddles; a machine |
| The green dinosaur mount of a famous platform series (Super Mario's Yoshi) | green, a big round nose, a red saddle shell, a long tongue; eats enemies, lays spotted eggs and throws them, flutters its legs to stretch a jump | not green; no tongue, no saddle shell; she never eats enemies and never throws eggs; her one egg is a riveted ivory capsule with a gold band and a navy "3" that opens into this game's bombs pickup; she stretches a jump with spread wing plates, not with her legs |
| The flying ostriches of a classic jousting arcade game (Joust) | yellow ostriches, knights with lances, flap-to-fly | not an ostrich, no lance; one glide per airtime, no flight on land |
| The ostrich buddy of a famous ape platform series (Donkey Kong Country's Expresso) | an organic ostrich that flutters small wings to glide | a robot swan with big plated wings |
| The great bird mounts of a famous adventure series (Zelda's Loftwings) | feathered giant birds ridden in the sky | she walks and swims; she flies only in m5, with jets; a robot |
| The swan creature of a famous monster series (Pokémon's Swanna) | a white swan with a blue head tuft | no tuft, crest or plume; a robot with a lens eye and a gun beak |
| The giant robot swan of a famous cartoon series (Adventure Time's Swan, first seen in "Dungeon") | a big white swan, robotic or cybernetic, that carries riders through the air and fires a laser from its mouth when a control stick on its head is pulled | her controls are two brass handles on the deck, never a stick, lever or panel on her head or neck; her beak fires rounds and shells, never a beam; a riveted ivory machine with a boat hull, a ringed neck and a lens eye; she flies only in m5, with jets |
| The sea-ferry creature of the same series (Pokémon's Lapras) | a blue sea creature with a shell that carries the hero over water | an ivory robot swan; no shell; not a creature |
| The honking goose of a famous indie game (Untitled Goose Game) | a flat-shaded white goose that honks on a button | our honk is a ring shockwave from a riveted robot in outlined pixel art; no copied pose or gag |

Free to use (nature and folklore): a mute swan's raised-wing display, the running take-off across
water, cygnets riding on a parent's back, swan pedal boats, the swan-knight legend.

### 15.4 Self-check (`docs/ORIGINALITY.md`)

1. A fan of the reference series would not recognise its ostrich mount here: no ostrich, no
   helmet, no saddle frame, no flank gun, no dangling legs, a different silhouette (the black-fill
   test of §2).
2. Names: SWAN-3, Metal Swan, TRUMPETER, the Mute, Mk1 and Mk2 are this project's own. No banned
   name from `ORIGINALITY.md` or research §23 appears in this file. The reference mount is
   described, never named.
3. No music here. Sounds use the existing GDD ids (`swan/step`, `swan/paddle`, `swan/fire`,
   `swan/honk`, `swan/squeak`, `trumpeter/flap`) and the new ids of `feel.md` §12.

---

## 16. Requests to other owners

1. **Character art** (`src/game/art/poses.ts`, `src/game/art/human-sprites.ts`): add `RIDE_*` pose
   tables and register the 9 `char/<id>/ride-*` strips (14 frames) in `definePlayerSprites`,
   exactly as §6.4. Add them to the `tests/art` frame-count and point checks.
2. **Gameplay core** (`src/game/player/player.ts`, `docs/api/game.md`): add `RidePose` and
   `drawRide(r, x, y, flipX, pose, frame?)` with the blink rule and the fallback chain (§6.5). Add
   a way for the swan to know when to cheer.
3. **Orchestrator:**
   - `docs/ARCHITECTURE.md` §6.1: add the `ride-*` strips to the player contract, and the note
     "open-seat mounts: `seat` = the rider's hip, drawn with `Player.drawRide`".
   - GDD §3.6: add the `ride-*` strips to the shared character sprites.
   - GDD §8.2: replace the Look and Size rows with §0, §2 and §3 of this file.
   - GDD §8.5: the pilot rides astride; the sprite grows to about 76 × 64 (§14).
   - GDD §15.6: the swan strip list (§9).
   - GDD §15.10 item 2 and §16: the canopy rule is replaced by the ridden swan (user request).
4. **Vehicle content** (`src/game/content/vehicles/`): the swan class overrides `animate()` (strip
   choice, the odometer of §13.4, the rider pose rules of §6.3), `draw()` (§7), `fireMain()` and
   `fireCannon()` (muzzle = body `neck` + neck `muzzle`, §8.2). It registers `move` as an alias of
   `run`, plays `settle` and `paddle-up` (§13.2, §13.3), and places the co-op perch from the
   `perch` point.
5. **FX:** `fx/tin-feather` (5 × 2 px stamped ivory feather plate with a navy tip, 4 turning frames)
   for the glide opening, hits, the bash, the daze circle and the migration. Draw each plate stiff
   and metallic: a 1 px `steel[3]` edge glint and a 1 px gold rivet dot at the quill. It tumbles
   rigidly and never curls like down. These plates are her only feathers; her body has no
   plumage (§2).
   `fx/muzzle-swan-beak-gun` (round 5 × 5 flash, 2 frames, no direction, so it fits all 9 angles).
6. **Feel doc:** take note of §13: the crouch hip at −16 and the 23–25 px crouch silhouette, the
   water-duck pilot box, the −135° muzzle, the highest beak tip at −81 px, and contacts every 24 px.
7. **HUD and title:** `ui/icon-life` and `ui/cursor-swan` swan heads use this head (dome, lens eye,
   navy face patch, orange beak). The title lake scene can show `swim` with `swim-neck-relax` and
   `ride-sit`.
8. **m1 mission:** `mk1-head` uses this head, older: `rust` streaks, a dented dome, a tuft of river
   weed on top and a lifebuoy (red and ivory quarters, stencilled `MK1`) floating round the neck at
   the waterline. No hat or helmet of any kind: in `m1-c` only this 16 × 16 head shows, and a white
   bird head with an orange beak under a little sailor hat is the core look of a famous cartoon
   duck; a helmet would bring back the reference mount's helmeted bird.
9. **Mini-boss `golden-goose`** (Mk2): it keeps its enclosed canopy cockpit, which is now its own
   trait. Optional lore bubble for Gramps: `MK2 HAD A CANOPY. IT FOGGED UP.`
10. **m5 owner:** the TRUMPETER sprites follow §14.

---

## 17. Open points

- Hit flash: the white `flash` (default) or a navy tint over the ivory hull (§12.3). Decide after a
  1× check over m3 snow.
- Scuffs: build the decal overlay (priority 2) or rely on smoke, sparks and the red tint only.
- Crouch seat depth: deck + 4 px (head tops 23–25 px) or deck + 6 px (21–23 px), §13.6.
- The −112.5° frame puts the beak tip 81 px up, 5 px above the feel's highest point. It shows only
  for 2 ticks per sweep. Accept it, or skip frame 7 during sweeps.
- Preen fidget after 120 idle ticks: a dedicated 3-frame `neck-preen` strip, or the look-back on
  `neck-relax` only.
