/**
 * Art of THE BA-DUM BEHEMOTH (GDD §10.2, §15.6): a giant drum kit on crimson treads, drawn with
 * the machines kit and the pixel toolkit. Every strip is anchored at the boss anchor (the middle
 * of the tread on the ground) unless noted, faces LEFT and is never mirrored.
 *
 * - `boss/ba-dum-behemoth/tread`            3 frames (track phase)
 * - `boss/ba-dum-behemoth/bass-drum-0|1|2`  deck, rear block, throne, bass drum (damage states)
 * - `boss/ba-dum-behemoth/wreck`            the burnt hull with the burst skin (after the fight)
 * - `boss/ba-dum-behemoth/skin-flex`        2 frames: the skin bulging on BOOM (overlay)
 * - `boss/ba-dum-behemoth/tom-left-0|1|2`, `tom-right-0|1|2` 2 frames (idle, recoil); anchor =
 *                                           the bottom middle of the tom box; point `muzzle`
 * - `boss/ba-dum-behemoth/tom-stump`        the bracket with a torn shell
 * - `boss/ba-dum-behemoth/crash-shield-0|1|2` 5 frames: front … aside (0–3), 4 = the stand
 *                                           without its disc (thrown); anchor = the stand pivot
 * - `boss/ba-dum-behemoth/hihat-arm-0|1|2`  2 frames (closed, open); anchor = the bottom of the
 *                                           lower cymbal (feet)
 * - `boss/ba-dum-behemoth/beater`           2 frames (rest, pulled back); anchor = the pedal pivot
 * - `boss/ba-dum-behemoth/rimshot`          Colonel Rimshot (frames: RIM.*), feet anchor
 * - projectiles: `tom-shell` (4), `drumstick` (2), `cymbal-saw` (4), `wave` (3) — centre anchor
 */
import { drawText } from '../../../../engine/font';
import { PixelBuffer } from '../../../../engine/pixel';
import { INK, PAL, type Ramp } from '../../../../engine/palette';
import type { Frame } from '../../../../engine/render';
import { defineSprite } from '../../../../engine/sprites';
import { withPieces } from '../../../art/human-fx';
import { renderHuman, type HumanStyle, type Pose } from '../../../art/humanoid';
import * as P from '../../../art/poses';
import { damage, hazard, plate, tread } from '../../../art/machines';
import { crest } from '../../machines/armor/kit.art';
import { BEHEMOTH as B } from './geom';

const ART = 'boss/ba-dum-behemoth';

/** Body canvas: local x −128 … 127, y −180 … −1. */
const BW = 256;
const BH = 182;
const OX = 128;
const OY = 181;

const frame = (buf: PixelBuffer, ox: number, oy: number, pts?: Record<string, readonly [number, number]>): Frame =>
  pts ? { buf, ox, oy, pts } : { buf, ox, oy };

/** Shade the opaque pixels of `layer` by a vertical position (0 top … 1 bottom) into a ramp. */
function shadeV(layer: PixelBuffer, ramp: Ramp, y0: number, y1: number, cuts: readonly number[]): void {
  for (let y = 0; y < layer.h; y++) {
    const v = (y - y0) / Math.max(1, y1 - y0);
    let i = ramp.length - 1;
    for (let k = 0; k < cuts.length; k++) if (v > cuts[k]) i = ramp.length - 2 - k;
    const c = ramp[Math.max(0, i)];
    for (let x = 0; x < layer.w; x++) if ((layer.get(x, y) & 255) !== 0) layer.set(x, y, c);
  }
}

/** A thick shaded tube from (x0, y0) to (x1, y1) (lit side up). */
export function tube(b: PixelBuffer, x0: number, y0: number, x1: number, y1: number, w: number, ramp: Ramp): void {
  b.thickLine(x0, y0, x1, y1, w, ramp[1]);
  b.thickLine(x0, y0 - 1, x1, y1 - 1, Math.max(1, w - 2), ramp[2]);
  b.line(x0, y0 - Math.floor(w / 2) + 1, x1, y1 - Math.floor(w / 2) + 1, ramp[ramp.length - 1]);
}

// ---------------------------------------------------------------------------------------------
// Tread
// ---------------------------------------------------------------------------------------------

function treadFrame(phase: number): Frame {
  const b = new PixelBuffer(B.tread.w + 4, B.tread.h + 4);
  b.blit(tread(B.tread.w, B.tread.h, phase, { ramp: 'red', rim: 'steel', period: 3 }), 2, 2);
  // Gold side skirt over the upper run with rivets and a hazard band at the front.
  const skirt = plate(B.tread.w - 24, 7, 'red', { rivets: 'edges', spacing: 12 });
  b.blit(skirt, 14, 3);
  b.hline(14, B.tread.w - 11, 9, PAL.gold[2]);
  b.blit(hazard(18, 5, { stripe: 3 }), 16, 4);
  return frame(b.outline(INK), 2 - B.tread.x, B.tread.h + 2);
}

// ---------------------------------------------------------------------------------------------
// Hull, throne and the bass drum
// ---------------------------------------------------------------------------------------------

const X = (lx: number): number => lx + OX;
const Y = (ly: number): number => ly + OY;

/** The bass drum: shell (crimson lacquer, gold bands), lugs, hoop and the white skin with the crest. */
function drawDrum(b: PixelBuffer, torn: number): void {
  const [fcx, fcy] = B.skinC;
  const [rcx, rcy] = B.rearC;
  const [rx, ry] = B.skinR;
  // Shell silhouette: rear ellipse + the band to the front ellipse.
  const shell = new PixelBuffer(BW, BH);
  shell.ellipse(X(rcx - rx), Y(rcy - ry), rx * 2 + 1, ry * 2 + 1, PAL.red[2]);
  shell.poly(
    [
      [X(fcx), Y(fcy - ry)],
      [X(rcx), Y(rcy - ry)],
      [X(rcx), Y(rcy + ry)],
      [X(fcx), Y(fcy + ry)],
    ],
    PAL.red[2],
  );
  shadeV(shell, PAL.red, Y(rcy - ry), Y(fcy + ry), [0.1, 0.5, 0.86]);
  // Rear rim highlight (the far hoop shows as a thin gold arc on the right).
  for (let a = -80; a <= 80; a += 2) {
    const t = (a * Math.PI) / 180;
    shell.set(Math.round(X(rcx + Math.cos(t) * rx)), Math.round(Y(rcy + Math.sin(t) * ry)), a < -20 ? PAL.gold[3] : PAL.gold[1]);
    shell.set(Math.round(X(rcx + Math.cos(t) * (rx - 1))), Math.round(Y(rcy + Math.sin(t) * (ry - 1))), PAL.gold[0]);
  }
  // Gold wrap bands and the tension lugs, front hoop → rear hoop.
  for (const deg of [-62, -28, 6, 40, 70]) {
    const t = (deg * Math.PI) / 180;
    const x0 = fcx + Math.cos(t) * rx;
    const y0 = fcy + Math.sin(t) * ry;
    const x1 = rcx + Math.cos(t) * rx;
    const y1 = rcy + Math.sin(t) * ry;
    shell.line(X(x0), Y(y0), X(x1), Y(y1), PAL.gold[1]);
    shell.line(X(x0), Y(y0) - 1, X(x1), Y(y1) - 1, PAL.gold[2]);
    const mx = Math.round((x0 + x1) / 2);
    const my = Math.round((y0 + y1) / 2);
    shell.rect(X(mx) - 3, Y(my) - 2, 7, 4, PAL.steel[2]);
    shell.hline(X(mx) - 3, X(mx) + 3, Y(my) - 2, PAL.steel[4]);
    shell.hline(X(mx) - 3, X(mx) + 3, Y(my) + 1, PAL.steel[0]);
  }
  b.blit(shell, 0, 0);
  // Front hoop (gold, 3 px) and its lugs.
  b.ellipse(X(fcx - rx - 3), Y(fcy - ry - 3), rx * 2 + 7, ry * 2 + 7, PAL.gold[1]);
  b.ellipse(X(fcx - rx - 2), Y(fcy - ry - 2), rx * 2 + 5, ry * 2 + 5, PAL.gold[2]);
  for (let a = 0; a < 360; a += 4) {
    const t = (a * Math.PI) / 180;
    const lit = Math.cos(t) * -0.6 + Math.sin(t) * -0.8;
    if (lit > 0.35) b.set(Math.round(X(fcx + Math.cos(t) * (rx + 2))), Math.round(Y(fcy + Math.sin(t) * (ry + 2))), PAL.gold[3]);
    if (lit < -0.45) b.set(Math.round(X(fcx + Math.cos(t) * (rx + 2))), Math.round(Y(fcy + Math.sin(t) * (ry + 2))), PAL.gold[0]);
  }
  for (let k = 0; k < 10; k++) {
    const t = (k / 10) * Math.PI * 2 + 0.3;
    const lx = Math.round(X(fcx + Math.cos(t) * (rx + 3)));
    const ly = Math.round(Y(fcy + Math.sin(t) * (ry + 3)));
    b.rect(lx - 1, ly - 1, 3, 3, PAL.steel[2]);
    b.set(lx - 1, ly - 1, PAL.steel[4]);
    b.set(lx + 1, ly + 1, PAL.steel[0]);
  }
  // Skin: white, lit from the top-left, the crest and a crimson BA-DUM! ribbon.
  for (let y = -ry; y <= ry; y++) {
    for (let x = -rx; x <= rx; x++) {
      const e = (x * x) / (rx * rx) + (y * y) / (ry * ry);
      if (e > 1) continue;
      const l = (-x / rx) * 0.55 + (-y / ry) * 0.75;
      const edge = e > 0.86;
      let c = l > 0.45 ? PAL.snow[3] : l > -0.35 ? PAL.snow[2] : PAL.snow[1];
      if (edge && l < 0.2) c = PAL.snow[1];
      if (edge && l < -0.5) c = PAL.snow[0];
      b.set(X(fcx + x), Y(fcy + y), c);
    }
  }
  // The skin's soft centre dot (beater wear) and the crest (×3).
  const cr = new PixelBuffer(9, 11);
  crest(cr, 4, 5);
  b.blit(cr.scaled(3), X(fcx) - 13, Y(fcy) - 40);
  const rib = new PixelBuffer(54, 11);
  rib.rect(0, 1, 54, 9, PAL.red[2]);
  rib.hline(0, 53, 1, PAL.red[3]);
  rib.hline(0, 53, 9, PAL.red[0]);
  rib.poly([[0, 1], [4, 5], [0, 9]], 0);
  rib.poly([[53, 1], [49, 5], [53, 9]], 0);
  drawText(rib, 'BA-DUM!', 27, 2, { font: 'small', color: PAL.gold[3], align: 'center' });
  // The ribbon follows the skin's curve: clip it to the ellipse.
  for (let y = 0; y < rib.h; y++) {
    for (let x = 0; x < rib.w; x++) {
      const c = rib.get(x, y);
      if ((c & 255) === 0) continue;
      const lx = x - 27;
      const ly = y + 10 - 5;
      if ((lx * lx) / (rx * rx) + (ly * ly) / (ry * ry) > 0.92) continue;
      b.set(X(fcx + lx), Y(fcy + ly), c);
    }
  }
  if (torn > 0) {
    // A jagged tear across the skin (≤ 25 %) or a burst hole (the wreck).
    const big = torn > 1;
    for (let y = -ry + 6; y <= ry - 6; y++) {
      for (let x = -rx + 4; x <= rx - 4; x++) {
        const j = Math.sin(y * 0.9) * 3 + Math.sin(y * 2.3) * 2;
        const inTear = big ? (x * x) / 324 + ((y - 6) * (y - 6)) / 1600 < 1 + Math.sin(Math.atan2(y, x) * 7) * 0.18 : Math.abs(x + 4 - j) < 2 && y > -30 && y < 26;
        if (!inTear) continue;
        b.set(X(fcx + x), Y(fcy + y), PAL.ink[1]);
      }
    }
    // Torn flaps.
    if (big) {
      for (const [dx, dy, l] of [[-14, -28, 8], [12, -20, 6], [-16, 30, 7], [14, 34, 6]] as const) {
        b.thickLine(X(fcx + dx), Y(fcy + dy), X(fcx + dx + Math.sign(dx) * 3), Y(fcy + dy + l), 3, PAL.snow[1]);
      }
    }
  }
}

function hullFrame(state: 0 | 1 | 2 | 3): Frame {
  const b = new PixelBuffer(BW, BH);
  const wreck = state === 3;
  // Rear block: the kit case — steel box, crimson armour, gold grille, two brass exhaust bells.
  b.blit(plate(80, 40, 'steel', { rivets: 'edges', spacing: 8 }), X(16), Y(-78));
  b.blit(plate(34, 22, 'red', { rivets: 'corners' }), X(22), Y(-72));
  b.blit(plate(30, 22, 'red', { rivets: 'corners' }), X(60), Y(-72));
  for (let y = -68; y < -54; y += 3) b.hline(X(64), X(86), Y(y), PAL.gold[1]);
  b.hline(X(64), X(86), Y(-69), PAL.gold[3]);
  crest(b, X(39), Y(-61));
  for (const px of [70, 86]) {
    b.rect(X(px) - 2, Y(-100), 5, 24, PAL.gold[1]);
    b.vline(X(px) - 1, Y(-100), Y(-77), PAL.gold[3]);
    b.vline(X(px) + 2, Y(-100), Y(-77), PAL.gold[0]);
    // The bell flares at the top.
    b.poly([[X(px) - 7, Y(-108)], [X(px) + 7, Y(-108)], [X(px) + 2, Y(-100)], [X(px) - 2, Y(-100)]], PAL.gold[2]);
    b.hline(X(px) - 7, X(px) + 7, Y(-108), PAL.gold[3]);
    b.hline(X(px) - 5, X(px) + 5, Y(-107), PAL.ink[1]);
  }
  // Bunting across the rear block.
  for (let k = 0; k < 7; k++) {
    const x = X(18 + k * 11);
    const c = k % 3 === 0 ? PAL.gold[2] : k % 3 === 1 ? PAL.snow[3] : PAL.red[3];
    b.poly([[x, Y(-80)], [x + 8, Y(-80)], [x + 4, Y(-74)]], c);
  }
  b.hline(X(16), X(96), Y(-81), PAL.brown[1]);
  // Deck plate over the tread.
  const deck = plate(B.deck.w, B.deck.h, 'steel', { rivets: 'edges', spacing: 10 });
  b.blit(deck, X(B.deck.x), Y(B.deck.y));
  b.blit(hazard(B.deck.w - 8, 3, { stripe: 3 }), X(B.deck.x + 4), Y(B.deck.y + 8));
  // Throne: a chrome hydraulic post with a crimson cushion.
  const [tx, ty] = B.throne;
  b.rect(X(tx) - 2, Y(ty + 4), 5, -ty - 44, PAL.steel[2]);
  b.vline(X(tx) - 2, Y(ty + 4), Y(-41), PAL.steel[4]);
  b.vline(X(tx) + 2, Y(ty + 4), Y(-41), PAL.steel[1]);
  b.rect(X(tx) - 4, Y(-62), 9, 6, PAL.steel[1]);
  b.hline(X(tx) - 4, X(tx) + 4, Y(-62), PAL.steel[3]);
  b.ellipse(X(tx) - 12, Y(ty), 25, 8, PAL.red[1]);
  b.ellipse(X(tx) - 11, Y(ty), 23, 6, PAL.red[2]);
  b.hline(X(tx) - 8, X(tx) + 4, Y(ty + 1), PAL.red[3]);
  b.rect(X(tx) - 9, Y(ty + 6), 19, 2, PAL.gold[1]);
  // The bass drum on the front of the deck.
  drawDrum(b, state === 2 ? 1 : wreck ? 2 : 0);
  let out = b.outline(INK);
  if (state === 1) out = damage(out, 0.3, 21);
  if (state === 2) out = damage(out, 0.7, 22);
  if (wreck) {
    out = damage(out, 1.6, 23);
    // Burnt: darken every colour one or two shades.
    for (let i = 0; i < out.data.length; i++) {
      const c = out.data[i];
      if ((c & 255) === 0 || c === INK) continue;
      const k = ((i * 7) % 5) < 2 ? 2 : 1;
      let d = c;
      for (let s = 0; s < k; s++) d = darker(d);
      out.data[i] = d;
    }
    out.touch();
  }
  return frame(out, OX, OY);
}

/** One step darker along the colour's ramp (approximate for the wreck). */
function darker(c: number): number {
  for (const ramp of Object.values(PAL) as Ramp[]) {
    const i = ramp.indexOf(c);
    if (i > 0) return ramp[i - 1];
    if (i === 0) return ramp === PAL.ink ? c : PAL.ink[1];
  }
  return c;
}

/** BOOM: the skin bulges (a lighter oval and ripple rings), drawn over the drum. */
function skinFlex(k: number): Frame {
  const [fcx, fcy] = B.skinC;
  const [rx, ry] = B.skinR;
  const b = new PixelBuffer(BW, BH);
  const s = k === 0 ? 0.55 : 0.8;
  b.ellipse(X(fcx - rx * s), Y(fcy - ry * s), Math.round(rx * s * 2), Math.round(ry * s * 2), PAL.snow[3], false);
  b.ellipse(X(fcx - rx * s * 0.6), Y(fcy - ry * s * 0.6), Math.round(rx * s * 1.2), Math.round(ry * s * 1.2), PAL.snow[3], false);
  b.ellipse(X(fcx - 6), Y(fcy - 10), 13, 21, PAL.snow[3]);
  return frame(b, OX, OY);
}

/** Hit flash of the bass drum: the skin and its hoop in white (the rest of the hull stays). */
function skinFlash(): Frame {
  const [fcx, fcy] = B.skinC;
  const [rx, ry] = B.skinR;
  const b = new PixelBuffer(BW, BH);
  b.ellipse(X(fcx - rx - 3), Y(fcy - ry - 3), rx * 2 + 7, ry * 2 + 7, PAL.snow[3]);
  return frame(b, OX, OY);
}

// ---------------------------------------------------------------------------------------------
// Toms
// ---------------------------------------------------------------------------------------------

const TOM_W = 44;
const TOM_H = 48;
const TOX = 22;
const TOY = 40;
/** Mortar tube base and direction (up-left) relative to the tom anchor. */
const TUBE = { bx: -4, by: -22, dx: -0.5, dy: -0.87, len: 14 } as const;

function tomFrame(state: 0 | 1 | 2, recoil: number): Frame {
  const b = new PixelBuffer(TOM_W, TOM_H);
  const cx = TOX;
  const top = TOY - 24;
  // Bracket clamp down to the drum hoop.
  b.rect(cx - 2, TOY - 2, 5, 8, PAL.steel[2]);
  b.vline(cx - 2, TOY - 2, TOY + 5, PAL.steel[4]);
  // Mortar tube (drawn first: the top skin covers its root).
  const len = TUBE.len - recoil * 3;
  const tx = cx + TUBE.bx + TUBE.dx * len;
  const ty = TOY + TUBE.by + TUBE.dy * len;
  tube(b, cx + TUBE.bx, TOY + TUBE.by, Math.round(tx), Math.round(ty), 6, PAL.gold);
  b.ellipse(Math.round(tx) - 4, Math.round(ty) - 3, 8, 6, PAL.gold[3]);
  b.ellipse(Math.round(tx) - 2, Math.round(ty) - 2, 4, 3, PAL.ink[1]);
  // Shell: crimson cylinder, gold hoops at top and bottom, lugs.
  const shell = new PixelBuffer(TOM_W, TOM_H);
  shell.rect(cx - 16, top + 3, 32, 19, PAL.red[2]);
  shell.ellipse(cx - 16, top + 18, 32, 7, PAL.red[2]);
  for (let x = cx - 16; x < cx + 16; x++) {
    const v = (x - (cx - 16)) / 32;
    const c = v < 0.18 ? PAL.red[3] : v < 0.62 ? PAL.red[2] : v < 0.9 ? PAL.red[1] : PAL.red[0];
    for (let y = top + 3; y < top + 25; y++) if ((shell.get(x, y) & 255) !== 0) shell.set(x, y, c);
  }
  b.blit(shell, 0, 0);
  b.hline(cx - 16, cx + 15, top + 20, PAL.gold[1]);
  b.hline(cx - 15, cx + 14, top + 21, PAL.gold[2]);
  for (const lx of [cx - 11, cx - 3, cx + 5, cx + 12]) {
    b.rect(lx, top + 9, 2, 6, PAL.gold[1]);
    b.set(lx, top + 9, PAL.gold[3]);
  }
  // Top skin + hoop.
  b.ellipse(cx - 17, top, 34, 8, PAL.gold[2]);
  b.ellipse(cx - 15, top + 1, 30, 6, PAL.snow[2]);
  b.hline(cx - 10, cx + 2, top + 2, PAL.snow[3]);
  // The tube's mouth pokes through the skin.
  b.ellipse(cx + TUBE.bx - 3, TOY + TUBE.by - 2, 7, 4, PAL.gold[1]);
  let out = b.outline(INK);
  if (state === 1) out = damage(out, 0.5, 31 + recoil);
  if (state === 2) {
    out = damage(out, 1.2, 33 + recoil);
    // A crack down the shell.
    out.line(cx + 3, top + 4, cx - 2, top + 14, PAL.ink[1]);
    out.line(cx - 2, top + 14, cx + 4, top + 22, PAL.ink[1]);
  }
  return frame(out, TOX, TOY, { muzzle: [Math.round(tx) - TOX, Math.round(ty) - TOY] });
}

/** Destroyed tom: the bracket and a torn half-shell. */
function tomStump(): Frame {
  const b = new PixelBuffer(TOM_W, TOM_H);
  const cx = TOX;
  b.rect(cx - 2, TOY - 8, 5, 14, PAL.steel[1]);
  b.vline(cx - 2, TOY - 8, TOY + 5, PAL.steel[3]);
  b.poly([[cx - 14, TOY - 2], [cx - 10, TOY - 12], [cx - 4, TOY - 7], [cx + 2, TOY - 14], [cx + 8, TOY - 6], [cx + 14, TOY - 9], [cx + 14, TOY - 2]], PAL.red[0]);
  b.hline(cx - 14, cx + 14, TOY - 2, PAL.gold[0]);
  b.hline(cx - 13, cx + 13, TOY - 1, PAL.gold[1]);
  return frame(b.outline(INK), TOX, TOY);
}

// ---------------------------------------------------------------------------------------------
// Crash shield
// ---------------------------------------------------------------------------------------------

const CS_W = 112;
const CS_H = 172;
const CSX = 52;
const CSY = 96;

/** The cymbal disc (gold, grooves, the bell) inscribed in a w × h box centred on (cx, cy). */
function cymbalDisc(b: PixelBuffer, cx: number, cy: number, w: number, h: number): void {
  const x0 = Math.round(cx - w / 2);
  const y0 = Math.round(cy - h / 2);
  b.ellipse(x0, y0, w, h, PAL.gold[1]);
  b.ellipse(x0 + 1, y0 + 1, w - 2, h - 2, PAL.gold[2]);
  // Lit upper-left arc, dark lower-right arc.
  for (let a = 0; a < 360; a += 3) {
    const t = (a * Math.PI) / 180;
    const lit = -Math.cos(t) * 0.6 - Math.sin(t) * 0.8;
    const px = Math.round(cx + (Math.cos(t) * (w - 3)) / 2);
    const py = Math.round(cy + (Math.sin(t) * (h - 3)) / 2);
    if (lit > 0.3) b.set(px, py, PAL.gold[3]);
    else if (lit < -0.4) b.set(px, py, PAL.gold[0]);
  }
  // Lathe grooves.
  for (const f of [0.7, 0.45]) b.ellipse(Math.round(cx - (w * f) / 2), Math.round(cy - (h * f) / 2), Math.round(w * f), Math.round(h * f), PAL.gold[1], false);
  // The bell and its nut.
  const bw = Math.max(5, Math.round(w * 0.24));
  const bh = Math.max(5, Math.round(h * 0.24));
  b.ellipse(Math.round(cx - bw / 2), Math.round(cy - bh / 2), bw, bh, PAL.gold[3]);
  b.rect(Math.round(cx) - 1, Math.round(cy) - 1, 3, 3, PAL.steel[1]);
}

function shieldFrame(state: 0 | 1 | 2, k: number): Frame {
  const b = new PixelBuffer(CS_W, CS_H);
  const [px, py] = B.shieldPivot;
  const t = Math.min(1, k / 3);
  const cx = B.shieldFront[0] + (B.shieldAside[0] - B.shieldFront[0]) * t - px;
  const cy = B.shieldFront[1] + (B.shieldAside[1] - B.shieldFront[1]) * t - py;
  // The stand: a chrome rod from the pivot (a clamp on the hoop) to the disc.
  b.rect(CSX - 3, CSY - 3, 7, 7, PAL.steel[1]);
  b.rect(CSX - 2, CSY - 2, 5, 5, PAL.steel[3]);
  tube(b, CSX, CSY, Math.round(CSX + cx), Math.round(CSY + cy), 3, PAL.steel);
  if (k < 4) {
    const w = Math.round(B.shieldFrontBox.w + (B.shieldAsideBox.w - B.shieldFrontBox.w) * t);
    const h = Math.round(56 + (B.shieldAsideBox.h - 56) * t);
    cymbalDisc(b, CSX + cx, CSY + cy, w, h);
  }
  let out = b.outline(INK);
  if (state === 1) out = damage(out, 0.15, 41 + k);
  if (state === 2) {
    out = damage(out, 0.4, 43 + k);
    // A chipped notch.
    if (k < 4) out.ellipse(Math.round(CSX + cx) - 2, Math.round(CSY + cy) + 4, 5, 5, 0);
  }
  return frame(out, CSX, CSY);
}

// ---------------------------------------------------------------------------------------------
// Hi-hat head
// ---------------------------------------------------------------------------------------------

function hihatFrame(state: 0 | 1 | 2, open: number): Frame {
  const W = 46;
  const H = 46;
  const b = new PixelBuffer(W, H);
  const cx = 23;
  const base = H - 2;
  // Clutch rod (to the wrist) and the clutch.
  b.rect(cx - 1, base - B.hihatRod - 2, 3, B.hihatRod - 4, PAL.steel[2]);
  b.vline(cx - 1, base - B.hihatRod - 2, base - 6, PAL.steel[4]);
  // Lower cymbal (cup up), upper cymbal (cup down), a gap when open.
  const lowY = base - 6;
  const upY = base - 12 - open * 8;
  cymbalDisc(b, cx, lowY + 3, 40, 6);
  b.rect(cx - 3, lowY - 2, 7, 3, PAL.gold[2]);
  cymbalDisc(b, cx, upY + 3, 40, 6);
  b.rect(cx - 3, upY + 5, 7, 3, PAL.gold[1]);
  b.rect(cx - 2, upY - 3, 5, 4, PAL.steel[1]);
  b.hline(cx - 2, cx + 2, upY - 3, PAL.steel[3]);
  // Crush teeth under the lower cymbal (it is a weapon after all).
  for (let x = cx - 16; x <= cx + 14; x += 6) b.poly([[x, base - 3], [x + 4, base - 3], [x + 2, base - 1]], PAL.steel[3]);
  let out = b.outline(INK);
  if (state === 1) out = damage(out, 0.4, 51 + open);
  if (state === 2) {
    out = damage(out, 0.9, 53 + open);
    out.line(cx + 6, upY + 1, cx + 14, upY + 5, PAL.ink[1]);
  }
  return frame(out, cx, base);
}

// ---------------------------------------------------------------------------------------------
// Beater pedal
// ---------------------------------------------------------------------------------------------

function beaterFrame(k: number): Frame {
  const W = 52;
  const H = 52;
  const ox = 26;
  const oy = 46;
  const b = new PixelBuffer(W, H);
  // Ball position relative to the pivot (rest: against the rear skin; pulled back).
  const [bx, by] = k === 0 ? [-16, -30] : [16, -34];
  // Footboard and spring.
  b.blit(plate(18, 4, 'steel', { rivets: 'none' }), ox - 4, oy - 4);
  b.rect(ox - 2, oy - 10, 4, 7, PAL.steel[1]);
  for (let y = oy - 10; y < oy - 3; y += 2) b.hline(ox + 3, ox + 6, y, PAL.gold[2]);
  tube(b, ox, oy - 8, ox + bx, oy + by, 3, PAL.steel);
  // Felt ball (cloth) on a brass collar.
  b.circle(ox + bx, oy + by, 5, PAL.cloth[1]);
  b.circle(ox + bx - 1, oy + by - 1, 3, PAL.cloth[2]);
  b.set(ox + bx - 2, oy + by - 2, PAL.cloth[3]);
  b.rect(ox + bx - 1, oy + by + 4, 3, 3, PAL.gold[2]);
  return frame(b.outline(INK), ox, oy);
}

// ---------------------------------------------------------------------------------------------
// Colonel Rimshot
// ---------------------------------------------------------------------------------------------

export const RIMSHOT_STYLE: HumanStyle = {
  skin: 'skinA',
  hair: 'hairA',
  hairStyle: 'parted',
  headgear: 'none',
  gear: 'red',
  accent: 'gold',
  top: 'red',
  topType: 'jacket',
  shirt: 'cloth',
  pants: 'black',
  boots: 'black',
  gloves: 'cloth',
  belt: 'black',
  build: 'heavy',
  accessories: ['bowtie', 'epaulettes'],
  face: ['moustache'],
};

/** Frame indices of `boss/ba-dum-behemoth/rimshot`. */
export const RIM = {
  sit: 0,
  sitTalk: 1,
  sitPlay: 2,
  stand: 3,
  standTalk: 4,
  throwUp: 5,
  crawlA: 6,
  crawlB: 7,
  dustA: 8,
  dustB: 9,
  sitPlayB: 10,
} as const;

const L = (hip: number, knee: number, foot?: number) => (foot === undefined ? { hip, knee } : { hip, knee, foot });
const SIT_LEGS: Pose = { legN: L(84, 88), legF: L(78, 92) };

/** A drumstick piece at angle `deg` (0 = pointing right, + = clockwise), 14 px. */
function stickPiece(deg: number): PixelBuffer {
  const b = new PixelBuffer(20, 20);
  const t = (deg * Math.PI) / 180;
  const x1 = 10 + Math.cos(t) * 8;
  const y1 = 10 + Math.sin(t) * 8;
  const x0 = 10 - Math.cos(t) * 6;
  const y0 = 10 - Math.sin(t) * 6;
  b.thickLine(Math.round(x0), Math.round(y0), Math.round(x1), Math.round(y1), 2, PAL.sand[2]);
  b.set(Math.round(x1), Math.round(y1), PAL.sand[3]);
  return b.outline(INK);
}

/** Stripes on the red jacket: every other 2-px column becomes warm white. */
function stripeJacket(f: Frame): Frame {
  const b = f.buf.clone();
  const map = new Map<number, number>([
    [PAL.red[1], PAL.cloth[1]],
    [PAL.red[2], PAL.cloth[2]],
    [PAL.red[3], PAL.cloth[3]],
    [PAL.red[0], PAL.cloth[0]],
  ]);
  for (let y = 0; y < b.h; y++) {
    for (let x = 0; x < b.w; x++) {
      const c = b.get(x, y);
      const to = map.get(c);
      if (to !== undefined && ((x - f.ox) & 3) < 2 && y < f.oy - 4) b.set(x, y, to);
    }
  }
  return { ...f, buf: b };
}

function rimshotFrame(i: number): Frame {
  const sitting = i <= RIM.sitPlay || i === RIM.sitPlayB;
  let pose: Pose;
  let sticks: [number, number][] = [];
  switch (i) {
    case RIM.sit:
      pose = { ...SIT_LEGS, armN: { sh: 40, el: 70, hand: 'grip' }, armF: { sh: 30, el: 80, hand: 'grip' }, expr: 'happy' };
      sticks = [[-30, 0], [-40, 1]];
      break;
    case RIM.sitTalk:
      pose = { ...SIT_LEGS, armN: { sh: 120, el: 40, hand: 'grip' }, armF: { sh: 30, el: 80, hand: 'grip' }, expr: 'shout' };
      sticks = [[-80, 0], [-40, 1]];
      break;
    case RIM.sitPlay:
      pose = { ...SIT_LEGS, armN: { sh: 70, el: 30, hand: 'grip' }, armF: { sh: 20, el: 50, hand: 'grip' }, expr: 'happy', lean: 6 };
      sticks = [[10, 0], [-20, 1]];
      break;
    case RIM.sitPlayB:
      pose = { ...SIT_LEGS, armN: { sh: 30, el: 60, hand: 'grip' }, armF: { sh: 60, el: 30, hand: 'grip' }, expr: 'happy', lean: 6 };
      sticks = [[-20, 0], [10, 1]];
      break;
    case RIM.stand:
      pose = { ...P.STAND, armN: { sh: 30, el: 60, hand: 'grip' }, armF: { sh: 20, el: 70, hand: 'grip' }, expr: 'happy' };
      sticks = [[-30, 0], [-40, 1]];
      break;
    case RIM.standTalk:
      pose = { ...P.STAND, armN: { sh: 150, el: 20, hand: 'grip' }, armF: { sh: 20, el: 70, hand: 'grip' }, expr: 'shout' };
      sticks = [[-90, 0], [-40, 1]];
      break;
    case RIM.throwUp:
      pose = { ...P.STAND, armN: { sh: 175, el: 5, hand: 'open' }, armF: { sh: 165, el: 10, hand: 'open' }, expr: 'shout', head: { dx: 0, dy: 0, tilt: -8 } };
      break;
    case RIM.crawlA:
    case RIM.crawlB: {
      const a = i === RIM.crawlA;
      pose = {
        ...P.CROUCH,
        lean: 50,
        armN: { to: a ? [10, 14] : [6, 16], hand: 'open' },
        armF: { to: a ? [4, 16] : [10, 14], hand: 'open' },
        expr: 'dazed',
      };
      break;
    }
    default: {
      const a = i === RIM.dustA;
      pose = { ...P.STAND, armN: { to: a ? [4, 8] : [2, 12], hand: 'open' }, armF: { sh: -10, el: 20, hand: 'open' }, expr: a ? 'soot' : 'normal', lean: 4 };
      break;
    }
  }
  let f: Frame = renderHuman(RIMSHOT_STYLE, sitting ? { ...pose, grounded: true } : pose, 'full');
  f = stripeJacket(f);
  const hand = (f.pts as Record<string, readonly [number, number]> | undefined)?.hand;
  if (hand && sticks.length) {
    f = withPieces(f, sticks.map(([deg, k]) => ({ buf: stickPiece(deg), x: hand[0] - 10 + k * 3, y: hand[1] - 10 - k, behind: k === 1 })));
  }
  return f;
}

// ---------------------------------------------------------------------------------------------
// Projectiles
// ---------------------------------------------------------------------------------------------

function tomShell(k: number): Frame {
  const b = new PixelBuffer(12, 12);
  const t = (k / 4) * Math.PI;
  b.circle(6, 6, 4, PAL.red[2]);
  b.circle(5, 5, 2, PAL.red[3]);
  // A gold band that turns with the spin.
  b.line(Math.round(6 - Math.cos(t) * 4), Math.round(6 - Math.sin(t) * 4), Math.round(6 + Math.cos(t) * 4), Math.round(6 + Math.sin(t) * 4), PAL.gold[2]);
  b.set(4, 4, PAL.snow[3]);
  return frame(b.outline(INK), 6, 6);
}

function drumstick(k: number): Frame {
  const b = new PixelBuffer(8, 20);
  b.rect(3, 2, 2, 15, PAL.sand[2]);
  b.vline(3, 2, 16, PAL.sand[3]);
  // The tip (bead) points down; a red grip band at the top.
  b.rect(2, 16, 4, 3, PAL.sand[3]);
  b.rect(3, 2, 2, 3, k === 0 ? PAL.red[2] : PAL.red[3]);
  return frame(b.outline(INK), 4, 10);
}

function sawFrame(k: number): Frame {
  const b = new PixelBuffer(30, 12);
  cymbalDisc(b, 15, 6, 26, 8);
  // Spinning glints and saw teeth on the rim.
  for (let i = 0; i < 6; i++) {
    const x = 3 + ((i * 4 + k) % 24);
    b.set(x, 2, PAL.snow[3]);
    b.set(x + 1, 9, PAL.gold[0]);
  }
  b.set(1, 6, PAL.steel[4]);
  b.set(28, 6, PAL.steel[4]);
  return frame(b.outline(INK), 15, 6);
}

/** Ground shockwave: a sand-and-gold pressure wall, `h` px tall. */
export function waveFrame(k: number, h: number, width = h): Frame {
  const w = Math.max(10, width);
  const b = new PixelBuffer(w + 4, h + 4);
  const sway = k - 1;
  b.poly([[2, h + 2], [Math.round(w / 2) + 2 + sway, 2], [w + 1, h + 2]], PAL.sand[2]);
  b.poly([[4, h + 2], [Math.round(w / 2) + 2 + sway, 5], [w - 1, h + 2]], PAL.sand[3]);
  b.line(Math.round(w / 2) + 2 + sway, 2, Math.round(w / 2) + 2 + sway, h, PAL.gold[3]);
  b.hline(2, w + 1, h + 1, PAL.sand[1]);
  return frame(b.outline(INK), (w + 4) >> 1, (h + 4) >> 1);
}

// ---------------------------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------------------------

const S3 = [0, 1, 2] as const;

defineSprite(`${ART}/tread`, () => [0, 1, 2].map(treadFrame), { ticksPerFrame: 4 });
for (const s of S3) defineSprite(`${ART}/bass-drum-${s}`, () => [hullFrame(s)], { ticksPerFrame: 60 });
defineSprite(`${ART}/wreck`, () => [hullFrame(3)], { ticksPerFrame: 60 });
defineSprite(`${ART}/skin-flash`, () => [skinFlash()], { ticksPerFrame: 60 });
defineSprite(`${ART}/skin-flex`, () => [skinFlex(0), skinFlex(1)], { ticksPerFrame: 4 });
for (const s of S3) {
  const gen = (): Frame[] => [tomFrame(s, 0), tomFrame(s, 1)];
  defineSprite(`${ART}/tom-left-${s}`, gen, { ticksPerFrame: 6 });
  defineSprite(`${ART}/tom-right-${s}`, gen, { ticksPerFrame: 6 });
  defineSprite(`${ART}/crash-shield-${s}`, () => [0, 1, 2, 3, 4].map((k) => shieldFrame(s, k)), { ticksPerFrame: 4 });
  defineSprite(`${ART}/hihat-arm-${s}`, () => [hihatFrame(s, 0), hihatFrame(s, 1)], { ticksPerFrame: 6 });
}
defineSprite(`${ART}/tom-stump`, () => [tomStump()], { ticksPerFrame: 60 });
defineSprite(`${ART}/beater`, () => [beaterFrame(0), beaterFrame(1)], { ticksPerFrame: 8 });
defineSprite(`${ART}/rimshot`, () => Array.from({ length: 11 }, (_, i) => rimshotFrame(i)), { ticksPerFrame: 8 });
defineSprite(`${ART}/tom-shell`, () => [0, 1, 2, 3].map(tomShell), { ticksPerFrame: 3 });
defineSprite(`${ART}/drumstick`, () => [drumstick(0), drumstick(1)], { ticksPerFrame: 4 });
defineSprite(`${ART}/cymbal-saw`, () => [0, 1, 2, 3].map(sawFrame), { ticksPerFrame: 2 });
defineSprite(`${ART}/wave`, () => [0, 1, 2].map((k) => waveFrame(k, 12, 18)), { ticksPerFrame: 3 });

/** Tom mortar mouth relative to the tom anchor (frame 0). */
export const TOM_MUZZLE: readonly [number, number] = [Math.round(TUBE.bx + TUBE.dx * TUBE.len), Math.round(TUBE.by + TUBE.dy * TUBE.len)];
/** Local bottom-middle anchors of the toms (the tom boxes stand on these). */
export const TOM_ANCHORS = {
  left: [B.tomLeft.x + B.tomLeft.w / 2, B.tomLeft.y + B.tomLeft.h] as const,
  right: [B.tomRight.x + B.tomRight.w / 2, B.tomRight.y + B.tomRight.h] as const,
};
