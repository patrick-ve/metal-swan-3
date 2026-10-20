// Synth sounds of mission ring, area 'wagon' (docs/design/ring.md §11; owner: the WAGON builder):
// the squad wagon's engine hum (a loop; its pitch follows the speed on screen: wagon.ts), the tyre
// screech of the handbrake turn, the swerve's chirp, the horn, armour hits (a thunk, a ram's crunch,
// breaking glass), a bump and the wreck. Spread into SFX in sfx/index.ts. Synth recipes only
// (no samples, no generated audio).
import { BP, click, fmBell, HP, LP, loopRecipe, noise, tone, type Recipes } from './kit';

export const RING_WAGON: Recipes = {
  // The five-cylinder burble (loop, 0.5 s): a low saw at 56 Hz pulsed by the firing order at
  // 22 Hz, a square an octave up, an exhaust rumble and a faint valve whine. 56 / 112 / 224 Hz and
  // the 22 Hz pulse make whole cycles in 0.5 s. `sfxLoop` pitch 0.6 … 1.4 follows the speed.
  'ring/wagon-engine': loopRecipe(0.5, 0.5, [
    { wave: 'saw', freq: 56, vol: 0.55, filter: LP(320), tremolo: { rate: 22, depth: 0.45 } },
    { wave: 'square', freq: 112, vol: 0.14, filter: LP(520) },
    { wave: 'noise', vol: 0.22, filter: LP(650), tremolo: { rate: 22, depth: 0.65, shape: 'saw' } },
    { wave: 'sine', freq: 224, vol: 0.05 },
  ]),
  // The swerve: a quick tyre chirp over a whoosh of air.
  'ring/wagon-swerve': {
    vol: 0.62,
    voices: 2,
    gap: 0.12,
    layers: [
      noise(0.22, 0.55, BP(2400, 1100, 2)),
      tone('sine', 1450, 1150, 0.16, 0.32, { vibrato: { rate: 30, depth: 0.4 } }),
      tone('triangle', 2100, 1700, 0.12, 0.16, { delay: 0.02 }),
    ],
  },
  // The handbrake turn: a long howling screech (two squealing partials, a scrubbing band of noise).
  'ring/wagon-screech': {
    vol: 0.58,
    voices: 1,
    gap: 0.5,
    layers: [
      { wave: 'saw', freq: 1260, to: 1080, sweep: 0.9, env: { a: 0.03, s: 0.8, hold: 0.62, r: 0.2, d: 0.02 }, vol: 0.2, vibrato: { rate: 24, depth: 0.5 }, filter: BP(1300, undefined, 3) },
      { wave: 'sine', freq: 1580, to: 1420, sweep: 0.9, env: { a: 0.04, s: 0.8, hold: 0.6, r: 0.2, d: 0.02 }, vol: 0.3, vibrato: { rate: 19, depth: 0.6 } },
      { wave: 'noise', env: { a: 0.02, s: 0.7, hold: 0.65, r: 0.2, d: 0.02 }, vol: 0.4, filter: BP(2600, 1800, 1.6) },
    ],
  },
  // The horn: a slightly sour two-tone of the 1990s (about 410 and 515 Hz), short and cheeky.
  'ring/wagon-horn': {
    vol: 0.5,
    voices: 1,
    gap: 0.3,
    layers: [
      { wave: 'square', freq: 412, env: { a: 0.01, s: 0.85, hold: 0.32, r: 0.06, d: 0.02 }, vol: 0.3, filter: LP(2200) },
      { wave: 'square', freq: 517, env: { a: 0.01, s: 0.85, hold: 0.32, r: 0.06, d: 0.02 }, vol: 0.26, filter: LP(2400) },
      { wave: 'saw', freq: 206, env: { a: 0.01, s: 0.85, hold: 0.32, r: 0.06, d: 0.02 }, vol: 0.1, filter: LP(900) },
    ],
    filter: HP(120),
  },
  // An armour hit (a bullet, a thrown thing): a dull body-panel thunk with a short ring.
  'ring/wagon-hit': {
    vol: 0.55,
    voices: 3,
    gap: 0.05,
    layers: [
      ...fmBell(240, 0.16, 0.5, { ratio: 1.33, index: 4, decay: 0.04 }),
      tone('sine', 140, 70, 0.12, 0.6),
      noise(0.1, 0.45, LP(2000, 400)),
    ],
  },
  // A ram or a crate: a heavy crunch of sheet metal.
  'ring/wagon-crunch': {
    vol: 0.44,
    voices: 2,
    gap: 0.08,
    layers: [
      tone('sine', 110, 45, 0.22, 0.7),
      noise(0.28, 0.75, LP(3000, 350), { drive: 1.1 }),
      ...fmBell(180, 0.22, 0.45, { ratio: 1.47, index: 6, decay: 0.05 }),
      click(700, 0.3),
    ],
  },
  // The glass gives: a crack and a tinkle of falling bits.
  'ring/wagon-glass': {
    vol: 0.5,
    voices: 1,
    gap: 0.2,
    layers: [
      noise(0.05, 0.6, HP(3500)),
      ...fmBell(3100, 0.18, 0.25, { ratio: 2.4, index: 1.5, decay: 0.03, delay: 0.03 }),
      ...fmBell(3900, 0.14, 0.2, { ratio: 2.1, index: 1.4, decay: 0.03, delay: 0.09 }),
      ...fmBell(2700, 0.16, 0.18, { ratio: 2.6, index: 1.6, decay: 0.03, delay: 0.16 }),
    ],
  },
  // A bump (traffic, the other wagon): a rubbery thud.
  'ring/wagon-bump': {
    vol: 0.6,
    voices: 2,
    gap: 0.1,
    layers: [tone('sine', 120, 60, 0.14, 0.75), noise(0.08, 0.35, LP(900)), tone('triangle', 330, 260, 0.06, 0.15, { delay: 0.01 })],
  },
  // The wreck: a crash (a deep thump, crumpling metal, a burst of glass), then a hiss.
  'ring/wagon-wreck': {
    vol: 0.42,
    voices: 1,
    gap: 0.5,
    layers: [
      tone('sine', 90, 35, 0.4, 0.8),
      noise(0.5, 0.85, LP(3200, 300), { drive: 1.1 }),
      ...fmBell(160, 0.4, 0.5, { ratio: 1.41, index: 7, decay: 0.06 }),
      noise(0.08, 0.5, HP(4000), { delay: 0.05 }),
      ...fmBell(3300, 0.2, 0.2, { ratio: 2.3, index: 1.5, decay: 0.03, delay: 0.1 }),
      { wave: 'noise', env: { a: 0.1, d: 0.6 }, vol: 0.25, delay: 0.35, filter: HP(2500) },
    ],
  },
};
