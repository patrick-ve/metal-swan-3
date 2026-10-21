/**
 * Mission oldenzaal — the ruin's art (revision 2, spec §10.3, R2-7: Oldenzaal abandoned and worn
 * down after the outbreak; owner RUIN). Manifest id 'oldenzaal/ruin/art'; prefixes
 * `OZ_SPRITES.ruin`. ONE density-generic drawer per id (1× in the 64-colour PAL, 2× / 4× in
 * PAL_HD + PAL_HD_OZ + PAL_HD_OZ_R2; every dense frame has its 1× frame's logical size and
 * anchor). Static decor: outline C; the flying plank (it moves): outline A; the openings sit flush
 * in a front or the pavers (painted, their own dark frame).
 *
 * The openings (`./index.ts` entities):
 * - `prop/oz-boarded/window` — a boarded shop window: frame 2k intact (planks nailed across), 2k+1
 *   broken (the dark room, splinters, a plank hanging); k = the width class `OZ_BOARD_WIDTHS[k]`
 *   (the shop windows' widths, art-street.ts `shopWindowX`). Anchor: the window's bottom middle
 *   on the street line (oy 27: the window's frame spans G − 27 … G − 2).
 * - `prop/oz-boarded/door` — the boarded shop door: 0 intact, 1 broken. Same anchor rule.
 * - `prop/oz-boarded/plank` — a plank tumbling (4 turns; the burst's debris, outline A).
 * - `prop/oz-manhole/cover` — a drain cover in the pavers: 0 shut, 1 lifted (the tell), 2 open
 *   (the cover slid aside, the dark shaft). Anchor: the shaft's middle, 1 px below the street line.
 *
 * The worn-down town (`decor/oz-ruin/…`, section decor):
 * - `car` — abandoned cars (anchor bottom-left): 0 a hatchback, its door open, a flat front tyre;
 *   1 an estate, flat rear tyres, a smashed side window, a newspaper on the windscreen; 2 the
 *   BURNED-OUT car (soot and rust, no glass, no tyres: it sits on its rims). No badges, no plates.
 *   Their roofs are one-way platforms (`OZ_CAR_ROOF`).
 * - `barrier` — a steel crowd barrier (front decor): 0 standing, 1 knocked flat, 2 with police
 *   tape. `tape` — police tape (plain red-white, no lettering) between two posts, fluttering (2
 *   frames, animate). `sign` — an emergency board on a stand (`GEVAAR`, `BLIJF BINNEN`), its
 *   amber lamp blinking (2 frames, animate).
 * - `banner` — a TORN, ROTTEN swastika banner hung by the dead (R2-2, the user's decision; ONLY in
 *   this mission, a few, never clean or prominent): faded, mould, holes, the symbol half torn
 *   away. Anchor top-left at its iron rod.
 * - `bike` (toppled bikes), `bin` (a toppled bin, rubbish spilt), `rubbish` (bags and boxes),
 *   `paper` (blown newspapers), `weeds`, `glass` (shards on the pavers), `crow` (perched).
 */
import type { Color } from '../../../../engine/color';
import type { Frame } from '../../../../engine/render';
import { defineSprite } from '../../../../engine/sprites';
import { dq, h2, ladder, outlineA, outlineC, Pen, pick, T, tinyText, tinyWidth, tones, type Dn, type FrameGeom } from '../../missions/oldenzaal/art-kit';
import { SHOP_DOOR_H, SHOP_DOOR_UP, SHOP_DOOR_W, SHOP_WIN_H, SHOP_WIN_UP } from '../../missions/oldenzaal/art-street';
import { boards, fnoise, hole, plank, r2tones, R2, room, shards, weed, woodLadder } from './paint';

/** Every sprite id RUIN registers (tests). */
export const OZ_RUIN_SPRITES: string[] = [];

/** Register sprite `id`: frames of the given geometry, each drawn by `draw(pen, i)` at d 1, 2 and 4. */
function reg(id: string, geoms: readonly FrameGeom[], draw: (p: Pen, i: number) => void, o: { defer?: boolean; ticksPerFrame?: number } = {}): void {
  const frames = (d: Dn): Frame[] =>
    geoms.map((g, i) => {
      const p = new Pen(g.w, g.h, d);
      draw(p, i);
      return p.frame(g.ox, g.oy);
    });
  defineSprite(id, () => frames(1), { hd: (d) => frames(d), defer: o.defer, ticksPerFrame: o.ticksPerFrame ?? 8 });
  OZ_RUIN_SPRITES.push(id);
}

const COLD = T('night', 3, 2);
/** Graded tones (the cold dusk over every material, as the street). */
function gt(n: Parameters<typeof tones>[0], d: Dn, t = 0.2): readonly Color[] {
  return tones(n, d, COLD, t);
}

// ============================================================================================
// The openings (entities)
// ============================================================================================

/** The shop windows' widths (art-street.ts `SHOPS`: w − 21): the window frames' classes. */
export const OZ_BOARD_WIDTHS = [23, 27, 31, 35, 39, 43] as const;

/** The frame of `prop/oz-boarded/window` for a window of width w (intact; +1 = broken). */
export function boardWindowFrame(w: number, broken = false): number {
  let k = 0;
  for (let i = 0; i < OZ_BOARD_WIDTHS.length; i++) if (Math.abs(OZ_BOARD_WIDTHS[i] - w) < Math.abs(OZ_BOARD_WIDTHS[k] - w)) k = i;
  return k * 2 + (broken ? 1 : 0);
}

/** The anchor of an opening's frame over the street line: its top is this far above G. */
export const BOARD_WIN_OY = SHOP_WIN_UP + 1;
export const BOARD_DOOR_OY = SHOP_DOOR_UP + 1;

/** The dark shop frame round an opening (1 px), lit on its top. */
function shopFrame(p: Pen, w: number, h: number): void {
  const d = p.d;
  const f = gt('black', d, 0.25);
  p.rect(0, 0, w, h, pick(f, 1));
  if (d >= 2) {
    p.rect(0, 0, w, 1 / d, pick(f, 3));
    p.rect(0, 0, 1 / d, h, pick(f, 2.4));
  }
}

reg(
  'prop/oz-boarded/window',
  OZ_BOARD_WIDTHS.flatMap((w) => [0, 1].map(() => ({ w: w + 2, h: SHOP_WIN_H + 2, ox: Math.floor((w + 2) / 2), oy: BOARD_WIN_OY }))),
  (p, i) => {
    const w = OZ_BOARD_WIDTHS[i >> 1];
    shopFrame(p, w + 2, SHOP_WIN_H + 2);
    const seed = 300 + (i >> 1) * 17;
    if (i & 1) hole(p, 1, 1, w, SHOP_WIN_H, seed, { glass: true });
    else boards(p, 1, 1, w, SHOP_WIN_H, seed, { text: (i >> 1) % 2 ? 'GESLOTEN' : undefined });
  },
);

reg(
  'prop/oz-boarded/door',
  [0, 1].map(() => ({ w: SHOP_DOOR_W + 2, h: SHOP_DOOR_H + 2, ox: Math.floor((SHOP_DOOR_W + 2) / 2), oy: BOARD_DOOR_OY })),
  (p, i) => {
    const d = p.d;
    shopFrame(p, SHOP_DOOR_W + 2, SHOP_DOOR_H + 2);
    if (i === 1) {
      hole(p, 1, 1, SHOP_DOOR_W, SHOP_DOOR_H, 410);
      return;
    }
    // The door leaf (dark green paint flaking off grey wood), boarded with a brace.
    const leaf = gt('green', d, 0.5);
    p.fill(1, 1, SHOP_DOOR_W, SHOP_DOOR_H, (X, Y) => (d >= 2 && h2(X >> 1, Y >> 2, 7) > 0.8 ? pick(woodLadder(d), 3) : pick(leaf, dq(1.2 - ((Y + 0.5) / d) / SHOP_DOOR_H * 0.6, X, Y, 0.6))));
    for (let k = 0; k < 3; k++) plank(p, 0.5, 5 + k * 7.5 + (k === 1 ? 0.6 : 0), SHOP_DOOR_W + 1.5, 5.6 + k * 7.5, 3.4, 420 + k);
    plank(p, 1.5, SHOP_DOOR_H - 1, SHOP_DOOR_W + 0.5, 2, 3, 430);
  },
);

/** The plank that flies off at a burst (outline A: it moves). 4 turns of 45°. */
reg(
  'prop/oz-boarded/plank',
  [0, 1, 2, 3].map(() => ({ w: 16, h: 16, ox: 8, oy: 8 })),
  (p, i) => {
    const a = (i * Math.PI) / 4;
    const dx = Math.cos(a) * 5.5;
    const dy = Math.sin(a) * 5.5;
    plank(p, 8 - dx, 8 - dy, 8 + dx, 8 + dy, 3, 500 + i);
    outlineA(p);
  },
  { ticksPerFrame: 4 },
);

/** The drain cover's frame: 30 × 9, the shaft's middle at (9, 4) (anchor 9, 3: 1 px under G). */
export const MANHOLE_W = 30;
const MH_CX = 9;
const MH_CY = 4;
const MH_RX = 7.5;
const MH_RY = 2.6;

reg(
  'prop/oz-manhole/cover',
  [0, 1, 2].map(() => ({ w: MANHOLE_W, h: 9, ox: MH_CX, oy: MH_CY - 1 })),
  (p, i) => {
    const d = p.d;
    const iron = gt('black', d, 0.15);
    const rust = r2tones('rust', d);
    // The cast frame in the pavers (a dark ring, its near lip lit).
    p.disc(MH_CX, MH_CY, MH_RX + 1, MH_RY + 0.8, (_X, _Y, _u, v) => pick(iron, v > 0.4 ? 2.4 : 1));
    const cover = (cx: number, cy: number, lift: number): void => {
      if (lift > 0) p.disc(cx, cy + 0.6, MH_RX, MH_RY, T('ink', 0, d));
      p.disc(cx, cy - lift, MH_RX - 0.4, MH_RY - 0.2, (X, Y, u, v) => {
        // Cast ribs in a grid, rust in the low parts, a lit far rim.
        const gx = Math.floor((u + 1) * 4);
        const gy = Math.floor((v + 1) * 2.2);
        let k = 2.2 + (v < -0.55 ? 1 : 0) - (v > 0.6 ? 0.8 : 0);
        if (d >= 2 && (gx + gy) % 2 === 0) k += 0.6;
        if (d >= 2 && fnoise((X + 0.5) / d, (Y + 0.5) / d, 2.5, 17) > 0.66) return pick(rust, 0.6 + h2(X, Y, 3) * 0.8);
        return pick(iron, dq(k, X, Y, 0.5));
      });
      if (lift > 0) p.rect(cx - MH_RX + 0.6, cy - lift + MH_RY - 0.4, (MH_RX - 0.6) * 2, Math.max(1 / d, lift * 0.5), pick(iron, 0.6));
    };
    if (i < 2) {
      cover(MH_CX, MH_CY, i === 1 ? 1.4 : 0);
      return;
    }
    // Open: the dark shaft, a lit rung on the near wall; the cover pushed aside onto the pavers.
    p.disc(MH_CX, MH_CY, MH_RX, MH_RY, (_X, _Y, _u, v) => (v < -0.3 ? T('ink', 1, d) : T('ink', 0, d)));
    if (d >= 2) {
      p.rect(MH_CX - 2.5, MH_CY + 0.3, 5, 1 / d, pick(rust, 3));
      p.rect(MH_CX - 2.5, MH_CY + 1.4, 5, 1 / d, pick(rust, 2));
    }
    cover(MH_CX + 13.5, MH_CY + 0.6, 0);
  },
);

// ============================================================================================
// Abandoned cars
// ============================================================================================

export const CAR_W = 64;
export const CAR_H = 28;
/** The car roofs as one-way platforms: x0, w over the frame's left, `up` above the street line. */
export const OZ_CAR_ROOF: ReadonlyArray<{ readonly x0: number; readonly w: number; readonly up: number }> = [
  { x0: 16, w: 26, up: 24 },
  { x0: 12, w: 32, up: 24 },
  { x0: 16, w: 26, up: 21 },
];

interface CarLook {
  readonly paint: Parameters<typeof tones>[0];
  readonly estate: boolean;
  readonly burnt: boolean;
  readonly flat: readonly [boolean, boolean];
  readonly doorOpen: boolean;
  readonly seed: number;
}

const CARS: readonly CarLook[] = [
  { paint: 'red', estate: false, burnt: false, flat: [false, true], doorOpen: true, seed: 3 },
  { paint: 'steel', estate: true, burnt: false, flat: [true, false], doorOpen: false, seed: 7 },
  { paint: 'steel', estate: false, burnt: true, flat: [true, true], doorOpen: false, seed: 11 },
];

/** The car body's outline (logical, the frame's coordinates; dy lowers it). */
function carBody(estate: boolean, dy: number): Array<[number, number]> {
  const y = (v: number): number => v + dy;
  const rear: Array<[number, number]> = estate
    ? [[2, y(21)], [2, y(13)], [3, y(5)], [6, y(3.6)]]
    : [[2, y(21)], [2, y(14)], [5, y(11.5)], [10, y(5)], [15, y(3.6)]];
  return [...rear, [41, y(3.6)], [50, y(11)], [59, y(12.5)], [62, y(15)], [62, y(21)]];
}

function drawCar(p: Pen, c: CarLook): void {
  const d = p.d;
  const dy = c.burnt ? 3 : 0;
  const body = carBody(c.estate, dy);
  const paint = c.burnt ? r2tones('soot', d) : gt(c.paint, d, 0.45);
  const rust = r2tones('rust', d);
  const dust = gt('stone', d, 0.3);
  const top = paint.length - 1;
  // Wheels first (behind the arches' lip); flat tyres sag; the burnt car sits on its rims.
  const wheels: Array<[number, boolean]> = [
    [13, c.flat[0]],
    [51, c.flat[1]],
  ];
  for (const [wx, flat] of wheels) {
    const r = 5.4;
    if (c.burnt) {
      p.disc(wx, 24.6, 3.6, 3.4, (_X, _Y, u, v) => (u * u + v * v > 0.55 ? pick(rust, 0.6 + (v < 0 ? 0.8 : 0)) : T('ink', 1, d)));
      continue;
    }
    const cy = flat ? 23 : 22.4;
    p.disc(wx, cy, r, flat ? r - 0.8 : r, (X, Y, u, v) => {
      const rr = u * u + v * v;
      if (rr < 0.3) return pick(gt('steel', d, 0.4), dq(2.6 - v, X, Y, 0.6) + (d >= 4 && Math.abs(u * 6 - Math.round(u * 6)) < 0.1 ? -1 : 0));
      return T('ink', v < -0.5 && d >= 2 ? 1 : 0, d);
    });
    if (flat) p.rect(wx - r - 0.6, 26.6, (r + 0.6) * 2, 1.4, T('ink', 0, d));
  }
  // The body: lit shoulder, a crease line, dark sill; dust on the upper surfaces, grime low down.
  p.poly(body, (X, Y) => {
    const x = (X + 0.5) / d;
    const y = (Y + 0.5) / d - dy;
    let k = (y < 12 ? 0.62 : y < 13 ? 0.82 : 0.5 - (y - 13) * 0.035) * top;
    if (y > 19.5) k = 0.18 * top;
    if (c.burnt) {
      // Charred black, ash grey where the paint blistered, rust blooms where it burnt off.
      const n = fnoise(x, y, 5, c.seed);
      k = 1.1 + (y < 12 ? 0.7 : 0) - (y > 17 ? 0.5 : 0) + (fnoise(x, y, 2.5, c.seed + 4) - 0.5) * 1.4;
      if (n > 0.64) return pick(rust, dq((n - 0.64) * 3.2 + (y < 12 ? 0.3 : 0), X, Y, 1));
      return pick(paint, dq(k, X, Y, 0.8));
    }
    if (d >= 4 && h2(X, Y, c.seed) > 0.92) k -= 0.6;
    // A dust film on the roof, the bonnet and the shoulder (clustered), road grime low down.
    const dst = (y < 12.5 ? 0.75 : 0.25) * fnoise(x, y, 4, c.seed + 1) + (y > 17 ? 0.35 * fnoise(x, y, 3, c.seed + 5) : 0);
    if (dq(dst * 2.2, X, Y, 0.9) >= 1) return pick(dust, y < 12.5 ? 3 + (y < 5 ? 0.6 : 0) : 1.4);
    return pick(paint, dq(k, X, Y, 0.6));
  });
  // The wheel arches (dark).
  for (const [wx] of wheels) p.disc(wx, 21.6 + dy * 0.3, 6.6, 6, (_X, _Y, _u, v) => (v < -0.05 ? T('ink', 1, d) : 0));
  // Re-draw the wheels' upper halves inside the arches (the burnt car: its bare rims).
  if (c.burnt) for (const [wx] of wheels) p.disc(wx, 24.6, 3.6, 3.4, (_X, _Y, u, v) => (v > 0 ? 0 : u * u + v * v > 0.55 ? pick(rust, 0.6 + (v < -0.5 ? 0.8 : 0)) : T('ink', 1, d)));
  if (!c.burnt) {
    for (const [wx, flat] of wheels) {
      p.disc(wx, flat ? 23 : 22.4, 5.4, flat ? 4.6 : 5.4, (X, Y, u, v) => (v > -0.05 ? 0 : u * u + v * v < 0.3 ? pick(gt('steel', d, 0.4), dq(2.6 - v, X, Y, 0.6)) : T('ink', 0, d)));
    }
  }
  // The windows (the greenhouse): dark glass with a dusty sheen; smashed / gone where needed.
  const g0 = c.estate ? 4 : 11;
  const winTop = 5.2 + dy;
  const winBot = 11.4 + dy;
  const glass = gt('night', d, 0.1);
  const panes: Array<[number, number]> = c.estate
    ? [
        [4, 15],
        [16.5, 28.5],
        [30, 41],
      ]
    : [
        [g0 + 1.5, 26],
        [27.5, 41],
      ];
  for (const [a, b] of panes) {
    const slopeL = a < 8 ? 3 : a < 14 ? 4 : 0;
    p.poly(
      [
        [a + slopeL, winTop],
        [b, winTop],
        [b, winBot],
        [a, winBot],
      ],
      (X, Y) => {
        const x = (X + 0.5) / d;
        const y = (Y + 0.5) / d - dy;
        if (c.burnt) return T('ink', y < 8 ? 0 : 1, d);
        const band = x + y * 0.8;
        if (band % 13 < 1.2) return pick(gt('steel', d, 0.5), 3);
        if (d >= 2 && dq(fnoise(x, y, 3, c.seed + 9) * 1.6 - (y - 5) * 0.08, X, Y, 0.9) >= 1) return pick(dust, 2.2);
        return pick(glass, dq(1.6 - (y - 5) / 7, X, Y, 0.7));
      },
    );
  }
  // The windscreen (front, sloped) and the rear hatch glass.
  p.poly(
    [
      [41.5, winTop - 0.6],
      [43, winTop - 0.6],
      [49, winBot + 0.2],
      [43, winBot + 0.2],
    ],
    (X, Y) => (c.burnt ? T('ink', 0, d) : pick(glass, dq(2.2 - ((Y + 0.5) / d - winTop) / 7, X, Y, 0.7))),
  );
  if (c.estate && !c.burnt) {
    // The smashed rear side window (the middle pane): the room's dark and a few shards.
    room(p, 16.5, winTop, 12, winBot - winTop, c.seed);
    shards(p, 16.5, winTop, 12, winBot - winTop, c.seed, 3);
    // A newspaper stuck on the windscreen.
    p.poly(
      [
        [43.2, winTop + 1.6],
        [46.4, winTop + 1],
        [48.2, winBot - 0.6],
        [44.6, winBot - 0.2],
      ],
      (X, Y) => pick(gt('cloth', d, 0.4), dq(2.6 + (d >= 4 && Y % 3 === 0 ? -0.8 : 0), X, Y, 0.6)),
    );
  }
  // The pillars, the door lines and the handles.
  const pil = c.burnt ? pick(paint, 0.4) : pick(paint, 0.25 * top);
  p.rect(26, winTop, 1.5, winBot - winTop, pil);
  p.rect(c.estate ? 15 : 26, winBot + 0.4, 1 / d + (d === 1 ? 0 : 0.25), 9, pick(paint, 0.15 * top));
  p.rect(41, winBot + 0.4, 1 / d + (d === 1 ? 0 : 0.25), 9, pick(paint, 0.15 * top));
  if (!c.burnt) {
    p.rect(36, winBot + 2, 2.4, 0.8, pick(gt('steel', d, 0.4), 4));
    // The lamps: a dead headlamp, a dusty rear lamp.
    p.rect(59.6, 13.2, 2.2, 2, pick(gt('steel', d, 0.4), 3.4));
    p.rect(2, 13.6, 1.6, 2.6, pick(gt('red', d, 0.5), 2));
    // The bumpers.
    p.rect(1.5, 18.6, 4, 2.4, pick(gt('black', d, 0.2), 2));
    p.rect(58.5, 18.6, 4, 2.4, pick(gt('black', d, 0.2), 2));
  }
  if (c.doorOpen) {
    // The driver's door swung out toward us: the dark opening, a seat back in it, and the door
    // seen nearly edge-on past the front pillar.
    room(p, 27.6, winTop, 13.2, 15.6, c.seed);
    const seat = gt('black', d, 0.3);
    p.rect(30, winTop + 3, 4, 10, pick(seat, 2));
    if (d >= 2) p.rect(30, winTop + 3, 1 / d, 10, pick(seat, 3.4));
    p.poly(
      [
        [41, winTop - 0.4],
        [46.6, winTop + 1.6],
        [47.4, 21.2],
        [41.4, 20.4],
      ],
      (X, Y) => {
        const y = (Y + 0.5) / d;
        if (y < winBot + 1.2 && y > winTop + 0.8) return T('ink', 1, d);
        return pick(paint, dq(0.35 * top + ((X + 0.5) / d - 41) * 0.12, X, Y, 0.6));
      },
    );
  }
  if (c.burnt) {
    // Charred seat springs in the empty windows, soot run up over the roof.
    if (d >= 2) for (let k = 0; k < 4; k++) p.line(18 + k * 5, winBot + dy * 0 - 0.4, 20 + k * 5, winTop + 3, pick(rust, 1.4));
  }
  outlineC(p);
}

reg(
  'decor/oz-ruin/car',
  CARS.map(() => ({ w: CAR_W, h: CAR_H, ox: 0, oy: CAR_H })),
  (p, i) => drawCar(p, CARS[i]),
);

// ============================================================================================
// Barriers, tape, the emergency sign
// ============================================================================================

reg(
  'decor/oz-ruin/barrier',
  [0, 1, 2].map(() => ({ w: 42, h: 15, ox: 21, oy: 15 })),
  (p, i) => {
    const d = p.d;
    const steel = gt('steel', d, 0.35);
    const rust = r2tones('rust', d);
    const bar = (x: number, y: number, w: number, h: number, k: number): void => {
      p.fill(x, y, w, h, (X, Y) => (d >= 2 && fnoise((X + 0.5) / d, (Y + 0.5) / d, 3, 41) > 0.66 ? pick(rust, 0.8 + h2(X, Y, 2) * 0.8) : pick(steel, dq(k + (d >= 2 && (Y + 0.5) / d - y < h / 2 ? 0.8 : 0), X, Y, 0.6))));
    };
    if (i === 1) {
      // Knocked flat: the frame lies on the pavers, a foot sticking up.
      bar(1, 11.5, 40, 1.4, 2.6);
      bar(1, 13, 40, 1.4, 1.8);
      for (let x = 4; x < 40; x += 4) bar(x, 12.6, 0.8, 1, 2);
      bar(39.5, 7, 1.4, 5, 2.2);
      bar(36, 6.6, 8 - 2, 1.2, 2);
      outlineC(p);
      return;
    }
    // Standing: the top rail, the bottom rail, the bars, two splayed feet.
    bar(1, 1, 40, 1.6, 3);
    bar(1, 10, 40, 1.4, 2.2);
    for (let x = 4; x < 40; x += 3.2) bar(x, 2.6, d === 1 ? 1 : 0.7, 7.4, 2.4);
    bar(1, 1, 1.6, 10.5, 2.6);
    bar(39.4, 1, 1.6, 10.5, 1.8);
    p.line(2, 11, -0.4 + 1, 14.4, pick(steel, 2), Math.max(1, d));
    p.line(2, 11, 5, 14.4, pick(steel, 1.6), Math.max(1, d));
    p.line(40, 11, 37, 14.4, pick(steel, 1.6), Math.max(1, d));
    p.line(40, 11, 41.4, 14.4, pick(steel, 2), Math.max(1, d));
    if (i === 2) {
      // A loose length of police tape knotted on the rail, hanging down.
      tapeStrip(p, [[3, 2.2], [14, 4.6], [22, 3.4]], 1.4);
      tapeStrip(p, [[22, 3.4], [24, 8], [23, 12.6]], 1.2);
    }
    outlineC(p);
  },
);

/** A strip of red-white police tape along a polyline (plain stripes, no lettering). */
function tapeStrip(p: Pen, pts: ReadonlyArray<readonly [number, number]>, th: number): void {
  const d = p.d;
  const red = gt('red', d, 0.35);
  const white = gt('cloth', d, 0.4);
  let run = 0;
  for (let k = 0; k + 1 < pts.length; k++) {
    const [x0, y0] = pts[k];
    const [x1, y1] = pts[k + 1];
    const L = Math.hypot(x1 - x0, y1 - y0);
    const n = Math.max(1, Math.ceil(L * d));
    for (let s = 0; s < n; s++) {
      const t = s / n;
      const x = x0 + (x1 - x0) * t;
      const y = y0 + (y1 - y0) * t;
      const stripe = Math.floor((run + t * L) / 2.2) % 2 === 0;
      const c = stripe ? pick(red, 3) : pick(white, 3);
      p.rect(x, y - th / 2, 1 / d, th, c);
      if (d >= 2) p.rect(x, y + th / 2 - 1 / d, 1 / d, 1 / d, stripe ? pick(red, 1.6) : pick(white, 1.8));
    }
    run += L;
  }
}

reg(
  'decor/oz-ruin/tape',
  [0, 1].map(() => ({ w: 72, h: 24, ox: 0, oy: 24 })),
  (p, i) => {
    const d = p.d;
    // Two striped traffic posts on rubber feet.
    for (const x of [3, 66]) {
      p.rect(x, 4, 3, 18, pick(gt('cloth', d, 0.4), 3));
      for (let y = 6; y < 20; y += 5) p.rect(x, y, 3, 2.2, pick(gt('red', d, 0.35), 3));
      if (d >= 2) p.rect(x, 4, 1 / d, 18, pick(gt('cloth', d, 0.4), 4.4));
      p.rect(x - 1.5, 21.6, 6, 2.4, T('ink', 1, d));
    }
    // The tape sagging between them; its loose end (torn) flutters on the right (2 frames).
    const sag = i ? 4.2 : 3.4;
    const pts: Array<[number, number]> = [];
    for (let k = 0; k <= 12; k++) {
      const t = k / 12;
      pts.push([4.5 + t * 61, 6 + Math.sin(Math.PI * t) * sag + (i ? Math.sin(t * 9) * 0.5 : 0)]);
    }
    tapeStrip(p, pts, 1.6);
    const end: Array<[number, number]> = i
      ? [[67.5, 7], [69.5, 10], [71, 9.4]]
      : [[67.5, 7], [69, 11], [68.5, 14]];
    tapeStrip(p, end, 1.3);
    outlineC(p);
  },
  { ticksPerFrame: 22 },
);

reg(
  'decor/oz-ruin/sign',
  [0, 1].map(() => ({ w: 30, h: 42, ox: 15, oy: 42 })),
  (p, i) => {
    const d = p.d;
    const steel = gt('black', d, 0.2);
    // The stand: two legs splayed, a crossbar.
    p.line(9, 22, 5, 41.4, pick(steel, 2), Math.max(1, d));
    p.line(21, 22, 25, 41.4, pick(steel, 1.4), Math.max(1, d));
    p.rect(7, 33, 16, 1, pick(steel, 1.6));
    // The board: white, a red border, GEVAAR in big letters, BLIJF BINNEN under it.
    const white = gt('cloth', d, 0.35);
    const red = gt('red', d, 0.3);
    p.rect(1, 6, 28, 18, pick(red, 3));
    p.fill(2.5, 7.5, 25, 15, (X, Y) => pick(white, dq(3.6 - ((Y + 0.5) / d - 7.5) / 15 + (d >= 4 && h2(X >> 1, Y >> 1, 9) > 0.86 ? -0.8 : 0), X, Y, 0.6)));
    if (d >= 2) p.rect(1, 6, 28, 1 / d, pick(red, 5));
    const big = 'GEVAAR';
    tinyText(p, big, 15 - tinyWidth(big) / 2, 9, pick(red, 3.4));
    if (d >= 2) {
      const small = 'BLIJF BINNEN';
      tinyText(p, small, 15 - (tinyWidth(small) * 0.5) / 2, 16.5, T('ink', 1, d), { scale: 0.5 });
    } else p.rect(5, 17, 20, 1, T('ink', 1, d));
    // Rain dirt down the board.
    if (d >= 2) for (let k = 0; k < 5; k++) p.rect(4 + h2(k, 1, 13) * 22, 15 + h2(k, 2, 13) * 4, 1 / d, 2 + h2(k, 3, 13) * 5, pick(white, 1.6));
    // The amber lamp on top (frame 0 lit).
    p.rect(13, 3, 4, 3, pick(steel, 1.4));
    p.disc(15, 2.6, 2.6, 2.4, (_X, _Y, u, v) => (i === 0 ? T('candle', u * u + v * v < 0.35 ? 6 : 5, d) : pick(gt('orange', d, 0.5), v < 0 ? 2 : 1)));
    outlineC(p);
  },
  { ticksPerFrame: 30 },
);

// ============================================================================================
// The torn banners (R2-2: this mission only, a few, never clean or prominent)
// ============================================================================================

/** The banner's frame: its iron rod along the top (anchor top-left at the rod's wall end). */
export const BANNER_W = 18;
export const BANNER_H = 42;

/** Is the cell (a, b) of the 5 × 5 symbol grid inked (the hooked cross; hooks turn clockwise)? */
function symbolCell(a: number, b: number): boolean {
  if (a === 0 || b === 0) return true;
  return (b === -2 && a > 0) || (a === 2 && b > 0) || (b === 2 && a < 0) || (a === -2 && b < 0);
}

reg(
  'decor/oz-ruin/banner',
  [0, 1].map(() => ({ w: BANNER_W, h: BANNER_H, ox: 0, oy: 0 })),
  (p, i) => {
    const d = p.d;
    const seed = 600 + i * 31;
    // The rod out of the wall and its bracket.
    const iron = gt('black', d, 0.15);
    p.rect(0, 0.5, BANNER_W - 1, 1.4, pick(iron, 2));
    p.rect(0, 0, 1.6, 4, pick(iron, 1.4));
    p.disc(BANNER_W - 1.4, 1.2, 1.2, 1.2, pick(iron, 3));
    // The cloth: faded, stained red going brown, a dirty disc with the hooked cross, the hem
    // rotted into tatters, holes; the symbol half torn away (each frame its own tear).
    const red = ladder([T('ink', 1, d), R2('soot', 2, d), T('red', 1, d), T('red', 2, d), T('red', 3, d), T('red', 4, d)], d === 1 ? 1 : 2, d);
    const disc = ladder([R2('soot', 3, d), T('stone', 3, d), T('stone', 4, d), R2('rot', 6, d)], 2, d);
    const blk = T('ink', 1, d);
    const mould = r2tones('rot', d);
    const x0 = 2;
    const x1 = BANNER_W - 2;
    const cw = x1 - x0;
    const cx = x0 + cw / 2;
    const cy = 14;
    const R = 5.2;
    const g = R / 2.9; // one symbol cell
    const tear = (x: number, y: number): boolean => {
      // Frame 0: a long rip from the lower right through the disc's corner; frame 1: a hole in the
      // middle left and a diagonal tear up from the hem.
      if (i === 0) return x - cx > 0.6 && y > cy - 1 && y < cy + 9 && x - cx > (y - cy) * 0.45 + 0.8 - h2(Math.floor(y), 1, seed) * 1.2;
      const hx = x - (cx - 2.4);
      const hy = y - (cy + 1.5);
      if (hx * hx * 1.4 + hy * hy < 5 + h2(Math.floor(x), Math.floor(y), seed) * 3) return true;
      return y > 24 && Math.abs(x - (cx + 1.5 + (y - 24) * 0.25)) < 0.5 + (y - 24) * 0.05;
    };
    p.fill(x0, 2, cw, BANNER_H - 2, (X, Y) => {
      const x = (X + 0.5) / d;
      const y = (Y + 0.5) / d;
      const u = (x - x0) / cw;
      // The ragged hem: long tatters, shorter at the sides.
      const hem = BANNER_H - 4 - Math.abs(Math.sin(u * 11 + seed)) * 9 - h2(Math.floor(x * 1.5), 3, seed) * 6;
      if (y > hem) return 0;
      if (tear(x, y)) return 0;
      // Folds: the cloth hangs in soft vertical folds (light / shade bands).
      const fold = Math.sin(u * Math.PI * 3.2 + 0.6) * 0.9;
      const dx = x - cx;
      const dy = y - cy;
      const r = Math.sqrt(dx * dx + dy * dy);
      let c: Color;
      if (r < R) {
        // The symbol, rotated 45° on the disc.
        const a = Math.round((dx + dy) / Math.SQRT2 / g);
        const b = Math.round((dy - dx) / Math.SQRT2 / g);
        const inked = Math.abs(a) <= 2 && Math.abs(b) <= 2 && symbolCell(a, b);
        // The black paint faded and flaked off in places.
        const worn = inked && fnoise(x, y, 1.6, seed + 2) > 0.62;
        c = inked && !worn ? blk : worn ? R2('soot', 3, d) : pick(disc, dq(1.8 + fold - dy * 0.08, X, Y, 0.8));
      } else {
        c = pick(red, dq(3.9 + fold - y / BANNER_H * 2 + (fnoise(x, y, 3, seed) - 0.5) * 1.4, X, Y, 0.8));
      }
      // Mould and rot stains, darker toward the hem; dirt runs.
      const m = fnoise(x, y, 4, seed + 8);
      if (m > 0.68) c = pick(mould, dq(1 + (m - 0.68) * 6, X, Y, 0.8));
      if (y > hem - 3 && dq((y - (hem - 3)) / 3, X, Y, 1) >= 1) c = pick(mould, 1);
      return c;
    });
    // The top hem rolled over the rod.
    p.rect(x0, 1.6, cw, 1.2, pick(red, 1.4));
    outlineC(p);
  },
);

// ============================================================================================
// Rubbish and street litter
// ============================================================================================

/** A bicycle lying on the pavers (seen from a little above: flattened wheels). */
function bikeDown(p: Pen, x: number, seed: number): void {
  const d = p.d;
  const frame = gt(seed % 2 ? 'navy' : 'black', d, 0.35);
  const steel = gt('steel', d, 0.4);
  for (const [wx, wy] of [[x + 6, 8], [x + 22, 7.4]] as const) {
    p.disc(wx, wy, 6.2, 2.6, (_X, _Y, u, v) => (u * u + v * v > 0.62 ? T('ink', 1, d) : 0));
    p.disc(wx, wy, 5.2, 2, (_X, _Y, u, v) => (u * u + v * v > 0.7 ? pick(steel, 3) : 0));
  }
  p.line(x + 6, 8, x + 14, 6, pick(frame, 3), Math.max(1, d));
  p.line(x + 14, 6, x + 22, 7.4, pick(frame, 3), Math.max(1, d));
  p.line(x + 14, 6, x + 11, 8.6, pick(frame, 2.4), Math.max(1, d));
  p.line(x + 11, 8.6, x + 6, 8, pick(frame, 2.4), Math.max(1, d));
  // The handlebar sticking up, the saddle.
  p.line(x + 21, 7, x + 23, 2.4, pick(frame, 2), Math.max(1, d));
  p.rect(x + 21.6, 1.8, 3.4, 1, pick(gt('black', d, 0.2), 2));
  p.rect(x + 11, 4.6, 3.6, 1.2, pick(gt('black', d, 0.2), 1.6));
}

reg(
  'decor/oz-ruin/bike',
  [0, 1].map(() => ({ w: 34, h: 12, ox: 17, oy: 12 })),
  (p, i) => {
    bikeDown(p, 2, i);
    if (i === 1) bikeDown(p, 6, 2);
    outlineC(p);
  },
);

/** A black bin bag (glossy plastic, a tied neck). */
function bag(p: Pen, cx: number, by: number, rx: number, ry: number, seed: number, grey = false): void {
  const d = p.d;
  const t = gt(grey ? 'steel' : 'black', d, 0.15);
  p.disc(cx, by - ry, rx, ry, (X, Y, u, v) => {
    let k = 1.4 - v * 0.8 - u * 0.4;
    if (d >= 2 && Math.abs(u + 0.35) < 0.12 && v < 0) k += 1.6; // the shine
    if (d >= 4 && h2(X >> 1, Y, seed) > 0.85) k -= 0.6; // creases
    return pick(t, dq(k, X, Y, 0.6));
  });
  p.rect(cx - 0.8, by - ry * 2 - 1.2, 1.6, 1.6, pick(t, 2.4));
}

/** A cardboard box, soggy. */
function box(p: Pen, x: number, by: number, w: number, h: number, seed: number): void {
  const d = p.d;
  const t = gt('sand', d, 0.45);
  p.fill(x, by - h, w, h, (X, Y) => pick(t, dq(2 - ((Y + 0.5) / d - (by - h)) / h * 1.2 + (d >= 4 && h2(X >> 1, Y >> 2, seed) > 0.8 ? -0.6 : 0), X, Y, 0.6)));
  p.rect(x, by - h, w, d === 1 ? 1 : 0.6, pick(t, 3));
  p.rect(x + w * 0.5, by - h, 1 / d, h, pick(t, 1));
}

reg(
  'decor/oz-ruin/bin',
  [{ w: 28, h: 12, ox: 14, oy: 12 }],
  (p) => {
    const d = p.d;
    const g = gt('green', d, 0.4);
    // The bin on its side (the open end to the right), rubbish spilt from it.
    p.fill(2, 3, 13, 8.4, (X, Y) => pick(g, dq(2.6 - ((Y + 0.5) / d - 3) / 8.4 * 1.6, X, Y, 0.6)));
    p.disc(15, 7.2, 1.8, 4.2, (_X, _Y, u) => (u > 0 ? T('ink', 0, d) : pick(g, 3.2)));
    p.rect(2, 3, 1, 8.4, pick(g, 1));
    bag(p, 19, 11.6, 3.4, 2.6, 3);
    box(p, 21.5, 11.8, 5, 3.4, 4);
    for (let k = 0; k < 6; k++) p.rect(16 + h2(k, 1, 5) * 11, 9.6 + h2(k, 2, 5) * 2, 1.4, 0.8, pick(gt(k % 2 ? 'cloth' : 'orange', d, 0.45), 2.6));
    outlineC(p);
  },
);

reg(
  'decor/oz-ruin/rubbish',
  [0, 1, 2].map(() => ({ w: 28, h: 13, ox: 14, oy: 13 })),
  (p, i) => {
    if (i === 0) {
      bag(p, 8, 12.6, 5, 4, 1);
      bag(p, 16, 12.8, 4.2, 3.4, 2, true);
      bag(p, 12, 9.4, 3.6, 2.8, 3);
      box(p, 19.5, 12.8, 7, 5, 5);
    } else if (i === 1) {
      box(p, 3, 12.8, 9, 6, 7);
      box(p, 6, 6.8, 6, 4, 8);
      bag(p, 18, 12.6, 5.4, 4.2, 9);
    } else {
      bag(p, 7, 12.6, 4.6, 3.6, 11);
      box(p, 13, 12.8, 8, 3.6, 12);
      // A broken chair (two legs up).
      const w = woodLadder(p.d);
      p.rect(21, 8.6, 6, 1.6, pick(w, 4));
      p.rect(22, 3, 1, 5.6, pick(w, 3));
      p.rect(25.6, 4.4, 1, 4.2, pick(w, 2.6));
    }
    outlineC(p);
  },
);

reg(
  'decor/oz-ruin/paper',
  [0, 1, 2].map(() => ({ w: 20, h: 5, ox: 10, oy: 5 })),
  (p, i) => {
    const d = p.d;
    const t = gt('cloth', d, 0.5);
    for (let k = 0; k < 2 + i; k++) {
      const x = 1 + h2(k, 1, 20 + i) * 12;
      const y = 1.2 + h2(k, 2, 20 + i) * 2;
      const w = 5 + h2(k, 3, 20 + i) * 3;
      p.poly(
        [
          [x, y + 1.6],
          [x + 1.2, y],
          [x + w, y + 0.4],
          [x + w - 0.8, y + 2.2],
        ],
        (X, Y) => pick(t, dq(2.8 - (d >= 4 && Y % 2 === 0 && (X >> 1) % 5 !== 0 ? 1 : 0), X, Y, 0.6)),
      );
    }
  },
);

reg(
  'decor/oz-ruin/weeds',
  [0, 1, 2].map(() => ({ w: 12, h: 9, ox: 6, oy: 9 })),
  (p, i) => {
    weed(p, 4, 8.8, 5 + i, 70 + i * 3, 0.4);
    weed(p, 8, 8.8, 3.6 + i * 0.6, 71 + i * 3, 0.7);
    if (i === 2) weed(p, 6, 8.8, 7.4, 79, 0.2);
  },
);

reg(
  'decor/oz-ruin/glass',
  [0, 1].map(() => ({ w: 24, h: 4, ox: 12, oy: 4 })),
  (p, i) => {
    const d = p.d;
    const t = gt('glass', d, 0.2);
    for (let k = 0; k < 9; k++) {
      const x = 1 + h2(k, 1, 40 + i) * 21;
      const y = 0.6 + h2(k, 2, 40 + i) * 2.6;
      const s = 0.8 + h2(k, 3, 40 + i) * 1.4;
      p.poly(
        [
          [x, y + s * 0.6],
          [x + s * 0.5, y],
          [x + s, y + s * 0.7],
        ],
        h2(k, 4, 40 + i) > 0.6 ? pick(t, 5) : pick(t, 2.4),
      );
    }
  },
);

reg(
  'decor/oz-ruin/crow',
  [0, 1].map(() => ({ w: 9, h: 8, ox: 4, oy: 8 })),
  (p, i) => {
    const d = p.d;
    const t = gt('black', d, 0.1);
    // The body, the tail down behind, the head (turned in frame 1), the beak, the eye glint.
    p.disc(4.4, 4.6, 2.8, 2.2, (_X, _Y, u, v) => pick(t, 1.4 - v * 0.6 + (u < -0.3 ? 0.5 : 0)));
    p.poly([[6.4, 4.6], [8.8, 7.6], [6.6, 7]], pick(t, 0.6));
    const hx = i ? 4.4 : 2.4;
    p.disc(hx, 2.4, 1.5, 1.4, pick(t, 1.8));
    p.poly([[hx - (i ? 0 : 1.2), 2.2], [hx - (i ? 1 : 3), 2.8], [hx - (i ? 0 : 1.1), 3.1]], pick(gt('steel', d, 0.3), 1.6));
    if (d >= 4) p.rect(hx - 0.6, 1.9, 0.5, 0.5, T('steel', 5, d));
    p.rect(3.6, 6.6, 0.6, 1.4, pick(t, 2.2));
    p.rect(5, 6.6, 0.6, 1.4, pick(t, 2.2));
    outlineC(p);
  },
);
