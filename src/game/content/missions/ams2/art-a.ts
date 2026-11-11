/**
 * Section a's own art (morning; docs/design/ams2.md §3): the far city, the bank across the canal with
 * its hump bridge, the canal, the moored boats, the trees and the stand on the quay.
 */
import { addMargin, S } from '../../../art/herokit/canvas';
import { crown, swayCrown, trunk } from '../../../art/herokit/foliage';
import { brickHints } from '../../../art/herokit/walls';
import { renderBuffer } from '../../../art/herokit/hi';
import { KM, R } from '../../../art/herokit/palette';
import { lamp, stand } from '../../../art/herokit/props';
import { rngf } from '../../../art/herokit/rng';
import { type Band, B0, defineArt, S_MID } from './stage';
import { defineBank, houseRow, quayWall } from './scene';

const L = 'morning';
export const BANK_W = 1024;
const BANK_Y = 113;
/** The trees on the far bank: band x. */
export const FAR_TREES: readonly number[] = [70, 300, 510, 740, 930];

function humpBridge(): S {
  const br = new S(120, 40);
  br.use(1, 1);
  const ba = R.brickr[1];
  br.rect(ba, 3, 10, 112, 30);
  const km = new Uint8Array(40 * 120);
  for (let y = 10; y < 40; y++) for (let x = 3; x < 115; x++) km[y * 120 + x] = 1;
  brickHints(br, km, 'brickr', 77);
  br.use(2, 2);
  const [s0, s1, s2, s3] = R.stone;
  for (let y = 0; y < 40; y++) {
    for (let x = 0; x < 120; x++) {
      const i = y * 120 + x;
      if (((x - 59) / 38) ** 2 + ((y - 40) / 25) ** 2 < 1) {
        br.c[i] = s1;
        br.z[i] = 2;
        br.p[i] = 2;
        const an = Math.atan2(y - 40, x - 59 + 0.001);
        const seg = Math.trunc(an * 14);
        const odd = ((seg % 2) + 2) % 2;
        if (odd === 0) br.c[i] = s2;
        if (x > 59 && odd === 1) br.c[i] = s0;
      }
      if (((x - 59) / 34) ** 2 + ((y - 40) / 22) ** 2 < 1) {
        br.c[i] = R.hull[3];
        br.p[i] = 3;
        br.z[i] = Math.fround(0.5);
      }
    }
  }
  br.use(4, 3);
  br.rect(s1, 0, 7, 118, 3);
  br.hl(s0, 0, 7, 118);
  br.hl(s3, 0, 10, 118);
  for (let q = 4; q < 116; q += 11) br.vl(s3, q, 7, 3);
  br.use(5, 2.5);
  br.rect(s1, 55, 12, 9, 5);
  br.hl(s0, 55, 12, 9);
  br.hl(s3, 55, 16, 9);
  br.vl(s0, 63, 12, 5);
  for (const q of [10, 104]) {
    br.use(6, 2.5);
    br.rect(R.iron[1], q, 20, 4, 3);
    br.hl(R.iron[0], q, 20, 4);
  }
  br.use(7, 3);
  for (let q = 4; q < 116; q += 6) {
    br.rect(R.iron[1], q, 0, 2, 7);
    br.vl(R.iron[0], q + 1, 0, 7);
  }
  br.rect(R.iron[1], 0, 0, 118, 2);
  br.hl(R.iron[0], 0, 0, 118);
  const o = addMargin(br);
  o.finish(KM);
  return o;
}

/** The trunk offsets of the reference's scene (its generator 11: integers in −16 … 16). */
function treeOffsets(): Record<number, number> {
  const g = rngf(11);
  const out: Record<number, number> = {};
  for (const tx of FAR_TREES) out[tx] = g.int(-16, 17);
  return out;
}

/** The far bank with what stands on it, and the canal that reflects it (crowns too). */
const CANAL = defineBank({
  light: L,
  name: 'a',
  speed: S_MID,
  width: BANK_W,
  rows: [12, 119],
  waterRows: [119, B0 + 6],
  paint: (md) => {
    houseRow(md, BANK_Y, 41, { sh: 18, gr: 22, gh: 22 });
    quayWall(md, BANK_Y);
    const bx = 180;
    md.paste(humpBridge(), bx, 87);
    const lp = lamp(38);
    md.paste(lp, bx + 6, 95 - lp.h + 1);
    md.paste(lp, bx + 94, 95 - lp.h + 1);
    // The trunks stand a little off the crowns, as trees do.
    const off = treeOffsets();
    for (const tx of FAR_TREES) trunk(md, tx + off[tx], BANK_Y, 50, 4, 500 + tx);
  },
  reflect: (bank) => {
    for (const tx of FAR_TREES) bank.blit(renderBuffer(crown(66, 58, 500 + tx, 0), L, 1, 0), tx - 33, BANK_Y - 74);
  },
});

export const BANK: Band = CANAL.bank;
export const WATER: Band = CANAL.water;

/** The crown of a far tree at band x tx. */
export function farCrownId(tx: number): string {
  return defineArt(L, `a/far-crown-${tx}`, () => swayCrown(66, 58, 500 + tx), { anchor: 'tl' });
}

/** A moored boat on the canal. */
export const MOORED_BOAT = defineArt(
  L,
  'a/moored-boat',
  () => {
    const bt = new S(62, 20);
    bt.use(1, 1);
    const bl = R.blue;
    bt.poly(bl[1], [
      [0, 8],
      [59, 8],
      [53, 18],
      [6, 18],
    ]);
    bt.hl(bl[0], 0, 8, 60);
    bt.hl(R.white[0], 2, 10, 56);
    bt.hl(bl[3], 6, 18, 48);
    bt.hl(bl[2], 5, 16, 50);
    bt.use(2, 2);
    const W_ = R.wood;
    bt.rect(W_[1], 12, 1, 32, 7);
    bt.hl(W_[0], 12, 1, 32);
    bt.vl(W_[0], 43, 1, 7);
    bt.vl(W_[2], 12, 1, 7);
    bt.hl(W_[3], 12, 7, 32);
    for (let q = 16; q < 42; q += 7) {
      bt.rect(R.glass[2], q, 3, 4, 3);
      bt.px(R.glass[0], q + 3, 3);
    }
    const o = addMargin(bt);
    o.finish(KM);
    return o;
  },
  { anchor: 'tl', bob: [0, 1, 0, -1] },
);

/** The herring stand on the quay. */
export const STAND_ID = defineArt(L, 'a/stand-haring', () => stand('HARING', 'navy'));
