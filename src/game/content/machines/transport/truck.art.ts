/**
 * `machine/band-truck/…` — the Band Truck (GDD §9.2): a crimson parade lorry with gold trim. Its
 * back is a small open stage behind a gold rail hung with bunting (the cargo sits there: the
 * seated bandsmen are separate strips, see crew.art.ts, drawn BEHIND the truck so the rail and
 * the bed side cover their legs); the cab has a rounded hood, a gold grille, a driver in a shako
 * at the window and two brass horns on the roof (the two-tone horn).
 *
 * Feet anchor, facing right (the cab at +x). 88 px long (+ the margin), stage floor 20 px above
 * the road (`TRUCK.deckY`), seats at x −34, −23, −12, −1 (`TRUCK.seats`).
 * Strips: `move` (4, wheels turn, bunting sways), `idle` (2, the engine shakes the body), `wreck`
 * (1, burnt, flat tyres, broken rail), `move-dmg` / `idle-dmg` (dents and holes, ≤ 50 % HP), and
 * the instruments thrown out of the wreck: `drum`, `horn`, `cymbal`, `triangle` (4 tumbling
 * frames each, feet anchor).
 */
import { PixelBuffer } from '../../../../engine/pixel';
import { INK, PAL } from '../../../../engine/palette';
import type { Frame } from '../../../../engine/render';
import { defineSprite } from '../../../../engine/sprites';
import { glass, wheel } from '../../../art/machines';
import { bunting, burnt, crest, dented, frame, horn, PENNANTS_ON_RED, slab } from './kit.art';

const A = 'machine/band-truck';
const W = 98;
const H = 54;
/** Anchor (the road under the middle of the truck). */
const OX = 49;
const OY = 54;

const X = (x: number): number => OX + x;

/** Rear and front wheel centres (local x) and their radius. */
const WHEELS = [-26, 28] as const;
const WR = 7;

/** The truck without its outline. `shake` lifts the body (not the wheels); `wreck` breaks it. */
function truckBody(phase: number, shake: number, wreck: boolean): PixelBuffer {
  const b = new PixelBuffer(W, H);
  const Y = (y: number): number => OY + y - shake;
  const red = PAL.red;
  const gold = PAL.gold;

  // Chassis beam behind the wheels, exhaust pipe at the back.
  b.rect(X(-44), Y(-10), 85, 3, PAL.black[1]);
  b.hline(X(-44), X(40), Y(-10), PAL.black[2]);
  b.rect(X(-48), Y(-7), 5, 2, PAL.steel[1]);
  b.hline(X(-48), X(-44), Y(-7), PAL.steel[3]);

  // The stage bed: crimson side panel, gold stripe and studs, a wooden floor edge on top.
  slab(b, X(-45), Y(-21), 55, 13, 'red');
  b.hline(X(-45), X(9), Y(-21), PAL.brown[3]);
  b.hline(X(-45), X(9), Y(-20), PAL.brown[1]);
  b.hline(X(-44), X(8), Y(-14), gold[2]);
  b.hline(X(-44), X(8), Y(-13), gold[1]);
  for (let x = -42; x <= 6; x += 6) {
    b.set(X(x), Y(-11), gold[3]);
    b.set(X(x) + 1, Y(-10), red[0]);
  }
  bunting(b, X(-44), X(8), Y(-20), 1, PENNANTS_ON_RED, 6, phase);
  // Tail light.
  b.rect(X(-46), Y(-18), 2, 3, red[3]);
  b.set(X(-46), Y(-18), gold[3]);

  // The stage rail: three gold posts with knobs, a top rail, bunting between the posts.
  const posts = wreck ? [-45, 8] : [-45, -18, 8];
  for (const px of posts) {
    b.vline(X(px), Y(-28), Y(-22), gold[2]);
    b.vline(X(px) + 1, Y(-28), Y(-22), gold[1]);
    b.rect(X(px), Y(-30), 2, 2, gold[3]);
  }
  if (!wreck) {
    b.hline(X(-45), X(9), Y(-28), gold[3]);
    b.hline(X(-45), X(9), Y(-27), gold[1]);
    bunting(b, X(-43), X(-19), Y(-27), 2, PENNANTS_ON_RED, 5, phase + 1);
    bunting(b, X(-16), X(7), Y(-27), 2, PENNANTS_ON_RED, 5, phase + 2);
  } else {
    // The broken rail hangs down from the back post.
    b.line(X(-44), Y(-28), X(-30), Y(-22), gold[1]);
  }

  // The cab: a box with a rounded roof, the side window with the driver, a slanted windscreen.
  slab(b, X(9), Y(-39), 21, 31, 'red', 3);
  b.blit(glass(13, 8, { bars: 0 }), X(12), Y(-36));
  // The driver: shako with a gold plume, a face with a moustache (he looks ahead).
  if (!wreck) {
    b.rect(X(18), Y(-33), 5, 4, PAL.skinA[2]);
    b.hline(X(18), X(22), Y(-33), PAL.skinA[3]);
    b.set(X(21), Y(-32), INK);
    b.hline(X(20), X(22), Y(-30), PAL.hairA[1]);
    b.rect(X(18), Y(-37), 5, 4, PAL.black[1]);
    b.hline(X(18), X(22), Y(-37), PAL.black[2]);
    b.set(X(21), Y(-35), gold[3]);
    b.rect(X(19), Y(-39), 2, 2, gold[2]);
    b.set(X(19), Y(-39), gold[3]);
  }
  b.poly(
    [
      [X(29), Y(-38)],
      [X(31), Y(-38)],
      [X(34), Y(-27)],
      [X(29), Y(-27)],
    ],
    PAL.sky[2],
  );
  b.line(X(30), Y(-37), X(32), Y(-29), PAL.snow[3]);
  b.vline(X(29), Y(-38), Y(-27), red[1]);
  // The door: a dark seam, the crest, a gold handle; a gold belt line under the window.
  b.strokeRect(X(11), Y(-27), 17, 17, red[1]);
  b.hline(X(10), X(29), Y(-28), gold[2]);
  crest(b, X(19), Y(-19));
  b.hline(X(24), X(26), Y(-23), gold[3]);

  // The hood: rounded, crimson, louvres; a gold grille and bumper; the headlamp on top.
  slab(b, X(29), Y(-27), 16, 16, 'red', 3);
  for (const ly of [-24, -21, -18]) {
    b.hline(X(32), X(38), Y(ly), red[0]);
    b.hline(X(32), X(38), Y(ly) + 1, red[3]);
  }
  for (let y = -25; y <= -13; y++) b.hline(X(43), X(44), Y(y), y % 2 === 0 ? gold[3] : gold[1]);
  b.rect(X(40), Y(-12), 6, 2, gold[2]);
  b.hline(X(40), X(45), Y(-12), gold[3]);
  b.circle(X(40), Y(-28), 2, gold[1]);
  b.circle(X(40), Y(-28), 1, PAL.snow[3]);
  b.set(X(39), Y(-29), PAL.snow[3]);

  // Running board between the cab and the front wheel.
  b.rect(X(9), Y(-10), 12, 2, PAL.black[2]);

  // Two brass horns on the cab roof (the two-tone horn), on little posts.
  if (!wreck) {
    b.vline(X(14), Y(-46), Y(-39), PAL.steel[2]);
    b.vline(X(15), Y(-46), Y(-39), PAL.steel[1]);
    horn(b, X(10), Y(-41), 0, 12, 0.8, 2.6);
    horn(b, X(12), Y(-47), 0, 9, 0.8, 2);
  }

  // Wheel wells, mudguard over the front wheel, then the wheels (they do not shake).
  for (const wx of WHEELS) {
    const cx = X(wx);
    const cy = OY - 2 - WR;
    for (let y = -10; y <= 0; y++) {
      for (let x = -10; x <= 10; x++) {
        const d = Math.hypot(x, y);
        if (d > 9.6) continue;
        const px = cx + x;
        const py = cy + y - shake;
        if ((b.get(px, py) & 255) === 0) continue;
        b.set(px, py, d > 8.5 ? (x + y < 0 ? red[3] : red[1]) : red[0]);
      }
    }
    if (wreck) {
      // Flat tyre: a squashed wheel sitting on the road.
      const flat = wheel(WR, 0, { tyre: 'black', rim: 'steel' }).resized(15, 12);
      b.blit(flat, cx - WR, OY - 2 - 12);
    } else b.blit(wheel(WR, phase, { tyre: 'black', rim: 'gold' }), cx - WR, cy - WR);
  }
  return b;
}

function truckFrame(phase: number, shake: number, wreck = false): Frame {
  const buf = truckBody(phase, shake, wreck).outline(INK);
  return frame(wreck ? burnt(buf, 11, 8) : buf, OX, OY);
}

// ------------------------------------------------------------------------------------ debris

/** A small snare drum (side view): crimson shell, white rope zig-zag, gold hoops, white head. */
function drumPiece(): PixelBuffer {
  const b = new PixelBuffer(14, 11);
  slab(b, 1, 2, 12, 8, 'red');
  b.hline(1, 12, 1, PAL.snow[3]);
  b.hline(1, 12, 2, PAL.gold[3]);
  b.hline(1, 12, 9, PAL.gold[1]);
  for (let x = 1; x <= 12; x++) b.set(x, 4 + (x % 4 < 2 ? x % 2 : 1 - (x % 2)) * 3, PAL.snow[2]);
  return b.outline(INK);
}

/** A cornet: a short coiled brass tube with a bell. */
function hornPiece(): PixelBuffer {
  const b = new PixelBuffer(16, 10);
  horn(b, 2, 5, 0, 10, 1, 3.5);
  b.rect(4, 2, 5, 2, PAL.gold[1]);
  b.hline(4, 8, 2, PAL.gold[3]);
  b.set(5, 1, PAL.gold[2]);
  b.set(7, 1, PAL.gold[2]);
  return b.outline(INK);
}

/** A cymbal seen at an angle: a flat brass ellipse with a bell in the middle. */
function cymbalPiece(): PixelBuffer {
  const b = new PixelBuffer(15, 8);
  b.ellipse(1, 2, 13, 5, PAL.gold[2]);
  b.hline(3, 11, 2, PAL.gold[3]);
  b.hline(3, 11, 6, PAL.gold[1]);
  b.rect(6, 1, 3, 2, PAL.gold[3]);
  b.set(7, 1, PAL.snow[3]);
  return b.outline(INK);
}

/** The triangle (steel) with its gap at the top corner. */
function trianglePiece(): PixelBuffer {
  const b = new PixelBuffer(11, 11);
  b.line(5, 2, 1, 9, PAL.snow[2]);
  b.line(5, 2, 9, 9, PAL.steel[2]);
  b.hline(1, 9, 9, PAL.steel[3]);
  b.set(5, 2, 0);
  b.set(4, 3, PAL.snow[3]);
  return b.outline(INK);
}

/** Four quarter turns of a piece (the tumble), each on its own feet anchor. */
function tumble(piece: () => PixelBuffer): () => PixelBuffer[] {
  return () => {
    const p = piece();
    return [0, 1, 2, 3].map((q) => p.rotated((q * Math.PI) / 2));
  };
}

export function defineTruckArt(): void {
  defineSprite(`${A}/move`, () => [0, 1, 2, 3].map((p) => truckFrame(p, 0)), { ticksPerFrame: 4 });
  defineSprite(`${A}/idle`, () => [truckFrame(0, 0), truckFrame(0, 1)], { ticksPerFrame: 5 });
  defineSprite(`${A}/move-dmg`, () => [0, 1, 2, 3].map((p) => frame(dented(truckFrame(p, 0).buf, 0.7, 4), OX, OY)), { ticksPerFrame: 4 });
  defineSprite(`${A}/idle-dmg`, () => [0, 1].map((s) => frame(dented(truckFrame(0, s).buf, 0.7, 4), OX, OY)), { ticksPerFrame: 5 });
  defineSprite(`${A}/wreck`, () => [truckFrame(0, 0, true)], { ticksPerFrame: 60 });
  // GDD §15.6 generic names for tools and missions.
  defineSprite(`${A}/body`, () => [truckFrame(0, 0)], { ticksPerFrame: 60 });
  defineSprite(`${A}/drum`, tumble(drumPiece), { ticksPerFrame: 4 });
  defineSprite(`${A}/horn`, tumble(hornPiece), { ticksPerFrame: 4 });
  defineSprite(`${A}/cymbal`, tumble(cymbalPiece), { ticksPerFrame: 4 });
  defineSprite(`${A}/triangle`, tumble(trianglePiece), { ticksPerFrame: 4 });
}
