/**
 * `machine/piano-bomber/…` — the Piano Bomber (GDD §9.2) and its grand pianos.
 *
 * The bomber: a fat, slow crimson airliner-bomber with a high wing, twin engines whose nacelles
 * are brass horn bells (the propeller spins in front of each bell), a band of piano keys painted
 * along its belly, round gold portholes, a crested tail fin trailing a streamer, fixed wheel
 * spats and a bomb bay under the wing. Centre anchor (the hull centre), facing right; about
 * 96 × 36 (`BOMBER.w/h`); the bay opening is at x +4, y +12 (`BOMBER.bayDx/bayY`).
 * Strips: `body` (4: propellers, streamer), `tell` (4: the bay doors hang open, a piano lid
 * shows), `body-dmg` / `tell-dmg`, `roll` (5: wobble, roll over, upside down — the death),
 * `wreck` (2: upside down, burnt, embers).
 *
 * The piano (feet anchor, 32 × 24 = `PIANO.w/h`): black lacquer with gold trim, three legs on
 * brass casters, the keyboard at the front. `piano` (4: falling, lid flapping), `piano-landed`
 * (1), `piano-collapse` (4: legs splay, the case cracks, a pile of keys).
 */
import { PixelBuffer } from '../../../../engine/pixel';
import { INK, PAL } from '../../../../engine/palette';
import type { Frame } from '../../../../engine/render';
import { defineSprite } from '../../../../engine/sprites';
import { glass } from '../../../art/machines';
import { burnt, crest, dented, frame, horn } from './kit.art';

const A = 'machine/piano-bomber';

// ------------------------------------------------------------------------------------ bomber

const BW = 106;
const BH = 52;
/** Hull centre in the buffer. */
const CX = 53;
const CY = 28;
const X = (x: number): number => CX + x;
const Y = (y: number): number => CY + y;

/** Inside test for the fuselage profile (local coordinates). */
function inFuselage(x: number, y: number): boolean {
  if (x >= 0) {
    // A bulbous nose: half an ellipse 42 long, 11 high.
    const u = x / 42;
    const v = (y + 0.5) / 11.5;
    return u * u + v * v <= 1;
  }
  // The rear tapers up to the tail: the belly line rises, the back stays almost flat.
  const t = Math.min(1, -x / 46);
  const top = -11 + 4 * t * t;
  const bottom = 11 - 15 * Math.pow(t, 1.4);
  return y >= top && y <= bottom && x >= -46;
}

/**
 * A propeller seen edge-on at (px, cy), `span` px either side of the hub: a faint blur disc
 * (a thin dotted ellipse) and the blade, whose visible length turns with the phase.
 */
function propeller(b: PixelBuffer, px: number, cy: number, span: number, phase: number): void {
  const reach = [1, 0.55, 0.15, 0.55][phase & 3] * span;
  const up = (phase & 3) < 2;
  for (let y = -span; y <= span; y++) {
    if ((y + phase) % 3 !== 0) continue;
    b.set(px + (Math.abs(y) < span - 2 ? 1 : 0), cy + y, PAL.snow[1]);
  }
  // The blade: one tip long, the other short (it turns), steel with a light edge.
  const a = Math.round(up ? -reach : -reach * 0.5);
  const z = Math.round(up ? reach * 0.5 : reach);
  for (let y = a; y <= z; y++) b.set(px, cy + y, PAL.steel[1]);
  b.set(px, cy + a, PAL.steel[3]);
  b.rect(px - 1, cy - 1, 3, 3, PAL.gold[3]);
  b.set(px + 1, cy + 1, PAL.gold[1]);
}

function bomberBody(phase: number, bay: boolean): PixelBuffer {
  const b = new PixelBuffer(BW, BH);
  const red = PAL.red;
  const gold = PAL.gold;

  // Tail fin with a gold stripe, then the fuselage.
  b.poly(
    [
      [X(-46), Y(-8)],
      [X(-46), Y(-24)],
      [X(-40), Y(-24)],
      [X(-30), Y(-8)],
    ],
    red[2],
  );
  b.vline(X(-46), Y(-24), Y(-9), red[3]);
  b.hline(X(-46), X(-40), Y(-24), red[3]);
  b.line(X(-39), Y(-23), X(-30), Y(-9), red[1]);
  b.line(X(-44), Y(-21), X(-38), Y(-21), gold[2]);
  crest(b, X(-41), Y(-15));
  for (let y = -12; y <= 12; y++) {
    for (let x = -46; x <= 42; x++) {
      if (!inFuselage(x, y)) continue;
      const above = inFuselage(x, y - 1);
      const below = inFuselage(x, y + 1);
      const left = inFuselage(x - 1, y);
      let c = red[2];
      if (!above || (!left && x > 0)) c = red[3];
      else if (!below) c = red[1];
      else if (y >= 6) c = red[1];
      else if (y <= -8 && x > -30) c = red[3];
      b.set(X(x), Y(y), c);
    }
  }
  // A gold cheat line along the side.
  for (let x = -40; x <= 40; x++) {
    if (inFuselage(x, -2) && inFuselage(x, -1)) {
      b.set(X(x), Y(-2), gold[3]);
      b.set(X(x), Y(-1), gold[1]);
    }
  }
  // Piano keys along the belly: white keys with the black ones in groups of 2 and 3.
  for (let x = -26; x <= 22; x++) {
    for (let y = 3; y <= 7; y++) {
      if (!inFuselage(x, y + 2)) continue;
      const key = x + 26;
      const seam = key % 4 === 3;
      b.set(X(x), Y(y), seam ? PAL.snow[1] : y === 3 ? PAL.snow[3] : PAL.snow[2]);
    }
    const oct = (x + 26) % 28;
    const blackKey = [2, 3, 6, 7, 14, 15, 18, 19, 22, 23].includes(oct);
    if (blackKey && inFuselage(x, 9)) for (let y = 3; y <= 5; y++) b.set(X(x), Y(y), y === 3 ? PAL.black[2] : PAL.black[1]);
  }
  for (let x = -26; x <= 22; x++) if (inFuselage(x, 9)) b.set(X(x), Y(8), red[0]);
  // Round gold portholes.
  for (const px of [-22, -13, -4]) {
    b.circle(X(px), Y(-6), 2, gold[1]);
    b.set(X(px) - 1, Y(-7), gold[3]);
    b.rect(X(px), Y(-6), 1, 1, PAL.sky[1]);
    b.set(X(px) - 1, Y(-6), PAL.sky[3]);
  }
  // The cockpit: a sloped windscreen on top of the nose, the pilot's shako behind it.
  b.rect(X(22), Y(-12), 3, 2, PAL.black[1]);
  b.set(X(23), Y(-13), gold[3]);
  b.blit(glass(9, 5, { bars: 1 }), X(25), Y(-11));
  b.line(X(25), Y(-11), X(33), Y(-7), red[3]);

  // The bomb bay under the wing: closed doors (a seam) or doors hanging open with a piano lid.
  if (!bay) {
    b.hline(X(-6), X(14), Y(9), red[0]);
    b.vline(X(4), Y(9), Y(10), red[0]);
  } else {
    for (let x = -5; x <= 13; x++) for (let y = 9; y <= 11; y++) b.set(X(x), Y(y), PAL.ink[1]);
    b.rect(X(-3), Y(10), 15, 2, PAL.black[1]);
    b.hline(X(-3), X(11), Y(10), PAL.steel[1]);
    b.line(X(-6), Y(10), X(-9), Y(16), red[1]);
    b.line(X(-5), Y(10), X(-8), Y(16), red[2]);
    b.line(X(14), Y(10), X(17), Y(16), red[1]);
    b.line(X(13), Y(10), X(16), Y(16), red[2]);
  }

  // Wheel spats (fixed gear) under the nose and the tail wheel.
  b.line(X(24), Y(9), X(25), Y(13), PAL.steel[1]);
  b.ellipse(X(21), Y(12), 9, 6, red[2]);
  b.hline(X(22), X(28), Y(12), red[3]);
  b.rect(X(23), Y(16), 5, 2, PAL.black[1]);
  b.set(X(-40), Y(1), PAL.steel[1]);
  b.circle(X(-40), Y(3), 1, PAL.black[2]);

  // The tailplane.
  b.poly(
    [
      [X(-47), Y(-7)],
      [X(-33), Y(-8)],
      [X(-31), Y(-6)],
      [X(-47), Y(-5)],
    ],
    red[1],
  );
  b.hline(X(-47), X(-33), Y(-7), red[3]);

  // The high wing (an airfoil seen end-on is thin: a gold-edged slab) on two struts.
  b.line(X(-6), Y(-11), X(-10), Y(-15), PAL.steel[1]);
  b.line(X(12), Y(-11), X(8), Y(-15), PAL.steel[1]);
  b.poly(
    [
      [X(-16), Y(-17)],
      [X(-12), Y(-20)],
      [X(16), Y(-20)],
      [X(22), Y(-18)],
      [X(16), Y(-15)],
      [X(-16), Y(-15)],
    ],
    red[2],
  );
  b.hline(X(-12), X(16), Y(-20), red[3]);
  b.hline(X(-15), X(17), Y(-15), red[1]);
  b.hline(X(17), X(21), Y(-18), gold[3]);
  b.hline(X(16), X(19), Y(-17), gold[1]);

  // The near engine: a brass horn bell under the wing, the bell facing forward, prop in front.
  horn(b, X(0), Y(-13), 0, 15, 2.5, 5);
  b.rect(X(-2), Y(-15), 3, 5, red[1]);
  propeller(b, X(17), Y(-13), 10, phase);

  // The streamer from the tail: crimson and gold, waving.
  for (let k = 0; k < 6; k++) {
    const x = -48 - k;
    const y = -22 + Math.round(Math.sin((k + phase * 1.5) * 1.3) * 1.2) + (k >> 1);
    if (X(x) < 1) break;
    b.set(X(x), Y(y), k % 2 === 0 ? red[3] : gold[2]);
    b.set(X(x), Y(y + 1), k % 2 === 0 ? red[1] : gold[1]);
  }
  return b;
}

function bomberFrame(phase: number, bay: boolean): Frame {
  return frame(bomberBody(phase, bay).outline(INK), CX, CY);
}

/** A frame centred on its own buffer (rotated / squashed copies). */
function centred(buf: PixelBuffer): Frame {
  return frame(buf, buf.w >> 1, buf.h >> 1);
}

/** The death roll: wobble nose down, nose up, roll over (squashed), upside down. */
function rollFrames(): Frame[] {
  const base = bomberFrame(0, false).buf;
  const squash = (src: PixelBuffer, k: number): PixelBuffer => {
    const h = Math.max(4, Math.round(src.h * k));
    const out = new PixelBuffer(src.w, src.h);
    out.blit(src.resized(src.w, h), 0, Math.round((src.h - h) / 2));
    return out;
  };
  return [
    centred(base.rotated(0.14)),
    centred(base.rotated(-0.12)),
    centred(squash(base, 0.45)),
    centred(squash(base.flipped(false, true), 0.6)),
    centred(base.flipped(false, true)),
  ];
}

function wreckFrames(): Frame[] {
  const up = bomberBody(0, true).flipped(false, true).outline(INK);
  return [centred(burnt(up, 21, 7)), centred(burnt(up, 22, 7))];
}

// ------------------------------------------------------------------------------------ piano

const PW = 36;
const PH = 27;
/** Feet anchor: the casters stand on line PH − 1 (+1 for the outline). */
const POX = 18;
const POY = 27;

/**
 * The grand piano facing right (keyboard at +x): case 32 long, 11 high, its curved tail at the
 * back; a gold rim line, a lid (`lid` = how far it is lifted at the back, px), three legs.
 */
function pianoBody(lid: number, legSplay = 0, drop = 0): PixelBuffer {
  const b = new PixelBuffer(PW, PH);
  const bk = PAL.black;
  const gold = PAL.gold;
  const top = 2 + drop;
  // Legs (behind the case): back, middle (far, darker), front; brass casters.
  const legs: Array<[number, number]> = [
    [5, -legSplay],
    [17, 0],
    [29, legSplay],
  ];
  legs.forEach(([lx, s], i) => {
    const far = i === 1;
    const x0 = lx;
    const y0 = top + 11;
    const x1 = lx + s;
    const y1 = PH - 2;
    b.thickLine(x0, y0, x1, y1 - 1, 2.6, far ? bk[1] : bk[2]);
    b.line(x0 - 1, y0, x1 - 1, y1 - 1, far ? bk[1] : bk[3]);
    b.rect(x1 - 1, y1 - 1, 3, 2, gold[far ? 1 : 2]);
  });
  // The case: flat lid line, rounded tail (left), squared keyboard end (right).
  b.roundRect(1, top + 1, 31, 11, 4, bk[2]);
  b.rect(16, top + 1, 16, 11, bk[2]);
  b.hline(3, 31, top + 1, bk[3]);
  b.vline(1, top + 4, top + 8, bk[3]);
  b.hline(2, 31, top + 10, bk[1]);
  b.hline(2, 31, top + 11, bk[1]);
  // Gold rim moulding and a lacquer shine.
  b.hline(2, 31, top + 4, gold[2]);
  b.hline(6, 12, top + 2, PAL.steel[3]);
  b.set(5, top + 3, PAL.steel[3]);
  // The keyboard sticks out at the front: white keys, the black ones on top, a key slip under
  // them, and the music desk standing up behind the keys.
  b.rect(30, top + 5, 5, 2, PAL.snow[3]);
  b.hline(30, 34, top + 6, PAL.snow[2]);
  b.set(31, top + 5, bk[1]);
  b.set(33, top + 5, bk[1]);
  b.rect(30, top + 7, 5, 2, bk[2]);
  b.hline(30, 34, top + 7, gold[1]);
  b.line(27, top + 4, 29, top, bk[2]);
  b.line(28, top + 4, 30, top, bk[3]);
  // The pedal lyre between the legs: two gold bars and the pedals.
  b.vline(22, top + 12, top + 17, gold[2]);
  b.vline(24, top + 12, top + 17, gold[1]);
  b.hline(21, 25, top + 18, gold[3]);
  // The lid: closed it is the top line; lifted it is a slab hinged at the keyboard end.
  if (lid > 0) {
    b.line(30, top + 1, 3, top + 1 - lid, bk[3]);
    b.line(30, top, 3, top - lid, bk[2]);
    b.line(29, top + 1, 4, top + 2 - lid, PAL.gold[1]);
  }
  return b;
}

function pianoFrame(lid: number, rot = 0): Frame {
  let buf = pianoBody(lid).outline(INK);
  if (rot !== 0) {
    const r = buf.rotated(rot);
    buf = r;
  }
  return frame(buf, buf.w >> 1, buf.h);
}

function collapseFrames(): Frame[] {
  // 0: legs splay, the case drops; 1: the case cracks in a V; 2: pieces settle; 3: a pile of keys.
  const f0 = pianoBody(0, 4, 3).outline(INK);
  const crack = (src: PixelBuffer, k: number): PixelBuffer => {
    const out = new PixelBuffer(src.w, src.h);
    const half = src.w >> 1;
    out.blit(src.crop(0, 0, half, src.h).rotated(0.25 * k), -1, 2 * k);
    out.blit(src.crop(half, 0, src.w - half, src.h).rotated(-0.25 * k), half + 1, 2 * k);
    return out;
  };
  const f1 = crack(pianoBody(0, 6, 5), 1).outline(INK);
  const pile = (spread: number): PixelBuffer => {
    const b = new PixelBuffer(PW, PH);
    // A heap of black case pieces with white keys sticking out.
    b.ellipse(4, PH - 10 + spread, 28, 9 - spread, PAL.black[2]);
    b.hline(8, 26, PH - 9 + spread, PAL.black[3]);
    for (let k = 0; k < 7; k++) {
      const x = 6 + k * 4;
      const y = PH - 11 + ((k * 5) % 4) + spread;
      b.rect(x, y, 3, 2, PAL.snow[3]);
      b.set(x + 2, y + 1, PAL.snow[1]);
    }
    b.rect(2, PH - 4, 3, 2, PAL.gold[2]);
    b.rect(30, PH - 5, 3, 2, PAL.gold[2]);
    return b.outline(INK);
  };
  return [f0, f1, pile(1), pile(3)].map((buf) => frame(buf, POX, POY));
}

export function defineBomberArt(): void {
  defineSprite(`${A}/body`, () => [0, 1, 2, 3].map((p) => bomberFrame(p, false)), { ticksPerFrame: 2 });
  defineSprite(`${A}/tell`, () => [0, 1, 2, 3].map((p) => bomberFrame(p, true)), { ticksPerFrame: 2 });
  defineSprite(`${A}/body-dmg`, () => [0, 1, 2, 3].map((p) => centred(dented(bomberFrame(p, false).buf, 0.6, 8))), { ticksPerFrame: 2 });
  defineSprite(`${A}/tell-dmg`, () => [0, 1, 2, 3].map((p) => centred(dented(bomberFrame(p, true).buf, 0.6, 8))), { ticksPerFrame: 2 });
  defineSprite(`${A}/roll`, rollFrames, { ticksPerFrame: 8, loop: false });
  defineSprite(`${A}/wreck`, wreckFrames, { ticksPerFrame: 4 });
  defineSprite(`${A}/piano`, () => [pianoFrame(0), pianoFrame(3, 0.08), pianoFrame(0), pianoFrame(2, -0.08)], { ticksPerFrame: 6 });
  defineSprite(`${A}/piano-landed`, () => [frame(pianoBody(0).outline(INK), POX, POY)], { ticksPerFrame: 60 });
  defineSprite(`${A}/piano-collapse`, collapseFrames, { ticksPerFrame: 8, loop: false });
}
