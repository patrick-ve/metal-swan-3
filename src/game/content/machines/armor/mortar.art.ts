/**
 * `gramophone-mortar` art (`machine/gramophone-mortar/…`): an original field gramophone. A brown
 * wooden cabinet on brass feet with a crimson front panel, gold trim and the Legion crest, a crank
 * on its side, a black record on the deck with a gold tonearm, and a big brass flower horn.
 * Feet anchor; the horn strip shares it (the horn pivot is `MORTAR.pivot`).
 *
 * Strips: `body` (3f: 0 tonearm up; 1–2 needle down, the record wobbling — the scratch), `dent`
 * (the dented-plate overlay), `horn` (5f: 45°, 55°, 65°, 75°, 85° above the horizon), `wreck`
 * (2f: no horn, the record still turning), `record` (4f, centre: a spinning vinyl record in
 * flight), `record-roll` (4f, centre: the record wobbling along the floor, 6 px tall),
 * `horn-top` (4f, centre: the fallen horn spinning on its point like a top).
 */
import { PixelBuffer } from '../../../../engine/pixel';
import { INK, PAL } from '../../../../engine/palette';
import type { Frame } from '../../../../engine/render';
import { defineSprite } from '../../../../engine/sprites';
import { rivet } from '../../../art/machines';
import { Composer, shadeLayer } from '../../../art/paint';
import { MORTAR } from './geom';
import { crest, dentOverlay, fr, horn } from './kit.art';
import { trimmed } from './tank.art';

const ART = 'machine/gramophone-mortar';

/** Buffer layout: the feet anchor at (OX, OY). */
const W = 52;
const H = 50;
const OX = 22;
const OY = 48;
const X = (dx: number): number => OX + dx;
const Y = (dy: number): number => OY + dy;

/** Vinyl colours: the disc, its grooves, the crimson label. */
const VINYL = PAL.ink[1];
const GROOVE = PAL.black[2];

// ------------------------------------------------------------------------------------ body

/** The cabinet: wood box, crimson front panel with gold trim and crest, brass feet and crank. */
function cabinetLayer(): PixelBuffer {
  const b = new PixelBuffer(W, H);
  b.rect(X(-15), Y(-17), 30, 15, PAL.brown[2]);
  shadeLayer(b, PAL.brown, { hi: 1, lo: 1 });
  // A moulded lid edge.
  b.hline(X(-16), X(15), Y(-17), PAL.brown[3]);
  b.hline(X(-15), X(14), Y(-16), PAL.brown[1]);
  // Crimson front panel inside a gold frame.
  b.rect(X(-12), Y(-14), 24, 9, PAL.gold[1]);
  b.hline(X(-12), X(11), Y(-14), PAL.gold[3]);
  b.vline(X(-12), Y(-14), Y(-6), PAL.gold[2]);
  b.rect(X(-11), Y(-13), 22, 7, PAL.red[2]);
  b.hline(X(-11), X(10), Y(-13), PAL.red[3]);
  b.hline(X(-11), X(10), Y(-7), PAL.red[1]);
  crest(b, X(0), Y(-10));
  // A little speaker grille either side of the crest.
  for (const gx of [-8, 5]) for (let k = 0; k < 3; k++) b.vline(X(gx + k), Y(-12), Y(-8), k === 1 ? PAL.red[1] : PAL.red[0]);
  rivet(b, X(-14), Y(-5), PAL.brown);
  rivet(b, X(12), Y(-5), PAL.brown);
  // Brass feet.
  for (const fx of [-14, 10]) {
    b.rect(X(fx), Y(-2), 4, 2, PAL.gold[1]);
    b.hline(X(fx), X(fx + 2), Y(-2), PAL.gold[2]);
  }
  return b;
}

/** The crank on the cabinet's right side (the far side: one shade darker). */
function crankLayer(): PixelBuffer {
  const b = new PixelBuffer(W, H);
  b.rect(X(15), Y(-11), 3, 2, PAL.gold[1]);
  b.rect(X(17), Y(-11), 2, 6, PAL.gold[1]);
  b.rect(X(18), Y(-6), 3, 2, PAL.brown[1]);
  b.set(X(17), Y(-11), PAL.gold[2]);
  return b;
}

/** The record on the deck (seen almost edge-on) with its label; `wobble` shifts it. */
function deckLayer(wobble: number): PixelBuffer {
  const b = new PixelBuffer(W, H);
  // Platter rim (crimson felt) under the disc.
  b.rect(X(-12), Y(-19), 24, 2, PAL.red[1]);
  b.ellipse(X(-11), Y(-21 - (wobble > 0 ? 1 : 0)), 22, 4, VINYL);
  b.hline(X(-8), X(7), Y(-20 - (wobble > 0 ? 1 : 0)), GROOVE);
  const lx = wobble === 2 ? 2 : -2;
  b.rect(X(lx - 2), Y(-20 - (wobble > 0 ? 1 : 0)), 4, 1, PAL.red[2]);
  b.set(X(lx), Y(-20 - (wobble > 0 ? 1 : 0)), PAL.snow[3]);
  return b;
}

/** The gold tonearm on its post at the back right: lifted, or with the needle on the record. */
function tonearmLayer(down: boolean): PixelBuffer {
  const b = new PixelBuffer(W, H);
  b.rect(X(9), Y(-22), 3, 4, PAL.gold[1]);
  b.set(X(9), Y(-22), PAL.gold[3]);
  if (down) {
    b.line(X(10), Y(-23), X(3), Y(-22), PAL.gold[2]);
    b.line(X(10), Y(-24), X(3), Y(-23), PAL.gold[3]);
    b.rect(X(1), Y(-23), 3, 2, PAL.steel[3]);
  } else {
    b.line(X(10), Y(-23), X(5), Y(-28), PAL.gold[2]);
    b.line(X(11), Y(-24), X(6), Y(-29), PAL.gold[3]);
    b.rect(X(3), Y(-30), 3, 2, PAL.steel[3]);
  }
  return b;
}

function bodyFrame(f: number): Frame {
  const c = new Composer(W, H);
  c.add(crankLayer(), { ramp: PAL.gold });
  c.add(cabinetLayer(), { ramp: PAL.brown });
  c.add(deckLayer(f), { ramp: PAL.black });
  c.add(tonearmLayer(f > 0), { ramp: PAL.gold });
  return fr(c.finish(), OX, OY);
}

// ------------------------------------------------------------------------------------ horn

/** The flower horn at an elevation (degrees above the horizon), its elbow on the pivot. */
function hornFrame(deg: number): Frame {
  const c = new Composer(W, H);
  const a = (-deg * Math.PI) / 180;
  const px = X(MORTAR.pivot[0]);
  const py = Y(MORTAR.pivot[1]);
  // The elbow: a short brass neck down into the deck.
  const neck = new PixelBuffer(W, H);
  neck.rect(px - 1, py, 3, 3, PAL.gold[1]);
  neck.circle(px, py, 2, PAL.gold[2]);
  neck.set(px - 1, py - 1, PAL.gold[3]);
  c.add(neck, { ramp: PAL.gold });
  const h = new PixelBuffer(W, H);
  horn(h, px, py, a, MORTAR.hornLen, 2, 11, { ramp: 'gold', petals: true, depth: 3, flare: 1.9, bands: [0.15] });
  c.add(h, { ramp: PAL.gold });
  return fr(c.finish(), OX, OY);
}

// ------------------------------------------------------------------------------------ wreck

function wreckFrame(f: number): Frame {
  const c = new Composer(W, H);
  const cab = cabinetLayer();
  // The front panel is split and scorched.
  cab.line(X(-6), Y(-14), X(-1), Y(-6), PAL.ink[1]);
  cab.line(X(-5), Y(-14), X(0), Y(-6), PAL.brown[0]);
  for (let y = -16; y <= -4; y++) for (let x = -14; x <= 13; x++) if (((x * 3 + y * 5) & 7) === 0 && (x + y) % 3 !== 0) cab.set(X(x), Y(y), PAL.ink[1]);
  c.add(cab, { ramp: PAL.brown });
  c.add(deckLayer(f === 0 ? 1 : 2), { ramp: PAL.black });
  // The elbow stub where the horn broke off.
  const stub = new PixelBuffer(W, H);
  stub.rect(X(MORTAR.pivot[0]) - 1, Y(MORTAR.pivot[1]) - 3, 3, 4, PAL.rust[2]);
  stub.set(X(MORTAR.pivot[0]), Y(MORTAR.pivot[1]) - 3, PAL.ink[1]);
  c.add(stub, { ramp: PAL.rust });
  return fr(c.finish(), OX, OY);
}

// ------------------------------------------------------------------------------------ records

/** A vinyl disc face-on (r 5): grooves, a crimson label and a glint that turns with `k`. */
function discFace(k: number): PixelBuffer {
  const b = new PixelBuffer(15, 15);
  const C = 7;
  b.circle(C, C, 5, VINYL);
  b.circle(C, C, 4, GROOVE, false);
  b.circle(C, C, 2, PAL.red[2]);
  b.set(C - 1, C - 1, PAL.red[3]);
  b.set(C, C, PAL.snow[3]);
  // The glint: two light pixels on the grooves at quarter-turn steps.
  const t = (k * Math.PI) / 2 - Math.PI * 0.75;
  b.set(Math.round(C + Math.cos(t) * 4), Math.round(C + Math.sin(t) * 4), PAL.steel[3]);
  b.set(Math.round(C + Math.cos(t + 0.35) * 4), Math.round(C + Math.sin(t + 0.35) * 4), PAL.steel[2]);
  return b.outline(INK);
}

function recordFrames(): Frame[] {
  return [0, 1, 2, 3].map((k) => fr(discFace(k), 7, 7));
}

/** The record wobbling along the floor on its rim: a tilted disc 6 px tall, the label circling. */
function rollFrames(): Frame[] {
  const out: Frame[] = [];
  for (let k = 0; k < 4; k++) {
    const b = new PixelBuffer(16, 9);
    b.ellipse(1, 1, 13, 6, VINYL);
    b.hline(3, 11, 3, GROOVE);
    const lx = [7, 9, 7, 5][k];
    const ly = [3, 4, 5, 4][k];
    b.rect(lx - 1, ly, 3, 1, PAL.red[2]);
    b.set(lx, ly, PAL.snow[3]);
    b.set(3, 2, PAL.steel[3]);
    out.push(fr(b.outline(INK), 7, 4));
  }
  return out;
}

/** The fallen horn spinning on its point: the mouth up, wobbling as it precesses. */
function hornTopFrames(): Frame[] {
  const out: Frame[] = [];
  for (const tilt of [-12, -4, 12, 4]) {
    const S = 30;
    const b = new PixelBuffer(S, S);
    horn(b, 15, 25, ((-90 + tilt) * Math.PI) / 180, 15, 1.5, 8, { ramp: 'gold', petals: true, depth: 3 });
    out.push(trimmed(b.outline(INK), 15, 15));
  }
  return out;
}

// ------------------------------------------------------------------------------------ register

export function defineMortarSprites(): void {
  defineSprite(`${ART}/body`, () => [0, 1, 2].map(bodyFrame), { ticksPerFrame: 4 });
  defineSprite(`${ART}/dent`, () => [dentOverlay(bodyFrame(0), 3, 31)], { ticksPerFrame: 30 });
  defineSprite(`${ART}/horn`, () => MORTAR.angles.map(hornFrame), { ticksPerFrame: 6 });
  defineSprite(`${ART}/wreck`, () => [0, 1].map(wreckFrame), { ticksPerFrame: 8 });
  defineSprite(`${ART}/record`, recordFrames, { ticksPerFrame: 3 });
  defineSprite(`${ART}/record-roll`, rollFrames, { ticksPerFrame: 4 });
  defineSprite(`${ART}/horn-top`, hornTopFrames, { ticksPerFrame: 3 });
}
