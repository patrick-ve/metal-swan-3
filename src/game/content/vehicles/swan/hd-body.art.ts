/**
 * SWAN-3 UHD art, part 3: the body at 2× / 4× (look.md §3–§8, §10, §12; docs/ART_GUIDE.md "UHD
 * art").
 *
 * `renderBodyHd(style, pose, d, body, front)` draws one body frame natively at density d in the
 * 1× body frame's rectangle (and cuts its `-front` overlay into the 1× front frame's rectangle),
 * from the 1× rig's geometry, back to front: far wing, far leg, tail, hull, seat pad, handles,
 * near leg, near wing, the collar or the baked neck and head.
 *
 * - Hull: white enamel on a lit volume (a lying cylinder with a flat face, the breast and the stern
 *   rolling away), the navy waterline stripe, two panel seams (dark groove, lit right wall), gold
 *   rivets with their shadows on the keel line, the navy bow "3", two flush jet vents (a lit lip
 *   round a dark port) and the steel smoke grille; the near wing throws a shadow on it.
 * - Wings and tail: stamped enamel feather plates (a shallow ridge across, rolled edges, a pressed
 *   quill at 4×), layered with their separations, navy tips (the Mute: steel); the arm plate is a
 *   padded plate with three gold rivets; the far wing is one band darker.
 * - Legs: lit steel drumstick and sleeve, the chrome piston rod, gold-capped joint bolt, the hip
 *   bearing with a hex bolt, webbed orange paddles with toe grooves and steel claws.
 * - Seat pad (quilted navy cushion, tufts, gold studs), brass handle stalks with ribbed black grips.
 * - Water frames: under the surface line the water ramps and a navy outline; foam, bow wave and
 *   wake; sparks under the keel.
 */
import type { Color } from '../../../../engine/color';
import { PixelBuffer } from '../../../../engine/pixel';
import { PAL_HD } from '../../../../engine/palette-hd';
import type { Frame } from '../../../../engine/render';
import { inPoly, type TexSample, type Texture } from '../../../art/hd/index';
import type { Blade, BodyPose, FootState, SwanStyle } from './body.art';
import { BACK_POSES, PADDLE_SPREAD, REST, SURFACE, hullPoly, legParts, paddleShape, tailParts, wingParts } from './body.art';
import { drawCollarHd, drawNeckHd } from './hd-head.art';
import { type D, SwanCanvas, Z, growPoly, segDist, setNormal, stud } from './hd-kit.art';
import type { Pt, V } from './kit.art';
import { OWN, Xf, add, rot, unit } from './kit.art';

export interface BodyHd {
  body: Frame;
  front: Frame | null;
}

/**
 * One HD body frame (and its front overlay) in the rectangles of the 1× frames `body` / `front`
 * (the same anchor, the same points).
 */
export function renderBodyHd(style: SwanStyle, pose: BodyPose, d: D, body: Frame, front: Frame | null): BodyHd {
  const xf = new Xf(pose.tilt + (pose.roll ?? 0), pose.dx ?? 0, pose.dy);
  const pts = body.pts ?? {};
  // The 1× ground lift (the art moved, the anchor kept): the hull point moved by it.
  const lift = pts.hull ? pts.hull[1] - Math.round(xf.pt(REST.hull)[1]) : 0;
  const sc = new SwanCanvas(body.buf.w, body.buf.h, d, body.ox, body.oy + lift);
  const nearBack = BACK_POSES.has(pose.wingN.p);
  drawParts(sc, xf, pose, style, nearBack);
  const out = sc.render();
  if (pose.water) sc.water(out, SURFACE);
  const marks = pose.marks ?? [];
  if (marks.includes('foam') || marks.includes('foam2')) waterMarksHd(out, sc, marks.includes('foam2'));
  if (marks.includes('sparks') || marks.includes('sparks2')) sparkMarksHd(out, sc, marks.includes('sparks2'));
  const res: BodyHd = { body: { buf: out, ox: body.ox, oy: body.oy, pts, density: d }, front: null };
  if (front) {
    const empty = front.buf.w <= 1 && front.buf.h <= 1 && (front.buf.data[0] & 255) === 0;
    const buf = empty
      ? new PixelBuffer(front.buf.w * d, front.buf.h * d)
      : sc.cutFront(out, xf, !nearBack, !!pose.low, body, [body.ox - front.ox, body.oy - front.oy, front.buf.w, front.buf.h]).buf;
    res.front = { buf, ox: front.ox, oy: front.oy, pts: front.pts, density: d };
  }
  return res;
}

/** Back to front (look.md §7). */
function drawParts(sc: SwanCanvas, xf: Xf, pose: BodyPose, style: SwanStyle, nearBack: boolean): void {
  drawWingHd(sc, xf, pose.wingF, true, style, Z.farWing);
  if (nearBack) drawWingHd(sc, xf, pose.wingN, false, style, Z.backWing);
  if (pose.legs === 'T') drawToesHd(sc, xf, pose.toes ?? 'front');
  else drawLegHd(sc, xf, pose, true, style);
  drawTailHd(sc, xf, pose);
  drawHullHd(sc, xf, pose);
  if (!pose.bare) {
    drawPadHd(sc, xf);
    drawHandlesHd(sc, xf, pose.handles === 'fold');
  }
  if (pose.legs !== 'T') drawLegHd(sc, xf, pose, false, style);
  if (!nearBack) {
    drawWingHd(sc, xf, pose.wingN, false, style, Z.nearWing);
    // The near wing throws a 2 px shadow on the hull right under it.
    sc.castDown(OWN.nearWing, OWN.hull, 2, -0.3);
  }
  const socket: V = pose.neckFrom ? [pose.neckFrom[0], pose.neckFrom[1]] : xf.pt(REST.neck);
  if (pose.neck) drawNeckHd(sc, socket, pose.neck, style.colour);
  else if (pose.rider) drawCollarHd(sc, socket, unit(xf.dir(0.92, -0.39)));
}

// ------------------------------------------------------------------------------------ blades

interface BladeOpts {
  mat: number;
  /** Tip band material (navy / steel) and its length from the blade's end point. */
  tipMat?: number;
  tipLen?: number;
  part: number;
  z: number;
  tone?: number;
  /** Tip shape: 1 = round, < 1 = a little pointed (feathers). */
  point?: number;
  /** Tip length past the end point, in tip radii (default 1: the 1× round cap). */
  tipK?: number;
}

/**
 * A stamped feather plate from a to b (diameters w0 → w1): a shallow ridge across with rolled
 * edges, the tip rolled away, a pressed quill at 4×, the tip band in `tipMat`.
 */
function blade(sc: SwanCanvas, bl: Blade, o: BladeOpts): void {
  const A = sc.T(bl.a);
  const B = sc.T(bl.b);
  let tx = B[0] - A[0];
  let ty = B[1] - A[1];
  const L = Math.hypot(tx, ty) || 1e-6;
  tx /= L;
  ty /= L;
  const nx = -ty;
  const ny = tx;
  const r0 = bl.w0 / 2;
  const r1 = bl.w1 / 2;
  const tipL = r1 * (o.tipK ?? 1);
  const point = o.point ?? 0.85;
  const tipAt = L - (o.tipLen ?? 0);
  const d = sc.d;
  const pad = Math.max(r0, r1) + tipL + 0.5;
  const rm = Math.max(r0, r1) * Math.max(r0, r1);
  sc.c.plane(Math.min(A[0], B[0]) - pad, Math.min(A[1], B[1]) - pad, Math.abs(B[0] - A[0]) + 2 * pad, Math.abs(B[1] - A[1]) + 2 * pad, {
    mat: o.mat,
    part: o.part,
    z: o.z,
    tone: o.tone ?? 0,
    // Cheap reject: px farther than the widest radius from the axis segment.
    mask: (x, y) => {
      const px = x - A[0];
      const py = y - A[1];
      let u = px * tx + py * ty;
      u = u < -r0 ? -r0 : u > L + tipL ? L + tipL : u;
      const ex = px - tx * u;
      const ey = py - ty * u;
      return ex * ex + ey * ey < rm;
    },
    tex: (s) => {
      const px = s.x - A[0];
      const py = s.y - A[1];
      const u = px * tx + py * ty;
      const v = px * nx + py * ny;
      let hw: number;
      if (u < 0) {
        const q = -u / r0;
        if (q >= 1) {
          s.cut = true;
          return;
        }
        hw = r0 * Math.sqrt(1 - q * q);
      } else if (u > L) {
        const q = (u - L) / tipL;
        if (q >= 1) {
          s.cut = true;
          return;
        }
        hw = r1 * Math.pow(1 - q * q, point);
      } else hw = r0 + ((r1 - r0) * u) / L;
      const av = Math.abs(v);
      if (av >= hw) {
        s.cut = true;
        return;
      }
      const vn = v / hw;
      const avn = av / hw;
      // Two flat vanes meeting at the quill (a shallow roof), the edges rolled.
      const across = Math.sign(vn) * 0.24 * Math.min(1, avn * 5) + (avn > 0.78 ? Math.sign(vn) * (avn - 0.78) * 3.2 : 0);
      const along = u > L - 0.6 ? ((u - (L - 0.6)) / (tipL + 0.6)) * 1.1 : u < 0.4 ? (u - 0.4) * 0.5 : 0;
      setNormal(s, nx * across + tx * along, ny * across + ty * along, 1);
      if (o.tipMat !== undefined && u >= tipAt) s.mat = o.tipMat;
      else if (d >= 4 && av < 0.2 && u > 1 && u < tipAt - 0.6) s.tone -= 0.16;
    },
  });
}

// ------------------------------------------------------------------------------------ wings

function drawWingHd(sc: SwanCanvas, xf: Xf, w: BodyPose['wingN'], far: boolean, style: SwanStyle, z0: number): void {
  const parts = wingParts(xf, w, far);
  const owner = far ? OWN.farWing : OWN.nearWing;
  const en = sc.mat('enamel', far);
  const tipMat = sc.mat(style.colour === 'mute' ? 'steel' : 'navy', far);
  const tone = far ? -0.08 : 0;
  let z = z0;
  for (const b of parts.prim) {
    blade(sc, b, { mat: en, tipMat, tipLen: 2.5, part: sc.part(owner), z, tone });
    z += 8;
  }
  for (const b of parts.sec) {
    blade(sc, b, { mat: en, part: sc.part(owner), z, tone, point: 1.5, tipK: 1.15 });
    z += 8;
  }
  const gold = sc.mat('gold', far);
  const rivets = parts.rivets.map((p) => sc.T(p));
  sc.blob(parts.plate, 0.5, 1.7, { mat: en, part: sc.part(owner), z, tone, bulge: 0.22, tex: rivetTex(rivets, gold, 0.55) });
}

/** Gold rivets (domes with a shadow down right) on a part. */
function rivetTex(rivets: ReadonlyArray<readonly [number, number]>, gold: number, r: number): Texture {
  return (s) => {
    for (const [x, y] of rivets) {
      if (stud(s, s.x - x, s.y - y, r, gold)) return;
      const ex = s.x - x - r * 0.75;
      const ey = s.y - y - r * 0.75;
      if (ex * ex + ey * ey < r * r * 1.1) s.tone -= 0.32;
    }
  };
}

// ------------------------------------------------------------------------------------ tail

function drawTailHd(sc: SwanCanvas, xf: Xf, pose: BodyPose): void {
  const parts = tailParts(xf, pose);
  parts.blades.forEach((b, i) => {
    blade(sc, b, { mat: sc.mat('enamel', i === 0), part: sc.part(OWN.tail), z: Z.tail + 8 * i, tone: i === 0 ? -0.08 : 0, point: 0.7 });
  });
  sc.blob(parts.fin, 0.5, 0.7, { mat: sc.mat('navy'), part: sc.part(OWN.tail), z: Z.tail + 30, bulge: 0.15 });
}

// ------------------------------------------------------------------------------------ hull

/** The bow "3" (navy stencil strokes, rest space). */
const THREE: ReadonlyArray<readonly [number, number, number, number]> = [
  [16, -39, 18, -39],
  [17, -37, 18, -37],
  [16, -35, 18, -35],
  [18, -39, 18, -35],
];

/** Panel seams (rest x, y from, y to). */
const SEAMS: ReadonlyArray<readonly [number, number, number]> = [
  [15, -44.5, -34.5],
  [-14, -47.5, -34.5],
];

function drawHullHd(sc: SwanCanvas, xf: Xf, pose: BodyPose): void {
  const rest = growPoly(hullPoly(pose.breast ?? 0), 0.5);
  let top = Infinity;
  let bot = -Infinity;
  for (const p of rest) {
    top = Math.min(top, p[1]);
    bot = Math.max(bot, p[1]);
  }
  const yc = (top + bot) / 2;
  const hy = (bot - top) / 2;
  // The row extent of the hull at rest y (for the rolls of the breast and the stern).
  const span = (ry: number): [number, number] => {
    let x0 = Infinity;
    let x1 = -Infinity;
    for (let i = 0, j = rest.length - 1; i < rest.length; j = i++) {
      const [ax, ay] = rest[j];
      const [bx, by] = rest[i];
      if (ay > ry !== by > ry) {
        const x = ax + ((bx - ax) * (ry - ay)) / (by - ay);
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
      }
    }
    return [x0, x1];
  };
  const roll = (e: number, r: number): number => (e >= r ? 1 : e <= 0 ? 0 : Math.sqrt(1 - (1 - e / r) * (1 - e / r)));
  const enamel = sc.mat('enamel');
  const navy = sc.mat('navy');
  const gold = sc.mat('gold');
  const rivets: Array<readonly [number, number]> = [];
  for (let x = -20; x <= 10; x += 5) rivets.push(sc.T(xf.p(x, -32)));
  const rivet = rivetTex(rivets, gold, 0.55);
  const vents = [7, 11].map((x) => sc.T(xf.p(x, -37)));
  const d = sc.d;
  const b: V = [0, 0];
  sc.field(
    rest.map((p) => xf.pt(p)),
    0.5,
    (bx, by) => {
      const r = xf.inv(bx, by);
      if (!inPoly(r[0], r[1], rest)) return NaN;
      const [x0, x1] = span(r[1]);
      const t = Math.min(1, Math.abs((r[1] - yc) / hy));
      const cyl = Math.sqrt(1 - t * t);
      return 7 * cyl * roll(x1 - r[0], 6.5) * roll(r[0] - x0, 3.5);
    },
    {
      mat: enamel,
      part: sc.part(OWN.hull),
      z: Z.hull,
      tone: -0.1,
      tex: (s: TexSample) => {
        sc.body(s, b);
        const [rx, ry] = xf.inv(b[0], b[1]);
        // Weight: the belly under the stripe a little darker.
        if (ry > -32.5) s.tone -= 0.1;
        // The navy waterline stripe.
        if (ry >= -34.5 && ry < -32.5) s.mat = navy;
        // Panel seams: a dark groove, its lit right wall.
        for (const [sx, y0, y1] of SEAMS) {
          if (ry < y0 || ry > y1) continue;
          const e = rx - sx;
          if (Math.abs(e) < 0.24) s.tone -= 0.55;
          else if (e >= 0.24 && e < 0.6) s.tone += 0.2;
        }
        // The bow "3".
        if (rx > 15.3 && rx < 18.7 && ry > -39.7 && ry < -34.3) {
          for (const [ax, ay, bx2, by2] of THREE) {
            if (segDist(rx, ry, ax, ay, bx2, by2) < 0.52) {
              s.mat = navy;
              break;
            }
          }
        }
        // Two flush jet vents: a lit lip round a dark port with a glint.
        for (const [vx, vy] of vents) {
          const ex = s.x - vx;
          const ey = s.y - vy;
          const q = Math.hypot(ex, ey);
          if (q >= 1.6) continue;
          if (q < 0.72) {
            const gx = ex + 0.28;
            const gy = ey + 0.28;
            s.fix = d >= 4 && gx * gx + gy * gy < 0.05 ? PAL_HD.steel[5] : q < 0.5 ? PAL_HD.ink[0] : PAL_HD.navy[0];
            return;
          }
          s.mat = navy;
          const w = (q - 1.16) / 0.44;
          setNormal(s, (ex / q) * w * 0.9, (ey / q) * w * 0.9, 1);
          return;
        }
        rivet(s);
      },
    },
  );
  // The smoke grille on the rump deck: a steel plate with three dark slots.
  const g0 = xf.p(-21, -49);
  const g1 = xf.p(-19, -49);
  const G0 = sc.T(g0);
  const slots = [-21, -20, -19].map((x) => sc.T(xf.p(x, -49)));
  sc.capsule(g0, g1, 0.62, 0.62, {
    mat: sc.mat('steel'),
    part: sc.part(OWN.hull),
    z: Z.hull + 8,
    round: 0.6,
    tex: (s) => {
      for (const [x, y] of slots) if (Math.abs(s.x - x) < 0.2 && Math.abs(s.y - y) < 0.36 && s.x > G0[0] - 0.1) s.tone -= 0.6;
    },
  });
}

// ------------------------------------------------------------------------------------ pad, handles

function drawPadHd(sc: SwanCanvas, xf: Xf): void {
  const gold = sc.mat('gold');
  const tufts = [-9, -5, -1].map((x) => sc.T(xf.p(x, -50)));
  const studs = [-8, -4, 0].map((x) => sc.T(xf.p(x, -49)));
  const d = sc.d;
  const b: V = [0, 0];
  sc.blob(xf.all([[-11, -50], [1, -50], [1, -49], [-11, -49]]), 0.5, 0.9, {
    mat: sc.mat('navy'),
    part: sc.part(OWN.pad),
    z: Z.pad,
    bulge: 0.35,
    tex: (s) => {
      for (const [x, y] of studs) {
        if (stud(s, s.x - x, s.y - y, 0.5, gold)) return;
      }
      for (const [x, y] of tufts) {
        const ex = s.x - x;
        const ey = s.y - y;
        const q = ex * ex + ey * ey;
        if (q < 0.2) s.tone -= 0.4;
        else if (q < 0.42 && ex + ey > 0) s.tone += 0.2;
      }
      if (d >= 4) {
        sc.body(s, b);
        const [rx, ry] = xf.inv(b[0], b[1]);
        if (Math.abs(ry + 49.5) < 0.12 && (Math.floor(rx * 2) & 1) === 0) s.tone -= 0.25;
      }
    },
  });
}

function drawHandlesHd(sc: SwanCanvas, xf: Xf, folded: boolean): void {
  for (const far of [true, false]) {
    const sx = far ? 6 : 4;
    const z = Z.handle + (far ? 0 : 10);
    const tone = far ? -0.1 : 0;
    if (folded) sc.capsule(xf.p(sx, -48), xf.p(sx + 2, -48), 0.55, 0.55, { mat: sc.mat('gold', far), part: sc.part(OWN.handle), z, tone });
    else sc.capsule(xf.p(sx, -48), xf.p(sx, -51), 0.55, 0.55, { mat: sc.mat('gold', far), part: sc.part(OWN.handle), z, tone });
    const grip = { mat: sc.mat('grip', far), part: sc.part(OWN.handle), z: z + 4, tone, tex: gripTex(sc) };
    if (folded) sc.ellipsoid(xf.p(sx + 3.5, -47.5), 1.05, 1.05, grip);
    else sc.capsule(xf.p(sx + 0.5, -53.5), xf.p(sx + 0.5, -52.5), 1.05, 1.05, grip);
  }
}

/** Ribbed rubber at 4×. */
function gripTex(sc: SwanCanvas): Texture | null {
  if (sc.d < 4) return null;
  return (s) => {
    if ((Math.floor(s.y * 4) & 1) === 0) s.tone -= 0.18;
  };
}

// ------------------------------------------------------------------------------------ legs

function drawLegHd(sc: SwanCanvas, xf: Xf, pose: BodyPose, far: boolean, style: SwanStyle): void {
  const { foot, H, J, F, m, ang } = legParts(xf, pose, far, style);
  const owner = far ? OWN.farLeg : OWN.nearLeg;
  const z0 = far ? Z.farLeg : Z.nearLeg;
  const steel = sc.mat('steel', far);
  const tone = far ? -0.1 : 0;
  // Drumstick (5 → 4), the sleeve (4) with the chrome piston rod (2) sliding out of it.
  sc.capsule(H, J, 2.5, 2.05, { mat: steel, part: sc.part(owner), z: z0, tone });
  sc.capsule(m, F, 1.0, 1.0, { mat: sc.mat('rod', far), part: sc.part(owner), z: z0 + 6, tone });
  sc.capsule(J, m, 2.05, 1.9, { mat: steel, part: sc.part(owner), z: z0 + 8, tone, tex: sleeveTex(sc, J, m) });
  drawPaddleHd(sc, F, foot.s, ang, far, style, owner, z0 + 16);
  // The joint bolt: a steel disc with a gold cap.
  const gold = sc.mat('gold', far);
  const Jc = sc.T(J);
  const cap = rivetTex([Jc], gold, 0.85);
  sc.ellipsoid(J, 2.45, 2.45, { mat: steel, part: sc.part(owner), z: z0 + 24, tone, round: 0, tex: discTex(Jc, 2.45, cap) });
  if (!far) {
    // The hip bearing: a steel disc (r 3) with a gold hex bolt.
    const Hc = sc.T(H);
    sc.ellipsoid(H, 3.45, 3.45, { mat: steel, part: sc.part(owner), z: z0 + 32, round: 0, tex: discTex(Hc, 3.45, hexBolt(Hc, gold, 1.3)) });
  }
}

/** A bearing disc: a flat face with a turned groove, the rim bevelled round; `inner` paints its centre. */
function discTex(c: readonly [number, number], R: number, inner: Texture): Texture {
  return (s) => {
    const dx = s.x - c[0];
    const dy = s.y - c[1];
    const q = Math.hypot(dx, dy) / R;
    if (q > 0.7) {
      const k = ((q - 0.7) / 0.3) * 1.5;
      setNormal(s, (dx / (q * R)) * k, (dy / (q * R)) * k, 1);
      return;
    }
    setNormal(s, -dx * 0.05, -dy * 0.05, 1);
    if (q > 0.58) s.tone -= 0.28;
    inner(s);
  };
}

/** The sleeve's end ring (a darker band where the rod comes out) at 4×. */
function sleeveTex(sc: SwanCanvas, J: Pt, m: Pt): Texture | null {
  const A = sc.T(J);
  const B = sc.T(m);
  const L = Math.hypot(B[0] - A[0], B[1] - A[1]) || 1;
  const tx = (B[0] - A[0]) / L;
  const ty = (B[1] - A[1]) / L;
  return (s) => {
    const u = (s.x - A[0]) * tx + (s.y - A[1]) * ty;
    if (u > L - 0.55 && u < L - 0.15) s.tone -= 0.3;
  };
}

/** A gold hex bolt head (facets lit from the upper left) with its shadow, on a bearing. */
function hexBolt(c: readonly [number, number], gold: number, r: number): Texture {
  return (s) => {
    const dx = s.x - c[0];
    const dy = s.y - c[1];
    // Hexagon (flat top): the largest projection on the three facet axes.
    let best = 0;
    let fx = 0;
    let fy = 0;
    for (let k = 0; k < 6; k++) {
      const a = (k * Math.PI) / 3 + Math.PI / 6;
      const ax = Math.cos(a);
      const ay = Math.sin(a);
      const p = dx * ax + dy * ay;
      if (p > best) {
        best = p;
        fx = ax;
        fy = ay;
      }
    }
    if (best < r * 0.87) {
      s.mat = gold;
      const edge = best / (r * 0.87);
      if (edge > 0.55) setNormal(s, fx * 0.75, fy * 0.75, 1);
      else setNormal(s, 0, 0, 1);
      s.tone = 0;
      return;
    }
    const ex = dx - r * 0.55;
    const ey = dy - r * 0.55;
    if (ex * ex + ey * ey < r * r * 0.8) s.tone -= 0.3;
  };
}

/** Toe grooves of the spread paddle (foot space). */
const RIDGES: ReadonlyArray<readonly [Pt, Pt]> = [
  [[1, 1], [6, -1]],
  [[1, 1], [7, 1]],
];

function drawPaddleHd(sc: SwanCanvas, F: Pt, state: FootState, ang: number, far: boolean, style: SwanStyle, owner: number, z: number): void {
  const shape = paddleShape(state, style);
  const map = (p: Pt): V => add(F, rot(p, ang));
  const spread = shape === PADDLE_SPREAD;
  const ridges = spread ? RIDGES.map(([a, b]) => [sc.T(map(a)), sc.T(map(b))] as const) : [];
  const d = sc.d;
  const part = sc.part(owner);
  sc.blob(shape.map(map), 0.5, 0.75, {
    mat: sc.mat('orange', far),
    part,
    z,
    tone: far ? -0.1 : 0,
    bulge: 0.12,
    tex: spread
      ? (s) => {
          for (const [[ax, ay], [bx, by]] of ridges) {
            const e = segDist(s.x, s.y, ax, ay, bx, by);
            if (e < 0.24) {
              s.tone -= 0.5;
              return;
            }
            // The groove's lit lower wall.
            if (d >= 4 && e < 0.5 && (bx - ax) * (s.y - ay) - (by - ay) * (s.x - ax) > 0) s.tone += 0.15;
          }
        }
      : null,
  });
  if (spread) {
    for (const c of [[8, -1], [9, 1]] as const) sc.ellipsoid(map(c), 0.62, 0.62, { mat: sc.mat('steel', far), part: sc.part(owner), z: z + 2, tone: far ? -0.15 : 0 });
  }
}

/** Stowed legs (mode T): the near paddle's toe tips under the breast (or the stern), behind the hull. */
function drawToesHd(sc: SwanCanvas, xf: Xf, where: 'front' | 'back' | 'none'): void {
  if (where === 'none') return;
  const x0 = where === 'back' ? -21 : 15;
  sc.blob(xf.all([[x0, -31], [x0 + 4, -31], [x0 + 4, -30], [x0, -30]]), 0.5, 0.6, { mat: sc.mat('orange'), part: sc.part(OWN.nearLeg), z: Z.farLeg, bulge: 0.1 });
}

// ------------------------------------------------------------------------------------ marks

/** Paint one logical mark into empty art px: rounded at 4×, its lower edge one tone down. */
function mark(out: PixelBuffer, d: D, x: number, y: number, c: Color, under: Color): void {
  for (let j = 0; j < d; j++) {
    for (let i = 0; i < d; i++) {
      if (d >= 4 && (i === 0 || i === d - 1) && (j === 0 || j === d - 1)) continue;
      const X = x * d + i;
      const Y = y * d + j;
      if (X < 0 || Y < 0 || X >= out.w || Y >= out.h) continue;
      const k = Y * out.w + X;
      if ((out.data[k] & 255) !== 0) continue;
      out.data[k] = j === d - 1 ? under : c;
    }
  }
}

/** Foam at the hull on the surface, a bow wave, two wake dashes (look.md §5.8; the 1× marks). */
function waterMarksHd(out: PixelBuffer, sc: SwanCanvas, alt: boolean): void {
  const d = sc.d;
  const bw = out.w / d;
  const row = SURFACE - 1 + Math.round(sc.oy - 0.5);
  if (row < 0 || row >= out.h / d) return;
  let x0 = -1;
  let x1 = -1;
  for (let Y = (row + 1) * d; Y < Math.min(out.h, (row + 2) * d); Y++) {
    for (let X = 0; X < out.w; X++) {
      if ((out.data[Y * out.w + X] & 255) === 0) continue;
      const x = Math.floor(X / d);
      if (x0 < 0 || x < x0) x0 = x;
      if (x > x1) x1 = x;
    }
  }
  if (x0 < 0) return;
  const foam = PAL_HD.snow[6];
  const foamU = PAL_HD.sky[6];
  const spray = PAL_HD.sky[5];
  const sprayU = PAL_HD.sky[4];
  const put = (x: number, y: number, isFoam: boolean): void => {
    if (x < 0 || x >= bw) return;
    mark(out, d, x, y, isFoam ? foam : spray, isFoam ? foamU : sprayU);
  };
  for (let k = 1; k <= 2; k++) {
    put(x0 - k, row, k === 1);
    put(x1 + k, row, k === 1);
  }
  put(x1 + 3, row, true);
  put(x1 + 1, row - 1, !alt);
  put(x1 + 2, row - 1, alt);
  if (alt) put(x1 + 3, row - 2, false);
  else put(x1 + 4, row, false);
  const dash = (x: number, l: number): void => {
    for (let i = 0; i < l; i++) put(x - i, row, i === 0);
  };
  dash(x0 - (alt ? 5 : 4), 3);
  dash(x0 - (alt ? 10 : 11), 2);
  out.touch();
}

/** Sparks under the keel (belly slide): hot heads with short streaks trailing back. */
function sparkMarksHd(out: PixelBuffer, sc: SwanCanvas, alt: boolean): void {
  const d = sc.d;
  const ox = Math.round(sc.ox - 0.5);
  const y = Math.round(sc.oy - 0.5) - 1;
  const F = PAL_HD.fire;
  const G = PAL_HD.gold;
  const pts: ReadonlyArray<readonly [number, number, Color]> = alt
    ? [[-16, 0, G[7]], [-19, -1, F[6]], [-22, -2, G[6]], [-12, -1, F[7]]]
    : [[-14, -1, G[7]], [-18, 0, F[7]], [-21, -1, F[6]], [-24, -3, G[6]]];
  const set = (X: number, Y: number, c: Color): void => {
    if (X < 0 || Y < 0 || X >= out.w || Y >= out.h) return;
    const k = Y * out.w + X;
    if ((out.data[k] & 255) === 0) out.data[k] = c;
  };
  for (const [dx, dy, c] of pts) {
    const X = (ox + dx) * d;
    const Y = (y + dy) * d + (d >> 1);
    // The head (a ½ px spark), the streak trailing back along the keel, cooling.
    for (let j = 0; j < Math.max(1, d >> 1); j++) for (let i = 0; i < Math.max(1, d >> 1); i++) set(X + i, Y + j - (d >> 2), c);
    for (let i = 1; i <= d + (d >> 1); i++) set(X - i, Y, i < d ? F[6] : F[5]);
  }
  out.touch();
}
