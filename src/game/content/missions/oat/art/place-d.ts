/**
 * The decor of the oat-d NIGHT PROOF STRIP, 0–1,280 (STREET-A, wave A; docs/design/oat.md §2.5,
 * §8.7 d 1–5, §8.9): the Oudezijds Achterburgwal at 22:30, our row behind (GRAMMAR's Oudezijds
 * sheet, night bake), the quay street, the coping and the canal in front. The section file sets
 * `decor: OAT_D_DECOR`; floor/d.ts reads it for the rows' gaps and its lights (`D_LIGHTS` in
 * floor/painter.ts, = LIGHT-WATER's `OAT_D_LIGHTS` for 0–1,280) sit where these sprites stand: the
 * wall lanterns at 96, 600, 1,150, the masts at 330, 880, the neon over the bar doors at 196, 486,
 * 1,012, 1,250 (pink, cyan, pink, cyan). NIGHT (wave C) builds the rest of the section.
 *
 * Depths (floor/layout.ts): the façade plane 16 (neon, wall lanterns, the plate), bikes against
 * the fronts 14.6, the masts 12.8 on our pavement, the BLOWVERBOD poles at the alley mouths 12.6,
 * the night figures 14.2, the elms on the canal side in FRONT of the walk line (−15: the trunks only,
 * their crowns above the action band).
 */
import type { DecorDef } from '../../../../mission/types';
import { G } from '../terrain';
import { OAT_D_NEON, OAT_D_PLATE } from './night';

/** The façade plane's scale (depth 16: s 0.862): a sprite of w art px spans w / s world px there. */
const S16 = 1 - 16 / 116;

/** Depths of the d strip's decor (floor depth px). */
export const D_DEPTH = {
  facade: 16,
  bike: 14.6,
  person: 14.2,
  mast: 12.8,
  sign: 12.6,
  bin: 12.4,
  elm: -15,
} as const;

/** The strip's x range (spec §2.5: 0–1,280). */
export const D_STRIP: readonly [number, number] = [0, 1280];

/** The bars' neon (world u of the sign's centre; LIGHT-WATER's pink / cyan lights stand there). */
export const D_NEON: readonly (readonly [number, keyof typeof OAT_D_NEON])[] = [
  [196, 'bar'],
  [486, 'snacks'],
  [1012, 'koffie'],
  [1250, 'bar'],
];

/** The street lanterns (world u): wall lanterns on the fronts, masts on our pavement (GRAMMAR's night bake: `lamps`). */
export const D_WALL_LAMPS: readonly number[] = [96, 600, 1150];
export const D_MASTS: readonly number[] = [330, 880];

/** The alley mouths of the strip (BLOWVERBOD poles; GRAMMAR's gaps there are its business). */
export const D_ALLEYS: readonly number[] = [420, 1096];

function it(sprite: string, x: number, depth: number, o: Partial<DecorDef> = {}): DecorDef {
  return { sprite, x, y: G, depth, ...o };
}

/** The d strip's decor. */
export function oatDDecor(): DecorDef[] {
  const out: DecorDef[] = [];
  const F = D_DEPTH.facade;
  // The neon over the bar doors (3 frames: two hums and a flicker), centred on its light.
  for (const [u, word] of D_NEON) {
    const n = OAT_D_NEON[word];
    out.push({ sprite: n.id, x: Math.round(u - n.w / 2 / S16), y: G - 62, depth: F, animate: true });
  }
  // The wall lanterns on their brackets (about 3.4 m up), the masts on our pavement.
  for (const u of D_WALL_LAMPS) out.push({ sprite: 'decor/oat/d/lantern-wall', x: u - 4, y: G - 76, depth: F });
  for (const u of D_MASTS) out.push(it('decor/oat/d/lantern', u, D_DEPTH.mast));
  // The street-name plate on the first corner.
  out.push({ sprite: OAT_D_PLATE.id, x: 20, y: G - 48, depth: F });
  // BLOWVERBOD at the alley mouths, broken bins, bikes against the fronts.
  for (const u of D_ALLEYS) out.push(it('decor/oat/d/blowverbod', u, D_DEPTH.sign));
  for (const u of [560, 1214]) out.push(it('decor/oat/d/bin-broken', u, D_DEPTH.bin));
  for (const [u, k, flip] of [
    [150, 1, false],
    [272, 2, true],
    [700, 1, true],
    [956, 2, false],
  ] as const)
    out.push(it(`decor/oat/d/bike-${k}`, u, D_DEPTH.bike, { flipX: flip }));
  // A few passers-by before 02:00 (no outline, dark, at their depth).
  out.push(it('decor/oat/d/person-1', 640, D_DEPTH.person));
  out.push(it('decor/oat/d/person-2', 1180, D_DEPTH.person, { flipX: true }));
  // The elms on the canal side, in front: dark masses lit from below (spec §8.7 d 5).
  out.push(it('decor/oat/d/elm-front', 262, D_DEPTH.elm, { front: true }));
  out.push(it('decor/oat/d/elm-front', 1124, D_DEPTH.elm, { front: true, flipX: true }));
  return out;
}

/** The d strip's decor (built once). */
export const OAT_D_DECOR: readonly DecorDef[] = oatDDecor();

/**
 * The d strip's façade row for GRAMMAR's strip source: the Oudezijds sheet, night bake, all wet, lit
 * by the lanterns of this file. The rest of oat-d keeps no strips until NIGHT (wave C).
 */
export const D_STRIP_ROWS = [
  { u0: D_STRIP[0], u1: D_STRIP[1], sheet: 'oudezijds', params: { night: true, wet: 1, name: 'achterburgwal', lamps: [...D_WALL_LAMPS, ...D_MASTS].sort((a, b) => a - b) } },
] as const;
