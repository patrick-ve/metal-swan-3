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

`boss/ams-scan/body-<0|1|2>` (91 × 31, the damage states), `cabin` (5 frames: the driver's
looks), `scanner-<0|1|2>` (4 frames: down, lifting, up, scanning), `scanner-gone`, `wheel`
(4 turn frames), `text` (3: `PARKEERCONTROLE`, `Gemeente Amsterdam`, `24`; readable at 2× and 4×,
1× print hints), `blink`, `reticle`, `ticket`, `tow` (2), `hook`, `clamp` (4), `clamp-foot` (2),
`wreck` (4 flip frames, deferred). 1× in the 64-colour palette; 2× / 4× from one density-generic
drawer per id (`art-hd.ts`, `art-hd-adds.ts`), outline A. About 4.7 MB at 4×.
