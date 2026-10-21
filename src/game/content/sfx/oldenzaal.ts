/**
 * Sound effects of mission `oldenzaal` owned by AUDIO (docs/design/oldenzaal.md §11): the town
 * ('oz/env/…'): thunder, the rain and wind loops, the ambience loops of ids.ts `OZ_AMBIENCE`, the
 * church bell, the doors, the candles, a street lamp and a crow. The other owners register their
 * own prefixes in their folders (WUGHOST 'oz/wu/', 'oz/ghost/', 'oz/meal/'; revision 2 ZOMBIES
 * 'oz/zombie/', RUIN 'oz/ruin/', STATUE 'oz/statue/', CHURCH 'oz/church/', TOWER 'oz/tower/' and
 * 'oz/swan/'). Manifest id 'sfx/oldenzaal'; registers at import
 * time. The ElevenLabs takes of the sample group 'mission:oldenzaal' (wave B) replace these when
 * loaded; these recipes stay the fallback.
 *
 * - 'oz/env/thunder' (2.8 s): a close strike for the lightning flash (LIGHT plays it): a dry crack,
 *   then a rolling low rumble.
 * - 'oz/env/thunder-far' (2.4 s): a distant roll with a soft start (no crack).
 * - 'oz/env/rain' (loop, 2 s): steady rain on pavers and roofs, a few close drops.
 * - 'oz/env/wind' (loop, 4 s): a cold wind with slow gusts and a faint whistle.
 * - 'oz/env/street' (loop, 6 s; OZ_AMBIENCE.street): the town at dusk: a low wind, the hum of a
 *   street lamp, a far creak and a far rattle.
 * - 'oz/env/nave' (loop, 6 s; OZ_AMBIENCE.nave): the empty church: a dark room tone, a low hum
 *   under the vaults, small candle crackles, a far drip with its echo.
 * - 'oz/env/storm' (loop, 4 s; OZ_AMBIENCE.storm): the tower in the storm: heavy rain, the wind
 *   in the openings, a low roll.
 * - 'oz/env/bell' (3.4 s): one big toll of a church bell (the tower; the nave from afar).
 * - 'oz/env/bell-creak' (0.9 s): a swinging bell's wooden headstock and rope.
 * - 'oz/env/door-slam' (1.4 s): the heavy wooden doors of the nave slam, the hall answers.
 * - 'oz/env/door-creak' (1.6 s): an old heavy door creaks open (the basilica's red doors).
 * - 'oz/env/candle-flare' (0.6 s): a row of candles flares up.
 * - 'oz/env/candles-out' (0.9 s): a cold gust, the flames die.
 * - 'oz/env/lamp-flicker' (0.5 s): a street lamp buzzes and clicks as it flickers.
 * - 'oz/env/crow' (0.7 s): two hoarse caws from a roof (a crow, never a sampled animal).
 *
 * Levels: every loop sits at least 4 LU (momentary max) under the pistol and the enemy shot at the
 * gain the game plays it (the ambience at 0.8, runner.ts `setAmbience`); the storm's rain is
 * bright, so its level is low on the meter but it still reads as a storm.
 *
 * Loops follow sfx/kit.ts `loopRecipe`: flat envelopes, tones and LFOs with whole cycles in the
 * loop, no recipe echo (its tail would not wrap); the far echoes are written as delayed copies.
 * Respect (docs/ORIGINALITY.md, oldenzaal exception): the church sounds are plain and calm,
 * nothing breaks or burns.
 */
import { defineSfx } from '../../../engine/synth';
import { BP, clack, fmBell, HP, hz, loopRecipe, LP, noise, scatter, tone, type Recipes } from './kit';

const RAIN_LEN = 2;
const WIND_LEN = 4;
const STREET_LEN = 6;
const NAVE_LEN = 6;
const STORM_LEN = 4;

/** Close drops in a loop: short bright ticks at fixed pseudo-random times (`scatter`). */
function drops(n: number, len: number, seed: number, vol: number): ReturnType<typeof tone>[] {
  const t = scatter(n, seed);
  const f = scatter(n, seed + 7);
  return t.map((u, i) => tone('sine', 2200 + f[i] * 1800, 900 + f[i] * 500, 0.025, vol * (0.5 + f[i] * 0.5), { delay: u * (len - 0.06) }));
}

/** Candle crackles: tiny high noise ticks. */
function crackles(n: number, len: number, seed: number, vol: number): ReturnType<typeof noise>[] {
  return scatter(n, seed).map((u, i) => noise(0.006 + (i % 3) * 0.003, vol, HP(3500), { delay: u * (len - 0.03) }));
}

const RECIPES: Recipes = {
  'oz/env/thunder': {
    vol: 0.62,
    voices: 2,
    gap: 0.4,
    length: 2.8,
    layers: [
      // The crack.
      noise(0.12, 0.5, HP(1800), { drive: 1 }),
      noise(0.3, 0.45, BP(900, 300, 0.8), { delay: 0.02 }),
      // The roll: low noise that swells and rolls, a sub that sinks.
      { wave: 'noise', env: { a: 0.08, d: 2.5 }, vol: 0.9, delay: 0.06, filter: LP(420, 110), tremolo: { rate: 3.2, depth: 0.45 } },
      { wave: 'noise', env: { a: 0.3, d: 1.9 }, vol: 0.5, delay: 0.5, filter: LP(180), tremolo: { rate: 1.7, depth: 0.5 } },
      tone('sine', 58, 34, 1.8, 0.6, { delay: 0.04 }),
    ],
  },
  'oz/env/thunder-far': {
    vol: 0.6,
    voices: 2,
    gap: 0.4,
    length: 2.4,
    layers: [
      { wave: 'noise', env: { a: 0.35, d: 1.9 }, vol: 0.9, filter: LP(260, 90), tremolo: { rate: 2.4, depth: 0.5 } },
      tone('sine', 46, 32, 2.1, 0.45, { env: { a: 0.3, d: 1.8 } }),
    ],
  },
  'oz/env/rain': loopRecipe(
    RAIN_LEN,
    0.11,
    [
      { wave: 'noise', vol: 0.45, filter: HP(1600) },
      { wave: 'noise', vol: 0.22, filter: BP(5200, undefined, 0.7), tremolo: { rate: 3 / RAIN_LEN, depth: 0.25 } },
      { wave: 'noise', vol: 0.18, filter: LP(500), tremolo: { rate: 1 / RAIN_LEN, depth: 0.3 } },
    ],
    drops(9, RAIN_LEN, 41, 0.18),
  ),
  'oz/env/wind': loopRecipe(WIND_LEN, 0.5, [
    { wave: 'noise', vol: 0.6, filter: BP(520, undefined, 0.8), tremolo: { rate: 1 / WIND_LEN, depth: 0.55 } },
    { wave: 'noise', vol: 0.25, filter: BP(1250, undefined, 3), tremolo: { rate: 2 / WIND_LEN, depth: 0.7 } },
    // The whistle through a gap: a faint tone that wavers (330 Hz × 4 s and 0.5 Hz × 4 s: whole cycles).
    { wave: 'sine', freq: 330, vol: 0.035, vibrato: { rate: 2 / WIND_LEN, depth: 0.8 }, tremolo: { rate: 1 / WIND_LEN, depth: 0.8 } },
  ]),
  'oz/env/street': loopRecipe(
    STREET_LEN,
    0.85,
    [
      // A low wind along the shop fronts.
      { wave: 'noise', vol: 0.55, filter: LP(650), tremolo: { rate: 1 / STREET_LEN, depth: 0.45 } },
      { wave: 'noise', vol: 0.12, filter: BP(1600, undefined, 2), tremolo: { rate: 2 / STREET_LEN, depth: 0.7 } },
      // The street lamp's hum (100 Hz and its double; whole cycles in 6 s).
      { wave: 'sine', freq: 100, vol: 0.025 },
      { wave: 'sine', freq: 200, vol: 0.012, tremolo: { rate: 3 / STREET_LEN, depth: 0.5 } },
    ],
    [
      // A far creak (a shop sign on its chain).
      { wave: 'saw', freq: 180, bend: [[0, 0], [0.25, 2], [0.5, -1]], env: { a: 0.05, d: 0.45 }, vol: 0.05, delay: 1.7, filter: BP(900, undefined, 4), tremolo: { rate: 22, depth: 0.6 } },
      // A far shutter rattles twice.
      noise(0.05, 0.06, BP(1300, undefined, 1.5), { delay: 4.1 }),
      noise(0.05, 0.05, BP(1200, undefined, 1.5), { delay: 4.22 }),
    ],
  ),
  'oz/env/nave': loopRecipe(
    NAVE_LEN,
    1.1,
    [
      // The room: dark, still air under the vaults.
      { wave: 'noise', vol: 0.5, filter: LP(320), tremolo: { rate: 1 / NAVE_LEN, depth: 0.25 } },
      // A low hum (55 Hz and 82.5 Hz: whole cycles in 6 s).
      { wave: 'sine', freq: 55, vol: 0.06, tremolo: { rate: 1 / NAVE_LEN, depth: 0.4 } },
      { wave: 'sine', freq: 82.5, vol: 0.03, tremolo: { rate: 2 / NAVE_LEN, depth: 0.5 } },
    ],
    [
      ...crackles(14, NAVE_LEN, 77, 0.07),
      // A far drip and its two echoes off the stone.
      tone('sine', 1250, 820, 0.06, 0.08, { delay: 2.3 }),
      tone('sine', 1250, 820, 0.06, 0.035, { delay: 2.62 }),
      tone('sine', 1250, 820, 0.06, 0.015, { delay: 2.94 }),
    ],
  ),
  'oz/env/storm': loopRecipe(
    STORM_LEN,
    0.125,
    [
      { wave: 'noise', vol: 0.5, filter: HP(1400) },
      { wave: 'noise', vol: 0.45, filter: BP(600, undefined, 0.9), tremolo: { rate: 1 / STORM_LEN, depth: 0.6 } },
      { wave: 'noise', vol: 0.2, filter: BP(1500, undefined, 3), tremolo: { rate: 3 / STORM_LEN, depth: 0.7 } },
      { wave: 'noise', vol: 0.35, filter: LP(130), tremolo: { rate: 2 / STORM_LEN, depth: 0.5 } },
    ],
    drops(10, STORM_LEN, 93, 0.14),
  ),
  'oz/env/bell': {
    vol: 0.75,
    voices: 2,
    gap: 0.5,
    length: 3.4,
    layers: [
      // The strike, the ring (inharmonic FM) and the hum a tenth below.
      noise(0.04, 0.35, BP(2100, undefined, 1.2)),
      ...fmBell(hz('A3'), 3.2, 0.6, { ratio: 1.41, index: 4, decay: 0.7, octave: 0.25 }),
      { wave: 'sine', freq: hz('F2'), env: { a: 0.01, d: 3.3 }, vol: 0.3 },
      { wave: 'sine', freq: hz('C4') * 1.003, env: { a: 0.004, d: 1.6 }, vol: 0.12 },
    ],
  },
  'oz/env/bell-creak': {
    vol: 1,
    voices: 2,
    gap: 0.2,
    layers: [
      // The wooden headstock: a stick-slip creak that bends up and down.
      { wave: 'saw', freq: 95, bend: [[0, 0], [0.35, 3], [0.8, -1]], env: { a: 0.04, d: 0.8 }, vol: 0.5, filter: BP(780, undefined, 4), tremolo: { rate: 28, depth: 0.75 }, drive: 1 },
      // The rope's low groan.
      { wave: 'triangle', freq: 70, to: 62, env: { a: 0.08, d: 0.7 }, vol: 0.3, filter: LP(300) },
    ],
  },
  'oz/env/door-slam': {
    vol: 0.85,
    voices: 2,
    gap: 0.25,
    echo: { delay: 0.19, feedback: 0.38, mix: 0.35 },
    layers: [
      // The heavy wood: a boom and a thud.
      tone('sine', 82, 38, 0.5, 0.9),
      noise(0.32, 0.7, LP(700)),
      noise(0.06, 0.45, BP(1600, undefined, 1.2)),
      // The iron latch.
      ...clack(900, 0.35, 0.03),
    ],
  },
  'oz/env/door-creak': {
    vol: 0.9,
    voices: 1,
    gap: 0.3,
    layers: [
      { wave: 'saw', freq: 150, bend: [[0, 0], [0.5, 3], [1.0, -2], [1.5, 4]], env: { a: 0.06, d: 0.1, s: 0.8, hold: 1.2, r: 0.2 }, vol: 0.5, filter: BP(950, undefined, 5), tremolo: { rate: 21, depth: 0.7 }, drive: 1 },
      { wave: 'saw', freq: 62, bend: [[0, 0], [1.5, 2]], env: { a: 0.1, d: 0.1, s: 0.7, hold: 1.1, r: 0.3 }, vol: 0.25, filter: LP(360), tremolo: { rate: 9, depth: 0.5 } },
    ],
  },
  'oz/env/candle-flare': {
    vol: 1,
    voices: 2,
    gap: 0.15,
    layers: [
      { wave: 'noise', env: { a: 0.05, d: 0.5 }, vol: 0.7, filter: BP(900, 2600, 0.9) },
      { wave: 'noise', env: { a: 0.02, d: 0.25 }, vol: 0.3, filter: LP(400) },
      ...crackles(6, 0.55, 12, 0.25),
    ],
  },
  'oz/env/candles-out': {
    vol: 1,
    voices: 1,
    gap: 0.3,
    layers: [
      // A cold gust that falls, and small "fft" puffs of the flames.
      { wave: 'noise', env: { a: 0.15, d: 0.7 }, vol: 0.7, filter: BP(1500, 380, 0.8) },
      noise(0.05, 0.25, BP(2600, undefined, 1.5), { delay: 0.3 }),
      noise(0.05, 0.2, BP(2400, undefined, 1.5), { delay: 0.42 }),
      noise(0.05, 0.15, BP(2200, undefined, 1.5), { delay: 0.55 }),
    ],
  },
  'oz/env/lamp-flicker': {
    vol: 1.4,
    voices: 2,
    gap: 0.1,
    layers: [
      // Three short bursts of mains buzz, each with a relay click.
      ...[0, 0.14, 0.33].flatMap((d, i) => [
        { wave: 'square' as const, freq: 100, env: { a: 0.002, d: 0.06 + i * 0.02 }, vol: 0.35, delay: d, filter: BP(1100, undefined, 1.5) },
        ...clack(2400, 0.25, d),
      ]),
    ],
  },
  'oz/env/crow': {
    vol: 0.55,
    voices: 1,
    gap: 0.5,
    layers: [0, 0.34].flatMap((d) => [
      { wave: 'saw' as const, freq: 620, bend: [[0, 0], [0.05, 1], [0.22, -4]] as const, env: { a: 0.012, d: 0.24 }, vol: 0.6, delay: d, filter: BP(1450, undefined, 2), drive: 2.2 },
      noise(0.18, 0.25, BP(2500, undefined, 1.4), { delay: d }),
    ]),
  },
};

/** Every 'oz/env/…' id of this module (the spec test and the API doc list them). */
export const OZ_ENV_SFX: readonly string[] = Object.keys(RECIPES);

for (const [id, recipe] of Object.entries(RECIPES)) defineSfx(id, recipe);
