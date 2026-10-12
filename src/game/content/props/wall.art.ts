/**
 * `breakable-wall` art: a wall or door of any size in five looks, four damage stages and its
 * remains. Sizes come from spawn params, so the strips are registered on demand
 * (`wallSprites(look, w, h)`); art.ts registers the default 24×48 of every look.
 *
 * - `prop/breakable-wall/<look>-<w>x<h>`        4 frames: intact (a faint hairline), cracked,
 *   badly cracked, about to give — feet anchor (bottom centre)
 * - `…-rubble`  the pile left on the floor (an open passage)
 * - `…-niche`   a dark opening with the pile (a secret wall drawn behind the actors)
 */
import type { Color } from '../../../engine/color';
import { PixelBuffer } from '../../../engine/pixel';
import { INK, PAL } from '../../../engine/palette';
import type { Frame } from '../../../engine/render';
import { defineSprite, hasSprite } from '../../../engine/sprites';
import { hash2 } from '../../art/paint';

export const WALL_LOOKS = ['brick', 'door', 'rock', 'crystal', 'panel'] as const;
export type WallLook = (typeof WALL_LOOKS)[number];

/** Base colour, light and dark tones and the crack colour of each look. */
interface LookColors {
  readonly base: Color;
  readonly light: Color;
  readonly dark: Color;
  readonly deep: Color;
}

const COLORS: Readonly<Record<WallLook, LookColors>> = {
  brick: { base: PAL.rust[2], light: PAL.brown[3], dark: PAL.rust[1], deep: PAL.brown[0] },
  door: { base: PAL.brown[2], light: PAL.brown[3], dark: PAL.brown[1], deep: PAL.brown[0] },
  rock: { base: PAL.sand[1], light: PAL.sand[2], dark: PAL.sand[0], deep: PAL.brown[0] },
  crystal: { base: PAL.purple[2], light: PAL.sky[3], dark: PAL.purple[1], deep: PAL.purple[0] },
  panel: { base: PAL.brown[1], light: PAL.brown[2], dark: PAL.brown[0], deep: PAL.ink[1] },
};

// ------------------------------------------------------------------------------------ surfaces

/** Brick courses 8×4 with stone mortar, each brick lit on top, a few darker ones. */
function bricks(b: PixelBuffer, w: number, h: number): void {
  b.rect(1, 1, w, h, PAL.stone[2]);
  for (let row = 0; row * 4 < h; row++) {
    const y = 1 + row * 4;
    const off = row % 2 === 0 ? 0 : -4;
    for (let x = 1 + off; x < w + 1; x += 8) {
      const x0 = Math.max(1, x);
      const x1 = Math.min(w, x + 6);
      if (x1 < x0) continue;
      const v = hash2(x, row, 7);
      const base = v < 0.18 ? PAL.red[1] : v > 0.85 ? PAL.brown[2] : PAL.rust[2];
      b.rect(x0, y, x1 - x0 + 1, Math.min(3, h + 1 - y), base);
      b.hline(x0, x1, y, v > 0.85 ? PAL.brown[3] : PAL.rust[3]);
      if (y + 2 <= h) b.hline(x0 + 1, x1, y + 2, PAL.rust[1]);
    }
  }
}

/** A plank door in a frame: brace, iron hinges, a brass handle and a little window. */
function door(b: PixelBuffer, w: number, h: number): void {
  b.rect(1, 1, w, h, PAL.brown[1]);
  b.rect(3, 3, w - 4, h - 2, PAL.brown[2]);
  for (let x = 3 + 5; x < w - 1; x += 5) b.vline(x, 3, h, PAL.brown[1]);
  b.vline(3, 3, h, PAL.brown[3]);
  b.hline(3, w - 2, 3, PAL.brown[3]);
  // Z brace.
  const yA = Math.round(h * 0.38);
  const yB = Math.round(h * 0.78);
  b.rect(3, yA, w - 4, 2, PAL.brown[3]);
  b.hline(3, w - 2, yA + 2, PAL.brown[0]);
  b.rect(3, yB, w - 4, 2, PAL.brown[3]);
  b.hline(3, w - 2, yB + 2, PAL.brown[0]);
  for (let k = 0; k <= yB - yA - 2; k++) {
    const x = 4 + Math.round(((w - 7) * k) / Math.max(1, yB - yA - 2));
    b.set(x, yB - 1 - k, PAL.brown[3]);
    b.set(x + 1, yB - 1 - k, PAL.brown[0]);
  }
  // Hinges, handle, window.
  for (const y of [yA, yB]) {
    b.rect(3, y, 5, 2, PAL.steel[1]);
    b.set(3, y, PAL.steel[3]);
  }
  b.rect(w - 4, Math.round(h * 0.56), 2, 2, PAL.gold[2]);
  b.set(w - 4, Math.round(h * 0.56), PAL.gold[3]);
  if (h >= 28 && w >= 14) {
    const ww = Math.max(4, Math.round(w * 0.36));
    const wx = Math.round((w + 2 - ww) / 2);
    b.rect(wx, 7, ww, 6, PAL.navy[1]);
    b.hline(wx, wx + ww - 1, 7, PAL.sky[1]);
    b.vline(wx + (ww >> 1), 7, 12, PAL.brown[1]);
  }
}

/** Quarry sandstone: strata bands, lit ledges, pebbles. */
function rock(b: PixelBuffer, w: number, h: number): void {
  for (let y = 1; y <= h; y++) {
    const band = Math.floor((y + hash2(0, Math.floor(y / 5), 3) * 3) / 5);
    const c = band % 3 === 0 ? PAL.sand[2] : band % 3 === 1 ? PAL.sand[1] : PAL.orange[0];
    b.hline(1, w, y, c);
  }
  for (let k = 0; k < (w * h) / 40; k++) {
    const x = 2 + Math.floor(hash2(k, 1, 11) * (w - 3));
    const y = 2 + Math.floor(hash2(k, 2, 11) * (h - 3));
    b.rect(x, y, 2, 1, PAL.sand[0]);
    b.set(x, y - 1, PAL.sand[3]);
  }
  for (let y = 5; y < h; y += 5) {
    for (let x = 1; x <= w; x++) if (hash2(x, y, 5) < 0.55) b.set(x, y, PAL.rust[1]);
  }
}

/** Blue-violet crystal: big faceted shards, each lit on its upper-left face. */
function crystal(b: PixelBuffer, w: number, h: number): void {
  b.rect(1, 1, w, h, PAL.purple[1]);
  const n = Math.max(3, Math.round((w * h) / 140));
  for (let k = 0; k < n; k++) {
    const cx = 1 + hash2(k, 1, 21) * w;
    const cy = 1 + hash2(k, 2, 21) * h;
    const r = 4 + hash2(k, 3, 21) * 6;
    const pts: Array<[number, number]> = [
      [cx, cy - r * 1.4],
      [cx + r * 0.7, cy],
      [cx, cy + r * 1.1],
      [cx - r * 0.7, cy],
    ];
    b.poly(pts, PAL.purple[2]);
    b.poly(
      [
        [cx, cy - r * 1.4],
        [cx - r * 0.7, cy],
        [cx, cy],
      ],
      PAL.sky[2],
    );
    b.line(Math.round(cx), Math.round(cy - r * 1.4), Math.round(cx), Math.round(cy + r * 1.1), PAL.purple[0]);
    b.set(Math.round(cx - 1), Math.round(cy - r * 0.8), PAL.snow[3]);
  }
  // Clip the shards to the wall.
  for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) if (x < 1 || y < 1 || x > w || y > h) b.set(x, y, 0);
}

/** Organ panel: walnut with a gold frame, a carved diamond and brass studs. */
function panel(b: PixelBuffer, w: number, h: number): void {
  b.rect(1, 1, w, h, PAL.brown[1]);
  b.strokeRect(2, 2, w - 2, h - 2, PAL.gold[1]);
  b.hline(2, w - 1, 2, PAL.gold[2]);
  b.vline(2, 2, h - 1, PAL.gold[2]);
  b.rect(4, 4, w - 6, h - 6, PAL.brown[2]);
  b.hline(4, w - 3, 4, PAL.brown[3]);
  const cx = (w + 2) / 2;
  const cy = (h + 2) / 2;
  const rx = Math.max(2, (w - 10) / 2);
  const ry = Math.max(3, (h - 14) / 2);
  b.poly(
    [
      [cx, cy - ry],
      [cx + rx, cy],
      [cx, cy + ry],
      [cx - rx, cy],
    ],
    PAL.brown[0],
  );
  b.poly(
    [
      [cx, cy - ry + 2],
      [cx + rx - 2, cy],
      [cx, cy + ry - 2],
      [cx - rx + 2, cy],
    ],
    PAL.brown[1],
  );
  for (const [x, y] of [
    [4, 4],
    [w - 3, 4],
    [4, h - 3],
    [w - 3, h - 3],
  ] as const)
    b.set(x, y, PAL.gold[3]);
}

const SURFACE: Readonly<Record<WallLook, (b: PixelBuffer, w: number, h: number) => void>> = { brick: bricks, door, rock, crystal, panel };

// ------------------------------------------------------------------------------------ damage

/**
 * Cracks for a stage (1–3) plus chipped edges at 2+ and missing chunks at 3, all from fixed
 * seeds so the stages build on each other. Stage 0 has one faint hairline (the hint).
 */
function cracks(b: PixelBuffer, w: number, h: number, look: WallLook, stage: number): void {
  const c = COLORS[look];
  const n = stage === 0 ? 1 : stage + 1;
  for (let k = 0; k < n; k++) {
    let x = 1 + Math.round(w * (0.3 + 0.4 * hash2(k, 1, 41)));
    let y = 1 + Math.round(h * (k === 0 ? 0.08 : 0.15 + 0.6 * hash2(k, 2, 41)));
    const len = stage === 0 ? Math.round(h * 0.18) : Math.round(h * (0.25 + 0.12 * stage));
    for (let i = 0; i < len && y <= h; i++) {
      if (x >= 1 && x <= w) {
        b.set(x, y, stage === 0 ? c.dark : c.deep);
        if (stage > 0 && x - 1 >= 1) b.set(x - 1, y, c.light);
      }
      y++;
      const r = hash2(k, i, 43);
      if (r < 0.3) x--;
      else if (r > 0.7) x++;
      // Branches on the badly cracked stages.
      if (stage >= 2 && i === Math.round(len / 2)) {
        let bx = x;
        for (let j = 0; j < len / 3; j++) {
          bx += k % 2 === 0 ? 1 : -1;
          if (bx >= 1 && bx <= w && y + j <= h) b.set(bx, y + j, c.deep);
        }
      }
    }
  }
  if (stage >= 2) {
    // Chipped corners.
    for (let k = 0; k < stage * 2; k++) {
      const left = hash2(k, 5, 47) < 0.5;
      const y = 2 + Math.floor(hash2(k, 6, 47) * (h - 4));
      const x = left ? 1 : w;
      b.set(x, y, 0);
      b.set(x, y + 1, 0);
      b.set(left ? x + 1 : x - 1, y, c.deep);
    }
  }
  if (stage >= 3) {
    // Chunks knocked out: dark holes with a lit lower lip.
    for (let k = 0; k < 2 + Math.floor((w * h) / 400); k++) {
      const x = 2 + Math.floor(hash2(k, 8, 53) * (w - 5));
      const y = 2 + Math.floor(hash2(k, 9, 53) * (h - 5));
      b.rect(x, y, 3, 2, c.deep);
      b.hline(x, x + 2, y + 2, c.light);
    }
  }
}

// ------------------------------------------------------------------------------------ frames

function wallFrame(look: WallLook, w: number, h: number, stage: number): Frame {
  const b = new PixelBuffer(w + 2, h + 2);
  SURFACE[look](b, w, h);
  cracks(b, w, h, look, stage);
  b.outline(INK);
  return { buf: b, ox: (w + 2) >> 1, oy: h + 1 };
}

/** The pile of chunks left on the floor (w + 8 wide). */
function rubblePile(look: WallLook, w: number, b: PixelBuffer, baseY: number, x0: number): void {
  const c = COLORS[look];
  const n = Math.max(4, Math.round(w / 3));
  for (let k = 0; k < n; k++) {
    const x = x0 + Math.floor(hash2(k, 1, 61) * (w + 4));
    const s = 2 + Math.floor(hash2(k, 2, 61) * 3);
    const y = baseY - s - Math.floor(hash2(k, 3, 61) * 3);
    b.rect(x, y, s + 1, s, c.base);
    b.hline(x, x + s, y, c.light);
    b.vline(x + s, y + 1, y + s - 1, c.dark);
  }
}

function rubbleFrame(look: WallLook, w: number): Frame {
  const W = w + 10;
  const b = new PixelBuffer(W, 12);
  rubblePile(look, w, b, 11, 3);
  b.outline(INK);
  return { buf: b, ox: W >> 1, oy: 12 };
}

/** A dark opening where the wall was (its frame lit on the lower right), the pile in front. */
function nicheFrame(look: WallLook, w: number, h: number): Frame {
  const c = COLORS[look];
  const W = w + 10;
  const b = new PixelBuffer(W, h + 2);
  const x0 = 5;
  b.rect(x0, 1, w, h, PAL.ink[1]);
  b.rect(x0 + 2, 3, w - 4, h - 3, PAL.navy[0]);
  b.vline(x0 + w - 1, 1, h, c.dark);
  b.hline(x0, x0 + w - 1, 1, c.dark);
  rubblePile(look, w, b, h + 1, 3);
  b.outline(INK);
  return { buf: b, ox: W >> 1, oy: h + 1 };
}

/**
 * The strips of a wall look at a size, registered on first use. Returns their ids:
 * `wall` (4 stages), `rubble` (passage) and `niche` (secret opening).
 */
export function wallSprites(look: WallLook, w: number, h: number): { wall: string; rubble: string; niche: string } {
  const base = `prop/breakable-wall/${look}-${w}x${h}`;
  const ids = { wall: base, rubble: `${base}-rubble`, niche: `${base}-niche` };
  if (!hasSprite(base)) {
    defineSprite(base, () => [0, 1, 2, 3].map((s) => wallFrame(look, w, h, s)), { loop: false });
    defineSprite(ids.rubble, () => rubbleFrame(look, w));
    defineSprite(ids.niche, () => nicheFrame(look, w, h));
  }
  return ids;
}

/** The default size (24×48) of every look. */
export function defineWallSprites(): void {
  for (const look of WALL_LOOKS) wallSprites(look, 24, 48);
}
