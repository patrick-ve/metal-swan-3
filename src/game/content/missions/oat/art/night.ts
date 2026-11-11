/**
 * The decor of the oat-d night proof strip (STREET-A, wave A; docs/design/oat.md §2.5 0–1,280, §8.7
 * d 3–6, §8.9 "neon signs and tubes as sprites", §8.11; scenery research §2.6, §3 d): the Oudezijds
 * Achterburgwal at 22:30. No sun: the sprites read dark, lit by the lamps; the light pass adds the
 * glows, the streaks on the water and the lamp groups (LIGHT-WATER). Static props have NO outline.
 *
 * - `decor/oat/d/neon-bar` (pink), `neon-snacks` (cyan), `neon-koffie` (warm): our own words as neon
 *   tubes (a pale core at 2× / 4×, the glow, a soft halo fringe in the ramp's dark tone) on a thin
 *   dark backplate; 3 frames (two "on" with a different hum shimmer, one flicker-dim), anchor at the
 *   wall top-left. `OAT_D_NEON` lists them (sizes, tints) for the placement and the light groups.
 * - `decor/oat/d/blowverbod`: the ban sign on its pole (a white disc, a red ring and bar, our own
 *   pictogram of a hand with a smoking roll-up; a white plate `BLOWVERBOD`).
 * - `decor/oat/d/lantern-wall` (a Ritter lantern on a classic wall bracket), `decor/oat/d/lantern`
 *   (the oxblood classic mast with a Kroon lantern), both lit warm (PAL_HD_OAT.lantern).
 * - `decor/oat/d/bin-broken`, `decor/oat/d/bike-1`, `bike-2`, `decor/oat/d/paal`.
 * - `decor/oat/d/elm`: a quay elm on our pavement BEHIND the heroes (gate 5: a front-row trunk hid
 *   the hero): its true-scale trunk lit from below, the crown as dark clumps over the upper storeys,
 *   lit warm at their lower edges.
 * - `decor/oat/d/plate-oudezijds-achterburgwal`: the navy street-name plate (`OAT_D_PLATE`).
 */
import type { Color } from '../../../../../engine/color';
import { PAL_HD } from '../../../../../engine/palette-hd';
import { noise2 } from '../../../../art/paint';
import { h2, mx, Pen, reg, T, text, textW, type Dn } from './kit';
import { drawBike } from './people';

// ------------------------------------------------------------------------------------ neon

type Tint = 'pink' | 'cyan' | 'warm';

/** The tube's tones per tint: [halo (dark), glow, core]. */
function neonTones(t: Tint, d: Dn): readonly [Color, Color, Color] {
  if (t === 'pink') return [T('pink', 1, d), T('oat.neonPink', 0, d), T('oat.neonPink', 1, d)];
  if (t === 'cyan') return [mx(T('navy', 3, d), T('oat.neonCyan', 0, d), 0.35, d), T('oat.neonCyan', 0, d), T('oat.neonCyan', 1, d)];
  return [T('oat.lantern', 0, d), T('oat.lantern', 1, d), T('oat.lantern', 3, d)];
}

/** The letter scale of the neon words (glyph px → logical px). */
const NEON_SCALE = 1.5;
/** The backplate's margin round the word (logical px). */
const NEON_PAD = 2.5;

function neonSize(word: string): { w: number; h: number } {
  return { w: Math.ceil(textW(word, NEON_SCALE) + NEON_PAD * 2), h: Math.ceil(5 * NEON_SCALE + NEON_PAD * 2) };
}

/**
 * A neon word on its backplate. Frame 0 and 1: on (frame 1 shimmers: a few core px drop to the glow);
 * frame 2: the flicker-dim (the glow sinks to the halo tone, the core to the glow, no halo).
 */
function neon(p: Pen, word: string, tint: Tint, frame: number): void {
  const d = p.d;
  const [halo, glow, core] = neonTones(tint, d);
  // The backplate: a dark painted panel with a lighter top edge, two fixing bolts.
  p.rect(0.5, 0.5, p.w - 1, p.h - 1, T('ink', 1, d));
  p.rect(0.5, 0.5, p.w - 1, d === 1 ? 1 : 0.5, T('black', 3, d));
  if (d >= 2) {
    p.rect(1.2, p.h / 2 - 0.4, 0.8, 0.8, T('slate', 3, d));
    p.rect(p.w - 2, p.h / 2 - 0.4, 0.8, 0.8, T('slate', 3, d));
  }
  // The word as a mask, then the tube: core in the stroke's middle, glow round it, a halo outside.
  const m = new Pen(p.w, p.h, d);
  text(m, word, NEON_PAD, NEON_PAD, 0xffffffff, NEON_SCALE);
  const W = p.W;
  const H = p.H;
  const rc = d >= 4 ? 2 : 1;
  const rh = d >= 4 ? 2 : d === 2 ? 1 : 0;
  const inM = (X: number, Y: number): boolean => X >= 0 && Y >= 0 && X < W && Y < H && m.px[Y * W + X] !== 0;
  for (let Y = 0; Y < H; Y++) {
    for (let X = 0; X < W; X++) {
      if (inM(X, Y)) {
        let isCore = d >= 2;
        for (let k = 1; k <= rc && isCore; k++) if (!inM(X - k, Y) || !inM(X + k, Y) || !inM(X, Y - k) || !inM(X, Y + k)) isCore = false;
        if (frame === 2) p.dot(X, Y, isCore ? glow : halo);
        else if (frame === 1 && isCore && h2(X >> 1, Y >> 1, 17) < 0.18) p.dot(X, Y, glow);
        else p.dot(X, Y, isCore ? core : glow);
        continue;
      }
      if (frame === 2 || rh === 0) continue;
      let near = false;
      for (let dy = -rh; dy <= rh && !near; dy++) for (let dx = -rh; dx <= rh && !near; dx++) if (inM(X + dx, Y + dy)) near = true;
      if (near) p.dot(X, Y, halo);
    }
  }
}

/** The neon signs of the d strip: ids, logical sizes and tints (anchor top-left at the wall). */
export const OAT_D_NEON: Readonly<Record<string, { id: string; w: number; h: number; tint: Tint }>> = (() => {
  const out: Record<string, { id: string; w: number; h: number; tint: Tint }> = {};
  const list: readonly [string, string, Tint][] = [
    ['bar', 'BAR', 'pink'],
    ['snacks', 'SNACKS', 'cyan'],
    ['koffie', 'KOFFIE', 'warm'],
  ];
  for (const [key, word, tint] of list) {
    const { w, h } = neonSize(word);
    const id = `decor/oat/d/neon-${key}`;
    out[key] = { id, w, h, tint };
    reg(id, [0, 1, 2].map(() => ({ w, h, ox: 0, oy: 0 })), (p, f) => neon(p, word, tint, f), { ticksPerFrame: 12 });
  }
  return out;
})();

// ------------------------------------------------------------------------------------ the ban sign

reg('decor/oat/d/blowverbod', [{ w: 24, h: 62, ox: 12, oy: 62 }], (p) => {
  const d = p.d;
  const cx = 12;
  // The pole (galvanised, dark at night, a lamp's rim on the left).
  p.rect(cx - 0.75, 12, 1.5, 50, T('slate', 2, d));
  if (d >= 2) p.rect(cx - 0.75, 12, 0.5, 50, T('slate', 4, d));
  p.rect(cx - 1.2, 60.5, 2.4, 1.5, T('slate', 1, d));
  // The disc: a red ring round a white field (white at night: a cool grey), the pictogram, the bar.
  const white = T('snow', 3, d);
  p.disc(cx, 7, 6.2, 6.2, (_X, _Y, u, v) => {
    const q = Math.sqrt(u * u + v * v);
    if (q > 0.78) return T('red', 4, d);
    return u < -0.4 && v < -0.2 && d >= 2 ? T('snow', 4, d) : white;
  });
  // A hand from the lower right holding a roll-up, a curl of smoke (our own pictogram).
  p.poly(
    [
      [cx + 1, 9.6],
      [cx + 3.6, 8.4],
      [cx + 3.8, 10.6],
      [cx + 1.8, 11.2],
    ],
    T('ink', 1, d),
  );
  p.line(cx - 2.6, 8.2, cx + 1.2, 9.4, T('ink', 1, d), Math.max(1, Math.round(d * 0.8)));
  if (d >= 2) {
    p.rect(cx - 3.2, 6.6, 0.6, 0.6, T('ink', 1, d));
    p.rect(cx - 3.8, 5.4, 0.6, 0.6, T('ink', 1, d));
    p.rect(cx - 3.2, 4.2, 0.6, 0.6, T('ink', 1, d));
  }
  // The bar: top-left to bottom-right through the field (under the ring's thickness).
  p.line(cx - 3.6, 3.4, cx + 3.6, 10.6, T('red', 4, d), Math.max(1, Math.round(d * 1.2)));
  // The text plate.
  p.rect(0.5, 14, 23, 6, white);
  p.rect(0.5, 14, 23, d === 1 ? 1 : 0.5, T('snow', 4, d));
  if (d >= 2) text(p, 'BLOWVERBOD', (24 - textW('BLOWVERBOD', 0.5)) / 2, 15.2, T('ink', 1, d), 0.5);
  else p.rect(3, 16, 18, 1, T('slate', 2, d));
  if (d >= 2) p.rect(3, 18.2, 18, 0.5, T('slate', 3, d));
});

// ------------------------------------------------------------------------------------ lanterns

/** The lit glass of a lantern (core → spill toward its edges), over a logical rect. */
function glass(p: Pen, x: number, y: number, w: number, h: number): void {
  const d = p.d;
  p.fill(x, y, w, h, (X, Y) => {
    const u = ((X + 0.5) / d - x) / w;
    const v = ((Y + 0.5) / d - y) / h;
    const e = Math.min(u, 1 - u) * 2 * Math.min(1, v * 3) * Math.min(1, (1 - v) * 4);
    return e > 0.55 ? T('oat.lantern', 3, d) : e > 0.25 ? T('oat.lantern', 2, d) : T('oat.lantern', 1, d);
  });
}

reg('decor/oat/d/lantern-wall', [{ w: 14, h: 18, ox: 0, oy: 0 }], (p) => {
  const d = p.d;
  const iron = T('ink', 1, d);
  const ironLit = T('oat.lantern', 0, d);
  // The wall plate and the scroll bracket reaching out to the right.
  p.rect(0, 1, 1.5, 6, iron);
  p.line(1, 2, 10, 2, iron, Math.max(1, Math.round(d * 0.8)));
  p.line(1, 6, 5, 3, iron, Math.max(1, Math.round(d * 0.6)));
  // The lantern hanging from the bracket's end: the cap, the tapered glass, the bowl.
  const cx = 9.5;
  p.rect(cx - 0.3, 2, 0.6, 1.6, iron);
  p.poly(
    [
      [cx - 1, 3.4],
      [cx + 1, 3.4],
      [cx + 3.4, 6],
      [cx - 3.4, 6],
    ],
    iron,
  );
  p.poly(
    [
      [cx - 3, 6],
      [cx + 3, 6],
      [cx + 2.2, 13],
      [cx - 2.2, 13],
    ],
    (X, Y) => {
      const x = (X + 0.5) / d;
      const y = (Y + 0.5) / d;
      const e = 1 - Math.abs(x - cx) / 3;
      return e > 0.55 && y > 7 ? T('oat.lantern', 3, d) : e > 0.25 ? T('oat.lantern', 2, d) : T('oat.lantern', 1, d);
    },
  );
  if (d >= 2) p.rect(cx - 0.25, 6, 0.5, 7, T('oat.lantern', 1, d));
  p.poly(
    [
      [cx - 2.4, 13],
      [cx + 2.4, 13],
      [cx + 1, 15],
      [cx - 1, 15],
    ],
    iron,
  );
  p.rect(cx - 0.4, 15, 0.8, 1.2, iron);
  // The lit rims of the cap and the bowl (the lantern lights its own iron).
  if (d >= 2) {
    p.rect(cx - 3.2, 5.6, 6.4, 0.5, ironLit);
    p.rect(cx - 2.2, 13, 4.4, 0.5, ironLit);
  }
});

reg('decor/oat/d/lantern', [{ w: 12, h: 90, ox: 6, oy: 90 }], (p) => {
  const d = p.d;
  const cx = 6;
  const ox = (k: number): Color => T('oat.oxblood', k, d);
  // The post: a plinth, a fluted shaft tapering up, a collar; lit from above (the lantern), dark below.
  p.poly(
    [
      [cx - 2.6, 90],
      [cx + 2.6, 90],
      [cx + 2, 82],
      [cx - 2, 82],
    ],
    ox(0),
  );
  p.rect(cx - 2.2, 81, 4.4, 1, ox(1));
  p.fill(cx - 1.3, 20, 2.6, 61, (X, Y) => {
    const x = (X + 0.5) / d - (cx - 1.3);
    const y = (Y + 0.5) / d;
    const up = Math.max(0, 1 - (y - 20) / 40);
    const side = x < 0.8 ? 1 : x > 1.9 ? -1 : 0;
    const k = up * 1.6 + side * 0.5;
    if (d >= 4 && Math.abs(x - 1.3) < 0.15) return ox(0);
    return k > 1.4 ? mx(ox(2), T('oat.lantern', 1, d), 0.3, d) : k > 0.6 ? ox(2) : k > -0.2 ? ox(1) : ox(0);
  });
  p.rect(cx - 1.8, 46, 3.6, 1.2, ox(1));
  p.rect(cx - 1.6, 19, 3.2, 1.4, ox(2));
  // The Kroon lantern: a four-sided glass body under a crown, a small finial.
  p.rect(cx - 2.4, 17.6, 4.8, 1.4, T('ink', 1, d));
  glass(p, cx - 3, 9, 6, 8.6);
  if (d >= 2) {
    p.rect(cx - 0.25, 9, 0.5, 8.6, T('oat.lantern', 1, d));
    p.rect(cx - 3, 9, 0.5, 8.6, T('oat.lantern', 0, d));
    p.rect(cx + 2.5, 9, 0.5, 8.6, T('ink', 1, d));
  }
  p.poly(
    [
      [cx - 3.8, 9.2],
      [cx + 3.8, 9.2],
      [cx + 2.2, 6.4],
      [cx - 2.2, 6.4],
    ],
    T('ink', 1, d),
  );
  // The crown's points and the finial, their undersides lit by the glass.
  for (let k = -1; k <= 1; k++) p.rect(cx + k * 1.8 - 0.4, 4.6 - (k === 0 ? 0.8 : 0), 0.8, 2, T('ink', 1, d));
  p.rect(cx - 0.3, 1.2, 0.6, 3, T('ink', 1, d));
  p.disc(cx, 1.2, 0.7, 0.7, T('black', 3, d));
  if (d >= 2) p.rect(cx - 3.8, 8.9, 7.6, 0.4, T('oat.lantern', 0, d));
});

// ------------------------------------------------------------------------------------ the broken bin

reg('decor/oat/d/bin-broken', [{ w: 22, h: 22, ox: 11, oy: 22 }], (p) => {
  const d = p.d;
  // The city's 100 L street bin (dark grey), its front door hanging open, the lid askew.
  const body = (k: number): Color => T('slate', k, d);
  p.rect(3, 6, 9, 15.5, body(2));
  p.rect(3, 6, 1.6, 15.5, body(3));
  p.rect(10.6, 6, 1.4, 15.5, body(1));
  p.rect(3.5, 21, 8, 1, body(1));
  // Our own city mark: a plain raised band (never the real arms).
  if (d >= 2) p.rect(4.6, 10, 5.8, 0.6, body(4));
  // The lid tipped up behind, the door swung open to the right.
  p.poly(
    [
      [2.4, 6.2],
      [12.4, 6.2],
      [11, 3],
      [3.2, 4.2],
    ],
    body(3),
  );
  p.poly(
    [
      [12, 9],
      [15.5, 10.5],
      [15.5, 20],
      [12, 21],
    ],
    body(1),
  );
  // The litter: a pizza box, cups, a bottle, paper, spilling to the right on the ground.
  p.poly(
    [
      [13.5, 21],
      [20.5, 20],
      [21.5, 22],
      [14, 22],
    ],
    T('sand', 3, d),
  );
  if (d >= 2) p.rect(15, 20.6, 4, 0.5, T('sand', 4, d));
  p.rect(16.2, 17.6, 1.6, 2.4, T('stone', 4, d));
  p.rect(16.2, 17.6, 1.6, 0.5, T('stone', 5, d));
  p.line(1, 21.4, 4.6, 19.4, T('oat.canal', 2, d), Math.max(1, Math.round(d * 1.2)));
  p.rect(0.6, 21, 1.6, 1, T('oat.canal', 3, d));
  p.disc(19, 18.8, 1.3, 1, T('stone', 3, d));
  p.rect(6, 4.2, 2.4, 2, T('stone', 4, d));
  // The lamp's warm rim on the left edges (wet at night).
  if (d >= 2) {
    p.rect(3, 6, 0.5, 15, T('oat.nightWater', 3, d));
    p.rect(3.2, 4.2, 4, 0.4, T('oat.nightWater', 3, d));
  }
});

// ------------------------------------------------------------------------------------ bikes

for (const k of [1, 2]) {
  reg(`decor/oat/d/bike-${k}`, [{ w: 38, h: 24, ox: 19, oy: 24 }], (p) => {
    const d = p.d;
    drawBike(
      p,
      19,
      23.6,
      k === 1
        ? { frame: T('navy', 1, d), frameLit: T('navy', 3, d), tyre: T('ink', 0, d), rim: T('slate', 2, d), metal: T('slate', 3, d), saddle: T('ink', 1, d), rimLight: T('oat.lantern', 0, d) }
        : { frame: T('oat.brick', 1, d), frameLit: T('oat.brick', 3, d), tyre: T('ink', 0, d), rim: T('slate', 2, d), metal: T('slate', 3, d), saddle: T('ink', 1, d), crate: [T('ink', 1, d), T('slate', 2, d)], rimLight: T('oat.lantern', 0, d) },
      k === 2,
    );
  });
}

// ------------------------------------------------------------------------------------ the quay elm

reg('decor/oat/d/elm', [{ w: 84, h: 200, ox: 42, oy: 200 }], (p) => {
  const d = p.d;
  const cx = 42;
  // The trunk: true scale (10 px wide) up to the band top, bark ridges, lit warm from below (the
  // lanterns and the neon on the quay), the right side in its own shade.
  p.fill(cx - 5, 124, 10, 76, (X, Y) => {
    const x = (X + 0.5) / d - (cx - 5);
    const y = (Y + 0.5) / d;
    const lit = Math.max(0, (y - 150) / 50);
    const ridge = d >= 2 ? h2(Math.floor(x * 1.4), Math.floor(y / 3.2), 61) : 0.5;
    const side = x < 3 ? 0.6 : x > 7.5 ? -0.8 : 0;
    const k = lit * 2.2 + side + (ridge - 0.5) * 0.9;
    return k > 2 ? T('oat.lantern', 0, d) : k > 1.2 ? T('brown', 2, d) : k > 0.4 ? T('oat.brick', 1, d) : k > -0.4 ? T('oat.nightWater', 1, d) : T('oat.nightWater', 0, d);
  });
  // The root flare and the tree grate in the pavement.
  p.poly(
    [
      [cx - 5, 192],
      [cx - 8, 200],
      [cx + 8, 200],
      [cx + 5, 192],
    ],
    T('oat.brick', 1, d),
  );
  // Limbs into the crown.
  p.line(cx - 2, 128, cx - 20, 92, T('oat.nightWater', 0, d), Math.max(1, Math.round(d * 3)));
  p.line(cx + 2, 128, cx + 18, 86, T('oat.nightWater', 0, d), Math.max(1, Math.round(d * 2.6)));
  p.line(cx, 126, cx + 2, 80, T('oat.nightWater', 0, d), Math.max(1, Math.round(d * 2.2)));
  // The crown (spec §8.2 "the crown at 0.4 above"; §8.7 d 5 "dark masses lit from below"): leaf
  // clumps, gaps only between clumps (a smooth 3.5 px noise at the rim, never single holes), the
  // clumps' lower edges lit warm by the quay lights, a few early-yellow leaves in 2 × 2 clusters.
  const blobs: readonly [number, number, number, number][] = [
    [cx - 24, 62, 17, 15],
    [cx + 22, 58, 18, 16],
    [cx - 2, 40, 22, 18],
    [cx - 30, 88, 12, 10],
    [cx + 28, 86, 13, 10],
    [cx - 8, 96, 16, 11],
    [cx + 10, 100, 14, 9],
    [cx - 14, 22, 14, 11],
    [cx + 14, 22, 15, 12],
  ];
  for (const [bx, by, rx, ry] of blobs) {
    p.disc(bx, by, rx, ry, (X, Y, u, v) => {
      const lx = (X + 0.5) / d;
      const ly = (Y + 0.5) / d;
      const clump = noise2(lx, ly, 3.5, 67);
      const r2 = u * u + v * v;
      if (r2 > 0.62 && clump < 0.3 + (r2 - 0.62) * 1.6) return 0;
      // The light from below: strong at a clump's lower edge, the crown's underside warmest.
      const under = v * 0.8 + Math.max(0, (ly - 60) / 50) * 0.7 + (clump - 0.5) * 0.5;
      if (under > 1.35) return T('oat.lantern', 0, d);
      if (under > 1.08) return T('brown', 1, d);
      if (under > 0.78) return T('olive', 1, d);
      if (d >= 2 && under > 0.5 && h2(Math.floor(lx / 2), Math.floor(ly / 2), 71) > 0.94) return T('brown', 2, d);
      return clump > 0.45 ? T('olive', 0, d) : T('oat.nightWater', 0, d);
    });
  }
});

// ------------------------------------------------------------------------------------ the street plate

const PLATE_LINES = ['OUDEZIJDS', 'ACHTERBURGWAL'];
const PLATE_SCALE = 0.5;

/** The navy street-name plate of the Oudezijds Achterburgwal (anchor bottom-left). */
export const OAT_D_PLATE: { readonly id: string; readonly w: number; readonly h: number } = (() => {
  const id = 'decor/oat/d/plate-oudezijds-achterburgwal';
  const w = Math.ceil(Math.max(...PLATE_LINES.map((s) => textW(s, PLATE_SCALE))) + 4);
  const h = 11;
  reg(id, [{ w, h, ox: 0, oy: h }], (p) => {
    const d = p.d;
    const navy = T('navy', 2, d);
    const white = T('snow', 4, d);
    p.rect(0, 0, w, h, navy);
    // The thin white border (a dark-enamel inner field at 1×: a plain border line).
    p.rect(0.5, 0.5, w - 1, d === 1 ? 1 : 0.5, white);
    p.rect(0.5, h - (d === 1 ? 1.5 : 1), w - 1, d === 1 ? 1 : 0.5, white);
    p.rect(0.5, 0.5, d === 1 ? 1 : 0.5, h - 1, white);
    p.rect(w - (d === 1 ? 1.5 : 1), 0.5, d === 1 ? 1 : 0.5, h - 1, white);
    if (d >= 2) {
      PLATE_LINES.forEach((s, i) => text(p, s, (w - textW(s, PLATE_SCALE)) / 2, 1.6 + i * 3, white, PLATE_SCALE));
      text(p, 'CENTRUM', (w - textW('CENTRUM', 0.4)) / 2, 7.9, T('snow', 3, d), 0.4);
    } else {
      p.rect(3, 3, w - 6, 1, white);
      p.rect(2, 6, w - 4, 1, white);
    }
    // The night: a lamp's warm wash on the lower left corner of the enamel (4×).
    if (d >= 4) p.rect(0.5, h - 2, 3, 1, mx(navy, T('oat.lantern', 0, d), 0.4, d));
  });
  return { id, w, h };
})();

// ------------------------------------------------------------------------------------ the bollard

reg('decor/oat/d/paal', [{ w: 4, h: 16, ox: 2, oy: 16 }], (p) => {
  const d = p.d;
  // The Amsterdammertje: a slim oxblood post with a domed top and a collar; three crosses (4×);
  // the wet sheen of a lamp along its left edge.
  p.rect(0.6, 3, 2.8, 13, T('oat.oxblood', 1, d));
  p.disc(2, 3, 1.6, 1.6, T('oat.oxblood', 1, d));
  p.rect(0.3, 4.2, 3.4, 0.9, T('oat.oxblood', 0, d));
  if (d >= 2) {
    p.rect(0.6, 3, 0.5, 13, mx(T('oat.oxblood', 2, d), T('oat.lantern', 1, d), 0.25, d));
    p.rect(2.9, 3, 0.5, 13, T('oat.oxblood', 0, d));
    p.rect(1.2, 1.8, 0.8, 0.5, T('oat.lantern', 0, d));
  }
  if (d >= 4) {
    for (let k = 0; k < 3; k++) {
      const y = 6.2 + k * 2.2;
      p.line(1.6, y, 2.6, y + 1, PAL_HD.ink[1], 1);
      p.line(2.6, y, 1.6, y + 1, PAL_HD.ink[1], 1);
    }
  }
});
