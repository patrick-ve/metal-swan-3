/**
 * Shared scenery of `ams2` (the reference scenes' helpers, docs/design/ams2/spike/hires/scenes.py):
 * the shared props in every light, clouds, birds, the house row, the quay wall, the far plane.
 */
import { addMargin, kitTier, S } from '../../../art/herokit/canvas';
import { swayCrown, trunk } from '../../../art/herokit/foliage';
import { renderBuffer } from '../../../art/herokit/hi';
import { type LightName, LIGHTS, R, VARIANTS } from '../../../art/herokit/palette';
import { bench, bike, bikeRack, crate, farCyclist, flagFrames, flagPole, lamp, planter, post, smokeFrames, tourboat, wasteBin } from '../../../art/herokit/props';
import { rngf } from '../../../art/herokit/rng';
import { birdFrames, cloudSprite, farTower, skyline } from '../../../art/herokit/sky';
import { house, type GableKind } from '../../../art/herokit/walls';
import { waterBand } from '../../../art/herokit/water';
import type { PixelBuffer } from '../../../../engine/pixel';
import type { DecorDef } from '../../../mission/index';
import { artId, type Band, bandEnd, bandTiles, defineArt, defineBand, G, hitProp, HIT_FOOT, LIGHT_NAMES, mover, S_FAR, S_SKY, VH, WATER_TPF } from './stage';

/** The top of a lamp a gull sleeps on (the scripts' `LAMP_TOP` in `ams`). */
export const PERCH_TOP = G - 70;
/** Its height: from `HIT_FOOT` up to `PERCH_TOP`. */
const PERCH_LAMP_H = HIT_FOOT - PERCH_TOP + 1;

/** A lamp at speed 1 with its top where a gull of the shared script sleeps. */
export function perchLamp(light: LightName, wx: number): DecorDef {
  return hitProp(artId(light, 'lamp-perch'), wx - 8, HIT_FOOT + 1);
}

// ------------------------------------------------------------------------------- shared props

for (const L of LIGHT_NAMES) {
  defineArt(L, 'post', () => post(false));
  defineArt(L, 'post-far', () => post(true));
  for (const h of [38, 72]) defineArt(L, `lamp-${h}`, () => lamp(h));
  defineArt(L, 'lamp-perch', () => lamp(PERCH_LAMP_H));
  defineArt(L, 'bench', () => bench());
  for (const c of ['navy', 'dred', 'dgreen']) defineArt(L, `bike-${c}`, () => bike(c));
  defineArt(L, 'planter', () => planter().box);
  defineArt(L, 'tulips', () => planter().tulips, { ticksPerFrame: 30 });
  defineArt(L, 'flag-nl', () => flagFrames('nl'), { ticksPerFrame: 8 });
  defineArt(L, 'flag-city', () => flagFrames('city'), { ticksPerFrame: 8 });
  for (const h of [76, 78]) defineArt(L, `flag-pole-${h}`, () => flagPole(h));
  defineArt(L, 'crate', () => crate(20, 14));
  defineArt(L, 'waste-bin', () => wasteBin(), { fine: true });
  defineArt(L, 'bike-rack', () => bikeRack(), { fine: true });
  defineArt(L, 'smoke', () => smokeFrames(), { ticksPerFrame: 9 });
  defineArt(L, 'birds', () => birdFrames(), { anchor: 'tl', ticksPerFrame: 10 });
  for (const c of ['dred', 'navy', 'dgreen']) defineArt(L, `far-cyclist-${c}`, () => farCyclist(c), { anchor: 'tl', ticksPerFrame: 8 });
  defineArt(L, 'tour-boat', () => tourboat(), { anchor: 'tl' });
}

// ------------------------------------------------------------------------------------- the sky

const CLOUD_SPAN = 860;

/** Seven clouds that drift over the sky (seed as in the reference's scene). */
export function cloudsDecor(light: LightName, seed: number): DecorDef[] {
  const r = rngf(seed);
  const pos: Array<readonly [number, number]> = [];
  const size: Array<readonly [number, number]> = [];
  for (let i = 0; i < 7; i++) {
    const x = r.random() * (CLOUD_SPAN - 120);
    const w = Math.trunc(46 + r.random() * 64);
    const h = Math.trunc(12 + r.random() * 10);
    const y = Math.trunc(2 + r.random() * 22);
    pos.push([Math.trunc(x), y]);
    size.push([w, h]);
  }
  const id = defineArt(light, `clouds-${seed}`, () => size.map(([w, h], i) => cloudSprite(w, h, seed + i, true, LIGHTS[light].cloud)), { anchor: 'tl' });
  return pos.map(([x, y], i): DecorDef => ({ sprite: id, frame: i, x: -120, y, parallax: S_SKY, moveX: 0.03, moveSpan: CLOUD_SPAN, moveFrom: x + 120 }));
}

/** Birds far away (the reference's `mover`). */
export function birdsDecor(light: LightName, x0: number, y: number, v: number, sectionW: number): DecorDef[] {
  return mover(artId(light, 'birds'), 0.1, x0, y, v, 700, sectionW, 6);
}

// --------------------------------------------------------------------------------- the far plane

/** The far city as a tile: a skyline on `base` and far towers (x, height). */
export function defineFarBand(light: LightName, name: string, seed: number, base: number, towers: ReadonlyArray<readonly [number, number]>): Band {
  const tall = Math.max(50 + 14, ...towers.map(([, h]) => h + 28));
  return defineBand({
    light,
    name,
    speed: S_FAR,
    rows: [Math.max(0, base - tall - 1), base + 1],
    width: 768,
    paint: () => {
      const s = new S(768, VH);
      s.wrap = true;
      skyline(s, base, seed);
      for (const [x, h] of towers) farTower(s, x, base, h);
      return s;
    },
  });
}

// --------------------------------------------------------------------------------- house rows

const MATS = ['brickr', 'brickd', 'plastc', 'bricko', 'plastg', 'brickb', 'plastw', 'brickn', 'plastp'];
const KINDS: readonly GableKind[] = ['step', 'neck', 'bell', 'flat', 'spout', 'neck', 'step', 'bell'];

export interface HouseRowOpts {
  sh?: number;
  ww?: number;
  wh?: number;
  gr?: number;
  gh?: number;
  wmin?: number;
  wmax?: number;
}

/** A row of canal houses from x −10 on, standing on `base`. A `wrap` canvas tiles it. */
export function houseRow(s: S, base: number, seed: number, o: HouseRowOpts = {}): void {
  const r = rngf(seed);
  let x = -10;
  let i = r.int(0, 9);
  const { wmin = 42, wmax = 62, ...rest } = o;
  while (x < s.w - 10) {
    let w = r.int(wmin, wmax);
    const st = r.random() < 0.45 ? 2 : 3;
    let mat = MATS[i % MATS.length];
    if (kitTier() >= 2) mat = VARIANTS[mat][r.int(0, 5)];
    const kind = KINDS[(i * 3 + 1) % KINDS.length];
    const sd = Math.trunc(i * 7919 + seed);
    const side = i % 4 === 2 ? 8 : 0;
    // In a tile the last house closes the row on the first one.
    if (s.wrap && x + w + side > s.w - 10 - wmin) w = Math.max(wmin, s.w - 10 - x - side);
    const hs = house(w, st, mat, kind, sd, { side, plastered: mat.startsWith('plast'), doorm: ['dgreen', 'dred', 'navy'][i % 3], ...rest });
    s.paste(hs, x, base - hs.h + 1);
    x += w + side;
    i++;
  }
}

/** The stone wall of a quay. */
export function quayWall(s: S, y: number, h = 6): void {
  const [a, b, c, d] = R.stone;
  s.use(1, 1);
  s.rect(c, 0, y, s.w, h);
  s.hl(a, 0, y, s.w);
  s.hl(b, 0, y + 1, s.w);
  s.hl(d, 0, y + h - 1, s.w);
  s.hl(d, 0, y + h - 2, s.w);
  for (let x = 0; x < s.w; x += 11) s.vl(d, x, y + 1, h - 2);
}

/** The far edge of a floor that looks onto water: a stone strip (rows B0 − 3 … B0). */
export function quayEdge(s: S): void {
  const [s0, s1, , s3] = R.stone;
  s.use(1, 0);
  s.rect(s1, 0, 143, s.w, 4);
  s.hl(s0, 0, 143, s.w);
  s.hl(s3, 0, 146, s.w);
  for (let q = 0; q < s.w; q += 19) s.vl(s3, q, 143, 3);
}

// ---------------------------------------------------------------------------- trees and the bank

/** The trunk of a tree: stands on the line of its anchor. Lay it with `atBand` / `hitProp`; its axis is x + 2·tw + 6. */
export function trunkArt(light: LightName, seed: number, tw = 8, height = 96): string {
  return defineArt(light, `tree/trunk-${seed}-${tw}x${height}`, () => {
    const s = new S(tw * 4 + 12, height + 2);
    trunk(s, tw * 2 + 6, height, height, tw, seed);
    return s;
  });
}

/** The crown of a tree, 4 frames that sway (`animate`; `stageSection` gives each crown its own slow step), anchored at its top-left. */
export function crownArt(light: LightName, seed: number, w = 118, h = 118, mat = 'leaf'): string {
  return defineArt(light, `tree/crown-${seed}-${w}x${h}-${mat}`, () => swayCrown(w, h, seed, 4, mat), { anchor: 'tl' });
}

export interface BankOpts {
  light: LightName;
  /** Names the bands (`<name>/bank`, `<name>/water`). */
  name: string;
  /** The plane's speed and the tile's width. */
  speed: number;
  width: number;
  /** Rows the bank tile keeps. */
  rows: readonly [number, number];
  /** Rows of the water under it. */
  waterRows: readonly [number, number];
  /** Draws the bank on a canvas of `width` × VH with `wrap` set (at every tier: `kitTier()` tells which). */
  paint: (s: S) => void;
  /** Adds what stands on the bank as its own sprite (crowns) to the 1× image the water reflects. */
  reflect?: (bank: PixelBuffer) => void;
  seed?: number;
}

/** A far bank and the water that reflects it: two bands of one plane. Three frames of water that differ in a few strokes. */
export function defineBank(o: BankOpts): { bank: Band; water: Band } {
  const { light: L, width: W } = o;
  const paintBank = (): S => {
    const md = new S(W, VH);
    md.wrap = true;
    o.paint(md);
    return md;
  };
  const bank = defineBand({ light: L, name: `${o.name}/bank`, speed: o.speed, rows: o.rows, width: W, paint: paintBank });
  const water = defineBand({
    light: L,
    name: `${o.name}/water`,
    speed: o.speed,
    rows: o.waterRows,
    width: W,
    anim: 3,
    tpf: WATER_TPF.mid,
    paint: () => {
      const image = renderBuffer(paintBank(), L, 1, 0);
      o.reflect?.(image);
      return [0, 1, 2].map((f) => waterBand(W, o.waterRows[0], o.waterRows[1], image, o.seed ?? 51, f));
    },
  });
  return { bank, water };
}

/** Repeat items along a plane every `period` px (props that belong to a repeated tile). */
export function repeatAlong(items: readonly DecorDef[], period: number, s: number, sectionW: number): DecorDef[] {
  const out: DecorDef[] = [];
  const end = bandEnd(sectionW, s);
  for (let k = 0; k * period < end; k++) for (const d of items) out.push({ ...d, x: d.x + k * period });
  return out;
}

/** The band tiles of a far plane for a section. */
export function farDecor(b: Band, sectionW: number): DecorDef[] {
  return bandTiles(b, sectionW);
}

export { addMargin };
