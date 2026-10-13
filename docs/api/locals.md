# Locals API — the Amsterdam enemies (mission `ams`)

Reference for the **mission and boss agents**. Every id below is registered by the manifest
entries `locals` and `locals/art` (`src/game/content/locals/**`). Spec:
`docs/design/amsterdam.md` §2; fairness: GDD §4.11. Numbers are NORMAL. Tests:
`tests/content/locals.test.ts`.

## 0. Placing things

```ts
ctx.enter('fatbike-youth', 'right', { tag: 'w1' });                 // rides in from the right edge
ctx.spawn('fatbike-youth', 1700, 'ground', { gag: 'circles' });      // circling on the square
ctx.enter('fatbike-youth', 'left', { params: { pair: true } });      // passenger does the kick
ctx.enter('delivery-rider', 'right');                                // fast pass, TRING TRING!
ctx.spawn('delivery-rider', 0, 'ground', { from: 'behind' });        // x ignored: left view edge
ctx.spawn('seagull', 600, 'ground', { perch: true });                // y = its feet (lamp top)
ctx.spawn('seagull', 2100, 120, { flock: 3 });                       // a flock of 3, awake
ctx.spawn('seagull', 1500, 'ground', { gag: 'fries' });              // pecking stolen fries
ctx.enter('handhaver', 'right', { tag: 'adds' });
```

- **y is the feet** for riders, the handhaver and perched gulls (a lamp post top: pass the y of
  the lamp's top, no terrain needed). A flying gull spawned on the floor line lifts itself 24 px.
- **holds `ctx.waitClear()`**: all four enemies (tag `enemy`). A fatbike youth killed by a
  bullet / knife / blast gets up and runs off (`MAMA!`); he is dead and does not hold the wave.
- **Riders despawn off screen** (Enemy despawn margin 96 px after they were seen). Spawn them
  with `ctx.enter` or ahead of the player; they ride toward the player.
- **Gag bubbles**: `gagBubble(world, e, text, ticks)` (rider.ts) skips a gag line when another live
  gag bubble hangs within 56 × 32 px, so two riders side by side never print over each other.
- **Shared params**: `facing`, `hp`, `drop`, `tag` / `tags` (Enemy base). `enter` / `entry`
  (`left` / `right`) sets the side a rider or walker comes from.
- **Fairness is built in**: attack tokens from the telegraph to the end of the attack, every
  telegraph ≥ 18 ticks (×1.25 / ×1 / ×0.9 by difficulty) and it runs while the enemy is in the
  view; no attack from outside the view (8 px margin). Gags are free time (CAUGHT NAPPING).
- **Sounds** (played by id): `ams/bass-thump`, `ams/bell`, `ams/kick`, `ams/gull`, `ams/ticket`.

## 1. `fatbike-youth` — HP 20 (pair 30), soft, 300 (pair 500)

Hoodie, cap or hood, trackpants, white sneakers on a fat-tyre e-bike (speaker on the rack, phone
on the bar). Hurtbox 24×34 (rider + bike). 4 looks × 3 skins (+ pair sets), picked per spawn.

| phase | what | numbers |
|---|---|---|
| ride | toward the player | 1.8 px/tick; 0.8 within 90 px |
| tell | wheelie, `ams/bass-thump`, bubble `OI!` | starts with the player 4–48 px ahead, ≤ 40 px height difference, in view, token; 24 ticks at 0.8 px/tick |
| kick | box ahead (x +4…+24, y −22…−6) | 8 ticks; **a jump clears it**; touching the bike is harmless |
| recover | rides on (1.8) and off screen, or (50 %) brakes 20 ticks and turns for one more pass | `turn: true / false` forces it |
| gag `circles` | slow laps ±40 px round the spawn point, bass thump every 36 ticks | notices a player within 120 px (or a shot): double-take, then rides at him |

Params: `pair`, `gag` (`circles` / true), `enter`, `facing`, `look` (0–3), `skin` (`a`/`b`/`c`),
`turn`. Death: tumbles off, the cap flies (cap looks), runs off yelling `MAMA!`; the bike skids
on and fades (`<set>/bike` fx). Fire / crush deaths stay down. A pair's passenger jumps off and runs
away from the player (`<set>/passenger-flee` fx, 110 ticks).

## 2. `delivery-rider` — HP 10, soft, 200

Black jacket, black helmet, the green cube backpack (`EATS`), phone on the bar, a city bike.

| phase | what | numbers |
|---|---|---|
| ride | a fast pass, never stops | 2.2 px/tick |
| tell | `ams/bell`, bubble `TRING TRING!` | starts as soon as he is in the view (token), ≥ 20 ticks; he keeps ringing until the player is ≤ 22 px ahead |
| kick | the same kick box as the youth | 6 ticks while passing; **a jump clears it**; passed without a kick → rides off |
| gag `phone` | checks his phone, `SORRY, LATE ORDER!`, passes without kicking | a shot within 48 px wakes him (then he may still ring and kick) |

Params: `from` (`behind` = enters at the LEFT view edge, facing right; `left` / `right`), `gag`,
`enter`, `facing`, `skin`. Death: falls, the cube pops open and drops `pickup-food`
(`kind: 'cheese'`; `drop` overrides).

## 3. `seagull` — HP 10, soft, 150

Herring gull (white, grey back, black wing tips, yellow beak with a red spot). Hurtbox 20×13
round the body centre (perched: 18×18 above the feet). No body (flies itself).

| phase | what | numbers |
|---|---|---|
| perch / gag | `perch: true` asleep (`gag`), `gag: 'fries'` pecking fries | wakes with a player within 96 px, a shot / blast near, a shouting ally |
| fly | wobbly path to a hover spot 60 px beside and 64 px above the player | 1.4 px/tick, sway ±9 px |
| tell | flaps, gold flash, `ams/gull`, bubble `KAW!` | 20 ticks, in view, token; every ~110 ticks |
| dive | at the player's position | 3 px/tick, ≤ 170 px; **contact damage only while diving** |
| climb | back up | 36 ticks |

`flock: n` (2–5): one spawn = n gulls; they spread round the player (both sides, three heights)
and their dives are staggered 40 ticks apart (each still needs a token). Params: `perch`, `gag`
(`sleep` / `fries`), `flock`, `enter` (`left` / `right` / `top` = flies in), `facing`.
Death: feather puff, falls to the floor; over a `water` hazard it splashes and is gone.

## 4. `handhaver` — HP 20, soft, 300 (boss add, sections c / d)

Navy uniform and cap, yellow hi-vis vest, a ticket book. 3 skin sets.

| phase | what | numbers |
|---|---|---|
| walk | toward the player, stops 130 px away (`hold`), stops at walls and ledges | 0.6 px/tick |
| tell | opens the book, licks the pencil, bubble `BOETE!`, `ams/ticket` | 24 ticks; player ≤ 220 px, in view, token, < 2 own tickets in the air |
| throw | a `boete-ticket` at chest height | then recover 40, pause 50 ± 20 |

Death: swoons; tickets scatter like confetti.

### `boete-ticket` (projectile)

White paper with a red title. Flies at **25 px above the thrower's feet**, 1.6 px/tick (× the
difficulty's enemy shot speed), with a ±1.5 px sine flutter (period 24 ticks); box 8×5, so its
lowest edge stays above y −21: **a crouch (hurtbox 20 px) dodges it**. 10 damage (`bullet`),
erasable, not shootable, life 300 ticks. `ctx.spawn('boete-ticket', x, 'ground', { facing: -1 })`
or `throwTicket(world, x, feetY, dir, speed)` from code.

## 5. Sprites

`enemy/<set>/<anim>` with `<set>` = `fatbike-youth` (look 0, skin a), `fatbike-youth-<look><skin>`,
`fatbike-youth-pair-<look><skin>`, `delivery-rider` (skin b), `delivery-rider-a|c`, `seagull`,
`handhaver` (skin a), `handhaver-b|c`. Riders: idle, ride, gag, alert, tell, kick, photo-pose,
die, die-knife, die-blast, die-burn, die-crush, flee, bike; extras `enemy/fatbike-youth/cap`,
`enemy/delivery-rider/food-cube`. Gull: walk, idle, perch, gag, gag-fries, alert, tell, attack,
die*, photo-pose, feather. Handhaver: idle, walk, alert, tell, throw, photo-pose, die*. Ticket:
`enemy/boete-ticket/fly`. Look at them: `npm run sprites -- enemy/seagull/`.

## 6. Boss `ams-mayor` — ROBO-HALSEMA, THE IRON MAYOR (`src/game/content/bosses/ams/`)

Registered by the manifest entry `bosses/ams`. Spec: `docs/design/amsterdam.md` §3. Tests:
`tests/content/boss-ams.test.ts`. Numbers are NORMAL (`geometry.ts` → `MAYOR`).

```ts
const boss = ctx.spawn('ams-mayor', 1190, 'ground');      // x = the Stopera doors, faces left
yield ctx.bossIntro('ROBO-HALSEMA', { subtitle: 'THE IRON MAYOR', music: 'ams-boss' });
yield () => boss instanceof Boss && boss.defeated;         // or the m1 waitBoss helper
```

- **Intro** (200 ticks, invulnerable, `autoStart`): dim in the doorway, walks 40 px forward
  (fights at x − 40), bubbles `THE NEIGHBOURS / COMPLAINED.` and `FABEL FRIET IS / GESLOTEN!`.
  The mission plays the banner and the music.
- **Parts** (required-parts model, HP × difficulty × co-op): `stamp-arm` 1,200, `chain` 1,050,
  `medallion` 1,350 (armoured until the arm and the chain are broken), all required; `head` 750
  optional (broken: no more letter rain). `legs` / `torso` only ping; a blast against them goes to
  the nearest live part within 48 px. The HP are the brief's ×3 (brief values gave an 11 s fight).
  Score 20,000 + 1,000 per part.
- **Reach**: the stamp is hit by forward shots. The 45° diagonal (up + toward) hits the chain from
  84–132 px and the medallion (centre 76 px up) from 30–84 px in front of her anchor.
- **Phase 1** (opens after 40 ticks, so the intro bubble has cleared): stamp slam (arm up + a
  red-rimmed floor shadow, T 30; slam 56×22 + a `stamp-wave` each way,
  jump; HARD two pairs) and letter rain (hatch, T 24; 4–6 `noise-letter`, 10 HP, shootable).
  Adds: `handhaver` from alternating view edges every 420 ticks, ≤ 3 alive (tag
  `ams-mayor-officer`; all adds carry `ams-mayor-add`).
- **Phase 2** (arm or chain broken; 60-tick intermission, `RULES ARE RULES!`): chain whip high
  (crouch) / low (jump) alternating, T 28 (the loop whirls high or low with a gold glow;
  `ams/chain` winds up at pitch 1.15 for high, 0.8 for low), a 124-px lash (contact box, lanes
  22–38 / 0–14 px over the floor; more than 124 px in front of her anchor is always safe), 44-tick
  recovery; letter rain. Adds: a gull flock of 3 every 600 ticks (none while gulls live).
- **Phase 3** (both broken; `THIS WILL COST YOU / A BIG BOETE!`): shield fan (core glow, T 24;
  5 `shield-shot`s at 6°, 12°, 30°, 54° and 72° below the horizon; HARD adds a 6th at 42°.
  Safe lanes in front of the muzzle: standing 149–189 px; crouching 69–80 or 149–236 px; HARD
  closes the near crouch lane) and stomp (landing shadow, T 24; a
  48-px hop forward, then back; only the 48×12 landing under her feet hurts). Adds: one
  `delivery-rider` pass at a time, alternating `from: 'behind'` / right.
- **Idle life**: while she stands in the fight, the upper body breathes 1 px every 32 ticks and
  the eyes blink (head frame 3) for 6 ticks every 150 ticks.
- **Death** (230 ticks, `TOT ZIENS...`): blasts, the wig flies off, the head boings on a spring,
  she sits and powers off, the xl blast, then `bossDefeated` and removal.
- **Sandbox params**: `hpScale` (HP ×), `phase` (1–3: starts with the earlier parts broken):
  `npm run arena -- --spawn "ams-mayor@+260{phase:3}" --god --hold fire`.
- **Sprites** `boss/ams-mayor/…`: `legs`, `body-0|1|2`, `arm-back`, `stamp-arm-0|1|2` (the arm is drawn behind the block, so GESLOTEN is never covered; frames
  3–5 are pre-mirrored so GESLOTEN reads when she faces left), `stamp-arm-gone`, `chain-0|1|2`,
  `chain-gone`, `medallion-0|1|2`, `head-0|1|2`, `wig`, `spring`, `shadow`, `lash`,
  `stamp-wave`, `noise-letter`, `shield-shot`. Sounds: `ams/stamp` (the whole stamp telegraph:
  played on its first tick at rate 30 / telegraph, so its baked-in slam lands on the slam),
  `ams/chain`, `ams/ticket`, `hit/ground` + `hit/metal` (intro slam, HARD extra slams, stomp
  landing), `machine/pipe-charge`, `machine/brake`, `boss/voice-crack`.
