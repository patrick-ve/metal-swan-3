/**
 * 2× art of the Amsterdam breakables (breakables.ts; 1× art in npc.art.ts `breakable`): the
 * herring cart, the tulip stall, the flea-market stall and the bike rack, each intact (frame 0)
 * and broken (frame 1). The 1× recipe on the 2× grid (`Pen2`) with a 2-px INK outline and finer
 * detail: fish with eyes and tails, wheel spokes, bucket rims, tulip cups, chain links, spokes.
 * The lettering (HARING) is the 1× lettering doubled, so it reads the same.
 */
import type { Color } from '../../../../engine/color';
import { PAL } from '../../../../engine/palette';
import type { Frame } from '../../../../engine/render';
import { defineHiSprite } from '../../../../engine/sprites';
import { Pen2 } from './art-hi-cd-pen';

/** 0 intact, 1 broken; the 1× buffer (w + 2) × (h + 2), feet anchor (npc.art.ts `breakable`). */
function breakable2(id: string, w: number, h: number, draw: (p: Pen2, broken: boolean) => void): void {
  defineHiSprite(`decor/ams/${id}`, () =>
    [false, true].map((broken): Frame => {
      const p = new Pen2(w + 2, h + 2);
      draw(p, broken);
      p.outline();
      return p.frame(Math.floor((w + 2) / 2), h + 1);
    }),
  );
}

/** A cart wheel: black tyre, a fine grey rim, spokes and a lit hub. */
function wheel2(p: Pen2, x: number, y: number, r: number): void {
  p.circle(x, y, r, PAL.black[2]);
  p.ring(x, y, r - 1, PAL.stone[2]);
  for (const [dx, dy] of [[1, 0], [0, 1], [0.7, 0.7], [0.7, -0.7]] as const) {
    const k = r - 1.5;
    p.fine(x + 0.25 - dx * k, y + 0.25 - dy * k, x + 0.25 + dx * k, y + 0.25 + dy * k, PAL.stone[1]);
  }
  p.set(x, y, PAL.steel[3]);
  p.dot(x + 0.5, y + 0.5, PAL.steel[1]);
}

/** A herring lying sideways (the 1× 5 × 2 ellipse): silver back, a dark eye, a forked tail. */
function fish2(p: Pen2, x: number, y: number, c: Color, flip = false): void {
  p.ellipse(x, y, 5, 2, c);
  p.fineH(x + 1, x + 3.5, y, PAL.steel[2]);
  p.fineH(x + 1, x + 3, y + 1.5, PAL.snow[3]);
  p.dot(flip ? x + 0.5 : x + 4, y + 0.5, PAL.ink[1]);
  const tx = flip ? x + 4.5 : x;
  p.dot(tx, y, PAL.steel[1]);
  p.dot(tx, y + 1.5, PAL.steel[1]);
}

// ---------------------------------------------------------------------------- herring cart

breakable2('ams-herring-cart', 48, 38, (p, broken) => {
  if (broken) {
    // The kiosk box keeled over, its blue HARING band, the striped roof edge snapped off, one
    // loose wheel and silver fish spilled on the street.
    p.poly([[4, 37], [6, 22], [34, 18], [38, 33]], PAL.cloth[2]);
    p.line(6, 22, 34, 18, PAL.cloth[3]);
    p.fine(6.5, 23, 34, 19, PAL.cloth[1]);
    p.poly([[5, 30], [36, 26], [37, 32], [5, 36]], PAL.sky[1]);
    p.fine(5, 30, 36, 26, PAL.sky[2]);
    p.text('HAR', 12, 28, { font: 'small', color: PAL.cloth[3] });
    p.rect(10, 22, 18, 4, PAL.navy[0]);
    p.fine(11, 22.5, 14, 25, PAL.navy[2]);
    // A crack across the box.
    p.fine(26, 20, 29, 24.5, PAL.cloth[1]);
    p.fine(29, 24.5, 28, 27, PAL.cloth[1]);
    // Snapped roof edge.
    for (let x = 30; x < 46; x += 6) p.rect(x, 34, 3, 3, PAL.cloth[3]);
    for (let x = 33; x < 46; x += 6) p.rect(x, 34, 3, 3, PAL.sky[1]);
    p.hline(30, 46, 33, PAL.sky[2]);
    p.fineH(30, 46.5, 36.5, PAL.sky[0]);
    p.fine(46.5, 33, 45.5, 34, PAL.cloth[1]); // splintered end
    // Flag pole on the floor.
    p.line(36, 31, 46, 26, PAL.stone[3]);
    p.rect(43, 24, 3, 1, PAL.red[2]);
    p.rect(43, 25, 3, 1, PAL.cloth[3]);
    p.dot(43, 24, PAL.red[3]);
    wheel2(p, 42, 34, 3);
    // Spilled fish.
    fish2(p, 2, 34, PAL.steel[3]);
    fish2(p, 22, 35, PAL.snow[2], true);
    fish2(p, 14, 17, PAL.steel[3]);
    return;
  }
  // Roof with a blue-white striped edge.
  p.rect(2, 4, 44, 4, PAL.sky[1]);
  p.fineH(2, 45.5, 6.5, PAL.sky[0]);
  for (let x = 2; x < 46; x += 6) {
    p.rect(x, 7, 3, 3, PAL.cloth[3]);
    p.fineV(x + 2.5, 7, 9.5, PAL.cloth[1]);
    p.fineH(x, x + 2.5, 9.5, PAL.cloth[1]);
  }
  for (let x = 5; x < 46; x += 6) {
    p.rect(x, 7, 3, 3, PAL.sky[1]);
    p.fineV(x + 2.5, 7, 9.5, PAL.sky[0]);
  }
  p.hline(2, 45, 4, PAL.sky[2]);
  p.fineH(2, 45.5, 4, PAL.sky[3]);
  // Flag (a little wave in the 2× grid).
  p.vline(40, 0, 4, PAL.stone[3]);
  p.fineV(40.5, 0, 4.5, PAL.stone[2]);
  p.rect(41, 0, 5, 1, PAL.red[2]);
  p.rect(41, 1, 5, 1, PAL.cloth[3]);
  p.rect(41, 2, 5, 1, PAL.sky[1]);
  p.fineV(43.5, 0, 2.5, PAL.cloth[1]);
  p.dot(43.5, 0, PAL.red[1]);
  p.dot(43.5, 2, PAL.sky[0]);
  // The kiosk body with its panel seams, the hatch with a counter of herring.
  p.rect(4, 10, 40, 22, PAL.cloth[2]);
  p.hline(4, 43, 10, PAL.cloth[3]);
  p.fineV(4, 10, 31.5, PAL.cloth[3]);
  p.fineV(43.5, 10, 31.5, PAL.cloth[1]);
  p.rect(8, 11, 32, 7, PAL.navy[0]);
  p.fineH(8, 39.5, 11, PAL.ink[1]);
  p.fine(10, 12, 13, 16.5, PAL.navy[1]);
  for (let i = 0; i < 5; i++) fish2(p, 10 + i * 6, 15, i & 1 ? PAL.steel[3] : PAL.snow[2], (i & 1) === 1);
  // A little flag pick in the first herring.
  p.fineV(12.5, 12, 14.5, PAL.stone[3]);
  p.dot(13, 12, PAL.red[2]);
  p.dot(13, 12.5, PAL.sky[1]);
  p.hline(6, 41, 18, PAL.stone[3]);
  p.fineH(6, 41.5, 18.5, PAL.stone[1]);
  // Blue band with the name.
  p.rect(4, 20, 40, 8, PAL.sky[1]);
  p.fineH(4, 43.5, 20, PAL.sky[2]);
  p.fineH(4, 43.5, 27.5, PAL.sky[0]);
  p.text('HARING', 24, 21, { font: 'small', color: PAL.cloth[3], align: 'center' }, PAL.sky[0]);
  p.hline(4, 43, 31, PAL.stone[2]);
  for (const x of [14, 24, 34]) p.fineV(x, 28, 30.5, PAL.cloth[1]);
  wheel2(p, 12, 34, 4);
  wheel2(p, 36, 34, 4);
  p.line(44, 28, 48, 30, PAL.stone[2]);
  p.fine(44, 27.5, 48, 29.5, PAL.stone[3]);
});

// ---------------------------------------------------------------------------- tulip stall

const TULIP: readonly Color[] = [PAL.red[2], PAL.gold[2], PAL.pink[2], PAL.purple[2], PAL.orange[2], PAL.red[3]];

/** The darker tone of a tulip colour (the cup's shaded side). */
function cupShade(c: Color): Color {
  if (c === PAL.red[2] || c === PAL.red[3]) return PAL.red[1];
  if (c === PAL.gold[2]) return PAL.gold[1];
  if (c === PAL.pink[2]) return PAL.pink[1];
  if (c === PAL.purple[2]) return PAL.purple[1];
  if (c === PAL.orange[2]) return PAL.orange[1];
  return c;
}

/** A tulip cup on the 2× grid (the 1× 1 × 2 cup: a split top, a shaded right half). */
function cup2(p: Pen2, x: number, y: number, c: Color): void {
  p.rect(x, y, 1, 2, c);
  p.fineV(x + 0.5, y + 0.5, y + 1.5, cupShade(c));
  p.dot(x + 0.5, y, cupShade(c));
}

breakable2('ams-tulip-stall', 48, 36, (p, broken) => {
  if (broken) {
    p.poly([[2, 32], [46, 30], [46, 35], [2, 35]], PAL.brown[1]);
    p.fine(2, 32, 46, 30, PAL.brown[2]);
    for (const x of [12, 26, 38]) p.fine(x, 32, x + 1, 35, PAL.brown[0]);
    for (let i = 0; i < 12; i++) {
      const x = 3 + ((i * 7) % 42);
      const y = 28 + ((i * 5) % 6);
      p.line(x, y, x + 3, y + 1, PAL.green[2]);
      p.fine(x, y, x + 3, y + 1, PAL.green[3]);
      const c = TULIP[i % TULIP.length];
      p.rect(x + 3, y, 2, 2, c);
      p.fineV(x + 4.5, y, y + 1.5, cupShade(c));
      p.dot(x + 3, y, PAL.snow[3]);
      // A loose petal.
      if (i % 3 === 0) p.dot(x + 6, y + 1.5, c);
    }
    // The bucket on its side, its open rim and spilled water.
    p.ellipse(30, 26, 8, 6, PAL.steel[2]);
    p.ellipse(30, 26, 8, 6, PAL.steel[1], false);
    p.ellipse(31, 27, 4, 4, PAL.steel[0]);
    p.fineH(30.5, 34, 26, PAL.steel[3]);
    p.fineH(36, 41, 31.5, PAL.sky[2]);
    return;
  }
  // Awning: green with cloth stripes, a lit top and a scalloped hem.
  p.rect(1, 0, 46, 5, PAL.green[2]);
  for (let x = 1; x < 47; x += 6) {
    p.rect(x, 0, 3, 7, PAL.cloth[3]);
    if (x + 3 < 47) p.fineV(x + 2.5, 0, 6.5, PAL.cloth[1]);
  }
  for (let x = 4; x < 47; x += 6) {
    p.rect(x, 5, 3, 2, PAL.green[2]);
    if (x + 3 < 47) p.fineV(x + 2.5, 0, 6.5, PAL.green[1]);
  }
  p.fineH(1, 46.5, 0, PAL.green[3]);
  p.vline(3, 7, 35, PAL.brown[1]);
  p.vline(44, 7, 35, PAL.brown[1]);
  p.fineV(3, 7, 35.5, PAL.brown[2]);
  p.fineV(44, 7, 35.5, PAL.brown[2]);
  // Tiers of buckets.
  for (let row = 0; row < 3; row++) {
    const y = 14 + row * 7;
    p.rect(5, y + 4, 38, 2, PAL.brown[row === 2 ? 1 : 2]);
    p.fineH(5, 42.5, y + 4, PAL.brown[row === 2 ? 2 : 3]);
    p.fineH(5, 42.5, y + 5.5, PAL.brown[0]);
    for (let i = 0; i < 6; i++) {
      const x = 6 + i * 6 + (row & 1) * 2;
      p.rect(x, y + 1, 5, 4, PAL.steel[2]);
      p.hline(x, x + 4, y + 1, PAL.steel[3]);
      p.fineH(x, x + 4.5, y + 1.5, PAL.steel[1]);
      p.fineV(x + 4.5, y + 2, y + 4.5, PAL.steel[1]);
      p.dot(x + 0.5, y + 2.5, PAL.steel[3]);
      const c = TULIP[(i + row * 2) % TULIP.length];
      for (const dx of [0, 2, 4]) {
        p.vline(x + dx, y - 2, y, PAL.green[2]);
        p.fineV(x + dx + 0.5, y - 1, y + 0.5, PAL.green[1]);
        cup2(p, x + dx, y - 3, c);
      }
      // A leaf between the stems.
      p.fine(x + 1, y + 0.5, x + 1.5, y - 1, PAL.green[3]);
    }
  }
  p.rect(5, 33, 38, 3, PAL.brown[1]);
  p.fineH(5, 42.5, 33, PAL.brown[2]);
});

// ---------------------------------------------------------------------------- market stall

breakable2('ams-market-stall', 56, 38, (p, broken) => {
  if (broken) {
    // The awning down on the table, records, a radio and the snapped table board.
    p.poly([[2, 30], [28, 24], [54, 31], [54, 37], [2, 37]], PAL.red[1]);
    p.fine(2, 30, 28, 24, PAL.red[2]);
    p.fine(28, 24, 54, 31, PAL.red[2]);
    for (let x = 6; x < 52; x += 8) {
      p.line(x, 31, x + 4, 29, PAL.cloth[3]);
      p.fine(x + 0.5, 32, x + 4.5, 30, PAL.cloth[1]);
    }
    p.circle(14, 33, 3, PAL.black[2]);
    p.ring(14, 33, 2, PAL.black[1]);
    p.set(14, 33, PAL.red[2]);
    p.dot(13, 31.5, PAL.steel[3]);
    p.rect(36, 32, 7, 4, PAL.brown[2]);
    p.fineH(36, 42.5, 32, PAL.brown[3]);
    p.dot(38, 33.5, PAL.stone[3]);
    p.fineV(40.5, 33, 35, PAL.stone[2]);
    p.line(4, 36, 50, 34, PAL.brown[0]);
    p.fine(4, 35.5, 50, 33.5, PAL.brown[2]);
    return;
  }
  // The red-white awning with a fold shadow on every stripe.
  p.rect(1, 0, 54, 6, PAL.red[2]);
  for (let x = 1; x < 55; x += 8) {
    p.rect(x, 0, 4, 6, PAL.cloth[3]);
    p.fineV(x + 3.5, 0, 5.5, PAL.cloth[1]);
  }
  for (let x = 5; x + 4 < 55; x += 8) p.fineV(x + 3.5, 0, 5.5, PAL.red[1]);
  p.fineH(1, 54.5, 0, PAL.snow[3]);
  for (let x = 1; x < 55; x += 4) {
    const c = x % 8 === 1 ? PAL.cloth[3] : PAL.red[2];
    p.rect(x, 6, 2, 2, c);
    p.dot(x + 1.5, 7.5, x % 8 === 1 ? PAL.cloth[1] : PAL.red[1]);
  }
  p.vline(3, 8, 37, PAL.steel[1]);
  p.vline(52, 8, 37, PAL.steel[1]);
  p.fineV(3, 8, 37.5, PAL.steel[2]);
  p.fineV(52, 8, 37.5, PAL.steel[2]);
  // Table and goods.
  p.rect(4, 24, 48, 3, PAL.brown[2]);
  p.hline(4, 51, 24, PAL.brown[3]);
  p.fineH(4, 51.5, 26.5, PAL.brown[1]);
  p.rect(6, 27, 44, 8, PAL.sky[0]);
  p.fineH(6, 49.5, 27, PAL.navy[1]);
  for (let x = 6; x < 50; x += 3) p.fineV(x + 1.5, 28, 34.5, PAL.sky[1]); // the cloth's folds
  // Records, a radio, a lamp, books.
  for (const [x, y, lab] of [[10, 20, PAL.red[2]], [17, 21, PAL.gold[2]]] as const) {
    p.circle(x, y, 3, PAL.black[2]);
    p.ring(x, y, 2, PAL.black[1]);
    p.set(x, y, lab);
    p.dot(x + 0.5, y + 0.5, PAL.black[2]);
    p.dot(x - 2, y - 2, PAL.steel[3]);
  }
  p.rect(22, 17, 9, 7, PAL.brown[1]);
  p.fineH(22, 30.5, 17, PAL.brown[2]);
  p.circle(25, 20, 2, PAL.stone[3]);
  p.ring(25, 20, 2, PAL.stone[2]);
  p.set(25, 20, PAL.stone[1]);
  p.rect(28, 18, 2, 4, PAL.stone[2]);
  for (let y = 18.5; y < 22; y += 1) p.fineH(28, 29.5, y, PAL.stone[1]);
  p.fine(23, 17, 21, 14.5, PAL.steel[3]); // aerial
  p.vline(36, 14, 23, PAL.gold[1]);
  p.fineV(36, 14, 23.5, PAL.gold[2]);
  p.poly([[33, 14], [39, 14], [37, 10], [35, 10]], PAL.gold[3]);
  p.fine(37, 10, 39, 14, PAL.gold[2]);
  p.fineH(33, 39.5, 14.5, PAL.gold[1]);
  p.rect(34, 23, 5, 1, PAL.gold[1]);
  for (let i = 0; i < 4; i++) {
    const c = [PAL.teal[1], PAL.red[1], PAL.gold[1], PAL.purple[1]][i];
    const hi = [PAL.teal[2], PAL.red[2], PAL.gold[2], PAL.purple[2]][i];
    p.rect(42 + i * 2, 17 + (i & 1), 2, 7 - (i & 1), c);
    p.fineV(42 + i * 2, 17 + (i & 1), 23.5, hi);
    p.fineH(42 + i * 2, 43.5 + i * 2, 19 + (i & 1), PAL.snow[2]);
  }
});

// ---------------------------------------------------------------------------- bike rack

breakable2('ams-bike-rack', 52, 24, (p, broken) => {
  const colors: readonly Color[] = [PAL.black[2], PAL.red[1], PAL.teal[1]];
  const lit: readonly Color[] = [PAL.steel[1], PAL.red[2], PAL.teal[2]];
  if (broken) {
    p.hline(2, 50, 23, PAL.steel[2]);
    p.fineH(2, 50.5, 23, PAL.steel[3]);
    for (let i = 0; i < 3; i++) {
      const x = 6 + i * 15;
      // A buckled wheel, the bent frame and a loose bell.
      p.ellipse(x, 18, 11, 6, PAL.black[2], false);
      p.fine(x + 2, 19, x + 9, 21, PAL.stone[1]);
      p.fine(x + 5.5, 18.5, x + 5, 23, PAL.stone[1]);
      p.line(x - 2, 20, x + 10, 17, colors[i]);
      p.fine(x - 2, 19.5, x + 10, 16.5, lit[i]);
      p.circle(x + 9, 21, 2, PAL.stone[2], false);
      p.dot(x + 9, 21, PAL.steel[3]);
    }
    return;
  }
  // The rack: hoops with a lit front bar.
  p.hline(1, 51, 22, PAL.steel[2]);
  p.fineH(1, 51.5, 22, PAL.steel[3]);
  for (let x = 4; x < 50; x += 8) {
    p.vline(x, 12, 22, PAL.steel[3]);
    p.vline(x + 4, 12, 22, PAL.steel[2]);
    p.hline(x, x + 4, 12, PAL.steel[3]);
    p.fineV(x + 0.5, 12.5, 22, PAL.steel[2]);
    p.fineV(x + 4.5, 12.5, 22, PAL.steel[1]);
    p.dot(x, 12, PAL.snow[3]);
  }
  // Bikes (front wheels in the rack, turned slightly): fine spokes, tubes with a lit edge, saddles.
  for (let i = 0; i < 3; i++) {
    const x = 8 + i * 16;
    const c = colors[i];
    for (const wx of [x, x + 12]) {
      p.circle(wx, 17, 5, PAL.ink[1], false);
      p.fine(wx - 3, 17.25, wx + 3.5, 17.25, PAL.steel[2]);
      p.fine(wx + 0.25, 14, wx + 0.25, 20.5, PAL.steel[2]);
      p.fine(wx - 2, 15, wx + 2.5, 19.5, PAL.steel[1]);
      p.dot(wx, 17, PAL.steel[3]);
    }
    p.line(x, 17, x + 6, 17, c);
    p.line(x + 6, 17, x + 4, 9, c);
    p.line(x + 6, 17, x + 10, 10, c);
    p.line(x + 10, 8, x + 12, 17, c);
    p.line(x + 4, 9, x, 17, c);
    p.fine(x + 6, 16.5, x + 9.5, 10.5, lit[i]);
    p.fine(x + 4, 9, x + 0.5, 16, lit[i]);
    p.hline(x + 2, x + 6, 8, PAL.brown[1]);
    p.fineH(x + 2, x + 6, 8, PAL.brown[2]);
    p.hline(x + 9, x + 12, 7, PAL.steel[3]);
    p.dot(x + 12.5, 7.5, PAL.ink[1]); // grip
    // A chain lock round the front wheel.
    if (i === 1) for (let k = 0; k < 4; k++) p.dot(x + 11 + k * 0.5, 19 + (k & 1) * 0.5, PAL.gold[2]);
  }
});
