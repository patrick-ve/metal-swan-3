/**
 * UHD ambient life of mission `ams` (docs/ART_GUIDE.md "UHD art"): ONE density-generic drawer
 * (d 2 and 4) for `npc/ams/ams-tour-boat` (1× art in npc.art.ts) and its motion strip. Each frame
 * is painted natively with the UHD kit (HdCanvas, PAL_HD, outline A, rim light) in the 1× frame's
 * logical box and anchor:
 * - the tour boat: a riveted steel hull with its white band and lit rub rail, the curved glass roof
 *   with sky reflections, tourists behind the glazing, the wheelhouse window, a waving Dutch flag,
 *   and below the water line its broken reflection and the bow and stern foam (no outline).
 * The window waver and the cat, the pigeons and the ducks are baked 40 px sets (npc.art.ts,
 * tools/art40/chars/{ams-window-waver,ams-pigeons,ams-ducks}/): 1× at every tier.
 *
 * Motion strip (docs/ART_GUIDE.md "Motion"; 1× and HD both defined here, drawn by ambient.ts):
 * `npc/ams/ams-tour-boat/turn` (2: `turnSquash` of the boat, played at the ends of its run).
 */
import type { Color } from '../../../../engine/color';
import { PAL } from '../../../../engine/palette';
import { PAL_HD } from '../../../../engine/palette-hd';
import type { Ramp } from '../../../../engine/pixel';
import type { Frame } from '../../../../engine/render';
import { defineHdSprite, defineSprite, getFrames } from '../../../../engine/sprites';
import { HdCanvas, inPoly } from '../../../art/hd';
import { hash2, noise2 } from '../../../art/paint';
import { turnSquash } from '../../creatures/draw';
import { HD_RENDER, hdOf, type HdD } from './npc.art';

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

// ------------------------------------------------------------------------------------ tour boat turn

/** The tour boat squeezed end-on (2 frames); ambient.ts plays them, flips, plays them back. */
defineSprite('npc/ams/ams-tour-boat/turn', () => turnSquash(getFrames('npc/ams/ams-tour-boat', 1)[0]), {
  ticksPerFrame: 6,
  hd: (d) => turnSquash(tourBoatHd(0, hdOf(d))),
});
