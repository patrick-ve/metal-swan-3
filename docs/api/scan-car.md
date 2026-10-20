# Scan car API — the parking scan car (mission `ams`, section `c`)

Spec: `docs/design/ams-extras.md` §3; GDD §10.0b. Code: `src/game/content/bosses/ams-scan/`
(`car.ts` the boss, `adds.ts` the tow truck, the wheel clamps, the reticle, the ticket and the
status `clamped`, `geometry.ts` every number and id, `shape.ts` the car's side profile, `art*.ts`
the 1× art and the 2× / 4× drawers). Manifest entry `bosses/ams-scan`. Numbers are NORMAL; the
Boss base scales HP by difficulty and co-op and every telegraph by `telegraphFor` (≥ 18 ticks).

## 1. Placing the fight

```ts
// section-c.ts `scanCarFight` (the integrator's hook): lock one view on the shop quay, the car
// drives in from the right, wait until it is beaten, open the lock.
ctx.lockCamera(C_ARENA[0], C_ARENA[1]);                       // 1984–2368
const car = ctx.spawn('ams-scan-car', C_ARENA[1] + 40, 'ground', { facing: -1, tag: SCAN_TAG, arenaLeft: C_ARENA[0], arenaW: C_ARENA[1] - C_ARENA[0] });
yield () => (car instanceof Boss && car.defeated) || ctx.world.countAlive(SCAN_TAG) === 0;
yield 60;
ctx.unlockCamera(false);
```

- Params: `facing` (−1 default: in from the right; 1: from the left), `arenaLeft` / `arenaW`
  (default: the camera's left while the intro runs, 384; section c passes the fixed arena, so the
  car parks inside the locked view even while the camera still eases into the lock), `hpScale`
  (tests).
- Section c (`section-c.ts`): from the last squad before the arena (camera 1640) a body wall at
  `C_ARENA[1] − 8` keeps the players on the quay inside the arena's view (a player who runs ahead
  never gets down the jetty steps before the lock); it goes when the car is beaten. It also works on a
  flat test floor (`npm run arena -- --spawn "ams-scan-car@420{facing:-1}"`).
- It brakes `SCAN.homeIn` (54) px inside the arena edge it came from. No WARNING banner, no boss
  music: the stage music plays on; the HUD boss bar shows `SCANAUTO`.
- `'bossDefeated'` is emitted at the end; nothing here ends the mission.

## 2. The fight

| | |
|---|---|
| Intro | drives in at 2.4 px/tick, brakes, the scanner box lifts and its camera windows light up (60 ticks, invulnerable), `KENTEKEN GESCAND.` (`ams/scan-up`) |
| Parts | `scanner` 400 (required; broken: no more SCAN LOCK, the box hangs askew, then gone) and `body` 900 (required core); damage states dents, scuffed bars, cracked windows, steam |
| SCAN LOCK | a red reticle (`boss/ams-scan/reticle`) follows the nearest player 40 ticks, freezes 24 and blinks (`ams/scan-beep`), then the printer shoots a ticket strip (`ams-scan-ticket`, `ams/ticket-print`): it flies level, `lift` (40) px over the frozen spot (over the heads: a step toward the car passes under it), stops over the spot and flutters straight down onto it at `dropV` (2.4) px/tick; the reticle stays (blinking out) until it lands: step away (a crouch or a jump on the spot is hit); recovery 50 |
| RAM | revs 24 ticks (wheels spin, smoke, `ams/rev`), drives across at 3 px/tick, brakes and turns at the far side; only then its low body hurts: the `ram` box (47 × 22) is the leading part, from 6 px behind its middle to the front bumper (a hero at the rear bumper is not hit when it drives off): jump it. Never into a clamped player: it waits before the rev, keeps revving (up to 60 ticks, then no drive) while a clamp that closed during the rev holds, and brakes short of a player clamped in its path; stops short of a tow truck |
| TOW CALL (phase 2) | the scanner broken or the body ≤ 50 %: `TAKELWAGEN!`; the tow truck (`ams-tow-truck`, 300 HP, 1,000 points) backs in from the far side (`ams/reverse-beep` every 40 ticks), swings its crane hook low (crouch or time a jump), drops 2 wheel clamps and leaves after 10 s or when broken |
| Wheel clamp | `ams-wheel-clamp` (200 points): hops toward the players (tell 22); its open jaws clamp a hero's boot: status `clamped` (45 ticks: no walking or jumping; turning, aiming, shooting and throwing work; 40 ticks of grace after); breaks after 2 hits, at once by a blast or the knife (`ams/clamp-clunk`) |
| Adds | wait while `holdAdds` (the in-world continue, a stagger) |
| Death | the airbag pops (`AIRBAG!`, `ams/airbag`), it flips onto its roof smoking, the driver crawls out and runs; score 10,000; drops `pickup-repair` when a player rides a vehicle, else a weapon (H, R or L); the truck drives off, the clamps fall apart |

Tests read `car.trace` (`ScanAttackTrace`: the attack, the tick its telegraph began and the tick
it struck) and `isClamped(player)`. The bot beats it (god: about 18 s; normal: about 27 s, 2
deaths on seeds 1–3).

## 3. Art (tier-4 working set: section `c`'s `art` holds `boss/ams-scan/`)

The look follows the user's photo of the real car (ams-extras §3; the photo stays outside the repo,
all art is drawn by code). Every look number is in `geometry.ts` (`SCAN.profile`, `band`, `hood`,
`bars`, `stripes`, `crosses`, `scanner.*`); `shape.ts` turns them into predicates that the 1× drawer
(`art.ts`) and the one 2× / 4× drawer (`art-hd.ts`) share.

- **Car:** a compact, tall white electric hatchback, 84 px long (bumper to bumper), the body 27 px
  over the road, 39 px with the scanner box (40 with its ink): a short sloping bonnet, a long raked
  windscreen, a high roof that curves down only at the very rear (a small spoiler lip), a
  near-vertical tailgate, black arch trims, a black sill and lower bumpers that wrap round.
- **Glass:** one band of near-black tinted glass from the windscreen pillar to the tailgate, black
  pillars (A, the small front quarter glass's divider, B, C, D), so the white roof floats; the belt
  line rises to the rear and kicks up under the rear quarter glass; the black mirror at the quarter
  glass; the parking permit behind the windscreen; the handhaver's dark silhouette with his cap.
- **Livery:** red slanted bars from just above the sill to mid-door (three on the front door, a
  stub on the front wing that the arch cuts), red slanted stripes across the bonnet's top face
  (seen a little from above), the three red crosses stacked on the rear door, a small red emblem
  over the rear arch. At 1× these carry the read.
- **Lettering** (`text`, never mirrored, each frame anchored on its block's centre): 0
  `PARKEERCONTROLE` on the front door over the bars, 1 `Gemeente Amsterdam` on the rear door set
  close to the crosses on its right, 2 the box's `24`, 3 `Gemeente Amsterdam` for the car facing
  left (set against the mirrored crosses; car.ts picks it by `SCAN.textFlip`). 4×: the `small`
  font; 2×: 3 × 5 capitals (3 × 4 for the rear door, so both lines clear the rear arch); 1×: print
  hints.
- **Front / rear:** the slim swept-back headlight in a black housing, a black grille with a thin
  chrome bar and a plain round emblem (no maker's logo or badge), a fog lamp, yellow plates with no
  real number (the rear one shows the blue EU strip at its near end), the red tail light under the
  band's rear end; the amber hazard `blink` sits on the headlight and the tail light (`SCAN.lamps`).
- **Scanner box:** a big, thick white box (29 px, about 2/3 of the roof, over the windscreen at the
  front) with rounded corners on a black rack with two feet: the lid's top face, a seam round the
  lid, smoked camera windows (two on the side with a lens behind the middle one, one on each end),
  a grey band with the `24`; no coloured lights. Scanning (frame 3, the intro and SCAN LOCK): a
  faint red cast behind the smoked glass and a lit lens. The scanner hurtbox (`SCAN.box.scanner`,
  34 × 12) spans the box and its rack.
- **Damage:** 1: dents, scuffed bars, a cracked rear camera window, a dented lid; 2: a buckled
  bonnet, soot over the front, the lower bumper lip and the mirror hanging, both windows cracked,
  the box askew (its rear end dropped onto the rack); `scanner-gone`: the bent rack, sheared
  struts, a dangling wire, a shard; steam from the bonnet (car.ts, `SCAN.bonnet`).

Ids: `boss/ams-scan/body-<0|1|2>` (91 × 31, the damage states), `cabin` (5 frames: the driver's
looks), `scanner-<0|1|2>` (4 frames: down, lifting, up, scanning), `scanner-gone`, `wheel` (4 turn
frames), `text` (4), `blink`, `reticle`, `ticket`, `tow` (2), `hook`, `clamp` (4), `clamp-foot`
(2), `wreck` (8, deferred: rolled 45°, 90°, 135° and on its roof, 0–3 facing right and 4–7 facing
left; composited from the car strips at each density and never drawn flipped, so the lettering
reads left to right). 1× in the 64-colour palette; 2× / 4× from one density-generic drawer per
id (`art-hd.ts`, `art-hd-adds.ts`), outline A. About 7.2 MB at 4× (the left-facing wreck frames add 2.4 MB).
