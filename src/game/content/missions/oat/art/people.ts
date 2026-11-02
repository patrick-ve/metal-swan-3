/**
 * The background people of mission `oat` and the shared bike drawer (STREET-A, wave A;
 * docs/design/oat.md §8.7 a 7 and d 7, §8.11; decision 34: "Life" was not picked, background people
 * stay modest: ≤ 4 figures per day screen, ≤ 2 after 03:00).
 *
 * Background people are scenery, never targets (spec §8.11): NO ink outline, darker and lower in
 * contrast than the cast, at their depth. They are true scale (36–38 px for 1.8–1.9 m, 20 px/m), lit
 * from the LEFT by day (decision 37: the sun stays left), rim-lit by the lamps at night.
 *
 * - `decor/oat/a/person-shopkeeper` (20 × 38): a shopkeeper putting out a small A-board.
 * - `decor/oat/a/person-sweeper` (30 × 38): a street sweeper in a dark work jacket with a broom.
 * - `decor/oat/a/person-cyclist` (38 × 40): a cyclist riding to the right (side view).
 * - `decor/oat/d/person-1`, `person-2` (20 × 38): passers-by at night, dark, a warm rim on one side.
 *
 * `drawBike` (the Dutch step-through city bike, 0.7 m wheels = r 7 px) is shared with the night's
 * parked bikes (night.ts).
 */
import type { Color } from '../../../../../engine/color';
import { dim, h2, reg, T, type Dn, type Pen } from './kit';

/** The lamps' warm rim at night (PAL_HD_OAT.lantern spill). */
function warm(d: Dn): Color {
  return T('oat.lantern', 0, d);
}

// ------------------------------------------------------------------------------------ the bike

/** Colours of a bike. */
export interface BikeLook {
  frame: Color;
  frameLit: Color;
  tyre: Color;
  rim: Color;
  metal: Color;
  saddle: Color;
  /** A crate on the front carrier (its tones), or none. */
  crate?: readonly [Color, Color];
  /** A light on the top edges (the sun by day, a lamp's rim at night). */
  rimLight?: Color;
}

/** A wheel: the tyre ring, the rim, spokes at 4×, the hub (logical centre and radius). */
function wheel(p: Pen, cx: number, cy: number, r: number, b: BikeLook): void {
  const d = p.d;
  p.disc(cx, cy, r, r, (_X, _Y, u, v) => {
    const q = Math.sqrt(u * u + v * v) * r;
    if (q > r - 1.1) return u < -0.3 && v < -0.3 && b.rimLight !== undefined && d >= 2 && q > r - 0.6 ? b.rimLight : b.tyre;
    if (q > r - 1.6) return b.rim;
    if (q < 0.8) return b.metal;
    // Spokes: radial lines (4× only, every ~22°).
    if (d >= 4) {
      const a = Math.atan2(v, u) / (Math.PI / 8);
      if (Math.abs(a - Math.round(a)) < 0.06 * (r / Math.max(1, q))) return b.rim;
    }
    return 0;
  });
}

/**
 * The bike side-on, its wheels on the ground line `gy`, centred at `cx`, facing right (`flip` left).
 * The frame strokes are a logical px thick at d ≥ 2 (two thirds of one at 4×).
 */
export function drawBike(p: Pen, cx: number, gy: number, b: BikeLook, flip = false): void {
  const d = p.d;
  const r = 6.8;
  const s = flip ? -1 : 1;
  const X = (x: number): number => cx + s * x;
  const w = Math.max(1, Math.round(d * 0.7));
  const L = (x0: number, y0: number, x1: number, y1: number, c: Color, wA = w): void => p.line(X(x0), gy - y0, X(x1), gy - y1, c, wA);
  wheel(p, X(-11.5), gy - r, r, b);
  wheel(p, X(11.5), gy - r, r, b);
  // Mudguards: arcs over the wheels.
  for (const wx of [-11.5, 11.5]) {
    for (let a = 0.15; a < Math.PI - 0.15; a += 0.25 / d) L(wx + Math.cos(a) * (r + 0.6), r + Math.sin(a) * (r + 0.6), wx + Math.cos(a) * (r + 0.6), r + Math.sin(a) * (r + 0.6), b.frame, Math.max(1, d >> 1));
  }
  // The frame: chain stays, seat stays, the step-through down tube, the head tube and the fork.
  L(-2, 6, -11.5, r, b.frame);
  L(-5, 15, -11.5, r, b.frame);
  L(-2, 6, -5, 17, b.frame);
  L(-2, 6, 3, 9, b.frame);
  L(3, 9, 8.5, 16, b.frame);
  L(8.5, 17, 11.5, r, b.metal);
  // The chain guard and the rear carrier.
  p.rect(X(s > 0 ? -11 : 2), gy - 8.2, 13, 1.6, b.frame);
  L(-17, 14.5, -6, 14.5, b.metal, w);
  L(-16, 14.5, -11.5, r, b.metal, Math.max(1, d >> 1));
  // The handlebar (swept back) and the saddle.
  L(8.5, 17, 8, 19, b.metal);
  L(8, 19, 5, 20, b.metal);
  p.rect(X(s > 0 ? -7.5 : 3.5), gy - 18.6, 4, 1.4, b.saddle);
  // The lit top edges of the down tube and the carrier.
  if (d >= 2) L(3, 9.6, 8.5, 16.6, b.frameLit, Math.max(1, d >> 1));
  if (b.crate) {
    const [c0, c1] = b.crate;
    const x0 = s > 0 ? 7.5 : -15.5;
    p.rect(X(0) + x0, gy - 23.5, 8, 5.5, c0);
    p.rect(X(0) + x0, gy - 23.5, 8, 1, c1);
    if (d >= 2) for (let k = 1; k < 4; k++) p.rect(X(0) + x0 + k * 2, gy - 22.5, 0.5, 4.5, c1);
  }
  if (b.rimLight !== undefined && d >= 2) {
    p.rect(X(s > 0 ? -7.5 : 3.5), gy - 18.6, 4, 1 / d, b.rimLight);
    L(-17, 14.9, -6, 14.9, b.rimLight, 1);
  }
}

// ------------------------------------------------------------------------------------ figures

/** Colours of a background figure. */
export interface FigureLook {
  skin: readonly [Color, Color];
  hair: Color;
  top: readonly [Color, Color];
  legs: readonly [Color, Color];
  shoes: Color;
  /** A light on the left (day: the sun) or on the right (night: a lamp) side. */
  rim?: Color;
  rimRight?: boolean;
  /** Day: the rim lifts the px under it by two tones of its own ramp instead of painting `rim`. */
  rimLift?: boolean;
}

/**
 * A standing figure 36 px tall with its feet on `gy` at x `cx`, facing right: the head (5 px), the
 * torso, the arms (`arm`: the forward arm's hand position relative to the shoulder), the legs
 * (`stride` px apart at the feet). The shaded side is the right one (two-tone volumes, no outline).
 */
export function drawFigure(p: Pen, cx: number, gy: number, f: FigureLook, o: { stride?: number; arm?: readonly [number, number]; lean?: number } = {}): void {
  const d = p.d;
  const top = gy - 36;
  const lean = o.lean ?? 0;
  const st = o.stride ?? 2;
  // Legs and shoes.
  p.poly(
    [
      [cx - 2.6, top + 20],
      [cx + 2.6, top + 20],
      [cx + 1.2 + st / 2, gy - 1],
      [cx + st / 2 - 0.8, gy - 1],
      [cx, top + 24],
      [cx - st / 2 + 0.8, gy - 1],
      [cx - 1.2 - st / 2, gy - 1],
    ],
    (X) => ((X + 0.5) / d < cx ? f.legs[1] : f.legs[0]),
  );
  p.rect(cx - st / 2 - 1.4, gy - 1.2, 2.6, 1.2, f.shoes);
  p.rect(cx + st / 2 - 0.6, gy - 1.2, 2.8, 1.2, f.shoes);
  // The torso (a jacket: shoulders 8 px, hips 6 px).
  p.poly(
    [
      [cx - 3.6 + lean, top + 7.5],
      [cx + 3.6 + lean, top + 7.5],
      [cx + 3.1, top + 21],
      [cx - 3.1, top + 21],
    ],
    (X) => ((X + 0.5) / d < cx + lean * 0.5 - 0.6 ? f.top[1] : f.top[0]),
  );
  // The near arm: from the shoulder to the hand.
  const [ax, ay] = o.arm ?? [0.6, 12];
  p.line(cx + 1.6 + lean, top + 9, cx + 1.6 + lean + ax, top + 9 + ay, f.top[0], Math.max(1, Math.round(d * 1.6)));
  p.disc(cx + 1.6 + lean + ax, top + 9.6 + ay, 1, 1, f.skin[0]);
  // The neck, the head, the hair.
  p.rect(cx - 0.8 + lean, top + 5.6, 1.8, 2.2, f.skin[0]);
  p.disc(cx + lean + 0.3, top + 3.2, 2.4, 2.7, (X) => ((X + 0.5) / d < cx + lean ? f.skin[1] : f.skin[0]));
  p.disc(cx + lean - 0.4, top + 1.9, 2.4, 1.7, f.hair);
  p.rect(cx + lean - 2.4, top + 1.9, 1.4, 2.4, f.hair);
  if (f.rim !== undefined && d >= 2) {
    // The rim: one art px along the lit side of the head, torso and legs.
    const side = f.rimRight ? 1 : -1;
    for (let Y = Math.round(top * d); Y < Math.round(gy * d); Y++) {
      const W = p.W;
      let edge = -1;
      if (side < 0) {
        for (let X = 0; X < W; X++) if (p.at(X, Y) !== 0) {
          edge = X;
          break;
        }
      } else {
        for (let X = W - 1; X >= 0; X--) if (p.at(X, Y) !== 0) {
          edge = X;
          break;
        }
      }
      if (edge >= 0 && h2(edge, Y, 5) < 0.85) p.dot(edge, Y, f.rimLift ? dim(p.at(edge, Y), 2, d) : f.rim);
    }
  }
}

// ------------------------------------------------------------------------------------ looks

function dayLook(d: Dn, k: number): FigureLook {
  // Darker than the cast: mid-to-deep tones, the sun's warm light only on the left edge.
  const looks: FigureLook[] = [
    { skin: [T('brown', 5, d), T('brown', 6, d)], hair: T('brown', 2, d), top: [T('cloth', 2, d), T('cloth', 3, d)], legs: [T('black', 2, d), T('black', 3, d)], shoes: T('ink', 1, d) },
    { skin: [T('brown', 4, d), T('brown', 5, d)], hair: T('ink', 1, d), top: [T('black', 2, d), T('black', 4, d)], legs: [T('denim', 2, d), T('denim', 3, d)], shoes: T('ink', 1, d) },
    { skin: [T('sand', 5, d), T('sand', 6, d)], hair: T('gold', 3, d), top: [T('oat.green', 2, d), T('oat.green', 3, d)], legs: [T('stone', 2, d), T('stone', 3, d)], shoes: T('brown', 1, d) },
  ];
  const l = looks[k % looks.length];
  return { ...l, rim: l.top[1], rimLift: true };
}

function nightLook(d: Dn, k: number): FigureLook {
  const looks: FigureLook[] = [
    { skin: [T('brown', 2, d), T('brown', 3, d)], hair: T('ink', 0, d), top: [T('navy', 1, d), T('navy', 2, d)], legs: [T('ink', 1, d), T('black', 2, d)], shoes: T('ink', 0, d) },
    { skin: [T('brown', 3, d), T('brown', 4, d)], hair: T('oat.brick', 0, d), top: [T('oat.brick', 1, d), T('oat.brick', 2, d)], legs: [T('slate', 1, d), T('slate', 2, d)], shoes: T('ink', 0, d) },
  ];
  return { ...looks[k % looks.length], rim: warm(d), rimRight: k % 2 === 0 };
}

// ------------------------------------------------------------------------------------ sprites

reg('decor/oat/a/person-shopkeeper', [{ w: 20, h: 38, ox: 10, oy: 38 }], (p) => {
  const d = p.d;
  const f = dayLook(d, 0);
  // An apron over the shirt, the A-board carried at the hands (in front, to the right).
  drawFigure(p, 8, 37.5, f, { stride: 3, arm: [3.2, 9], lean: 0.6 });
  p.rect(6.2, 37.5 - 22, 5, 9, T('oat.green', 1, d));
  // The A-board: two dark slate panels in a wooden frame, a few chalk lines (4×).
  p.poly(
    [
      [12.5, 37.5 - 14],
      [17.5, 37.5 - 14],
      [18.8, 37.5 - 4],
      [11.2, 37.5 - 4],
    ],
    T('wood', 2, d),
  );
  p.rect(13, 37.5 - 13, 4.5, 8, T('ink', 1, d));
  if (d >= 2) for (let k = 0; k < 3; k++) p.rect(13.6, 37.5 - 11.8 + k * 2.2, 3 - k * 0.6, 1 / d, T('stone', 5, d));
});

reg('decor/oat/a/person-sweeper', [{ w: 30, h: 38, ox: 15, oy: 38 }], (p) => {
  const d = p.d;
  const f: FigureLook = { skin: [T('brown', 5, d), T('brown', 6, d)], hair: T('stone', 3, d), top: [T('navy', 2, d), T('navy', 3, d)], legs: [T('navy', 1, d), T('navy', 2, d)], shoes: T('ink', 1, d), rim: T('navy', 3, d), rimLift: true };
  drawFigure(p, 12, 37.5, f, { stride: 4, arm: [4.5, 8], lean: 1.2 });
  // A reflective band round the jacket and the trousers (4× / 2× only: one tone, not a flash).
  if (d >= 2) {
    p.rect(9.2, 37.5 - 20.5, 6.6, 0.6, T('stone', 5, d));
    p.rect(9.6, 37.5 - 8, 5, 0.6, T('stone', 5, d));
  }
  // The broom: the handle from the hands down to the right, the brush on the ground.
  p.line(19, 37.5 - 18, 25.5, 37.5 - 2.5, T('wood', 3, d), Math.max(1, Math.round(d * 0.6)));
  p.rect(23, 37.5 - 2.6, 6, 1.4, T('wood', 2, d));
  p.rect(23.3, 37.5 - 1.2, 5.4, 1.2, T('sand', 3, d));
});

reg('decor/oat/a/person-cyclist', [{ w: 38, h: 40, ox: 19, oy: 40 }], (p) => {
  const d = p.d;
  drawBike(p, 19, 39.5, { frame: T('ink', 1, d), frameLit: T('black', 4, d), tyre: T('ink', 0, d), rim: T('steel', 3, d), metal: T('steel', 2, d), saddle: T('brown', 1, d), rimLight: T('stone', 5, d) });
  // The rider: seated on the saddle, leaning forward, a leg down on the pedal.
  const gy = 39.5;
  const f = dayLook(d, 1);
  // The near leg: thigh from the hip to the knee, shin to the pedal.
  p.line(15.5, gy - 19, 19.5, gy - 13, f.legs[0], Math.max(1, Math.round(d * 2)));
  p.line(19.5, gy - 13, 17.5, gy - 5, f.legs[0], Math.max(1, Math.round(d * 1.6)));
  p.rect(16.6, gy - 5.6, 2.6, 1.2, f.shoes);
  // The torso leaning forward to the bars (a jacket, lit on its back), the arm to the grip, the head.
  p.poly(
    [
      [12.4, gy - 20],
      [17.8, gy - 19],
      [23.4, gy - 29.4],
      [21.6, gy - 32.2],
      [18.4, gy - 32.6],
    ],
    // Lit only along the back (the sun is behind-left of a rider going right).
    (X, Y) => ((X + 0.5) / d < 12.4 + ((gy - 20 - (Y + 0.5) / d) / 12.6) * 6 + 1.4 ? f.top[1] : f.top[0]),
  );
  p.line(21.6, gy - 29.6, 24.2, gy - 21, f.top[0], Math.max(1, Math.round(d * 1.4)));
  p.disc(24.2, gy - 20.6, 1, 1, f.skin[0]);
  p.rect(21.2, gy - 33.6, 1.8, 1.6, f.skin[0]);
  p.disc(22.2, gy - 35.6, 2.4, 2.6, (X) => ((X + 0.5) / d < 21.8 ? f.skin[1] : f.skin[0]));
  p.disc(21.6, gy - 36.8, 2.4, 1.6, f.hair);
  p.rect(19.4, gy - 36.8, 1.4, 2.4, f.hair);
});

for (const k of [1, 2]) {
  reg(`decor/oat/d/person-${k}`, [{ w: 20, h: 38, ox: 10, oy: 38 }], (p) => {
    const f = nightLook(p.d, k - 1);
    drawFigure(p, 10, 37.5, f, { stride: k === 1 ? 4 : 2.5, arm: k === 1 ? [0.4, 12] : [2.4, 8], lean: k === 1 ? 0.4 : -0.3 });
    // The second one holds a phone: its screen a tiny cool light at 4× (no flash).
    if (k === 2 && p.d >= 2) p.rect(13.6, 37.5 - 27, 1, 1.4, T('steel', 4, p.d));
  });
}
