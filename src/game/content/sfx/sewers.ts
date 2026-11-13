/**
 * Sound effects of mission `sewers` (level 2, RATTENJONG MET DE RATTENITEMS; docs/design/sewers.md
 * §7): every 'sewers/…' synth recipe of the spec, registered at import (content manifest id
 * 'sfx/sewers', LAZY with the sewers chunk: content/index.ts `isSewersContent`). The ElevenLabs takes
 * of the sample group 'mission:sewers' replace them when loaded (after the user's OK on the credits);
 * these stay the fallback, so the mission plays fully without a generated file.
 *
 * P0 made every id as a simple recipe (start values); the builders only use them (`ctx.sfx(SEWERS_SFX.ratSqueak)`)
 * and never invent ids. The two beds are loops (`setAmbience`; kit.ts `loopRecipe`).
 *
 * - Street: `rain-bed` (loop) rain on cobbles and the canal; `neon-buzz` a neon tube's hum and
 *   crackle; `whistle` the pimp's two-finger whistle; `gold-pistol` his shot; `knife-jab` the dealer's
 *   jab; `knuckles` the bodyguard's knuckle crack (the tell).
 * - GOUDEN GERRIT: `shotgun-pump` (the tell), `shotgun`, `limo-horn`, `limo-wreck`.
 * - The eruption: `grate-rattle` (the tell, 60 ticks), `grate-burst`.
 * - The rats: `rat-squeak`, `rat-hiss`, `rat-bite`, `rat-flip` (a defeat), `spit-gurgle` (the
 *   spitter's tell), `spit-splat`, `brute-snort` (the brute's tell), `brute-stomp`.
 * - The flashlight: `flash-click`, `battery`. The fatberg: `fatberg-squelch` (a hit), `fatberg-slump`.
 * - DE RATTENJONG: `throw-bike`, `throw-cart`, `throw-scooter`, `cart-roll`, `king-screech`,
 *   `king-squeak` (the rat call), `hall-crack`, `flood`.
 * - The sewer: `drip-bed` (loop) drips and a far trickle in a brick vault. The end: `manhole-lid`,
 *   `taxi`.
 */
import { defineSfx } from '../../../engine/synth';
import type { SfxLayer } from '../../../engine/synth';
import { BP, clack, fmBell, hits, HP, hz, loopRecipe, LP, noise, scatter, tone, type Recipes } from './kit';

const RAIN_LEN = 4;
const DRIP_LEN = 6;

/** Water drops: short rising sine blips at fixed pseudo-random times. */
function drops(n: number, len: number, seed: number, vol: number): SfxLayer[] {
  const t = scatter(n, seed);
  const f = scatter(n, seed + 3);
  return t.map((u, i) => tone('sine', 700 + f[i] * 900, 1400 + f[i] * 1200, 0.05, vol * (0.6 + f[i] * 0.4), { delay: u * (len - 0.1) }));
}

/** A squeak: a quick high chirp that falls (`n` chirps). */
function squeak(n: number, base: number, vol: number, t0 = 0): SfxLayer[] {
  return hits(n, t0, 0.07).map((t, i) => tone('triangle', base * (1 + (i % 2) * 0.12), base * 0.8, 0.06, vol, { delay: t, vibrato: { rate: 38, depth: 60 } }));
}

/** A metal crash: noise and clangs (wrecks, carts, bikes). */
function crash(freq: number, vol: number, t0 = 0, n = 4): SfxLayer[] {
  return [noise(0.35, vol, BP(freq * 2, freq, 1.1), { delay: t0 }), ...hits(n, t0, 0.05).flatMap((t, i) => clack(freq * (1 + i * 0.13), vol * (0.8 - i * 0.12), t, 0.03))];
}

const RECIPES: Recipes = {
  // --- Street (a, b)
  'sewers/rain-bed': loopRecipe(
    RAIN_LEN,
    0.6,
    [
      { wave: 'noise', vol: 0.5, filter: HP(1800) },
      { wave: 'noise', vol: 0.25, filter: LP(500), tremolo: { rate: 1 / RAIN_LEN, depth: 0.3 } },
    ],
    drops(10, RAIN_LEN, 41, 0.05),
  ),
  'sewers/neon-buzz': {
    vol: 0.35,
    voices: 1,
    gap: 0.4,
    layers: [{ wave: 'square', freq: 100, env: { a: 0.01, d: 0.05, s: 0.8, hold: 0.6, r: 0.08 }, vol: 0.3, filter: LP(900), tremolo: { rate: 50, depth: 0.4 } }, ...hits(3, 0.1, 0.17).map((t) => noise(0.02, 0.3, HP(4000), { delay: t }))],
  },
  'sewers/whistle': {
    vol: 0.6,
    voices: 1,
    gap: 0.5,
    layers: [tone('sine', hz('E6'), hz('A6'), 0.18, 0.6, { vibrato: { rate: 9, depth: 30 } }), tone('sine', hz('A6'), hz('E6'), 0.3, 0.6, { delay: 0.22, vibrato: { rate: 9, depth: 30 } }), noise(0.45, 0.08, BP(3200, undefined, 2))],
  },
  'sewers/gold-pistol': {
    vol: 0.7,
    voices: 3,
    gap: 0.05,
    layers: [noise(0.08, 0.8, BP(2400, 900, 1.2)), tone('square', 900, 180, 0.07, 0.4), ...fmBell(hz('A6'), 0.2, 0.1, { delay: 0.02 })],
  },
  'sewers/knife-jab': { vol: 0.6, voices: 2, gap: 0.1, layers: [noise(0.07, 0.7, BP(5000, 2600, 2)), ...clack(1800, 0.3, 0.05)] },
  'sewers/knuckles': { vol: 0.6, voices: 1, gap: 0.3, layers: hits(4, 0, 0.07).flatMap((t, i) => clack(1200 + i * 150, 0.5, t, 0.012)) },
  // --- GOUDEN GERRIT (§4.1)
  'sewers/shotgun-pump': { vol: 0.7, voices: 1, gap: 0.3, layers: [...clack(700, 0.7, 0, 0.03), ...clack(500, 0.8, 0.16, 0.035), ...fmBell(hz('E7'), 0.12, 0.08, { delay: 0.2 })] },
  'sewers/shotgun': { vol: 0.85, voices: 2, gap: 0.1, layers: [noise(0.35, 1, LP(3200, 500)), tone('sine', 120, 45, 0.25, 0.8)] },
  'sewers/limo-horn': {
    vol: 0.7,
    voices: 1,
    gap: 0.5,
    layers: [
      { wave: 'saw', freq: hz('A3'), env: { a: 0.01, d: 0.05, s: 0.8, hold: 0.55, r: 0.06 }, vol: 0.4, filter: LP(1600) },
      { wave: 'saw', freq: hz('C#4'), env: { a: 0.01, d: 0.05, s: 0.8, hold: 0.55, r: 0.06 }, vol: 0.35, filter: LP(1600) },
    ],
  },
  'sewers/limo-wreck': { vol: 0.85, voices: 1, gap: 0.8, length: 1.4, layers: [...crash(500, 0.9), ...crash(320, 0.7, 0.3, 3), tone('sine', 80, 40, 0.8, 0.7), noise(1, 0.25, BP(1200, 300, 0.8), { delay: 0.4 })] },
  // --- The eruption (§5.3)
  'sewers/grate-rattle': { vol: 0.6, voices: 2, gap: 0.3, layers: [...hits(8, 0, 0.12).flatMap((t, i) => clack(420 + (i % 3) * 60, 0.5, t, 0.04)), ...squeak(3, 3400, 0.15, 0.5)] },
  'sewers/grate-burst': { vol: 0.85, voices: 1, gap: 0.5, layers: [...crash(380, 0.9), ...fmBell(hz('D4'), 0.6, 0.3, { ratio: 1.4, delay: 0.05 }), ...squeak(4, 3800, 0.2, 0.25)] },
  // --- The rats (§3)
  'sewers/rat-squeak': { vol: 0.5, voices: 3, gap: 0.1, layers: squeak(2, 3600, 0.5) },
  'sewers/rat-hiss': { vol: 0.5, voices: 2, gap: 0.3, layers: [{ wave: 'noise', env: { a: 0.03, d: 0.1, s: 0.7, hold: 0.25, r: 0.1 }, vol: 0.7, filter: HP(3000) }] },
  'sewers/rat-bite': { vol: 0.6, voices: 3, gap: 0.08, layers: [...clack(2200, 0.7, 0, 0.015), ...clack(1900, 0.6, 0.05, 0.015), noise(0.05, 0.3, BP(1600, undefined, 1.5))] },
  'sewers/rat-flip': { vol: 0.5, voices: 3, gap: 0.1, layers: [tone('triangle', 3200, 900, 0.3, 0.5, { vibrato: { rate: 30, depth: 80 } }), noise(0.06, 0.4, LP(900), { delay: 0.25 })] },
  'sewers/spit-gurgle': { vol: 0.55, voices: 2, gap: 0.3, layers: hits(6, 0, 0.06).map((t, i) => tone('sine', 220 + (i % 3) * 80, 420 + (i % 3) * 90, 0.05, 0.5, { delay: t })) },
  'sewers/spit-splat': { vol: 0.6, voices: 3, gap: 0.08, layers: [noise(0.16, 0.8, LP(1400, 300)), tone('sine', 300, 90, 0.12, 0.4)] },
  'sewers/brute-snort': { vol: 0.65, voices: 1, gap: 0.4, layers: [noise(0.22, 0.8, BP(500, 900, 1.3)), noise(0.25, 0.7, BP(600, 300, 1.3), { delay: 0.3 })] },
  'sewers/brute-stomp': { vol: 0.85, voices: 2, gap: 0.2, layers: [tone('sine', 90, 35, 0.4, 1), noise(0.25, 0.6, LP(400))] },
  // --- The flashlight (§5.1)
  'sewers/flash-click': { vol: 0.5, voices: 2, gap: 0.1, layers: [...clack(2600, 0.6, 0, 0.01), tone('sine', 6000, 9000, 0.04, 0.08, { delay: 0.02 })] },
  'sewers/battery': { vol: 0.55, voices: 1, gap: 0.2, layers: [tone('square', hz('C6'), hz('C6'), 0.06, 0.2, { filter: LP(4000) }), tone('square', hz('G6'), hz('G6'), 0.12, 0.2, { delay: 0.07, filter: LP(4000) })] },
  // --- The fatberg (§5.4)
  'sewers/fatberg-squelch': { vol: 0.6, voices: 3, gap: 0.08, layers: [noise(0.12, 0.7, LP(900, 300)), tone('sine', 180, 80, 0.1, 0.5)] },
  'sewers/fatberg-slump': { vol: 0.8, voices: 1, gap: 0.8, length: 1.3, layers: [noise(1.1, 0.8, LP(700, 150)), tone('sine', 110, 35, 1, 0.7), ...hits(5, 0.3, 0.15).map((t) => tone('sine', 160, 60, 0.08, 0.3, { delay: t }))] },
  // --- DE RATTENJONG (§4.2)
  'sewers/throw-bike': { vol: 0.75, voices: 2, gap: 0.2, layers: [noise(0.3, 0.4, BP(800, 2400, 1)), ...crash(900, 0.6, 0.25, 3), ...fmBell(hz('E6'), 0.3, 0.12, { delay: 0.3 })] },
  'sewers/throw-cart': { vol: 0.75, voices: 2, gap: 0.2, layers: [noise(0.25, 0.4, BP(700, 1800, 1)), ...crash(600, 0.7, 0.2, 4)] },
  'sewers/throw-scooter': { vol: 0.75, voices: 2, gap: 0.2, layers: [noise(0.2, 0.4, BP(900, 2600, 1)), ...crash(750, 0.6, 0.18, 2), ...crash(750, 0.4, 0.45, 2)] },
  'sewers/cart-roll': { vol: 0.5, voices: 2, gap: 0.3, layers: [{ wave: 'noise', env: { a: 0.02, d: 0.1, s: 0.8, hold: 0.6, r: 0.1 }, vol: 0.6, filter: BP(900, undefined, 1.4), tremolo: { rate: 18, depth: 0.6 } }] },
  'sewers/king-screech': { vol: 0.8, voices: 1, gap: 0.6, layers: [tone('saw', 1400, 2600, 0.5, 0.5, { vibrato: { rate: 24, depth: 120 }, filter: BP(2200, undefined, 1.2) }), noise(0.6, 0.5, HP(2500)), tone('saw', 300, 180, 0.6, 0.3, { filter: LP(900) })] },
  'sewers/king-squeak': { vol: 0.7, voices: 1, gap: 0.4, layers: [...squeak(5, 2600, 0.6), noise(0.4, 0.2, HP(3000))] },
  'sewers/hall-crack': { vol: 0.85, voices: 1, gap: 0.8, length: 1.2, layers: [...hits(6, 0, 0.08, 1.2).flatMap((t, i) => clack(500 - i * 40, 0.5, t, 0.025)), tone('sine', 70, 40, 1, 0.8), noise(1, 0.4, LP(300))] },
  'sewers/flood': { vol: 0.85, voices: 1, gap: 1, length: 2.2, layers: [{ wave: 'noise', env: { a: 0.3, d: 0.4, s: 0.8, hold: 1.2, r: 0.4 }, vol: 0.9, filter: LP(1400, 600) }, tone('sine', 60, 45, 2, 0.6)] },
  // --- The sewer bed (c, d, e)
  'sewers/drip-bed': loopRecipe(
    DRIP_LEN,
    0.55,
    [
      { wave: 'noise', vol: 0.18, filter: LP(260), tremolo: { rate: 1 / DRIP_LEN, depth: 0.4 } },
      { wave: 'noise', vol: 0.05, filter: BP(1300, undefined, 2), tremolo: { rate: 2 / DRIP_LEN, depth: 0.6 } },
    ],
    drops(9, DRIP_LEN, 17, 0.09),
  ),
  // --- The end (§2.6)
  'sewers/manhole-lid': { vol: 0.75, voices: 1, gap: 0.5, layers: [...crash(350, 0.6, 0, 2), ...fmBell(hz('A3'), 0.8, 0.35, { ratio: 1.4 })] },
  'sewers/taxi': { vol: 0.65, voices: 1, gap: 1, length: 1.5, layers: [{ wave: 'saw', freq: 55, to: 90, sweep: 1.2, env: { a: 0.1, d: 0.2, s: 0.8, hold: 1, r: 0.2 }, vol: 0.4, filter: LP(500) }, noise(1.3, 0.2, LP(800))] },
};

/** Every 'sewers/…' sfx id (spec §7; the audio spec and the tests list them). */
export const SEWERS_SFX_IDS: readonly string[] = Object.keys(RECIPES);

/** The sewers sound ids for the builders: play them with `ctx.sfx(SEWERS_SFX.ratSqueak)`. */
export const SEWERS_SFX = {
  rainBed: 'sewers/rain-bed',
  neonBuzz: 'sewers/neon-buzz',
  whistle: 'sewers/whistle',
  goldPistol: 'sewers/gold-pistol',
  shotgunPump: 'sewers/shotgun-pump',
  shotgun: 'sewers/shotgun',
  limoHorn: 'sewers/limo-horn',
  limoWreck: 'sewers/limo-wreck',
  knifeJab: 'sewers/knife-jab',
  knuckles: 'sewers/knuckles',
  grateRattle: 'sewers/grate-rattle',
  grateBurst: 'sewers/grate-burst',
  ratSqueak: 'sewers/rat-squeak',
  ratHiss: 'sewers/rat-hiss',
  ratBite: 'sewers/rat-bite',
  ratFlip: 'sewers/rat-flip',
  spitGurgle: 'sewers/spit-gurgle',
  spitSplat: 'sewers/spit-splat',
  bruteSnort: 'sewers/brute-snort',
  bruteStomp: 'sewers/brute-stomp',
  flashClick: 'sewers/flash-click',
  battery: 'sewers/battery',
  fatbergSquelch: 'sewers/fatberg-squelch',
  fatbergSlump: 'sewers/fatberg-slump',
  throwBike: 'sewers/throw-bike',
  throwCart: 'sewers/throw-cart',
  throwScooter: 'sewers/throw-scooter',
  cartRoll: 'sewers/cart-roll',
  kingScreech: 'sewers/king-screech',
  kingSqueak: 'sewers/king-squeak',
  hallCrack: 'sewers/hall-crack',
  flood: 'sewers/flood',
  dripBed: 'sewers/drip-bed',
  manholeLid: 'sewers/manhole-lid',
  taxi: 'sewers/taxi',
} as const;

for (const [id, recipe] of Object.entries(RECIPES)) defineSfx(id, recipe);
