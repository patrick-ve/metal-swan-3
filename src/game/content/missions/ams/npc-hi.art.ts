/**
 * UHD ambient life of mission `ams` (docs/ART_GUIDE.md "UHD art"): ONE density-generic drawer
 * (d 2 and 4) per id for `npc/ams/ams-pigeons`, `npc/ams/ams-ducks`, `npc/ams/ams-tour-boat` and
 * `npc/ams/ams-window-waver/cat` (1× art in npc.art.ts) and their motion strips. Each frame is
 * painted natively with the UHD kit (HdCanvas, PAL_HD, outline A, rim light) in the 1× frame's
 * logical box and anchor:
 * - the pigeon: blue-grey plumage with scalloped feathers, two dark wing bars, primaries fanned in
 *   flight, the green-purple iridescent neck, a dark tail band, the white cere and the orange eye;
 * - the mallards: the drake's glossy green head, white collar, chestnut breast, grey flank, black
 *   curled stern and the white-edged blue speculum; the hen mottled brown with her eye stripe; a
 *   lit ripple ring with glints and a broken reflection under each;
 * - the tour boat: a riveted steel hull with its white band and lit rub rail, the curved glass roof
 *   with sky reflections, tourists behind the glazing, the wheelhouse window, a waving Dutch flag,
 *   and below the water line its broken reflection and the bow and stern foam (no outline);
 * - the window cat: ginger tabby fur with stripes, a cream muzzle, pink ears and nose, green slit
 *   eyes (shut on the blink), whiskers, the swishing tail — inside the HD sash window.
 *
 * Motion strips (docs/ART_GUIDE.md "Motion"; 1× and HD both defined here, drawn by ambient.ts):
 * `npc/ams/ams-pigeons/takeoff` (2: crouch with the wings half up, push off), `npc/ams/ams-ducks/paddle`
 * (8: 4 paddle phases per drake / hen; the HD bob moves in half-logical-px steps),
 * `npc/ams/ams-window-waver/cat-swish` (4: an eased tail swish with a slow blink),
 * `npc/ams/ams-window-waver/lean` (3: the person rises into the window),
 * `npc/ams/ams-tour-boat/turn` (2: `turnSquash` of the boat, played at the ends of its run).
 */
import type { Color } from '../../../../engine/color';
import { INK, PAL } from '../../../../engine/palette';
import { PAL_HD } from '../../../../engine/palette-hd';
import { PixelBuffer, type Ramp } from '../../../../engine/pixel';
import type { Frame } from '../../../../engine/render';
import { defineHdSprite, defineSprite, getFrames } from '../../../../engine/sprites';
import { BLACK_ONE_HUE, HdCanvas, inPoly, type Texture } from '../../../art/hd';
import { renderHuman, type Density, type HumanStyle, type Pose } from '../../../art/humanoid';
import { hash2, noise2 } from '../../../art/paint';
import { turnSquash } from '../../creatures/draw';
import { HD_RENDER, WAVER_STYLE, hdOf, windowDone, windowFrame, windowHd, type HdD } from './npc.art';

// ------------------------------------------------------------------------------------ helpers

/** Paint a fixed-colour segment `w` logical px wide (default one art px): eyes, whiskers, glints. */
function paintSeg(c: HdCanvas, x0: number, y0: number, x1: number, y1: number, col: Color, w = 0): void {
  const r = Math.max(w, 1 / c.d) / 2;
  const vx = x1 - x0;
  const vy = y1 - y0;
  const l2 = vx * vx + vy * vy || 1;
  c.paint(Math.min(x0, x1) - r - 0.01, Math.min(y0, y1) - r - 0.01, Math.abs(vx) + 2 * r + 0.02, Math.abs(vy) + 2 * r + 0.02, (x, y) => {
    const t = Math.max(0, Math.min(1, ((x - x0) * vx + (y - y0) * vy) / l2));
    return Math.hypot(x - x0 - vx * t, y - y0 - vy * t) <= r ? col : 0;
  });
}

/** Paint a fixed-colour ellipse (eyes, a glint). */
function paintDot(c: HdCanvas, cx: number, cy: number, rx: number, ry: number, col: Color): void {
  c.paint(cx - rx, cy - ry, rx * 2, ry * 2, (x, y) => (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1 ? col : 0));
}

/** Feathers as small overlapping scales (a soft dip at each scale's lower rim; finer at 4×). */
function scales(size: number, seed: number, amount = 0.18): Texture {
  return (s) => {
    const sz = s.d >= 4 ? size * 0.8 : size;
    const row = Math.floor(s.y / sz);
    const x = s.x / sz + (row & 1) * 0.5;
    const fx = x - Math.floor(x) - 0.5;
    const fy = s.y / sz - row;
    if (fy > 0.62 + fx * fx * 1.4) s.tone -= amount;
    s.tone += (hash2(Math.floor(x), row, seed) - 0.5) * 0.08;
  };
}

// ------------------------------------------------------------------------------------ pigeons

/** The pigeon's wing poses (polygons on the 1× grid, continuous coordinates). */
const WING_UP: ReadonlyArray<readonly [number, number]> = [[4, 5.6], [8.6, 5.5], [5.7, 0.4], [3.1, 1.2]];
const WING_DOWN: ReadonlyArray<readonly [number, number]> = [[4, 6.4], [8.6, 6.4], [6.7, 10.6], [3.2, 10.6]];
const WING_HALF: ReadonlyArray<readonly [number, number]> = [[4, 7], [8.6, 7], [7.6, 3.4], [3.2, 4.4]];

/**
 * One city pigeon at density d (14 × 12 logical, feet anchor 6, 10): f 0 stand, 1 peck, 2 step,
 * 3 wings up, 4 wings down, 5 crouch (the take-off: 1 logical px lower, wing half up), 6 push off.
 */
function pigeonHd(f: number, d: HdD): Frame {
  const c = new HdCanvas(14, 12, d);
  const fly = f === 3 || f === 4;
  const peck = f === 1;
  const lo = f === 5 ? 1 : 0;
  const plum = c.material({ ramp: PAL_HD.steel, lo: 2, hi: 6, wrap: 0.15, spec: 0.15, shine: 10 });
  const dark = c.material({ ramp: PAL_HD.steel, lo: 1, hi: 4, wrap: 0.1 });
  const neck = c.material({ ramp: PAL_HD.teal, lo: 1, hi: 4, spec: 0.9, shine: 16 });
  const neckP = c.material({ ramp: PAL_HD.purple, lo: 1, hi: 4, spec: 0.9, shine: 16 });
  const bill = c.material({ ramp: PAL_HD.stone, lo: 1, hi: 4, spec: 0.3 });
  const cere = c.material({ ramp: PAL_HD.snow, lo: 3, hi: 5 });
  const feet = c.material({ ramp: PAL_HD.pink, lo: 2, hi: 5, spec: 0.3 });
  // Tail with its dark tip band.
  c.blob([[1, 6.2 + lo], [5, 5.2 + lo], [5, 9 + lo], [1.3, 7.8 + lo]], 0.4, {
    mat: plum,
    z: 0,
    bulge: 0.1,
    tex: (s) => {
      if (s.x < 2.3) {
        s.mat = dark;
        s.tone -= 0.1;
      }
    },
  });
  // Body (the breast catches the light, the belly turns away).
  c.ellipsoid(6.5, 6.5 + lo, 3.5, 2.5, { mat: plum, z: 1, tex: scales(1.1, 3, 0.12) });
  // Neck: iridescent green over purple, then the darker head.
  const hx = (peck ? 10 : 9) + 0.5;
  const hy = (peck ? 7 : 3) + 0.5 + lo;
  c.capsule(8.2, 5.8 + lo, hx - 0.4, hy + 0.9, 1.25, 1.05, {
    mat: neck,
    z: 1.8,
    tex: (s) => {
      if (((s.x - 8) * 0.6 + (s.y - hy) * 0.8) > 1.5) s.mat = neckP;
    },
  });
  c.ellipsoid(hx, hy, 1.45, 1.35, { mat: dark, z: 3, tone: 0.12 });
  // Bill and the white cere at its base.
  c.capsule(hx + 1.5, hy + 0.15, hx + 2.5, hy + 0.35, 0.36, 0.3, { mat: bill, z: 4.6, round: 0.6 });
  c.ellipsoid(hx + 1.45, hy - 0.05, 0.38, 0.28, { mat: cere, z: 4.8, round: 0.5 });
  // Wing: fanned primaries in flight (and in the take-off), or folded on the side with two dark bars.
  if (f >= 3) {
    // Flight feathers: a fan of overlapping feathers from the shoulder (each its own part, so a
    // dark separation runs between them); coverts with the two bars over their roots.
    const fan = f === 3 || f === 6 ? WING_UP : f === 4 ? WING_DOWN : WING_HALF;
    const sh: readonly [number, number] = [(fan[0][0] + fan[1][0]) / 2 + 0.6, (fan[0][1] + fan[1][1]) / 2];
    const n = 5;
    for (let k = 0; k < n; k++) {
      const t = k / (n - 1);
      const tip: [number, number] = [fan[2][0] + (fan[3][0] - fan[2][0]) * t, fan[2][1] + (fan[3][1] - fan[2][1]) * t];
      const root: [number, number] = [sh[0] - t * 1.6, sh[1] + (fan === WING_DOWN ? -0.3 : 0.3) * t];
      c.capsule(root[0], root[1], tip[0], tip[1], 0.95, 0.5, {
        mat: plum,
        z: 3.6 + k * 0.12,
        tone: (f === 4 ? -0.12 : 0.08) - t * 0.12,
        tex: (s) => {
          if (Math.hypot(s.x - tip[0], s.y - tip[1]) < 1.3) s.mat = dark;
        },
      });
    }
    c.blob([fan[0], fan[1], [sh[0] - 0.4, sh[1] + (fan === WING_DOWN ? 1.6 : -1.6)]], 0.4, {
      mat: plum,
      z: 4.4,
      bulge: 0.15,
      tone: 0.1,
      tex: (s) => {
        if (Math.abs(Math.hypot(s.x - sh[0], s.y - sh[1]) - 1.5) < 0.22) s.mat = dark;
      },
    });
  } else {
    c.blob([[4.2, 5.5], [8.6, 5.7], [8.1, 7.6], [4, 7.9]], 0.6, {
      mat: plum,
      z: 3.6,
      bulge: 0.2,
      tone: 0.12,
      tex: (s) => {
        if (Math.abs(s.x - 6.4 + (s.y - 6.5) * 0.3) < 0.32 || Math.abs(s.x - 7.4 + (s.y - 6.5) * 0.3) < 0.28) s.mat = dark;
        if (s.x < 4.8) s.tone -= 0.15;
      },
    });
  }
  if (!fly) {
    const fx2 = f === 2 ? 8.5 : 7.5;
    for (const fx of [6.5, fx2]) c.capsule(fx, 8.7 + lo, fx + 0.2, 9.8, 0.32, 0.3, { mat: feet, z: 0.5 });
  }
  // The eye: an orange ring round a dark pupil.
  paintDot(c, hx + 0.35, hy - 0.25, 0.42, 0.42, PAL_HD.orange[4]);
  paintDot(c, hx + 0.38, hy - 0.25, 0.2, 0.2, PAL_HD.ink[0]);
  return { buf: c.render(HD_RENDER), ox: 6, oy: 10, density: d };
}
defineHdSprite('npc/ams/ams-pigeons', (d) => [0, 1, 2, 3, 4].map((f) => pigeonHd(f, hdOf(d))));

/** The 1× pigeon of the take-off (npc.art.ts `pigeon` geometry): 5 crouch, 6 push off. */
function pigeonLo(f: 5 | 6): Frame {
  const b = new PixelBuffer(14, 12);
  const c = f === 5 ? 1 : 0;
  b.poly([[1, 6 + c], [4, 5 + c], [4, 8 + c]], PAL.steel[1]);
  b.ellipse(3, 4 + c, 7, 5, PAL.steel[2]);
  b.hline(4, 8, 5 + c, PAL.steel[3]);
  b.hline(5, 8, 8 + c, PAL.steel[1]);
  const hx = 9;
  const hy = 3 + c;
  b.rect(hx - 1, hy + 1, 2, 2, PAL.teal[2]);
  b.set(hx - 1, hy + 2, PAL.purple[2]);
  b.circle(hx, hy, 1, PAL.steel[2]);
  b.set(hx + 2, hy, PAL.stone[1]);
  b.set(hx, hy - 1, PAL.steel[3]);
  if (f === 5) b.poly([[4, 6], [8, 6], [7, 3], [3, 4]], PAL.steel[3]);
  else b.poly([[4, 5], [8, 5], [5, 0], [3, 1]], PAL.steel[3]);
  b.outline(INK);
  b.set(hx, hy, INK);
  b.set(6, 9, PAL.pink[1]);
  b.set(7, 9, PAL.pink[1]);
  return { buf: b, ox: 6, oy: 10 };
}
defineSprite('npc/ams/ams-pigeons/takeoff', () => [pigeonLo(5), pigeonLo(6)], { ticksPerFrame: 3, loop: false, hd: (d) => [pigeonHd(5, hdOf(d)), pigeonHd(6, hdOf(d))] });

// ------------------------------------------------------------------------------------ ducks

/** Paddle bob per phase in logical px (half-px steps at d ≥ 2) and the 1× rounding. */
const PADDLE_HD = [0, 0.5, 1, 0.5];
const PADDLE_LO = [0, 1, 1, 0];

/**
 * A mallard at density d (12 × 9 logical, waterline anchor 5, 7). f 0 / 1 = bob up, down (the
 * `ams-ducks` strip); `phase` 0–3 = the 4-step paddle (`ams-ducks/paddle`): up, half a logical px
 * down, down, half up, with the ripple glints and a paddle swirl moving along.
 */
function duckHd(f: number, drake: boolean, d: HdD, phase = -1): Frame {
  const c = new HdCanvas(12, 9, d);
  const dy = phase >= 0 ? PADDLE_HD[phase] : f === 1 ? 1 : 0;
  const k = phase >= 0 ? phase : f;
  const body = drake
    ? c.material({ ramp: PAL_HD.stone, lo: 3, hi: 6, wrap: 0.1, spec: 0.1 })
    : c.material({ ramp: PAL_HD.brown, lo: 2, hi: 6, wrap: 0.1, spec: 0.1 });
  const wingM = drake ? c.material({ ramp: PAL_HD.stone, lo: 2, hi: 5, wrap: 0.1 }) : c.material({ ramp: PAL_HD.brown, lo: 1, hi: 5, wrap: 0.1 });
  const breast = c.material({ ramp: PAL_HD.rust, lo: 1, hi: 4, wrap: 0.1, spec: 0.2 });
  const black = c.material({ ramp: BLACK_ONE_HUE, lo: 1, hi: 4, spec: 0.5, shine: 16 });
  const head = drake ? c.material({ ramp: PAL_HD.green, lo: 1, hi: 4, spec: 1, shine: 22 }) : c.material({ ramp: PAL_HD.brown, lo: 2, hi: 6, wrap: 0.1 });
  const white = c.material({ ramp: PAL_HD.snow, lo: 3, hi: 6 });
  const blue = c.material({ ramp: PAL_HD.sky, lo: 0, hi: 4, spec: 0.8, shine: 20 });
  const bill = drake ? c.material({ ramp: PAL_HD.gold, lo: 3, hi: 6, spec: 0.4 }) : c.material({ ramp: PAL_HD.orange, lo: 2, hi: 5, spec: 0.3 });
  const body0 = c.newPart();
  c.ellipsoid(5, 5 + dy, 4, 2.1, {
    mat: body,
    part: body0,
    z: 0,
    tex: drake
      ? (s) => {
          if (s.x > 6.6 && s.y > 4.3 + dy) s.mat = breast;
          else if (s.x < 2.6) s.mat = black;
          else if (s.d >= 4 && Math.floor(s.y * 4) % 2 === 0) s.tone -= 0.06;
        }
      : texScaleHen,
  });
  // Folded wing with the speculum (white-edged blue on the drake, a brown-edged patch on the hen).
  c.blob([[2.6, 4.6 + dy], [7.4, 4.5 + dy], [7.2, 6.2 + dy], [3, 6.4 + dy]], 0.45, {
    mat: wingM,
    z: 2.2,
    bulge: 0.15,
    tone: 0.06,
    tex: (s) => {
      if (s.x > 4 && s.x < 6.9 && s.y > 5.1 + dy && s.y < 5.95 + dy) s.mat = drake ? blue : wingM;
      else if (s.x > 3.9 && s.x < 7 && Math.abs(s.y - (4.95 + dy)) < 0.2) s.mat = drake ? white : wingM;
      if (!drake && s.y > 5.1 + dy && s.y < 5.95 + dy && s.x > 4 && s.x < 6.9) s.tone -= 0.25;
    },
  });
  if (drake) {
    // The black stern with its curled feather.
    c.capsule(2.4, 3.6 + dy, 2.0, 2.9 + dy, 0.35, 0.3, { mat: black, z: 2.4 });
  }
  // Neck and head (the drake's white collar between the green and the breast).
  c.capsule(7.4, 4.6 + dy, 8.2, 3.1 + dy, 1, 0.95, {
    mat: head,
    z: 2.2,
    tex: drake
      ? (s) => {
          if (s.y > 3.95 + dy) s.mat = Math.abs(s.y - (4.15 + dy)) < 0.25 ? white : breast;
        }
      : undefined,
  });
  c.ellipsoid(8.6, 2.6 + dy, 1.55, 1.4, {
    mat: head,
    z: 2.6,
    tex: drake
      ? undefined
      : (s) => {
          // The hen's dark eye stripe and her darker crown.
          if (Math.abs(s.y - (2.15 + dy) + (s.x - 9) * 0.25) < 0.22) s.tone -= 0.35;
          if (s.y < 1.7 + dy) s.tone -= 0.12;
        },
  });
  c.capsule(9.9, 2.75 + dy, 11.55, 2.85 + dy, 0.48, 0.42, { mat: bill, z: 3.6, round: 0.5 });
  paintDot(c, 11.4, 2.75 + dy, 0.2, 0.2, PAL_HD.ink[1]);
  paintDot(c, 9.4, 2.1 + dy, 0.28, 0.28, PAL_HD.ink[0]);
  // The body sinks into the water: nothing below the waterline.
  c.erase(0, 7, 12, 2, () => true);
  const b = c.render(HD_RENDER);
  waterline(b, d, k, 12, 0.5, 10.5, 2.2, 8.2);
  if (phase >= 0) {
    // The paddle swirl behind the tail.
    const X = Math.round((phase & 1 ? 0.3 : 0.9) * d);
    for (let i = 0; i < d; i++) b.set(X + i, 7 * d - 1, PAL_HD.snow[5]);
  }
  return { buf: b, ox: 5, oy: 7, density: d };
}

/** The hen's mottling: dark V marks on a brown scale pattern. */
const texScaleHen: Texture = (s) => {
  const row = Math.floor(s.y / 0.9);
  const x = s.x / 1.1 + (row & 1) * 0.5;
  const fx = x - Math.floor(x) - 0.5;
  const fy = s.y / 0.9 - row;
  if (Math.abs(fy - 0.55 - Math.abs(fx) * 0.6) < (s.d >= 4 ? 0.14 : 0.2)) s.tone -= 0.3;
};

/**
 * The lit ripple ring at the waterline (logical row 7 of a duck frame; no outline): a light crest
 * line with glints moving by `k`, and a broken dark reflection of the body in row 8 (x0..x1 the
 * ripple, r0..r1 the reflection).
 */
function waterline(b: PixelBuffer, d: number, k: number, w: number, x0: number, x1: number, r0: number, r1: number): void {
  const Y = 7 * d;
  for (let X = Math.round(x0 * d); X < Math.min(w * d, Math.round(x1 * d)); X++) {
    const x = (X + 0.5) / d;
    const g = (Math.floor(x * 1.3) + k * 2) % 6 === 0;
    for (let i = 0; i < Math.max(1, d >> 1); i++) b.set(X, Y + i, g ? PAL_HD.snow[6] : PAL_HD.snow[4]);
    if (d >= 4) b.set(X, Y + 2, PAL_HD.snow[2]);
  }
  for (let X = Math.round(r0 * d); X < Math.round(r1 * d); X++) {
    const x = (X + 0.5) / d;
    if (noise2(x * 2 + k, 0, 1, 77) < 0.45) continue;
    for (let i = 0; i < Math.max(1, d >> 1); i++) b.set(X, 8 * d + i, PAL_HD.canal[1]);
  }
}
defineHdSprite('npc/ams/ams-ducks', (d) => [duckHd(0, true, hdOf(d)), duckHd(1, true, hdOf(d)), duckHd(0, false, hdOf(d)), duckHd(1, false, hdOf(d))]);

/** The 1× mallard of the paddle (npc.art.ts `duck` geometry) at `phase` 0–3. */
function duckLo(phase: number, drake: boolean): Frame {
  const b = new PixelBuffer(12, 9);
  const dy = PADDLE_LO[phase];
  b.ellipse(1, 3 + dy, 8, 4, drake ? PAL.stone[2] : PAL.brown[2]);
  b.hline(2, 7, 3 + dy, drake ? PAL.stone[3] : PAL.brown[3]);
  b.set(1, 4 + dy, drake ? PAL.ink[1] : PAL.brown[1]);
  b.rect(4, 5 + dy, 3, 1, drake ? PAL.sky[1] : PAL.brown[1]);
  b.circle(8, 2 + dy, 1, drake ? PAL.green[1] : PAL.brown[2]);
  b.rect(7, 1 + dy, 2, 2, drake ? PAL.green[2] : PAL.brown[2]);
  b.outline(INK);
  b.set(9, 1 + dy, INK);
  b.rect(10, 2 + dy, 2, 1, PAL.gold[2]);
  // Ripple at the waterline: a lit crest that moves along with the paddle.
  b.hline(0, 9, 7, PAL.snow[2]);
  b.set((phase * 3 + 1) % 10, 7, PAL.sky[2]);
  return { buf: b, ox: 5, oy: 7 };
}
defineSprite('npc/ams/ams-ducks/paddle', () => [true, false].flatMap((dr) => [0, 1, 2, 3].map((k) => duckLo(k, dr))), {
  ticksPerFrame: 8,
  hd: (d) => [true, false].flatMap((dr) => [0, 1, 2, 3].map((k) => duckHd(0, dr, hdOf(d), k))),
});

// ------------------------------------------------------------------------------------ tour boat

/** Tourists in the cabin: skin, hair and shirt ramps (by seat). */
const SKINS: readonly Ramp[] = [PAL.skinA, PAL.skinB, PAL.skinC, PAL.skinA];
const HAIRS: readonly Ramp[] = [PAL_HD.hairC, PAL_HD.hairA, PAL_HD.hairB, PAL_HD.red, PAL_HD.snow];
const SHIRTS: readonly Ramp[] = [PAL_HD.red, PAL_HD.gold, PAL_HD.teal];

/** The hull outline (1× poly (4, 20) (104, 20) (112, 21) (109, 27) (7, 27), continuous). */
const HULL: ReadonlyArray<readonly [number, number]> = [[4, 20], [105, 20], [113, 21.2], [110, 28], [7.4, 28]];

/**
 * `tourBoat(phase)` at density d (116 × 32 logical, anchor 58, 28: the water line). Above the
 * water: the outlined boat. Below it (rows 28–31, no outline): the hull's broken reflection, a lit
 * crest line and the bow and stern foam, which change with `phase`.
 */
function tourBoatHd(phase: number, d: HdD): Frame {
  const key = `${phase}@${d}`;
  let f = boats.get(key);
  if (!f) boats.set(key, (f = paintTourBoat(phase, d)));
  return { ...f, buf: f.buf.clone() };
}
/** Painted boats (the strip and its turn share the painting; each frame gets its own copy). */
const boats = new Map<string, Frame>();

function paintTourBoat(phase: number, d: HdD): Frame {
  const c = new HdCanvas(116, 32, d);
  const hullM = c.material({ ramp: PAL_HD.navy, lo: 1, hi: 4, spec: 0.6, shine: 22 });
  const band = c.material({ ramp: PAL_HD.gable, lo: 2, hi: 5, spec: 0.4, shine: 16 });
  const rail = c.material({ ramp: PAL_HD.sky, lo: 1, hi: 6, spec: 0.8, shine: 24 });
  const room = c.material({ ramp: PAL_HD.navy, lo: 0, hi: 3, flat: true });
  const glass = c.material({ ramp: PAL_HD.glass, lo: 2, hi: 4, spec: 1, shine: 30 });
  const roofGlass = c.material({ ramp: PAL_HD.sky, lo: 1, hi: 5, spec: 1, shine: 30, amb: 0.2 });
  const frame = c.material({ ramp: PAL_HD.gable, lo: 1, hi: 5, spec: 0.5, shine: 18 });
  const pole = c.material({ ramp: PAL_HD.steel, lo: 2, hi: 6, spec: 0.9, shine: 24 });
  // Hull: the side curves under (the lower plates face down), plating seams and rivets (4×), the
  // white band, the dark boot top at the waterline.
  c.plane(4, 20, 110, 8, {
    mat: hullM,
    z: 0,
    mask: (x, y) => inPoly(x, y, HULL),
    normal: (x, y, out) => {
      const t = (y - 20) / 8;
      out[0] = x > 104 ? (x - 104) * 0.08 : x < 9 ? -(9 - x) * 0.08 : 0;
      out[1] = t * 1.1 - 0.35;
      out[2] = 1;
    },
    height: (_x, y) => 1 - Math.abs(y - 23) * 0.15,
    tex: (s) => {
      if (s.y >= 22 && s.y < 23) s.mat = band;
      else if (s.y > 26.2) s.tone -= 0.25;
      const sx = (s.x - 6) % 9;
      if (sx < 1 / s.d && s.y > 23) s.tone -= 0.22;
      if (s.d >= 4 && s.y > 23.2 && s.y < 23.7 && (s.x * 2) % 2 < 0.5) s.tone += 0.3;
    },
  });
  c.cylinder(5, 19.8, 105.5, 1.2, { mat: rail, z: 1.5, axis: 'h' });
  // Cabin: the dark saloon, tourists at the windows, glazing bars.
  c.box(14, 12, 86, 8, { mat: room, z: -1, tone: -0.15 });
  for (let i = 0; i < 12; i++) {
    const x = 18.5 + i * 7 + ((i * 5) % 3);
    const sk = SKINS[i % SKINS.length];
    const skin = c.material({ ramp: PAL_HD[sk === PAL.skinA ? 'skinA' : sk === PAL.skinB ? 'skinB' : 'skinC'], lo: 3, hi: 6, spec: 0.2, wrap: 0.1 });
    const hair = c.material({ ramp: HAIRS[(i * 3) % HAIRS.length], lo: 1, hi: 4, wrap: 0.1 });
    const shirt = c.material({ ramp: SHIRTS[i % 3], lo: 2, hi: 5, wrap: 0.1 });
    c.blob([[x - 2.3, 20], [x - 2, 17.6], [x - 0.8, 17], [x + 0.8, 17], [x + 2, 17.6], [x + 2.3, 20]], 0.5, { mat: shirt, z: 0, bulge: 0.15 });
    c.ellipsoid(x, 15.6, 1.25, 1.35, { mat: skin, z: 0.5 });
    c.ellipsoid(x - 0.15, 14.6, 1.35, 0.85, { mat: hair, z: 0.8 });
  }
  // Reflections on the side glazing: diagonal light streaks over everyone inside.
  c.shade(14, 12, 86, 8, (x, y) => {
    const t = ((x + y * 0.8) % 13 + 13) % 13;
    return t < 1.6 ? 0.35 : t < 2.2 ? 0.15 : 0;
  });
  for (let x = 16; x < 100; x += 10) c.box(x, 12, 0.9, 8, { mat: frame, z: 2, bevel: 0.3 });
  // The curved glass roof: sky reflections, glints, its rail and the roof bars.
  c.plane(12, 6, 90, 6.6, {
    mat: roofGlass,
    z: 1,
    mask: (x, y) => ((x - 57) / 45) ** 2 + ((y - 13) / 7) ** 2 < 1,
    normal: (x, y, out) => {
      out[0] = ((x - 57) / 45) * 1.4;
      out[1] = (y - 13) / 7;
      out[2] = 0.7;
    },
    tex: (s) => {
      const t = ((s.x - s.y * 1.4) % 17 + 17) % 17;
      s.tone += t < 2 ? 0.45 : t < 3 ? 0.2 : 0.12;
    },
  });
  c.box(12.5, 11.5, 89, 0.9, { mat: frame, z: 3, bevel: 0.3 });
  c.box(18, 8, 79, 0.75, { mat: frame, z: 2.5, bevel: 0.25 });
  for (let x = 16; x < 100; x += 10) c.box(x, 7.3, 0.8, 4.4, { mat: frame, z: 2.4, bevel: 0.25 });
  // The wheelhouse window with its glint.
  c.box(100, 14, 5, 6, { mat: glass, z: 1.4, bevel: 0.4, tone: 0.3 });
  paintSeg(c, 100.9, 15.6, 101.9, 14.6, PAL_HD.glass[5]);
  // The Dutch flag on its staff at the stern, waving.
  c.capsule(5.5, 5.6, 5.5, 20, 0.42, 0.42, { mat: pole, z: 2 });
  c.ellipsoid(5.5, 5.4, 0.6, 0.6, { mat: c.material({ ramp: PAL_HD.gold, lo: 2, hi: 6, spec: 1, shine: 24 }), z: 2.2 });
  const red = c.material({ ramp: PAL_HD.red, lo: 2, hi: 6, spec: 0.2 });
  const wht = c.material({ ramp: PAL_HD.cloth, lo: 2, hi: 6, spec: 0.2 });
  const blu = c.material({ ramp: PAL_HD.denim, lo: 1, hi: 5, spec: 0.2 });
  c.plane(6, 6, 6, 6, {
    mat: red,
    z: 1.8,
    normal: (x, _y, out) => {
      const w = Math.cos((x - 6) * 1.3 + phase * Math.PI);
      out[0] = w * 0.6;
      out[1] = 0;
      out[2] = 1;
    },
    tex: (s) => {
      if (s.y >= 10) s.mat = blu;
      else if (s.y >= 8) s.mat = wht;
    },
  });
  const b = c.render(HD_RENDER);
  // Below the water line: reflection, crest and foam (no outline).
  const Y = 28 * d;
  for (let X = 8 * d; X < 108 * d; X++) {
    const x = (X + 0.5) / d;
    for (let Yy = Y; Yy < 31 * d; Yy++) {
      const y = (Yy + 0.5) / d;
      const n = noise2(x * 0.7 + phase * 3, y * 2.5, 1.5, 91);
      if (n < 0.42 + (y - 28) * 0.06) continue;
      b.set(X, Yy, y < 29 ? PAL_HD.canal[1] : PAL_HD.canal[2]);
    }
  }
  for (let X = 10 * d; X < 104 * d; X++) {
    const x = (X + 0.5) / d;
    const glint = hash2(Math.floor(x * 0.8) + phase * 7, 3, 92) > 0.82;
    for (let i = 0; i < Math.max(1, d >> 1); i++) b.set(X, Y + i, glint ? PAL_HD.snow[6] : PAL_HD.sky[5]);
  }
  const foam: ReadonlyArray<readonly [number, number, number]> = phase
    ? [[112, 28, 3], [108, 29, 3], [3, 28, 3], [0, 29, 3], [104, 29.5, 3], [114, 29.6, 2]]
    : [[110, 28, 3], [113, 29, 3], [5, 29, 3], [1, 28, 3], [99, 29.5, 3], [2, 30, 2]];
  for (const [fx, fy, len] of foam) {
    for (let X = Math.round(fx * d); X < Math.min(116 * d, Math.round((fx + len) * d)); X++) {
      for (let i = 0; i < d; i++) {
        const lit = i < d / 2;
        if (hash2(X, Math.round(fy * d) + i, 93) > 0.85) continue;
        b.set(X, Math.round(fy * d) + i, lit ? PAL_HD.snow[6] : PAL_HD.snow[3]);
      }
    }
  }
  return { buf: b, ox: 58, oy: 28, density: d };
}
defineHdSprite('npc/ams/ams-tour-boat', (d) => [tourBoatHd(0, hdOf(d)), tourBoatHd(1, hdOf(d))]);

// ------------------------------------------------------------------------------------ window cat

/** The tail tip (1× inner px) per phase of the 4-step swish (`cat-swish`), shut eyes on phase 3. */
const SWISH: readonly (readonly [number, number])[] = [[2, 6], [1, 7], [0, 9], [1, 8]];

/**
 * The ginger cat on the window sill at density d (the 1× inner 14 × 16 picture): tabby-striped
 * fur, a cream muzzle, pink ears and nose, green slit eyes (shut on the blink), whiskers, the tail
 * swishing (`t` 0 / 1 for the `cat` strip, `phase` 0–3 for `cat-swish`).
 */
function catHd(t: number, d: HdD, phase = -1): Frame {
  const draw = (c: HdCanvas): void => {
    const fur = c.material({ ramp: PAL_HD.orange, lo: 1, hi: 5, wrap: 0.15, spec: 0.15, shine: 10 });
    const pink = c.material({ ramp: PAL_HD.pink, lo: 3, hi: 6, spec: 0.3 });
    const tabby: Texture = (s) => {
      const b = (s.x * 0.75 + s.y * 0.45 + (noise2(s.x, s.y, 2, 51) - 0.5) * 0.8) % 1.7;
      if (b < 0.45) s.tone -= 0.32;
    };
    // Body (sitting, chest towards us) and the tail curling up beside it.
    c.ellipsoid(7.5, 11.9, 4.4, 4.4, {
      mat: fur,
      z: 2.2,
      tex: (s) => {
        tabby(s);
        if (s.x > 6.4 && s.x < 10.2 && s.y > 8.6 && s.y < 12.5) s.tone += 0.22;
      },
    });
    const [tx, ty] = phase >= 0 ? SWISH[phase] : t ? [0, 8] : [1, 7];
    c.stroke([[3.5, 14.6], [1.6, 12.8], [tx + 0.6, ty + 0.6]], 1.0, 0.75, {
      mat: fur,
      z: 2.8,
      tone: -0.1,
      tex: (s) => {
        if (Math.hypot(s.x - tx - 0.6, s.y - ty - 0.6) < 1.1) s.tone -= 0.35;
        else if (((s.y * 1.2) % 1.4) < 0.4) s.tone -= 0.3;
      },
    });
    // Ears (pink inside), head, muzzle, nose.
    c.blob([[5.3, 4.8], [6.4, 0.9], [7.9, 4]], 0.3, { mat: fur, z: 3, bulge: 0.1 });
    c.blob([[9.3, 4], [10.7, 0.9], [11.8, 4.8]], 0.3, { mat: fur, z: 3, bulge: 0.1 });
    c.poly([[6, 3.9], [6.5, 1.9], [7.2, 3.7]], { mat: pink, z: 3.1 });
    c.poly([[9.9, 3.7], [10.6, 1.9], [11.2, 3.9]], { mat: pink, z: 3.1 });
    c.ellipsoid(8.6, 6.6, 3.3, 3, {
      mat: fur,
      z: 3.3,
      tex: (s) => {
        // The tabby "M" on the forehead, stripes on the cheeks.
        if (s.y < 5.6 && (Math.abs(s.x - 7.9) < 0.22 || Math.abs(s.x - 8.9) < 0.22 || Math.abs(s.x - 9.9) < 0.2)) s.tone -= 0.35;
        if (s.y > 6.6 && (s.x < 6.2 || s.x > 11) && ((s.y * 2.2) % 1 < 0.35)) s.tone -= 0.25;
      },
    });
    c.ellipsoid(8.9, 8.2, 1.6, 1.05, { mat: fur, z: 3.8, tone: 0.35 });
    c.ellipsoid(8.9, 7.65, 0.5, 0.35, { mat: pink, z: 4.2, round: 0.6 });
    // Eyes: green with a dark slit (a catchlight at 4×), or shut on the blink.
    for (const ex of [7.5, 10.4]) {
      if (phase === 3) {
        paintSeg(c, ex - 0.55, 6.45, ex + 0.55, 6.6, PAL_HD.orange[0]);
        continue;
      }
      paintDot(c, ex, 6.5, 0.6, 0.45, PAL_HD.green[6]);
      paintDot(c, ex, 6.5, 0.14, 0.42, PAL_HD.ink[0]);
      if (d >= 4) c.dot(ex - 0.3, 6.25, PAL_HD.snow[6]);
    }
    // Whiskers.
    const wh = PAL_HD.snow[5];
    paintSeg(c, 10.3, 8.2, 12.9, 7.8, wh);
    paintSeg(c, 10.3, 8.7, 12.8, 9.1, wh);
    paintSeg(c, 7.5, 8.2, 5.2, 7.8, wh);
    paintSeg(c, 7.5, 8.7, 5.3, 9.1, wh);
  };
  return windowHd(d, { draw });
}
defineHdSprite('npc/ams/ams-window-waver/cat', (d) => [catHd(0, hdOf(d)), catHd(1, hdOf(d))]);

/** The 1× ginger cat (npc.art.ts geometry) at swish `phase` 0–3. */
function catLo(phase: number): Frame {
  const inner = new PixelBuffer(14, 16);
  inner.ellipse(3, 7, 9, 9, PAL.orange[1]);
  inner.hline(5, 9, 8, PAL.orange[2]);
  inner.circle(8, 6, 3, PAL.orange[2]);
  inner.tri(5, 4, 6, 1, 7, 4, PAL.orange[2]);
  inner.tri(9, 4, 10, 1, 11, 4, PAL.orange[2]);
  const eye = phase === 3 ? PAL.orange[0] : PAL.green[3];
  inner.set(7, 6, eye);
  inner.set(10, 6, eye);
  inner.set(8, 8, PAL.pink[2]);
  inner.thickLine(3, 14, SWISH[phase][0], SWISH[phase][1], 2, PAL.orange[0]);
  return windowDone(windowFrame(), inner);
}
defineSprite('npc/ams/ams-window-waver/cat-swish', () => [0, 1, 2, 3].map(catLo), { durations: [14, 10, 14, 10], hd: (d) => [0, 1, 2, 3].map((k) => catHd(0, hdOf(d), k)) });

// ------------------------------------------------------------------------------------ window lean

/** The waver (npc.art.ts `WAVER_STYLE`, `waverFrames` idle pose). */
const WAVER: HumanStyle = WAVER_STYLE;
const WAVER_IDLE: Pose = { weapon: 'none', armN: { sh: 6, el: 30, hand: 'open' }, armF: { sh: -4, el: 30, hand: 'open' }, expr: 'normal' };
/** Lean in: the hip this far (px) below the idle frame's hip and to the side, eased out. */
export const LEAN_DROP = [9, 5, 2];
const LEAN_DX = [-3, -1, 0];

/** The 3 lean-in frames (played backwards to lean out); `d` 2 / 4: the rig at d in the HD window. */
function leanFrames(d: Density): Frame[] {
  const f = renderHuman(WAVER, WAVER_IDLE, 'upper', d);
  return LEAN_DROP.map((drop, i) => {
    const inner = new PixelBuffer(14 * d, 16 * d);
    inner.blitFrame(f, (7 + LEAN_DX[i]) * d, (16 + 1 + drop) * d, undefined, d);
    return d === 1 ? windowDone(windowFrame(), inner) : windowHd(hdOf(d), { img: inner });
  });
}
defineSprite('npc/ams/ams-window-waver/lean', () => leanFrames(1), { ticksPerFrame: 3, loop: false, hd: (d) => leanFrames(d) });

// ------------------------------------------------------------------------------------ tour boat turn

/** The tour boat squeezed end-on (2 frames); ambient.ts plays them, flips, plays them back. */
defineSprite('npc/ams/ams-tour-boat/turn', () => turnSquash(getFrames('npc/ams/ams-tour-boat', 1)[0]), {
  ticksPerFrame: 6,
  hd: (d) => turnSquash(tourBoatHd(0, hdOf(d))),
});
