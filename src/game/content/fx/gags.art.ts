/**
 * The comedy fx set of GDD §15.6 (imported by fx/art.ts). All centre-anchored, palette colours
 * only; game-layer helpers in src/game/fx.ts spawn them (`poof`, `confetti`, `musicNotes`,
 * `steamPuff`, `snowPuff`, `iceShatter`, `tinFeathers`, `dizzyStars`, `tumble`, `heliumCloud`,
 * `drawShadow`, `drawAimLine`).
 *
 * | id | frames | what |
 * |---|---|---|
 * | `fx/poof` | 6 | the cartoon POOF: a white flash, then a ring of puffs that frays (erased shots, respawn) |
 * | `fx/confetti` | 6 | a confetti pop (helium pop, kazoo drones); `fx/confetti-bit` 12 static bits for particles |
 * | `fx/music-note` | 4 | a gold eighth note that sways (loop; knife arias, laser kills, the tuba) |
 * | `fx/steam-puff` | 6 | a white steam cloud that swells and frays (vents, kettles, a sighing Swan) |
 * | `fx/helium-cloud` | 4 | the 48×48 pastel pink cloud of a burst helium tank (loop) |
 * | `fx/shadow` | 11 | a ground shadow per width 8, 12 … 48 (drawn see-through; `drawShadow`) |
 * | `fx/aim-line` | 2 | a sniper's crimson target mark (the dotted line itself: `drawAimLine`) |
 * | `fx/stars-dizzy` | 8 | three gold stars circling over a head (loop) |
 * | `fx/flying-shako` | 8 | a Legion shako tumbling through the air (loop) |
 * | `fx/stick-on-moustache` | 8 | a recruit's crooked stick-on moustache flying off (loop) |
 * | `fx/snow-puff` | 5 | snow thrown up |
 * | `fx/ice-cubes` | 4 | ice cubes of a shattered frozen enemy (static frames for particles) |
 *
 * `fx/tin-feather` (GDD §15.6) is drawn by the Swan art (vehicles/swan/art.ts).
 */
import { ascii } from '../../../engine/ascii';
import type { Color } from '../../../engine/color';
import { PixelBuffer } from '../../../engine/pixel';
import { INK, PAL } from '../../../engine/palette';
import type { Frame } from '../../../engine/render';
import { defineSprite } from '../../../engine/sprites';
import { bayer, hash2 } from '../../art/paint';
import { cloudFrames } from './explosion.art';

const center = (buf: PixelBuffer): Frame => ({ buf, ox: buf.w >> 1, oy: buf.h >> 1 });

/** Rotate a small bitmap into `n` frames of a full turn (outline after the turn). */
function tumbleStrip(src: PixelBuffer, n: number, outline: Color = INK): Frame[] {
  const p = src.padded(2);
  return Array.from({ length: n }, (_, i) => center(p.rotated((i / n) * Math.PI * 2).outline(outline).padded(1)));
}

// ------------------------------------------------------------------------------------ poof

/**
 * The cartoon POOF (6 frames): a white star, then five round puffs pushed out in a ring, each
 * shaded from the top-left, fraying away (ordered dither).
 */
function poofFrames(): Frame[] {
  const out: Frame[] = [];
  const size = 25;
  const c = 12;
  const ramp: readonly Color[] = [PAL.snow[0], PAL.snow[1], PAL.snow[2], PAL.snow[3]];
  for (let i = 0; i < 6; i++) {
    const b = new PixelBuffer(size, size);
    if (i === 0) {
      // The flash: a fat white star.
      b.circle(c, c, 3, PAL.snow[3]);
      b.hline(c - 6, c + 6, c, PAL.snow[3]);
      b.vline(c, c - 6, c + 6, PAL.snow[3]);
      b.set(c - 4, c - 4, PAL.snow[2]);
      b.set(c + 4, c + 4, PAL.snow[2]);
      b.set(c + 4, c - 4, PAL.snow[2]);
      b.set(c - 4, c + 4, PAL.snow[2]);
      out.push(center(b.outline(PAL.steel[3])));
      continue;
    }
    const t = (i - 1) / 4;
    const ringR = 3 + t * 6;
    const puffR = 3.6 - t * 1.2;
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2 - Math.PI / 2 + 0.3;
      const px = c + Math.cos(a) * ringR;
      const py = c + Math.sin(a) * ringR - t * 2;
      for (let y = Math.floor(py - puffR); y <= Math.ceil(py + puffR); y++) {
        for (let x = Math.floor(px - puffR); x <= Math.ceil(px + puffR); x++) {
          const d = Math.hypot(x + 0.5 - px, y + 0.5 - py) / puffR;
          if (d > 1) continue;
          if (t > 0.3 && 1 - d < (t - 0.3) * 1.6 - bayer(x, y) * 0.5) continue;
          const lit = -((x + 0.5 - px) + (y + 0.5 - py)) / puffR;
          const v = Math.floor(2 + lit * 1.2 - d * 0.8 + (bayer(x, y) - 0.5) * 0.6);
          b.set(x, y, ramp[Math.max(0, Math.min(3, v))]);
        }
      }
    }
    out.push(center(b.outline(PAL.steel[3])));
  }
  return out;
}

// ------------------------------------------------------------------------------------ confetti

export const CONFETTI_COLORS: readonly Color[] = [PAL.red[3], PAL.gold[3], PAL.sky[2], PAL.pink[2], PAL.green[3], PAL.snow[3]];

/** A confetti pop (6 frames): a gold star, then bits flying out and starting to fall. */
function confettiFrames(): Frame[] {
  const size = 31;
  const c = 15;
  const out: Frame[] = [];
  for (let i = 0; i < 6; i++) {
    const b = new PixelBuffer(size, size);
    if (i === 0) {
      b.hline(c - 4, c + 4, c, PAL.gold[3]);
      b.vline(c, c - 4, c + 4, PAL.gold[3]);
      b.circle(c, c, 1, PAL.snow[3]);
      out.push(center(b));
      continue;
    }
    const t = i / 5;
    for (let k = 0; k < 14; k++) {
      const a = (k / 14) * Math.PI * 2 + hash2(k, 1, 7) * 0.4;
      const r = (5 + hash2(k, 2, 7) * 8) * (0.4 + t * 0.8);
      const x = Math.round(c + Math.cos(a) * r);
      const y = Math.round(c + Math.sin(a) * r * 0.8 + t * t * 6);
      const col = CONFETTI_COLORS[k % CONFETTI_COLORS.length];
      if (t > 0.75 && hash2(k, 3, i) > 0.6) continue;
      if ((k + i) % 2 === 0) b.hline(x, x + 1, y, col);
      else b.vline(x, y, y + 1, col);
    }
    out.push(center(b));
  }
  return out;
}

/** 12 single confetti bits (6 colours × flat / upright), for particles. */
function confettiBits(): Frame[] {
  const out: Frame[] = [];
  for (const col of CONFETTI_COLORS) {
    const h = new PixelBuffer(2, 1);
    h.fill(col);
    out.push({ buf: h, ox: 1, oy: 0 });
    const v = new PixelBuffer(1, 2);
    v.fill(col);
    out.push({ buf: v, ox: 0, oy: 1 });
  }
  return out;
}

// ------------------------------------------------------------------------------------ music note

/**
 * A gold eighth note (4 frames that sway: upright, lean right, upright, lean left), 1 px ink
 * outline. GDD §9.0: notes use gold, snow and ink.
 */
function noteFrames(): Frame[] {
  const rows = [
    '...Yy.', //
    '...Yyy',
    '...Y.y',
    '...Y..',
    '...Y..',
    '.yYY..',
    'yYYy..',
    '.yy...',
  ];
  const key = { Y: PAL.gold[3], y: PAL.gold[2] };
  const base = ascii(rows, key);
  return [0, 1, 0, -1].map((lean) => {
    const b = new PixelBuffer(base.w + 2, base.h);
    // Lean: the top half shifts one pixel.
    for (let y = 0; y < base.h; y++) {
      const dx = y < 4 ? lean : 0;
      for (let x = 0; x < base.w; x++) {
        const v = base.get(x, y);
        if (v & 255) b.set(x + 1 + dx, y, v);
      }
    }
    b.set(2, 6, PAL.snow[3]); // a glint on the note head
    return center(b.padded(1).outline(INK));
  });
}

// ------------------------------------------------------------------------------------ clouds

/** The helium cloud (4 frames, 48×48 with the outline): lumpy pastel pink, churning. */
function heliumFrames(): Frame[] {
  const ramp: readonly Color[] = [PAL.pink[1], PAL.pink[2], PAL.snow[2], PAL.snow[3]];
  const lumps = [
    [0, 4, 13],
    [-11, 6, 9],
    [11, 6, 9],
    [-6, -6, 10],
    [7, -7, 10],
    [0, -12, 8],
    [-15, -2, 6],
    [15, -1, 6],
  ];
  return [0, 1, 2, 3].map((i) => {
    const b = new PixelBuffer(48, 48);
    const ph = (i / 4) * Math.PI * 2;
    for (let y = 0; y < 48; y++) {
      for (let x = 0; x < 48; x++) {
        let hit = -1;
        let q = 0;
        for (let k = 0; k < lumps.length; k++) {
          const [lx, ly, lr] = lumps[k];
          const cx = 24 + lx + Math.cos(ph + k) * 1.2;
          const cy = 25 + ly + Math.sin(ph + k * 1.7) * 1.2;
          const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / lr;
          if (d < 1) {
            hit = k;
            q = d;
          }
        }
        if (hit < 0) continue;
        const [lx, ly, lr] = lumps[hit];
        const cx = 24 + lx;
        const cy = 25 + ly;
        const lit = -((x + 0.5 - cx) + (y + 0.5 - cy)) / lr;
        const v = Math.floor(1.3 + lit * 1.3 + (1 - q) * 0.6 + (bayer(x, y) - 0.5) * 0.7);
        b.set(x, y, ramp[Math.max(0, Math.min(3, v))]);
      }
    }
    // A few sparkles of gas.
    for (let k = 0; k < 4; k++) {
      const sx = Math.round(10 + hash2(k, i, 3) * 28);
      const sy = Math.round(12 + hash2(k, i, 5) * 24);
      if (b.get(sx, sy) & 255) b.set(sx, sy, PAL.snow[3]);
    }
    return center(b.outline(PAL.pink[0]));
  });
}

// ------------------------------------------------------------------------------------ shadow, aim mark

/** Ground shadows: one flat ellipse per width 8, 12 … 48. */
export const SHADOW_WIDTHS: readonly number[] = [8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48];

function shadowFrames(): Frame[] {
  return SHADOW_WIDTHS.map((w) => {
    const h = Math.max(2, Math.round(w / 4));
    const b = new PixelBuffer(w, h);
    b.ellipse(0, 0, w, h, PAL.ink[1]);
    return center(b);
  });
}

/** The sniper's target mark (2 frames): a crimson ring with a dot that pulses. */
function aimMarkFrames(): Frame[] {
  return [0, 1].map((i) => {
    const b = new PixelBuffer(9, 9);
    b.circle(4, 4, 3 - i, PAL.red[3], false);
    b.set(4, 4, PAL.red[3]);
    b.set(4, 0, PAL.red[3]);
    b.set(4, 8, PAL.red[3]);
    b.set(0, 4, PAL.red[3]);
    b.set(8, 4, PAL.red[3]);
    return center(b);
  });
}

// ------------------------------------------------------------------------------------ dizzy stars

/** Three gold stars circling on a flat ellipse (8 frames; the back ones smaller and darker). */
function dizzyFrames(): Frame[] {
  const big = ascii(['..Y..', '.YYY.', 'YYWYY', '.YYY.', '.Y.Y.'], { Y: PAL.gold[3], W: PAL.snow[3] });
  const small = ascii(['.y.', 'yyy', '.y.'], { y: PAL.gold[1] });
  return Array.from({ length: 8 }, (_, i) => {
    const b = new PixelBuffer(28, 12);
    const items: Array<{ x: number; y: number; back: boolean }> = [];
    for (let k = 0; k < 3; k++) {
      const a = (i / 8 + k / 3) * Math.PI * 2;
      items.push({ x: 14 + Math.cos(a) * 10, y: 6 + Math.sin(a) * 3, back: Math.sin(a) < 0 });
    }
    // Back stars first.
    items.sort((p, q) => Number(q.back) - Number(p.back));
    for (const s of items) {
      const src = s.back ? small : big;
      b.blit(src, Math.round(s.x) - (src.w >> 1), Math.round(s.y) - (src.h >> 1));
    }
    return center(b.outline(INK));
  });
}

// ------------------------------------------------------------------------------------ flying props

/** The Legion shako (GDD §9.0: tall black, white plume, gold badge), upright, 9×13. */
function shakoBitmap(): PixelBuffer {
  return ascii(
    [
      '...wW....', //
      '..wWWw...',
      '...ww....',
      '.kKKKKk..',
      '.kKKKKk..',
      '.kKyYKk..',
      '.kKYyKk..',
      '.kKKKKk..',
      '.gGGGGg..',
      'kkkkkkkkk',
    ],
    {
      w: PAL.snow[2],
      W: PAL.snow[3],
      k: PAL.black[1],
      K: PAL.black[2],
      y: PAL.gold[2],
      Y: PAL.gold[3],
      g: PAL.gold[1],
      G: PAL.gold[2],
    },
  );
}

/** A crooked stick-on moustache (11×4): black, curled tips, a pale glue strip on the back. */
function moustacheBitmap(): PixelBuffer {
  return ascii(
    [
      'k........kk', //
      'kk.kkkkkkk.',
      '.kkkKKKkk..',
      '...kk......',
    ],
    { k: PAL.black[2], K: PAL.black[3] },
  );
}

// ------------------------------------------------------------------------------------ snow, ice, feather

function snowPuffFrames(): Frame[] {
  const out = cloudFrames(6, 5, [PAL.snow[0], PAL.snow[1], PAL.snow[2], PAL.snow[3]], PAL.sky[1], 13);
  // Flecks around the puff.
  out.forEach((f, i) => {
    for (let k = 0; k < 5; k++) {
      const x = Math.round(f.buf.w / 2 + (hash2(k, 1, 9) - 0.5) * (f.buf.w - 2));
      const y = Math.round(f.buf.h / 2 + (hash2(k, 2, 9) - 0.5) * (f.buf.h - 2) - i);
      if (x >= 0 && y >= 0 && x < f.buf.w && y < f.buf.h && !(f.buf.get(x, y) & 255)) f.buf.set(x, y, PAL.snow[3]);
    }
  });
  return out;
}

/** Four ice cubes (static frames): pale blue blocks with a white glint and a dark blue rim. */
function iceFrames(): Frame[] {
  const key = { W: PAL.snow[3], s: PAL.sky[3], S: PAL.sky[2], d: PAL.sky[1] };
  const shapes: string[][] = [
    ['Wss', 'sSs', 'sSd'],
    ['Wsss', 'sSSd', 'sSdd'],
    ['.Ws.', 'WsSs', 'sSSd', '.sd.'],
    ['Ws', 'Sd'],
  ];
  return shapes.map((rows) => center(ascii(rows, key).padded(1).outline(PAL.navy[1])));
}

// ------------------------------------------------------------------------------------ registry

export function defineGagSprites(): void {
  defineSprite('fx/poof', poofFrames, { ticksPerFrame: 3, loop: false });
  defineSprite('fx/confetti', confettiFrames, { ticksPerFrame: 4, loop: false });
  defineSprite('fx/confetti-bit', confettiBits, { ticksPerFrame: 0 });
  defineSprite('fx/music-note', noteFrames, { ticksPerFrame: 6 });
  defineSprite('fx/steam-puff', () => cloudFrames(7, 6, [PAL.snow[0], PAL.snow[1], PAL.snow[2], PAL.snow[3]], PAL.steel[3], 21), {
    ticksPerFrame: 4,
    loop: false,
  });
  defineSprite('fx/helium-cloud', heliumFrames, { ticksPerFrame: 8 });
  defineSprite('fx/shadow', shadowFrames, { ticksPerFrame: 0 });
  defineSprite('fx/aim-line', aimMarkFrames, { ticksPerFrame: 4 });
  defineSprite('fx/stars-dizzy', dizzyFrames, { ticksPerFrame: 4 });
  defineSprite('fx/flying-shako', () => tumbleStrip(shakoBitmap(), 8), { ticksPerFrame: 3 });
  defineSprite('fx/stick-on-moustache', () => tumbleStrip(moustacheBitmap(), 8), { ticksPerFrame: 3 });
  defineSprite('fx/snow-puff', snowPuffFrames, { ticksPerFrame: 4, loop: false });
  defineSprite('fx/ice-cubes', iceFrames, { ticksPerFrame: 0 });
}
