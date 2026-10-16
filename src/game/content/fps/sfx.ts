/**
 * Synth fallbacks of the first-person mode's sound effects (docs/design/fps.md §9.1; ids are
 * contracts). The ElevenLabs takes of group 'mode:fps' replace them when loaded; these recipes
 * play until then, and always when the samples are off. Every sound is an original synth recipe
 * (docs/ORIGINALITY.md): no sound of the reference genre is copied, and the shout stand-ins are
 * wordless.
 *
 * Telegraph sounds last their tell (§4.3, GDD §4.11 rule 2; start them on the first tell tick):
 * - `fps/enemy/aim` — a bolt click-clack and a metal ring, audible ≥ 0.4 s (guard tell 24).
 * - `fps/dog/growl` — a low growl that rises into a snap, ≥ 0.3 s (tell 18).
 * - `fps/boss/spin-up` — four barrels spin up for the full 0.5 s and stop at the peak (tell 30;
 *   phase 2 cuts it at 24).
 * Repeat rates: `fps/mg` 6/s, `fps/chaingun` 12/s, `fps/boss/chaingun` 15/s, `fps/enemy/mg`
 * bursts 0.1 s apart, `fps/type` every 4 ticks: their gaps and voices allow it.
 * Reused, not defined here: `item/1up` (1UP), `ui/tally-tick` / `ui/tally-end` (tally).
 */
import type { SfxLayer, SfxRecipe } from '../../../engine/synth';
import { BP, clack, click, fmBell, HP, hits, hz, LP, noise, note, scatter, seq, tone, type Recipes } from '../sfx/kit';

// ---------------------------------------------------------------------------------------------
// Builders (local)
// ---------------------------------------------------------------------------------------------

/** A gun crack: a bright noise transient, a pitched body and a low-passed boom. */
function crack(body: number, boom: number, tail: number, bright: number, delay = 0): SfxLayer[] {
  return [
    noise(0.025, 0.55, HP(bright), { delay }),
    tone('square', body, body * 0.3, 0.07, 0.55, { delay, filter: LP(2400) }),
    tone('sine', boom, boom * 0.45, 0.12, 0.9, { delay }),
    noise(tail, 0.45, LP(1400, 250), { delay, env: { a: 0.002, d: tail } }),
  ];
}

/** A heavy thud (a body or a foot on a hard floor). */
function thud(f: number, d: number, vol: number, delay = 0): SfxLayer[] {
  return [tone('sine', f, f * 0.42, d, vol, { delay, sweep: d * 0.6 }), noise(d * 0.6, vol * 0.5, LP(420, 160), { delay })];
}

/** A rattle of small metal clacks at fixed pseudo-random times (ammo, clatter, chains). */
function rattle(n: number, from: number, span: number, f: number, vol: number, seed: number): SfxLayer[] {
  const t = scatter(n * 2, seed);
  const out: SfxLayer[] = [];
  for (let i = 0; i < n; i++) out.push(...clack(f * (0.8 + t[2 * i + 1] * 0.5), vol * (0.6 + 0.4 * t[2 * i + 1]), from + t[2 * i] * span));
  return out;
}

/**
 * A wordless voice: a saw through two vowel formants with a pitch contour (`bend`) and a breath.
 * Used for grunts and the shout stand-ins (never words; never a real person's voice).
 */
function voice(f0: number, len: number, f1: number, f2: number, bend: readonly (readonly [number, number])[], vol: number, x: Partial<SfxLayer> = {}): SfxLayer[] {
  const env = { a: 0.012, d: 0.05, s: 0.8, hold: Math.max(0.02, len - 0.12), r: 0.06 };
  return [
    { wave: 'saw', freq: f0, bend, env, vol: vol * 0.7, filter: BP(f1, undefined, 2.2), drive: 0.8, ...x },
    { wave: 'saw', freq: f0, bend, env, vol: vol * 0.35, filter: BP(f2, undefined, 3), ...x },
    { wave: 'triangle', freq: f0, bend, env, vol: vol * 0.3, filter: LP(500) },
    noise(len * 0.7, vol * 0.18, BP(f2 * 1.3, undefined, 1.2), { env: { a: 0.01, d: len * 0.7 } }),
  ];
}

/** A soft chime of two or more notes (pickups). */
function chime(notes: readonly number[], step: number, d: number, vol: number, delay = 0): SfxLayer[] {
  return notes.flatMap((f, i) => fmBell(f, d, vol, { ratio: 2, index: 1.6, decay: 0.08, delay: delay + i * step, octave: 0.25 }));
}

// ---------------------------------------------------------------------------------------------
// Player weapons
// ---------------------------------------------------------------------------------------------

const WEAPONS: Recipes = {
  // The knife: a sharp steel whoosh (silent to the enemies, §4.2).
  'fps/knife': {
    vol: 1,
    voices: 2,
    gap: 0.1,
    layers: [
      { wave: 'noise', env: { a: 0.04, d: 0.16 }, vol: 0.9, filter: BP(900, 3800, 2.2) },
      { wave: 'noise', env: { a: 0.05, d: 0.08 }, vol: 0.3, filter: HP(5000), delay: 0.02 },
    ],
  },
  // The knife lands: a dull thud and a short cloth rip.
  'fps/knife-hit': {
    vol: 0.8,
    voices: 2,
    gap: 0.1,
    layers: [...thud(170, 0.12, 0.9), noise(0.07, 0.45, BP(2200, 1400, 1.4), { delay: 0.02 }), click(900, 0.3)],
  },
  // Pistol: a crack with a short boomy tail in a concrete corridor.
  'fps/pistol': {
    vol: 0.5,
    voices: 4,
    gap: 0.05,
    echo: { delay: 0.07, feedback: 0.22, mix: 0.3 },
    layers: crack(240, 120, 0.26, 2800),
  },
  // MG: one hard, tight round (6/s).
  'fps/mg': {
    vol: 0.42,
    voices: 6,
    gap: 0.05,
    jitter: 0.04,
    layers: crack(200, 105, 0.14, 2400),
  },
  // Chaingun: one short heavy round with a metal rattle (12/s).
  'fps/chaingun': {
    vol: 0.4,
    voices: 6,
    gap: 0.03,
    jitter: 0.05,
    layers: [...crack(180, 95, 0.09, 2200), { wave: 'metal', freq: 1800, env: { a: 0.001, d: 0.05 }, vol: 0.18, filter: BP(3200, undefined, 2) }],
  },
  // Weapon raised: a slide rack (two clacks) and a cloth rustle.
  'fps/weapon-up': {
    vol: 0.7,
    voices: 1,
    gap: 0.1,
    layers: [
      ...clack(1300, 0.8, 0.02),
      ...clack(1700, 0.9, 0.14),
      { wave: 'noise', env: { a: 0.03, d: 0.15 }, vol: 0.25, filter: BP(1500, 800, 0.9) },
      tone('square', 520, 900, 0.08, 0.12, { delay: 0.04, filter: LP(2500) }),
    ],
  },
};

// ---------------------------------------------------------------------------------------------
// Enemies and dogs
// ---------------------------------------------------------------------------------------------

const ENEMIES: Recipes = {
  // TELL (18–24 ticks): a crisp bolt click-clack, then the metal ring holds through the tell.
  'fps/enemy/aim': {
    vol: 0.62,
    voices: 3,
    gap: 0.1,
    layers: [
      ...clack(1500, 1, 0),
      ...clack(2100, 1, 0.16),
      ...fmBell(1450, 0.5, 0.3, { ratio: 1.4, index: 2, decay: 0.1, delay: 0.16 }),
      { wave: 'noise', env: { a: 0.01, d: 0.04, s: 0.5, hold: 0.36, r: 0.06 }, vol: 0.08, filter: BP(3000, undefined, 4) },
    ],
  },
  // An enemy's pistol a few metres off: darker, with a longer corridor echo.
  'fps/enemy/pistol': {
    vol: 0.42,
    voices: 4,
    gap: 0.05,
    echo: { delay: 0.09, feedback: 0.3, mix: 0.4 },
    layers: crack(200, 110, 0.24, 1700),
  },
  // An enemy MG round (bursts of 3, 0.1 s apart).
  'fps/enemy/mg': {
    vol: 0.4,
    voices: 6,
    gap: 0.04,
    jitter: 0.04,
    echo: { delay: 0.06, feedback: 0.2, mix: 0.3 },
    layers: crack(185, 100, 0.12, 1600),
  },
  // A pained wordless "oof".
  'fps/enemy/hurt': {
    vol: 0.62,
    voices: 2,
    gap: 0.12,
    layers: voice(170, 0.26, 650, 1150, [[0, 3], [0.06, 0], [0.26, -5]], 1),
  },
  // A soldier collapses: a heavy thud, then the rifle clatters beside him.
  'fps/enemy/fall': {
    vol: 0.7,
    voices: 2,
    gap: 0.15,
    layers: [...thud(95, 0.3, 1, 0.04), ...rattle(4, 0.28, 0.3, 1400, 0.45, 41)],
  },
  // Red blood (this mode only): a short wet splat.
  'fps/blood': {
    vol: 0.55,
    voices: 3,
    gap: 0.05,
    layers: [
      { wave: 'noise', env: { a: 0.002, d: 0.12 }, vol: 0.9, filter: LP(2200, 300, 1.6) },
      tone('sine', 320, 70, 0.09, 0.6),
      ...hits(3, 0.12, 0.05).map((t, i) => tone('sine', 900 - i * 120, 450, 0.03, 0.2, { delay: t })),
    ],
  },
};

const DOGS: Recipes = {
  // One aggressive bark.
  'fps/dog/bark': {
    vol: 0.6,
    voices: 2,
    gap: 0.15,
    layers: [
      { wave: 'pulse', duty: 0.35, freq: 420, bend: [[0, -4], [0.04, 3], [0.22, -7]], env: { a: 0.004, d: 0.05, s: 0.7, hold: 0.13, r: 0.06 }, vol: 0.7, filter: BP(1000, undefined, 1.8), drive: 1.6 },
      { wave: 'saw', freq: 420, bend: [[0, -4], [0.04, 3], [0.22, -7]], env: { a: 0.004, d: 0.05, s: 0.6, hold: 0.12, r: 0.06 }, vol: 0.35, filter: BP(2300, undefined, 3) },
      noise(0.08, 0.5, BP(1600, 700, 1.2)),
    ],
  },
  // TELL 18: a low growl that rises into a snap.
  'fps/dog/growl': {
    vol: 0.7,
    voices: 2,
    gap: 0.2,
    layers: [
      { wave: 'saw', freq: 85, bend: [[0, 0], [0.32, 7]], env: { a: 0.03, d: 0.05, s: 0.85, hold: 0.24, r: 0.04 }, vol: 0.8, filter: BP(420, 900, 1.6), drive: 1.4, tremolo: { rate: 26, rateTo: 34, depth: 0.7, shape: 'saw', width: 0.5 } },
      { wave: 'noise', env: { a: 0.03, d: 0.05, s: 0.7, hold: 0.24, r: 0.04 }, vol: 0.35, filter: BP(700, 1400, 1.4), tremolo: { rate: 26, rateTo: 34, depth: 0.6 } },
      ...clack(900, 0.9, 0.34, 0.03),
      { wave: 'pulse', duty: 0.3, freq: 520, to: 380, sweep: 0.08, env: { a: 0.003, d: 0.08 }, vol: 0.45, delay: 0.33, filter: BP(1100, undefined, 1.6) },
    ],
  },
  // The bite: a fast snap of jaws and a cloth tear.
  'fps/dog/bite': {
    vol: 0.66,
    voices: 2,
    gap: 0.12,
    layers: [...clack(1100, 1, 0, 0.025), ...clack(800, 0.8, 0.05, 0.025), noise(0.12, 0.5, BP(2600, 1500, 1.3), { delay: 0.06 })],
  },
  // A short yelp that fades into a whimper.
  'fps/dog/die': {
    vol: 0.6,
    voices: 2,
    gap: 0.2,
    layers: [
      { wave: 'pulse', duty: 0.3, freq: 950, bend: [[0, 2], [0.12, -6], [0.55, -14]], env: { a: 0.004, d: 0.1, s: 0.45, hold: 0.32, r: 0.12 }, vol: 0.6, filter: BP(1500, undefined, 2), vibrato: { rate: 9, depth: 0.6, delay: 0.15 } },
      { wave: 'sine', freq: 950, bend: [[0, 2], [0.12, -6], [0.55, -14]], env: { a: 0.004, d: 0.1, s: 0.4, hold: 0.32, r: 0.12 }, vol: 0.3 },
      noise(0.06, 0.25, BP(2000, undefined, 1.4)),
    ],
  },
};

// ---------------------------------------------------------------------------------------------
// MechaHitler
// ---------------------------------------------------------------------------------------------

/** The four-barrel rattle of the mech's chainguns. */
const SPIN = 0.5;

const BOSS: Recipes = {
  // A walking-mech footstep: a steel foot slams down, a hydraulic hiss, a deep boom.
  'fps/boss/step': {
    vol: 0.66,
    voices: 2,
    gap: 0.2,
    layers: [
      ...thud(68, 0.4, 1),
      ...fmBell(170, 0.25, 0.3, { ratio: 1.4, index: 3, decay: 0.05 }),
      { wave: 'noise', env: { a: 0.02, d: 0.25 }, vol: 0.22, filter: HP(3500), delay: 0.08 },
    ],
  },
  // TELL 30 (24 on foot): the barrels spin up for the full 0.5 s and stop at the peak.
  'fps/boss/spin-up': {
    vol: 0.6,
    voices: 1,
    gap: 0.3,
    layers: [
      { wave: 'saw', freq: 140, to: 900, sweep: SPIN, curve: 'linear', env: { a: 0.02, s: 1, hold: SPIN - 0.04, r: 0.02 }, vol: 0.5, filter: LP(700, 3200) },
      { wave: 'square', freq: 70, to: 450, sweep: SPIN, curve: 'linear', env: { a: 0.02, s: 1, hold: SPIN - 0.04, r: 0.02 }, vol: 0.25, filter: LP(1200) },
      { wave: 'noise', env: { a: 0.05, s: 1, hold: SPIN - 0.07, r: 0.02 }, vol: 0.35, filter: BP(1500, 4000, 2), tremolo: { rate: 12, rateTo: 60, depth: 0.8, shape: 'saw', width: 0.4 } },
    ],
  },
  // One round of the huge rotary cannon (15/s): a deep bang and a metal clank.
  'fps/boss/chaingun': {
    vol: 0.42,
    voices: 6,
    gap: 0.025,
    jitter: 0.04,
    layers: [...crack(140, 75, 0.1, 1800), { wave: 'metal', freq: 900, env: { a: 0.001, d: 0.06 }, vol: 0.22, filter: BP(2000, undefined, 2) }],
  },
  // The suit breaks down: sparks, groaning metal, a hydraulic burst, a falling power-down whine
  // and a heavy clunk at 1.9 s.
  'fps/boss/break': {
    vol: 0.75,
    voices: 1,
    gap: 1,
    layers: [
      ...scatter(14, 77).map((t, i) => noise(0.02, 0.5, HP(4000 + (i % 3) * 1500), { delay: t * 1.3 })),
      { wave: 'saw', freq: 110, bend: [[0, 0], [0.4, -3], [0.7, 2], [1.2, -6]], env: { a: 0.08, d: 0.1, s: 0.7, hold: 1.0, r: 0.3 }, vol: 0.4, filter: BP(500, 300, 3), drive: 1.2 },
      noise(0.5, 0.7, BP(2500, 600, 0.9), { delay: 0.25, env: { a: 0.005, d: 0.5 } }),
      { wave: 'square', freq: 1400, to: 60, sweep: 1.5, env: { a: 0.02, s: 1, hold: 1.45, r: 0.05 }, vol: 0.22, delay: 0.35, filter: LP(2500, 300) },
      ...thud(80, 0.4, 0.6, 1.85),
      ...fmBell(120, 0.4, 0.2, { ratio: 1.4, index: 3, decay: 0.08, delay: 1.85 }),
    ],
  },
  // A heavy armoured body crashes onto a steel floor; gear clatters away.
  'fps/boss/fall': {
    vol: 0.72,
    voices: 1,
    gap: 0.5,
    layers: [...thud(60, 0.5, 1), ...fmBell(140, 0.4, 0.25, { ratio: 1.4, index: 2.5, decay: 0.06 }), ...rattle(8, 0.2, 0.65, 1100, 0.4, 93)],
  },
  // The taunt stand-in: a distorted loudspeaker horn squawks a wordless tantrum.
  'fps/boss/horn': {
    vol: 0.7,
    voices: 1,
    gap: 0.5,
    layers: (() => {
      const bend: [number, number][] = [[0, -5], [0.18, 3], [0.35, -1], [0.55, 5], [0.8, 0], [1.05, 4], [1.4, -8]];
      const env = { a: 0.02, d: 0.06, s: 0.85, hold: 1.25, r: 0.12 };
      return [
        { wave: 'saw', freq: 196, bend, env, vol: 0.6, filter: BP(950, undefined, 2.5), drive: 2.2, tremolo: { rate: 11, depth: 0.35 } },
        { wave: 'pulse', duty: 0.25, freq: 197, bend, env, vol: 0.4, filter: BP(1900, undefined, 3), drive: 1.5 },
        { wave: 'triangle', freq: 98, bend, env, vol: 0.25, filter: LP(400) },
      ] as SfxLayer[];
    })(),
  },
};

// ---------------------------------------------------------------------------------------------
// World
// ---------------------------------------------------------------------------------------------

/** A steel slab rolling on its rail for `len` seconds from `delay`. */
function rumble(len: number, vol: number, delay: number): SfxLayer[] {
  const env = { a: 0.06, d: 0.05, s: 0.85, hold: Math.max(0.02, len - 0.17), r: 0.06 };
  return [
    { wave: 'noise', env, vol: vol, delay, filter: LP(520, undefined, 1.2), tremolo: { rate: 17, depth: 0.35 } },
    { wave: 'saw', freq: 52, env, vol: vol * 0.45, delay, filter: LP(260), tremolo: { rate: 9, depth: 0.25 } },
    { wave: 'metal', freq: 600, env, vol: vol * 0.06, delay, filter: BP(1400, undefined, 3) },
  ];
}

const WORLD: Recipes = {
  // A heavy steel door: the latch at once, the slide stops with a soft thud at about 0.85 s.
  'fps/door-open': {
    vol: 0.62,
    voices: 3,
    gap: 0.1,
    layers: [...clack(700, 1, 0, 0.03), ...rumble(0.78, 0.8, 0.06), ...thud(110, 0.1, 0.55, 0.84)],
  },
  // The door rolls shut and lands with a hard clang at 0.85 s.
  'fps/door-close': {
    vol: 0.62,
    voices: 3,
    gap: 0.1,
    layers: [...rumble(0.8, 0.8, 0), ...thud(120, 0.12, 0.8, 0.85), ...fmBell(260, 0.2, 0.35, { ratio: 1.4, index: 3, decay: 0.04, delay: 0.85 })],
  },
  // Locked: two dull metal clunks.
  'fps/door-locked': {
    vol: 0.62,
    voices: 1,
    gap: 0.25,
    layers: [...thud(150, 0.08, 0.7), ...clack(500, 0.8, 0), ...thud(140, 0.08, 0.7, 0.13), ...clack(460, 0.8, 0.13)],
  },
  // A stone block grinds one tile (about 1.8 s), then settles.
  'fps/pushwall': {
    vol: 0.62,
    voices: 1,
    gap: 0.5,
    layers: [
      { wave: 'noise', env: { a: 0.08, s: 1, hold: 1.65, r: 0.12 }, vol: 0.8, filter: LP(380, 300, 1.4), tremolo: { rate: 7, depth: 0.4 } },
      { wave: 'noise', env: { a: 0.08, s: 1, hold: 1.65, r: 0.12 }, vol: 0.25, filter: BP(1100, undefined, 2), tremolo: { rate: 13, depth: 0.7, shape: 'saw', width: 0.3 } },
      { wave: 'sine', freq: 46, env: { a: 0.1, s: 1, hold: 1.6, r: 0.15 }, vol: 0.5 },
      ...thud(90, 0.15, 0.6, 1.75),
    ],
  },
  // The lift lever: a heavy switch clunk, then a rising motor hum.
  'fps/elevator': {
    vol: 0.5,
    voices: 1,
    gap: 0.5,
    layers: [
      ...thud(130, 0.1, 0.8),
      ...clack(600, 1, 0, 0.03),
      { wave: 'saw', freq: 55, to: 110, sweep: 0.8, env: { a: 0.15, s: 1, hold: 0.62, r: 0.12 }, vol: 0.45, delay: 0.1, filter: LP(500, 900), tremolo: { rate: 30, depth: 0.2 } },
      { wave: 'sine', freq: 110, to: 220, sweep: 0.8, env: { a: 0.15, s: 1, hold: 0.62, r: 0.12 }, vol: 0.2, delay: 0.1 },
    ],
  },
  // A hand pushes a solid wall: a dull thud.
  'fps/use-wall': {
    vol: 0.6,
    voices: 1,
    gap: 0.15,
    layers: [...thud(125, 0.12, 1), noise(0.03, 0.2, BP(900, undefined, 1))],
  },
};

// ---------------------------------------------------------------------------------------------
// Pickups
// ---------------------------------------------------------------------------------------------

const PICKUPS: Recipes = {
  // A canvas rustle and a bright two-note chime.
  'fps/pickup-health': {
    vol: 0.5,
    voices: 2,
    gap: 0.08,
    layers: [noise(0.08, 0.3, BP(1800, 900, 1)), ...chime([hz('E6'), hz('A6')], 0.08, 0.28, 0.5)],
  },
  // A crunchy bite and a happy little chime.
  'fps/pickup-food': {
    vol: 0.5,
    voices: 2,
    gap: 0.08,
    layers: [...hits(3, 0, 0.035).map((t) => noise(0.03, 0.5, BP(2400, 1500, 1.4), { delay: t })), ...chime([hz('C6'), hz('E6'), hz('G6')], 0.06, 0.24, 0.45, 0.1)],
  },
  // A box of cartridges rattles.
  'fps/pickup-ammo': {
    vol: 0.6,
    voices: 2,
    gap: 0.08,
    layers: [...rattle(7, 0, 0.18, 2400, 0.7, 17), noise(0.05, 0.3, BP(900, undefined, 1))],
  },
  // A new gun: a heavy clack and a slide rack, then a short rising brassy note.
  'fps/pickup-weapon': {
    vol: 0.6,
    voices: 1,
    gap: 0.2,
    layers: [
      ...clack(900, 1, 0, 0.03),
      ...clack(1600, 0.9, 0.1),
      { wave: 'saw', freq: hz('G4'), bend: [[0, -2], [0.05, 0], [0.32, 5]], env: { a: 0.01, d: 0.05, s: 0.8, hold: 0.25, r: 0.08 }, vol: 0.5, delay: 0.16, filter: LP(1800, 3200), vibrato: { rate: 6, depth: 0.12, delay: 0.1 } },
      { wave: 'pulse', duty: 0.25, freq: hz('G5'), bend: [[0, -2], [0.05, 0], [0.32, 5]], env: { a: 0.01, d: 0.05, s: 0.7, hold: 0.25, r: 0.08 }, vol: 0.2, delay: 0.16, filter: LP(2600) },
    ],
  },
  // An old iron key: a bright metallic jingle with a soft chime.
  'fps/pickup-key': {
    vol: 0.5,
    voices: 1,
    gap: 0.1,
    layers: [
      ...hits(4, 0, 0.045).flatMap((t, i) => fmBell(2200 + i * 330, 0.12, 0.35, { ratio: 1.4, index: 2.4, decay: 0.03, delay: t })),
      ...chime([hz('B5')], 0, 0.35, 0.45, 0.06),
    ],
  },
  // Treasure: a sparkle of coins and a glassy ding.
  'fps/pickup-treasure': {
    vol: 0.5,
    voices: 2,
    gap: 0.08,
    layers: [
      ...scatter(7, 29).flatMap((t, i) => fmBell(3200 + i * 260, 0.1, 0.25, { ratio: 3.5, index: 2, decay: 0.02, delay: t * 0.14 })),
      ...fmBell(hz('E7') / 2, 0.38, 0.55, { ratio: 3.5, index: 2.6, decay: 0.07, delay: 0.06, octave: 0.3 }),
    ],
  },
  // The golden record: a harp glissando up into a bright chime.
  'fps/pickup-record': {
    vol: 0.5,
    voices: 1,
    gap: 0.5,
    layers: [
      ...seq(
        ['C5', 'D5', 'E5', 'G5', 'A5', 'C6', 'D6', 'E6', 'G6'].map((n) => [hz(n), 0.04] as const),
        (f, _len, delay) => ({ wave: 'triangle', freq: f, env: { a: 0.002, d: 0.25 }, vol: 0.4, delay }),
      ),
      ...chime([hz('C7') / 2, hz('G6')], 0.0, 0.5, 0.5, 0.38),
      note('pulse', hz('C6'), 0.3, 0.12, 0.38, { duty: 0.25, filter: LP(3000) }),
    ],
  },
};

// ---------------------------------------------------------------------------------------------
// Player, bridge, tally, shout stand-ins
// ---------------------------------------------------------------------------------------------

const PLAYER: Recipes = {
  // A short sharp wordless "ugh".
  'fps/player-hurt': {
    vol: 0.66,
    voices: 1,
    gap: 0.15,
    layers: [...voice(135, 0.24, 560, 1000, [[0, 2], [0.05, 0], [0.24, -4]], 1), ...thud(160, 0.06, 0.4)],
  },
  // A long falling groan, then a heavy thud on the floor.
  'fps/player-die': {
    vol: 0.68,
    voices: 1,
    gap: 1,
    layers: [...voice(150, 0.85, 600, 1050, [[0, 2], [0.1, 0], [0.85, -10]], 1, { vibrato: { rate: 5, depth: 0.25, delay: 0.3 } }), ...thud(90, 0.3, 1, 0.92)],
  },
};

const BRIDGE: Recipes = {
  // A burst of bit-crushed static with a stuttering chirp (plays every 6–24 ticks).
  'fps/glitch': {
    vol: 0.42,
    voices: 3,
    gap: 0.05,
    crush: 4,
    downsample: 6,
    layers: [
      { wave: 'noise', env: { a: 0.002, s: 1, hold: 0.16, r: 0.04 }, vol: 0.7, filter: BP(2400, undefined, 0.8), tremolo: { rate: 38, depth: 1, shape: 'square' } },
      { wave: 'square', freq: 1800, arp: [0, 7, -5, 12], arpTime: 0.03, env: { a: 0.002, s: 1, hold: 0.12, r: 0.02 }, vol: 0.3, delay: 0.04, filter: LP(5000) },
      tone('square', 3000, 200, 0.06, 0.25, { delay: 0.17 }),
    ],
  },
  // One typewriter key: a crisp mechanical clack.
  'fps/type': {
    vol: 0.6,
    voices: 3,
    gap: 0.03,
    jitter: 0.06,
    layers: [...clack(1800, 1, 0, 0.022), noise(0.03, 0.4, LP(900)), click(600, 0.3, 0.012)],
  },
  // An old TV switches off: a zap, a whine collapsing down, a soft click.
  'fps/fold': {
    vol: 0.5,
    voices: 1,
    gap: 0.3,
    layers: [
      noise(0.05, 0.8, BP(3000, 800, 1)),
      { wave: 'sine', freq: 6000, to: 120, sweep: 0.4, curve: 'exp', env: { a: 0.003, s: 1, hold: 0.38, r: 0.04 }, vol: 0.5 },
      { wave: 'square', freq: 3000, to: 60, sweep: 0.4, env: { a: 0.003, s: 1, hold: 0.36, r: 0.04 }, vol: 0.12, filter: LP(2500, 400) },
      click(400, 0.6, 0.44),
    ],
  },
};

const TALLY: Recipes = {
  // A 100 % ratio: a bell ding and a short brassy stab.
  'fps/tally-100': {
    vol: 0.55,
    voices: 1,
    gap: 0.2,
    layers: [
      ...fmBell(hz('C6'), 0.4, 0.5, { ratio: 3.5, index: 2.5, decay: 0.08, octave: 0.3 }),
      ...['C4', 'E4', 'G4', 'C5'].map((n) => ({ wave: 'saw', freq: hz(n), env: { a: 0.008, d: 0.08, s: 0.5, hold: 0.12, r: 0.1 }, vol: 0.2, delay: 0.03, filter: LP(1600, 3000) }) as SfxLayer),
    ],
  },
};

const SHOUTS: Recipes = {
  // A nervous young soldier's startled wordless yelp.
  'fps/shout-guard': {
    vol: 0.6,
    voices: 1,
    gap: 0.4,
    layers: voice(260, 0.5, 800, 1300, [[0, -3], [0.06, 3], [0.2, 1], [0.32, 4], [0.5, -2]], 1, { vibrato: { rate: 9, depth: 0.4, delay: 0.1 } }),
  },
  // A pompous older man's indignant wordless bellow: "hm-PH!".
  'fps/shout-officer': {
    vol: 0.6,
    voices: 1,
    gap: 0.4,
    layers: [
      ...voice(118, 0.18, 380, 1000, [[0, 0], [0.18, -1]], 0.7),
      ...voice(128, 0.38, 900, 1250, [[0, 3], [0.1, 5], [0.38, -3]], 1).map((l) => ({ ...l, delay: (l.delay ?? 0) + 0.2 })),
    ],
  },
  // A cold soldier's short clipped bark of command.
  'fps/shout-ss': {
    vol: 0.62,
    voices: 1,
    gap: 0.4,
    layers: [...voice(150, 0.28, 720, 1150, [[0, 2], [0.04, 0], [0.28, -2]], 1), ...voice(140, 0.14, 650, 1100, [[0, 0], [0.14, -3]], 0.6).map((l) => ({ ...l, delay: (l.delay ?? 0) + 0.3 }))],
  },
};

/** Every fps sound effect by id (docs/design/fps.md §9.1). */
export const FPS_SFX: Readonly<Record<string, SfxRecipe>> = {
  ...WEAPONS,
  ...ENEMIES,
  ...DOGS,
  ...BOSS,
  ...WORLD,
  ...PICKUPS,
  ...PLAYER,
  ...BRIDGE,
  ...TALLY,
  ...SHOUTS,
};

/** The tell sounds and the ticks each must stay audible (§4.3, §7.2; the shortest tell that uses it). */
export const FPS_TELLS: Readonly<Record<string, number>> = {
  'fps/enemy/aim': 24,
  'fps/dog/growl': 18,
  'fps/boss/spin-up': 24,
};
