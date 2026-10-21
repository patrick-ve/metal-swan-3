/**
 * oz-f — the tower, scrolling up to the top (docs/design/oldenzaal.md §2, §8, §9, REVISION 2: the
 * storm). Owner: TOWER. ~1:30.
 *
 * Inside the square tower of the basilica (layout: content/oldenzaal/tower/layout.ts): steep
 * wooden stairs and plank landings on heavy beams, the stone walls with narrow openings (the storm
 * outside), the clock works with the pendulum, the shaft with crossed braces and the bell ropes, the
 * bell chamber with its oak frame and louvred openings and two swinging bells (`oz-bell`); from
 * about a third of the way up the horde tide (`oz-tide`) climbs behind the heroes; the roof under
 * the small spire with its clock and the big bell in the open lantern; then the jet Swan finale
 * (`oz-swan-jet`), whose last step is `ctx.missionComplete()` (script-oz-f.ts).
 *
 * Collision: the floor, the side walls (24 px; above the roof only the parapet), 45 one-way
 * landings 36 px apart (odd k left, even k right, overlapping at x 184–200: the m3-b1 staircase
 * rule, every goal more than 20 px up) and the one-way roof floor. The exit rect over the roof is
 * a disabled fallback (the finale completes the mission).
 */
import { PAL_HD, PAL_HD_OZ } from '../../../../engine/palette-hd';
import { terrain, type DecorDef, type SectionDef, type TerrainDef } from '../../../mission/index';
import { defineSectionLight, type StaticLight } from '../../oldenzaal/kit/light-api';
import { BG_OZ_TOWER, TOWER_ART, TOWER_FRAME_Y } from '../../oldenzaal/tower/art';
import { ledgeX, ledgeY, TOWER } from '../../oldenzaal/tower/layout';
import { OZ_AMBIENCE, OZ_SECTION, OZ_SONG, OZ_SPRITES } from './ids';
import { scriptOzF } from './script-oz-f';

/** The tower's size (spec §2: about 384 × 1,800). */
export const OZ_F_W = TOWER.w;
export const OZ_F_H = TOWER.h;
/** The floor (feet y) and the climb's landings: k = 1 … OZ_F_LEDGES, 36 px apart, alternating. */
export const OZ_F_FLOOR = TOWER.floor;
export const OZ_F_LEDGES = TOWER.ledges;
export const ozFLedgeY = ledgeY;

/** The climb (see the module comment). */
export function terrainOzF(): TerrainDef {
  const t = terrain(OZ_F_W, OZ_F_H);
  t.ground().at(0, OZ_F_FLOOR).flat(OZ_F_W);
  const wy = TOWER.parapetY;
  t.solid(0, wy, TOWER.wall, OZ_F_H - wy, 'stone').solid(OZ_F_W - TOWER.wall, wy, TOWER.wall, OZ_F_H - wy, 'stone');
  for (let k = 1; k <= OZ_F_LEDGES; k++) t.platform(ledgeX(k), ledgeY(k), TOWER.ledgeW);
  // The roof floor (one-way: the heroes come up through the hatch side of it).
  t.platform(TOWER.wall, TOWER.roofY, OZ_F_W - TOWER.wall * 2);
  return t.build();
}

/** Small hash for the decor variants (deterministic). */
const vh = (k: number, s: number): number => ((k * 2654435761 + s * 40503) >>> 0) % 997;

/** Landings with a hanging lantern (warm pools in the dark; the light pass `lamps`). */
export const OZ_F_LANTERN_K: readonly number[] = [2, 7, 12, 17, 22, 27, 31, 36, 40, 44];

/** Lantern x on landing k: on an iron bracket from the side wall over the landing's wall end. */
function lanternX(k: number): number {
  return k % 2 ? TOWER.wall + 10 : OZ_F_W - TOWER.wall - 10;
}

/** The lanterns' lights (world px). */
export const OZ_F_LAMPS: readonly StaticLight[] = OZ_F_LANTERN_K.map((k) => ({
  x: lanternX(k),
  y: ledgeY(k) - 34 + 15,
  r: 58,
  color: PAL_HD_OZ.candle[5],
  intensity: 0.85,
  flicker: 0.25,
  glow: 0.45,
}));

/** The decor of the tower (back: under / behind the landings; front: over the wall solids). */
function towerDecor(): DecorDef[] {
  const d: DecorDef[] = [];
  // The roof backdrop: the storm sky, the small spire with its clock and the open lantern.
  d.push({ sprite: TOWER_ART.top, x: 0, y: 0 });
  // The tower door at the foot (from the crypt stair) and the first lantern-lit wall.
  d.push({ sprite: TOWER_ART.door, x: TOWER.wall + 2, y: OZ_F_FLOOR });
  // The clock works (gear train in its oak frame) and the pendulum under it.
  d.push({ sprite: TOWER_ART.clock, x: 112, y: 1010 });
  d.push({ sprite: TOWER_ART.pendulum, x: 192, y: 1140, animate: true });
  // Crossed braces and bell ropes in the shaft.
  for (const y of [470, 700, 860]) d.push({ sprite: TOWER_ART.braces, x: TOWER.wall, y, frame: (y >> 3) & 1 });
  for (const [x, y] of [[150, 440], [236, 440], [258, 640]] as const) d.push({ sprite: TOWER_ART.rope, x, y });
  // The bell chamber: the oak frame and the louvred openings.
  d.push({ sprite: TOWER_ART.louvre, x: 112, y: 262 });
  d.push({ sprite: TOWER_ART.louvre, x: 232, y: 330 });
  d.push({ sprite: TOWER_ART.frame, x: TOWER.wall, y: TOWER_FRAME_Y });
  // Under every landing: its beam and joists; between landings: a steep wooden stair.
  for (let k = 1; k <= OZ_F_LEDGES; k++) {
    const right = k % 2 === 0;
    d.push({ sprite: TOWER_ART.landing, x: ledgeX(k) + TOWER.ledgeW / 2, y: ledgeY(k), frame: vh(k, 1) % 3, flipX: right });
    if (k < OZ_F_LEDGES) d.push({ sprite: TOWER_ART.stair, x: 192, y: ledgeY(k), flipX: right });
  }
  d.push({ sprite: TOWER_ART.stair, x: 192, y: OZ_F_FLOOR, flipX: true });
  // The roof floor's edge (the slab under the walkway).
  d.push({ sprite: TOWER_ART.roof, x: TOWER.wall, y: TOWER.roofY });
  // Lanterns.
  for (const k of OZ_F_LANTERN_K) d.push({ sprite: TOWER_ART.lantern, x: lanternX(k), y: ledgeY(k) - 34, animate: 7, flipX: k % 2 === 0 });
  // The walls' cut faces over the wall solids (nothing stands inside them): front decor.
  const n = Math.ceil((OZ_F_H - TOWER.parapetY) / 120);
  for (let i = 0; i < n; i++) {
    const y = TOWER.parapetY + i * 120;
    d.push({ sprite: TOWER_ART.wall, frame: i === 0 ? 2 : vh(i, 5) % 2, x: TOWER.wall / 2, y, front: true });
    d.push({ sprite: TOWER_ART.wall, frame: i === 0 ? 2 : vh(i, 6) % 2, x: OZ_F_W - TOWER.wall / 2, y, front: true, flipX: true });
  }
  // The stone floor's cut face (under the heroes' feet).
  d.push({ sprite: TOWER_ART.floor, x: 0, y: OZ_F_FLOOR, front: true });
  return d;
}

export const OZ_F_DECOR: readonly DecorDef[] = towerDecor();

/** The storm: the darkness of the tower, lanterns, rain blown in, lightning that lights it all. */
export const OZ_F_LIGHT = defineSectionLight(OZ_SECTION.f, {
  darkness: 0.56,
  tint: PAL_HD_OZ.night[1],
  lamps: OZ_F_LAMPS,
  rain: { density: 0.35, slant: 0.34, color: PAL_HD.slate[5] },
  lightning: { every: [220, 520], strength: 1, double: 0.4 },
  heroLight: 34,
  wind: 0.7,
});

export const sectionOzF: SectionDef = {
  id: OZ_SECTION.f,
  name: 'The tower (storm)',
  width: OZ_F_W,
  height: OZ_F_H,
  scroll: 'up',
  background: BG_OZ_TOWER,
  terrain: terrainOzF(),
  terrainStyle: { ground: 'klinker', platform: 'wood', solid: 'brick', seed: 4 },
  decor: [...OZ_F_DECOR],
  // Tier 4: the tower's decor, the tide, the bells, the jet Swan (her glide strip, front, neck),
  // the dead soldiers on the landings (INTEGRATE: ZOMBIES' request).
  art: [...new Set(OZ_F_DECOR.map((x) => x.sprite))].concat(TOWER_ART.entities, OZ_SPRITES.zombies),
  playerStart: { x: 192, y: OZ_F_FLOOR },
  checkpoints: [1200, 600],
  music: OZ_SONG.tower,
  ambience: OZ_AMBIENCE.storm,
  // A disabled fallback over the roof: the finale completes the mission (script-oz-f.ts).
  exits: [{ id: 'top', rect: { x: TOWER.wall, y: 60, w: OZ_F_W - TOWER.wall * 2, h: 100 }, to: 'complete', disabled: true }],
  script: scriptOzF,
};
