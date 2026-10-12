# Sound and UI reference — songs, sound effects, HUD, flow screens

For the mission and boss builders. Owners: `src/game/content/{music,sfx,ui}/`, `src/game/hud.ts`,
`src/game/context.ts` (HudState), `src/game/scenes/**`. Deeper references: [sfx.md](sfx.md) (every
sound rule, telegraph table, loudness plan), [media.md](media.md) §9 (the audio engine),
[game.md](game.md) §11 (HUD and scene flow). All numbers below are measured from the registered data.

## 1. Songs (GDD §12.2, §15.8)

Play a song from a section script with `ctx.music(id, fadeTicks?)` (null stops), or set it on the
data: `MissionDef.music` (whole mission), `SectionDef.music` (one section), `MissionDef.bossMusic`
(what `ctx.bossIntro()` starts; default `boss`), `BossIntroOpts.music` (one fight). The runner
ignores a call for the song that already plays; a different id starts the new song **from its
first bar** (see §1.2).

| id | for | bpm | one pass | loop (from) | ticks / pass |
|---|---|---|---|---|---|
| `title` | title, attract, HOW TO PLAY | 112 | 85.7 s | 68.6 s (17.1 s) | 5143 |
| `select` | mode + character select | 128 | 30.0 s | whole | 1800 |
| `briefing` | intro card (radio box) | 96 | 20.0 s | whole | 1200 |
| `m0` | test mission m0 | 150 | 35.2 s | 32.0 s (3.2 s) | 2112 |
| `m1` | m1, regatta march (6/8) | 132 | 47.3 s | 43.6 s (3.6 s) | 2836 |
| `m2` | m2, hot and driving | 140 | 96.0 s | 82.3 s (13.7 s) | 5760 |
| `m3` | m3, cold and climbing | 120 | 112.0 s | 96.0 s (16.0 s) | 6720 |
| `m4` | m4, night-club swing | 150 | 89.6 s | whole | 5376 |
| `m5-sky` | m5-a flight | 160 | 72.0 s | 60.0 s (12.0 s) | 4320 |
| `m5-organ` | m5-b, inside the organ | 108 | 71.1 s | whole | 4267 |
| `mini-boss` | golden-goose, big-head | 150 | 25.6 s | whole | 1536 |
| `boss` | bosses m1–m4 | 156 | 67.7 s | 61.5 s (6.2 s) | 4062 |
| `boss-final` | final boss | 168 | 80.0 s | 68.6 s (11.4 s) | 4800 |
| `boss-final-fast` | the maestro's Tempo! | 200 | 19.2 s | whole | 1152 |
| `anthem` | anthem cut-scenes | 84 | 22.9 s | **once** | 1371 |
| `mission-complete` | tally start (runner plays it) | 140 | 6.0 s | **once** | 360 |
| `continue` | continue countdown | 120 | 12.0 s | whole | 720 |
| `game-over` | game over | 80 | 5.1 s | **once** | 304 |
| `ending` | the ending scene | 116 | 66.2 s | **once** | 3972 |
| `credits` | credits roll | 100 | 76.8 s | whole | 4608 |
| `high-score` | name entry, high scores | 132 | 14.5 s | whole | 873 |

```ts
// MissionDef
music: 'm1', bossMusic: 'boss',
// a section script
ctx.music('anthem', 30);           // a cut-scene: plays once, then silence
yield 1371;                        // wait for it (one pass in ticks)
ctx.music('m1', 60);               // back to the mission song (starts at bar 1)
yield ctx.bossIntro('RIVERBOAT', { subtitle: 'COMMODORE BLARE WILL NOT LEAVE THE STAGE' });
```

### 1.1 Music rules a level designer must know

- `m0` has its own song (the GDD line "m0 uses m1" is superseded). `anthem` has the Legion
  anthem with one wrong note (the 7th, a semitone flat); the theme exists as data:
  `ANTHEM_THEME`, `anthemLine({ transpose, minor, inTune })` in `content/music/index.ts`.
- One-shot songs (`anthem`, `mission-complete`, `game-over`, `ending`) end in silence. Start the
  next song yourself.
- `boss-final-fast` is its own song (not a faster `boss-final`). Bar 1 is already at full speed;
  a Tempo! of 300 ticks is about 4 bars.
- Flow screens choose their own music; a mission never needs to play `briefing`,
  `mission-complete`, `continue`, `game-over`, `ending` or `credits`.
- The ending scene plays `ending` from its start and switches to `credits` when THE PARADE (the
  credits roll) starts (GDD §13.12).

### 1.2 Known limits

- No start offset: after a Tempo!, `ctx.music('boss-final', 30)` starts again at the 11.4 s
  intro, not at section A. An engine option `from` is requested (§5).
- The levels are checked by numbers (Web Audio render: −19.5 … −23.7 dB RMS, peaks ≤ 0.73).
  Nobody has listened to the songs yet.

## 2. Sound effects (GDD §12.1, §15.7)

All 190+ ids of GDD §15.7 exist (`src/game/content/sfx/`); a test reads the list from the GDD.
Full rules: [sfx.md](sfx.md). What missions and bosses use most:

```ts
world.audio.sfx('boss/warning');                              // one-shot
world.audio.sfxLoop?.(this.loopKey, 'boss/bagpipe-drone', { vol: 0.6 }); // every tick while it sounds
world.audio.stopSfx?.(this.loopKey, 30);                      // on death AND in onRemove
```

- **Loops** (only through `sfxLoop`; a plain `sfx` clicks at the end): `weapon/laser`,
  `swan/glide`, `machine/tank-move`, `machine/copter`, `creature/kazoo`, `boss/bagpipe-drone`,
  `env/radio-static`, `env/ice-melt`, `env/wind`, `env/avalanche`. Nobody plays
  `creature/kazoo` or `boss/bagpipe-drone` yet.
- **Telegraphs:** each telegraph sound lasts its telegraph (20–50 ticks, table in sfx.md §2).
  Start it on the first telegraph tick.
- **Calls every tick are safe:** every recipe caps its voices and the time between two starts.
- **Set pieces:** `env/avalanche` (loop; fade out with `stopSfx(key, 30)`), `env/wind` (loop; one
  `sfx('env/wind')` = one m3 gust: 60 + 120 ticks), `env/rimshot`, `env/applause`,
  `env/water-splash`, `explosion/s|m|l`.
- `ctx.bossIntro()` plays `boss/warning` by default (`BossIntroOpts.sfx`).
- A missing id is silent; the sim lists it under `missingSfx`.

## 3. HUD (GDD §13.7) — what a script or an entity can show

`hudOf(world)` returns the `HudState`. Section scripts have `ctx.banner` and `ctx.callout`.
The HUD draws everything in screen space at 1x (384×216). Positions are fixed by GDD §13.7.

| call | shows | defaults |
|---|---|---|
| `ctx.banner(text, { sub?, detail?, style?, ticks? })` | big centred text at y 90 (`style: 'warning'` red blink at y 84) | 150 ticks |
| `ctx.callout(text, { ticks?, color? })` | small centred line at y 60; up to 3 stack | 90 ticks |
| `hud.bubble(target, text, { kind?, ticks?, dy?, tip? })` | speech bubble over an entity or a `{x, y}` point; ≤ 24 chars × 2 lines | 120 ticks, `kind: 'gag'` |
| `hud.pointer(target, text, { ticks?, dy? })` | blinking word + 3 gold chevrons over a target | until cleared, or the target dies |
| `hud.clearBubble(target)` · `hud.clearPointer(target)` | remove early | |
| `hud.showGo(dir?)` / `ctx.showGo(dir?)` | ONWARD prompt (`'right'` 330–378, y 100; `'up'` y 40; `'down'` y 176) | after an unlock it shows by itself |
| `hud.message(slot, text, ticks?)` | pop-up line in a player's HUD block | 90 ticks |
| `flash(world, color, alpha?, ticks?)` | screen flash (REDUCE FLASHES caps it at 30 %) | 0.8, 8 ticks |
| `hud.hidden = true` | hide the whole HUD (cut-scenes) | |

```ts
import { CALLOUTS, HINTS } from '../../scenes/flow-data';
const hud = hudOf(world);
hud.pointer(frontDrummer, HINTS.stomp);            // m1-c: STOMP! over the front drummer
ctx.callout(CALLOUTS.drumRoll);                    // 'DRUM ROLL! +1000' — award the points yourself
awardScore(world, player.index, 1000);             // events.ts: (world, slot, points, x?, y?)
hud.bubble(rifleman, 'MMF!');                      // a gag: SPEECH BUBBLES OFF hides it
hud.bubble({ x: 640, y: 120 }, 'THIS WAY!', { kind: 'hint' }); // a hint: always shows
```

- **Bubble kinds:** `'gag'` hides with the SPEECH BUBBLES OFF option; `'hint'` and `'radio'`
  (navy text) always show. `RIDE?`, `STOMP!` and `SHOOT!` are hints.
- **Texts:** `CALLOUTS` (`checkpoint`, `caughtNapping`, `quietPlease`, `strike`, `fullSet`,
  `vandalism`, `setPiece`, `stylePoints`, `drumRoll`, `noScratches`, `oneMoreTry`) and `HINTS`
  (`stomp`, `shoot`, `ride`) in `scenes/flow-data.ts`. A callout never adds points.
- **Drawn by the HUD itself (no call needed):** scores, weapon icon (no digits for unlimited
  weapons), grenades `x10` (in a vehicle: shell icon + the bare count), lives, hostages, `CONT n`,
  vehicle name and cells, the Helium Head bar, the timer, score pop-ups (from `score` events), the
  boss bar (from bosses tagged `boss`, BOSS BAR option), the `RIDE?` bubble of an empty vehicle,
  and the Swan marker (a ridden Swan above the view).
- **Boss bar:** drawn for the first live `Boss` tagged `boss`: its `name` (small, y 198) over a
  192×4 bar at (96, 207), with a white flash when a part breaks. Do not draw an own bar.

## 4. Mission flow and the newspaper tally (GDD §13.6, §13.11, §14.4)

Every mission needs two things from the mission builder: its **card** and its **hostage counts**.

- **Intro card** (`MissionIntroScene`, at most 360 ticks, start skips after 60, music
  `briefing`): the cards of m0–m5 already exist in `content/ui/cards.ts` (`MISSION_CARDS`: label,
  name, place, 2 briefing lines, headline, announcer line, line map). A mission without a card
  gets one from `MissionDef.name` / `subtitle`. To change a card, call
  `defineMissionCard({ id, label, name, place, briefing, headline, announce?, startSub?, map? })`.
- **Start banner:** the card's `label` + `startSub` (`START!`); `MissionDef.startBanner` overrides it.
- **Tally** (`MissionCompleteScene`, THE LOWMERE LISTENER, moves on after 600 ticks). Fill
  `MissionDef.hostages` with the hostages placed per section id, for example
  `hostages: { a: 4, b1: 3, b2: 3, c: 3 }`. Without it STANDING OVATION and the hostage star never
  pay. The other lines fill themselves:
  - BOSS SPEED BONUS: from the first `bossPhase` event (phase 0) to `bossDefeated`, in the boss
    section: max(0, 90 − s) × 200, at most 18,000 (m5: 240 s over the three final stages).
  - VEHICLE AT THE FINISH: a player is mounted when `bossDefeated` fires.
  - NO SCRATCHES: a vehicle leaves a section (or the mission ends) at full cells.
  - Golden record: a `pickup` with `params.kind: 'golden-record'`.
  - HATS COLLECTED (Pip only): infantry kills, outfit variants included.
- **Next mission:** `MissionDef.next`, else the next registered mission. After the last mission
  (m5) the game plays `EndingScene` → `FinalTallyScene` → name entry → high scores.
- **Testing a mission without the menus:** `?mission=m2&section=b` in the browser, or
  `startNewGame(app, { mission: 'm2' })` in a test.

## 5. Known limits and open requests

- 1 PLAYER mode: a second player cannot join mid-game (all devices drive player 1). In 2 PLAYERS
  mode, start on player 2's controls joins at any time; the joiner gets the first free Cygnet.
- The `ui/ending-flyer` art stands in for the Trumpeter in the ending until
  `vehicle/trumpeter/move` has the points `seat`, `neck`, `legs`, `tail`.
- Not built: the attract demo that rides the Swan on `m1-c` (GDD §15.9 item 5, "later").
- Requested from the engine owner: `MusicOpts.from` (start a song at an order index, for the end
  of a Tempo!) and the per-play pitch jitter `sfxJitter(id)` in the browser audio output.
