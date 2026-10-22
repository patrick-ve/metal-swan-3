/**
 * `rf-a` DE FILE (docs/design/ring.md §R.5; ~1:15 at a human pace): the A10 at the Zuidas in the
 * normal 2D side view. The heroes stand on the hard shoulder; the near lane's stopped vehicles
 * (props.ts) are cover and platforms (their roofs), the coach and the box truck the highest; the
 * far lanes stand still too (back decor: the drive's civilian cars), the median, the oncoming
 * carriageway with the railway, the Zuidas towers — the drive's own road layers (`ring-road`,
 * `ring-farroad`, `ring-verge`, `ring-city` 'zuidas', `ring-far` 'towers', `ring-sky`; the near
 * crash barrier `ring-front` in front) moved up by `RF_SHIFT`. The ring gangs on foot
 * (foot/gangs/), a tied hostage in the gang's open parcel van, three weapon crates, checkpoints
 * ≤ 1,400 px apart, three camera locks, the police line at the end → `rf-b`.
 *
 * Owner: JAM+FOOT (revision R, wave A). Keep the export `sectionRfA`, `RF_A_W`, `RF_A_ART`,
 * `RF_BACKGROUND` (rf-b uses the background) and the id 'rf-a'.
 */
import { terrain, type DecorDef, type SectionDef } from '../../../mission/index';
import type { RingCarModel } from '../../../ring/ids';
import { CAR_GEO, carColour, carSprite } from '../traffic/geometry';
import { RF_GROUND, RF_SECTION } from './ids';
import { FAR_LANE_Y, RF_A_BLOCKS, RF_A_CHECKPOINTS, RF_A_EXIT, RF_A_PLATFORMS, RF_A_W, RF_SHIFT } from './layout-rf-a';
import { scriptRfA, RF_A_FOES } from './script-rf-a';

export { RF_A_W };

/** What rf-a draws at tier 4 (besides the ring's resident cars, wagons, scooters and drivers). */
export const RF_A_ART: readonly string[] = [
  'ring/foot/',
  'ring/parcel-van/body',
  'ring/parcel-van/rear',
  'ring/parcel-van/parcel',
  'ring/parcel-van/card',
  'item/crate',
  'item/hostage/tourist/',
  'item/bind',
  ...RF_A_FOES,
];

/**
 * The background: the ring's own layers (one repeating tile each; the road's 576 px = six lane
 * dashes, so the dashes join), moved up by `RF_SHIFT`. rf-b reuses it.
 */
export const RF_BACKGROUND: SectionDef['background'] = {
  sky: 0x7aa6d8ff,
  layers: [
    { gen: 'ring-sky', params: { kind: 'day' }, width: 512, height: 104, factorX: 0.05 },
    { gen: 'ring-far', params: { kind: 'towers', x0: 0, rs: 3 }, width: 512, height: 80, factorX: 0.2, offsetY: 20 - RF_SHIFT },
    { gen: 'ring-city', params: { kind: 'zuidas', x0: 0, rs: 3 }, width: 1024, height: 92, factorX: 0.35, offsetY: 8 - RF_SHIFT },
    { gen: 'ring-verge', params: { kind: 'plain', x0: 0, rs: 3 }, width: 512, height: 64, factorX: 0.75, offsetY: 36 - RF_SHIFT },
    { gen: 'ring-farroad', params: { kind: 'rail', x0: 0, rs: 3 }, width: 576, height: 44, factorX: 0.9, offsetY: 64 - RF_SHIFT },
    { gen: 'ring-road', params: { kind: 'open', x0: 0, rs: 3 }, width: 576, height: 123, factorX: 1, offsetY: 85 - RF_SHIFT },
    { gen: 'ring-front', params: { kind: 'open', x0: 0, rs: 3 }, width: 576, height: 22, factorX: 1.25, offsetY: 194, front: true },
  ],
};

/** A small integer hash (layout only; no rng). */
function h(i: number, k: number): number {
  let v = (i * 374761393 + k * 668265263) | 0;
  v = Math.imul(v ^ (v >>> 13), 1274126177);
  return ((v ^ (v >>> 16)) >>> 0) / 4294967296;
}

/** Lane 1 (farthest) may hold the tall ones; lanes 2 and 3 only low cars, so the near lane reads. */
const FAR_MODELS: readonly (readonly RingCarModel[])[] = [
  ['hatch', 'estate', 'van', 'box-truck', 'hatch', 'camper', 'estate', 'taxi'],
  ['hatch', 'estate', 'taxi', 'hatch', 'estate'],
  ['hatch', 'estate', 'hatch', 'taxi'],
];
/** Gaps between the far cars per lane (min, spread): the nearer the lane, the emptier. */
const FAR_GAP: ReadonlyArray<readonly [number, number]> = [
  [10, 50],
  [40, 120],
  [150, 260],
];

/** The far lanes' standing cars (lane 1 … 3): the jam thins toward the near lane. */
export function farCars(width: number): DecorDef[] {
  const out: DecorDef[] = [];
  FAR_LANE_Y.forEach((y, lane) => {
    let x = -40 + Math.floor(h(lane, 1) * 60);
    let i = 0;
    while (x < width + 60) {
      const list = FAR_MODELS[lane];
      const model = list[Math.floor(h(lane * 101 + i, 2) * list.length)];
      const g = CAR_GEO[model];
      const cx = x + g.len / 2;
      const colour = carColour(model, Math.floor(h(lane * 101 + i, 3) * 11));
      out.push({ sprite: carSprite(model, colour), x: cx, y });
      // Wheels as decor too (frame 0, standing).
      const wr = g.wheel === 's' ? 5.5 : g.wheel === 'm' ? 6.5 : 7.5;
      for (const wx of g.wheels) out.push({ sprite: `ring/car/wheel-${g.wheel}`, x: cx + wx, y: y - Math.round(wr + 0.5) });
      x += g.len + FAR_GAP[lane][0] + Math.floor(h(lane * 101 + i, 4) * FAR_GAP[lane][1]);
      i++;
    }
  });
  return out;
}

function terrainRfA() {
  const t = terrain(RF_A_W, 216);
  t.ground().at(0, RF_GROUND).flat(RF_A_W);
  for (const [x, y, w] of RF_A_PLATFORMS) t.platform(x, y, w);
  for (const [x, y, w, hh] of RF_A_BLOCKS) t.solid(x, y, w, hh);
  return t.build();
}

export const sectionRfA: SectionDef = {
  id: RF_SECTION.a,
  name: 'DE FILE',
  width: RF_A_W,
  height: 216,
  scroll: 'right',
  background: RF_BACKGROUND,
  terrain: terrainRfA(),
  // Hidden under the shoulder strip and the vehicles (props.ts): only the collision counts.
  terrainStyle: { ground: 'concrete', platform: 'metal', solid: 'concrete' },
  decor: farCars(RF_A_W),
  art: RF_A_ART,
  playerStart: { x: 96, y: RF_GROUND },
  checkpoints: [...RF_A_CHECKPOINTS],
  timeLimit: 0,
  exits: [{ id: 'rf-a-end', rect: { ...RF_A_EXIT }, to: RF_SECTION.b }],
  script: scriptRfA,
};
