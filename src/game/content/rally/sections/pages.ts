/**
 * WORLD's texture pages (wave B; docs/design/rally.md §7.4; docs/api/rally.md "B.W"): drawn by code
 * with PREP's kit, 1× texels at every tier, every texture in its own 16-colour bank of PAL_HD tones.
 *
 * - `WORLD_PAGES.facade` (200): eight full-height strips of 32 × 256 texels (v wraps up a building):
 *   glass curtain walls, stone offices, the 1960s flats, brick houses, the new islands' flats,
 *   corrugated sheds, the halls' big panes and a misc strip (roof gravel, louvres). Row 0 is the day;
 *   rows 1–4 are the NIGHT rows of the window overlay (every entry cut out but the lit windows, at
 *   four glow levels): a seeded pattern of lit windows.
 * - `WORLD_PAGES.props` (201): trees (cut-out cards), bushes and reeds, our own made-up billboards,
 *   the crane lattice, a sports pitch, containers, boats and flat swatches.
 *
 * Pure and deterministic (fixed rng forks); built once.
 */
import type { Color } from '../../../../engine/color';
import { PAL_HD } from '../../../../engine/palette-hd';
import { Rng } from '../../../../engine/rng';
import type { TexturePage } from '../../../../engine/view3d';
import { CLEAR, CLUT_4BIT, PageBuilder, ramp, type TexRect } from '../tex/kit';
import { letterWidth, paintText } from '../tex/letters';
import type { HdRampName } from '../../../../engine/palette-hd';

/** WORLD's page ids (docs/api/rally.md A.7: the scenery 200–299; the sky and lights 300–399). */
export const WORLD_PAGES = { facade: 200, props: 201, signs: 301, lights: 302, sky: 310 } as const;

/** One tone of a PAL_HD ramp. */
export function tone(name: HdRampName, i: number): Color {
  return ramp(name, i, i)[0];
}

/** The PAL_HD colour nearest to (r, g, b) 0..255 (night rows, glow ramps). */
export function nearestHd(r: number, g: number, b: number): Color {
  let best: Color = 0;
  let bd = Infinity;
  for (const k of Object.keys(PAL_HD) as HdRampName[]) {
    for (const c of PAL_HD[k] as readonly Color[]) {
      const cr = (c >>> 24) & 255, cg = (c >>> 16) & 255, cb = (c >>> 8) & 255;
      const d = (cr - r) * (cr - r) * 0.3 + (cg - g) * (cg - g) * 0.59 + (cb - b) * (cb - b) * 0.11;
      if (d < bd) {
        bd = d;
        best = c;
      }
    }
  }
  return best;
}

// ---------------------------------------------------------------------------------------------
// The façade page (200)
// ---------------------------------------------------------------------------------------------

export type FacadeKind = 'glass' | 'stone' | 'flats' | 'brick' | 'modern' | 'shed' | 'hall';
export const FACADE_KINDS: readonly FacadeKind[] = ['glass', 'stone', 'flats', 'brick', 'modern', 'shed', 'hall'];

/** A façade strip: its texels, its bay (across) and storey (up) in texels and metres. */
export interface FacadeStrip {
  readonly kind: FacadeKind;
  readonly rect: TexRect;
  readonly bayTx: number;
  readonly bayM: number;
  readonly storeyTx: number;
  readonly storeyM: number;
  /** Has windows that light up at night. */
  readonly lit: boolean;
}

const STRIP_SPEC: Readonly<Record<FacadeKind, { bayTx: number; bayM: number; storeyTx: number; storeyM: number; lit: boolean }>> = {
  glass: { bayTx: 4, bayM: 3, storeyTx: 4, storeyM: 3.6, lit: true },
  stone: { bayTx: 4, bayM: 3.2, storeyTx: 4, storeyM: 3.4, lit: true },
  flats: { bayTx: 4, bayM: 3, storeyTx: 4, storeyM: 2.9, lit: true },
  brick: { bayTx: 4, bayM: 2.6, storeyTx: 4, storeyM: 3, lit: true },
  modern: { bayTx: 4, bayM: 3.4, storeyTx: 4, storeyM: 3.1, lit: true },
  shed: { bayTx: 2, bayM: 1, storeyTx: 1, storeyM: 1, lit: false },
  hall: { bayTx: 8, bayM: 4, storeyTx: 8, storeyM: 4, lit: true },
};

/** The bank entries every façade strip keeps for its lit windows (day: glass; night: lamps). */
const WIN_WARM = 13;
const WIN_PALE = 14;
const WIN_COOL = 15;

/** The night rows: the glow levels (lampGlow ¼, ½, ¾, 1) of the warm, pale and cool windows. */
const NIGHT_WARM: readonly Color[] = [tone('gold', 3), tone('gold', 4), tone('gold', 5), tone('gold', 6)];
const NIGHT_PALE: readonly Color[] = [tone('plaster', 3), tone('plaster', 4), tone('plaster', 5), tone('plaster', 6)];
const NIGHT_COOL: readonly Color[] = [tone('snow', 2), tone('snow', 3), tone('snow', 4), tone('snow', 5)];
/** The CLUT rows of the window overlay per glow level (row 0 is the day). */
export const NIGHT_ROWS: readonly number[] = [1, 2, 3, 4];

export interface FacadeTex {
  readonly page: TexturePage;
  readonly strips: Readonly<Record<FacadeKind, FacadeStrip>>;
  /** The misc strip: roof gravel (u 0–15) and louvres (u 16–31), full height. */
  readonly roof: TexRect;
  readonly louvre: TexRect;
}

let facadeBuilt: FacadeTex | null = null;

/** A hash 0..1 of integers (the lit-window pattern; deterministic). */
export function hash01(a: number, b: number, c = 0): number {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export function facadeTex(): FacadeTex {
  if (facadeBuilt) return facadeBuilt;
  const rng = new Rng('rally/world/facade');
  const pb = new PageBuilder(WORLD_PAGES.facade, 256, 256);
  const banks: Color[][] = [];
  const strips = {} as Record<FacadeKind, FacadeStrip>;
  FACADE_KINDS.forEach((kind, k) => {
    const s = STRIP_SPEC[kind];
    strips[kind] = { kind, rect: pb.reserve(k * 32, 0, 32, 256), ...s };
  });
  const roof = pb.reserve(224, 0, 16, 256);
  const louvre = pb.reserve(240, 0, 16, 256);
  const at = (bank: number, i: number): number => bank * CLUT_4BIT + i;
  /** A bank: the named colours from 0, the three lit-window entries at 13–15 (their day colours). */
  const bank = (cols: Color[], winDay: Color, winDay2: Color): void => {
    const b = [...cols];
    while (b.length < 13) b.push(cols[0]);
    b.push(winDay, winDay2, winDay2);
    banks.push(b);
  };
  /** The window entry of a window cell: lit (one of 13–15, by `share`) or its dark day index. */
  const win = (bk: number, kind: number, cu: number, cv: number, share: number, dark: number, cool = false): number => {
    const h = hash01(kind * 97 + cu, cv, 7);
    if (h >= share) return at(bk, dark);
    return at(bk, cool ? (h < share * 0.7 ? WIN_COOL : WIN_PALE) : h < share * 0.6 ? WIN_WARM : WIN_PALE);
  };

  // 0 GLASS: blue-green curtain walls — light mullions every bay, a dark spandrel every storey,
  // glass in two tones with diagonal reflections of the sky; offices lit cool white at night.
  {
    const B = 0;
    bank([tone('steel', 5), tone('slate', 2), tone('glass', 2), tone('glass', 3), tone('glass', 4), tone('glass', 5), tone('steel', 3)], tone('glass', 2), tone('glass', 3));
    const r = strips.glass.rect;
    for (let v = 0; v < 256; v++) {
      for (let u = 0; u < 32; u++) {
        let i: number;
        if (u % 4 === 0) i = at(B, 0);
        else if (v % 4 === 0) i = at(B, 1);
        else {
          const refl = (u + v * 2) % 37;
          const base = refl < 3 ? 4 : refl < 5 ? 5 : (v >> 2) % 3 === 0 ? 3 : 2;
          i = base === 2 || base === 3 ? win(B, 0, u >> 2, v >> 2, 0.32, base, true) : at(B, base);
        }
        pb.set(r, u, v, i);
      }
    }
  }
  // 1 STONE: light natural stone (fine grain), punched windows 2 × 2 with a dark reveal.
  {
    const B = 1;
    bank([tone('stone', 5), tone('stone', 6), tone('stone', 4), tone('glass', 1), tone('glass', 2), tone('glass', 3), tone('stone', 3)], tone('glass', 1), tone('glass', 2));
    const r = strips.stone.rect;
    pb.noise(r, rng.fork('stone'), [at(B, 0), at(B, 1), at(B, 2)], [6, 2, 1]);
    for (let v = 0; v < 256; v += 4) {
      for (let u = 0; u < 32; u += 4) {
        const w = win(B, 1, u >> 2, v >> 2, 0.38, 3);
        pb.set(r, u + 1, v + 1, w);
        pb.set(r, u + 2, v + 1, w);
        pb.set(r, u + 1, v + 2, w === at(B, 3) ? at(B, 4) : w);
        pb.set(r, u + 2, v + 2, w === at(B, 3) ? at(B, 5) : w);
        pb.set(r, u + 1, v + 3, at(B, 6));
        pb.set(r, u + 2, v + 3, at(B, 6));
      }
    }
  }
  // 2 FLATS (the 1960s blocks of Ring West): a light concrete gallery band every storey, windows,
  // a coloured panel per bay (red, yellow, blue: the era's infill panels).
  {
    const B = 2;
    bank([tone('gable', 4), tone('gable', 3), tone('stone', 4), tone('glass', 1), tone('glass', 3), tone('red', 4), tone('gold', 5), tone('denim', 3), tone('gable', 5)], tone('glass', 1), tone('glass', 2));
    const r = strips.flats.rect;
    for (let v = 0; v < 256; v++) {
      for (let u = 0; u < 32; u++) {
        const cu = u >> 2, cv = v >> 2, ku = u & 3, kv = v & 3;
        let i: number;
        if (kv === 0) i = at(B, u % 8 === 0 ? 2 : 0);
        else if (kv === 3) i = at(B, 1);
        else if (ku === 0) i = at(B, 8);
        else if (ku === 3) i = at(B, [5, 6, 7, 0][(cu + cv * 3) % 4]);
        else i = win(B, 2, cu, cv, 0.42, kv === 1 ? 4 : 3);
        pb.set(r, u, v, i);
      }
    }
  }
  // 3 BRICK: red-brown brick with mortar courses, windows 2 × 2 under a white lintel.
  {
    const B = 3;
    bank([tone('brick', 2), tone('brickDark', 3), tone('brick', 3), tone('stone', 4), tone('gable', 4), tone('glass', 1), tone('glass', 3)], tone('glass', 1), tone('glass', 2));
    const r = strips.brick.rect;
    pb.noise(r, rng.fork('brick'), [at(B, 0), at(B, 1), at(B, 2)], [6, 2, 2]);
    for (let v = 0; v < 256; v += 4) {
      for (let u = 0; u < 32; u += 4) {
        pb.set(r, u + 1, v, at(B, 4));
        pb.set(r, u + 2, v, at(B, 4));
        const w = win(B, 3, u >> 2, v >> 2, 0.48, 5);
        pb.set(r, u + 1, v + 1, w);
        pb.set(r, u + 2, v + 1, w === at(B, 5) ? at(B, 6) : w);
        pb.set(r, u + 1, v + 2, w);
        pb.set(r, u + 2, v + 2, w);
      }
    }
  }
  // 4 MODERN (the new islands): white and grey panels, big windows, wooden balcony slabs.
  {
    const B = 4;
    bank([tone('gable', 5), tone('gable', 4), tone('steel', 4), tone('glass', 1), tone('glass', 3), tone('wood', 5), tone('wood', 4), tone('slate', 3)], tone('glass', 1), tone('glass', 2));
    const r = strips.modern.rect;
    for (let v = 0; v < 256; v++) {
      for (let u = 0; u < 32; u++) {
        const cu = u >> 2, cv = v >> 2, ku = u & 3, kv = v & 3;
        let i: number;
        if (kv === 3) i = at(B, (cu + cv) % 3 === 0 ? 5 : 1);
        else if (ku === 0) i = at(B, (cu * 5 + cv) % 7 === 0 ? 2 : 0);
        else i = win(B, 4, cu, cv, 0.4, kv === 0 ? 4 : 3);
        pb.set(r, u, v, i);
      }
    }
  }
  // 5 SHED: corrugated cladding (vertical ribs), a dark plinth at the foot (the last two rows).
  {
    const B = 5;
    bank([tone('steel', 4), tone('steel', 5), tone('steel', 3), tone('slate', 3), tone('steel', 6)], tone('steel', 4), tone('steel', 4));
    const r = strips.shed.rect;
    for (let v = 0; v < 256; v++) {
      for (let u = 0; u < 32; u++) {
        let i = at(B, u % 2 === 0 ? 0 : u % 4 === 1 ? 1 : 4);
        if (v >= 254) i = at(B, 3);
        else if (v % 37 === 0) i = at(B, 2);
        pb.set(r, u, v, i);
      }
    }
  }
  // 6 HALL: big panes in a steel grid (the exhibition halls, the stations).
  {
    const B = 6;
    bank([tone('slate', 3), tone('glass', 2), tone('glass', 3), tone('glass', 4), tone('glass', 5), tone('steel', 5)], tone('glass', 2), tone('glass', 3));
    const r = strips.hall.rect;
    for (let v = 0; v < 256; v++) {
      for (let u = 0; u < 32; u++) {
        let i: number;
        if (u % 8 === 0 || v % 8 === 0) i = at(B, u % 8 === 0 && v % 8 === 0 ? 5 : 0);
        else {
          const refl = (u + v) % 29;
          i = refl < 2 ? at(B, 4) : refl < 5 ? at(B, 3) : win(B, 6, u >> 3, v >> 3, 0.3, (v >> 3) % 2 === 0 ? 1 : 2, true);
        }
        pb.set(r, u, v, i);
      }
    }
  }
  // 7 MISC: roof gravel (dark), louvres (horizontal slats: ventilation buildings, plant rooms).
  {
    const B = 7;
    bank([tone('stone', 2), tone('stone', 3), tone('steel', 3), tone('steel', 2), tone('steel', 5), tone('steel', 4)], tone('steel', 3), tone('steel', 3));
    pb.noise(roof, rng.fork('roof'), [at(B, 0), at(B, 1), at(B, 2)], [4, 3, 2]);
    for (let v = 0; v < 256; v++) for (let u = 0; u < 16; u++) pb.set(louvre, u, v, at(B, v % 3 === 0 ? 3 : v % 3 === 1 ? 4 : 5));
  }

  const row0: Color[] = [];
  for (const b of banks) for (let i = 0; i < CLUT_4BIT; i++) row0.push(b[i]);
  pb.addRow(row0);
  // The night rows: every entry cut out but the lit windows.
  for (let lv = 0; lv < 4; lv++) {
    const row: Color[] = [];
    for (let b = 0; b < banks.length; b++) {
      for (let i = 0; i < CLUT_4BIT; i++) row.push(i === WIN_WARM ? NIGHT_WARM[lv] : i === WIN_PALE ? NIGHT_PALE[lv] : i === WIN_COOL ? NIGHT_COOL[lv] : CLEAR);
    }
    pb.addRow(row);
  }
  // The shed bank has no windows: its lit entries stay cut out at night.
  facadeBuilt = { page: shedDark(pb.build(), 5), strips, roof, louvre };
  return facadeBuilt;
}

/** Cut out the lit entries of a bank in the night rows (a bank without windows). */
function shedDark(page: TexturePage, bankIx: number): TexturePage {
  for (let row = 1; row < page.clut.length / 256; row++) for (let i = 13; i < 16; i++) page.clut[row * 256 + bankIx * 16 + i] = CLEAR;
  return page;
}

// ---------------------------------------------------------------------------------------------
// The props page (201)
// ---------------------------------------------------------------------------------------------

/** Our own made-up Dutch billboards (spec §11: no real company, no logo). */
export const BILLBOARD_ADS: readonly (readonly [string, string])[] = [
  ['FRIET MET ALLES', 'NU OOK OP DE RING'],
  ['FILE FM', 'WIJ STAAN ER ALTIJD'],
  ['STROOPWAFELS', '2 VOOR 1'],
  ['PARKEERVERGUNNING?', 'WACHTLIJST 12 JAAR'],
  ['APPELTAART', 'ZOALS OMA HEM BAKT'],
  ['FIETS KWIJT?', 'KOOP ER NOG EEN'],
];

/** Name plates on the landmarks (our lettering; real place names only, no company). */
export const PLATES = ['COENTUNNEL', 'ZEEBURGERTUNNEL', 'STATION ZUID', 'SLOTERDIJK', 'EXPO', 'AMSTEL', 'LELYLAAN', 'SCIENCE PARK', 'SPORTPARK'] as const;
export type PlateText = (typeof PLATES)[number];

export type Swatch = 'white' | 'light' | 'grey' | 'dark' | 'black' | 'red' | 'yellow' | 'blue' | 'green' | 'orange' | 'wood' | 'glass' | 'sand' | 'water' | 'grass' | 'field';
const SWATCHES: readonly Swatch[] = ['white', 'light', 'grey', 'dark', 'black', 'red', 'yellow', 'blue', 'green', 'orange', 'wood', 'glass', 'sand', 'water', 'grass', 'field'];

export interface PropsTex {
  readonly page: TexturePage;
  readonly treeA: TexRect;
  readonly treeB: TexRect;
  readonly conifer: TexRect;
  readonly poplar: TexRect;
  readonly bush: TexRect;
  readonly reeds: TexRect;
  readonly ads: readonly TexRect[];
  readonly lattice: TexRect;
  readonly pitch: TexRect;
  readonly container: TexRect;
  readonly boat: TexRect;
  readonly houseboat: TexRect;
  readonly water: TexRect;
  readonly fence: TexRect;
  /** The name plates (white on dark), by text. */
  readonly plates: Readonly<Record<PlateText, TexRect>>;
  /** The centre texel of a flat swatch. */
  swatch(name: Swatch): readonly [number, number];
  /** A uv rectangle inside a swatch (a flat colour). */
  flat(name: Swatch): readonly [number, number, number, number];
}

let propsBuilt: PropsTex | null = null;

export function propsTex(): PropsTex {
  if (propsBuilt) return propsBuilt;
  const rng = new Rng('rally/world/props');
  const pb = new PageBuilder(WORLD_PAGES.props, 256, 256);
  const banks: Color[][] = [];
  const at = (bank: number, i: number): number => bank * CLUT_4BIT + i;
  const bank = (cols: Color[]): number => {
    const b = [...cols];
    while (b.length < CLUT_4BIT) b.push(cols[0]);
    banks.push(b);
    return banks.length - 1;
  };
  // Trees: cut-out cards (index 0 clear), a trunk, foliage.
  const TA = bank([CLEAR, tone('brown', 2), tone('green', 2), tone('green', 3), tone('olive', 4), tone('olive', 5), tone('gold', 4), tone('rust', 4), tone('gold', 5), tone('green', 4)]);
  const TB = bank([CLEAR, tone('brown', 1), tone('green', 0), tone('green', 1), tone('green', 2), tone('moss', 2), tone('moss', 3), tone('green', 3)]);
  const BILL = bank([tone('gable', 5), tone('ink', 1), tone('red', 5), tone('gold', 5), tone('denim', 3), tone('green', 4), tone('steel', 3), tone('orange', 4), tone('gable', 3), tone('sky', 2), tone('pink', 3)]);
  const ST = bank([CLEAR, tone('steel', 3), tone('steel', 4), tone('gold', 5), tone('gold', 4), tone('steel', 5), tone('red', 5)]);
  const WA = bank([tone('canal', 1), tone('canal', 2), tone('canal', 3), tone('navy', 3), tone('canal', 4), tone('snow', 3)]);
  const PI = bank([tone('green', 3), tone('green', 4), tone('gable', 5), tone('green', 2)]);
  const CO = bank([tone('steel', 5), tone('steel', 4), tone('steel', 6), tone('slate', 3)]);
  const BO = bank([CLEAR, tone('gable', 5), tone('gable', 4), tone('glass', 1), tone('red', 4), tone('navy', 3), tone('wood', 4), tone('wood', 3), tone('green', 3), tone('steel', 3)]);
  const RE = bank([CLEAR, tone('olive', 4), tone('olive', 5), tone('sand', 4), tone('sand', 5), tone('olive', 3)]);
  const PL = bank([tone('slate', 2), tone('gable', 5), tone('steel', 3), tone('gold', 5)]);
  const SW = bank([tone('gable', 5), tone('gable', 4), tone('steel', 4), tone('steel', 2), tone('ink', 1), tone('red', 4), tone('gold', 5), tone('denim', 3), tone('green', 3), tone('orange', 4), tone('wood', 4), tone('glass', 2), tone('sand', 4), tone('canal', 2), tone('green', 2), tone('olive', 4)]);

  const treeA = pb.alloc(32, 32)!;
  const treeB = pb.alloc(32, 32)!;
  const conifer = pb.alloc(24, 40)!;
  const poplar = pb.alloc(16, 40)!;
  const lattice = pb.alloc(16, 32)!;
  const pitch = pb.alloc(32, 48)!;
  const bush = pb.alloc(32, 16)!;
  const reeds = pb.alloc(32, 12)!;
  const container = pb.alloc(16, 8)!;
  const boat = pb.alloc(32, 16)!;
  const houseboat = pb.alloc(32, 16)!;
  const fence = pb.alloc(32, 8)!;
  const water = pb.alloc(32, 32)!;
  const sw = pb.alloc(32, 32)!;
  const ads: TexRect[] = [];
  for (let k = 0; k < BILLBOARD_ADS.length; k++) ads.push(pb.alloc(80, 20)!);
  const plates = {} as Record<PlateText, TexRect>;
  for (const t of PLATES) {
    const r = pb.alloc(letterWidth(t) + 6, 9)!;
    plates[t] = r;
    pb.fill(r, at(PL, 0));
    for (let u = 0; u < r.w; u++) {
      pb.set(r, u, 0, at(PL, 2));
      pb.set(r, u, 8, at(PL, 2));
    }
    paintText(pb, r, t, 3, 2, at(PL, 1));
  }

  // A deciduous tree in autumn: a round crown of mixed greens, yellows and orange over a trunk.
  const crown = (r: TexRect, rr: Rng, cx: number, cy: number, rx: number, ry: number, idx: number[], w: number[]): void => {
    for (let y = 0; y < r.h; y++) {
      for (let x = 0; x < r.w; x++) {
        const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
        const d = dx * dx + dy * dy;
        if (d > 1 || (d > 0.7 && rr.next() < 0.45)) continue;
        let pick = rr.next() * w.reduce((a, b) => a + b, 0);
        let k = 0;
        while (k < idx.length - 1 && pick >= w[k]) pick -= w[k++];
        // Shade: darker at the bottom right.
        const dark = dy > 0.35 && rr.next() < 0.6;
        pb.set(r, x, y, dark ? idx[0] : idx[k]);
      }
    }
  };
  pb.fill(treeA, at(TA, 0));
  pb.rect(treeA, 15, 20, 2, 12, at(TA, 1));
  crown(treeA, rng.fork('treeA'), 16, 13, 14, 12.5, [at(TA, 2), at(TA, 3), at(TA, 4), at(TA, 5), at(TA, 6), at(TA, 7), at(TA, 8), at(TA, 9)], [2, 3, 2, 2, 1, 1, 1, 2]);
  pb.fill(treeB, at(TB, 0));
  pb.rect(treeB, 15, 22, 2, 10, at(TB, 1));
  crown(treeB, rng.fork('treeB'), 16, 14, 13.5, 13, [at(TB, 2), at(TB, 3), at(TB, 4), at(TB, 5), at(TB, 6), at(TB, 7)], [1, 3, 3, 2, 2, 2]);
  // A conifer: a narrow cone of dark greens.
  pb.fill(conifer, at(TB, 0));
  {
    const cr = rng.fork('conifer');
    for (let y = 0; y < 36; y++) {
      const half = 1 + (y / 36) * 10.5;
      for (let x = 0; x < 24; x++) {
        const dx = Math.abs(x + 0.5 - 12);
        if (dx > half || (dx > half - 1.5 && cr.next() < 0.5)) continue;
        pb.set(conifer, x, y, at(TB, [2, 3, 3, 4, 5][cr.int(0, 4)]));
      }
    }
    pb.rect(conifer, 11, 36, 2, 4, at(TB, 1));
  }
  // A poplar (the polder's windbreaks): tall and slim, autumn yellow-green.
  pb.fill(poplar, at(TA, 0));
  crown(poplar, rng.fork('poplar'), 8, 18, 6.5, 18, [at(TA, 3), at(TA, 4), at(TA, 5), at(TA, 6), at(TA, 8)], [3, 2, 2, 2, 1]);
  pb.rect(poplar, 7, 34, 2, 6, at(TA, 1));
  // A bush / hedge: low and wide.
  pb.fill(bush, at(TB, 0));
  crown(bush, rng.fork('bush'), 16, 10, 15.5, 8, [at(TB, 3), at(TB, 4), at(TB, 5), at(TB, 6), at(TB, 7)], [2, 3, 2, 2, 2]);
  // Reeds by the water: thin blades, cut out above.
  pb.fill(reeds, at(RE, 0));
  {
    const rr = rng.fork('reeds');
    for (let x = 0; x < 32; x++) {
      const h = rr.int(5, 12);
      for (let y = 12 - h; y < 12; y++) pb.set(reeds, x, y, at(RE, y < 12 - h + 2 ? rr.int(3, 4) : rr.int(1, 2)));
    }
  }
  // The crane / pylon lattice: two chords and diagonals, cut out between.
  pb.fill(lattice, at(ST, 0));
  for (let v = 0; v < 32; v++) {
    pb.set(lattice, 0, v, at(ST, 3));
    pb.set(lattice, 15, v, at(ST, 3));
    pb.set(lattice, (v % 16) < 8 ? (v % 8) * 2 : 15 - (v % 8) * 2, v, at(ST, 4));
    if (v % 8 === 0) for (let u = 0; u < 16; u++) pb.set(lattice, u, v, at(ST, 3));
  }
  // A sports pitch (top view, 32 × 48 = about 64 × 100 m): stripes of mown grass, white lines.
  for (let v = 0; v < 48; v++) for (let u = 0; u < 32; u++) pb.set(pitch, u, v, at(PI, (v >> 2) % 2 === 0 ? 0 : 1));
  {
    const L = at(PI, 2);
    for (let u = 1; u < 31; u++) {
      pb.set(pitch, u, 1, L);
      pb.set(pitch, u, 46, L);
      pb.set(pitch, u, 24, L);
    }
    for (let v = 1; v < 47; v++) {
      pb.set(pitch, 1, v, L);
      pb.set(pitch, 30, v, L);
    }
    for (let u = 9; u < 23; u++) {
      pb.set(pitch, u, 8, L);
      pb.set(pitch, u, 39, L);
    }
    for (let v = 1; v < 9; v++) {
      pb.set(pitch, 9, v, L);
      pb.set(pitch, 22, v, L);
      pb.set(pitch, 9, 47 - v, L);
      pb.set(pitch, 22, 47 - v, L);
    }
    for (const [u, v] of [[14, 21], [17, 21], [12, 23], [19, 23], [12, 25], [19, 25], [14, 27], [17, 27], [13, 22], [18, 22], [13, 26], [18, 26]]) pb.set(pitch, u, v, L);
  }
  // A container side: corrugated (tinted per container by the vertex colour), a dark frame.
  for (let v = 0; v < 8; v++) for (let u = 0; u < 16; u++) pb.set(container, u, v, at(CO, v === 0 || v === 7 || u === 0 || u === 15 ? 3 : u % 2 === 0 ? 0 : u % 4 === 1 ? 1 : 2));
  // A barge (side view): a dark hull with a red stripe, a white wheelhouse at the stern.
  pb.fill(boat, at(BO, 0));
  pb.rect(boat, 0, 10, 32, 6, at(BO, 5));
  pb.rect(boat, 0, 10, 32, 1, at(BO, 4));
  pb.rect(boat, 22, 4, 8, 6, at(BO, 1));
  pb.rect(boat, 23, 5, 6, 2, at(BO, 3));
  pb.rect(boat, 1, 8, 20, 2, at(BO, 9));
  // A houseboat: a wooden box on a dark hull with windows and plants.
  pb.fill(houseboat, at(BO, 0));
  pb.rect(houseboat, 0, 12, 32, 4, at(BO, 5));
  pb.rect(houseboat, 1, 4, 30, 8, at(BO, 6));
  for (let u = 3; u < 30; u += 6) pb.rect(houseboat, u, 6, 3, 3, at(BO, 3));
  pb.rect(houseboat, 0, 3, 32, 1, at(BO, 7));
  for (let u = 2; u < 30; u += 7) pb.rect(houseboat, u, 11, 2, 1, at(BO, 8));
  // A fence (sports fields, works): posts and mesh, cut out between the wires.
  pb.fill(fence, at(ST, 0));
  for (let u = 0; u < 32; u++) for (let v = 0; v < 8; v++) if (u % 8 === 0 || v === 0 || (u + v) % 3 === 0) pb.set(fence, u, v, at(ST, u % 8 === 0 ? 1 : 2));
  // Water (rivers, the IJ): dark green-blue with short ripples.
  pb.noise(water, rng.fork('water'), [at(WA, 0), at(WA, 1), at(WA, 2)], [3, 5, 2]);
  {
    const rp = rng.fork('ripples');
    for (let k = 0; k < 22; k++) pb.rect(water, rp.int(0, 28), rp.int(0, 31), rp.int(2, 4), 1, at(WA, rp.int(0, 4) === 0 ? 5 : 4));
  }
  // The flat swatches (4 × 4 cells of 8 × 8).
  SWATCHES.forEach((_name, k) => pb.rect(sw, (k % 4) * 8, (k >> 2) * 8, 8, 8, at(SW, k)));
  // The billboards: a white board, two lines of our lettering, a coloured band.
  BILLBOARD_ADS.forEach(([a, b], k) => {
    const r = ads[k];
    const bands = [2, 4, 5, 3, 7, 10];
    pb.fill(r, at(BILL, 0));
    pb.rect(r, 0, 0, 80, 20, at(BILL, bands[k]));
    pb.rect(r, 2, 2, 76, 16, at(BILL, 0));
    const ink = at(BILL, 1);
    paintText(pb, r, a, Math.floor((80 - letterWidth(a)) / 2), 4, at(BILL, bands[k]), { shadow: at(BILL, 8) });
    paintText(pb, r, b, Math.floor((80 - letterWidth(b)) / 2), 11, ink);
  });

  const row0: Color[] = [];
  for (const b of banks) for (let i = 0; i < CLUT_4BIT; i++) row0.push(b[i]);
  pb.addRow(row0);
  const page = pb.build();
  propsBuilt = {
    page,
    treeA,
    treeB,
    conifer,
    poplar,
    bush,
    reeds,
    ads,
    lattice,
    pitch,
    container,
    boat,
    houseboat,
    water,
    fence,
    plates,
    swatch(name) {
      const k = SWATCHES.indexOf(name);
      return [sw.x + (k % 4) * 8 + 4, sw.y + (k >> 2) * 8 + 4];
    },
    flat(name) {
      const k = SWATCHES.indexOf(name);
      const u = sw.x + (k % 4) * 8 + 2, v = sw.y + (k >> 2) * 8 + 2;
      return [u, v, u + 4, v + 4];
    },
  };
  return propsBuilt;
}

/** Every text the world's textures carry (tests: no real company name). */
export function worldTexts(): string[] {
  return [...BILLBOARD_ADS.flatMap(([a, b]) => [a, b]), ...PLATES];
}
