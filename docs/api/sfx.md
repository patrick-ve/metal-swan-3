# Sound effects API — `src/game/content/sfx/`

Owner: sfx agent. Every sound of the game is an original synth recipe (`docs/api/media.md` §9.1).
The ids and their descriptions are GDD §12.1 / §15.7; the game-layer names are ARCHITECTURE §7.1.
The module registers everything at import time (manifest entry `sfx`). Tests:
`tests/content/sfx.test.ts` (ids, levels, GDD lengths, loops, aliases, synth additivity) and
`tests/content/audio.test.ts`.

## 1. Playing sounds

```ts
world.audio.sfx('enemy/alert');                              // one-shot
world.audio.sfx('enemy/aria', { pitch: ARIA_STEPS[combo] }); // pitch = playback rate (0.1–4)
world.audio.sfx('swan/step', { vol: 0.7, pan: -0.3 });
world.audio.sfxLoop?.(this.loopKey, 'machine/copter', { vol: 0.5, pitch: 1.35 }); // every tick
world.audio.stopSfx?.(this.loopKey);                          // in onRemove / on death, always
```

- **Loops** (`SFX_LOOPS`) must be played with `sfxLoop` (a plain `sfx` cuts off with a click):
  `weapon/laser` (held beam), `swan/glide`, `machine/tank-move`, `machine/copter` (also the
  piano bomber's prop at pitch 0.55; raise the pitch for a tell), `creature/kazoo` (one loop per
  drone formation), `boss/bagpipe-drone` (the WINDBAG's drones), `env/radio-static` (briefing),
  `env/ice-melt` (rising meltwater), `env/wind` (the air jet's hiss), `env/avalanche` (the roar
  while the avalanche chases; fade it out with `stopSfx(key, 30)`). Call `sfxLoop` every tick to
  update vol / pitch / pan; use one key per owner (`loopKey`), and stop it in `onRemove`.
- **Loops that also work as one pass**: `env/wind` is a soft bed with one gust per 2.9 s pass; its
  gust starts and ends inside the pass, so `sfx('env/wind')` plays exactly one m3 gust (60 streak
  ticks + the 120-tick push). Every other loop must go through `sfxLoop`.
- **Voices and gaps**: each recipe caps its simultaneous instances (`voices`, guns 6, boss cues 1)
  and the minimum time between two starts (`gap`), so calling a sound every tick is safe: extra
  calls are dropped. `vehicle/alarm` plays one second of alarm per call (gap 0.9 s).
- **Pitch for variants**: Helium Head plays the player's own sounds × 1.6 (`sfxPitch`); the knife
  combo aria rises a major-scale step per kill (`ARIA_STEPS`); big enemies may reuse a creature
  sound lower (pitch 0.6–0.8), small ones higher.
- **Death yelps**: pick one of `ENEMY_DIE_SFX` (`enemy/die-1..3`) with `world.fxRng`;
  `enemy/scream` is the GDD's falling yelp for deaths only.
- `jitter` (a random pitch spread, ±5 % on the machine gun) is data on the recipe (`sfxJitter(id)`);
  the browser output does not apply it yet (request to the engine owner).

## 2. Telegraph sounds last their telegraph (GDD §4.11 rule 2)

Start the sound on the first telegraph tick; it ends when the attack comes.

| Ticks | Sounds |
|---|---|
| 20 | `enemy/whistle`, `enemy/grenade` (fuse), `machine/scratch`, `creature/bat-screech` |
| 30 | `enemy/drumroll`, `machine/pipe-charge`, `machine/anthem-crackle`, `creature/windup`, `boss/trombone-pull` |
| 32–36 | `enemy/cymbal-raise` (32), `enemy/tuba-inhale` (36), `boss/piano-gliss` (36) |
| 40 | `enemy/bassoon-aim`, `creature/croak-build`, `boss/calliope-scale`, `boss/beater-pull`, `boss/piano-rattle` |
| 45 | `enemy/piccolo-whistle`, `machine/tank-charge`, `creature/rattle` (three "chk-chk"), `boss/harp-charge` |
| 50 | `enemy/windup`, `machine/piano-whistle`, `boss/foghorn`, `boss/goose-wiggle` |
| 20–30 (`ams`) | `ams/bell` (delivery rider, 20; two dings), `ams/gull` (seagull, 20; "KAW!"), `ams/bass-thump` (fatbike youth, 24; two sub thumps + muffled beat), `ams/chain` (CHAIN WHIP, 26; rattle), `ams/stamp` (STAMP SLAM, 30: the creak is the tell and the slam lands at 0.5 s = tick 30, so play it once on the first telegraph tick and no separate hit sound) |

The attack sounds that follow: `enemy/tuba-blast`, `enemy/cymbal-crash`, `enemy/drum-hit`,
`enemy/rifle`, `enemy/piccolo-shot`, `creature/croak`, `machine/piano-crash`, `boss/hihat-open`,
`boss/organ-chord`, `boss/goose-honk`, `boss/scream` (1.2 s), `boss/voice-crack`, `boss/deflate` (1.5 s).
Mission `ams` attacks: `ams/kick` (the fatbike kick: whoosh + thud, the thud at 0.1 s),
`ams/ticket` (a thrown `boete-ticket`: a paper flutter); cheering reuses `env/applause`.

## 3. Aliases (`SFX_ALIASES`)

Older or game-layer names that play the very same samples as their target (never delete one):
`weapon/machine-gun`→`weapon/mg`, `weapon/cannon`→`vehicle/cannon`, `bomb/throw|bounce`→
`weapon/grenade-throw|bounce`, `hit/armor`→`hit/metal`, `player/respawn`→`player/spawn`,
`item/bomb`→`item/bombs`, `crate/break`→`item/crate-break`, `vehicle/mount|eject`→
`vehicle/enter|exit`, `enemy/shot`→`enemy/rifle`, `enemy/die`→`enemy/die-1`, `ui/tally-tick`→
`ui/tally`, `boss/warning`→`ui/warning`, `hostage/maestro`→`hostage/composer`,
`pickup/{weapon,bombs,food,gem,1up}`→`item/…`.

Extra ids that are not in GDD §15.7: `weapon/vulcan`, `explosion/xl`, `hit/ground`, `enemy/aim`
(rifle raised), `enemy/die-1..3`, `vehicle/cannon`, `item/pickup`, `item/score`, `ui/tally`,
`ui/alarm`, `ui/go` (ONWARD), `ui/warning`.

## 4. Level plan

Measured as K-weighted momentary maximum loudness (LUFS, 400 ms windows); every peak ≤ 0.9.

| Tier | LUFS | Sounds |
|---|---|---|
| Frequent | −27 … −19 | steps, hits, guns, the beak gun, menu ticks, metronome |
| Loops | −25 … −18.5 | engines, rotors, drones, glide wind, static, wind (the avalanche roar is Big) |
| Middle | −22 … −15 | telegraphs, pickups, hostages, vehicle cues, enemy voices |
| Big | −15 … −10 | explosions (s < m < l < xl), boss cues, `swan/honk` (the loudest Swan sound), `env/avalanche` |

Short sounds are peak-limited (0.88), so a 40 ms gun shot measures lower than it sounds. Callers
should leave `vol` at 1 and lower it only for repeats or distance (the Swan's step uses 0.7).

## 5. Synth fields added for this module (`src/engine/synth.ts`, additive)

docs/api/media.md §9.1 lists the original fields. These are new; a recipe without them renders
exactly as before (`tests/content/sfx.test.ts` keeps fingerprints of the engine defaults).

| Field | Meaning |
|---|---|
| layer `tremolo: {rate, rateTo?, depth, shape?, delay?, width?}` | gain LFO (`'sine'`, `'square'`, `'saw'`…): gates, rotor chop, applause, ratchets that speed up (`rateTo`) |
| layer `fm: {ratio, index, indexTo?, decay?}` | phase modulation on tonal waves: bells (`fmBell`), clangs, buzz |
| layer `bend: [[t, semitones]…]` | pitch breakpoints on top of the sweep: scoops, sighs, cracks |
| recipe `loop`, `loopFade` | renders a seamless loop for `sfxLoop` (cross-fade, default 0.05 s) |
| recipe `jitter` | random pitch spread per play (data: `sfxJitter(id)`; the browser output applies it on each play: `jitterPitch(pitch, sfxJitter(id), Math.random())`) |

## 6. Adding or changing a recipe

Recipes live per family: `weapons.ts`, `player.ts` (player, items, hostages), `vehicles.ts`
(vehicles, Swan, fleet), `legion.ts`, `machines.ts` (machines, creatures), `bosses.ts`,
`world.ts` (`env/*`), `ui.ts`, `ams.ts` (mission `ams`: `ams/*`). `kit.ts` has the builders: `tone`, `noise`, `click`, `clack`,
`bell`, `fmBell`, `note`, `seq`, `hits`, `scatter` (fixed pseudo-random times), `loopRecipe`
(seamless loops: pick tones and LFO rates that make whole cycles in the loop length) and
`honk` (the SWAN-3 horn: `swan/honk`, `swan/migrate`, `boss/goose-honk`, `trumpeter/bail`,
`ui/select-confirm`). Each recipe's noise seed is pinned to its id, so aliases sound identical.

Check a change with `npm run audio -- <prefix> --wav --out tmp/<label>` (flags SILENT, HOT, LONG,
DC; WAVs for a human) and `npx vitest run tests/content/sfx.test.ts`.
