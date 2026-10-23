/**
 * The track's texture page (docs/design/rally.md §7.1 item 3, §7.4): one 256 × 256 page of palette
 * indices, painted by code with PREP's kit (tex/kit.ts) — no photo, no scan, no AI image. Every
 * texture uses at most 16 colours: its own BANK of 16 entries in CLUT row 0 (bank b = entries
 * 16·b … 16·b + 15), all from the PAL_HD ramps. Textures stay 1× at every tier.
 *
 * The page holds full-height strips (their v wraps along the road: the page is 256 texels tall),
 * side by side:
 *
 * | strip | x | w | what |
 * |---|---|---|---|
 * | `road` | 0 | 48 | the driven carriageway, 15 m across (3.2 texels per metre): the left edge line, two dashed lane lines (4 m on, 12 m off at 4 texels per metre along), the shoulder line, wear in the wheel tracks |
 * | `roadBlock` | 48 | 48 | the same with block marks on the shoulder line (exits, the spitsstrook) |
 * | `concrete` | 96 | 32 | barriers, walls, portals, decks (4 texels per metre both ways) |
 * | `grass` | 128 | 32 | verges and fields |
 * | `tiles` | 160 | 32 | the tunnel walls: a dark plinth, cream tiles |
 * | `rail` | 192 | 16 | the guard rail: the steel band on posts, cut out between them |
 * | `lamp` | 208 | 8 | the sodium-orange tunnel lamps, cut out between them |
 * | `earth` | 216 | 8 | the ditch banks |
 * | `water` | 224 | 8 | water: the ditches, under bridges, over tunnels |
 * | `noise` | 232 | 16 | noise-barrier panels on posts (u: 4 m of height) |
 * | `steel` | 248 | 8 | rows 0–127: steel for gantries and poles; rows 128+: 8 × 8 flat swatches |
 *
 * Pure and deterministic (fixed rng forks).
 */
import type { Color } from '../../../../engine/color';
import { Rng } from '../../../../engine/rng';
import type { TexturePage } from '../../../../engine/view3d';
import { PAGE_IDS } from '../../../rally/ids';
import { CLEAR, CLUT_4BIT, PageBuilder, ramp, type TexRect } from '../tex/kit';

/** Texels per metre across the road strip and along every strip. */
export const ROAD_TPM_X = 3.2;
export const TPM = 4;
/** The road strips cover 15 m across: the driven carriageway from barrier face to barrier face. */
export const ROAD_SPAN = 15;

/** The flat swatches (8 × 8 texels each) in the steel strip, rows 128+. */
export type Swatch = 'far' | 'white' | 'dark' | 'sign' | 'grey' | 'red' | 'water' | 'black' | 'amber' | 'blue' | 'green' | 'yellow';
const SWATCHES: readonly Swatch[] = ['far', 'white', 'dark', 'sign', 'grey', 'red', 'water', 'black', 'amber', 'blue', 'green', 'yellow'];

export interface TrackTex {
  readonly page: TexturePage;
  readonly road: TexRect;
  readonly roadBlock: TexRect;
  readonly concrete: TexRect;
  readonly grass: TexRect;
  readonly tiles: TexRect;
  readonly rail: TexRect;
  readonly lamp: TexRect;
  readonly earth: TexRect;
  readonly water: TexRect;
  readonly noise: TexRect;
  readonly steel: TexRect;
  /** The centre texel (u, v) of a flat swatch. */
  swatch(name: Swatch): readonly [number, number];
  /** The colour bank of each texture (entries 16·bank …). */
  readonly banks: Readonly<Record<'road' | 'concrete' | 'grass' | 'tiles' | 'rail' | 'lamp' | 'earth' | 'water' | 'noise' | 'steel', number>>;
}

const BANK = { road: 0, concrete: 1, grass: 2, tiles: 3, rail: 4, lamp: 5, earth: 6, water: 7, noise: 8, steel: 9 } as const;

/** One tone of a PAL_HD ramp. */
function tone(name: Parameters<typeof ramp>[0], i: number): Color {
  return ramp(name, i, i)[0];
}

/** The 16 colours of each bank (fewer are padded with the first). */
function banks(): Color[][] {
  return [
    // 0 road (WORLD, wave B; lead note 2a): asphalt from three close cool greys with a fine grain
    // (1 the base, 2 a hair lighter, 3 a step darker), the tar of the seams, a repair patch, the
    // shoulder's lighter speck, the white line, the worn line, ink, yellow, the faint tyre tracks.
    [tone('steel', 2), tone('steel', 3), tone('black', 5), tone('gable', 1), tone('black', 4), tone('snow', 0), tone('snow', 5), tone('snow', 3), tone('ink', 0), tone('gold', 5), tone('gable', 1)],
    // 1 concrete (lead note 2b): light cool concrete — the dark base line, a dark grain, three close
    // light greys, the joint, the top highlight, a run of dirt.
    [tone('steel', 3), tone('steel', 4), tone('steel', 5), tone('snow', 3), tone('gable', 3), tone('black', 6), tone('steel', 6), tone('snow', 2)],
    // 2 grass.
    [tone('green', 2), tone('green', 3), tone('green', 4), tone('green', 5), tone('olive', 3), tone('olive', 4), tone('moss', 3), tone('olive', 5)],
    // 3 tunnel tiles (lead note 2c): the plinth (two dark slates), the grout (a hair darker than the
    // tiles), two near-white tiles, a dark top band. The lamps' sodium cast comes from the tube's
    // vertex colour (geometry.ts), so the tiles read cream under it.
    [tone('slate', 2), tone('slate', 3), tone('gable', 4), tone('gable', 5), tone('snow', 5), tone('cloth', 4), tone('slate', 1)],
    // 4 rail: cut out, the post, the band (dark → light), its highlight.
    [CLEAR, tone('steel', 2), tone('steel', 3), tone('steel', 4), tone('steel', 5), tone('steel', 6), tone('steel', 7)],
    // 5 lamp: cut out, the housing, the sodium glow (amber → pale).
    [CLEAR, tone('slate', 2), tone('rust', 4), tone('orange', 4), tone('gold', 5), tone('gold', 6), tone('orange', 6)],
    // 6 earth (the ditch banks).
    [tone('brown', 1), tone('brown', 2), tone('brown', 3), tone('olive', 2), tone('moss', 2)],
    // 7 water (dark: a light sparkle reads as a road line far away).
    [tone('canal', 1), tone('canal', 2), tone('canal', 3), tone('canal', 4), tone('canal', 5)],
    // 8 noise barrier: the post, green-grey panels, ribs.
    [tone('steel', 3), tone('moss', 2), tone('moss', 3), tone('moss', 4), tone('olive', 4), tone('ink', 1)],
    // 9 steel and the flat swatches: far grass, white, dark asphalt, the matrix sign, concrete grey, red,
    // water, black, amber, blue, green, yellow.
    [tone('steel', 3), tone('steel', 4), tone('steel', 5), tone('steel', 6), tone('green', 3), tone('snow', 6), tone('steel', 2), tone('ink', 1), tone('stone', 4), tone('red', 5), tone('canal', 3), tone('ink', 0), tone('orange', 4), tone('sky', 2), tone('green', 5), tone('gold', 5)],
  ];
}

/** Swatch → its index in bank 9. */
const SWATCH_INDEX: Readonly<Record<Swatch, number>> = { far: 4, white: 5, dark: 6, sign: 7, grey: 8, red: 9, water: 10, black: 11, amber: 12, blue: 13, green: 14, yellow: 15 };

let built: TrackTex | null = null;

/** The track page (built once; the same bytes every time). */
export function trackTex(): TrackTex {
  if (built) return built;
  const rng = new Rng('rally/track/page');
  const b = new PageBuilder(PAGE_IDS.track, 256, 256);
  const row: Color[] = [];
  for (const bank of banks()) {
    if (bank.length > CLUT_4BIT) throw new Error('trackTex: a bank above 16 colours');
    for (let i = 0; i < CLUT_4BIT; i++) row.push(bank[i < bank.length ? i : 0]);
  }
  b.addRow(row);
  const at = (bank: number, i: number): number => bank * CLUT_4BIT + i;
  const strip = (x: number, w: number): TexRect => b.reserve(x, 0, w, 256);
  const road = strip(0, 48);
  const roadBlock = strip(48, 48);
  const concrete = strip(96, 32);
  const grass = strip(128, 32);
  const tiles = strip(160, 32);
  const rail = strip(192, 16);
  const lamp = strip(208, 8);
  const earth = strip(216, 8);
  const water = strip(224, 8);
  const noise = strip(232, 16);
  const steel = strip(248, 8);

  paintRoad(b, road, rng.fork('road'), (i) => at(BANK.road, i), false);
  paintRoad(b, roadBlock, rng.fork('road-block'), (i) => at(BANK.road, i), true);

  // Concrete (u 0 = the foot of a barrier or a wall, up its height; 4 texels per metre): three close
  // light greys with a fine dark grain, a dark base line (u 0), a top highlight at u 3 (the top edge
  // of the 0.9 m central barrier and of the parapets), joints every 4 m, a few faint runs of dirt.
  {
    const c = (i: number): number => at(BANK.concrete, i);
    b.noise(concrete, rng.fork('concrete'), [c(2), c(3), c(4), c(1)], [8, 4, 3, 1]);
    b.rect(concrete, 0, 0, 1, 256, c(0));
    b.noise(b.reserve(concrete.x + 1, 0, 1, 256), rng.fork('concrete-foot'), [c(1), c(2), c(0)], [3, 4, 1]);
    b.rect(concrete, 3, 0, 1, 256, c(6));
    for (let v = 0; v < 256; v += 16) b.rect(concrete, 1, v, 31, 1, c(5));
    // Runs of dirt down from the top of the tall walls (u ≥ 6), far apart.
    const st = rng.fork('stains');
    for (let k = 0; k < 10; k++) {
      const v = st.int(0, 255);
      const len = st.int(4, 14);
      b.rect(concrete, 32 - len, v, len, 1, c(7));
    }
  }
  // Grass: four greens, olive and moss clumps.
  {
    const g = (i: number): number => at(BANK.grass, i);
    b.noise(grass, rng.fork('grass'), [g(0), g(1), g(2), g(3), g(4), g(5), g(6)], [1, 4, 5, 2, 2, 1, 1]);
    const cl = rng.fork('clumps');
    for (let k = 0; k < 40; k++) b.rect(grass, cl.int(0, 30), cl.int(0, 254), 2, 2, g(cl.int(0, 1) ? 6 : 7));
  }
  // Tunnel tiles: u across the wall's height (0 = the road; 32 texels over 5.4 m): the dark plinth,
  // then near-white tiles of 3 × 4 texels (about 0.5 × 1 m) with fine grout a hair darker, a few
  // tiles a shade off, a dark band at the top.
  {
    const t = (i: number): number => at(BANK.tiles, i);
    const tr = rng.fork('tiles');
    for (let v = 0; v < 256; v++) {
      for (let u = 0; u < 32; u++) {
        let i: number;
        if (u < 5) i = u === 4 ? t(1) : t(tr.int(0, 3) === 0 ? 1 : 0);
        else if (u >= 29) i = t(6);
        else if ((u - 5) % 3 === 0 || v % 4 === 0) i = t(2);
        else {
          const cell = Math.floor((u - 5) / 3) * 31 + (v >> 2) * 17;
          i = t(cell % 11 === 0 ? 5 : cell % 3 === 0 ? 4 : 3);
        }
        b.set(tiles, u, v, i);
      }
    }
  }
  // The guard rail: u across the height (0.8 m over 16 texels: 0 = the ground); posts every 2 m
  // (8 texels along, 2 wide) under the band; the band (u 9–15, the W-beam) along; cut out elsewhere.
  {
    const r = (i: number): number => at(BANK.rail, i);
    b.fill(rail, r(0));
    for (let v = 0; v < 256; v++) {
      if (v % 8 < 2) for (let u = 0; u < 10; u++) b.set(rail, u, v, r(v % 8 === 0 ? 1 : 2));
      for (let u = 9; u < 16; u++) b.set(rail, u, v, r(u === 9 || u === 15 ? 2 : u === 12 ? 6 : u === 11 || u === 13 ? 5 : 4));
    }
  }
  // Tunnel lamps: one lamp every 4 m (16 texels along): 9 texels lit, a dark housing rim, cut out
  // between them.
  {
    const l = (i: number): number => at(BANK.lamp, i);
    b.fill(lamp, l(0));
    for (let v = 0; v < 256; v++) {
      const k = v % 16;
      if (k > 10) continue;
      for (let u = 0; u < 8; u++) {
        const rim = k === 0 || k === 10 || u === 0 || u === 7;
        b.set(lamp, u, v, rim ? l(1) : u === 3 || u === 4 ? l(5) : u === 2 || u === 5 ? l(4) : l(3));
      }
    }
  }
  // Earth (ditches).
  {
    const e = (i: number): number => at(BANK.earth, i);
    b.noise(earth, rng.fork('earth'), [e(0), e(1), e(2), e(3), e(4)], [2, 4, 2, 2, 2]);
  }
  // Water: dark greens with short ripples.
  {
    const w = (i: number): number => at(BANK.water, i);
    b.noise(water, rng.fork('water'), [w(0), w(1), w(2)], [2, 5, 2]);
    const rp = rng.fork('ripples');
    for (let k = 0; k < 60; k++) b.rect(water, rp.int(0, 6), rp.int(0, 255), 1, rp.int(2, 4), w(rp.int(0, 3) === 0 ? 4 : 3));
  }
  // Noise barrier: u across the height (4 m over 16 texels), posts every 4 m along, ribbed panels.
  {
    const n = (i: number): number => at(BANK.noise, i);
    for (let v = 0; v < 256; v++) {
      for (let u = 0; u < 16; u++) {
        let i: number;
        if (v % 16 < 2) i = n(0);
        else if (u === 15) i = n(5);
        else if (u % 3 === 0) i = n(1);
        else i = n(2 + ((u + (v >> 4)) % 3 === 0 ? 1 : 0) + (u > 11 ? 1 : 0));
        b.set(noise, u, v, i);
      }
    }
  }
  // Steel: rows 0–127 brushed steel; rows 128+: the 8 × 8 flat swatches.
  {
    const s = (i: number): number => at(BANK.steel, i);
    const top = b.reserve(steel.x, 0, 8, 128);
    b.noise(top, rng.fork('steel'), [s(0), s(1), s(2), s(3)], [1, 4, 3, 1]);
    for (let v = 0; v < 128; v++) b.set(top, 1, v, s(3));
    SWATCHES.forEach((name, k) => b.rect(steel, 0, 128 + k * 8, 8, 8, s(SWATCH_INDEX[name])));
  }

  const page = b.build();
  built = {
    page,
    road,
    roadBlock,
    concrete,
    grass,
    tiles,
    rail,
    lamp,
    earth,
    water,
    noise,
    steel,
    swatch(name) {
      const k = SWATCHES.indexOf(name);
      return [steel.x + 4, 128 + k * 8 + 4];
    },
    banks: BANK,
  };
  return built;
}

/**
 * A road strip (48 × 256): asphalt (u = (x + 7.5) · 3.2 texels, x = metres right of the centre
 * line; calm: mostly one tone, so the near texels do not compete with the lines), the left edge
 * line (u 2), the lane lines (u 13–14 and 24–25: two texels wide, about 0.6 m, so the dashes read
 * near the car at speed; 16 texels on, 48 off), the shoulder line (u 36; block marks: 4 texels
 * on, 12 off, two wide), wear in the wheel tracks.
 */
function paintRoad(b: PageBuilder, r: TexRect, rng: Rng, c: (i: number) => number, block: boolean): void {
  // Asphalt (lead note 2a): the base tone with a fine grain of a hair lighter. Fixer (wave B): no lone
  // darker texels (near the camera each read as a dark square); the darker tone is only in the tracks.
  b.noise(r, rng.fork('asphalt'), [c(1), c(2)], [12, 6]);
  const xs = (x: number): number => Math.floor((x + ROAD_SPAN / 2) * ROAD_TPM_X);
  // Faint tyre tracks along the lanes: the two wheel tracks of each lane, 2 texels wide, a sparse
  // darker grain (they read as a soft band, not as stripes).
  // Fixer (wave B): short streaks along the lane (4–10 texels), not lone texels: they read as tracks.
  const wear = rng.fork('wear');
  for (const lane of [-5.0, -1.5, 2.0]) {
    for (const off of [-0.85, 0.85]) {
      const u = xs(lane + off);
      for (let du = 0; du < 2; du++) {
        let run = 0;
        for (let v = 0; v < 256; v++) {
          if (run === 0 && wear.int(0, 19) === 0) run = wear.int(4, 10);
          if (run > 0) {
            b.set(r, u + du, v, c(10));
            run--;
          }
        }
      }
    }
  }
  // The shoulder (u 37+): the lighter tone with a few pale specks; dirt along the barriers.
  const sh = rng.fork('shoulder');
  for (let v = 0; v < 256; v++) {
    for (let u = 37; u < 48; u++) {
      const k = sh.int(0, 9);
      if (k < 4) b.set(r, u, v, c(2));
      else if (k === 4) b.set(r, u, v, c(5));
    }
    for (let u = 0; u < 2; u++) if (sh.int(0, 2) === 0) b.set(r, u, v, c(3));
  }
  // A repair patch (one per 64 m strip, a different place in each strip) and two short cracks.
  const tar = rng.fork('tar');
  {
    const u0 = tar.int(6, 30);
    const v0 = tar.int(0, 200);
    const w = tar.int(6, 10);
    const h = tar.int(14, 30);
    b.rect(r, u0, v0, w, h, c(4));
    for (let v = v0; v < v0 + h; v++) if (tar.int(0, 2) === 0) b.set(r, u0 + tar.int(0, w - 1), v, c(3));
  }
  for (let k = 0; k < 2; k++) {
    const u0 = tar.int(4, 42);
    const v0 = tar.int(0, 240);
    b.line(r, u0, v0, u0 + tar.int(-2, 2), v0 + tar.int(5, 12), c(0));
  }
  // The lines (white, a few worn texels).
  const line = rng.fork('lines');
  const paint = (u: number, v: number): void => b.set(r, u, v, line.int(0, 9) === 0 ? c(7) : c(6));
  for (let v = 0; v < 256; v++) {
    paint(2, v);
    if (v % 64 < 16) {
      paint(13, v);
      paint(14, v);
      paint(24, v);
      paint(25, v);
    }
    if (!block) paint(36, v);
    else if (v % 16 < 4) {
      paint(36, v);
      paint(37, v);
    }
  }
}
