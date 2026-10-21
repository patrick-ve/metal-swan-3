/**
 * The tower's moving art (oz-f): the horde tide, the bells and their toll ring, the jet Swan's
 * rocket units, their flames and the trail. Owner: TOWER. One drawer per id makes 1×, 2× and 4×
 * (art-kit.ts); outline A for what moves or hurts (the tide's heads and arms, the bells, the units);
 * light and fire (the flames, the trail, the toll ring) without ink.
 *
 * The dead of the tide (spec §3.1, revision 2): risen soldiers in faded field grey and steel helmets,
 * rotting grey-green skin, bone showing, empty sockets with a dim pale glint; NO red, no insignia in
 * the mass (the armband is the zombies' own art, ZOMBIES). The bells: plain bronze church bells with
 * a dark patina and verdigris streaks on oak headstocks, whole (nothing breaks them).
 */
import type { Color } from '../../../../engine/color';
import { ladder } from '../../missions/oldenzaal/art-kit';
import { BELL, BELL_ART, BELL_FRAMES } from './bell';
import { dim, F, fbm, h2, len, lit, mx, outlineA, R, reg, same, shadeBall, shadeCyl, sstep, T, type Any, type Dn, type FrameGeom, Pen } from './art-kit';
import { SWAN_JET_ART } from './swan-jet';
import { TIDE_ART, TIDE_TILE } from './tide';

// =============================================================================================
// The dead of the tide
// =============================================================================================

interface HeadOpts {
  /** 'helmet' | 'cap' (a field cap) | 'skull' (bare). */
  kind: 0 | 1 | 2;
  /** −1 … 1: the face turned a little left / right. */
  turn: number;
  /** 0 = the front row … 1 = deep in the back (darker, mixed into the night). */
  depth: number;
  seed: number;
  /** Jaw open (0 … 1). */
  jaw: number;
}

/**
 * A tone of ramp n for light l (0 … 1), pushed down the ramp by depth (the back rows and the mass
 * sink into the dark of the shaft). Plain ramp tones: no mix toward another hue.
 */
function tone(n: Any, l: number, d: Dn, depth: number): Color {
  const top = len(n) - 2;
  const hi = Math.max(1.2, top - depth * 2.4);
  const v = 0.6 + Math.max(0, Math.min(1, l)) * (hi - 0.6);
  return R(n, Math.floor(v + 0.5), d);
}

/** Rounded shoulders in field grey under a head (centre x, top y), down to the tile's bottom h. */
function shoulders(p: Pen, cx: number, sy: number, s: number, o: HeadOpts, h: number): void {
  const d = p.d;
  const rx = s * 1.5;
  p.fill(cx - rx - 1, sy, rx * 2 + 2, h - sy, (X, Y) => {
    const x = (X + 0.5) / d - cx;
    const y = (Y + 0.5) / d - sy;
    // The slope from the neck to the shoulder point, then straight down.
    const half = rx * Math.min(1, 0.55 + y / (s * 1.1));
    if (Math.abs(x) > half) return 0;
    if (y < 0.9 - Math.abs(x) * 0.08) return 0;
    const u = x / rx;
    // Lit from above (the glow) and the upper left; darker down into the press of bodies.
    let l = shadeCyl(u, 0.8) * (1 - Math.min(1, y / (h - sy)) * 0.75);
    // The collar: a dark fold round the neck; a torn patch (a few clusters).
    if (y < s * 0.55 && Math.abs(x) < s * 0.62) l *= 0.45;
    if (fbm(X, Y, d, 2.4, o.seed + 5) > 0.74) l *= 0.6;
    return tone('r2:fieldGrey', l * 0.85, d, o.depth);
  });
}

/** A head of the dead (centre x, y of the face centre, radius s). */
function head(p: Pen, cx: number, cy: number, s: number, o: HeadOpts): void {
  const d = p.d;
  const fx = cx + o.turn * s * 0.16;
  const helmet = o.kind === 0;
  // The face / skull: rot ramp, sunken cheeks, sockets, bared teeth.
  p.disc(fx, cy + s * 0.18, s * 0.72, s * 0.84, (X, Y, u, v) => {
    const x = (X + 0.5) / d - fx;
    const y = (Y + 0.5) / d - cy;
    let l = shadeBall(u - o.turn * 0.25, v * 0.8) * 0.9;
    if (v > 0.1 && Math.abs(u) > 0.5) l -= 0.2; // sunken cheeks
    for (const sx of [-0.33, 0.33]) {
      const ex = x - (sx + o.turn * 0.12) * s;
      const ey = y - s * 0.02;
      const er = s * 0.21;
      if (ex * ex + ey * ey * 1.25 < er * er) {
        const glint = d > 1 && sx > 0 && ex * ex + ey * ey < (er * 0.32) ** 2 && o.depth < 0.5;
        return glint ? R('r2:rot', 6, d) : R('ink', 0, d);
      }
    }
    if (Math.abs(x - o.turn * s * 0.2) < s * 0.08 + 0.2 && y > s * 0.2 && y < s * 0.4) return R('ink', 1, d);
    if (y > s * 0.52 && Math.abs(x - o.turn * s * 0.1) < s * 0.4) {
      const my = s * (0.6 + o.jaw * 0.15);
      if (y < my) return d === 1 ? R('r2:rot', 4, d) : Math.floor((X / d) * 2) % 2 === 0 ? R('r2:rot', 5, d) : R('r2:rot', 6, d);
      if (y < my + s * 0.22 * (0.5 + o.jaw)) return R('ink', 0, d);
    }
    const n = fbm(X, Y, d, 2, o.seed);
    if (n > 0.76) l += 0.3; // bone through the skin
    else if (n < 0.24) l -= 0.22; // dark rot
    return tone('r2:rot', 0.1 + l * 0.8, d, o.depth);
  });
  if (helmet) {
    // The steel helmet over the brow: a dome, the flared skirt at the sides; worn field-grey paint,
    // dark rust in the dents, the cold glow on its crown.
    const hy = cy - s * 0.12;
    p.fill(cx - s * 1.3, hy - s * 1.1, s * 2.6, s * 1.6, (X, Y) => {
      const x = (X + 0.5) / d - cx;
      const y = (Y + 0.5) / d - hy;
      const dome = (x * x) / (s * s * 1.03) + (y * y) / (s * s * 0.92) <= 1 && y <= 0;
      const skirtW = s * (1.0 + Math.max(0, y) * 0.5);
      const skirt = y > 0 && y <= s * 0.42 && Math.abs(x) <= skirtW && !(Math.abs(x) < s * 0.7 && y > s * 0.12);
      if (!dome && !skirt) return 0;
      let l = dome ? shadeBall(x / (s * 1.02), y / (s * 0.96)) : shadeCyl(x / skirtW, -0.4) * 0.7;
      if (dome && y > -s * 0.18) l -= 0.12; // the shadow under the dome's swell
      if (skirt && y > s * 0.3) l -= 0.2;
      const n = fbm(X, Y, d, 1.4, o.seed + 9);
      if (n > 0.8) return R('brown', d === 1 ? 1 : 2, d);
      if (n < 0.18) l -= 0.2;
      return tone('r2:fieldGrey', 0.05 + l * 0.92, d, o.depth);
    });
  } else if (o.kind === 1) {
    // A field cap, slumped and torn.
    const hy = cy - s * 0.52;
    p.fill(cx - s, hy - s * 0.6, s * 2, s * 0.95, (X, Y) => {
      const x = (X + 0.5) / d - cx;
      const y = (Y + 0.5) / d - hy;
      if (Math.abs(x) > s * (0.9 - Math.max(0, -y) * 0.45) || y < -s * 0.55 + Math.abs(x) * 0.18 || y > s * 0.3) return 0;
      const l = shadeCyl(x / s, -y / s) - (y > s * 0.12 ? 0.25 : 0);
      return tone('r2:fieldGrey', l * 0.8, d, o.depth);
    });
  } else {
    // A bare scalp, rotting, a few wisps of dark hair.
    p.disc(fx, cy - s * 0.38, s * 0.76, s * 0.62, (X, Y, u, v) => {
      if (v > 0.5) return 0;
      if (fbm(X, Y, d, 1.3, o.seed + 3) > 0.68 && v < 0.1) return tone('r2:soot', 0.3, d, o.depth);
      return tone('r2:rot', 0.1 + shadeBall(u, v) * 0.75, d, o.depth);
    });
  }
}

/** One row of the dead (a 64 px tile): heads at varied heights, overlapping shoulders, the seethe by frame. */
function rowOfDead(p: Pen, f: number, back: boolean): void {
  const d = p.d;
  const W = TIDE_TILE.w;
  const H = back ? TIDE_TILE.backH : TIDE_TILE.edgeH;
  const n = back ? 8 : 7;
  const depth = back ? 0.7 : 0.15;
  const s0 = back ? 3.1 : 3.8;
  // The press of bodies under the shoulders (a continuous dark band to the tile's sides and bottom).
  const by = back ? 14 : 16;
  p.fill(0, by, W, H - by, (X, Y) => {
    const y = (Y + 0.5) / d - by;
    const nn = fbm(X, Y, d, 3, back ? 41 : 31);
    return tone('r2:fieldGrey', (0.35 + nn * 0.25) * (1 - y / (H - by)), d, depth + 0.35);
  });
  // The heads, back ones (higher) first, so the lower ones overlap them.
  const heads: Array<{ cx: number; cy: number; o: HeadOpts }> = [];
  for (let i = 0; i < n; i++) {
    const seed = (back ? 300 : 100) + i * 13;
    const step = (W - 2 - s0 * 2.6) / (n - 1);
    const cx = 1 + s0 * 1.3 + i * step + (h2(i, f, seed) - 0.5) * 1.4;
    const cy = (back ? 7.5 : 8.5) + (h2(i, 7, seed) - 0.5) * 4 + ((f + i) % 2 === 0 ? 0 : 0.8);
    const kind = h2(i, 5, seed) < 0.62 ? 0 : h2(i, 3, seed) < 0.5 ? 1 : 2;
    heads.push({ cx, cy, o: { kind: kind as 0 | 1 | 2, turn: (h2(i, f + 11, seed) - 0.5) * 1.4, depth, seed, jaw: h2(i, f + 21, seed) } });
  }
  heads.sort((a, b) => a.cy - b.cy);
  for (const hd of heads) {
    shoulders(p, hd.cx, hd.cy + s0 * 0.95, s0, hd.o, H);
    head(p, hd.cx, hd.cy, s0, hd.o);
  }
  outlineA(p);
}

/** The packed bodies below the heads: helmets and shoulders deep in the dark, periodic in x. */
function massOfDead(p: Pen, f: number): void {
  const d = p.d;
  const W = TIDE_TILE.w;
  const H = TIDE_TILE.massH;
  const spots: Array<[number, number, number, number]> = [];
  for (let r = 0; r < 5; r++) {
    for (let i = 0; i < 7; i++) {
      const x = (i * (W / 7) + (r % 2) * (W / 14) + h2(i, r, 501 + f) * 3) % W;
      const y = 2 + r * 10 + h2(i, r, 502) * 4;
      spots.push([x, y, 3.2 + h2(i, r, 503) * 1.2, h2(i, r, 504)]);
    }
  }
  p.fill(0, 0, W, H, (X, Y) => {
    const x = (X + 0.5) / d;
    const y = (Y + 0.5) / d;
    const deep = Math.min(1, y / H);
    // The nearest round shape (a helmet, a head, a shoulder) with wrapped distances: seamless tiles.
    let best = 1e9;
    let bk = -1;
    for (let k = 0; k < spots.length; k++) {
      const s = spots[k];
      let dx = Math.abs(x - s[0]);
      if (dx > W / 2) dx = W - dx;
      const dy = y - s[1];
      const q = (dx * dx + dy * dy * 1.2) / (s[2] * s[2]);
      if (q < best) {
        best = q;
        bk = k;
      }
    }
    const fade = 1 - deep * 0.85;
    if (best < 1) {
      const s = spots[bk];
      let dx = x - s[0];
      if (dx > W / 2) dx -= W;
      if (dx < -W / 2) dx += W;
      const l = shadeBall(dx / s[2], (y - s[1]) / s[2]) * fade;
      const n: Any = s[3] < 0.62 ? 'r2:fieldGrey' : 'r2:rot';
      // A dim glint of an eye now and then (the dead look up).
      if (d > 1 && s[3] > 0.9 && deep < 0.5 && Math.abs(dx - 1) < 0.3 && Math.abs(y - s[1] - 0.6) < 0.3) return R('r2:rot', 5, d);
      return R(n, Math.floor(0.5 + l * 2.6), d);
    }
    return R('r2:fieldGrey', fbm(X, Y, d, 3, 77) * fade > 0.45 ? 1 : 0, d);
  });
}

/** A rotting arm reaching up (anchor bottom centre), f 0 (low) … 3 (high, fingers spread). */
function armOfDead(p: Pen, f: number): void {
  const d = p.d;
  const W = TIDE_TILE.armW;
  const H = TIDE_TILE.armH;
  const cx = W / 2;
  const top = H - 12 - f * 4;
  // The sleeve (field grey, torn at the cuff) from the bottom up to the wrist.
  const wy = top + 7;
  p.fill(cx - 3, wy, 6, H - wy - 1, (X, Y) => {
    const x = (X + 0.5) / d - cx + ((Y + 0.5) / d - wy) * 0.12;
    if (Math.abs(x) > 2.4) return 0;
    const cuff = (Y + 0.5) / d - wy < 1.6 && h2(Math.floor(X / d), 1, 7) > 0.4;
    return cuff ? tone('r2:fieldGrey', 0.25, d, 0) : tone('r2:fieldGrey', shadeCyl(x / 2.4), d, 0);
  });
  // The forearm's bare wrist and the hand (rot, bony knuckles), the fingers splayed by f.
  p.disc(cx, wy - 1.4, 2.2, 2.4, (_X, _Y, u, v) => tone('r2:rot', 0.2 + shadeBall(u, v) * 0.8, d, 0));
  const spread = 0.25 + f * 0.18;
  for (let k = 0; k < 4; k++) {
    const a = -Math.PI / 2 + (k - 1.5) * spread;
    const lenF = 3.2 + (k === 1 || k === 2 ? 1 : 0) + f * 0.3;
    const x0 = cx + (k - 1.5) * 0.9;
    const y0 = wy - 2.6;
    const x1 = x0 + Math.cos(a) * lenF;
    const y1 = y0 + Math.sin(a) * lenF;
    p.line(x0, y0, x1, y1, R('r2:rot', 4, d), Math.max(1, Math.round(d * 0.9)));
    // A pale knuckle / bone tip.
    p.rect(x1 - 0.4, y1 - 0.4, 0.8, 0.8, R('r2:rot', d === 1 ? 5 : 7, d));
  }
  // The thumb.
  p.line(cx - 2, wy - 1.6, cx - 3.4, wy - 3.2, R('r2:rot', 3, d), Math.max(1, Math.round(d * 0.9)));
  outlineA(p);
}

reg(TIDE_ART.edge, same(4, { w: TIDE_TILE.w, h: TIDE_TILE.edgeH, ox: 0, oy: 0 }), (p, f) => rowOfDead(p, f, false), { ticksPerFrame: 8 });
reg(TIDE_ART.back, same(4, { w: TIDE_TILE.w, h: TIDE_TILE.backH, ox: 0, oy: 0 }), (p, f) => rowOfDead(p, f, true), { ticksPerFrame: 8 });
reg(TIDE_ART.mass, same(2, { w: TIDE_TILE.w, h: TIDE_TILE.massH, ox: 0, oy: 0 }), (p, f) => massOfDead(p, f), { ticksPerFrame: 16 });
reg(TIDE_ART.arm, same(4, { w: TIDE_TILE.armW, h: TIDE_TILE.armH, ox: TIDE_TILE.armW / 2, oy: TIDE_TILE.armH }), (p, f) => armOfDead(p, f));

// =============================================================================================
// The bells
// =============================================================================================

interface BellGeom {
  /** Headstock half length / top / bottom (local, pivot at 0, 0; y down). */
  hs: number;
  hsTop: number;
  hsBot: number;
  /** The bell body: shoulder y, height, half widths (shoulder → lip). */
  y0: number;
  hb: number;
  w0: number;
  w1: number;
  /** The clapper ball (local y, radius). */
  cy: number;
  cr: number;
  /** Frame size and anchor (the pivot). */
  fw: number;
  fh: number;
  ox: number;
  oy: number;
}

const SMALL: BellGeom = { hs: 15, hsTop: -5, hsBot: 2, y0: 6, hb: 26, w0: 5.5, w1: 11.5, cy: 35, cr: 2.6, fw: 84, fh: 64, ox: 42, oy: 18 };
const BIG: BellGeom = { hs: 18, hsTop: -6, hsBot: 3, y0: 7, hb: 30, w0: 6.5, w1: 14, cy: 41, cr: 3, fw: 88, fh: 72, ox: 44, oy: 20 };

/** The bell's half width at local y (0 outside the body). */
function bellW(g: BellGeom, y: number): number {
  const t = (y - g.y0) / g.hb;
  if (t < 0 || t > 1) return 0;
  let w = g.w0 + (g.w1 - g.w0) * (0.35 * t + 0.65 * t * t * t);
  // The rounded shoulder.
  if (t < 0.14) w *= Math.sqrt(Math.max(0, 1 - ((0.14 - t) / 0.14) ** 2)) * 0.35 + 0.65;
  // The lip (the sound bow) a little wider.
  if (t > 0.9) w += (t - 0.9) * 6;
  return w;
}

/** Bronze: a dark brown patina in the shade → a dull gold where the light catches it. */
const BRONZE_STOPS: readonly Color[] = [0x221a28ff, 0x33201bff, 0x5b3828ff, 0x8c5a17ff, 0xaa731dff, 0xc98c22ff, 0xf6c537ff];
const bronzeCache = new Map<number, readonly Color[]>();
function bronzeOf(d: Dn): readonly Color[] {
  let b = bronzeCache.get(d);
  if (!b) {
    b = ladder(BRONZE_STOPS, 2, d);
    bronzeCache.set(d, b);
  }
  return b;
}

/** Paint a bell at angle a (rad) into a pen whose anchor is the pivot. */
function paintBell(p: Pen, g: BellGeom, a: number): void {
  const d = p.d;
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  // The key light from the upper left, kept in the bell's own frame (the same look at every angle:
  // a swinging bell does not flicker between tones).
  const Lx = -0.62;
  const Ly = -0.45;
  const bronze = bronzeOf(d);
  p.fill(0, 0, g.fw, g.fh, (X, Y) => {
    const wx = (X + 0.5) / d - g.ox;
    const wy = (Y + 0.5) / d - g.oy;
    // World → local (rotate by −a).
    const x = wx * ca + wy * sa;
    const y = -wx * sa + wy * ca;
    // The headstock: an oak beam with iron straps and the gudgeon pins at its ends.
    if (y >= g.hsTop && y <= g.hsBot && Math.abs(x) <= g.hs + 2) {
      if (Math.abs(x) > g.hs) return y > g.hsTop + 2 && y < g.hsBot - 1 ? lit('steel', 0.3, d) : 0;
      const v = (y - g.hsTop) / (g.hsBot - g.hsTop);
      const strap = Math.abs(Math.abs(x) - g.hs * 0.45) < 1.1;
      if (strap) return lit('steel', v < 0.3 ? 0.65 : 0.3, d);
      let l = v < 0.22 ? 0.8 : v > 0.8 ? 0.1 : 0.4;
      l += (fbm(Math.round(x * 4), Math.round(y * 9), 1, 2, 61) - 0.5) * 0.3;
      return lit('wood', l * 0.6, d, 1, 5);
    }
    // The crown (canons).
    if (y > g.hsBot && y < g.y0 + 1 && Math.abs(x) < g.w0 * 0.55) return lit('brown', 0.35 + (x < 0 ? 0.25 : 0), d, 1, 5);
    // The body.
    const w = bellW(g, y);
    if (w > 0 && Math.abs(x) <= w) {
      const u = x / w;
      const t = (y - g.y0) / g.hb;
      const z = Math.sqrt(Math.max(0, 1 - u * u));
      // Normal ~ (u, −slope, z): the flare tips the lower body toward the light above.
      const slope = 0.15 + t * 0.6;
      const nl = Math.hypot(u, slope, z);
      let l = 0.12 + 0.88 * Math.max(0, (Lx * u + Ly * -slope + 0.6 * z) / nl);
      // The raised rings (an upper and a lower band).
      for (const rt of [0.2, 0.84]) {
        const dy = (t - rt) * g.hb;
        if (dy > -0.6 && dy < 0.2) l += 0.25;
        else if (dy >= 0.2 && dy < 0.9) l -= 0.25;
      }
      if (t > 0.94) l += 0.1;
      // Bronze: a dark brown in the shade, a dull gold in the light; verdigris runs down it.
      const streak = fbm(Math.round(x * 6), Math.round(y * 1.6), 1, 3, 113);
      if (streak > 0.68 && t > 0.25 && l < 0.75) return lit('teal', 0.25 + (streak - 0.68) * 1.6 + l * 0.2, d, 1, 3);
      return bronze[Math.max(0, Math.min(bronze.length - 1, Math.floor(l * l * 0.95 * (bronze.length - 0.01))))];
    }
    // The clapper's ball under the lip.
    const cx = x;
    const cy = y - g.cy;
    if (cx * cx + cy * cy <= g.cr * g.cr) return lit('steel', shadeBall(cx / g.cr, cy / g.cr) * 0.7, d);
    return 0;
  });
  // The inside of the mouth: a dark band along the lip (seen a little from below).
  outlineA(p);
}

/** The angle of frame i (−60° … +60°). */
const bellAngle = (i: number): number => ((i * BELL.stepDeg - BELL.maxDeg) * Math.PI) / 180;

for (const [id, g] of [
  [BELL_ART.small, SMALL],
  [BELL_ART.big, BIG],
] as const) {
  reg(id, same(BELL_FRAMES, { w: g.fw, h: g.fh, ox: g.ox, oy: g.oy }), (p, i) => paintBell(p, g, bellAngle(i)), { defer: true });
}

/** The toll: a ring of sound from the bell's mouth (pale gold, no ink), 4 frames. */
reg(BELL_ART.toll, same(4, { w: 48, h: 48, ox: 24, oy: 24 }), (p, f) => {
  const d = p.d;
  const r = 6 + f * 5;
  p.fill(0, 0, 48, 48, (X, Y) => {
    const x = (X + 0.5) / d - 24;
    const y = (Y + 0.5) / d - 24;
    const q = Math.hypot(x, y * 1.15);
    const e = Math.abs(q - r);
    if (e > 1.2) return 0;
    // Broken arcs (the sound comes in waves).
    const ang = Math.atan2(y, x);
    if (Math.sin(ang * 5 + f) > 0.55) return 0;
    return e < 0.5 ? T('sand', 7, d) : T('sand', 5, d);
  });
}, { defer: true });

// =============================================================================================
// The jet Swan's rocket units, flames and trail
// =============================================================================================

/** A rocket unit rotated by a (0 = nozzle back / left, π/2 = nozzle down), anchor at the centre. */
function paintUnit(p: Pen, a: number): void {
  const d = p.d;
  const W = 22;
  const H = 22;
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  p.fill(0, 0, W, H, (X, Y) => {
    const wx = (X + 0.5) / d - W / 2;
    const wy = (Y + 0.5) / d - H / 2;
    // World → local: local x runs from the nozzle (−) to the nose (+); rotate by −a about the centre.
    const x = wx * ca + wy * sa;
    const y = -wx * sa + wy * ca;
    // The pylon (up in local terms: toward the wing).
    if (wy < -2.6 && wy > -10 && Math.abs(wx + 0.5) < 2.2) return lit('steel', wx < -0.5 ? 0.75 : 0.4, d);
    // The body: a cylinder x −7 … 5, radius 3; the nose cone to 8.5; the nozzle bell −10 … −7.
    let r = 0;
    if (x >= -7 && x <= 5) r = 3;
    else if (x > 5 && x <= 8.5) r = 3 * Math.sqrt(Math.max(0, 1 - ((x - 5) / 3.5) ** 2));
    else if (x < -7 && x >= -10) r = 2.2 + (-7 - x) * 0.3;
    if (r <= 0 || Math.abs(y) > r) return 0;
    const u = y / r;
    // Light from the upper left in world terms ≈ local light rotated.
    const l = shadeCyl(u * ca + 0 * sa, -0.1) * 0.8 + 0.1;
    if (x < -7) return Math.abs(u) > 0.55 ? lit('steel', l * 0.5, d) : T('ink', 1, d);
    if (x > 5) return lit('navy', 0.25 + l * 0.75, d, 1, 5);
    // Navy bands, gold rivets, an ivory body like her plates.
    if (Math.abs(x + 4.5) < 0.7 || Math.abs(x - 3.2) < 0.7) return lit('navy', l, d, 1, 5);
    if (d > 1 && Math.abs(Math.abs(u) - 0.55) < 0.12 && (Math.round(x * 2) & 3) === 0) return T('gold', 5, d);
    return lit('snow', 0.15 + l * 0.85, d, 0, 6);
  });
  outlineA(p);
}

reg(SWAN_JET_ART.unit, same(3, { w: 22, h: 22, ox: 11, oy: 11 }), (p, f) => paintUnit(p, [0, -Math.PI / 4, -Math.PI / 2][f]));

/** The flame geometry per direction: [anchor x, y, dir x, dir y]. */
const FLAME_DIR: ReadonlyArray<readonly [number, number, number, number]> = [
  [18, 10, -1, 0],
  [15, 4, -0.7071, 0.7071],
  [10, 2, 0, 1],
];

const flameGeoms: FrameGeom[] = [];
for (let k = 0; k < 3; k++) for (let i = 0; i < 3; i++) flameGeoms.push({ w: 20, h: 20, ox: FLAME_DIR[k][0], oy: FLAME_DIR[k][1] });

/** A blue-white jet: a white core, a sky-blue sheath, a short flicker of 3 frames per direction. */
reg(SWAN_JET_ART.flame, flameGeoms, (p, i) => {
  const d = p.d;
  const [ax, ay, dx, dy] = FLAME_DIR[Math.floor(i / 3)];
  const f = i % 3;
  const L = 11 + f * 2.2;
  p.fill(0, 0, 20, 20, (X, Y) => {
    const x = (X + 0.5) / d - ax;
    const y = (Y + 0.5) / d - ay;
    const s = x * dx + y * dy; // along the jet
    const q = -x * dy + y * dx; // across it
    if (s < -0.5 || s > L) return 0;
    const t = Math.max(0, s) / L;
    const wdt = 2.6 * (1 - t) ** 0.7 + 0.3 + (f === 1 ? 0.3 : 0) * Math.sin(s * 1.7);
    const a = Math.abs(q) / wdt;
    if (a > 1) return 0;
    const heat = (1 - a) * (1 - t * 0.85);
    if (heat > 0.62) return T('snow', 6, d);
    if (heat > 0.42) return T('sky', 6, d);
    if (heat > 0.24) return T('sky', 4, d);
    return T('sky', 2, d);
  });
});

/** The trail: a hot puff that cools into grey vapour (4 frames by age; no ink). */
reg(SWAN_JET_ART.trail, same(4, { w: 14, h: 14, ox: 7, oy: 7 }), (p, f) => {
  const d = p.d;
  const r = 2.6 + f * 1.3;
  p.disc(7, 7, r, r * 0.85, (X, Y, u, v) => {
    const n = fbm(X, Y, d, 1.5, 900 + f);
    const edge = u * u + v * v;
    if (f >= 2 && edge > 0.55 + n * 0.45) return 0;
    const l = shadeBall(u, v) * 0.6 + 0.4;
    if (f === 0) return l > 0.75 ? T('snow', 6, d) : T('sky', 5, d);
    if (f === 1) return l > 0.7 ? T('snow', 5, d) : T('snow', 3, d);
    if (f === 2) return l > 0.6 ? T('slate', 5, d) : T('slate', 4, d);
    return l > 0.6 ? T('slate', 4, d) : T('slate', 3, d);
  });
});

/** Every id of this file (tests). */
export const TOWER_ENTITY_ART: readonly string[] = [TIDE_ART.edge, TIDE_ART.back, TIDE_ART.mass, TIDE_ART.arm, BELL_ART.small, BELL_ART.big, BELL_ART.toll, SWAN_JET_ART.unit, SWAN_JET_ART.flame, SWAN_JET_ART.trail];

// Keep the helpers referenced (some only at a density).
void F;
void dim;
void sstep;
void mx;
