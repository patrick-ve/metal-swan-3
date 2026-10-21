// Synth sounds of mission ring, area 'crew' (docs/design/ring.md §5.5, §7.2, §11; wave B): the
// road-works crew and the jam boarders. Spread into SFX in sfx/index.ts. Synth recipes only (no
// samples, no generated audio). Owner: the CREW builder.
//
// Telegraphs start on the first tell tick (GDD §4.11 rule 2): `ring/crew-cone-lift` (a cone pulled
// off the stack: a hollow plastic scrape and knock), `ring/crew-hop-tell` (a boarder crouches: a
// shoe scuff and a cloth rustle), `ring/crew-swing-tell` (the arm goes up on the bonnet: a quick
// rising whoosh).
// Cues: `ring/crew-beeper` (the road-works truck's warning beeper: three short square beeps through
// a small horn), `ring/crew-cone-throw` (a cone whirls through the air), `ring/crew-cone-hit` (a
// thrown cone lands on a wagon: a plastic whack on sheet metal), `ring/crew-hop` (a boarder jumps:
// a cloth whoosh), `ring/crew-boot` (a boot / a fist / a bottle on the bonnet: a dull sheet-metal
// bang with a low thud), `ring/crew-knocked` (a man knocked off: a body thump and a scrape on the
// asphalt; bloodless), `ring/crew-wreck` (the truck wrecked: a heavy crunch, glass, the air brakes
// hissing out).
import { BP, clack, hits, HP, LP, noise, scatter, tone, type Recipes } from './kit';

const GLASS = scatter(8, 41);

export const RING_CREW: Recipes = {
  'ring/crew-beeper': {
    vol: 0.5,
    voices: 1,
    gap: 0.6,
    layers: hits(3, 0, 0.16).map((t) => ({ wave: 'square' as const, freq: 1046, env: { a: 0.003, d: 0.01, s: 0.85, hold: 0.08, r: 0.015 }, vol: 0.4, delay: t, filter: BP(1800, undefined, 1.1) })),
  },
  'ring/crew-cone-lift': {
    vol: 0.8,
    voices: 2,
    gap: 0.1,
    layers: [noise(0.12, 0.7, BP(900, 1600, 1.2)), tone('triangle', 220, 300, 0.08, 0.6, { delay: 0.06 }), ...clack(650, 0.5, 0.1, 0.02)],
  },
  'ring/crew-cone-throw': {
    vol: 0.9,
    voices: 2,
    gap: 0.08,
    layers: [noise(0.22, 1, BP(700, 2400, 1.1)), noise(0.18, 0.5, BP(1800, 900, 1.6), { delay: 0.05 })],
  },
  'ring/crew-cone-hit': {
    vol: 0.7,
    voices: 3,
    gap: 0.05,
    layers: [tone('triangle', 240, 120, 0.1, 0.6), noise(0.08, 0.5, BP(1300, 600, 1.2)), tone('square', 140, 70, 0.14, 0.25, { filter: LP(900) }), ...clack(520, 0.35, 0.02, 0.03)],
  },
  'ring/crew-hop-tell': {
    vol: 0.9,
    voices: 2,
    gap: 0.1,
    layers: [noise(0.07, 1, BP(2600, 1800, 1.2)), noise(0.14, 0.6, BP(800, 1200, 1), { delay: 0.05 })],
  },
  'ring/crew-hop': {
    vol: 0.85,
    voices: 2,
    gap: 0.08,
    layers: [noise(0.16, 0.9, BP(500, 1500, 1)), tone('sine', 180, 120, 0.06, 0.5)],
  },
  'ring/crew-swing-tell': {
    vol: 0.85,
    voices: 2,
    gap: 0.1,
    layers: [noise(0.14, 0.9, BP(600, 2200, 1.2)), tone('sine', 300, 520, 0.12, 0.25)],
  },
  'ring/crew-boot': {
    vol: 0.8,
    voices: 3,
    gap: 0.05,
    drive: 0.4,
    layers: [tone('sine', 110, 55, 0.18, 0.8), tone('square', 330, 180, 0.09, 0.25, { filter: BP(900, 500, 1.4) }), noise(0.12, 0.45, BP(1500, 700, 1)), ...clack(1200, 0.25, 0.01, 0.02)],
  },
  'ring/crew-knocked': {
    vol: 0.65,
    voices: 3,
    gap: 0.06,
    layers: [tone('sine', 120, 60, 0.12, 0.7), noise(0.1, 0.4, LP(900)), noise(0.25, 0.25, BP(3000, 1500, 1.2), { delay: 0.12 })],
  },
  'ring/crew-wreck': {
    vol: 0.8,
    voices: 2,
    gap: 0.2,
    drive: 0.6,
    layers: [
      tone('sine', 80, 32, 0.45, 0.9),
      noise(0.5, 0.6, BP(1500, 500, 0.8)),
      ...hits(5, 0.03, 0.05, 1.1).flatMap((t, i) => clack(800 + i * 230, 0.35, t, 0.03)),
      ...GLASS.slice(0, 6).map((r, i) => ({ wave: 'sine' as const, freq: 3200 + r * 2600, env: { a: 0.001, d: 0.05 }, vol: 0.12, delay: 0.08 + i * 0.035 })),
      noise(0.7, 0.3, HP(2500), { delay: 0.25, env: { a: 0.05, d: 0.7 } }),
    ],
  },
};
