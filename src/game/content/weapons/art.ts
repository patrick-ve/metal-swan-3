/**
 * Content category "weapons": sprite definitions only (docs/ARCHITECTURE.md §6.1, §7.1).
 *
 * - Projectiles `weapon/*` (centre-anchored). Bullets that fly in any direction are
 *   DIRECTION STRIPS for src/game/projectile.ts (`look: 'angle'`): 16 frames cover 360°,
 *   frame 0 points right, frames go clockwise — weapon/bullet (= bullet-pistol, the 8×2 yellow
 *   pistol bullet), weapon/mg-bullet (= bullet-mg), weapon/vulcan-bullet, weapon/shell,
 *   weapon/rocket, weapon/homing. Round shots look the same in every direction: weapon/pellet
 *   (1f), weapon/enemy-bullet (2f, alias enemy/bullet: GDD §9.0's brass pellet). Spinning
 *   strips (`look: 'anim'`): weapon/grenade (4f), weapon/mine-disc (4f), weapon/enemy-grenade
 *   (4f, alias enemy/grenade). Also casing (4f) and smoke-trail (4f).
 * - The other shots (tuba rings, flame blobs, laser flare / hit) and the per-weapon muzzle
 *   flashes `fx/muzzle-<weapon>[-up|-diag]`: shots.art.ts.
 * - Generic muzzle flashes anchored at the flash base (drawn at the muzzle point):
 *   weapon/muzzle-pistol, weapon/muzzle-heavy, and the ids used by src/game/fx.ts: fx/muzzle,
 *   fx/muzzle-up, fx/muzzle-diag, fx/muzzle-heavy[-up|-diag] (point right / up / up-right; the
 *   game flips them); `fx/muzzle-pistol…` and `fx/muzzle-machine-gun…` alias them.
 * - HUD icons `ui/icon-<weapon id>` (+ `ui/icon-weapon-<id>`): icons.art.ts; `ui/icon-bomb`,
 *   `ui/icon-life`, `ui/icon-hostage`, `ui/icon-shell` here (top-left anchored).
 */
import { ascii } from '../../../engine/ascii';
import type { Color } from '../../../engine/color';
import { PixelBuffer } from '../../../engine/pixel';
import { INK, PAL } from '../../../engine/palette';
import type { Frame } from '../../../engine/render';
import { defineSprite } from '../../../engine/sprites';
import { HI, HiPen, asHi, outlineHi, turnHi } from '../../art/hi';
import { grenadeArt } from '../../art/humanoid-gear';
import { bayer, hash2 } from '../../art/paint';
import { defineWeaponIcons } from './icons.art';
import { defineShotSprites } from './shots.art';

const center = (buf: PixelBuffer): Frame => ({ buf, ox: buf.w >> 1, oy: buf.h >> 1 });

// ------------------------------------------------------------------------------------ bullets

/** Number of directions in a direction strip (22.5° steps). */
export const DIRECTIONS = 16;

/**
 * One tracer frame pointing along `a` (radians, 0 = right, clockwise): a hot white head, a
 * gold body and an orange tail, `len` px long and `width` px thick, with a dark rim. `d` = 2
 * draws the same tracer on the 2× grid (same logical size and anchor, a 2-px rim, the body's
 * edge on half pixels).
 */
function tracer(a: number, len: number, width: number, colors: readonly Color[], d = 1): Frame {
  const size = len + width + 4;
  const b = new PixelBuffer(size * d, size * d);
  const c = (size * d) / 2;
  const dx = Math.cos(a);
  const dy = Math.sin(a);
  const steps = len * 3 * d;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps; // 0 = tail, 1 = head
    const x = c + (t - 0.5) * len * d * dx;
    const y = c + (t - 0.5) * len * d * dy;
    const col = colors[Math.min(colors.length - 1, Math.floor(t * colors.length))];
    const r = width > 1 && t > 0.35 ? (width * d - 1) / 2 : (d - 1) / 2;
    for (let yy = Math.floor(y - r); yy <= Math.ceil(y + r); yy++) {
      for (let xx = Math.floor(x - r); xx <= Math.ceil(x + r); xx++) {
        if (Math.hypot(xx + 0.5 - x, yy + 0.5 - y) <= r + 0.5) b.set(xx, yy, col);
      }
    }
  }
  if (d === 1) {
    b.outline(INK);
    return { buf: b, ox: Math.floor(size / 2), oy: Math.floor(size / 2) };
  }
  // 2×: a 2-px rim of two plain rings (no filled diagonal corners), so a diagonal tracer keeps
  // the weight of the 1× one; the white-hot head is the body's own front colour.
  b.outline(INK).outline(INK);
  return { buf: b, ox: Math.floor(size / 2), oy: Math.floor(size / 2), density: HI };
}

/** A direction strip of DIRECTIONS tracer frames (`d` = 2: the 2× twin). */
function tracerStrip(len: number, width: number, colors: readonly Color[], d = 1): Frame[] {
  return Array.from({ length: DIRECTIONS }, (_, i) => tracer((i / DIRECTIONS) * Math.PI * 2, len, width, colors, d));
}

const HOT: readonly Color[] = [PAL.fire[3], PAL.fire[4], PAL.fire[5], PAL.fire[6]];

/** A direction strip made by rotating a right-pointing bitmap (bigger shells and rockets). */
function rotatedStrip(src: PixelBuffer): Frame[] {
  const padded = src.padded(2);
  return Array.from({ length: DIRECTIONS }, (_, i) => {
    const r = padded.rotated((i / DIRECTIONS) * Math.PI * 2).outline(INK);
    return center(r.padded(1));
  });
}

function shellBitmap(): PixelBuffer {
  return ascii(['.YbbbbBB.', 'YYbbbbBBB', '.YbbbbBB.'], { Y: PAL.fire[4], b: PAL.brass[2], B: PAL.steel[3] });
}

function pellet(): Frame[] {
  const b = ascii(['.Y.', 'YWY', '.Y.'], { Y: PAL.fire[5], W: PAL.fire[6] });
  return [center(b.padded(1).outline(INK))];
}

/** Enemy shots: a round, pulsing pink-orange ball with a white core and a dark rim. */
function enemyBullet(): Frame[] {
  return [0, 1].map((i) => {
    const b = new PixelBuffer(9, 9);
    b.circle(4, 4, 3, i === 0 ? PAL.red[3] : PAL.pink[1]);
    b.circle(4, 4, 2, i === 0 ? PAL.orange[2] : PAL.red[3]);
    b.circle(4, 4, 1, PAL.snow[3]);
    b.set(3, 3, PAL.snow[3]);
    return center(b.outline(INK));
  });
}

/** Enemy bomb: black ball with a brass cap and a sparking fuse. */
function enemyGrenade(): Frame[] {
  return [0, 1, 2, 3].map((i) => {
    const b = new PixelBuffer(13, 13);
    b.sphere(6, 7, 4, PAL.black, { dither: false });
    b.rect(5, 2, 3, 2, PAL.brass[2]);
    b.set(5, 2, PAL.brass[3]);
    // Fuse wiggles; spark flickers.
    const fx = [8, 9, 9, 8][i];
    b.set(7, 1, PAL.brown[2]);
    b.set(fx, 0, i % 2 === 0 ? PAL.gold[3] : PAL.fire[6]);
    if (i % 2 === 0) b.set(fx + 1, 0, PAL.fire[4]);
    b.set(4, 5, PAL.steel[3]);
    return center(b.padded(1).outline(INK));
  });
}

function casing(): Frame[] {
  const rows = [['bB', 'bb'], ['.B', 'bb'], ['b.', 'Bb'], ['B.', 'b.', 'b.']];
  return rows.map((r) => center(ascii(r, { b: PAL.brass[1], B: PAL.brass[3] }).padded(1).outline(INK)));
}

/** Smoke-trail puff: a small grey ball that grows and frays away. */
function smokeTrail(): Frame[] {
  return [0, 1, 2, 3].map((i) => {
    const r = [1, 2, 3, 3][i];
    const b = new PixelBuffer(9, 9);
    b.circle(4, 4, r, PAL.stone[3]);
    if (r > 1) b.circle(5, 5, r - 1, PAL.stone[2]);
    if (i >= 2) {
      for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) if (bayer(x, y) < (i - 1) * 0.3) b.set(x, y, 0);
    }
    return center(b);
  });
}

// ------------------------------------------------------------------------------------ muzzle

/** Star-burst flash pointing right, anchored at its base (left middle). */
function flash(len: number, half: number, step: number, heavy: boolean): PixelBuffer {
  const w = len + 2;
  const h = half * 2 + 3;
  const b = new PixelBuffer(w, h);
  const cy = h >> 1;
  const fire = PAL.fire;
  // Main cone + side spikes, hot core near the muzzle.
  for (let x = 0; x < len; x++) {
    const t = x / len;
    const hh = Math.round(half * (1 - t) * (step === 0 ? 1 : 0.7) + (x < 3 ? 1 : 0));
    for (let y = -hh; y <= hh; y++) {
      const edge = Math.abs(y) >= hh - (heavy ? 1 : 0) || t > 0.75;
      b.set(x + 1, cy + y, edge ? fire[4] : t < 0.35 ? fire[6] : fire[5]);
    }
  }
  if (step === 0) {
    // Diagonal spikes.
    for (let k = 1; k <= Math.round(half * 0.9); k++) {
      b.set(2 + k, cy - half + Math.round(k * 0.2) - 1, fire[5]);
      b.set(2 + k, cy + half - Math.round(k * 0.2) + 1, fire[5]);
    }
  }
  if (step === 2) {
    // Fading puff: thin it out.
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if ((b.get(x, y) & 255) && hash2(x, y, 3) > 0.55) b.set(x, y, 0);
  }
  return b.padded(1).outline(PAL.fire[2]);
}

function muzzleFrames(heavy: boolean, up: boolean, diag = false): Frame[] {
  const sizes: Array<[number, number]> = heavy ? [[12, 4], [9, 3], [6, 2]] : [[7, 3], [5, 2], [3, 1]];
  return sizes.map(([len, half], step) => {
    let buf = flash(len, half, step, heavy);
    let ox = 1;
    let oy = buf.h >> 1;
    if (up) {
      // Counter-clockwise quarter turn: base at the bottom, pointing up.
      buf = buf.rotated(-Math.PI / 2);
      ox = buf.w >> 1;
      oy = buf.h - 2;
    } else if (diag) {
      // 45° up-right (the game flips it for the other diagonals): the base moves with the turn.
      const d = buf.w / 2 - 1;
      buf = buf.rotated(-Math.PI / 4);
      ox = Math.round(buf.w / 2 - d * Math.SQRT1_2);
      oy = Math.round(buf.h / 2 + d * Math.SQRT1_2);
    }
    return { buf, ox, oy };
  });
}

// ------------------------------------------------------------------------------------ 2× twins

/*
 * 2× art for mission ams (docs/ART_GUIDE.md "2x art (mission ams)"): the same shots, casings and
 * flashes on the 2× grid, each frame with its 1× frame's logical size and anchor. Outlines stay
 * 2 px (the 1× weight); turns go through the density-aware `turnHi` (never a 1× turn helper).
 */

/** The cannon shell at 2× (18×6, pointing right): a glowing base, a brass case lit from above, a steel nose. */
function shellBitmapHi(): PixelBuffer {
  return ascii(
    [
      '..YYhhhhhhhhSSs...', //
      '..YyhbbbbbbbSSSSs.',
      'YYyyhbbbbbbbsSSSSs',
      'YYyyhbbbbbbbssssst',
      '..YYddddddddssst..',
      '..YYddddddddtt....',
    ],
    {
      Y: PAL.fire[4],
      y: PAL.fire[5],
      h: PAL.brass[3],
      b: PAL.brass[2],
      d: PAL.brass[1],
      S: PAL.steel[4],
      s: PAL.steel[3],
      t: PAL.steel[2],
    },
  );
}

/** The 2× twin of `rotatedStrip(src1)`: the 2× source turned the same way (`turnHi`). */
function rotatedStripHi(src1: PixelBuffer, src2: PixelBuffer): Frame[] {
  const lo = rotatedStrip(src1);
  const padded = src2.padded(2 * HI);
  return lo.map((f, i) => turnHi(padded, (i / DIRECTIONS) * Math.PI * 2, f, { outline: INK }));
}

/** The shotgun pellet at 2×: a round white-hot core, lit from the top-left. */
function pelletHi(): Frame[] {
  const b = ascii(['..YY..', '.YWWY.', 'YWWWWY', 'YWWWYo', '.YYYo.', '..Yo..'], {
    W: PAL.fire[6],
    Y: PAL.fire[5],
    o: PAL.fire[4],
  });
  return [asHi(outlineHi(b.padded(HI), HI), pellet()[0])];
}

/** Enemy shots at 2×: the same pulsing ball with a finer core and a single-pixel glint. */
function enemyBulletHi(): Frame[] {
  const lo = enemyBullet();
  return [0, 1].map((i) => {
    const b = new PixelBuffer(9 * HI, 9 * HI);
    const p = new HiPen(b, 0, 0);
    p.circle(4, 4, 3, i === 0 ? PAL.red[3] : PAL.pink[1]);
    p.circle(4, 4, 2, i === 0 ? PAL.orange[2] : PAL.red[3]);
    p.circle(4, 4, 1, PAL.snow[3]);
    p.px(3, 3, PAL.snow[3]);
    // A darker crescent on the lower right of the rim (light top-left).
    p.dot(6, 6.5, i === 0 ? PAL.red[2] : PAL.pink[0]).dot(6.5, 6, i === 0 ? PAL.red[2] : PAL.pink[0]);
    return asHi(outlineHi(b, HI), lo[i]);
  });
}

/** Enemy bomb at 2×: a shaded black ball, a lit brass cap, a curling fuse with a spark. */
function enemyGrenadeHi(): Frame[] {
  const lo = enemyGrenade();
  return [0, 1, 2, 3].map((i) => {
    const b = new PixelBuffer(13 * HI, 13 * HI);
    b.sphere(13, 15, 8, PAL.black, { dither: false });
    b.rect(10, 4, 6, 4, PAL.brass[2]);
    b.hline(10, 15, 4, PAL.brass[3]);
    b.set(10, 5, PAL.brass[3]);
    b.hline(11, 15, 7, PAL.brass[1]);
    const fx = [8, 9, 9, 8][i] * HI;
    b.line(14, 3, fx, 1, PAL.brown[2]);
    b.set(15, 3, PAL.brown[1]);
    b.rect(fx, 0, HI, HI, i % 2 === 0 ? PAL.gold[3] : PAL.fire[6]);
    b.set(fx, 0, PAL.fire[6]);
    if (i % 2 === 0) b.rect(fx + HI, 0, HI, HI, PAL.fire[4]);
    b.rect(8, 10, HI, HI, PAL.steel[3]);
    b.set(8, 10, PAL.steel[4]);
    return asHi(outlineHi(b.padded(HI), HI), lo[i]);
  });
}

/** Casings at 2×: the same 4 tumbling poses with a lit edge (h) and a dark side (b). */
function casingHi(): Frame[] {
  const lo = casing();
  const rows = [
    ['.mhh', 'bmmh', 'bbmm', '.bb.'],
    ['...h', '..hm', 'bmmb', 'bbb.'],
    ['bb..', 'mb..', 'hmmb', '.hmb'],
    ['.h..', 'hm..', 'mb..', 'mb..', 'mb..', 'bb..'],
  ];
  return rows.map((r, i) => {
    const b = ascii(r, { b: PAL.brass[1], m: PAL.brass[2], h: PAL.brass[3] });
    return asHi(outlineHi(b.padded(HI), HI), lo[i]);
  });
}

/** Smoke-trail puff at 2×: rounder balls, the fade dithered per logical pixel (clean, no speckle). */
function smokeTrailHi(): Frame[] {
  const lo = smokeTrail();
  return [0, 1, 2, 3].map((i) => {
    const r = [1, 2, 3, 3][i];
    const b = new PixelBuffer(9 * HI, 9 * HI);
    const p = new HiPen(b, 0, 0);
    p.circle(4, 4, r, PAL.stone[3]);
    if (r > 1) p.circle(5, 5, r - 1, PAL.stone[2]);
    if (i >= 2) {
      for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) if (bayer(x >> 1, y >> 1) < (i - 1) * 0.3) b.set(x, y, 0);
    }
    return asHi(b, lo[i]);
  });
}

/**
 * The 2× star-burst flash (twice `flash`'s buffer, before its padding and outline): the same cone
 * and spikes measured on the 2× grid (a smoother taper), the rims at the 1× weight. The spikes are
 * joined to the cone (one wedge, no outline line between them). The fading last frame is thinned
 * per logical pixel like 1×, with notches filled back in, so it stays a solid spark (a notched
 * 2× spark reads as a hollow ring).
 */
function flashFillHi(len: number, half: number, step: number, heavy: boolean): PixelBuffer {
  const w = len + 2;
  const h = half * 2 + 3;
  const b = new PixelBuffer(w * HI, h * HI);
  const cy = h >> 1;
  const mid = cy * HI + 1; // the 2× row just below the centre line
  const fire = PAL.fire;
  const rim = heavy ? 2 * HI : HI;
  for (let x = 0; x < len * HI; x++) {
    const t = x / (len * HI);
    const hh = half * (1 - t) * (step === 0 ? 1 : 0.7) + (x < 3 * HI ? 1 : 0);
    const H = Math.round((hh + 0.5) * HI);
    for (let y = mid - H; y < mid + H; y++) {
      const o = y < mid ? mid - y : y - mid + 1; // 1 … H, from the centre line out
      const edge = o > H - rim || t > 0.75;
      b.set(x + HI, y, edge ? fire[4] : t < 0.35 ? fire[6] : fire[5]);
    }
  }
  if (step === 0) {
    // Diagonal spikes (2 px thick, on half steps), each joined to the cone by an edge-coloured web.
    const n = Math.round(half * 0.9);
    for (let k = 1; k <= n + 0.5; k += 0.5) {
      const x = Math.round((2 + k) * HI);
      const yt = Math.round((cy - half + k * 0.2 - 1) * HI);
      const yb = Math.round((cy + half - k * 0.2 + 1) * HI);
      for (let xx = x; xx < x + HI; xx++) {
        for (let y = yt + HI; y < mid && (b.get(xx, y) & 255) === 0; y++) b.set(xx, y, fire[4]);
        for (let y = yb - 1; y >= mid && (b.get(xx, y) & 255) === 0; y--) b.set(xx, y, fire[4]);
      }
      b.rect(x, yt, HI, HI, fire[5]);
      b.rect(x, yb, HI, HI, fire[5]);
    }
  }
  if (step === 2) {
    // Fading puff: the 1× thinning on logical cells, then every cleared cell between two kept
    // cells (left and right, or above and below) is filled again.
    const cw = w;
    const keep = (cx: number, cy2: number): boolean =>
      cx >= 0 && cy2 >= 0 && cx < cw && cy2 < h && (b.get(cx * HI, cy2 * HI) & 255) !== 0 && hash2(cx, cy2, 3) <= 0.55;
    const cell = (cx: number, cy2: number): Color => {
      for (let k = 0; k < HI * HI; k++) {
        const c = b.get(cx * HI + (k & 1), cy2 * HI + (k >> 1));
        if (c & 255) return c;
      }
      return 0;
    };
    const out = new PixelBuffer(b.w, b.h);
    for (let cy2 = 0; cy2 < h; cy2++) {
      for (let cx = 0; cx < cw; cx++) {
        const fill =
          keep(cx, cy2) || (cell(cx, cy2) !== 0 && ((keep(cx - 1, cy2) && keep(cx + 1, cy2)) || (keep(cx, cy2 - 1) && keep(cx, cy2 + 1))));
        if (!fill) continue;
        for (let k = 0; k < HI * HI; k++) {
          const x = cx * HI + (k & 1);
          const y = cy2 * HI + (k >> 1);
          out.set(x, y, b.get(x, y));
        }
      }
    }
    return out;
  }
  return b;
}

/** The 2× twins of `muzzleFrames` (up: an exact quarter turn; diag: `turnHi`, outlined after it). */
function muzzleFramesHi(heavy: boolean, up: boolean, diag = false): Frame[] {
  const lo = muzzleFrames(heavy, up, diag);
  const sizes: Array<[number, number]> = heavy ? [[12, 4], [9, 3], [6, 2]] : [[7, 3], [5, 2], [3, 1]];
  return sizes.map(([len, half], step) => {
    const fill = flashFillHi(len, half, step, heavy);
    if (diag) return turnHi(fill.padded(HI), -Math.PI / 4, lo[step], { outline: PAL.fire[2] });
    const buf = outlineHi(fill.padded(HI), HI, PAL.fire[2]);
    if (up) return asHi(buf.rotated(-Math.PI / 2), lo[step]);
    return asHi(buf, lo[step]);
  });
}

// ------------------------------------------------------------------------------------ HUD icons

function iconBomb(): Frame[] {
  return [{ buf: grenadeArt().padded(1).outline(INK), ox: 0, oy: 0 }];
}

/** HUD life icon (GDD §13.7): a little ivory swan head with an orange beak and a navy eye. */
function iconLife(): Frame[] {
  const b = ascii(['.WW..', 'WkWoo', 'WWW..', '.W...', '.WW..', '..WW.'], {
    W: PAL.snow[3],
    k: PAL.navy[0],
    o: PAL.orange[2],
  });
  return [{ buf: b.padded(1).outline(INK), ox: 0, oy: 0 }];
}

/**
 * HUD hostage tally icon (GDD §13.7): a bow tie — the critics' trademark — 5×3 in crimson with a
 * gold knot (one icon per hostage in the tally).
 */
function iconHostage(): Frame[] {
  const b = ascii(['Aa.aA', 'AAgAA', 'Aa.aA'], {
    a: PAL.red[2],
    A: PAL.red[3],
    g: PAL.gold[3],
  });
  return [{ buf: b.padded(1).outline(INK), ox: 0, oy: 0 }];
}

/** HUD vehicle shell icon. */
function iconShell(): Frame[] {
  const b = ascii(['.BBbbbY', 'BBBbbbYY', '.BBbbbY'], { B: PAL.steel[3], b: PAL.brass[2], Y: PAL.brass[3] });
  return [{ buf: b.padded(1).outline(INK), ox: 0, oy: 0 }];
}

defineSprite('ui/icon-bomb', iconBomb, { anchor: 'top-left' });
defineSprite('ui/icon-life', iconLife, { anchor: 'top-left' });
defineSprite('ui/icon-hostage', iconHostage, { anchor: 'top-left' });
defineSprite('ui/icon-shell', iconShell, { anchor: 'top-left' });

defineWeaponIcons();
defineShotSprites();

/** GDD §5: the pistol fires "one 8×2 px yellow bullet" (a white-hot head, an orange tail). */
const pistolStrip = (): Frame[] => tracerStrip(7, 2, HOT);
const mgStrip = (): Frame[] => tracerStrip(8, 2, [PAL.fire[2], ...HOT]);
const vulcanStrip = (): Frame[] => tracerStrip(9, 3, [PAL.fire[2], ...HOT]);
const pistolHi = { hi: (): Frame[] => tracerStrip(7, 2, HOT, HI) };
const mgHi = { hi: (): Frame[] => tracerStrip(8, 2, [PAL.fire[2], ...HOT], HI) };
defineSprite('weapon/bullet', pistolStrip, pistolHi);
defineSprite('weapon/bullet-pistol', pistolStrip, pistolHi);
defineSprite('weapon/mg-bullet', mgStrip, mgHi);
defineSprite('weapon/bullet-mg', mgStrip, mgHi);
defineSprite('weapon/vulcan-bullet', vulcanStrip, { hi: () => tracerStrip(9, 3, [PAL.fire[2], ...HOT], HI) });
defineSprite('weapon/shell', () => rotatedStrip(shellBitmap()), { hi: () => rotatedStripHi(shellBitmap(), shellBitmapHi()) });
defineSprite('weapon/pellet', pellet, { hi: pelletHi });
defineSprite('weapon/enemy-bullet', enemyBullet, { ticksPerFrame: 4, hi: enemyBulletHi });
defineSprite('enemy/bullet', enemyBullet, { ticksPerFrame: 4, hi: enemyBulletHi });
defineSprite('weapon/enemy-grenade', enemyGrenade, { ticksPerFrame: 4, hi: enemyGrenadeHi });
defineSprite('enemy/grenade', enemyGrenade, { ticksPerFrame: 4, hi: enemyGrenadeHi });
defineSprite('weapon/casing', casing, { ticksPerFrame: 3, hi: casingHi });
defineSprite('weapon/smoke-trail', smokeTrail, { ticksPerFrame: 5, loop: false, hi: smokeTrailHi });

const flashOpts = { ticksPerFrame: 2, loop: false } as const;
const flashSet = (heavy: boolean, up: boolean, diag = false) => ({
  ...flashOpts,
  hi: (): Frame[] => muzzleFramesHi(heavy, up, diag),
});
defineSprite('weapon/muzzle-pistol', () => muzzleFrames(false, false), flashSet(false, false));
defineSprite('weapon/muzzle-heavy', () => muzzleFrames(true, false), flashSet(true, false));
defineSprite('fx/muzzle', () => muzzleFrames(false, false), flashSet(false, false));
defineSprite('fx/muzzle-up', () => muzzleFrames(false, true), flashSet(false, true));
defineSprite('fx/muzzle-heavy', () => muzzleFrames(true, false), flashSet(true, false));
defineSprite('fx/muzzle-heavy-up', () => muzzleFrames(true, true), flashSet(true, true));
defineSprite('fx/muzzle-diag', () => muzzleFrames(false, false, true), flashSet(false, false, true));
defineSprite('fx/muzzle-heavy-diag', () => muzzleFrames(true, false, true), flashSet(true, false, true));
// GDD names `fx/muzzle-<weapon>` for the two guns that use the generic flashes.
for (const [id, heavy] of [['pistol', false], ['machine-gun', true]] as const) {
  defineSprite(`fx/muzzle-${id}`, () => muzzleFrames(heavy, false), flashSet(heavy, false));
  defineSprite(`fx/muzzle-${id}-up`, () => muzzleFrames(heavy, true), flashSet(heavy, true));
  defineSprite(`fx/muzzle-${id}-diag`, () => muzzleFrames(heavy, false, true), flashSet(heavy, false, true));
}
