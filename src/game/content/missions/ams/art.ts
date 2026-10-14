/**
 * Mission `ams` art (docs/design/amsterdam.md §5): the city of Amsterdam as decor sprites, plus the
 * shared painters the background generators use (`paintHouse`, `lightMap`). Procedural pixel art
 * from the 64-colour palette, light from the top left, 1-px INK outlines. All lettering is our own.
 *
 * Decor (`decor/ams/…`, feet anchor unless noted):
 * - `house-<light>` canal houses (frames = `HOUSE_VARIANTS`: step / neck / bell / spout / flat
 *   gables, brick or painted, white cornices and sash windows, hoist beams, tulip boxes, a lean);
 *   `<light>` is `morning`, `noon`, `golden` or `sunset` (the tint of the section's light)
 * - `fabel-friet-<light>` the FABEL FRIET building (cream wooden shopfront, gold `Fabel` /
 *   `FRIET` window, potatoes, the open white door, red brick upper floors; 96 px wide, the door
 *   centre 70 px right of the left edge), `fabel-sign` (the oval black hanging sign on its iron
 *   bracket, 4 frames: a slow swing; top-left at the bracket), `fabel-counter` (front decor for
 *   the baker), `neighbour-<light>` (the orange-brown wooden shop with leaded glass)
 * - `hotdog-stand` (the white trailer: US-flag print, blue `HOTDOGS`, a painted hot dog with a
 *   mustard zigzag, the open serving hatch facing the player; anchor = the box's left edge on the
 *   ground: the box is 64 wide, the hatch 20…44 px right of the anchor, its counter 29 px above
 *   the feet), `cabinet` (grey electrical box with graffiti tags),
 *   `lamp-grey`, `flag-red` (small roof flag, 4 frames)
 * - `lamp` (Amsterdam cast-iron street lamp), `bollard` (an Amsterdammertje: rust-brown with XXX),
 *   `bike-rack` (4 parked bikes), `bike` (frames: colours), `bench`, `elm`, `tulips` (a planter of
 *   swaying tulips, 4 frames), `flag-ams` (red-black-red with XXX, 4 frames), `flag-nl` (4 frames),
 *   `awning-<w>` (top-left at the platform; frames: colour sets), `smoke` (chimney smoke, 6 frames)
 * - bridges: `bridge-rail-<len>x<h>` (iron railing with chained bikes, along a `hill(len, h)` deck;
 *   top-left at the bridge start, y = ground line) and `bridge-face-<len>x<h>` (the brick arch
 *   face with the dark canal arch; front, top-left the same), `drawbridge` (a raised white
 *   drawbridge), `white-bridge` (a 128-px span of the white wooden Amstel bridge: railing over
 *   the deck line, piers below; top-left at the deck), `white-portal` (its overhead balance
 *   beams; feet at the deck), `blauwbrug-lamp` (ornate lamp with the crown), `balustrade-<w>`
 *   (stone bridge balustrade, feet)
 * - `houseboat-<w>x<h>-<cabin x>-<cabin w>-<colour>` (top-left at (x0, roof y)); see
 *   `houseboatSprite`
 * - section b: `rijksmuseum` (480×176; the cycle passage between 80 and 400 px from the left,
 *   the ceiling 80 px above the feet), `lawn-<w>` (front grass strip, top-left at y 172),
 *   `pool-<w>` (the long shallow pool, top-left), `plein-sign`
 * - section d: `stopera` (384×168: the curved white marble music theatre and the red-brick city
 *   hall wing; the big glass doors 294 px from the left edge), `market-stall` (frames 0–2)
 * - water: `water-<w>x<h>` (4-frame surface line, top-left), `…-back` (opaque canal body),
 *   `…-tint` (front body at alpha) — the m1 approach in the canal colour (`waterDecor`)
 */
import type { Color } from '../../../../engine/color';
import { drawText, measure } from '../../../../engine/font';
import { INK, PAL } from '../../../../engine/palette';
import { PixelBuffer } from '../../../../engine/pixel';
import type { Frame } from '../../../../engine/render';
import { defineSprite, hasSprite } from '../../../../engine/sprites';
import type { DecorDef } from '../../../mission/index';
import { hash2 } from '../../../art/paint';

type Ramp = readonly Color[];

const D = 'decor/ams/';

/** Ground line and canal surface of every `ams` section. */
export const G = 176;
export const WATER_Y = 180;

function feet(b: PixelBuffer): Frame {
  return { buf: b, ox: b.w >> 1, oy: b.h };
}

// =============================================================================================
// Light
// =============================================================================================

export type Light = 'morning' | 'noon' | 'golden' | 'sunset';
export const LIGHTS: readonly Light[] = ['morning', 'noon', 'golden', 'sunset'];

const LIGHT_PAIRS: Readonly<Record<Light, readonly (readonly [Color, Color])[]>> = {
  morning: [],
  noon: [],
  golden: [
    [PAL.snow[3], PAL.skinA[3]],
    [PAL.snow[2], PAL.sand[3]],
    [PAL.snow[1], PAL.stone[3]],
    [PAL.sky[3], PAL.gold[3]],
    [PAL.sky[2], PAL.gold[3]],
    [PAL.sky[1], PAL.orange[2]],
    [PAL.green[4], PAL.gold[2]],
    [PAL.red[3], PAL.orange[2]],
  ],
  sunset: [
    [PAL.snow[3], PAL.skinA[3]],
    [PAL.snow[2], PAL.skinA[2]],
    [PAL.snow[1], PAL.skinA[1]],
    [PAL.sand[3], PAL.skinA[2]],
    [PAL.stone[3], PAL.skinA[1]],
    [PAL.sky[3], PAL.gold[3]],
    [PAL.sky[2], PAL.orange[2]],
    [PAL.sky[1], PAL.pink[1]],
    [PAL.green[4], PAL.green[3]],
    [PAL.green[3], PAL.green[2]],
  ],
};

/** Recolour a buffer in place for a section's light (palette to palette; morning and noon keep it). */
export function applyLight(b: PixelBuffer, light: Light): PixelBuffer {
  const pairs = LIGHT_PAIRS[light];
  if (pairs.length === 0) return b;
  const map = new Map<number, number>();
  for (const [a, c] of pairs) map.set(a >>> 0, c >>> 0);
  const d = b.data;
  for (let i = 0; i < d.length; i++) {
    const m = map.get(d[i]);
    if (m !== undefined) d[i] = m;
  }
  return b.touch();
}

export function isLight(v: unknown): v is Light {
  return v === 'morning' || v === 'noon' || v === 'golden' || v === 'sunset';
}

// =============================================================================================
// Shared small painters
// =============================================================================================

/** A wooden plank board with a lit top edge. */
function board(b: PixelBuffer, x: number, y: number, w: number, h: number, ramp: Ramp = PAL.brown): void {
  b.rect(x, y, w, h, ramp[2]);
  b.hline(x, x + w - 1, y, ramp[3]);
  b.hline(x, x + w - 1, y + h - 1, ramp[1]);
  b.vline(x + w - 1, y, y + h - 1, ramp[1]);
}

/** A vertical post `w` wide from y0 to y1 (lit left side). */
function post(b: PixelBuffer, x: number, y0: number, y1: number, w: number, ramp: Ramp): void {
  b.rect(x, y0, w, y1 - y0 + 1, ramp[1]);
  b.vline(x, y0, y1, ramp[2]);
  if (w > 2) b.vline(x + w - 1, y0, y1, ramp[0]);
}

/** Three white crosses (XXX) stacked vertically, each 3×3, centred on x. */
function xxx(b: PixelBuffer, cx: number, y: number, c: Color = PAL.snow[3], gap = 4): void {
  for (let k = 0; k < 3; k++) {
    const yy = y + k * gap;
    b.set(cx - 1, yy, c);
    b.set(cx + 1, yy, c);
    b.set(cx, yy + 1, c);
    b.set(cx - 1, yy + 2, c);
    b.set(cx + 1, yy + 2, c);
  }
}

/** A Dutch city bike seen from the side (about 22×14), front to the right, wheels on row y. */
export function drawBike(b: PixelBuffer, x: number, y: number, frame: Color, flip = false): void {
  const fx = (dx: number): number => (flip ? x + 21 - dx : x + dx);
  // Wheels: thin black tyres with grey spokes.
  for (const cx of [4, 17]) {
    b.circle(fx(cx), y - 5, 5, PAL.ink[1], false);
    b.circle(fx(cx), y - 5, 4, PAL.steel[1], false);
    b.set(fx(cx), y - 5, PAL.steel[3]);
    b.line(fx(cx) - 3, y - 5, fx(cx) + 3, y - 5, PAL.steel[2]);
  }
  // Frame: a step-through (oma) frame, rear rack, mudguards.
  b.line(fx(4), y - 5, fx(9), y - 5, frame);
  b.line(fx(9), y - 5, fx(14), y - 11, frame);
  b.line(fx(8), y - 11, fx(9), y - 5, frame);
  b.line(fx(14), y - 11, fx(17), y - 5, frame);
  b.line(fx(4), y - 9, fx(8), y - 10, PAL.ink[1]); // rack
  b.line(fx(3), y - 9, fx(4), y - 5, PAL.ink[1]);
  b.hline(Math.min(fx(6), fx(10)), Math.max(fx(6), fx(10)), y - 12, PAL.ink[0]); // saddle
  b.line(fx(14), y - 11, fx(14), y - 14, PAL.steel[3]); // stem
  b.line(fx(12), y - 14, fx(15), y - 14, PAL.steel[3]); // bars
  b.set(fx(16), y - 11, PAL.gold[3]); // lamp
}

// =============================================================================================
// Canal houses
// =============================================================================================

export type Gable = 'step' | 'neck' | 'bell' | 'spout' | 'flat';
export type Wall = 'brown' | 'rust' | 'red' | 'darkred' | 'green' | 'ink' | 'cream' | 'grey';

export interface HouseSpec {
  /** Facade width (px). */
  w: number;
  /** Storeys above the ground floor. */
  floors: number;
  gable: Gable;
  wall: Wall;
  /** The top's sideways lean in px (−2…2). */
  lean: number;
  seed: number;
  /** Storey height in px (near decor 20, far rows 10–14). */
  s?: number;
  /** A shop on the ground floor with a fascia word. */
  shop?: string;
  /** Fascia colour ramp for a shop. */
  shopRamp?: Ramp;
  flowers?: boolean;
}

export const WALLS: Readonly<Record<Wall, Ramp>> = {
  brown: [PAL.brown[0], PAL.brown[1], PAL.brown[2], PAL.brown[3]],
  rust: [PAL.brown[0], PAL.rust[1], PAL.rust[2], PAL.rust[3]],
  red: [PAL.red[0], PAL.red[1], PAL.red[2], PAL.red[3]],
  darkred: [PAL.brown[0], PAL.red[0], PAL.red[1], PAL.red[2]],
  green: [PAL.green[0], PAL.green[1], PAL.green[1], PAL.green[2]],
  ink: [PAL.ink[0], PAL.ink[1], PAL.steel[0], PAL.steel[1]],
  cream: [PAL.sand[1], PAL.sand[2], PAL.sand[3], PAL.snow[2]],
  grey: [PAL.stone[0], PAL.stone[1], PAL.stone[2], PAL.stone[3]],
};
export const BRICK: ReadonlySet<Wall> = new Set<Wall>(['brown', 'rust', 'red', 'darkred']);
export const TULIPS: readonly Color[] = [PAL.red[2], PAL.pink[2], PAL.gold[2], PAL.red[3], PAL.orange[2], PAL.pink[1]];

/** A sash window: white frame, navy panes with a sky glint, the sash bar; far = simpler. */
function sashWindow(b: PixelBuffer, x: number, y: number, w: number, h: number, near: boolean, lit: boolean): void {
  b.rect(x, y, w, h, PAL.snow[3]);
  b.rect(x + 1, y + 1, w - 2, h - 2, lit ? PAL.gold[2] : PAL.navy[1]);
  if (!near) {
    b.set(x + 1, y + 1, PAL.sky[2]);
    return;
  }
  const mid = y + (h >> 1);
  b.hline(x, x + w - 1, mid, PAL.snow[2]);
  if (w >= 7) b.vline(x + (w >> 1), y + 1, y + h - 2, PAL.snow[2]);
  // Reflections: a top-left glint and a diagonal streak.
  b.set(x + 1, y + 1, PAL.sky[2]);
  b.set(x + 2, y + 1, PAL.sky[1]);
  b.set(x + 1, mid + 1, PAL.sky[1]);
  if (h > 8) b.set(x + w - 2, mid - 2, PAL.sky[0]);
  b.vline(x + w - 1, y + 1, y + h - 1, PAL.snow[1]);
}

/**
 * Paint one canal house. The result is outlined; its feet anchor is the middle of the facade's
 * ground line (the lean only shifts upper rows).
 */
export function paintHouse(h: HouseSpec): Frame {
  const S = h.s ?? 20;
  const near = S >= 16;
  const w = h.w;
  const r = WALLS[h.wall];
  const brick = BRICK.has(h.wall);
  const gf = S + (near ? 8 : 4);
  const bodyH = gf + h.floors * S;
  const gableH = h.gable === 'flat' ? Math.max(4, Math.round(S * 0.35)) : h.gable === 'spout' ? Math.round(S * 1.1) : Math.round(S * 1.35);
  const W = w + 2;
  const H = bodyH + gableH + 3;
  const b = new PixelBuffer(W, H);
  const yT = H - bodyH; // body top row
  const cx = 1 + (w >> 1);
  const hs = (a: number, k: number): number => hash2(a, k, h.seed);

  const wallPx = (x: number, y: number): Color => {
    if (!brick) return (x + y * 3) % 11 === 0 && near ? r[1] : r[2];
    const row = H - 1 - y;
    if (row % 3 === 0) return r[1];
    const course = (row / 3) | 0;
    if (near && (x + course * 3) % 6 === 0 && hs(x, y) < 0.5) return r[1];
    if (hs(x * 3, y * 5) > 0.96) return r[3];
    return r[2];
  };
  const fillWall = (x0: number, x1: number, y: number): void => {
    for (let x = Math.max(1, x0); x <= Math.min(w, x1); x++) b.set(x, y, wallPx(x, y));
  };

  // Body.
  for (let y = yT; y < H; y++) fillWall(1, w, y);
  b.vline(1, yT, H - 1, r[3]);
  b.vline(w, yT, H - 1, r[0]);

  // Gable.
  const g0 = yT - gableH;
  const trim = PAL.snow[2];
  if (h.gable === 'step') {
    const k = w >= 40 ? 4 : 3;
    const sh = Math.max(3, Math.floor(gableH / (k + 1)));
    const stepW = Math.max(2, Math.floor(w / 2 / (k + 1.6)));
    for (let i = 0; i <= k; i++) {
      const half = (w >> 1) - i * stepW;
      const ya = yT - (i + 1) * sh;
      const yb = yT - i * sh - 1;
      for (let y = Math.max(g0, ya); y <= yb; y++) fillWall(cx - half, cx + half - 1, y);
      b.hline(cx - half, cx + half - 1, Math.max(g0, ya), trim); // stone coping on each step
      b.set(cx - half, Math.max(g0, ya), PAL.snow[3]);
    }
    const tip = yT - (k + 1) * sh;
    b.rect(cx - 1, tip - 2, 2, 2, PAL.snow[3]);
  } else if (h.gable === 'neck') {
    const nw = Math.max(6, Math.round(w * 0.46));
    const nx0 = cx - (nw >> 1);
    for (let y = g0 + 3; y < yT; y++) fillWall(nx0, nx0 + nw - 1, y);
    // Claw pieces: white scrolls filling the shoulders.
    const ch = Math.round(gableH * 0.6);
    for (let i = 0; i < ch; i++) {
      const t = i / ch;
      const reach = Math.round((nx0 - 1) * (1 - t * t));
      const y = yT - 1 - i;
      // Sandstone claws: a scroll edge two px thick, the inner part open to the sky.
      for (let x = nx0 - reach; x < nx0; x++) {
        const edge = x - (nx0 - reach);
        if (edge < 2 || x === nx0 - 1 || (i === 0 && near)) b.set(x, y, edge === 0 ? PAL.sand[3] : PAL.sand[2]);
      }
      for (let x = nx0 + nw; x < nx0 + nw + reach; x++) {
        const edge = nx0 + nw + reach - 1 - x;
        if (edge < 2 || x === nx0 + nw || (i === 0 && near)) b.set(x, y, edge === 0 ? PAL.sand[1] : PAL.sand[2]);
      }
    }
    if (near) {
      b.circle(nx0 - 3, yT - 4, 1, PAL.sand[3]);
      b.circle(nx0 + nw + 2, yT - 4, 1, PAL.sand[2]);
    }
    // Pediment.
    b.tri(nx0 - 1, g0 + 3, nx0 + nw, g0 + 3, cx, g0, PAL.snow[3]);
    b.hline(nx0 - 1, nx0 + nw, g0 + 3, PAL.snow[1]);
  } else if (h.gable === 'bell') {
    for (let y = g0; y < yT; y++) {
      const t = (yT - 1 - y) / (gableH - 1);
      const f = t < 0.45 ? 0.55 + 0.45 * Math.cos((Math.PI * t) / 0.45 / 2) ** 0.8 : 0.55 * Math.sqrt(Math.max(0, 1 - ((t - 0.45) / 0.55) ** 2));
      const half = Math.max(1, Math.round((w / 2) * f));
      fillWall(cx - half, cx + half - 1, y);
      b.set(cx - half, y, PAL.snow[3]);
      b.set(cx + half - 1, y, PAL.snow[1]);
    }
    b.hline(cx - 2, cx + 1, g0, PAL.snow[3]);
    b.rect(cx - 1, g0 - 2, 2, 2, trim);
  } else if (h.gable === 'spout') {
    for (let y = g0; y < yT; y++) {
      const t = (yT - 1 - y) / (gableH - 1);
      const half = Math.max(1, Math.round((w / 2) * (1 - t) + 1));
      fillWall(cx - half, cx + half - 1, y);
      b.set(cx - half, y, PAL.snow[3]);
      b.set(cx + half - 1, y, PAL.snow[1]);
    }
  } else {
    // Flat cornice (lijstgevel): a deep white cornice with dentils and a crest.
    const cy = yT - gableH;
    b.rect(1, cy, w, gableH, trim);
    b.hline(1, w, cy, PAL.snow[3]);
    if (near) for (let x = 3; x < w - 1; x += 3) b.set(x, cy + gableH - 2, PAL.snow[1]);
    b.hline(1, w, cy + gableH - 1, PAL.stone[2]);
    b.rect(cx - 3, cy - 3, 6, 3, trim);
    b.hline(cx - 3, cx + 2, cy - 3, PAL.snow[3]);
  }

  // The loading door and the hoist beam in the gable (not on flat tops).
  if (h.gable !== 'flat') {
    const dw = near ? 6 : 3;
    const dh = Math.max(3, Math.round(gableH * 0.38));
    const dy = yT - dh - 1;
    b.rect(cx - (dw >> 1) - 1, dy - 1, dw + 2, dh + 1, PAL.snow[3]);
    b.rect(cx - (dw >> 1), dy, dw, dh, h.wall === 'green' ? PAL.navy[1] : PAL.green[1]);
    if (near) b.vline(cx, dy, dy + dh - 1, PAL.green[0]);
    const by = Math.max(g0 + 1, dy - (near ? 6 : 3));
    b.rect(cx - 1, by, 3, 2, PAL.brown[1]);
    b.set(cx - 1, by, PAL.brown[2]);
    b.vline(cx + 1, by + 2, by + (near ? 4 : 3), PAL.steel[3]);
    if (near) b.set(cx, by + 5, PAL.steel[3]);
  } else {
    // A hoist beam under the cornice of a flat-topped house.
    b.rect(cx - 1, yT + 1, 3, 2, PAL.brown[1]);
    b.vline(cx + 1, yT + 3, yT + 5, PAL.steel[3]);
  }

  // Upper floors: sash windows (smaller toward the top), lintels, sills, tulip boxes.
  const n = w >= 44 ? 3 : w >= 24 ? 2 : 1;
  const cw = w / n;
  for (let f = 0; f < h.floors; f++) {
    const top = H - gf - (f + 1) * S;
    const ww = near ? Math.min(10, Math.max(6, Math.round(cw * 0.5))) : Math.max(3, Math.round(cw * 0.42));
    const wh = Math.max(4, Math.round(S * (0.68 - f * 0.05)));
    const wy = top + Math.max(2, ((S - wh) >> 1) - 1);
    for (let i = 0; i < n; i++) {
      const wx = 1 + Math.round(cw * i + (cw - ww) / 2);
      const lit = hs(f * 7 + i, 3) > 0.94;
      sashWindow(b, wx, wy, ww, wh, near, lit);
      if (brick) b.hline(wx - 1, wx + ww, wy - 1, near ? PAL.snow[2] : PAL.snow[1]);
      b.hline(wx - 1, wx + ww, wy + wh, PAL.stone[3]);
      if (h.flowers && f === 0 && near) {
        b.rect(wx - 1, wy + wh + 1, ww + 2, 2, PAL.green[1]);
        b.hline(wx - 1, wx + ww, wy + wh + 2, PAL.green[0]);
        for (let x = wx; x < wx + ww; x += 2) {
          b.set(x, wy + wh - 1, PAL.green[3]);
          b.set(x, wy + wh, TULIPS[(x + i + h.seed) % TULIPS.length]);
          b.set(x + 1, wy + wh, PAL.green[2]);
        }
      }
    }
    // A thin white string course on some houses.
    if (near && brick && f === 0) b.hline(1, w, top + S - 1, PAL.snow[1]);
  }

  // Ground floor.
  const gy = H - gf;
  b.hline(1, w, gy, PAL.snow[2]);
  b.hline(1, w, gy + 1, PAL.stone[1]);
  if (h.shop) {
    const ramp = h.shopRamp ?? PAL.green;
    // Fascia board with the shop word, a big window and a door at the right.
    const fh = near ? 8 : 4;
    b.rect(1, gy + 2, w, fh, ramp[1]);
    b.hline(1, w, gy + 2, ramp[2]);
    if (near) drawText(b, h.shop, cx, gy + 3 - 2, { font: 'small', color: PAL.gold[3], align: 'center' });
    const doorW = near ? 9 : 4;
    const wy = gy + 2 + fh + 1;
    const wx1 = w - doorW - 3;
    b.rect(2, wy, wx1 - 2, H - 3 - wy, PAL.snow[3]);
    b.rect(3, wy + 1, wx1 - 4, H - 5 - wy, PAL.navy[1]);
    if (near) {
      for (let x = 4; x < wx1 - 2; x += 5) b.line(x, wy + 1, x + 4, wy + 6, PAL.sky[0]);
      // Goods in the window.
      for (let x = 4; x < wx1 - 2; x += 3) b.rect(x, H - 9, 2, 3, TULIPS[(x + h.seed) % TULIPS.length]);
    }
    b.rect(wx1 + 1, wy, doorW, H - 1 - wy, PAL.snow[3]);
    b.rect(wx1 + 2, wy + 1, doorW - 2, H - 2 - wy, ramp[0]);
    if (near) b.rect(wx1 + 3, wy + 2, doorW - 4, 8, PAL.navy[1]);
    b.rect(1, H - 3, w, 3, PAL.stone[2]);
    b.hline(1, w, H - 3, PAL.stone[3]);
  } else {
    // A raised front door with a fanlight and stoop steps; a window beside it.
    const left = hs(1, 9) < 0.5;
    const dw = near ? 9 : 4;
    const dx = left ? 3 : w - dw - 2;
    const dTop = gy + (near ? 6 : 3);
    b.rect(dx - 1, dTop - (near ? 5 : 2), dw + 2, H - 3 - dTop + (near ? 5 : 2), PAL.snow[3]);
    if (near) {
      b.rect(dx, dTop - 4, dw, 3, PAL.navy[1]);
      for (let x = dx + 1; x < dx + dw; x += 2) b.set(x, dTop - 3, PAL.sky[1]);
    }
    const doorC = [PAL.green[1], PAL.navy[1], PAL.red[1], PAL.ink[1]][Math.floor(hs(2, 9) * 4)];
    b.rect(dx, dTop, dw, H - 3 - dTop, doorC);
    if (near) {
      b.vline(dx + (dw >> 1), dTop, H - 4, PAL.ink[1]);
      b.set(dx + dw - 2, dTop + 8, PAL.gold[3]);
    }
    b.rect(dx - 2, H - 3, dw + 4, 3, PAL.stone[2]);
    b.hline(dx - 2, dx + dw + 1, H - 3, PAL.stone[3]);
    const ww = Math.max(4, w - dw - (near ? 12 : 8));
    const wx = left ? dx + dw + (near ? 4 : 3) : 3;
    sashWindow(b, wx, gy + 4, Math.min(ww, near ? 22 : 10), gf - (near ? 10 : 6), near, false);
    if (near) {
      // A cat in the window on some houses.
      if (hs(4, 9) < 0.25) {
        const kx = wx + 3;
        const ky = gy + 4 + gf - 14;
        b.rect(kx, ky, 4, 3, PAL.ink[1]);
        b.set(kx, ky - 1, PAL.ink[1]);
        b.set(kx + 3, ky - 1, PAL.ink[1]);
        b.set(kx + 1, ky + 1, PAL.gold[2]);
      }
    }
  }

  // Shear for the lean, then outline.
  const lean = Math.round(h.lean);
  const L = Math.abs(lean);
  const out = new PixelBuffer(W + L + 2, H + 1);
  // Whole storeys shift (never a step through a window): the ground floor stays, the top leans most.
  const levels = h.floors + 2;
  for (let y = 0; y < H; y++) {
    const level = y >= H - gf ? 0 : Math.min(levels - 1, 1 + Math.floor((H - gf - 1 - y) / S));
    const s = Math.round((lean * level) / (levels - 1)) + (lean < 0 ? L : 0) + 1;
    for (let x = 0; x < W; x++) {
      const c = b.data[y * W + x];
      if ((c & 255) !== 0) out.data[(y + 1) * out.w + x + s] = c;
    }
  }
  out.outline(INK);
  return { buf: out, ox: cx + (lean < 0 ? L : 0) + 1, oy: H + 1 };
}

/** Near canal houses for decor (frames of `decor/ams/house-<light>`). */
export const HOUSE_VARIANTS: readonly HouseSpec[] = [
  { w: 52, floors: 4, gable: 'step', wall: 'rust', lean: 1, seed: 11, flowers: true },
  { w: 44, floors: 4, gable: 'neck', wall: 'brown', lean: -1, seed: 12 },
  { w: 60, floors: 3, gable: 'flat', wall: 'darkred', lean: 0, seed: 13, flowers: true },
  { w: 40, floors: 4, gable: 'bell', wall: 'green', lean: 2, seed: 14 },
  { w: 48, floors: 3, gable: 'spout', wall: 'ink', lean: -1, seed: 15, flowers: true },
  { w: 56, floors: 4, gable: 'neck', wall: 'red', lean: 1, seed: 16 },
  { w: 44, floors: 3, gable: 'bell', wall: 'cream', lean: 0, seed: 17, flowers: true },
  { w: 52, floors: 3, gable: 'step', wall: 'brown', lean: -2, seed: 18 },
  // Shops for the narrow shopping street.
  { w: 56, floors: 3, gable: 'neck', wall: 'rust', lean: 1, seed: 21, shop: 'KAAS', shopRamp: [PAL.navy[0], PAL.navy[1], PAL.sky[0], PAL.sky[1]] },
  { w: 52, floors: 3, gable: 'bell', wall: 'grey', lean: -1, seed: 22, shop: 'BLOEMEN', shopRamp: [PAL.green[0], PAL.green[1], PAL.green[2], PAL.green[3]] },
  { w: 60, floors: 4, gable: 'flat', wall: 'brown', lean: 0, seed: 23, shop: 'KOFFIE', shopRamp: [PAL.ink[0], PAL.ink[1], PAL.steel[1], PAL.steel[2]] },
  { w: 48, floors: 3, gable: 'step', wall: 'darkred', lean: 1, seed: 24, shop: 'BOEKEN', shopRamp: [PAL.red[0], PAL.red[1], PAL.red[2], PAL.red[3]] },
  { w: 56, floors: 3, gable: 'spout', wall: 'cream', lean: -1, seed: 25, shop: 'FIETSEN', shopRamp: [PAL.purple[0], PAL.purple[1], PAL.purple[2], PAL.pink[2]] },
];

/** House frame indices (for the section layouts). */
export const HOUSE = { step: 0, neck: 1, flat: 2, bell: 3, spout: 4, neckRed: 5, bellCream: 6, stepBrown: 7, kaas: 8, bloemen: 9, koffie: 10, boeken: 11, fietsen: 12 } as const;

/** Facade width of a near house frame. */
export function houseWidth(frame: number): number {
  return HOUSE_VARIANTS[frame].w;
}

for (const light of LIGHTS) {
  defineSprite(`${D}house-${light}`, () =>
    HOUSE_VARIANTS.map((spec) => {
      const f = paintHouse(spec);
      applyLight(f.buf, light);
      return f;
    }),
  );
}

// =============================================================================================
// Fabel Friet (reference photo 1)
// =============================================================================================

/** Our own pixel script for `Fabel` (7 rows; '#' = ink). */
export const FABEL_SCRIPT = [
  '.####......#.........#...',
  '.#.........#.........#...',
  '.#.........#.........#...',
  '.###...##..###...##..#...',
  '.#....#..#.#..#.#..#.#...',
  '.#....#..#.#..#.####.#...',
  '.#....#..#.#..#.#....#...',
  '#......####.###...###..##',
];

/** Draw the script with a slant (rows shifted right toward the top) and a drop shadow. */
function fabelScript(b: PixelBuffer, x: number, y: number, c: Color, shadow: Color, scale = 1): void {
  const rows = FABEL_SCRIPT.length;
  for (const pass of [0, 1]) {
    for (let r = 0; r < rows; r++) {
      const row = FABEL_SCRIPT[r];
      const slant = Math.floor((rows - 1 - r) / 3);
      for (let i = 0; i < row.length; i++) {
        if (row[i] !== '#') continue;
        for (let sy = 0; sy < scale; sy++) {
          for (let sx = 0; sx < scale; sx++) {
            const px = x + (i + slant) * scale + sx + (pass === 0 ? 1 : 0);
            const py = y + r * scale + sy + (pass === 0 ? 1 : 0);
            b.set(px, py, pass === 0 ? shadow : c);
          }
        }
      }
    }
  }
  // A swash under the word.
  b.hline(x + 6 * scale, x + 24 * scale, y + rows * scale + 1, pass2(c));
}
function pass2(c: Color): Color {
  return c === PAL.gold[2] ? PAL.gold[1] : c;
}

/** Spaced capitals in the small font. */
function spaced(b: PixelBuffer, text: string, cx: number, y: number, c: Color, gap: number): void {
  let total = 0;
  for (const ch of text) total += measure(ch, 'small') + gap;
  total -= gap;
  let x = Math.round(cx - total / 2);
  for (const ch of text) {
    drawText(b, ch, x, y, { font: 'small', color: c });
    x += measure(ch, 'small') + gap;
  }
}

/** Fabel Friet: 96 wide; ground floor shopfront 46 px; two red-brick floors and a white cornice. */
function fabelFriet(light: Light): Frame {
  const W = 98;
  const H = 150;
  const b = new PixelBuffer(W, H);
  const base = H - 1;
  const shopTop = base - 46;
  // Red brick upper floors.
  for (let y = 12; y < shopTop; y++) {
    for (let x = 1; x < W - 1; x++) {
      const row = base - y;
      const course = (row / 3) | 0;
      let c: Color = PAL.red[1];
      if (row % 3 === 0) c = PAL.red[0];
      else if ((x + course * 3) % 6 === 0) c = PAL.red[0];
      else if (hash2(x, y, 77) > 0.93) c = PAL.red[2];
      b.set(x, y, c);
    }
  }
  b.vline(1, 12, shopTop, PAL.red[2]);
  // White windows, three per floor, with stone lintels.
  for (const fy of [22, 56]) {
    for (const wx of fy === 56 ? [10, 42] : [10, 42, 74]) {
      b.hline(wx - 2, wx + 13, fy - 2, PAL.snow[2]);
      b.rect(wx - 1, fy - 1, 14, 2, PAL.snow[1]);
      sashWindow(b, wx, fy, 12, 22, true, false);
      b.hline(wx - 1, wx + 12, fy + 22, PAL.stone[3]);
    }
  }
  // Cornice on top.
  b.rect(1, 6, W - 2, 6, PAL.snow[2]);
  b.hline(1, W - 2, 6, PAL.snow[3]);
  for (let x = 3; x < W - 2; x += 3) b.set(x, 10, PAL.snow[1]);
  b.hline(1, W - 2, 11, PAL.stone[2]);
  b.rect(30, 1, 38, 5, PAL.snow[2]);
  b.hline(30, 67, 1, PAL.snow[3]);
  // --- the cream wooden shopfront ---
  const cream = PAL.sand[3];
  b.rect(1, shopTop, W - 2, base - shopTop + 1, cream);
  // Deep cornice: highlight, moulding, dentils, shadow.
  b.rect(0, shopTop, W, 7, PAL.snow[3]);
  b.hline(0, W - 1, shopTop + 2, PAL.sand[3]);
  for (let x = 2; x < W - 1; x += 3) b.set(x, shopTop + 4, PAL.sand[2]);
  b.hline(0, W - 1, shopTop + 6, PAL.sand[1]);
  b.hline(1, W - 2, shopTop + 7, PAL.sand[2]);
  // Pilasters.
  for (const px of [1, 56, W - 4]) {
    b.rect(px, shopTop + 8, 3, base - shopTop - 8, PAL.snow[3]);
    b.vline(px + 2, shopTop + 8, base, PAL.sand[2]);
  }
  // Display window (x 5…54): dark glass, gold script, spaced FRIET, potatoes.
  const wx0 = 5;
  const wx1 = 54;
  const wy0 = shopTop + 10;
  const wy1 = base - 6;
  b.rect(wx0 - 1, wy0 - 1, wx1 - wx0 + 3, wy1 - wy0 + 3, PAL.snow[3]);
  b.rect(wx0, wy0, wx1 - wx0 + 1, wy1 - wy0 + 1, PAL.navy[0]);
  for (let x = wx0; x <= wx1; x += 7) b.line(x, wy0, x + 6, wy0 + 8, PAL.navy[1]);
  fabelScript(b, wx0 + 9, wy0 + 2, PAL.gold[2], PAL.gold[0]);
  spaced(b, 'FRIET', (wx0 + wx1) / 2 + 1, wy0 + 13, PAL.gold[2], 3);
  // Potatoes in the bottom of the window.
  for (let y = wy1 - 6; y <= wy1; y++) {
    for (let x = wx0; x <= wx1; x++) {
      const k = hash2(x >> 1, y >> 1, 9);
      const top = y === wy1 - 6 && k < 0.5;
      if (top) continue;
      b.set(x, y, k > 0.8 ? PAL.sand[2] : k > 0.35 ? PAL.brown[3] : k > 0.12 ? PAL.sand[1] : PAL.brown[2]);
    }
  }
  b.hline(wx0, wx1, wy1 + 1, PAL.snow[3]);
  // Panelled stall riser under the window.
  for (let x = wx0; x < wx1; x += 12) {
    b.strokeRect(x + 1, wy1 + 2, 10, base - wy1 - 3, PAL.sand[2]);
  }
  // The open door (x 61…79): dark brick inside, the white door leaf swung open at the right.
  const dx0 = 61;
  const dx1 = 79;
  const dy0 = shopTop + 10;
  b.rect(dx0 - 1, dy0 - 1, dx1 - dx0 + 3, base - dy0 + 2, PAL.snow[3]);
  for (let y = dy0; y <= base; y++) {
    for (let x = dx0; x <= dx1; x++) {
      const row = y - dy0;
      b.set(x, y, row % 4 === 3 || (x + ((row >> 2) % 2) * 3) % 6 === 0 ? PAL.ink[1] : row < 10 ? PAL.brown[0] : PAL.rust[0]);
    }
  }
  b.rect(dx0, dy0, dx1 - dx0 + 1, 4, PAL.ink[1]); // shadow under the transom
  b.rect(dx0 + 2, dy0 + 6, 6, 3, PAL.steel[1]); // a fryer glint inside
  b.hline(dx0 + 2, dx0 + 7, dy0 + 6, PAL.steel[3]);
  // Door leaf (open, seen narrow): glass upper panel, panelled lower part.
  b.rect(dx1 + 1, dy0, 5, base - dy0 + 1, PAL.snow[3]);
  b.rect(dx1 + 2, dy0 + 2, 3, 14, PAL.sky[1]);
  b.set(dx1 + 2, dy0 + 2, PAL.sky[3]);
  b.rect(dx1 + 2, dy0 + 19, 3, base - dy0 - 21, PAL.sand[3]);
  b.vline(dx1 + 4, dy0 + 19, base - 2, PAL.sand[2]);
  b.vline(dx1 + 5, dy0, base, PAL.stone[2]);
  // Transom with the house number.
  b.rect(dx0, shopTop + 8, dx1 - dx0 + 1, 1, PAL.sand[2]);
  // Step.
  b.rect(dx0 - 2, base - 1, dx1 - dx0 + 5, 2, PAL.stone[2]);
  b.hline(dx0 - 2, dx1 + 2, base - 1, PAL.stone[3]);
  // The curly wrought-iron bracket for the hanging sign (the sign itself is `fabel-sign`, hung at
  // the bracket end: 86 px right of the left edge, 42 px above the shopfront).
  const by = shopTop - 42;
  b.rect(94, by - 3, 2, 8, PAL.ink[1]);
  b.hline(76, 95, by, PAL.ink[1]);
  b.line(80, by + 1, 94, by + 10, PAL.ink[1]);
  b.circle(90, by + 4, 2, PAL.ink[1], false);
  b.circle(82, by + 3, 1, PAL.ink[1], false);
  b.circle(77, by - 2, 1, PAL.ink[1], false);
  b.outline(INK);
  applyLight(b, light);
  return { buf: b, ox: 49, oy: H };
}

/** The oval black hanging sign with gold `Fabel` / `FRIET`; top-left = the bracket hook. */
function fabelSign(): Frame[] {
  const out: Frame[] = [];
  for (const swing of [0, 1, 0, -1]) {
    const b = new PixelBuffer(42, 36);
    const cx = 20 + swing;
    b.vline(20, 1, 4, PAL.ink[1]);
    b.line(20, 4, cx - 8, 8, PAL.ink[1]);
    b.line(20, 4, cx + 8, 8, PAL.ink[1]);
    b.ellipse(cx - 18, 7, 37, 28, PAL.gold[1]);
    b.ellipse(cx - 17, 8, 35, 26, PAL.ink[0]);
    fabelScript(b, cx - 13, 11, PAL.gold[2], PAL.gold[0]);
    spaced(b, 'FRIET', cx + 1, 22, PAL.gold[2], 1);
    out.push({ buf: b.outline(INK), ox: 20, oy: 1 });
  }
  return out;
}

/** The small counter the baker stands behind (front decor, 26 px). */
function fabelCounter(): Frame {
  const b = new PixelBuffer(30, 18);
  b.rect(1, 2, 28, 15, PAL.sand[3]);
  b.rect(0, 1, 30, 3, PAL.snow[3]);
  b.hline(0, 29, 3, PAL.sand[2]);
  b.strokeRect(4, 6, 22, 8, PAL.sand[2]);
  // A paper cone of fries and a mayonnaise pot on top.
  b.tri(20, 1, 26, 1, 23, -6 + 6, PAL.snow[3]);
  b.rect(21, -2 + 2, 4, 1, PAL.gold[2]);
  b.set(8, 0, PAL.snow[3]);
  b.set(9, 0, PAL.snow[3]);
  return feet(b.outline(INK));
}

/** The neighbour on the right: orange-brown wooden shop with leaded glass, brick above. */
function neighbour(light: Light): Frame {
  const W = 66;
  const H = 132;
  const b = new PixelBuffer(W, H);
  const base = H - 1;
  const shopTop = base - 44;
  for (let y = 14; y < shopTop; y++) {
    for (let x = 1; x < W - 1; x++) {
      const row = base - y;
      b.set(x, y, row % 3 === 0 || (x + ((row / 3) | 0) * 3) % 6 === 0 ? PAL.brown[0] : hash2(x, y, 5) > 0.92 ? PAL.brown[3] : PAL.brown[2]);
    }
  }
  for (const fy of [24, 58]) for (const wx of [8, 37]) sashWindow(b, wx, fy, 20, 22, true, false);
  // Neck gable-ish cornice.
  b.rect(1, 8, W - 2, 6, PAL.snow[2]);
  b.hline(1, W - 2, 8, PAL.snow[3]);
  b.tri(20, 8, 46, 8, 33, 1, PAL.snow[2]);
  b.circle(33, 6, 2, PAL.navy[1]);
  // Orange-brown wood shopfront.
  b.rect(1, shopTop, W - 2, base - shopTop + 1, PAL.orange[0]);
  b.rect(0, shopTop, W, 5, PAL.rust[1]);
  b.hline(0, W - 1, shopTop, PAL.orange[2]);
  b.hline(0, W - 1, shopTop + 4, PAL.brown[1]);
  for (const px of [1, 40, W - 4]) b.rect(px, shopTop + 5, 3, base - shopTop - 5, PAL.rust[1]);
  // Leaded glass: small diamond panes in the transom, a big window, a door.
  for (let y = shopTop + 7; y < shopTop + 15; y++) {
    for (let x = 5; x < 39; x++) b.set(x, y, (x + y) % 4 === 0 || (x - y + 64) % 4 === 0 ? PAL.ink[1] : (x + y) % 8 < 4 ? PAL.gold[3] : PAL.sky[2]);
  }
  b.rect(5, shopTop + 16, 34, 20, PAL.navy[1]);
  for (let x = 6; x < 38; x += 6) b.line(x, shopTop + 16, x + 5, shopTop + 24, PAL.sky[0]);
  b.rect(5, base - 7, 34, 6, PAL.rust[1]);
  b.rect(45, shopTop + 7, 16, base - shopTop - 7, PAL.rust[1]);
  b.rect(47, shopTop + 9, 12, 14, PAL.sky[1]);
  for (let y = shopTop + 9; y < shopTop + 23; y += 3) b.hline(47, 58, y, PAL.ink[1]);
  b.vline(53, shopTop + 9, shopTop + 22, PAL.ink[1]);
  b.outline(INK);
  applyLight(b, light);
  return feet(b);
}

for (const light of LIGHTS) {
  defineSprite(`${D}fabel-friet-${light}`, () => fabelFriet(light));
  defineSprite(`${D}neighbour-${light}`, () => neighbour(light));
}
defineSprite(`${D}fabel-sign`, fabelSign, { ticksPerFrame: 24 });
defineSprite(`${D}fabel-counter`, fabelCounter);

// =============================================================================================
// The hot-dog stand (reference photo 3)
// =============================================================================================

function hotdogStand(): Frame {
  const W = 84;
  const H = 62;
  const b = new PixelBuffer(W, H);
  const bx = 14; // box left
  const bw = 64;
  const by = 12; // box top
  const bh = 38;
  // Drawbar and jockey wheel at the left.
  b.line(2, by + bh - 2, bx, by + bh - 6, PAL.steel[2]);
  b.line(2, by + bh - 1, bx, by + bh - 5, PAL.steel[1]);
  b.vline(5, by + bh - 1, H - 4, PAL.steel[2]);
  b.circle(5, H - 3, 2, PAL.ink[1]);
  // Box: white with rounded top corners.
  b.roundRect(bx, by, bw, bh, 3, PAL.snow[3]);
  b.hline(bx + 2, bx + bw - 3, by + bh - 1, PAL.snow[1]);
  b.vline(bx + bw - 1, by + 3, by + bh - 1, PAL.snow[1]);
  // US-flag print: stripes sweeping diagonally over the right part.
  for (let y = by + 2; y < by + bh - 2; y++) {
    for (let x = bx + 30; x < bx + bw - 1; x++) {
      const k = Math.floor((x - bx + (y - by) * 1.2) / 4);
      if ((x - bx) + (by + bh - y) * 0.8 < 46) continue;
      // Keep a clean white band under the HOTDOGS lettering.
      if (y >= by + bh - 13 && y < by + bh - 2 && x < bx + bw / 2 + 18) continue;
      if (k % 2 === 0) b.set(x, y, PAL.red[2]);
    }
  }
  // Blue field with white stars at the top-left.
  b.rect(bx + 2, by + 2, 15, 12, PAL.sky[0]);
  b.hline(bx + 2, bx + 16, by + 2, PAL.sky[1]);
  for (let y = by + 4; y < by + 13; y += 3) for (let x = bx + 4 + ((y >> 1) & 1); x < bx + 16; x += 3) b.set(x, y, PAL.snow[3]);
  // The serving hatch (x 20…44 from the box's left edge) with the flap propped open above.
  const hx0 = bx + 20;
  const hx1 = bx + 44;
  const hy0 = by + 5;
  const hy1 = by + 21; // counter row
  b.rect(hx0 - 1, hy0 - 1, hx1 - hx0 + 3, hy1 - hy0 + 3, PAL.steel[3]);
  b.rect(hx0, hy0, hx1 - hx0 + 1, hy1 - hy0 + 1, PAL.ink[1]);
  b.rect(hx0, hy0, hx1 - hx0 + 1, 2, PAL.ink[0]);
  b.rect(hx0 + 2, hy0 + 3, 4, 3, PAL.steel[2]); // a steamer inside
  b.rect(hx1 - 7, hy0 + 2, 5, 2, PAL.gold[2]); // menu card
  b.poly([[hx0 - 2, hy0 - 2], [hx1 + 2, hy0 - 2], [hx1 + 5, hy0 - 9], [hx0 + 1, hy0 - 9]], PAL.snow[2]);
  b.line(hx0 - 2, hy0 - 2, hx1 + 2, hy0 - 2, PAL.snow[1]);
  b.line(hx1 + 2, hy0 - 2, hx1 + 4, hy0 - 8, PAL.steel[3]);
  b.rect(hx0 - 1, hy1 + 1, hx1 - hx0 + 3, 2, PAL.steel[3]); // counter ledge
  b.hline(hx0 - 1, hx1 + 1, hy1 + 1, PAL.snow[3]);
  // HOTDOGS in blue serif-ish capitals with a white edge.
  drawText(b, 'HOTDOGS', bx + bw / 2 - 6, by + bh - 11, { font: 'small', color: PAL.sky[0], outline: PAL.snow[3], align: 'center' });
  // A painted hot dog with a mustard zigzag at the bottom right.
  const hx = bx + 46;
  const hy = by + 15;
  b.roundRect(hx, hy, 16, 6, 3, PAL.sand[2]);
  b.roundRect(hx + 1, hy + 1, 14, 3, 1, PAL.red[1]);
  for (let x = hx + 2; x < hx + 14; x += 2) b.set(x, hy + 1 + ((x >> 1) & 1), PAL.gold[2]);
  b.hline(hx + 1, hx + 14, hy + 5, PAL.sand[1]);
  // Wheels and the chassis.
  b.rect(bx + 4, by + bh, bw - 8, 2, PAL.ink[1]);
  for (const wx of [bx + 18, bx + 30]) {
    b.circle(wx, H - 6, 5, PAL.ink[1]);
    b.circle(wx, H - 6, 2, PAL.steel[3]);
  }
  b.rect(bx + 10, by + bh, 30, 3, PAL.ink[1]); // mudguard shadow
  // Roof: a little vent and the flag pole for `flag-red`.
  b.rect(bx + 40, by - 3, 8, 3, PAL.steel[3]);
  b.vline(bx + bw - 8, 0, by, PAL.steel[2]);
  b.outline(INK);
  return { buf: b, ox: bx, oy: H };
}

function flagRed(): Frame[] {
  return [0, 1, 2, 3].map((f) => {
    const b = new PixelBuffer(16, 10);
    for (let x = 1; x < 15; x++) {
      const dy = Math.round(Math.sin(((x + f * 3.5) / 14) * Math.PI * 2) * (x / 14) * 1.5);
      b.vline(x, 1 + dy, 6 + dy, x < 3 ? PAL.red[1] : (x + f) % 7 === 0 ? PAL.red[3] : PAL.red[2]);
    }
    return { buf: b.outline(INK), ox: 0, oy: 1 };
  });
}

function cabinet(): Frame {
  const b = new PixelBuffer(22, 30);
  b.rect(1, 3, 20, 26, PAL.stone[2]);
  b.rect(0, 1, 22, 3, PAL.stone[3]);
  b.vline(11, 4, 27, PAL.stone[1]);
  b.vline(20, 3, 28, PAL.stone[1]);
  // Graffiti tags (our own squiggles) and stickers.
  b.line(3, 9, 7, 6, PAL.pink[1]);
  b.line(7, 6, 8, 11, PAL.pink[1]);
  b.line(8, 11, 13, 7, PAL.pink[1]);
  b.line(13, 7, 17, 12, PAL.pink[2]);
  b.line(4, 18, 9, 15, PAL.ink[1]);
  b.line(9, 15, 10, 20, PAL.ink[1]);
  b.line(10, 20, 15, 16, PAL.ink[1]);
  b.circle(16, 21, 2, PAL.teal[2], false);
  b.rect(3, 22, 4, 3, PAL.gold[3]);
  b.rect(13, 13, 3, 4, PAL.snow[3]);
  b.rect(1, 27, 20, 2, PAL.stone[1]);
  return feet(b.outline(INK));
}

function lampGrey(): Frame {
  const b = new PixelBuffer(16, 84);
  post(b, 7, 10, 82, 3, PAL.steel);
  b.rect(5, 78, 7, 5, PAL.steel[1]);
  b.line(8, 10, 13, 4, PAL.steel[2]);
  b.rect(10, 4, 5, 3, PAL.steel[3]);
  b.hline(10, 14, 7, PAL.gold[3]);
  return feet(b.outline(INK));
}

defineSprite(`${D}hotdog-stand`, hotdogStand);

/**
 * `hotdog-front`: the trailer box below the hatch counter, as FRONT decor at the same anchor as
 * `hotdog-stand`, so a vendor standing in the box (feet ~8 px above the ground) shows only his
 * head and chest in the hatch.
 */
function hotdogFront(): Frame {
  const f = hotdogStand();
  const b = f.buf.clone();
  b.rect(0, 0, b.w, 34, 0); // everything above the counter ledge (box top 12 + 22)
  return { buf: b, ox: f.ox, oy: f.oy };
}
defineSprite(`${D}hotdog-front`, hotdogFront);
defineSprite(`${D}flag-red`, flagRed, { ticksPerFrame: 8 });
defineSprite(`${D}cabinet`, cabinet);
defineSprite(`${D}lamp-grey`, lampGrey);

// =============================================================================================
// Street furniture
// =============================================================================================

/** The Amsterdam cast-iron street lamp: dark green post, a four-sided lantern. */
function lamp(): Frame {
  const b = new PixelBuffer(16, 72);
  post(b, 6, 16, 70, 3, [PAL.green[0], PAL.ink[1], PAL.green[0], PAL.ink[0]]);
  b.rect(4, 64, 8, 7, PAL.ink[1]);
  b.hline(4, 11, 64, PAL.green[0]);
  b.rect(5, 40, 6, 2, PAL.ink[1]); // collar
  // Lantern.
  b.poly([[3, 6], [12, 6], [11, 15], [4, 15]], PAL.gold[3]);
  b.vline(7, 6, 15, PAL.ink[1]);
  b.rect(5, 8, 2, 5, PAL.snow[3]);
  b.hline(2, 13, 5, PAL.ink[1]);
  b.tri(4, 4, 11, 4, 7, 0, PAL.ink[1]);
  b.hline(4, 11, 16, PAL.ink[1]);
  return feet(b.outline(INK));
}

/** An Amsterdammertje: a rust-brown bollard with three white crosses. */
function bollard(): Frame {
  const b = new PixelBuffer(9, 21);
  b.rect(2, 4, 5, 16, PAL.rust[1]);
  b.vline(2, 4, 19, PAL.rust[2]);
  b.vline(6, 4, 19, PAL.brown[0]);
  b.ellipse(1, 1, 7, 5, PAL.rust[1]);
  b.set(3, 2, PAL.rust[3]);
  b.rect(1, 18, 7, 2, PAL.brown[0]);
  xxx(b, 4, 7, PAL.snow[3], 4);
  return feet(b.outline(INK));
}

export const BIKE_COLOURS: readonly Color[] = [PAL.ink[1], PAL.red[1], PAL.sky[0], PAL.green[1], PAL.steel[2], PAL.ink[1], PAL.pink[1], PAL.gold[1]];

function bike(): Frame[] {
  return BIKE_COLOURS.map((c, i) => {
    const b = new PixelBuffer(24, 17);
    drawBike(b, 1, 16, c, i % 2 === 1);
    return feet(b.outline(INK));
  });
}

/** A rack of four parked bikes (front decor that half covers a player). */
function bikeRack(): Frame {
  const b = new PixelBuffer(68, 18);
  b.hline(2, 65, 12, PAL.steel[3]);
  for (const x of [4, 22, 40, 58]) b.vline(x, 12, 17, PAL.steel[2]);
  for (let i = 0; i < 4; i++) drawBike(b, 2 + i * 15, 17, BIKE_COLOURS[(i * 3) % BIKE_COLOURS.length], i % 2 === 1);
  return feet(b.outline(INK));
}

function bench(): Frame {
  const b = new PixelBuffer(34, 16);
  board(b, 1, 1, 32, 3, PAL.green);
  board(b, 1, 6, 32, 3, PAL.green);
  board(b, 1, 9, 32, 2, PAL.green);
  for (const x of [3, 29]) post(b, x, 4, 15, 2, PAL.steel);
  return feet(b.outline(INK));
}

/** A big elm: a dark trunk and a wide, layered canopy of small leaves. */
function elm(): Frame {
  const W = 104;
  const H = 136;
  const b = new PixelBuffer(W, H);
  // Trunk and branches.
  b.taper(52, H - 1, 50, 60, 9, 5, PAL.brown[1]);
  b.vline(48, 64, H - 2, PAL.brown[2]);
  b.taper(50, 74, 30, 44, 4, 2, PAL.brown[1]);
  b.taper(52, 70, 76, 40, 4, 2, PAL.brown[1]);
  b.taper(51, 64, 52, 24, 4, 2, PAL.brown[1]);
  // Canopy: clusters lit from the top left.
  const blobs: readonly (readonly [number, number, number])[] = [
    [28, 44, 20], [52, 30, 24], [76, 44, 20], [40, 62, 18], [66, 62, 18], [52, 50, 22], [18, 60, 13], [88, 60, 13], [52, 14, 14],
  ];
  for (const [x, y, r] of blobs) {
    for (let yy = y - r; yy <= y + r; yy++) {
      for (let xx = x - r; xx <= x + r; xx++) {
        const dx = xx - x;
        const dy = yy - y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > r) continue;
        const edge = d > r - 3 && hash2(xx >> 1, yy >> 1, 3) < 0.45;
        if (edge) continue;
        const lit = -dx - dy + (hash2(xx, yy, 4) - 0.5) * 10;
        const c = lit > r * 0.7 ? PAL.green[4] : lit > 0 ? PAL.green[3] : lit > -r * 0.6 ? PAL.green[2] : PAL.green[1];
        if (xx >= 0 && yy >= 0 && xx < W && yy < H) b.set(xx, yy, c);
      }
    }
  }
  // Gaps that show the branches.
  for (let k = 0; k < 14; k++) {
    const x = 14 + Math.floor(hash2(k, 1, 8) * 76);
    const y = 18 + Math.floor(hash2(k, 2, 8) * 56);
    if (b.get(x, y) !== 0) b.set(x, y, PAL.green[0]);
  }
  return feet(b.outline(INK));
}

/** A planter of tulips swaying (4 frames). */
function tulips(): Frame[] {
  return [0, 1, 2, 3].map((f) => {
    const b = new PixelBuffer(30, 20);
    board(b, 1, 12, 28, 7, PAL.brown);
    b.hline(1, 28, 12, PAL.brown[3]);
    for (let i = 0; i < 8; i++) {
      const x = 3 + i * 3 + (i % 2);
      const sway = Math.round(Math.sin((f + i * 0.7) * (Math.PI / 2)) * 1);
      const top = 3 + (i % 3);
      b.line(x, 12, x + sway, top + 2, PAL.green[2]);
      b.set(x - 1, 10, PAL.green[3]);
      const c = TULIPS[i % TULIPS.length];
      b.rect(x + sway - 1, top, 3, 3, c);
      b.set(x + sway, top - 1, c);
      b.set(x + sway - 1, top - 1, c);
      b.set(x + sway + 1, top - 1, c);
      b.set(x + sway - 1, top, PAL.snow[3]);
    }
    return feet(b.outline(INK));
  });
}

/** A flag on a pole, waving (4 frames). `bands` are drawn top to bottom. */
function flag(bands: readonly Color[], crosses: boolean): Frame[] {
  return [0, 1, 2, 3].map((f) => {
    const W = 34;
    const H = 64;
    const b = new PixelBuffer(W, H);
    post(b, 1, 1, H - 1, 2, PAL.steel);
    b.set(1, 0, PAL.gold[2]);
    b.set(2, 0, PAL.gold[2]);
    const fw = 28;
    const fh = 21;
    const bandH = fh / bands.length;
    for (let x = 0; x < fw; x++) {
      const t = x / fw;
      const dy = Math.round(Math.sin(t * Math.PI * 2 - f * (Math.PI / 2)) * 2 * t);
      const shade = Math.sin(t * Math.PI * 2 - f * (Math.PI / 2) + 0.8) > 0.55;
      for (let y = 0; y < fh; y++) {
        let c = bands[Math.min(bands.length - 1, Math.floor(y / bandH))];
        if (shade) c = c === PAL.snow[3] ? PAL.snow[1] : c === PAL.ink[1] ? PAL.ink[0] : c === PAL.red[2] ? PAL.red[1] : c === PAL.sky[0] ? PAL.navy[1] : c;
        b.set(3 + x, 3 + y + dy, c);
      }
    }
    if (crosses) {
      for (const x of [7, 14, 21]) {
        const t = x / fw;
        const dy = Math.round(Math.sin(t * Math.PI * 2 - f * (Math.PI / 2)) * 2 * t);
        const yc = 3 + Math.floor(fh / 2) + dy;
        for (let k = -2; k <= 2; k++) {
          b.set(3 + x + k, yc + k, PAL.snow[3]);
          b.set(3 + x + k, yc - k, PAL.snow[3]);
        }
      }
    }
    return { buf: b.outline(INK), ox: 2, oy: H };
  });
}

/** Striped shop awning; top-left at the platform's left end and top. Frames: colour sets. */
export const AWNING_SETS: readonly (readonly [Color, Color])[] = [
  [PAL.green[2], PAL.snow[3]],
  [PAL.red[2], PAL.snow[3]],
  [PAL.sky[0], PAL.snow[3]],
  [PAL.orange[1], PAL.gold[3]],
];
export function awningSprite(w: number): string {
  const id = `${D}awning-${w}`;
  if (hasSprite(id)) return id;
  defineSprite(
    id,
    () =>
      AWNING_SETS.map(([a, c]) => {
        const b = new PixelBuffer(w + 2, 18);
        for (let x = 1; x <= w; x++) {
          const col = Math.floor((x - 1) / 6) % 2 === 0 ? a : c;
          b.vline(x, 1, 8, col);
          if ((x - 1) % 6 < 5) b.set(x, 9, col);
        }
        b.hline(1, w, 1, PAL.snow[3]);
        b.hline(1, w, 2, a);
        b.hline(1, w, 8, PAL.ink[1]);
        b.line(3, 10, 8, 16, PAL.ink[1]);
        b.line(w - 2, 10, w - 7, 16, PAL.ink[1]);
        return { buf: b.outline(INK), ox: 1, oy: 1 };
      }),
    { anchor: 'top-left' },
  );
  return id;
}

/** Chimney smoke (6 frames), feet at the chimney top. */
function smoke(): Frame[] {
  return [0, 1, 2, 3, 4, 5].map((f) => {
    const b = new PixelBuffer(20, 40);
    for (let k = 0; k < 5; k++) {
      const t = ((k * 6 + f) % 30) / 30;
      const y = 38 - t * 34;
      const x = 8 + Math.sin(t * 5 + k) * 3 + t * 6;
      const r = 1 + Math.round(t * 3);
      b.circle(Math.round(x), Math.round(y), r, t > 0.6 ? PAL.snow[1] : PAL.stone[3]);
      b.set(Math.round(x) - 1, Math.round(y) - r + 1, PAL.snow[2]);
    }
    return feet(b);
  });
}

defineSprite(`${D}lamp`, lamp);
defineSprite(`${D}bollard`, bollard);
defineSprite(`${D}bike`, bike);
defineSprite(`${D}bike-rack`, bikeRack);
defineSprite(`${D}bench`, bench);
defineSprite(`${D}elm`, elm);
defineSprite(`${D}tulips`, tulips, { ticksPerFrame: 14 });
defineSprite(`${D}flag-ams`, () => flag([PAL.red[2], PAL.ink[1], PAL.red[2]], true), { ticksPerFrame: 9 });
defineSprite(`${D}flag-nl`, () => flag([PAL.red[2], PAL.snow[3], PAL.sky[0]], false), { ticksPerFrame: 9 });
defineSprite(`${D}smoke`, smoke, { ticksPerFrame: 7 });

// =============================================================================================
// Bridges
// =============================================================================================

/** The deck line of `ground().hill(len, h)` (8 straight steps), relative to the start. */
export function hillY(x: number, len: number, h: number, steps = 8): number {
  const seg = len / steps;
  const i = Math.max(0, Math.min(steps - 1, Math.floor(x / seg)));
  const y = (k: number): number => (k === 0 || k === steps ? 0 : -(h * (1 - Math.cos((k / steps) * Math.PI * 2))) / 2);
  const t = (x - i * seg) / seg;
  return y(i) + (y(i + 1) - y(i)) * Math.max(0, Math.min(1, t));
}

/** Iron bridge railing with chained bikes along a hill deck; top-left = (bridge start, ground y − 30). */
export function bridgeRailSprite(len: number, h: number): string {
  const id = `${D}bridge-rail-${len}x${h}`;
  if (hasSprite(id)) return id;
  defineSprite(
    id,
    () => {
      const top = 30;
      const b = new PixelBuffer(len + 2, top + 2);
      const deck = (x: number): number => top + Math.round(hillY(x, len, h));
      // Stone end posts.
      for (const x of [2, len - 6]) {
        b.rect(x, deck(x) - 18, 6, 18, PAL.stone[2]);
        b.vline(x, deck(x) - 18, deck(x) - 1, PAL.stone[3]);
        b.rect(x - 1, deck(x) - 20, 8, 3, PAL.stone[3]);
      }
      // Railing: top rail, bars, a lower rail.
      for (let x = 8; x < len - 6; x++) {
        const d = deck(x);
        b.set(x, d - 14, PAL.ink[1]);
        b.set(x, d - 13, PAL.green[0]);
        b.set(x, d - 6, PAL.ink[1]);
        if (x % 4 === 0) b.vline(x, d - 13, d - 1, PAL.ink[1]);
        if (x % 16 === 8) {
          b.circle(x + 2, d - 9, 2, PAL.ink[1], false);
        }
      }
      // Bikes chained to the railing.
      for (let x = 14, i = 0; x < len - 30; x += 22 + (i % 3) * 6, i++) {
        drawBike(b, x, deck(x + 10), BIKE_COLOURS[(i * 5 + 1) % BIKE_COLOURS.length], i % 2 === 0);
      }
      return { buf: b.outline(INK), ox: 1, oy: top + 1 };
    },
  );
  return id;
}

/** The brick arch face of a canal bridge below the deck (front decor); top-left = (start, ground y). */
export function bridgeFaceSprite(len: number, h: number): string {
  const id = `${D}bridge-face-${len}x${h}`;
  if (hasSprite(id)) return id;
  defineSprite(
    id,
    () => {
      const top = h + 2;
      const H = top + 40;
      const b = new PixelBuffer(len, H);
      const cx = len / 2;
      const ar = len * 0.3;
      for (let x = 0; x < len; x++) {
        const d = top + Math.round(hillY(x, len, h)) + 2;
        for (let y = d; y < H; y++) {
          const row = y - d;
          let c: Color = (y % 4 === 3 || (x + ((y >> 2) % 2) * 4) % 8 === 0) ? PAL.rust[0] : hash2(x >> 3, y >> 2, 6) > 0.7 ? PAL.rust[2] : PAL.rust[1];
          if (row === 0) c = PAL.stone[3];
          else if (row === 1) c = PAL.stone[2];
          // The arch opening: dark canal water under it.
          const dx = (x - cx) / ar;
          const archTop = H - 2 - Math.sqrt(Math.max(0, 1 - dx * dx)) * (H - top - 12);
          if (Math.abs(dx) < 1 && y >= archTop) {
            c = y >= H - 8 ? (((x + y) & 3) === 0 ? PAL.teal[1] : PAL.teal[0]) : PAL.ink[1];
            if (y < archTop + 2) c = PAL.snow[2];
          }
          b.set(x, y, c);
        }
      }
      return { buf: b, ox: 0, oy: top };
    },
  );
  return id;
}

/** A raised white drawbridge (two posts, the top beam, the leaf standing up); feet at the quay edge. */
function drawbridge(): Frame {
  const W = 70;
  const H = 150;
  const b = new PixelBuffer(W, H);
  const white: Ramp = [PAL.steel[3], PAL.snow[1], PAL.snow[2], PAL.snow[3]];
  // Portal posts and the cross beam with the balance arms.
  post(b, 8, 30, H - 1, 4, white);
  post(b, 40, 30, H - 1, 4, white);
  b.rect(4, 26, 44, 5, PAL.snow[2]);
  b.hline(4, 47, 26, PAL.snow[3]);
  b.line(10, 30, 42, 50, PAL.snow[2]);
  b.line(42, 30, 10, 50, PAL.snow[2]);
  // The balance beams raised (pointing down-left) and the leaf up (standing at the right).
  b.thickLine(12, 22, 64, 6, 3, PAL.snow[2]);
  b.line(12, 21, 64, 5, PAL.snow[3]);
  b.rect(52, 10, 14, H - 18, PAL.snow[1]);
  b.vline(52, 10, H - 9, PAL.snow[3]);
  for (let y = 16; y < H - 10; y += 8) b.hline(53, 65, y, PAL.steel[3]);
  b.line(64, 6, 64, 10, PAL.ink[1]);
  b.line(46, 30, 58, 14, PAL.ink[1]); // chain
  // Red-white warning stripes on the leaf edge.
  for (let y = 12; y < H - 10; y++) b.set(66, y, ((y >> 2) & 1) === 0 ? PAL.red[2] : PAL.snow[3]);
  b.rect(1, H - 3, W - 2, 3, PAL.stone[2]);
  return feet(b.outline(INK));
}

/** One 128-px span of the white wooden Amstel bridge: railing over the deck (y 28), piers below. */
function whiteBridge(): Frame {
  const W = 130;
  const H = 72;
  const b = new PixelBuffer(W, H);
  const deck = 28;
  // Piers into the water with a little arch between them.
  for (const x of [2, 66]) {
    b.rect(x, deck + 4, 6, H - deck - 5, PAL.snow[2]);
    b.vline(x, deck + 4, H - 2, PAL.snow[3]);
    b.vline(x + 5, deck + 4, H - 2, PAL.steel[3]);
  }
  for (let x = 8; x < 128; x++) {
    const t = ((x - 8) % 64) / 58;
    if (t > 1) continue;
    const y = deck + 4 + Math.round(Math.sin(t * Math.PI) * 10);
    b.vline(x, deck + 4, y, PAL.snow[1]);
    b.set(x, y, PAL.snow[3]);
  }
  // Railing: white posts, a top rail and cross bracing.
  for (let x = 1; x < W - 1; x++) {
    b.set(x, deck - 14, PAL.snow[3]);
    b.set(x, deck - 13, PAL.snow[1]);
    b.set(x, deck - 1, PAL.snow[1]);
  }
  for (let x = 1; x < W - 1; x += 16) {
    b.rect(x, deck - 16, 3, 16, PAL.snow[2]);
    b.vline(x, deck - 16, deck - 1, PAL.snow[3]);
    b.line(x + 3, deck - 12, x + 15, deck - 2, PAL.snow[2]);
    b.line(x + 3, deck - 2, x + 15, deck - 12, PAL.snow[2]);
  }
  // Bulbs along the rail (the bridge lights).
  for (let x = 9; x < W; x += 16) b.set(x, deck - 15, PAL.gold[3]);
  return { buf: b.outline(INK), ox: 1, oy: deck };
}

/** The overhead balance beams of the white bridge (feet at the deck). */
function whitePortal(): Frame {
  const W = 72;
  const H = 120;
  const b = new PixelBuffer(W, H);
  const white: Ramp = [PAL.steel[3], PAL.snow[1], PAL.snow[2], PAL.snow[3]];
  post(b, 6, 24, H - 1, 4, white);
  post(b, 62, 24, H - 1, 4, white);
  b.rect(2, 20, 68, 5, PAL.snow[2]);
  b.hline(2, 69, 20, PAL.snow[3]);
  b.line(10, 25, 36, 50, PAL.snow[2]);
  b.line(62, 25, 36, 50, PAL.snow[2]);
  b.thickLine(4, 12, 68, 12, 3, PAL.snow[2]);
  b.hline(4, 68, 11, PAL.snow[3]);
  for (let x = 6; x < 68; x += 8) b.set(x, 10, PAL.gold[3]);
  return feet(b.outline(INK));
}

/** A Blauwbrug lamp: an ornate stone base, a fluted post, a lantern and a gold crown. */
function blauwbrugLamp(): Frame {
  const b = new PixelBuffer(22, 86);
  b.rect(4, 66, 14, 19, PAL.stone[2]);
  b.vline(4, 66, 84, PAL.stone[3]);
  b.rect(3, 64, 16, 3, PAL.stone[3]);
  b.rect(6, 70, 10, 8, PAL.sky[0]); // a blue enamel plaque
  b.set(7, 71, PAL.sky[1]);
  post(b, 9, 24, 63, 4, PAL.steel);
  b.rect(6, 22, 10, 3, PAL.gold[1]);
  // Lantern and the crown on top.
  b.poly([[5, 10], [16, 10], [14, 21], [7, 21]], PAL.gold[3]);
  b.vline(10, 10, 21, PAL.ink[1]);
  b.hline(4, 17, 9, PAL.ink[1]);
  b.rect(6, 4, 10, 5, PAL.gold[2]);
  for (const x of [6, 9, 12, 15]) b.set(x, 3, PAL.gold[3]);
  b.set(8, 5, PAL.red[2]);
  b.set(13, 5, PAL.sky[0]);
  b.set(10, 1, PAL.gold[3]);
  b.set(10, 2, PAL.gold[2]);
  return feet(b.outline(INK));
}

export function balustradeSprite(w: number): string {
  const id = `${D}balustrade-${w}`;
  if (hasSprite(id)) return id;
  defineSprite(id, () => {
    const b = new PixelBuffer(w + 2, 18);
    b.rect(1, 1, w, 3, PAL.stone[3]);
    b.hline(1, w, 3, PAL.stone[1]);
    for (let x = 3; x < w - 1; x += 5) {
      b.rect(x, 5, 3, 10, PAL.stone[2]);
      b.set(x, 7, PAL.stone[3]);
      b.set(x + 2, 11, PAL.stone[1]);
    }
    b.rect(1, 15, w, 3, PAL.stone[2]);
    return feet(b.outline(INK));
  });
  return id;
}

defineSprite(`${D}drawbridge`, drawbridge);
defineSprite(`${D}white-bridge`, whiteBridge);
defineSprite(`${D}white-portal`, whitePortal);
defineSprite(`${D}blauwbrug-lamp`, blauwbrugLamp);

// =============================================================================================
// Houseboats
// =============================================================================================

export const BOAT_COLOURS: readonly Ramp[] = [
  [PAL.green[0], PAL.green[1], PAL.green[2], PAL.green[3]],
  [PAL.navy[0], PAL.navy[1], PAL.sky[0], PAL.sky[1]],
  [PAL.red[0], PAL.red[1], PAL.red[2], PAL.red[3]],
  [PAL.brown[0], PAL.brown[1], PAL.brown[2], PAL.brown[3]],
];

/**
 * A houseboat `w` wide: the roof at the sprite top (row 1), the hull down into the water. `cx`/`cw`
 * place the cabin (the roof platform) inside the hull; the deck is `deck` px under the roof.
 * Top-left anchor = (hull x0, roof y). Returns the sprite id.
 */
export function houseboatSprite(w: number, deck: number, cx: number, cw: number, colour: number): string {
  const id = `${D}houseboat-${w}x${deck}-${cx}-${cw}-${colour}`;
  if (hasSprite(id)) return id;
  defineSprite(
    id,
    () => {
      const r = BOAT_COLOURS[colour % BOAT_COLOURS.length];
      const H = deck + 26;
      const b = new PixelBuffer(w + 2, H + 1);
      const roof = 1;
      const hullTop = roof + deck;
      // Hull: a long dark box with a rounded bow, a waterline stripe.
      b.rect(1, hullTop, w, H - hullTop, r[0]);
      b.rect(1, hullTop + 12, w, H - hullTop - 12, PAL.ink[1]);
      b.rect(1, hullTop, w, 3, r[1]);
      b.hline(1, w, hullTop, r[2]);
      b.hline(1, w, hullTop + 11, PAL.red[1]);
      for (let x = 6; x < w - 4; x += 9) b.circle(x, hullTop + 7, 1, PAL.steel[2]); // portholes
      for (let y = hullTop + 3; y < H; y++) {
        b.set(w, y, 0);
        if (y > hullTop + 6) b.set(w - 1, y, 0);
      }
      // Cabin with windows, curtains and plants; the flat roof is the platform.
      if (cw > 0) {
        const x0 = 1 + cx;
        b.rect(x0, roof + 2, cw, deck - 2, r[2]);
        b.vline(x0, roof + 2, hullTop - 1, r[3]);
        b.vline(x0 + cw - 1, roof + 2, hullTop - 1, r[0]);
        b.rect(x0 - 2, roof, cw + 4, 3, PAL.brown[2]);
        b.hline(x0 - 2, x0 + cw + 1, roof, PAL.brown[3]);
        for (let x = x0 + 4; x < x0 + cw - 8; x += 12) {
          b.rect(x, roof + 5, 8, Math.max(4, deck - 10), PAL.snow[3]);
          b.rect(x + 1, roof + 6, 6, Math.max(2, deck - 12), PAL.navy[1]);
          b.set(x + 1, roof + 6, PAL.sky[2]);
          b.vline(x + 1, roof + 6, roof + 7, PAL.gold[3]);
        }
        // Potted plants on the roof edge and a stove pipe.
        b.rect(x0 + 2, roof - 1, 3, 1, PAL.green[2]);
        b.set(x0 + 3, roof - 2, PAL.red[2]);
        b.rect(x0 + cw - 8, roof - 6, 2, 6, PAL.steel[1]);
        b.hline(x0 + cw - 9, x0 + cw - 6, roof - 6, PAL.steel[2]);
      }
      // Deck rail posts, a bike and flower pots on the deck.
      for (let x = 3; x < w - 2; x += 10) b.vline(x, hullTop - 4, hullTop - 1, PAL.snow[2]);
      for (let x = 2; x < w - 1; x++) if (x < 1 + cx - 2 || x > cx + cw + 2) b.set(x, hullTop - 4, PAL.snow[2]);
      if (cx > 24) drawBike(b, 3, hullTop, BIKE_COLOURS[colour % BIKE_COLOURS.length]);
      if (w - cx - cw > 12) {
        const px = cx + cw + 6;
        b.rect(px, hullTop - 3, 4, 3, PAL.rust[2]);
        b.rect(px, hullTop - 6, 4, 3, PAL.green[3]);
        b.set(px + 1, hullTop - 7, TULIPS[colour % TULIPS.length]);
      }
      return { buf: b.outline(INK), ox: 1, oy: roof };
    },
  );
  return id;
}

// =============================================================================================
// Section b: the Rijksmuseum and Museumplein
// =============================================================================================

/** The Rijksmuseum with the cycle passage (480 wide; the passage 80…400 px; the ceiling 80 px up). */
function rijksmuseum(): Frame {
  const W = 480;
  const H = 176;
  const b = new PixelBuffer(W + 2, H);
  const base = H - 1;
  const ceil = base - 80; // passage ceiling (world y 96)
  const brick = (x: number, y: number): Color => {
    const row = base - y;
    if (row % 3 === 0) return PAL.rust[0];
    if ((x + ((row / 3) | 0) * 3) % 6 === 0) return PAL.rust[0];
    return hash2(x, y, 31) > 0.93 ? PAL.orange[0] : PAL.rust[1];
  };
  const roofY = 58;
  // Main wall.
  for (let y = roofY; y <= base; y++) for (let x = 1; x <= W; x++) b.set(x, y, brick(x, y));
  // Slate roof.
  for (let y = 44; y < roofY; y++) {
    const inset = Math.round((roofY - y) * 0.6);
    for (let x = 1 + inset; x <= W - inset; x++) b.set(x, y, (y + (x >> 2)) % 3 === 0 ? PAL.steel[0] : PAL.steel[1]);
  }
  for (let x = 20; x < W - 20; x += 40) {
    b.rect(x, 48, 8, 10, brick(x, 48));
    b.tri(x - 1, 48, x + 8, 48, x + 4, 43, PAL.sand[3]); // dormers
    b.rect(x + 2, 50, 4, 6, PAL.navy[1]);
  }
  // Cream stone bands.
  for (const y of [roofY, roofY + 1, ceil - 2, ceil - 1]) b.hline(1, W, y, y === roofY ? PAL.sand[3] : PAL.sand[2]);
  // Tall windows on the upper floor with cream frames and arches.
  for (let x = 12; x < W - 12; x += 20) {
    const wy = roofY + 6;
    b.rect(x - 1, wy - 1, 10, 24, PAL.sand[3]);
    b.rect(x, wy + 2, 8, 20, PAL.navy[1]);
    b.ellipse(x, wy, 8, 6, PAL.navy[1]);
    b.set(x + 1, wy + 3, PAL.sky[2]);
    b.vline(x + 4, wy + 1, wy + 19, PAL.sand[2]);
    b.hline(x, x + 7, wy + 10, PAL.sand[2]);
  }
  // The passage: dark vaulted interior between x 80 and 400 (the outer ends are the towers).
  const p0 = 81;
  const p1 = 400;
  for (let y = ceil; y <= base; y++) {
    for (let x = p0; x <= p1; x++) {
      const depth = y - ceil;
      let c: Color = depth < 6 ? PAL.ink[0] : depth < 14 ? PAL.ink[1] : PAL.brown[0];
      // Arched niches along the side wall with lamps.
      const k = (x - p0) % 40;
      const archTop = ceil + 18 + Math.round(Math.abs(k - 20) * Math.abs(k - 20) / 40);
      if (k > 4 && k < 36 && y > archTop) c = y > base - 30 ? PAL.rust[0] : PAL.ink[1];
      if (k > 4 && k < 36 && y === archTop + 1) c = PAL.sand[1];
      // Tiles below: cream with a blue band.
      if (y > base - 24 && (k <= 4 || k >= 36)) c = (y + x) % 4 === 0 ? PAL.sand[1] : PAL.sand[2];
      if (y === base - 18) c = PAL.sky[0];
      if (k === 20 && y > ceil + 6 && y < ceil + 12) c = PAL.ink[1];
      b.set(x, y, c);
    }
  }
  for (let x = p0 + 20; x < p1; x += 40) {
    b.circle(x, ceil + 13, 2, PAL.gold[3]);
    b.set(x, ceil + 13, PAL.snow[3]);
  }
  // Vault ribs.
  for (let x = p0; x <= p1; x += 20) b.vline(x, ceil, ceil + 4, PAL.sand[0]);
  // Towers at both passage ends.
  for (const tx of [p0 - 20, p1 - 18]) {
    const tw = 38;
    const t0 = 24;
    for (let y = t0; y <= base; y++) {
      for (let x = tx; x < tx + tw; x++) {
        if (y > ceil && x > p0 && x < p1) continue;
        b.set(x, y, brick(x, y));
      }
    }
    b.vline(tx, t0, ceil, PAL.orange[0]);
    b.vline(tx + tw - 1, t0, ceil, PAL.rust[0]);
    for (const y of [t0, t0 + 1, t0 + 16, ceil - 2]) b.hline(tx, tx + tw - 1, y, PAL.sand[3]);
    // Corner pinnacles, belfry openings, a clock and a tall window.
    for (const px of [tx - 1, tx + tw - 3]) {
      b.rect(px, t0 - 8, 4, 8, PAL.sand[3]);
      b.tri(px, t0 - 8, px + 3, t0 - 8, px + 1, t0 - 14, PAL.steel[1]);
    }
    for (const bx of [tx + 6, tx + 22]) {
      b.rect(bx, t0 + 4, 10, 10, PAL.ink[1]);
      b.ellipse(bx, t0 + 2, 10, 6, PAL.ink[1]);
    }
    b.circle(tx + 19, t0 + 26, 6, PAL.sand[3]);
    b.circle(tx + 19, t0 + 26, 5, PAL.snow[3]);
    b.line(tx + 19, t0 + 26, tx + 19, t0 + 22, PAL.ink[1]);
    b.line(tx + 19, t0 + 26, tx + 22, t0 + 27, PAL.ink[1]);
    b.rect(tx + 11, t0 + 40, 16, ceil - t0 - 46, PAL.navy[1]);
    b.ellipse(tx + 11, t0 + 36, 16, 9, PAL.navy[1]);
    b.vline(tx + 19, t0 + 37, ceil - 7, PAL.sand[2]);
    b.set(tx + 13, t0 + 41, PAL.sky[2]);
    // The spire: dark slate, lit on the left, a gold vane at the top of the view.
    for (let y = 0; y < t0; y++) {
      const half = Math.max(1, Math.round((tw / 2 - 3) * Math.pow(y / t0, 1.6)));
      for (let x = tx + tw / 2 - half; x < tx + tw / 2 + half; x++) b.set(x, y, x < tx + tw / 2 - 1 ? PAL.steel[2] : PAL.steel[0]);
      if (y % 6 === 3) b.hline(tx + tw / 2 - half, tx + tw / 2 + half - 1, y, PAL.steel[1]);
    }
    b.vline(tx + tw / 2, 0, 4, PAL.gold[2]);
    b.set(tx + tw / 2 + 1, 1, PAL.gold[3]);
  }
  // The passage mouths: cream stone arches framing each end.
  for (const ax of [p0, p1]) {
    b.rect(ax - 3, ceil - 4, 6, base - ceil + 5, PAL.sand[3]);
    b.vline(ax + 2, ceil - 4, base, PAL.sand[1]);
  }
  // Ground-floor windows outside the passage.
  for (const x of [8, 30, 430, 452]) {
    b.rect(x - 1, ceil + 6, 12, 40, PAL.sand[3]);
    b.rect(x, ceil + 8, 10, 37, PAL.navy[1]);
    b.ellipse(x, ceil + 5, 10, 8, PAL.navy[1]);
    b.set(x + 1, ceil + 9, PAL.sky[2]);
  }
  // Banners on the facade (our own museum banners, no logos).
  for (const [x, c] of [[150, PAL.red[2]], [310, PAL.gold[2]]] as const) {
    b.rect(x, roofY + 4, 10, 26, c);
    b.tri(x, roofY + 30, x + 9, roofY + 30, x + 5, roofY + 34, c);
    b.vline(x, roofY + 4, roofY + 29, PAL.snow[3]);
  }
  b.outline(INK);
  return { buf: b, ox: 241, oy: H };
}

/** Front strip of lawn along the ground line (top-left at (x, 172)). */
export function lawnSprite(w: number): string {
  const id = `${D}lawn-${w}`;
  if (hasSprite(id)) return id;
  defineSprite(
    id,
    () => {
      const b = new PixelBuffer(w, 48);
      for (let x = 0; x < w; x++) {
        const tuft = Math.floor(hash2(x, 1, 12) * 4);
        for (let y = 4 - tuft; y < 48; y++) {
          const d = y - 4;
          let c: Color = d < 1 ? PAL.green[4] : d < 4 ? PAL.green[3] : (x + y * 3) % 7 === 0 ? PAL.green[1] : PAL.green[2];
          if (d >= 30) c = PAL.green[1];
          if (y < 4) c = PAL.green[3];
          if (d > 8 && hash2(x, y, 13) > 0.985) c = TULIPS[(x + y) % TULIPS.length];
          b.set(x, y, c);
        }
      }
      return b;
    },
    { anchor: 'top-left' },
  );
  return id;
}

/** The long shallow Museumplein pool (back decor at ground level; top-left at (x, 170)). */
export function poolSprite(w: number): string {
  const id = `${D}pool-${w}`;
  if (hasSprite(id)) return id;
  defineSprite(
    id,
    () =>
      [0, 1, 2, 3].map((f) => {
        const b = new PixelBuffer(w, 10);
        b.rect(0, 0, w, 10, PAL.stone[3]);
        b.rect(2, 2, w - 4, 6, PAL.sky[1]);
        for (let x = 2; x < w - 2; x++) {
          if (((x + f * 3) & 15) < 3) b.set(x, 3, PAL.snow[3]);
          if (((x * 3 + f * 5) & 31) === 7) b.set(x, 6, PAL.sky[3]);
          b.set(x, 2, PAL.sky[2]);
        }
        b.hline(0, w - 1, 9, PAL.stone[1]);
        return b;
      }),
    { anchor: 'top-left', ticksPerFrame: 10 },
  );
  return id;
}

defineSprite(`${D}rijksmuseum`, rijksmuseum);

// =============================================================================================
// Section d: the Stopera and Waterlooplein
// =============================================================================================

/** The Stopera: the curved white marble-and-glass theatre (left) and the red-brick city hall (right). */
function stopera(): Frame {
  const W = 384;
  const H = 168;
  const b = new PixelBuffer(W + 2, H + 1);
  const base = H;
  // The music theatre: a curved front (a wide ellipse segment), white marble bands and glass.
  const tx1 = 230;
  for (let x = 1; x < tx1; x++) {
    const t = (x - 1) / (tx1 - 2);
    const top = 30 + Math.round(Math.pow(t - 0.45, 2) * 70);
    for (let y = top; y <= base; y++) {
      const row = y - top;
      let c: Color;
      const band = row % 26;
      if (band < 9) {
        // Marble: a lit top edge, a soft middle, a shadow under the ledge; the curve darkens the right.
        c = band === 0 ? PAL.snow[3] : band >= 7 ? PAL.snow[0] : t > 0.8 ? PAL.snow[1] : x % 11 === 0 ? PAL.snow[1] : PAL.snow[2];
      } else {
        // Glass: calm panes in dusk purple with mullions and one warm sunset streak per few panes.
        const m = x % 12;
        const streak = (x + row * 2) % 72 < 5 && t < 0.8;
        c = m === 0 ? PAL.stone[1]
          : band === 9 ? PAL.purple[0]
          : streak ? PAL.pink[1]
          : t > 0.8 ? PAL.purple[0]
          : band < 15 ? PAL.purple[2] : PAL.purple[1];
        if (band === 17 && m !== 0) c = PAL.stone[1];
      }
      b.set(x, y, c);
    }
    b.set(x, top, PAL.snow[3]);
  }
  // A roof edge and the fly tower behind.
  b.rect(60, 10, 90, 22, PAL.snow[1]);
  b.hline(60, 149, 10, PAL.snow[3]);
  for (let x = 64; x < 146; x += 8) b.vline(x, 12, 30, PAL.snow[0]);
  // The city hall wing: red brick with white bands, a flat roof.
  const hx0 = tx1;
  for (let y = 22; y <= base; y++) {
    for (let x = hx0; x <= W; x++) {
      const row = base - y;
      let c: Color = row % 3 === 0 || (x + ((row / 3) | 0) * 3) % 6 === 0 ? PAL.red[0] : hash2(x, y, 41) > 0.93 ? PAL.red[2] : PAL.red[1];
      if ((y - 22) % 30 < 4) c = (y - 22) % 30 === 0 ? PAL.snow[3] : PAL.snow[2];
      b.set(x, y, c);
    }
  }
  b.vline(hx0, 22, base, PAL.ink[1]);
  // Windows in the hall wing.
  for (let y = 30; y < base - 60; y += 30) {
    for (let x = hx0 + 8; x < W - 8; x += 18) {
      b.rect(x, y, 12, 16, PAL.navy[1]);
      b.set(x + 1, y + 1, PAL.sky[2]);
      b.hline(x, x + 11, y + 8, PAL.steel[2]);
    }
  }
  // The big glass doors (centre 294) under a white canopy.
  const dx = 294;
  b.rect(dx - 46, base - 106, 92, 5, PAL.snow[3]);
  b.hline(dx - 46, dx + 45, base - 102, PAL.steel[3]);
  b.rect(dx - 40, base - 100, 80, 100, PAL.steel[1]);
  for (let x = dx - 38; x < dx + 38; x++) {
    for (let y = base - 98; y <= base; y++) {
      const m = (x - dx + 40) % 20;
      b.set(x, y, m === 0 ? PAL.steel[3] : y < base - 70 ? PAL.sky[0] : PAL.navy[1]);
    }
  }
  b.vline(dx, base - 98, base, PAL.steel[3]);
  b.set(dx - 3, base - 50, PAL.gold[3]);
  b.set(dx + 3, base - 50, PAL.gold[3]);
  // Our own lettering over the doors, on a plain dark plaque: white letters straddling the white
  // band and the brick did not read.
  const tw = measure('STADHUIS');
  b.rect(dx - (tw >> 1) - 4, base - 120, tw + 8, 12, PAL.steel[1]);
  b.rect(dx - (tw >> 1) - 3, base - 119, tw + 6, 10, PAL.ink[1]);
  drawText(b, 'STADHUIS', dx, base - 117, { font: 'small', color: PAL.snow[3], align: 'center' });
  // Steps.
  b.rect(dx - 52, base - 3, 104, 4, PAL.stone[3]);
  b.hline(dx - 52, dx + 51, base - 3, PAL.snow[2]);
  b.outline(INK);
  return { buf: b, ox: 1, oy: H + 1 };
}

const STALL_SETS: readonly (readonly [Color, Color, Color])[] = [
  [PAL.red[2], PAL.snow[3], PAL.sky[1]],
  [PAL.green[2], PAL.snow[3], PAL.gold[2]],
  [PAL.sky[0], PAL.gold[3], PAL.pink[2]],
];

/** A Waterlooplein flea-market stall with a striped awning (frames 0–2). */
function marketStall(): Frame[] {
  return STALL_SETS.map(([a, c, goods], i) => {
    const b = new PixelBuffer(58, 46);
    for (const x of [3, 53]) post(b, x, 8, 45, 2, PAL.steel);
    for (let x = 1; x < 57; x++) {
      const col = Math.floor(x / 6) % 2 === 0 ? a : c;
      for (let y = 4; y < 13; y++) b.set(x, y + (y > 10 && x % 6 === 3 ? 1 : 0), col);
    }
    b.hline(1, 56, 4, PAL.snow[3]);
    board(b, 2, 28, 54, 4, PAL.brown);
    b.rect(4, 32, 50, 13, PAL.brown[1]);
    // Goods: clothes on a rail, records in crates, lamps and vases.
    if (i === 0) for (let x = 8; x < 50; x += 6) b.rect(x, 15, 5, 11, x % 12 === 8 ? goods : PAL.pink[1]);
    if (i === 1) for (let x = 6; x < 52; x += 4) b.rect(x, 22, 3, 6, x % 8 === 6 ? PAL.ink[1] : goods);
    if (i === 2) for (let x = 8; x < 50; x += 9) {
      b.ellipse(x, 18, 6, 10, goods);
      b.set(x + 2, 19, PAL.snow[3]);
    }
    b.hline(5, 52, 15, PAL.steel[2]);
    return feet(b.outline(INK));
  });
}

defineSprite(`${D}stopera`, stopera);
defineSprite(`${D}market-stall`, marketStall);

// =============================================================================================
// Canal water (the m1 approach in the canal colour)
// =============================================================================================

/**
 * Registers `decor/ams/water-<w>x<h>` (4-frame surface line), `…-back` (opaque canal body) and
 * `…-tint` (the body seen through, drawn in front at alpha) once per size; returns the id.
 */
export function waterSprite(w: number, h: number): string {
  const id = `${D}water-${w}x${h}`;
  if (hasSprite(id)) return id;
  const depth = [PAL.teal[1], PAL.teal[0], PAL.navy[1], PAL.navy[0]];
  defineSprite(
    `${id}-back`,
    () => {
      const b = new PixelBuffer(w, h);
      for (let y = 0; y < h; y++) b.rect(0, y, w, 1, depth[Math.min(depth.length - 1, Math.floor(y / 9))]);
      for (let y = 4; y < h; y += 5) for (let x = 0; x < w; x++) if (((x + y * 7) & 31) < 4) b.set(x, y, PAL.teal[2]);
      // Reflected house colours in streaks near the top.
      for (let x = 0; x < w; x++) if (((x * 5) & 31) < 3) b.vline(x, 3, Math.min(h - 1, 9), PAL.rust[0]);
      return b;
    },
    { anchor: 'top-left' },
  );
  defineSprite(
    `${id}-tint`,
    () => {
      const b = new PixelBuffer(w, Math.max(1, h - 2));
      for (let y = 0; y < b.h; y++) b.rect(0, y, w, 1, y < 6 ? PAL.teal[1] : PAL.teal[0]);
      return b;
    },
    { anchor: 'top-left' },
  );
  defineSprite(
    id,
    () =>
      [0, 1, 2, 3].map((f) => {
        const b = new PixelBuffer(w, 3);
        for (let x = 0; x < w; x++) {
          const k = (x + f * 3) & 15;
          b.set(x, 0, k < 4 ? PAL.snow[3] : PAL.teal[2]);
          b.set(x, 1, k >= 8 && k < 11 ? PAL.sky[3] : PAL.teal[1]);
          if (((x * 7 + f * 5) & 31) === 3) b.set(x, 2, PAL.teal[2]);
        }
        return b;
      }),
    { anchor: 'top-left', ticksPerFrame: 8 },
  );
  return id;
}

/** Water decor is cut into pieces this wide (decor is culled by its left edge). */
const WATER_PIECE = 128;

/**
 * Decor for a stretch of canal from x0 to x1 with its surface at y: an opaque body behind the
 * actors and a see-through front layer with the animated surface line.
 */
export function waterDecor(x0: number, x1: number, y = WATER_Y, h = 216 - WATER_Y, back = true): DecorDef[] {
  const out: DecorDef[] = [];
  for (let x = x0; x < x1; x += WATER_PIECE) {
    const w = Math.min(WATER_PIECE, x1 - x);
    const id = waterSprite(w, h);
    if (back) out.push({ sprite: `${id}-back`, x, y });
    out.push({ sprite: `${id}-tint`, x, y: y + 2, front: true, alpha: 0.45 });
    out.push({ sprite: id, x, y, front: true, animate: 8 });
  }
  return out;
}

/** House sprite id for a light. */
export function houseId(light: Light): string {
  return `${D}house-${light}`;
}

/** All fixed decor sprite ids (the dynamic ones are registered by their helper functions). */
export const AMS_DECOR_IDS: readonly string[] = [
  ...LIGHTS.flatMap((l) => [`${D}house-${l}`, `${D}fabel-friet-${l}`, `${D}neighbour-${l}`]),
  `${D}fabel-sign`, `${D}fabel-counter`, `${D}hotdog-stand`, `${D}hotdog-front`, `${D}flag-red`, `${D}cabinet`, `${D}lamp-grey`,
  `${D}lamp`, `${D}bollard`, `${D}bike`, `${D}bike-rack`, `${D}bench`, `${D}elm`, `${D}tulips`, `${D}flag-ams`, `${D}flag-nl`,
  `${D}smoke`, `${D}drawbridge`, `${D}white-bridge`, `${D}white-portal`, `${D}blauwbrug-lamp`, `${D}rijksmuseum`,
  `${D}stopera`, `${D}market-stall`,
];

// =============================================================================================
// Layout helpers for the section files
// =============================================================================================

/** A row of near canal houses from x0 (feet on y), frames from `HOUSE_VARIANTS`; returns the decor. */
export function houseRow(light: Light, x0: number, frames: readonly number[], y = G): DecorDef[] {
  const out: DecorDef[] = [];
  let x = x0;
  for (const f of frames) {
    const w = houseWidth(f);
    out.push({ sprite: houseId(light), frame: f, x: x + (w >> 1) + 1, y });
    x += w;
  }
  return out;
}

/** Total facade width of a house row. */
export function rowWidth(frames: readonly number[]): number {
  let w = 0;
  for (const f of frames) w += houseWidth(f);
  return w;
}

/** Houseboat decor (hull, cabin, smoke from the stove pipe) for hulls with a deck at roofY + deck. */
export function boatDecor(boats: readonly { x0: number; w: number; cx: number; cw: number; colour: number }[], roofY: number, deck: number): DecorDef[] {
  const out: DecorDef[] = [];
  for (const b of boats) {
    out.push({ sprite: houseboatSprite(b.w, deck, b.cx - b.x0, b.cw, b.colour), x: b.x0, y: roofY });
    out.push({ sprite: `${D}smoke`, x: b.cx + b.cw - 7, y: roofY - 6, animate: true, frame: b.colour });
  }
  return out;
}

/** A canal bridge over a ground hill: the railing with bikes behind, the brick arch face in front. */
export function bridgeDecor(x0: number, len: number, h: number, y = G): DecorDef[] {
  return [
    { sprite: bridgeRailSprite(len, h), x: x0, y },
    { sprite: bridgeFaceSprite(len, h), x: x0, y, front: true },
  ];
}
