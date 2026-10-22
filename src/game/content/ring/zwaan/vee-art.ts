/**
 * The livestock trailer's art (`boss/ring-zwaan/vee/`; docs/design/ring.md §R.3; docs/ART_GUIDE.md
 * "UHD art"): ONE density-generic drawer per strip (`PAL` at 1×, `PAL_HD` at 2× / 4×), every frame
 * cropped to its 1× box, outline A. Our own livery and lettering (`LEVEND VEE`, `ZWAAN`, the swan);
 * the farmhand is a fictional character (overalls, a cap), bloodless: hit, he ducks dazed.
 *
 * | id | frames | what |
 * |---|---|---|
 * | `body-<0\|1\|2>` | 1 | the running gear and the aluminium box: slatted decks with cows (below) and pigs (above) seen through the slats, the band, the front panel (by damage) |
 * | `gate` | 4 | the rear gate: shut, 40°, 80°, down on the road (a ramp with cleats) |
 * | `gate-fall` | 4 (deferred) | the torn-off gate tumbling (centre anchor) |
 * | `hatch` | 2 | the roof hatch's coaming and its open lid (drawn over the farmhand): whole, bent |
 * | `farmhand-<stand\|lift\|lift-churn\|throw\|duck>` | 2 / 3 / 3 / 2 / 2 | the farmhand from the hip up (anchor: the hip), facing back (left) |
 * | `bale` / `churn` | 4 / 4 | a hay bale / a milk churn tumbling (centre anchor) |
 * | `lamps` | 2 | the rear lamp lit: brake, indicator |
 * (`cow-*`, `pig-*`: vee-animals-art.ts.)
 */
import type { PixelBuffer } from '../../../../engine/pixel';
import type { Frame } from '../../../../engine/render';
import type { TexSample } from '../../../art/hd/canvas';
import { withPieces, type Piece } from '../../../art/human-fx';
import { renderHuman, type Density, type HumanStyle, type Pose } from '../../../art/humanoid';
import { defStrip, frac, hash2, Pen, turnPt, type Turn } from '../boss/art-kit';
import { bot, finishA, mat, top, type Dn } from '../../stag/kit.art';
import { drawChassis, lampsFrame, swanHit, w5Hit, w5Width, zwMats } from './autos-kit';
import { GATE_ANGLES, VEE, VEE_SPR } from './vee-geo';
import './vee-animals-art';

type Pt = readonly [number, number];
const BX = VEE.box;

/** Where the animals stand in the box (x ranges) for the glimpses through the slats. */
const COWS: ReadonlyArray<readonly [number, number]> = [
  [10, 44],
  [50, 86],
  [92, 126],
  [130, 158],
];
const PIGS: ReadonlyArray<readonly [number, number]> = [
  [8, 26],
  [30, 50],
  [56, 76],
  [82, 100],
  [106, 124],
  [130, 150],
];

/** The body: the running gear and the slatted aluminium box with its livery. */
export function bodyFrame(s: number, d: Dn): Frame {
  const p = new Pen(-6, -68, VEE.length + 18, 69, d);
  const c = p.c;
  const m = zwMats(c);
  drawChassis(p, m, { length: VEE.length, deck: VEE.deck, wheels: VEE.wheels });
  const part = c.newPart();
  const dark = mat(c, 'black', { spec: 0, amb: 0.1, lo1: 0, hi1: 1, lo: 0, hi: 2 });
  const cowW = mat(c, 'snow', { spec: 0.2, lo1: 1, hi1: 2, lo: 2, hi: 4, amb: 0.2 });
  const cowB = mat(c, 'black', { spec: 0.2, lo1: 0, hi1: 1, lo: 1, hi: 2 });
  const pig = mat(c, 'pink', { spec: 0.3, lo1: 1, hi1: 2, lo: 3, hi: 5, amb: 0.2 });
  // The slots: rows on each deck between the posts.
  const slotRows = [-58.6, -54.4, -50.2, -37.4, -33.2, -29];
  const inSlot = (x: number, y: number): boolean => {
    if (x < BX.x0 + 3 || x > BX.x1 - 3) return false;
    const u = frac((x - BX.x0 - 3) / 16);
    if (u > 0.88) return false;
    for (const ry of slotRows) if (y >= ry && y < ry + 2) return true;
    return false;
  };
  // A glimpse inside a slot: an animal's flank or the dark.
  const glimpse = (t: TexSample, x: number, y: number): void => {
    t.mat = dark;
    if (y > BX.mid) {
      const cw = COWS.find(([a, b]) => x > a && x < b);
      if (cw) t.mat = hash2(Math.floor(x / 4), 7) < 0.45 ? cowB : cowW;
    } else {
      const pg = PIGS.find(([a, b]) => x > a && x < b);
      if (pg && y > -56) t.mat = pig;
    }
  };
  if (d === 1) {
    p.box(BX.x0, BX.top, BX.x1 - BX.x0, BX.bottom - BX.top, {
      mat: m.alu,
      z: 1,
      r: 0.8,
      bevel: 0.8,
      part,
      tex: (t) => {
        const x = t.x + p.x0;
        const y = t.y + p.y0;
        if (inSlot(x, y)) {
          glimpse(t, x, y);
          return;
        }
        // Ribs of the panels (a light edge, a dark edge), the deck line, wear.
        const u = frac((x - BX.x0 - 3) / 16);
        if (u > 0.88 && u < 0.94) t.tone += 0.25;
        else if (u >= 0.94) t.tone -= 0.2;
        if (Math.abs(y - BX.mid) < 0.6) t.tone -= 0.35;
        if (y > BX.bottom - 3 && hash2(Math.floor(x * 1.5), 4) < 0.5) t.tone -= 0.1;
      },
    });
  } else {
    // 2× / 4× (fixer, 2026-10-22: the box read flat next to the container and the tanker): a lit
    // height field — every 16 px sheet bulges between proud posts, the slots are recessed, the
    // edges roll over, the deck line is pressed in — then the wear: a sun-bleached top, road grime
    // rising ragged from the bottom, streaks under the slot rows, scratches, rivets on the posts.
    p.field(
      BX.x0,
      BX.top,
      BX.x1 - BX.x0,
      BX.bottom - BX.top,
      (x, y) => {
        const ex = Math.min(x - BX.x0, BX.x1 - x);
        const ey = Math.min(y - BX.top, BX.bottom - y);
        if (ex < 0 || ey < 0) return NaN;
        if (ex < 0.8 && ey < 0.8 && Math.hypot(0.8 - ex, 0.8 - ey) > 0.8) return NaN;
        const u = frac((x - BX.x0 - 3) / 16);
        let h = u > 0.88 ? 1.1 : 0.6 * Math.pow(Math.sin((Math.PI * u) / 0.88), 0.6);
        if (inSlot(x, y)) h -= 0.9;
        if (Math.abs(y - BX.mid) < 0.8) h -= 0.5;
        const edge = Math.min(ex, ey);
        if (edge < 1.2) h -= (1.2 - edge) * 0.5;
        // Under the band and its pin stripe: flat (the proud posts must not poke through them).
        if (y > BX.bottom - 9.6) h = Math.min(h, 0.4);
        return h;
      },
      { mat: m.alu, z: 1, part },
      (t, x, y) => {
        if (inSlot(x, y)) {
          glimpse(t, x, y);
          return;
        }
        const u = frac((x - BX.x0 - 3) / 16);
        if (u > 0.88 && u < 0.94) t.tone += 0.12;
        else if (u >= 0.94) t.tone -= 0.12;
        // Rivets down the posts.
        if (u > 0.9 && u < 0.93 && frac((y - BX.top) / 4) < 0.2) t.tone += 0.3;
        // The top bleached by the sun.
        if (y < BX.top + 3) t.tone += 0.14 * (1 - (y - BX.top) / 3);
        // Road grime: rising ragged from the bottom.
        const gy = BX.bottom - y;
        const g = 8 + hash2(Math.floor(x * 1.3), 11) * 6;
        if (gy < g) t.tone -= 0.3 * Math.pow(1 - gy / g, 1.5);
        // Streaks under the lowest slot row of each deck.
        const col = Math.floor(x * 1.5);
        if (hash2(col, 23) < 0.2) {
          const run = 3 + hash2(col, 29) * 7;
          for (const ry of [-48.2, -27]) if (y > ry && y < ry + run) t.tone -= 0.2 * (1 - (y - ry) / run);
        }
        // Scratches and scuffs.
        if (hash2(Math.floor(x * 2), Math.floor(y * 2) + 400) < 0.012) t.tone += 0.28;
        if (hash2(Math.floor(x * 0.7), Math.floor(y * 0.7) + 900) < 0.04) t.tone -= 0.1;
      },
    );
  }
  // The rust-red band with LEVEND VEE (our block face), the orange pin stripe.
  p.box(BX.x0 + 0.5, BX.bottom - 8, BX.x1 - BX.x0 - 1, 7.6, {
    mat: m.rust,
    z: 1.6,
    r: 0.4,
    bevel: 0.5,
    // 2× / 4×: a lit top lip, a shadowed bottom lip, grime and chips (1× unchanged).
    tex:
      d === 1
        ? undefined
        : (t) => {
            const x = t.x + p.x0;
            const y = t.y + p.y0;
            const v = y - (BX.bottom - 8);
            if (v < 0.9) t.tone += 0.22;
            else if (v > 6.6) t.tone -= 0.3;
            else t.tone += 0.08 - v * 0.03;
            if (v > 4 && hash2(Math.floor(x * 0.5), 31) < 0.4) t.tone -= (0.14 * (v - 4)) / 3.6;
            if (hash2(Math.floor(x), Math.floor(y) + 77) < 0.012) t.tone += 0.25;
          },
  });
  p.box(BX.x0 + 0.5, BX.bottom - 9.4, BX.x1 - BX.x0 - 1, 1.2, { mat: m.orange, z: 1.62, r: 0.2 });
  const ink = top('snow', d, d === 1 ? 0 : 1);
  const word = 'LEVEND VEE';
  const wx = 60 - w5Width(word, 1) / 2;
  p.paint(BX.x0, BX.bottom - 8, BX.x1 - BX.x0, 8, (x, y) => (w5Hit(word, wx, BX.bottom - 6.5, 1, x, y) ? ink : 0), 3);
  // The front panel: ZWAAN and the swan on rust-red.
  p.box(112, BX.top + 2, 48, 15, { mat: m.rust, z: 1.7, r: 0.5, bevel: 0.6 });
  p.paint(112, BX.top + 2, 48, 15, (x, y) => {
    if (w5Hit('ZWAAN', 116, BX.top + 7, 1, x, y)) return ink;
    const sw = swanHit(147, BX.top + 15.4, 0.95, x, y);
    return sw === 2 ? top('orange', d, 1) : sw === 1 ? ink : 0;
  }, 3);
  // The roof: a rolled edge, the hatch's frame (the hatch itself is a sprite), vents.
  p.box(BX.x0, BX.top - 1.6, BX.x1 - BX.x0, 2, { mat: m.white, z: 2, r: 0.6 });
  for (const x of [30, 70, 146]) p.box(x, BX.top - 3, 8, 1.6, { mat: m.steel, z: 2.1, r: 0.6 });
  // The front: a rounded nose cap (white) over the drawbar.
  p.box(BX.x1 - 2, BX.top + 1, 3, BX.bottom - BX.top - 2, { mat: m.white, z: 2.2, r: 1.2, bevel: 1 });
  if (s >= 1) {
    for (let i = 0; i < (s >= 2 ? 26 : 10); i++) {
      const hx = BX.x0 + 6 + hash2(s, i) * (BX.x1 - BX.x0 - 12);
      const hy = BX.top + 4 + hash2(i, s + 5) * (BX.bottom - BX.top - 14);
      p.paint(hx - 1, hy - 1, 2, 2, (x, y) => (Math.hypot(x - hx, y - hy) < (d === 1 ? 0.5 : 0.6) ? bot('black', d, 0) : 0), 4);
    }
  }
  if (s >= 2) {
    p.shade(BX.x0, BX.top, BX.x1 - BX.x0, BX.bottom - BX.top, (x, y) => {
      const a = Math.hypot((x - 40) / 22, (y - BX.top - 12) / 10);
      return a < 1 ? -0.6 * (1 - a * a) : 0;
    }, part);
  }
  return p.frame(finishA(c, 0.3));
}

/** The rear gate at `a`° from upright (115 = on the road, a ramp). */
export function gateFrame(a: number, d: Dn): Frame {
  const p = new Pen(-42, -64, 50, 66, d);
  const c = p.c;
  const m = zwMats(c);
  const [hx, hy] = VEE.hinge;
  const r = (a * Math.PI) / 180;
  const L = VEE.gateLen;
  const ex = hx - Math.sin(r) * L;
  const ey = hy - Math.cos(r) * L;
  const nx = Math.cos(r);
  const ny = -Math.sin(r);
  const w = 1.8;
  const poly: Pt[] = [
    [hx + nx * w, hy + ny * w],
    [ex + nx * w, ey + ny * w],
    [ex - nx * w, ey - ny * w],
    [hx - nx * w, hy - ny * w],
  ];
  p.body(poly, 0.8, { mat: m.alu, z: 1.4 }, undefined, undefined, (t, x, y) => {
    const along = ((x - hx) * -Math.sin(r) + (y - hy) * -Math.cos(r)) / L;
    // The cleats (the animals' foothold).
    if (frac(along * 10) < 0.16) t.tone -= 0.35;
  });
  // The side rails of the ramp (when it is down), the latch.
  if (a > 60) p.capsule(hx, hy - 3, ex + 4, ey - 2, 0.5, 0.5, { mat: m.chrome, z: 1.6 });
  p.ellipsoid(hx, hy, 1.7, 1.7, { mat: m.steel, z: 1.8 });
  p.ellipsoid(ex, ey, 1.2, 1.2, { mat: mat(c, 'gold', { spec: 0.6, lo1: 1, hi1: 3, lo: 3, hi: 5 }), z: 1.9 });
  return p.frame(finishA(c, 0.3));
}

/** The torn-off gate tumbling (centre anchor), turned `f` × 45°. */
export function gateFallFrame(f: number, d: Dn): Frame {
  const p = new Pen(-22, -22, 44, 44, d);
  const c = p.c;
  const m = zwMats(c);
  const T: Turn = { rot: f * 45, px: 0, py: 0 };
  const pts: Pt[] = [turnPt(T, -2, -20), turnPt(T, 2, -20), turnPt(T, 2, 20), turnPt(T, -2, 20)];
  p.body(pts, 0.8, { mat: m.alu, z: 1 }, undefined, undefined, (t, x, y) => {
    const [, v] = turnPt({ rot: -f * 45, px: 0, py: 0 }, x, y);
    if (frac(v / 4) < 0.16) t.tone -= 0.35;
  });
  return p.frame(finishA(c, 0.3));
}

/** The roof hatch (anchor: the trailer's rear on the road): the coaming and the open lid; 1 = bent. */
export function hatchFrame(f: number, d: Dn): Frame {
  const p = new Pen(VEE.hatch[0] - 3, BX.top - 16, VEE.hatch[1] - VEE.hatch[0] + 8, 18, d);
  const c = p.c;
  const m = zwMats(c);
  const [x0, x1] = VEE.hatch;
  p.box(x0, BX.top - 3.4, x1 - x0, 3.6, { mat: m.steel, z: 3, r: 0.6, bevel: 0.6 });
  // The lid hinged at the front edge, standing up (bent: hanging).
  const lid: Pt[] = f === 0 ? [[x1 - 0.6, BX.top - 3], [x1 + 2.4, BX.top - 3], [x1 + 3.4, BX.top - 14], [x1 + 0.4, BX.top - 14]] : [[x1 - 0.6, BX.top - 3], [x1 + 2.2, BX.top - 2.6], [x1 + 6.4, BX.top - 10], [x1 + 3.8, BX.top - 11]];
  p.body(lid, 0.6, { mat: m.alu, z: 2.6 });
  return p.frame(finishA(c, 0.3));
}

/** The farmhand: overalls over a checked shirt, a cap, rubber-booted (not seen: from the hip up). */
export const FARMHAND: HumanStyle = {
  skin: 'skinA',
  hair: 'hairC',
  hairStyle: 'short',
  headgear: 'cap',
  gear: 'green',
  top: 'navy',
  topType: 'vest',
  shirt: 'red',
  pants: 'navy',
  boots: 'green',
  gloves: null,
  belt: 'navy',
  build: 'heavy',
  face: ['stubble', 'bushy-brows'],
};

/** A hay bale (a straw block with two twine bands), turned `rot`°, centre anchor. */
export function baleBuf(rot: number, d: Dn): PixelBuffer {
  return baleFrame(rot, d).buf;
}

export function baleFrame(rot: number, d: Dn): Frame {
  const p = new Pen(-7, -7, 14, 14, d);
  const c = p.c;
  const straw = mat(c, 'sand', { spec: 0.2, lo1: 1, hi1: 3, lo: 2, hi: 5 });
  const twine = mat(c, 'brown', { spec: 0.1, lo1: 0, hi1: 1, lo: 1, hi: 3 });
  const T: Turn = { rot, px: 0, py: 0 };
  const U: Turn = { rot: -rot, px: 0, py: 0 };
  const pts: Pt[] = [turnPt(T, -5.4, -3.4), turnPt(T, 5.4, -3.4), turnPt(T, 5.4, 3.4), turnPt(T, -5.4, 3.4)];
  p.body(pts, 1, { mat: straw, z: 1 }, undefined, undefined, (t, x, y) => {
    const [u, v] = turnPt(U, x, y);
    if (Math.abs(u + 2.4) < 0.45 || Math.abs(u - 2.4) < 0.45) t.mat = twine;
    else t.tone += (hash2(Math.floor(u * 2.5), Math.floor(v * 0.8)) - 0.5) * 0.5;
  });
  // Loose stalks sticking out.
  const gold = mat(c, 'gold', { spec: 0.2, lo1: 2, hi1: 3, lo: 4, hi: 6 });
  for (const [u, v, du] of [[-5.6, -2, -1.6], [5.6, 1.4, 1.6], [-3, 3.6, -0.6]] as const) {
    const a = turnPt(T, u, v);
    const b = turnPt(T, u + du, v + 0.6);
    p.capsule(a[0], a[1], b[0], b[1], 0.3, 0.25, { mat: gold, z: 1.1 });
  }
  return p.frame(finishA(c, 0.2));
}

/** A milk churn (steel, a shoulder, a lid with handles), turned `rot`°, centre anchor. */
export function churnFrame(rot: number, d: Dn): Frame {
  const p = new Pen(-7, -7, 14, 14, d);
  const c = p.c;
  const steel = mat(c, 'steel', { spec: 1.1, shine: 46, lo1: 1, hi1: 4, lo: 2, hi: 6 });
  const T: Turn = { rot, px: 0, py: 0 };
  const prof: Pt[] = [[-3.4, 5], [3.4, 5], [3.6, -0.4], [2, -2.6], [1.8, -4.6], [-1.8, -4.6], [-2, -2.6], [-3.6, -0.4]];
  p.body(prof.map(([x, y]) => turnPt(T, x, y)), 1.2, { mat: steel, z: 1 });
  const [lx, ly] = turnPt(T, 0, -5);
  p.ellipsoid(lx, ly, 2.4, 1.1, { mat: steel, z: 1.6, tone: 0.2 });
  for (const s of [-1, 1]) {
    const a = turnPt(T, s * 2.2, -3.6);
    const b = turnPt(T, s * 3.6, -3);
    p.capsule(a[0], a[1], b[0], b[1], 0.45, 0.45, { mat: steel, z: 1.7 });
  }
  return p.frame(finishA(c, 0.2));
}

/** A held piece at the figure's hands (the middle between them). */
function atHands(f: Frame, buf: PixelBuffer, d: Dn, dy = 0): Piece | null {
  const h = (f as Frame & { pts?: Record<string, readonly [number, number]> }).pts?.hand;
  if (!h) return null;
  const pc: Piece = { buf, x: Math.round(h[0] - 1) - 7, y: Math.round(h[1] + dy) - 7 };
  if (d !== 1) pc.density = d;
  return pc;
}

const fig = (pose: Pose, d: Dn): Frame => renderHuman(FARMHAND, { weapon: 'none', ...pose }, 'upper', d as Density);

/** He stands in the hatch, a hand on the coaming (breathing). */
export function farmhandStand(d: Dn): Frame[] {
  return [0, 1].map((k) => fig({ lean: 4, hunch: k, armN: { sh: 20, el: 40, hand: 'open' }, armF: { sh: -10, el: 30, hand: 'open' }, head: { dy: k }, expr: 'normal' }, d));
}

/** The tell: he hoists a bale (frames 0–2; the churn is drawn by the part over the same frames). */
export function farmhandLift(d: Dn, churn = false): Frame[] {
  const keys: Array<[Pose, number]> = [
    [{ lean: 24, armN: { to: [6, 6], hand: 'grip' }, armF: { to: [5, 6], hand: 'grip' }, expr: 'normal' }, 2],
    [{ lean: 6, armN: { to: [4, -4], hand: 'grip' }, armF: { to: [3, -4], hand: 'grip' }, expr: 'shout' }, 0],
    [{ lean: -12, armN: { to: [1, -14], hand: 'grip' }, armF: { to: [0, -14], hand: 'grip' }, head: { tilt: -6 }, expr: 'shout' }, -4],
  ];
  return keys.map(([pose, dy]) => {
    const f = fig(pose, d);
    const pc = atHands(f, churn ? churnFrame(0, d).buf : baleBuf(0, d), d, dy);
    return pc ? withPieces(f, [pc]) : f;
  });
}

/** The throw: arms swung over, the bale gone; the follow-through. */
export function farmhandThrow(d: Dn): Frame[] {
  return [
    fig({ lean: 26, armN: { sh: 120, el: 10, hand: 'open' }, armF: { sh: 110, el: 10, hand: 'open' }, expr: 'shout' }, d),
    fig({ lean: 14, armN: { sh: 70, el: 20, hand: 'open' }, armF: { sh: 60, el: 20, hand: 'open' }, expr: 'normal' }, d),
  ];
}

/** Hit through the hatch: he ducks, dazed (bloodless; the stars are an fx), a slow sway. */
export function farmhandDuck(d: Dn): Frame[] {
  return [0, 1].map((k) => fig({ lean: 30, hunch: 2, armN: { sh: -20, el: 70, hand: 'open' }, armF: { sh: -30, el: 60, hand: 'open' }, head: { tilt: k ? 10 : -6, dy: 3 }, expr: 'dazed', dy: 5 }, d));
}

for (const s of [0, 1, 2]) defStrip(VEE_SPR.body(s), (d) => [bodyFrame(s, d)]);
defStrip(VEE_SPR.gate, (d) => GATE_ANGLES.map((a) => gateFrame(a, d)), { ticksPerFrame: 6, loop: false });
defStrip(VEE_SPR.gateFall, (d) => [0, 1, 2, 3].map((f) => gateFallFrame(f, d)), { ticksPerFrame: 4, defer: true });
defStrip(VEE_SPR.hatch, (d) => [hatchFrame(0, d), hatchFrame(1, d)]);
defStrip(VEE_SPR.farmhand('stand'), farmhandStand, { ticksPerFrame: 30 });
defStrip(VEE_SPR.farmhand('lift'), (d) => farmhandLift(d), { ticksPerFrame: 8, loop: false });
defStrip(VEE_SPR.farmhand('lift-churn'), (d) => farmhandLift(d, true), { ticksPerFrame: 8, loop: false });
defStrip(VEE_SPR.farmhand('throw'), farmhandThrow, { ticksPerFrame: 6, loop: false });
defStrip(VEE_SPR.farmhand('duck'), farmhandDuck, { ticksPerFrame: 24, defer: true });
defStrip(VEE_SPR.bale, (d) => [0, 30, 60, 90].map((r) => baleFrame(r, d)), { ticksPerFrame: 3 });
defStrip(VEE_SPR.churn, (d) => [0, 90, 180, 270].map((r) => churnFrame(r, d)), { ticksPerFrame: 3 });
defStrip(VEE_SPR.lamps, (d) => [lampsFrame(0, d), lampsFrame(1, d)]);
