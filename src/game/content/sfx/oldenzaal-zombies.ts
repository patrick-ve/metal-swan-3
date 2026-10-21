// Synth sounds of mission oldenzaal, the dead soldiers (revision 2; docs/design/oldenzaal.md §3;
// ids.ts `OZ_SFX.zombie`, the ids in zombies/soldier.ts `ZSFX`). Spread into SFX in sfx/index.ts.
// Synth recipes only (no generated takes in wave B). Owner: ZOMBIES.
//
// The dead: `groan` (a low, wet, wordless moan from a rotted throat), `growl` (the crawler's
// rasping snarl), `drag` (a body dragged over pavers: cloth scrape and a knock), `swing-tell`
// (the shovel / rifle wound back: a rasp of breath and a creak of leather), `swing` (a heavy
// whoosh and a dull thud), `rifle-tell` (an old rifle raised: a bolt click and a metallic scrape),
// `rifle` (a single old rifle shot: a dry crack with a long dull tail), `bolt` (working the bolt:
// two rusty clacks), `mg-plant` (the bipod set down: a heavy clank on stone), `mg-tell` (the
// cocking handle racked: a hard metallic clack-clack), `mg` (one round of a fast old machine gun:
// a short hard rip), `grab-tell` (the crawler rears up: a gurgling hiss), `grab` (a lunge and a
// grip on leather), `bite` (a hard clack of teeth), `let-go` (the grip torn loose: a cloth rip and
// a hiss), `hit` (a bullet into old cloth and dry rot: a dull puff), `helmet` (a steel helmet
// knocked off: a hollow clang), `barrel` (the barrel jacket shot off: a metal snap), `collapse`
// (the body falls into bones and dust: a dry clatter and a soft sigh of dust), `ground` (the
// ground breaks: a crunch of pavers and earth), `burst` (planks bursting: wood cracking), `manhole`
// (a cast-iron cover rattled and dragged), `flinch` (the cower: a sharp rasping hiss).
// Bloodless and wordless: no screams, no laughs.
import { BP, HP, LP, noise, tone, type Recipes } from './kit';

export const OZ_ZOMBIE_SFX: Recipes = {
  'oz/zombie/groan': {
    vol: 0.75,
    voices: 3,
    gap: 0.35,
    drive: 0.25,
    layers: [
      { wave: 'saw', freq: 78, to: 62, env: { a: 0.15, d: 0.25, s: 0.7, hold: 0.55, r: 0.35 }, vol: 0.55, filter: BP(360, 240, 3), vibrato: { rate: 4, depth: 0.35 } },
      { wave: 'square', freq: 39, to: 33, env: { a: 0.2, d: 0.3, s: 0.5, hold: 0.45, r: 0.3 }, vol: 0.22, filter: LP(260) },
      noise(1.1, 0.16, BP(420, 260, 2), { env: { a: 0.12, d: 0.95 } }),
    ],
  },
  'oz/zombie/growl': {
    vol: 0.7,
    voices: 2,
    gap: 0.3,
    drive: 0.4,
    layers: [
      { wave: 'saw', freq: 96, to: 84, env: { a: 0.05, d: 0.15, s: 0.6, hold: 0.35, r: 0.2 }, vol: 0.45, filter: BP(600, 400, 2.5), vibrato: { rate: 23, depth: 0.6 } },
      noise(0.7, 0.3, BP(900, 600, 1.5), { env: { a: 0.05, d: 0.6 } }),
    ],
  },
  'oz/zombie/drag': {
    vol: 0.84,
    voices: 2,
    gap: 0.2,
    layers: [noise(0.35, 0.6, BP(1200, 700, 1.2), { env: { a: 0.08, d: 0.3 } }), tone('sine', 110, 70, 0.08, 0.35, { delay: 0.22 }), noise(0.05, 0.3, LP(600), { delay: 0.22 })],
  },
  'oz/zombie/swing-tell': {
    vol: 1.8,
    voices: 2,
    gap: 0.15,
    layers: [noise(0.4, 0.45, BP(800, 1600, 2), { env: { a: 0.2, d: 0.2 } }), tone('saw', 70, 95, 0.4, 0.25, { filter: BP(400, 600, 3) }), noise(0.06, 0.35, BP(2600, 1800, 3), { delay: 0.3 })],
  },
  'oz/zombie/swing': {
    vol: 0.85,
    voices: 3,
    gap: 0.08,
    layers: [noise(0.18, 0.9, BP(700, 300, 1.2)), tone('sine', 120, 55, 0.14, 0.6, { delay: 0.11 }), noise(0.08, 0.5, LP(700), { delay: 0.11 })],
  },
  'oz/zombie/rifle-tell': {
    vol: 1.12,
    voices: 2,
    gap: 0.2,
    layers: [noise(0.03, 0.6, HP(2400)), tone('square', 1400, 900, 0.03, 0.2, { filter: LP(4000) }), noise(0.25, 0.25, BP(3000, 2000, 4), { delay: 0.12 }), noise(0.03, 0.5, HP(2000), { delay: 0.4 })],
  },
  'oz/zombie/rifle': {
    vol: 0.81,
    voices: 3,
    gap: 0.06,
    drive: 0.3,
    layers: [noise(0.05, 1, HP(1200)), noise(0.6, 0.55, LP(1400, 300), { env: { a: 0.002, d: 0.6 } }), tone('sine', 160, 50, 0.25, 0.6), noise(0.9, 0.15, LP(500), { delay: 0.08, env: { a: 0.05, d: 0.85 } })],
  },
  'oz/zombie/bolt': {
    vol: 1.26,
    voices: 2,
    gap: 0.3,
    layers: [noise(0.03, 0.7, BP(2200, 1600, 3)), tone('square', 900, 500, 0.03, 0.25, { filter: LP(3000) }), noise(0.04, 0.6, BP(1700, 1200, 3), { delay: 0.24 }), tone('square', 700, 420, 0.03, 0.2, { delay: 0.24, filter: LP(3000) })],
  },
  'oz/zombie/mg-plant': {
    vol: 0.85,
    voices: 2,
    gap: 0.2,
    layers: [noise(0.06, 0.8, BP(1500, 900, 2)), tone('triangle', 220, 140, 0.18, 0.4), noise(0.12, 0.4, LP(800), { delay: 0.05 }), noise(0.04, 0.5, BP(2400, 1800, 3), { delay: 0.25 })],
  },
  'oz/zombie/mg-tell': {
    vol: 0.85,
    voices: 2,
    gap: 0.3,
    layers: [noise(0.04, 0.8, BP(2000, 1400, 2.5)), tone('square', 600, 380, 0.04, 0.3, { filter: LP(3000) }), noise(0.05, 0.9, BP(1800, 1100, 2.5), { delay: 0.18 }), tone('square', 520, 300, 0.05, 0.3, { delay: 0.18, filter: LP(2800) })],
  },
  'oz/zombie/mg': {
    vol: 0.75,
    voices: 6,
    gap: 0.02,
    drive: 0.35,
    layers: [noise(0.03, 1, HP(900)), noise(0.12, 0.55, LP(1600, 400)), tone('sine', 130, 60, 0.07, 0.5)],
  },
  'oz/zombie/grab-tell': {
    vol: 1.6,
    voices: 2,
    gap: 0.2,
    layers: [noise(0.45, 0.5, BP(1400, 2400, 2), { env: { a: 0.15, d: 0.3 } }), { wave: 'saw', freq: 120, to: 160, env: { a: 0.1, d: 0.35 }, vol: 0.25, filter: BP(700, 900, 3), vibrato: { rate: 18, depth: 0.5 } }],
  },
  'oz/zombie/grab': {
    vol: 0.85,
    voices: 2,
    gap: 0.08,
    layers: [noise(0.12, 0.7, BP(1000, 500, 1.2)), noise(0.07, 0.6, BP(500, 300, 2), { delay: 0.1 }), tone('sine', 140, 80, 0.08, 0.4, { delay: 0.1 })],
  },
  'oz/zombie/bite': {
    vol: 0.9,
    voices: 2,
    gap: 0.1,
    layers: [noise(0.03, 1, BP(3000, 2000, 2)), tone('square', 1200, 700, 0.03, 0.3, { filter: LP(4000) }), noise(0.1, 0.4, LP(900), { delay: 0.02 })],
  },
  'oz/zombie/let-go': {
    vol: 1.42,
    voices: 2,
    gap: 0.15,
    layers: [noise(0.2, 0.7, BP(2200, 900, 1.5)), noise(0.3, 0.3, BP(1200, 2000, 2), { delay: 0.1, env: { a: 0.05, d: 0.25 } })],
  },
  'oz/zombie/hit': {
    vol: 0.9,
    voices: 4,
    gap: 0.05,
    layers: [noise(0.08, 0.7, BP(600, 300, 1.2)), noise(0.05, 0.35, HP(2500), { delay: 0.01 })],
  },
  'oz/zombie/helmet': {
    vol: 0.75,
    voices: 3,
    gap: 0.08,
    layers: [tone('triangle', 820, 760, 0.35, 0.4), tone('sine', 1370, 1300, 0.25, 0.2), noise(0.04, 0.6, BP(3000, 2000, 2))],
  },
  'oz/zombie/barrel': {
    vol: 0.66,
    voices: 2,
    gap: 0.2,
    layers: [noise(0.05, 1, HP(1500)), tone('square', 900, 300, 0.12, 0.3, { filter: LP(3500) }), noise(0.25, 0.3, BP(2500, 1200, 2), { delay: 0.05 })],
  },
  'oz/zombie/collapse': {
    vol: 0.85,
    voices: 3,
    gap: 0.15,
    layers: [
      ...[0, 0.07, 0.13, 0.22, 0.3, 0.41].map((t, i) => noise(0.05, 0.45 - i * 0.04, BP(1800 - i * 150, 1200, 3), { delay: t })),
      noise(0.9, 0.3, LP(900, 300), { delay: 0.15, env: { a: 0.2, d: 0.7 } }),
      tone('sine', 90, 50, 0.2, 0.35),
    ],
  },
  'oz/zombie/ground': {
    vol: 0.9,
    voices: 2,
    gap: 0.2,
    drive: 0.2,
    layers: [noise(0.4, 0.7, LP(900, 300), { env: { a: 0.05, d: 0.35 } }), ...[0.05, 0.14, 0.26].map((t) => noise(0.05, 0.5, BP(1400, 900, 2), { delay: t })), tone('sine', 70, 45, 0.4, 0.45)],
  },
  'oz/zombie/burst': {
    vol: 0.9,
    voices: 2,
    gap: 0.2,
    layers: [...[0, 0.12, 0.3].map((t) => noise(0.07, 0.7, BP(900, 600, 1.5), { delay: t })), tone('sine', 120, 70, 0.12, 0.4), tone('sine', 110, 60, 0.12, 0.4, { delay: 0.3 })],
  },
  'oz/zombie/manhole': {
    vol: 0.85,
    voices: 2,
    gap: 0.2,
    layers: [...[0, 0.09, 0.2, 0.27].map((t) => tone('triangle', 310, 280, 0.12, 0.3, { delay: t })), noise(0.5, 0.3, BP(1800, 1100, 2), { delay: 0.3, env: { a: 0.1, d: 0.4 } })],
  },
  'oz/zombie/flinch': {
    vol: 1.35,
    voices: 2,
    gap: 0.2,
    layers: [noise(0.22, 0.6, BP(2400, 1500, 2)), { wave: 'saw', freq: 150, to: 110, env: { a: 0.02, d: 0.2 }, vol: 0.2, filter: BP(800, 600, 3) }],
  },
};
