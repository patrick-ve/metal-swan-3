/**
 * THE BANDWAGON art (GDD §8.4): a captured Legion parade truck in `red` and `gold` — a grinning
 * cab (chrome grille shaped like a grin, a headlight eye), bunting on two poles, a stage on the
 * flatbed with a giant bass drum (Pip's wonky white swan painted over the Legion crest) and a
 * swivelling sousaphone bell at the pilot's podium. Plus its rings, ground waves and instruments.
 *
 * Registers (`vehicle/bandwagon/…`, body space of ./numbers.ts, feet anchor = ground centre):
 * - `body` (2: intact, battered), `front` (the podium and the bed panel that hide the pilot's
 *   legs), `drum` (4: rest, hit, rebound, settle), `bell` (5 angles 0° … −120°, anchor = the
 *   pivot), `empty-gag` (2: the bell droops, anchor = the pivot), `wheels` (4, centre anchor),
 *   `special` (5: the CYMBAL WALL swings up 0–2, shimmers 3–4), `wreck`, and the whole-truck
 *   strips `idle` / `move` (4).
 * - fx: `note` (2), `bits` (6 instruments: trumpet, drumstick, cymbal, horn bell, pennant,
 *   triangle).
 * - shots: `weapon/brass-ring` (16: sizes 10, 12 … 24 px × 2 shimmer frames, centre anchor) and
 *   `weapon/drum-wave` (8, anchor = the ground point under the wave's middle).
 */
import type { Color } from '../../../../engine/color';
import { PixelBuffer, type Ramp } from '../../../../engine/pixel';
import { INK, PAL } from '../../../../engine/palette';
import type { Frame } from '../../../../engine/render';
import { defineSprite } from '../../../../engine/sprites';
import { scorch } from '../../../art/human-fx';
import { damage, wheel } from '../../../art/machines';
import { FLAT, shadeLayer } from '../../../art/paint';
import { BRASS, center, CHROME, GLASS, RED, rot, Sheet, stackFrames, WHITE, type Pt } from './kit.art';
import { ART, BANDWAGON, bellAngle, BRASS as RING, DRUM } from './numbers';

const A = ART.bandwagon;
const WOOD: Ramp = PAL.brown;

/** Sheet for the truck: 118 × 68, body (0, 0) at buffer (52, 64). */
const sheet = (): Sheet => new Sheet(118, 68, 52, 64);

/** Region of the flatbed panel the `front` overlay repeats over the pilot's legs. */
const LEGS = { x: -17, y: -24, w: 22, h: 15 } as const;

// ------------------------------------------------------------------------------------ body

/** Cab outline (facing right): rear wall, roof, sloped windscreen, the hood, the grille face. */
const CAB: readonly Pt[] = [
  [16, -9],
  [16, -36],
  [35, -36],
  [40, -26],
  [46, -25],
  [48, -22],
  [48, -9],
];

function truckBody(battered: boolean): Frame {
  const s = sheet();
  // Chassis rail.
  const ch = s.layer();
  s.rect(ch, -46, -12, 92, 5, FLAT);
  s.add(ch, PAL.steel, { base: 1 });
  // Bunting poles (behind the bed): rear and front of the stage.
  const poles = s.layer();
  s.rect(poles, -46, -54, 2, 31, FLAT);
  s.rect(poles, 12, -46, 2, 23, FLAT);
  s.add(poles, PAL.gold, { base: 1 });
  const knobs = s.layer();
  knobs.circle(s.X(-45), s.Y(-55), 2, FLAT);
  knobs.circle(s.X(13), s.Y(-47), 2, FLAT);
  s.add(knobs, BRASS, { glint: true });
  // Bunting: a sagging string with red / gold / white pennants.
  const bun = s.layer();
  const span = (x0: number, y0: number, x1: number, y1: number, sag: number, seed: number): void => {
    for (let x = x0; x <= x1; x++) {
      const u = (x - x0) / (x1 - x0);
      const y = Math.round(y0 + (y1 - y0) * u + sag * 4 * u * (1 - u));
      bun.set(s.X(x), s.Y(y), PAL.stone[1]);
      const k = x - x0 - 2;
      if (k >= 0 && k % 6 < 4 && x < x1 - 2) {
        const c = [PAL.red[2], PAL.gold[2], WHITE][(Math.floor(k / 6) + seed) % 3];
        const col = k % 6;
        const len = col === 0 || col === 3 ? 2 : 4;
        for (let d = 1; d <= len; d++) bun.set(s.X(x), s.Y(y + d), c);
      }
    }
  };
  span(-44, -54, 12, -46, 4, 0);
  span(14, -46, 30, -37, 2, 1);
  s.paint(bun);
  // Flatbed: the red bed box, gold trim, planked stage top.
  const bed = s.layer();
  s.rect(bed, -48, -24, 65, 14, FLAT);
  s.add(bed, RED, { glint: true });
  const top = s.layer();
  s.rect(top, -48, -26, 64, 3, FLAT);
  shadeLayer(top, WOOD);
  for (let x = -44; x < 16; x += 7) top.set(s.X(x), s.Y(-25), WOOD[0]);
  s.comp.add(top, { ramp: WOOD });
  const trim = s.layer();
  for (let x = -47; x <= 15; x++) {
    trim.set(s.X(x), s.Y(-21), PAL.gold[2]);
    // A row of gold scallops along the skirt.
    const k = (x + 47) % 6;
    if (k >= 1 && k <= 4) trim.set(s.X(x), s.Y(-13), PAL.gold[1]);
    if (k >= 2 && k <= 3) trim.set(s.X(x), s.Y(-12), PAL.gold[1]);
  }
  s.paint(trim);
  // Cab.
  const cab = s.layer();
  s.poly(cab, CAB, FLAT);
  s.add(cab, RED, { glint: true });
  const win = s.layer();
  s.rect(win, 21, -33, 12, 8, FLAT);
  s.add(win, GLASS, { base: 2 });
  const det = s.layer();
  // Windscreen edge, door seam, handle, gold pinstripe.
  for (let i = 0; i <= 9; i++) {
    det.set(s.X(35 + Math.round(i * 0.5)), s.Y(-35 + i), GLASS[3]);
    det.set(s.X(34 + Math.round(i * 0.5)), s.Y(-35 + i), GLASS[2]);
  }
  for (let y = -24; y <= -11; y++) det.set(s.X(19), s.Y(y), PAL.red[0]);
  s.rect(det, 22, -22, 3, 1, PAL.gold[3]);
  for (let x = 17; x <= 47; x++) det.set(s.X(x), s.Y(-20), PAL.gold[2]);
  // Window glint.
  det.set(s.X(22), s.Y(-32), WHITE);
  det.set(s.X(23), s.Y(-32), WHITE);
  det.set(s.X(22), s.Y(-31), WHITE);
  s.paint(det);
  // The headlight eye and the chrome grin (a smile of teeth bars) on the nose.
  const eye = s.layer();
  eye.circle(s.X(44), s.Y(-22), 2, FLAT);
  s.add(eye, PAL.gold, { base: 2, glint: true });
  s.dot(44, -22, INK);
  s.dot(43, -23, WHITE);
  const grin = s.layer();
  for (let x = 36; x <= 48; x++) {
    const u = (x - 42) / 6;
    const yTop = Math.round(-17 + 3 * u * u);
    for (let y = yTop; y <= yTop + 3; y++) grin.set(s.X(x), s.Y(y), FLAT);
  }
  s.add(grin, CHROME, { base: 3 });
  const teeth = s.layer();
  for (let x = 37; x <= 47; x += 2) {
    const u = (x - 42) / 6;
    const yTop = Math.round(-17 + 3 * u * u);
    teeth.set(s.X(x), s.Y(yTop + 1), PAL.steel[1]);
    teeth.set(s.X(x), s.Y(yTop + 2), PAL.steel[1]);
  }
  s.paint(teeth);
  // Bumper.
  const bump = s.layer();
  s.rect(bump, 43, -11, 7, 3, FLAT);
  s.rect(bump, -50, -11, 5, 3, FLAT);
  s.add(bump, CHROME, { glint: true });
  // Wheel arches.
  const arch = s.layer();
  for (const wx of BANDWAGON.wheels) {
    for (let y = -17; y <= -9; y++) {
      for (let x = wx - 10; x <= wx + 10; x++) {
        const d = Math.hypot(x - wx, y - BANDWAGON.wheelY);
        if (d <= 9.5 && (s.buf.get(s.X(x), s.Y(y)) & 255) !== 0) arch.set(s.X(x), s.Y(y), d > 8.5 ? PAL.red[0] : PAL.black[1]);
      }
    }
  }
  s.paint(arch);
  let f = s.finish();
  if (battered) f = { ...f, buf: damage(f.buf, 0.5, 11) };
  return f;
}

/** The podium (in front of the pilot) and a repeat of the bed panel that hides his legs. */
function frontFrame(): Frame {
  const body = truckBody(false);
  const s = sheet();
  // Copy the bed panel under the podium.
  for (let y = LEGS.y; y < LEGS.y + LEGS.h; y++) {
    for (let x = LEGS.x; x < LEGS.x + LEGS.w; x++) s.buf.set(s.X(x), s.Y(y), body.buf.get(body.ox + x, body.oy + y));
  }
  const pod = s.layer();
  s.poly(pod, [[-14, -24], [-14, -30], [-1, -32], [0, -24]], FLAT);
  s.add(pod, RED, { glint: true });
  const trim = s.layer();
  for (let x = -14; x <= 0; x++) trim.set(s.X(x), s.Y(-27), PAL.gold[2]);
  // A gold note on the podium front.
  s.rect(trim, -8, -31 + 4, 1, 1, PAL.gold[3]);
  s.paint(trim);
  const f = s.finish();
  // The INK ring around the copied panel's cut edges would show over the pilot: drop it there.
  for (let y = LEGS.y - 1; y <= LEGS.y + LEGS.h; y++) {
    for (const x of [LEGS.x - 1, LEGS.x + LEGS.w]) {
      if (f.buf.get(f.ox + x, f.oy + y) === INK && (body.buf.get(body.ox + x, body.oy + y) & 255) !== 0) f.buf.set(f.ox + x, f.oy + y, body.buf.get(body.ox + x, body.oy + y));
    }
  }
  return f;
}

// ------------------------------------------------------------------------------------ drum

/**
 * The bass drum on the stage, frame k: 0 rest, 1 the beater hits (rings on the head), 2 the
 * rebound, 3 settling. Crimson head in gold hoops, Pip's wonky white swan over the old crest.
 */
function drumFrame(k: number): Frame {
  const s = sheet();
  const [cx, cy] = BANDWAGON.drum;
  const r = BANDWAGON.drumR;
  const hoop = s.layer();
  hoop.circle(s.X(cx), s.Y(cy), r, FLAT);
  s.add(hoop, BRASS, { glint: true });
  const head = s.layer();
  head.circle(s.X(cx), s.Y(cy), r - 2, FLAT);
  s.add(head, RED, { base: 2 });
  const p = s.layer();
  // Tension lugs on the hoop.
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    p.set(Math.round(s.X(cx + Math.cos(a) * (r - 1))), Math.round(s.Y(cy + Math.sin(a) * (r - 1))), PAL.gold[0]);
  }
  // Left-over crest: three gold points peeking out above the swan.
  for (const [x, y] of [[-35, -43], [-31, -45], [-27, -43]] as const) p.set(s.X(x), s.Y(y), PAL.gold[2]);
  // The wonky swan: a lumpy body, an S neck, a dot eye and an orange beak.
  const body = new PixelBuffer(s.w, s.h);
  body.ellipse(s.X(-38), s.Y(-34), 11, 6, WHITE);
  body.set(s.X(-39), s.Y(-35), WHITE);
  body.set(s.X(-37), s.Y(-35), WHITE);
  for (const [x, y] of [[-28, -32], [-27, -33], [-26, -34], [-26, -35], [-27, -36], [-27, -37], [-26, -38], [-25, -38]] as const) {
    body.set(s.X(x), s.Y(y), WHITE);
    body.set(s.X(x + 1), s.Y(y), WHITE);
  }
  body.rect(s.X(-26), s.Y(-40), 3, 2, WHITE);
  body.set(s.X(-23), s.Y(-39), PAL.orange[1]);
  body.set(s.X(-22), s.Y(-39), PAL.orange[1]);
  body.set(s.X(-25), s.Y(-40), INK);
  // Brush wobble: the tail feathers stick out unevenly.
  body.set(s.X(-39), s.Y(-34), WHITE);
  body.set(s.X(-40), s.Y(-35), WHITE);
  s.paint(p);
  s.paint(body);
  if (k === 1 || k === 2) {
    // Rings on the struck head.
    const rr = k === 1 ? 4 : 7;
    const ringL = new PixelBuffer(s.w, s.h);
    ringL.circle(s.X(cx + 4), s.Y(cy + 2), rr, PAL.gold[3], false);
    for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) if ((ringL.get(x, y) & 255) !== 0 && ((x + y) & 1) === 0 && Math.hypot(x - s.X(cx), y - s.Y(cy)) < r - 2) s.buf.set(x, y, PAL.gold[3]);
  }
  // The beater on its arm from the stage (pivot at the drum's front foot).
  const beat = s.layer();
  const piv: Pt = [-15, -26];
  const headAt: Pt = k === 1 ? [-17, -33] : k === 2 ? [-11, -38] : k === 3 ? [-14, -36] : [-15, -36];
  beat.line(s.X(piv[0]), s.Y(piv[1]), s.X(headAt[0]), s.Y(headAt[1]), FLAT);
  s.add(beat, PAL.brown, { base: 2 });
  const mallet = s.layer();
  mallet.circle(s.X(headAt[0]), s.Y(headAt[1]), 2, FLAT);
  s.add(mallet, PAL.cloth, { glint: true });
  return s.finish();
}

// ------------------------------------------------------------------------------------ bell

/** The sousaphone: a coil around the pilot's middle and a flared brass bell at angle `deg`. */
function bellFrame(deg: number): Frame {
  const s = new Sheet(64, 64, 32, 32);
  const [px, py] = BANDWAGON.pivot;
  // Coil (body space relative to the pivot): a brass hoop around the pilot.
  const coil = s.layer();
  const ccx = -6 - px + 0;
  const ccy = -28 - py;
  coil.circle(s.X(ccx), s.Y(ccy), 6, FLAT);
  const hole = new PixelBuffer(s.w, s.h);
  hole.circle(s.X(ccx), s.Y(ccy), 4, 1);
  for (let i = 0; i < hole.data.length; i++) if ((hole.data[i] & 255) !== 0) coil.data[i] = 0;
  // Only the near half of the hoop (the part in front of him): the lower arc.
  for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) if (y < s.Y(ccy) - 1) coil.set(x, y, 0);
  s.add(coil, BRASS);
  // Lead pipe from the coil to the pivot.
  const lead = s.layer();
  lead.thickLine(s.X(ccx + 5), s.Y(ccy + 2), s.X(0), s.Y(0), 2, FLAT);
  s.add(lead, BRASS);
  // Bell: a tube that flares to a mouth 16 px out.
  const a = (deg * Math.PI) / 180;
  const ux = Math.cos(a);
  const uy = Math.sin(a);
  const P = (d: number, o: number): Pt => [d * ux - o * uy, d * uy + o * ux];
  const width = (d: number): number => (d < 9 ? 1.5 : 1.5 + Math.pow((d - 9) / 7, 2) * 5);
  const bell = s.layer();
  const pts: Pt[] = [];
  for (let d = 0; d <= 16; d++) pts.push(P(d, -width(d)));
  for (let d = 16; d >= 0; d--) pts.push(P(d, width(d)));
  s.poly(bell, pts, FLAT);
  s.add(bell, BRASS, { glint: true });
  // The mouth: a dark throat inside a bright rim, seen a little from the side.
  const mouth = new PixelBuffer(s.w, s.h);
  for (let o = -5; o <= 5; o++) {
    for (let d = 15; d <= 16; d++) {
      const q = P(d, o);
      const c = Math.abs(o) >= 5 ? PAL.gold[3] : d === 16 ? PAL.gold[0] : Math.abs(o) <= 3 ? PAL.brown[0] : PAL.gold[1];
      mouth.set(Math.round(s.X(q[0])), Math.round(s.Y(q[1])), c);
    }
  }
  s.paint(mouth);
  // Valve buttons on the tube.
  const v = P(5, -2);
  s.dot(Math.round(v[0]), Math.round(v[1]), PAL.cloth[3]);
  return s.finish();
}

// ------------------------------------------------------------------------------------ cymbals

/**
 * CYMBAL WALL, frame k: two giant cymbals on hydraulic arms hinged at the bumper swing from the
 * hood (0) to upright in front of the cab (2); 3–4 shimmer.
 */
function cymbalFrame(k: number): Frame {
  // Wider than the truck sheet: lowered, the cymbals lie forward past the bumper.
  const s = new Sheet(150, 68, 52, 64);
  const hinge: Pt = [46, -10];
  const tilt = k === 0 ? 70 : k === 1 ? 35 : 0;
  const centres: Pt[] = [
    [54, -45],
    [54, -17],
  ];
  for (let i = 0; i < 2; i++) {
    const rel = rot([centres[i][0] - hinge[0], centres[i][1] - hinge[1]], tilt);
    const c: Pt = [hinge[0] + rel[0], hinge[1] + rel[1]];
    const arm = s.layer();
    arm.thickLine(s.X(hinge[0]), s.Y(hinge[1]), Math.round(s.X(c[0])), Math.round(s.Y(c[1])), 2, FLAT);
    s.add(arm, PAL.steel, { base: 2 });
    // The cymbal: an ellipse 13 × 27 turned with the arm, grooves, a centre dome.
    const L = s.layer();
    const t = (tilt * Math.PI) / 180;
    const ct = Math.cos(t);
    const st = Math.sin(t);
    for (let y = -16; y <= 16; y++) {
      for (let x = -16; x <= 16; x++) {
        const lx = x * ct + y * st;
        const ly = -x * st + y * ct;
        const q = (lx / 6.5) ** 2 + (ly / 13.5) ** 2;
        if (q > 1) continue;
        const rr = Math.sqrt(q);
        let col: Color = PAL.gold[2];
        if (rr < 0.22) col = PAL.gold[3];
        else if (Math.abs(rr - 0.55) < 0.06 || Math.abs(rr - 0.8) < 0.05) col = PAL.gold[1];
        else if (lx + ly * 0.4 < -3 && rr > 0.6) col = PAL.gold[3];
        else if (lx + ly * 0.4 > 3 && rr > 0.6) col = PAL.gold[1];
        L.set(Math.round(s.X(c[0] + x)), Math.round(s.Y(c[1] + y)), col);
      }
    }
    s.comp.add(L, { ramp: PAL.gold });
    if (k >= 3) {
      // Shimmer: a travelling glint.
      const g = k === 3 ? -6 : 4;
      s.dot(Math.round(c[0] - 2), Math.round(c[1] + g), WHITE);
      s.dot(Math.round(c[0] - 3), Math.round(c[1] + g), WHITE);
      s.dot(Math.round(c[0] - 2), Math.round(c[1] + g - 1), WHITE);
    }
  }
  return s.finish();
}

// ------------------------------------------------------------------------------------ parts

function wheelFrame(phase: number): Frame {
  const w = wheel(BANDWAGON.wheelR, phase, { rim: 'gold', bolts: 4, steps: 1 });
  const b = new PixelBuffer(w.w + 2, w.h + 2);
  b.blit(w, 1, 1);
  return center(b.outline(INK));
}

function wholeTruck(phase: number): Frame {
  const wl = wheelFrame(phase);
  return stackFrames(120, 72, 54, 68, [
    [truckBody(false), 0, 0],
    [drumFrame(0), 0, 0],
    [frontFrame(), 0, 0],
    [bellFrame(0), BANDWAGON.pivot[0], BANDWAGON.pivot[1]],
    [wl, BANDWAGON.wheels[0], BANDWAGON.wheelY],
    [wl, BANDWAGON.wheels[1], BANDWAGON.wheelY],
  ]);
}

function wreckFrame(): Frame {
  const wl = wheelFrame(0);
  const f = stackFrames(120, 72, 54, 68, [
    [truckBody(true), 0, 2],
    [drumFrame(0), -3, 6],
    [bellFrame(60), BANDWAGON.pivot[0], BANDWAGON.pivot[1] + 8],
    [wl, BANDWAGON.wheels[0], BANDWAGON.wheelY],
    [wl, BANDWAGON.wheels[1], BANDWAGON.wheelY + 1],
  ]);
  return scorch(f, 3);
}

// ------------------------------------------------------------------------------------ fx

function noteFrame(k: number): Frame {
  const b = new PixelBuffer(9, 11);
  const c = PAL.gold[k === 0 ? 2 : 3];
  b.circle(3, 8, 2, c);
  b.rect(5, 1, 1, 8, c);
  b.rect(6, 2, 2, 1, c);
  if (k === 1) b.rect(6, 4, 2, 1, c);
  b.set(2, 7, WHITE);
  return center(b.outline(INK));
}

/** Instruments flying out of the ram blast. */
function bitsFrame(k: number): Frame {
  const b = new PixelBuffer(13, 11);
  const g = (x: number, y: number, w: number, h: number, c: Color): void => void b.rect(x, y, w, h, c);
  switch (k) {
    case 0: // a little trumpet
      g(1, 5, 8, 1, PAL.gold[2]);
      g(8, 3, 3, 5, PAL.gold[2]);
      g(9, 4, 2, 3, PAL.gold[0]);
      g(4, 3, 1, 2, PAL.gold[3]);
      g(6, 3, 1, 2, PAL.gold[3]);
      break;
    case 1: // a drumstick
      g(2, 7, 7, 1, PAL.brown[2]);
      g(8, 6, 2, 2, PAL.cloth[2]);
      break;
    case 2: // a hand cymbal
      b.ellipse(6, 5, 9, 4, PAL.gold[2]);
      g(5, 4, 2, 1, PAL.gold[3]);
      break;
    case 3: // a horn bell
      b.poly([[1, 4], [7, 4], [11, 1], [11, 9], [7, 6], [1, 6]], PAL.gold[2]);
      g(10, 2, 1, 7, PAL.gold[0]);
      break;
    case 4: // a pennant
      b.poly([[2, 2], [10, 2], [6, 9]], PAL.red[2]);
      g(2, 2, 9, 1, PAL.stone[2]);
      break;
    default: // a triangle
      b.poly([[6, 1], [11, 9], [1, 9]], PAL.steel[3]);
      b.poly([[6, 4], [8, 7], [4, 7]], 0);
      break;
  }
  return center(b.outline(INK));
}

// ------------------------------------------------------------------------------------ shots

/** A sonic ring `size` px across: a brass hoop with a pale inner shimmer; `k` shifts the glint. */
function ringFrame(size: number, k: number): Frame {
  const n = size + 4;
  const b = new PixelBuffer(n, n);
  const c = (n - 1) / 2;
  const R = size / 2;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const d = Math.hypot(x - c, y - c);
      if (d > R || d < R - 2.2) continue;
      const lit = x - c + (y - c) < 0;
      const ang = Math.atan2(y - c, x - c);
      const glint = Math.abs(((ang - (k ? 2.4 : -2.2) + Math.PI * 3) % (Math.PI * 2)) - Math.PI) < 0.35;
      b.set(x, y, glint ? WHITE : d > R - 1 ? (lit ? PAL.gold[3] : PAL.gold[1]) : PAL.gold[2]);
    }
  }
  b.outline(INK);
  return { buf: b, ox: n >> 1, oy: n >> 1 };
}

/**
 * Drum-boom ground wave, frame k (one per 12 px run): a curling crest of dust with a sound arc,
 * 12 px wide and up to 12 px tall, leaning in its direction; it frays in the last frames.
 */
function waveFrame(k: number): Frame {
  const W = DRUM.w + 6;
  const H = DRUM.height + 3;
  const b = new PixelBuffer(W, H);
  const fade = k >= 6 ? k - 5 : 0;
  const h = DRUM.height - fade * 3;
  const base = H - 1;
  for (let x = 0; x < W - 2; x++) {
    const u = x / (W - 3);
    // A crest leaning forward (+x): rises slowly, falls steeply at the front.
    const col = Math.round(h * Math.sin(Math.min(1, u * 1.15) * Math.PI * 0.95) * (0.75 + 0.25 * u));
    for (let y = 0; y < col; y++) {
      const yy = base - y;
      const top = y >= col - 2;
      const c = top ? PAL.sand[3] : y < 2 ? PAL.sand[1] : (x + y + k) % 4 === 0 ? PAL.sand[1] : PAL.sand[2];
      if (fade > 0 && (x + y * 3 + k) % (5 - Math.min(3, fade)) === 0) continue;
      b.set(x + 1, yy, c);
    }
  }
  // A white sound arc inside the crest.
  for (let y = 0; y < Math.max(0, h - 4); y++) b.set(W - 6 - (y >> 2), base - 2 - y, WHITE);
  b.outline(INK);
  return { buf: b, ox: W >> 1, oy: base + 1 };
}

// ------------------------------------------------------------------------------------ register

const range = (n: number): number[] => Array.from({ length: n }, (_, i) => i);

defineSprite(`${A}/body`, () => [truckBody(false), truckBody(true)]);
defineSprite(`${A}/front`, () => [frontFrame()]);
defineSprite(`${A}/drum`, () => range(4).map(drumFrame), { ticksPerFrame: 4 });
defineSprite(`${A}/bell`, () => BANDWAGON.bellAngles.map((d) => bellFrame(d)));
defineSprite(`${A}/empty-gag`, () => [bellFrame(58), bellFrame(66)], { ticksPerFrame: 30 });
defineSprite(`${A}/wheels`, () => range(4).map(wheelFrame), { ticksPerFrame: 3 });
defineSprite(`${A}/special`, () => range(5).map(cymbalFrame), { ticksPerFrame: 4 });
defineSprite(`${A}/wreck`, () => [wreckFrame()]);
defineSprite(`${A}/idle`, () => [wholeTruck(0)]);
defineSprite(`${A}/move`, () => range(4).map(wholeTruck), { ticksPerFrame: 3 });
defineSprite(`${A}/note`, () => [noteFrame(0), noteFrame(1)], { ticksPerFrame: 11 });
defineSprite(`${A}/bits`, () => range(6).map(bitsFrame));

/** Ring sizes of the brass-ring strip: 10, 12 … 24 (frame = size step × 2 + shimmer). */
const SIZES = range(8).map((i) => RING.sizeFrom + i * 2);
defineSprite(ART.brassRing, () => SIZES.flatMap((sz) => [ringFrame(sz, 0), ringFrame(sz, 1)]));
defineSprite(ART.drumWave, () => range(8).map(waveFrame), { ticksPerFrame: 4 });

/** Exported for tests and the logic's comments: the bell angle of each strip frame (radians). */
export const BELL_FRAME_ANGLES: readonly number[] = BANDWAGON.bellAngles.map((_, i) => bellAngle(i));
