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
import { defineSprite, hasSprite, type SpriteOpts } from '../../../engine/sprites';
import { grenadeArt } from '../../art/humanoid-gear';
import { bayer, hash2 } from '../../art/paint';
import { defineWeaponIcons } from './icons.art';
import { defineShotSprites } from './shots.art';
import {
  casingHd,
  enemyBulletHd,
  enemyGrenadeHd,
  genericFlashHd,
  pelletHd,
  shellHd,
  smokeTrailHd,
  tracerHd,
  type FlashTurn,
} from '../fx/hd/shots';

const center = (buf: PixelBuffer): Frame => ({ buf, ox: buf.w >> 1, oy: buf.h >> 1 });

// ------------------------------------------------------------------------------------ bullets

/** Number of directions in a direction strip (22.5° steps). */
export const DIRECTIONS = 16;

/**
 * One tracer frame pointing along `a` (radians, 0 = right, clockwise): a hot white head, a
 * gold body and an orange tail, `len` px long and `width` px thick, with a dark rim.
 */
function tracer(a: number, len: number, width: number, colors: readonly Color[]): Frame {
  const size = len + width + 4;
  const b = new PixelBuffer(size, size);
  const c = size / 2;
  const dx = Math.cos(a);
  const dy = Math.sin(a);
  const steps = len * 3;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps; // 0 = tail, 1 = head
    const x = c + (t - 0.5) * len * dx;
    const y = c + (t - 0.5) * len * dy;
    const col = colors[Math.min(colors.length - 1, Math.floor(t * colors.length))];
    const r = width > 1 && t > 0.35 ? (width - 1) / 2 : 0;
    for (let yy = Math.floor(y - r); yy <= Math.ceil(y + r); yy++) {
      for (let xx = Math.floor(x - r); xx <= Math.ceil(x + r); xx++) {
        if (Math.hypot(xx + 0.5 - x, yy + 0.5 - y) <= r + 0.5) b.set(xx, yy, col);
      }
    }
  }
  b.outline(INK);
  return { buf: b, ox: Math.floor(size / 2), oy: Math.floor(size / 2) };
}

/** A direction strip of DIRECTIONS tracer frames. */
function tracerStrip(len: number, width: number, colors: readonly Color[]): Frame[] {
  return Array.from({ length: DIRECTIONS }, (_, i) => tracer((i / DIRECTIONS) * Math.PI * 2, len, width, colors));
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
// The HUD's own life icon (ui/hud.art.ts) wins whatever the load order: this one is the stand-in
// for tools and tests that load the weapons art alone.
if (!hasSprite('ui/icon-life')) defineSprite('ui/icon-life', iconLife, { anchor: 'top-left' });
defineSprite('ui/icon-hostage', iconHostage, { anchor: 'top-left' });
defineSprite('ui/icon-shell', iconShell, { anchor: 'top-left' });

defineWeaponIcons();
defineShotSprites();

/** GDD §5: the pistol fires "one 8×2 px yellow bullet" (a white-hot head, an orange tail). */
const pistolStrip = (): Frame[] => tracerStrip(7, 2, HOT);
const mgStrip = (): Frame[] => tracerStrip(8, 2, [PAL.fire[2], ...HOT]);
const vulcanStrip = (): Frame[] => tracerStrip(9, 3, [PAL.fire[2], ...HOT]);
// HD art (2× and 4×, mission ams): fx/hd/shots.ts, drawn natively per frame and direction.
const hd = (draw: (id: string, d: number) => Frame[]) => (id: string): { hd: (d: number) => Frame[] } => ({ hd: (d) => draw(id, d) });
const pistolHd = hd((id, d) => tracerHd(id, d, 7, 2, false));
const mgHd = hd((id, d) => tracerHd(id, d, 8, 2, true));
const def = (id: string, gen: () => Frame[], opts: SpriteOpts, art: (id: string) => { hd: (d: number) => Frame[] }): void =>
  defineSprite(id, gen, { ...opts, ...art(id) });
def('weapon/bullet', pistolStrip, {}, pistolHd);
def('weapon/bullet-pistol', pistolStrip, {}, pistolHd);
def('weapon/mg-bullet', mgStrip, {}, mgHd);
def('weapon/bullet-mg', mgStrip, {}, mgHd);
def('weapon/vulcan-bullet', vulcanStrip, {}, hd((id, d) => tracerHd(id, d, 9, 3, true)));
def('weapon/shell', () => rotatedStrip(shellBitmap()), {}, hd(shellHd));
def('weapon/pellet', pellet, {}, hd(pelletHd));
def('weapon/enemy-bullet', enemyBullet, { ticksPerFrame: 4 }, hd(enemyBulletHd));
def('enemy/bullet', enemyBullet, { ticksPerFrame: 4 }, hd(enemyBulletHd));
def('weapon/enemy-grenade', enemyGrenade, { ticksPerFrame: 4 }, hd(enemyGrenadeHd));
def('enemy/grenade', enemyGrenade, { ticksPerFrame: 4 }, hd(enemyGrenadeHd));
def('weapon/casing', casing, { ticksPerFrame: 3 }, hd(casingHd));
def('weapon/smoke-trail', smokeTrail, { ticksPerFrame: 5, loop: false }, hd(smokeTrailHd));

const flashOpts: SpriteOpts = { ticksPerFrame: 2, loop: false };
const flashSet = (heavy: boolean, turn: FlashTurn) => hd((id, d) => genericFlashHd(id, d, heavy, turn));
const flashSprite = (id: string, heavy: boolean, turn: FlashTurn): void =>
  def(id, () => muzzleFrames(heavy, turn === 'up', turn === 'diag'), flashOpts, flashSet(heavy, turn));
flashSprite('weapon/muzzle-pistol', false, 'fwd');
flashSprite('weapon/muzzle-heavy', true, 'fwd');
flashSprite('fx/muzzle', false, 'fwd');
flashSprite('fx/muzzle-up', false, 'up');
flashSprite('fx/muzzle-heavy', true, 'fwd');
flashSprite('fx/muzzle-heavy-up', true, 'up');
flashSprite('fx/muzzle-diag', false, 'diag');
flashSprite('fx/muzzle-heavy-diag', true, 'diag');
// GDD names `fx/muzzle-<weapon>` for the two guns that use the generic flashes.
for (const [id, heavy] of [['pistol', false], ['machine-gun', true]] as const) {
  flashSprite(`fx/muzzle-${id}`, heavy, 'fwd');
  flashSprite(`fx/muzzle-${id}-up`, heavy, 'up');
  flashSprite(`fx/muzzle-${id}-diag`, heavy, 'diag');
}
