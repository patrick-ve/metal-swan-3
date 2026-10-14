/**
 * 2× art of the fx sprites that mission ams shows (docs/ART_GUIDE.md "2x art (mission ams)"):
 * fx/impact, fx/hit (+ fx/hit-spark), fx/dust, fx/splash, fx/debris-<dirt|metal|plant|wood>,
 * fx/poof, fx/confetti, fx/confetti-bit and fx/music-note. The explosions have their 2× twin in
 * explosion.art.ts, the muzzle flashes in weapons/art.ts and weapons/shots.art.ts.
 *
 * Every frame keeps the 1× frame's logical size and anchor (taken from the 1× frame with
 * `asHi`), is palette-only and crisp, lit from the top-left; an outline is 2 × 2× px (the 1×
 * weight) where the 1× art has one. Procedural 1× recipes are redrawn on the 2× grid (same
 * shapes, finer edges); dither stays on whole logical pixels.
 */
import { ascii } from '../../../engine/ascii';
import type { Color } from '../../../engine/color';
import { PixelBuffer } from '../../../engine/pixel';
import { INK, PAL, stepShade } from '../../../engine/palette';
import type { Frame } from '../../../engine/render';
import { defineHiSprite, getFrames } from '../../../engine/sprites';
import { asHi, HI, HiPen, outlineHi, turnFrame } from '../../art/hi';
import { bayer, hash2 } from '../../art/paint';
import { CONFETTI_COLORS } from './gags.art';

/** A 2× buffer for 1× frame `i` of `id`. */
function blank(id: string, i: number): PixelBuffer {
  const f = getFrames(id, 1)[i];
  return new PixelBuffer(f.buf.w * HI, f.buf.h * HI);
}

/** The 2× strip of `id` from one painter per frame (anchors from the 1× frames). */
function strip(id: string, paint: (b: PixelBuffer, i: number) => PixelBuffer): Frame[] {
  return getFrames(id, 1).map((f1, i) => asHi(paint(blank(id, i), i), f1));
}

/** Logical manhattan distance of 2× px (x, y) from the centre of logical pixel (cx, cy). */
function diamond(x: number, y: number, cx: number, cy: number): number {
  return (Math.abs((x + 0.5) / HI - cx - 0.5) + Math.abs((y + 0.5) / HI - cy - 0.5));
}

/** A 2 × 2 clod (one logical px) with a lit top-left 2× px. */
function clod(b: PixelBuffer, lx: number, ly: number, c: Color, lit: Color | null): void {
  b.rect(lx * HI, ly * HI, HI, HI, c);
  if (lit !== null) b.set(lx * HI, ly * HI, lit);
}

// ------------------------------------------------------------------------------------ impact

/** The 1× dirt cells of fx/impact (unpadded rows; the frame adds a 1-px margin). */
const IMPACT_DIRT: readonly (readonly string[])[] = [
  [],
  ['.d...d.', '..d.d..', '.d...d.', 'd.d.d.d', '..d.d..'],
  ['d.....d', '.d...d.', '...d...', '.d.d.d.', 'd.....d'],
  ['.......', 'd.....d', '.......', '..d.d..', '.......'],
];

/** A bullet hits the ground: a hot diamond with a finer core, then clods flying out (4 frames). */
function impactHi(): Frame[] {
  const F = PAL.fire;
  return strip('fx/impact', (b, i) => {
    // Hot core: logical radii of the white, yellow and orange bands (frame 0 the big flash).
    const core = i === 0 ? [2.5, 1.5, 0.5] : i === 1 ? [0, 1.0, 0.5] : null;
    if (core) {
      for (let y = 0; y < b.h; y++) {
        for (let x = 0; x < b.w; x++) {
          const d = diamond(x, y, 4, 3);
          if (d <= core[2]) b.set(x, y, F[3]);
          else if (d <= core[1]) b.set(x, y, F[5]);
          else if (d <= core[0]) b.set(x, y, F[6]);
        }
      }
      // The lower arm of frame 1 cools first (the 1× 'O' below the core).
      if (i === 1) b.rect(8, 8, 2, 2, F[3]);
    }
    IMPACT_DIRT[i].forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        if (row[x] !== 'd') continue;
        // Clods near the core still glow on frame 1; the rest are lit earth.
        clod(b, x + 1, y + 1, PAL.brown[2], i < 3 ? PAL.brown[3] : null);
      }
    });
    return b;
  });
}

// ------------------------------------------------------------------------------------ hit

/** The 1× rows of fx/hit (unpadded; the frame adds a 1-px margin). */
const HIT_ROWS: readonly (readonly string[])[] = [
  ['..W....W', '...W..W.', 'WWWYYW..', '...YW...', '..W..W..', '.W....W.'],
  ['.......Y', '..Y..Y..', '.YYOO...', '...OY...', '..Y..Y..', '........'],
  ['........', '...O....', '..O.O...', '...O....', '........', '........'],
];

/**
 * A splintered star pointing back at the shooter (3 frames): the 1× rays at 2×, each ray end
 * sharpened to a 2-px splinter along its direction, a white-hot glint on the core.
 */
function hitHi(): Frame[] {
  const key: Readonly<Record<string, Color>> = { W: PAL.fire[6], Y: PAL.fire[5], O: PAL.fire[3] };
  return strip('fx/hit', (b, i) => {
    const rows = HIT_ROWS[i];
    const at = (x: number, y: number): boolean => y >= 0 && y < rows.length && x >= 0 && x < rows[y].length && rows[y][x] !== '.';
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        if (row[x] === '.') continue;
        const c = key[row[x]];
        const X = (x + 1) * HI;
        const Y = (y + 1) * HI;
        // A ray end has exactly one neighbour: keep the two 2× px along the ray.
        const nb: Array<[number, number]> = [];
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && at(x + dx, y + dy)) nb.push([dx, dy]);
        if (nb.length === 1 && i < 2) {
          const [dx, dy] = nb[0];
          if (dx !== 0 && dy !== 0) {
            // Diagonal: the pixel pair on the ray's diagonal.
            const main = dx === dy;
            b.set(X + (main ? 0 : 1), Y, c);
            b.set(X + (main ? 1 : 0), Y + 1, c);
          } else if (dy === 0) b.hline(X, X + 1, Y, c);
          else b.vline(X, Y, Y + 1, c);
        } else b.rect(X, Y, HI, HI, c);
      }
    });
    // A white-hot glint on the first core cell (top-left lit).
    const core = rows.findIndex((r) => r.includes(i === 0 ? 'Y' : 'O'));
    if (core >= 0 && i < 2) {
      const x = rows[core].indexOf(i === 0 ? 'Y' : 'O');
      b.set((x + 1) * HI, (core + 1) * HI, i === 0 ? PAL.snow[3] : PAL.fire[5]);
    }
    return b;
  });
}

// ------------------------------------------------------------------------------------ dust

/** Dust at the feet: two puffs spreading sideways, a shaded rim, fraying on logical cells. */
function dustHi(): Frame[] {
  return strip('fx/dust', (b, i) => {
    const p = new HiPen(b, 0, 0);
    const spread = 3 + i * 3;
    const r = [2, 3, 3, 2][i];
    for (const s of [-1, 1]) {
      const cx = 12 + s * spread;
      // A darker rim lower right (one 2× px), the body, the lit lump upper left.
      p.circle(cx, 5, r, PAL.sand[1]);
      b.ellipse(p.X(cx - r) - 1, p.Y(5 - r) - 1, (2 * r + 1) * HI, (2 * r + 1) * HI, PAL.sand[2]);
      if (r > 1) p.circle(cx - 1, 4, r - 1, PAL.sand[3]);
    }
    if (i >= 2) {
      for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) if (bayer(x >> 1, y >> 1) < (i - 1) * 0.35) b.set(x, y, 0);
    }
    return b;
  });
}

// ------------------------------------------------------------------------------------ splash

/** Water splash: a tapering column with a lit side, side arcs, droplets, a surface ring (5 frames). */
function splashHi(): Frame[] {
  const H = 22;
  return strip('fx/splash', (b, i) => {
    const t = i / 4;
    const hgt = Math.round(Math.sin(Math.min(1, t * 1.6) * Math.PI) * 12) + 2;
    const spread = 3 + Math.round(t * 7);
    const drops: Array<[number, number]> = [];
    // Central column, per 2× row: the taper is smooth, the left 2× column catches the light.
    for (let kk = 0; kk < hgt * HI; kk++) {
      const k = kk / HI;
      const y = (H - 2) * HI - 1 - kk;
      const hw = Math.max(1, Math.round((2 - k / 6) * HI));
      const top = k >= hgt - 2;
      for (let x = 13 * HI - hw; x < 13 * HI + hw; x++) b.set(x, y, top ? PAL.snow[3] : x === 13 * HI - hw ? PAL.sky[3] : PAL.sky[2]);
      if (!top && hw > 1) b.set(13 * HI + hw - 1, y, PAL.sky[1]);
    }
    for (const s of [-1, 1]) {
      const n = Math.round(hgt * 0.6);
      for (let kk = 0; kk < n * HI; kk++) {
        const k = kk / HI;
        const x = Math.round((13 + s * (spread - k * 0.3)) * HI);
        const y = (H - 2) * HI - 1 - kk;
        const foam = Math.floor(k) % 3 === 0;
        b.set(x, y, foam ? PAL.snow[3] : PAL.sky[1]);
        b.set(x + 1, y, foam ? PAL.snow[2] : PAL.sky[2]);
      }
      drops.push([(13 + s * (spread + 3)) * HI, (H - 4 - Math.round(hgt * 0.7)) * HI]);
    }
    // Ring on the surface: lit top row, darker under it.
    const x0 = (13 - spread - 2) * HI;
    const x1 = (13 + spread + 2) * HI - 1;
    b.hline(x0, x1, (H - 2) * HI, PAL.sky[3]);
    b.hline(x0 + 1, x1 - 1, (H - 2) * HI + 1, PAL.sky[2]);
    outlineHi(b, 2, PAL.navy[1]);
    // Droplets: a 2 × 2 bead (one logical px) with a white glint, in a small navy diamond that
    // keeps the 1× footprint (the 1× plus-shaped outline), not a square ring.
    for (const [dx, dy] of drops) {
      for (let y = dy - 2; y < dy + 4; y++) {
        for (let x = dx - 2; x < dx + 4; x++) {
          if (Math.abs(x - dx - 0.5) + Math.abs(y - dy - 0.5) <= 3 && (b.get(x, y) & 255) === 0) b.set(x, y, PAL.navy[1]);
        }
      }
      b.rect(dx, dy, HI, HI, PAL.snow[2]);
      b.set(dx, dy, PAL.snow[3]);
    }
    return b;
  });
}

// ------------------------------------------------------------------------------------ debris

/** Hand-drawn 2× chunks (twice the 1× bitmap, unrotated, unpadded). */
const DEBRIS_HI: Readonly<Record<string, { rows: readonly string[]; key: Readonly<Record<string, Color>> }>> = {
  metal: {
    rows: ['...443....', '..443322..', '.44332222.', '4433222111', '..32221111', '..2221111.', '....1111..', '.....11...'],
    key: { '1': PAL.steel[1], '2': PAL.steel[2], '3': PAL.steel[3], '4': PAL.steel[4] },
  },
  wood: {
    rows: ['ttTTTTTTTTTT..', 'TTTTTvvTTTTT..', '..wwwwwwwwwwww', '..wwwvvwwwwvww'],
    key: { t: PAL.brown[3], T: PAL.brown[2], w: PAL.brown[1], v: PAL.brown[0] },
  },
  dirt: {
    rows: ['..22..', '..32..', '232211', '221111', '..11..', '..1...'],
    key: { '1': PAL.brown[1], '2': PAL.brown[2], '3': PAL.brown[3] },
  },
  plant: {
    rows: ['......3.', '....333.', '...3332.', '..33322.', '.22221..', '22221...', '1211....', '11......'],
    key: { '1': PAL.green[1], '2': PAL.green[2], '3': PAL.green[3] },
  },
};

/** Tumbling chunks: the 2× bitmap turned a quarter per frame, then outlined (4 frames). */
function debrisHi(kind: string): Frame[] {
  const d = DEBRIS_HI[kind];
  const base = ascii(d.rows, d.key);
  return getFrames(`fx/debris-${kind}`, 1).map((f1, q) => {
    const b = turnFrame({ buf: base, ox: 0, oy: 0 }, -q).buf.padded(HI);
    return asHi(outlineHi(b, 2), f1);
  });
}

// ------------------------------------------------------------------------------------ poof

/** The cartoon POOF: a white star, then five puffs pushed out in a ring that fray (6 frames). */
function poofHi(): Frame[] {
  const ramp: readonly Color[] = [PAL.snow[0], PAL.snow[1], PAL.snow[2], PAL.snow[3]];
  const c = 12;
  return strip('fx/poof', (b, i) => {
    const p = new HiPen(b, 0, 0);
    if (i === 0) {
      p.circle(c, c, 3, PAL.snow[3]);
      // Arms one logical px wide, with a fine 2× tip.
      p.hline(c - 5, c + 5, c, PAL.snow[3]).vline(c, c - 5, c + 5, PAL.snow[3]);
      p.dot(c - 6 + 0.5, c, PAL.snow[3]).dot(c - 6 + 0.5, c + 0.5, PAL.snow[3]);
      p.dot(c + 6, c, PAL.snow[3]).dot(c + 6, c + 0.5, PAL.snow[3]);
      p.dot(c, c - 6 + 0.5, PAL.snow[3]).dot(c + 0.5, c - 6 + 0.5, PAL.snow[3]);
      p.dot(c, c + 6, PAL.snow[3]).dot(c + 0.5, c + 6, PAL.snow[3]);
      for (const [dx, dy] of [[-4, -4], [4, 4], [4, -4], [-4, 4]]) p.px(c + dx, c + dy, PAL.snow[2]);
      // A grey shade low right on the disc.
      p.dot(c + 2, c + 2.5, PAL.snow[1]).dot(c + 2.5, c + 2, PAL.snow[1]).dot(c + 2.5, c + 2.5, PAL.snow[1]);
      return outlineHi(b, 2, PAL.steel[3]);
    }
    if (i >= 4) {
      // The last puffs are tiny sparkle specks: the 1× specks and their plus-shaped outline on
      // whole logical pixels (a 2× outline would turn each into a ring), each fill pixel with a
      // white 2× glint top-left.
      const lo = getFrames('fx/poof', 1)[i].buf;
      for (let y = 0; y < lo.h; y++) {
        for (let x = 0; x < lo.w; x++) {
          const col = lo.get(x, y);
          if ((col & 255) === 0) continue;
          b.rect(x * HI, y * HI, HI, HI, col);
          if (col !== PAL.steel[3]) b.set(x * HI, y * HI, PAL.snow[3]);
        }
      }
      return b;
    }
    const t = (i - 1) / 4;
    const ringR = 3 + t * 6;
    const puffR = 3.6 - t * 1.2;
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2 - Math.PI / 2 + 0.3;
      const px = c + Math.cos(a) * ringR;
      const py = c + Math.sin(a) * ringR - t * 2;
      for (let y = Math.floor((py - puffR) * HI); y <= Math.ceil((py + puffR) * HI); y++) {
        for (let x = Math.floor((px - puffR) * HI); x <= Math.ceil((px + puffR) * HI); x++) {
          const lx = (x + 0.5) / HI;
          const ly = (y + 0.5) / HI;
          const d = Math.hypot(lx - px, ly - py) / puffR;
          if (d > 1) continue;
          const bd = bayer(Math.floor(lx), Math.floor(ly));
          if (t > 0.3 && 1 - d < (t - 0.3) * 1.6 - bd * 0.5) continue;
          const lit = -((lx - px) + (ly - py)) / puffR;
          const v = Math.floor(2 + lit * 1.2 - d * 0.8 + (bd - 0.5) * 0.6);
          if (x >= 0 && y >= 0 && x < b.w && y < b.h) b.set(x, y, ramp[Math.max(0, Math.min(3, v))]);
        }
      }
    }
    return outlineHi(b, 2, PAL.steel[3]);
  });
}

// ------------------------------------------------------------------------------------ confetti

/** One confetti bit at logical (x, y): flat (2 × 1), upright (1 × 2) or tilted, with a shaded side. */
function bit(b: PixelBuffer, x: number, y: number, col: Color, how: number): void {
  const X = x * HI;
  const Y = y * HI;
  const dark = stepShade(col, -1);
  if (how === 0) {
    b.hline(X, X + 3, Y, col);
    b.hline(X, X + 3, Y + 1, dark);
  } else if (how === 1) {
    b.vline(X, Y, Y + 3, col);
    b.vline(X + 1, Y, Y + 3, dark);
  } else {
    // Tilted: a 2× stair inside the flat bit's box.
    b.set(X, Y + 1, col);
    b.set(X + 1, Y + 1, col);
    b.set(X + 1, Y, col);
    b.set(X + 2, Y, col);
    b.set(X + 2, Y + 1, dark);
    b.set(X + 3, Y, dark);
  }
}

/** A confetti pop: a gold star, then bits flying out and starting to fall (6 frames). */
function confettiHi(): Frame[] {
  const c = 15;
  return strip('fx/confetti', (b, i) => {
    const p = new HiPen(b, 0, 0);
    if (i === 0) {
      p.hline(c - 3, c + 3, c, PAL.gold[3]).vline(c, c - 3, c + 3, PAL.gold[3]);
      // Tapered tips (half a logical px thick) and a lit centre.
      p.dot(c - 4, c, PAL.gold[3]).dot(c - 4 + 0.5, c, PAL.gold[3]).dot(c + 4, c, PAL.gold[3]).dot(c + 4.5, c, PAL.gold[3]);
      p.dot(c, c - 4, PAL.gold[3]).dot(c, c - 4 + 0.5, PAL.gold[3]).dot(c, c + 4, PAL.gold[3]).dot(c, c + 4.5, PAL.gold[3]);
      p.circle(c, c, 1, PAL.snow[3]);
      p.dot(c + 1, c + 1, PAL.snow[2]).dot(c + 1.5, c + 1, PAL.snow[2]).dot(c + 1, c + 1.5, PAL.snow[2]);
      return b;
    }
    const t = i / 5;
    for (let k = 0; k < 14; k++) {
      const a = (k / 14) * Math.PI * 2 + hash2(k, 1, 7) * 0.4;
      const r = (5 + hash2(k, 2, 7) * 8) * (0.4 + t * 0.8);
      const x = Math.round(c + Math.cos(a) * r);
      const y = Math.round(c + Math.sin(a) * r * 0.8 + t * t * 6);
      const col = CONFETTI_COLORS[k % CONFETTI_COLORS.length];
      if (t > 0.75 && hash2(k, 3, i) > 0.6) continue;
      // Flat, tilted and upright in turn: the bits flutter.
      const flat = (k + i) % 2 === 0;
      bit(b, x, y, col, flat ? ((k + i) % 4 === 0 ? 0 : 2) : 1);
    }
    return b;
  });
}

/** 12 single bits for particles (6 colours × flat / upright), each with a shaded side. */
function confettiBitsHi(): Frame[] {
  return getFrames('fx/confetti-bit', 1).map((f1, i) => {
    const col = CONFETTI_COLORS[i >> 1];
    const b = new PixelBuffer(f1.buf.w * HI, f1.buf.h * HI);
    bit(b, 0, 0, col, i & 1 ? 1 : 0);
    return asHi(b, f1);
  });
}

// ------------------------------------------------------------------------------------ music note

/** The eighth note at 2× (8 × 8 logical, before the 1-px margin): round head, curved flag. */
const NOTE_ROWS = [
  '........Yyy.....',
  '........Yyyy....',
  '........Yy.yy...',
  '........Yy..yy..',
  '........Yy...yg.',
  '........Yy...yg.',
  '........Yy..yg..',
  '........Yy......',
  '........Yy......',
  '........Yy......',
  '....yYYYYy......',
  '..yYYWYYYg......',
  '.yYWWYYYYg......',
  '.yYYYYYYyg......',
  '..yyYYYyg.......',
  '....yggg........',
];

/** A gold eighth note that sways (4 frames): the stem bends smoothly at 2×, outline 2 px. */
function noteHi(): Frame[] {
  const base = ascii(NOTE_ROWS, { Y: PAL.gold[3], y: PAL.gold[2], g: PAL.gold[1], W: PAL.snow[3] });
  return getFrames('fx/music-note', 1).map((f1, i) => {
    const lean = [0, 1, 0, -1][i];
    const b = new PixelBuffer(base.w, base.h);
    for (let y = 0; y < base.h; y++) {
      // The top half shifts one logical px (as at 1×); rows 6–7 take half a step (a smooth bend).
      const dx = y < 6 ? lean * HI : y < 8 ? lean : 0;
      for (let x = 0; x < base.w; x++) {
        const v = base.get(x, y);
        if (v & 255) b.set(x + dx, y, v);
      }
    }
    return asHi(outlineHi(b.padded(HI), 2, INK), f1);
  });
}

// ------------------------------------------------------------------------------------ registry

defineHiSprite('fx/impact', impactHi);
defineHiSprite('fx/hit', hitHi);
defineHiSprite('fx/hit-spark', hitHi);
defineHiSprite('fx/dust', dustHi);
defineHiSprite('fx/splash', splashHi);
for (const kind of Object.keys(DEBRIS_HI)) defineHiSprite(`fx/debris-${kind}`, () => debrisHi(kind));
defineHiSprite('fx/poof', poofHi);
defineHiSprite('fx/confetti', confettiHi);
defineHiSprite('fx/confetti-bit', confettiBitsHi);
defineHiSprite('fx/music-note', noteHi);
