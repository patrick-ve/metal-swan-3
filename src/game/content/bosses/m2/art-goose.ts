/**
 * Art of THE GOLDEN GOOSE (GDD §9.4, §15.6): Swan Mk2, painted gold by the Legion — bigger than
 * the SWAN-3, crimson trim, a crimson plume, a Legion pilot under Mk2's own enclosed glass canopy.
 * Drawn facing LEFT (the boss mirrors it to face right); feet anchor between the two feet unless noted.
 *
 * - `boss/golden-goose/hull-0|1|2`  the body (hull, wing, tail, canopy with the pilot)
 * - `boss/golden-goose/hull-open`   the body with the canopy open and empty (after the fight)
 * - `boss/golden-goose/legs`        6 frames: GOOSE_LEGS.*
 * - `boss/golden-goose/neck-0|1|2`  16 frames: GOOSE.neckAngles × (beak shut 0–7, open 8–15);
 *                                   anchor = the neck root; point `beak`
 * - `boss/golden-goose/stump`       the broken neck; anchor = the neck root
 * - `boss/golden-goose/puff`        2 frames: the chest puffing up (overlay on the hull)
 * - `boss/golden-goose/nest`        a nest of Legion crates (decor behind the goose)
 * - `boss/golden-goose/big-egg`     4 frames: the last golden egg cracking open
 * - `boss/golden-goose/pilot-run`   4 frames: the pilot running off (feet anchor, faces right)
 * - projectiles (centre anchor): `egg` (4), `note` (2), `pellet` (2), `wave` (3, 8 px tall)
 */
import { PixelBuffer } from '../../../../engine/pixel';
import { INK, PAL, type Ramp } from '../../../../engine/palette';
import type { Frame } from '../../../../engine/render';
import { defineSprite } from '../../../../engine/sprites';
import { renderHuman, type HumanStyle } from '../../../art/humanoid';
import * as P from '../../../art/poses';
import { damage, glass, plate } from '../../../art/machines';
import { crest } from '../../machines/armor/kit.art';
import { waveFrame } from './art-behemoth';
import { GOOSE } from './geom';

const ART = 'boss/golden-goose';

/** Body canvas: local x −56 … 55, y −100 … −1 (feet anchor). */
const W = 112;
const H = 102;
const OX = 56;
const OY = 101;
const X = (lx: number): number => Math.round(lx + OX);
const Y = (ly: number): number => Math.round(ly + OY);

export const GOOSE_LEGS = { stand: 0, stepA: 1, stepB: 2, lift: 3, squat: 4, sit: 5 } as const;
/** How far the body sinks for each legs frame. */
export const GOOSE_BODY_DY: readonly number[] = [0, -1, -1, -2, 6, 22];

/** Shade a filled layer: light from the top-left by position inside an ellipse box. */
function shadeOval(b: PixelBuffer, x0: number, y0: number, w: number, h: number, ramp: Ramp): void {
  const cx = x0 + w / 2;
  const cy = y0 + h / 2;
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      if ((b.get(x, y) & 255) === 0) continue;
      const l = (-(x - cx) / (w / 2)) * 0.45 + (-(y - cy) / (h / 2)) * 0.8;
      const i = l > 0.55 ? 3 : l > -0.1 ? 2 : l > -0.6 ? 1 : 0;
      b.set(x, y, ramp[Math.min(ramp.length - 1, i)]);
    }
  }
}

const PILOT_STYLE: HumanStyle = {
  skin: 'skinA',
  hair: 'hairB',
  hairStyle: 'short',
  headgear: 'shako',
  gear: 'black',
  accent: 'gold',
  top: 'red',
  topType: 'tunic',
  pants: 'cloth',
  boots: 'black',
  gloves: 'cloth',
  belt: 'black',
  build: 'normal',
  accessories: ['cross-belt'],
  face: ['moustache'],
};

function hullFrame(state: 0 | 1 | 2, open = false): Frame {
  const b = new PixelBuffer(W, H);
  // Tail: three swept plates, crimson tips.
  for (const [, dy, len] of [
    [0, -6, 18],
    [2, 0, 20],
    [4, 6, 16],
  ] as const) {
    b.thickLine(X(26), Y(-52 + dy), X(26 + len), Y(-66 + dy - len * 0.3), 6, PAL.gold[1]);
    b.thickLine(X(26), Y(-53 + dy), X(25 + len), Y(-67 + dy - len * 0.3), 3, PAL.gold[2]);
    b.circle(X(27 + len), Y(-67 + dy - len * 0.3), 3, PAL.red[2]);
  }
  // Hull: an egg-shaped body.
  const body = new PixelBuffer(W, H);
  body.ellipse(X(-36), Y(-68), 72, 44, PAL.gold[2]);
  body.ellipse(X(-40), Y(-62), 30, 34, PAL.gold[2]); // the breast
  shadeOval(body, X(-40), Y(-68), 76, 44, PAL.gold);
  b.blit(body, 0, 0);
  // Crimson trim: the waterline stripe and a chevron.
  for (let x = -38; x <= 34; x++) {
    const yy = -34 + Math.round(((x + 2) * (x + 2)) / 400);
    for (let d = 0; d < 3; d++) if ((b.get(X(x), Y(yy + d)) & 255) !== 0) b.set(X(x), Y(yy + d), d === 0 ? PAL.red[3] : PAL.red[2]);
  }
  // The folded wing panel with feather seams and rivets.
  const wing = new PixelBuffer(W, H);
  wing.ellipse(X(-12), Y(-60), 44, 22, PAL.gold[1]);
  wing.poly([[X(20), Y(-58)], [X(40), Y(-60)], [X(30), Y(-44)]], PAL.gold[1]);
  shadeOval(wing, X(-12), Y(-62), 52, 26, PAL.gold);
  b.blit(wing, 0, 0);
  for (const fx of [0, 9, 18, 27]) b.line(X(fx), Y(-56), X(fx + 6), Y(-42), PAL.gold[0]);
  b.line(X(-6), Y(-52), X(14), Y(-46), PAL.red[2]);
  b.line(X(14), Y(-46), X(32), Y(-52), PAL.red[2]);
  b.line(X(-6), Y(-51), X(14), Y(-45), PAL.red[3]);
  b.line(X(14), Y(-45), X(32), Y(-51), PAL.red[3]);
  // Legion crest on the hull side.
  crest(b, X(-22), Y(-46));
  // Canopy: an enclosed glass dome on the back, the pilot in his shako inside.
  b.ellipse(X(-6), Y(-84), 28, 22, PAL.gold[0]);
  if (!open) {
    const g = glass(24, 16, { bars: 1 });
    b.blit(g, X(-4), Y(-82));
    // The pilot (head and shoulders) behind the glass.
    b.rect(X(4), Y(-70), 10, 4, PAL.red[2]);
    b.circle(X(8), Y(-73), 3, PAL.skinA[2]);
    b.set(X(6), Y(-73), INK);
    b.rect(X(5), Y(-81), 7, 6, PAL.ink[1]);
    b.rect(X(5), Y(-81), 7, 1, PAL.gold[2]);
    b.set(X(8), Y(-82), PAL.red[3]);
    b.set(X(8), Y(-83), PAL.red[3]);
    // Reflection streak over the pilot.
    b.line(X(-1), Y(-80), X(3), Y(-76), PAL.snow[3]);
    b.line(X(0), Y(-80), X(4), Y(-76), PAL.snow[2]);
  } else {
    // Open canopy: the glass is gone, the empty seat shows.
    b.ellipse(X(-4), Y(-82), 24, 18, PAL.ink[1]);
    b.rect(X(2), Y(-74), 10, 6, PAL.brown[1]);
    b.hline(X(2), X(11), Y(-74), PAL.brown[2]);
  }
  // Neck collar (crimson ring) at the root.
  const [nx, ny] = GOOSE.neckRoot;
  b.ellipse(X(nx - 7), Y(ny - 6), 14, 12, PAL.red[1]);
  b.ellipse(X(nx - 6), Y(ny - 5), 11, 9, PAL.red[2]);
  b.hline(X(nx - 4), X(nx + 2), Y(ny - 4), PAL.red[3]);
  // Hip joints.
  for (const hx of [-8, 8]) {
    b.circle(X(hx), Y(-26), 4, PAL.steel[1]);
    b.circle(X(hx - 1), Y(-27), 2, PAL.steel[3]);
  }
  let out = b.outline(INK);
  if (state === 1) out = damage(out, 0.35, 61);
  if (state === 2) out = damage(out, 0.9, 62);
  return { buf: out, ox: OX, oy: OY };
}

/** Legs: thin gold-orange shins and big webbed feet. */
function legsFrame(k: number): Frame {
  const b = new PixelBuffer(80, 44);
  const ox = 40;
  const oy = 42;
  const hipY = -26 + GOOSE_BODY_DY[k];
  const leg = (hx: number, kneeX: number, kneeY: number, fx: number, fy: number, far: boolean): void => {
    const r = far ? PAL.orange[1] : PAL.orange[2];
    b.thickLine(ox + hx, oy + hipY, ox + kneeX, oy + kneeY, 5, far ? PAL.gold[0] : PAL.gold[1]);
    b.thickLine(ox + kneeX, oy + kneeY, ox + fx, oy + fy - 2, 3, r);
    b.circle(ox + kneeX, oy + kneeY, 2, PAL.steel[far ? 1 : 2]);
    // Webbed foot pointing left.
    b.poly([[ox + fx + 3, oy + fy - 3], [ox + fx - 10, oy + fy - 1], [ox + fx - 9, oy + fy], [ox + fx + 4, oy + fy]], far ? PAL.orange[1] : PAL.orange[2]);
    b.line(ox + fx - 8, oy + fy - 1, ox + fx + 2, oy + fy - 2, far ? PAL.orange[0] : PAL.orange[1]);
  };
  switch (k) {
    case GOOSE_LEGS.stand:
      leg(8, 6, -13, 8, -1, true);
      leg(-8, -10, -13, -6, -1, false);
      break;
    case GOOSE_LEGS.stepA:
      leg(8, 12, -13, 16, -1, true);
      leg(-8, -14, -12, -14, -1, false);
      break;
    case GOOSE_LEGS.stepB:
      leg(8, 2, -12, 0, -1, true);
      leg(-8, -4, -14, 2, -1, false);
      break;
    case GOOSE_LEGS.lift:
      leg(8, 6, -13, 8, -1, true);
      leg(-8, -20, -24, -22, -14, false);
      break;
    case GOOSE_LEGS.squat:
      leg(8, 16, -12, 10, -1, true);
      leg(-8, -2, -12, -8, -1, false);
      break;
    default:
      // Sitting: the feet stick out in front.
      b.poly([[ox - 16, oy - 3], [ox - 30, oy - 1], [ox - 29, oy], [ox - 15, oy]], PAL.orange[2]);
      b.poly([[ox - 8, oy - 3], [ox - 22, oy - 1], [ox - 21, oy], [ox - 7, oy]], PAL.orange[1]);
      break;
  }
  return { buf: b.outline(INK), ox, oy };
}

const NW = 76;
const NH = 76;
const NOX = 38;
const NOY = 40;

function neckFrame(state: 0 | 1 | 2, deg: number, open: boolean): Frame {
  const b = new PixelBuffer(NW, NH);
  const t = (deg * Math.PI) / 180;
  const dx = -Math.cos(t);
  const dy = Math.sin(t);
  const L = GOOSE.neckLen;
  const hx = NOX + dx * L;
  const hy = NOY + dy * L;
  // A gentle S-curve: the middle bows forward.
  const mx = NOX + dx * L * 0.5 - 4;
  const my = NOY + dy * L * 0.5 + 2;
  b.thickLine(NOX, NOY, Math.round(mx), Math.round(my), 9, PAL.gold[1]);
  b.thickLine(Math.round(mx), Math.round(my), Math.round(hx), Math.round(hy), 8, PAL.gold[1]);
  b.thickLine(NOX - 1, NOY - 1, Math.round(mx) - 1, Math.round(my) - 1, 5, PAL.gold[2]);
  b.thickLine(Math.round(mx) - 1, Math.round(my) - 1, Math.round(hx) - 1, Math.round(hy) - 1, 4, PAL.gold[2]);
  // One crimson armour ring halfway up the neck.
  {
    const rx = Math.round(NOX + (hx - NOX) * 0.45 - 3);
    const ry = Math.round(NOY + (hy - NOY) * 0.45 + 1);
    b.thickLine(rx - 4, ry + 1, rx + 4, ry - 1, 3, PAL.red[2]);
    b.line(rx - 4, ry, rx + 4, ry - 2, PAL.red[3]);
  }
  // Plume: a long crimson horsehair plume (a shako's) sweeping back from the crown.
  {
    const px0 = Math.round(hx + 2);
    const py0 = Math.round(hy - 6);
    b.thickLine(px0, py0, px0 + 6, py0 - 6, 4, PAL.red[2]);
    b.thickLine(px0 + 6, py0 - 6, px0 + 14, py0 - 4, 3, PAL.red[1]);
    b.line(px0 + 1, py0 - 2, px0 + 6, py0 - 7, PAL.red[3]);
    b.rect(px0 - 1, py0 - 1, 3, 3, PAL.gold[3]);
  }
  // Head.
  b.ellipse(Math.round(hx - 8), Math.round(hy - 6), 16, 12, PAL.gold[2]);
  b.ellipse(Math.round(hx - 6), Math.round(hy - 5), 9, 5, PAL.gold[3]);
  // Beak along the neck direction (+ a little down), shut or open.
  const bx = hx + dx * 7;
  const by = hy + dy * 7 + 1;
  const px = -dy;
  const py = dx;
  const tipX = bx + dx * 11;
  const tipY = by + dy * 11 + 1;
  if (!open) {
    b.poly([[Math.round(bx + px * 3), Math.round(by + py * 3)], [Math.round(tipX), Math.round(tipY)], [Math.round(bx - px * 3), Math.round(by - py * 3)]], PAL.orange[2]);
    b.line(Math.round(bx), Math.round(by), Math.round(tipX), Math.round(tipY), PAL.orange[0]);
  } else {
    b.poly([[Math.round(bx + px * 3), Math.round(by + py * 3)], [Math.round(tipX + px * 4), Math.round(tipY + py * 4)], [Math.round(bx), Math.round(by)]], PAL.orange[2]);
    b.poly([[Math.round(bx - px * 3), Math.round(by - py * 3)], [Math.round(tipX - px * 4), Math.round(tipY - py * 4)], [Math.round(bx), Math.round(by)]], PAL.orange[1]);
    b.set(Math.round(bx + dx * 2), Math.round(by + dy * 2), PAL.red[0]);
  }
  // Eye with an angry brow (the Legion's paint job).
  const ex = Math.round(hx - 2 + dx * 2);
  const ey = Math.round(hy - 2);
  b.rect(ex - 1, ey - 1, 3, 3, PAL.snow[3]);
  b.set(ex - 1, ey, INK);
  b.line(ex - 2, ey - 3, ex + 2, ey - 2, PAL.red[0]);
  let out = b.outline(INK);
  if (state === 1) out = damage(out, 0.4, 71 + Math.round(deg));
  if (state === 2) out = damage(out, 1, 73 + Math.round(deg));
  const beak: readonly [number, number] = [Math.round(tipX - NOX), Math.round(tipY - NOY)];
  return { buf: out, ox: NOX, oy: NOY, pts: { beak } };
}

function stumpFrame(): Frame {
  const b = new PixelBuffer(NW, NH);
  b.thickLine(NOX, NOY, NOX - 6, NOY - 12, 9, PAL.gold[0]);
  b.thickLine(NOX - 1, NOY - 1, NOX - 7, NOY - 13, 5, PAL.gold[1]);
  b.poly([[NOX - 12, NOY - 14], [NOX - 9, NOY - 19], [NOX - 6, NOY - 15], [NOX - 3, NOY - 20], [NOX - 1, NOY - 13]], PAL.ink[1]);
  b.set(NOX - 6, NOY - 17, PAL.orange[2]);
  b.set(NOX - 9, NOY - 16, PAL.gold[3]);
  return { buf: b.outline(INK), ox: NOX, oy: NOY };
}

function puffFrame(k: number): Frame {
  const b = new PixelBuffer(W, H);
  const s = k === 0 ? 2 : 4;
  b.ellipse(X(-40 - s), Y(-62 - s), 26 + s * 2, 32 + s * 2, PAL.gold[2]);
  shadeOval(b, X(-40 - s), Y(-62 - s), 26 + s * 2, 32 + s * 2, PAL.gold);
  b.hline(X(-38 - s), X(-18), Y(-34), PAL.red[2]);
  b.hline(X(-38 - s), X(-18), Y(-33), PAL.red[2]);
  b.set(X(-34), Y(-56), PAL.snow[3]);
  return { buf: b.outline(INK), ox: OX, oy: OY };
}

function nestFrame(): Frame {
  const b = new PixelBuffer(132, 30);
  const crate = (x: number, y: number, w: number, h: number): void => {
    b.blit(plate(w, h, 'olive', { rivets: 'corners' }), x, y);
    b.line(x + 2, y + 2, x + w - 3, y + h - 3, PAL.olive[1]);
    b.line(x + w - 3, y + 2, x + 2, y + h - 3, PAL.olive[1]);
  };
  crate(2, 12, 22, 17);
  crate(20, 4, 18, 15);
  crate(98, 10, 22, 19);
  crate(112, 2, 18, 14);
  // Straw between the crates.
  for (let x = 4; x < 128; x += 3) b.line(x, 28, x + ((x * 7) % 5) - 2, 22 + ((x * 3) % 4), (x & 1) === 0 ? PAL.sand[3] : PAL.sand[2]);
  return { buf: b.outline(INK), ox: 66, oy: 30 };
}

function bigEgg(k: number): Frame {
  const b = new PixelBuffer(30, 30);
  const cx = 15;
  if (k < 3) {
    b.ellipse(cx - 10, 3, 20, 25, PAL.gold[2]);
    shadeOval(b, cx - 10, 3, 20, 25, PAL.gold);
    b.hline(cx - 9, cx + 8, 18, PAL.red[2]);
    b.hline(cx - 9, cx + 8, 19, PAL.red[1]);
    if (k >= 1) {
      b.line(cx - 3, 6, cx, 11, INK);
      b.line(cx, 11, cx - 2, 15, INK);
    }
    if (k >= 2) {
      b.line(cx + 2, 8, cx + 5, 13, INK);
      b.line(cx - 2, 15, cx + 3, 17, INK);
      b.line(cx - 8, 12, cx - 4, 14, INK);
    }
  } else {
    // The halves fall apart; a puff of golden light inside.
    b.ellipse(cx - 13, 15, 12, 13, PAL.gold[1]);
    b.poly([[cx - 13, 18], [cx - 9, 15], [cx - 5, 18], [cx - 2, 15], [cx - 1, 20], [cx - 13, 22]], 0);
    b.ellipse(cx + 2, 15, 12, 13, PAL.gold[2]);
    b.poly([[cx + 2, 20], [cx + 5, 15], [cx + 8, 18], [cx + 11, 14], [cx + 14, 19], [cx + 2, 22]], 0);
    b.circle(cx, 14, 4, PAL.gold[3]);
  }
  return { buf: b.outline(INK), ox: cx, oy: 29 };
}

function pilotRun(k: number): Frame {
  return renderHuman(PILOT_STYLE, P.PANIC_FLAIL[k], 'full');
}

function eggFrame(k: number): Frame {
  const b = new PixelBuffer(16, 18);
  b.ellipse(2, 2, 12, 14, PAL.gold[2]);
  shadeOval(b, 2, 2, 12, 14, PAL.gold);
  // A crimson band that turns as it rolls, and a little fuse cap.
  const yy = [7, 9, 11, 9][k];
  b.hline(3, 12, yy, PAL.red[2]);
  b.hline(3, 12, yy + 1, PAL.red[1]);
  b.rect(7, 1, 2, 2, PAL.steel[3]);
  return { buf: b.outline(INK), ox: 8, oy: 9 };
}

function noteFrame(k: number): Frame {
  const b = new PixelBuffer(12, 12);
  b.circle(6, 6, 5, k === 0 ? PAL.red[2] : PAL.red[3], false);
  b.rect(6, 2, 1, 6, PAL.gold[3]);
  b.ellipse(3, 6, 4, 3, PAL.gold[3]);
  b.line(7, 2, 9, 4, PAL.gold[3]);
  return { buf: b.outline(INK), ox: 6, oy: 6 };
}

function pelletFrame(k: number): Frame {
  const b = new PixelBuffer(8, 8);
  b.circle(4, 4, 2, k === 0 ? PAL.gold[3] : PAL.orange[2]);
  b.set(3, 3, PAL.snow[3]);
  return { buf: b.outline(INK), ox: 4, oy: 4 };
}

const S3 = [0, 1, 2] as const;
for (const s of S3) {
  defineSprite(`${ART}/hull-${s}`, () => [hullFrame(s)], { ticksPerFrame: 60 });
  defineSprite(`${ART}/neck-${s}`, () => [false, true].flatMap((open) => GOOSE.neckAngles.map((a) => neckFrame(s, a, open))), { ticksPerFrame: 60 });
}
defineSprite(`${ART}/hull-open`, () => [hullFrame(2, true)], { ticksPerFrame: 60 });
defineSprite(`${ART}/legs`, () => [0, 1, 2, 3, 4, 5].map(legsFrame), { ticksPerFrame: 8 });
defineSprite(`${ART}/stump`, () => [stumpFrame()], { ticksPerFrame: 60 });
defineSprite(`${ART}/puff`, () => [puffFrame(0), puffFrame(1)], { ticksPerFrame: 6 });
defineSprite(`${ART}/nest`, () => [nestFrame()], { ticksPerFrame: 60 });
defineSprite(`${ART}/big-egg`, () => [0, 1, 2, 3].map(bigEgg), { ticksPerFrame: 12, loop: false });
defineSprite(`${ART}/pilot-run`, () => [0, 1, 2, 3].map(pilotRun), { ticksPerFrame: 5 });
defineSprite(`${ART}/egg`, () => [0, 1, 2, 3].map(eggFrame), { ticksPerFrame: 5 });
defineSprite(`${ART}/note`, () => [noteFrame(0), noteFrame(1)], { ticksPerFrame: 6 });
defineSprite(`${ART}/pellet`, () => [pelletFrame(0), pelletFrame(1)], { ticksPerFrame: 4 });
defineSprite(`${ART}/wave`, () => [0, 1, 2].map((k) => waveFrame(k, 8, 12)), { ticksPerFrame: 3 });
