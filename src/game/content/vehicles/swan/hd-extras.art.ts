/**
 * SWAN-3 UHD art, part 4: the small extras at 2× / 4× (look.md §10.10, §12.3, §16 item 5), each
 * drawn natively in its 1× frame's rectangle with the 1× anchor.
 *
 * - `scuffFramesHd`: the damage decal on the hull point: dents (a concave crease, lit from the
 *   upper left: a dark upper wall, a lit lower lip), bullet holes (a dark pit, the lit burr up left,
 *   a torn petal down right), scorch smudges (soot clusters, no noise) and the lifted panel corner.
 * - `eggFramesHd`: the nervous egg (enamel, a gold rivet band, the navy "3"; wobble, crack, lid,
 *   steam).
 * - `tinFeatherFramesHd`: the stamped tin feather plate (two vanes, navy tip, gold quill rivet),
 *   turning rigidly through edge-on.
 * - `beakFlashFramesHd`: the round beak flash (white-hot core, gold body, orange rim, short rays;
 *   additive, no outline).
 */
import type { Color } from '../../../../engine/color';
import { PAL_HD } from '../../../../engine/palette-hd';
import type { Frame } from '../../../../engine/render';
import { HdCanvas, inPoly, polyDist } from '../../../art/hd/index';
import { DENTS, HOLES, HULL, PANEL, SCORCH, eggOutline } from './extras.art';
import { type D, SwanCanvas, growPoly, segDist, setNormal, stud } from './hd-kit.art';
import type { Pt } from './kit.art';
import { OWN, rot } from './kit.art';

// ------------------------------------------------------------------------------------ scuffs

/** A cheap deterministic hash in 0..1 (ragged soot edges). */
function hash(x: number, y: number): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * The damage decal in the 1× decal frames' rectangles (`lo`, anchor = the hull point): frame 0
 * 3 dents and 2 holes, frame 1 all 6 dents, 4 holes, 2 scorch smudges and the lifted panel.
 */
export function scuffFramesHd(d: D, lo: readonly Frame[]): Frame[] {
  return lo.map((f, level) => {
    const nDent = level === 0 ? 3 : 6;
    const nHole = level === 0 ? 2 : 4;
    const c = new HdCanvas(f.buf.w, f.buf.h, d);
    // Rest point p → canvas logical (the 1× put: round(p − HULL) + anchor, pixel centres).
    const at = (p: Pt): [number, number] => [Math.round(p[0] - HULL[0]) + f.ox + 0.5, Math.round(p[1] - HULL[1]) + f.oy + 0.5];
    const snow = c.material({ ramp: PAL_HD.snow, lo: 1, hi: 6, wrap: 0, gain: 1.2, amb: 0.1, spec: 0.4, shine: 30 });
    const steel = c.material({ ramp: PAL_HD.steel, lo: 1, hi: 6, spec: 0.8, shine: 20 });
    if (level === 1) {
      // Soot first (fixed colours in clusters): a dark core, a grey rim with a ragged edge.
      for (const p of SCORCH) {
        const [x, y] = at(p);
        c.paint(x - 4, y - 2, 8, 4, (px, py, X, Y) => {
          const e = Math.abs(px - x) / 3.4 + Math.abs(py - y) / 1.5;
          const rag = hash(X >> (d >> 1), Y >> (d >> 1)) * 0.25;
          if (e > 1 - rag * 0.6) return 0;
          return e < 0.45 ? PAL_HD.ink[1] : e < 0.75 ? PAL_HD.steel[1] : PAL_HD.steel[3];
        });
      }
    }
    for (let i = 0; i < nDent; i++) {
      const [x, y] = at(DENTS[i]);
      // A crease 3 px long: a concave trough (dark upper wall, lit lower lip), only where it dips.
      c.heightField(x - 2, y - 1, 4, 2.6, (px, py) => {
        const u = (px - x) / 1.9;
        const v = (py - y - 0.3) / 0.95;
        const q = u * u + v * v;
        if (q >= 1) return NaN;
        return -0.9 * (1 - q);
      }, { mat: snow, part: c.newPart() });
    }
    for (let i = 0; i < nHole; i++) {
      const [x, y] = at(HOLES[i]);
      const cx = x + 0.5;
      const cy = y + 0.5;
      // The lit burr up left, the pit, the torn petal bent out down right.
      c.heightField(cx - 2, cy - 2, 4.2, 4.2, (px, py) => {
        const r = Math.hypot(px - cx, py - cy);
        if (r > 1.75) return NaN;
        const ang = Math.atan2(py - cy, px - cx);
        const petal = ang > 0 && ang < 1.4 ? 1 : 0;
        if (r > 1.25 && !petal) return NaN;
        return r < 0.7 ? -1 : 0.5 * (1 - Math.abs(r - 1.1) / 0.6);
      }, {
        mat: steel,
        part: c.newPart(),
        tex: (s) => {
          const r = Math.hypot(s.x - cx, s.y - cy);
          if (r < 0.7) s.fix = r < 0.45 || s.x + s.y > cx + cy ? PAL_HD.ink[0] : PAL_HD.steel[1];
          else if (s.x + s.y < cx + cy - 0.6) s.mat = snow;
        },
      });
    }
    if (level === 1) {
      // The lifted panel corner: a bent-up lit edge, the dark gap it opens, its shadow.
      const [x, y] = at(PANEL);
      c.paint(x - 0.6, y - 1.6, 4.4, 3.2, (px, py) => {
        const ex = px - x + 0.5;
        const ey = py - y + 0.5;
        if (ey < -1 || ey > 1.5 || ex < -0.1 || ex > 3.8) return 0;
        if (ey < -0.5) return ex < 2.6 ? (ex < 1.6 ? PAL_HD.snow[6] : PAL_HD.snow[5]) : 0;
        if (ey < 0) return ex < 0.6 ? PAL_HD.snow[4] : ex < 3 ? PAL_HD.snow[2] : PAL_HD.steel[4];
        if (ey < 0.5) return ex < 0.6 ? PAL_HD.snow[3] : ex < 3.2 ? PAL_HD.ink[0] : PAL_HD.steel[3];
        if (ey < 1) return ex < 0.5 ? PAL_HD.ink[0] : ex < 1.8 ? PAL_HD.steel[3] : 0;
        return 0;
      });
    }
    return { buf: c.render({ outline: 'none', sep: false, ao: 0 }), ox: f.ox, oy: f.oy, density: d };
  });
}

// ------------------------------------------------------------------------------------ egg

const THREE_EGG: ReadonlyArray<readonly [number, number, number, number]> = [
  [-1, -4, 0, -4],
  [0, -4, 0, -2],
  [-0.5, -3, 0, -3],
  [-1, -2, 0, -2],
];

const ZIG: ReadonlyArray<readonly [number, number]> = [[-3.6, -5], [-2.6, -4.2], [-1.6, -5.4], [-0.6, -4.3], [0.4, -5.3], [1.4, -4.4], [2.6, -5]];
const ZIG_BRANCH: ReadonlyArray<readonly [number, number]> = [[0.4, -5.3], [0.9, -3.4]];

/** The nervous egg in the 1× egg frames' rectangles (feet anchor). */
export function eggFramesHd(d: D, lo: readonly Frame[]): Frame[] {
  const shape = eggOutline(28);
  return lo.map((f, i) => {
    const sc = new SwanCanvas(f.buf.w, f.buf.h, d, f.ox, f.oy);
    const tilt = i === 1 ? 10 : 0;
    const T = (q: Pt): [number, number] => {
      const r = rot(q, tilt);
      return [r[0], r[1]];
    };
    const lid = i === 3 ? -3 : 0;
    const enamel = sc.mat('enamel');
    const navy = sc.mat('navy');
    const gold = sc.mat('gold');
    const shell = (pts: readonly Pt[], dy: number, z: number, owner: number, cutY: (y: number) => boolean): void => {
      const body = growPoly(pts.map((q) => T([q[0], q[1] + dy])), 0.45);
      const canvas = body.map((p) => sc.T(p));
      const rivets: Array<readonly [number, number]> = [];
      for (let x = -3; x <= 2; x += 2) rivets.push(sc.T(T([x, -6 + lid])));
      const band = sc.T(T([0, -6 + lid]));
      sc.field(body, 0.5, (bx, by) => {
        const X = bx + sc.ox;
        const Y = by + sc.oy;
        if (!inPoly(X, Y, canvas)) return NaN;
        const e = Math.min(1, polyDist(X, Y, canvas) / 3.4);
        return 3.4 * Math.sqrt(1 - (1 - e) * (1 - e));
      }, {
        mat: enamel,
        part: sc.part(owner),
        z,
        tex: (s) => {
          const b = rot([s.x - sc.ox, s.y - sc.oy], -tilt);
          if (cutY(b[1])) {
            s.cut = true;
            return;
          }
          // The gold rivet band round the middle (it rides up with the lid).
          if (Math.abs(b[1] - (-6 + lid)) < 0.55) {
            s.mat = gold;
            for (const [rx, ry] of rivets) if (stud(s, s.x - rx, s.y - ry, 0.5, gold)) return;
            setNormal(s, s.nx, (s.y - band[1]) * 0.9, 1);
            return;
          }
          if (i < 3) {
            for (const [ax, ay, bx2, by2] of THREE_EGG) {
              if (segDist(b[0], b[1], ax, ay, bx2, by2) < 0.42) {
                s.mat = navy;
                break;
              }
            }
          }
        },
      });
    };
    if (i === 3) {
      shell(shape, 0, 0, OWN.hull, (y) => y < -5.6);
      shell(shape, lid, 10, OWN.head, (y) => y > -5.4 + lid);
    } else shell(shape, 0, 0, OWN.hull, () => false);
    if (i === 2) {
      // The crack: an ink zigzag along the band, with a branch.
      const zig = ZIG.map((p) => sc.T(T(p)));
      const br = ZIG_BRANCH.map((p) => sc.T(T(p)));
      const w = Math.max(0.26, 0.6 / d);
      sc.c.paint(zig[0][0] - 1, zig[0][1] - 2, 8, 4, (x, y) => (lineDist(x, y, zig) < w || lineDist(x, y, br) < w * 0.8 ? PAL_HD.ink[0] : 0), 1e6);
      erasePaintOutside(sc);
    }
    if (i === 3) {
      // A wisp of steam curling out of the open egg (white, its lower edge sky).
      const curl: Array<[number, number]> = [];
      for (let k = 0; k <= 12; k++) {
        const t = k / 12;
        curl.push(sc.T([-1 + Math.sin(t * 5) * 0.8 + t * 1.6, -8.5 - t * 3.6]));
      }
      sc.c.paint(curl[0][0] - 2, curl[12][1] - 1, 5, 6, (x, y) => {
        const e = lineDist(x, y, curl);
        return e < 0.38 ? PAL_HD.snow[6] : e < 0.6 && y > curl[6][1] ? PAL_HD.sky[6] : 0;
      });
    }
    return { buf: sc.render(), ox: f.ox, oy: f.oy, density: d };
  });
}

/** Painted px on empty canvas px are part of the silhouette: keep the crack on the shell only. */
function erasePaintOutside(sc: SwanCanvas): void {
  const { c } = sc;
  for (let i = 0; i < c.mat.length; i++) if (c.fix[i] !== 0 && c.part[i] === 0 && c.zb[i] >= 1e6) {
    c.mat[i] = 0;
    c.fix[i] = 0;
  }
}

/** Distance from (x, y) to a polyline. */
function lineDist(x: number, y: number, pts: ReadonlyArray<readonly [number, number]>): number {
  let best = Infinity;
  for (let i = 1; i < pts.length; i++) best = Math.min(best, segDist(x, y, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]));
  return best;
}

// ------------------------------------------------------------------------------------ fx

/**
 * `fx/tin-feather` in the 1× frames' rectangles (centre anchor): the stamped plate (two vanes, a
 * navy tip, the gold quill rivet), turning rigidly 0°, 50°, 95° (nearly edge-on), 140°.
 */
export function tinFeatherFramesHd(d: D, lo: readonly Frame[]): Frame[] {
  const angles = [0, 50, 95, 140];
  return lo.map((f, i) => {
    const deg = angles[i];
    const sc = new SwanCanvas(f.buf.w, f.buf.h, d, f.ox, f.oy);
    const depth = Math.max(0.5, Math.abs(Math.cos(((deg - 10) * Math.PI) / 180)) * 1.6);
    const half = depth / 2 + 0.45;
    const r = (deg * Math.PI) / 180;
    const ux = Math.cos(r);
    const uy = Math.sin(r);
    const [cx, cy] = sc.T([0, 0]);
    const enamel = sc.mat('enamel');
    const navy = sc.mat('navy');
    const gold = sc.mat('gold');
    const q = sc.T(rot([-2.2, 0], deg));
    // The face turns away from the viewer as the plate goes edge-on (darker, the glint gone).
    const face = depth / 1.6;
    sc.c.plane(cx - 4, cy - 4, 8, 8, {
      mat: enamel,
      part: sc.part(OWN.hull),
      tex: (s) => {
        const px = s.x - cx;
        const py = s.y - cy;
        const u = px * ux + py * uy;
        const v = -px * uy + py * ux;
        // Plate from the quill (u −3.1) to the tip (u 3.2): square back, a slanted tip.
        const hw = u > 2 ? half * Math.max(0, 1 - (u - 2) / 1.3) : half;
        if (u < -3.1 || u > 3.25 || Math.abs(v) > hw) {
          s.cut = true;
          return;
        }
        const vn = v / Math.max(0.3, half);
        setNormal(s, -uy * Math.sign(vn) * 0.3, ux * Math.sign(vn) * 0.3, face + 0.2);
        if (u > 1.7) s.mat = navy;
        else if (stud(s, s.x - q[0], s.y - q[1], 0.55, gold)) return;
        else if (d >= 4 && Math.abs(v) < 0.18 && u > -1.8 && u < 1.6) s.tone -= 0.18;
      },
    });
    return { buf: sc.render(), ox: f.ox, oy: f.oy, density: d };
  });
}

/**
 * `fx/muzzle-swan-beak-gun` / `vehicle/swan/beak-flash` in the 1× 7 × 7 box (centre anchor): f0 a
 * round flash (white-hot core, gold body, orange rim, short rays), f1 an ember. Drawn additive:
 * no outline.
 */
export function beakFlashFramesHd(d: D, lo: readonly Frame[]): Frame[] {
  const F = PAL_HD.fire;
  return lo.map((f, i) => {
    const c = new HdCanvas(f.buf.w, f.buf.h, d);
    const cx = f.ox + 0.5;
    const cy = f.oy + 0.5;
    c.paint(0, 0, f.buf.w, f.buf.h, (x, y): Color => {
      const dx = x - cx;
      const dy = y - cy;
      const r = Math.hypot(dx, dy);
      if (i === 1) return r < 0.55 ? F[6] : r < 1.05 ? F[5] : r < 1.6 ? F[4] : 0;
      // Eight rays (the four main ones longer), tapering.
      const a = Math.atan2(dy, dx);
      const k = Math.round((a / Math.PI) * 4);
      const off = Math.abs(a - (k * Math.PI) / 4) * r;
      const main = (k & 1) === 0;
      const len = main ? 3.4 : 2.7;
      if (r < 0.9) return F[7];
      if (r < 1.5) return F[6];
      if (r < 2.15) return F[5];
      if (r < 2.6) return F[4];
      if (r < len && off < (main ? 0.42 : 0.3) * (1 - (r - 2.6) / (len - 2.6) * 0.6)) return r < 3 ? F[5] : F[4];
      return 0;
    });
    return { buf: c.render({ outline: 'none', sep: false, ao: 0, clean: false }), ox: f.ox, oy: f.oy, density: d };
  });
}
