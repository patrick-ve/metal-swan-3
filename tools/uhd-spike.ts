/**
 * npm run uhd-spike -- [--out tmp/uhd-style] [--palette] [--only hero|swan|street]
 *
 * The UHD STYLE SPIKE (plan uhd-arcade-fidelity, group found; docs/ART_GUIDE.md "UHD art"):
 * renders, at 2× AND 4×, with the HD kit (src/game/art/hd/) and nothing registered in the game:
 *   1. a hero in the recruit's colours — idle, one run frame, shooting — from lit prototype parts
 *      (capsule limbs, a lit torso with folds, vest, belt, pouches, boots, the prototype head
 *      `renderHeadHd` and gun `gunArtHd`);
 *   2. the Swan's head and neck (white plumage, the steel and orange parts, the navy collar);
 *   3. a 128 × 96 logical street crop (canal house façade with brick, gable, window frame and
 *      reflection; a street lamp, a tree, cobbles, a quay edge and canal water);
 * each next to TODAY's 2× art of the same subject at the same scale, in outline variants A, B
 * and C. Sheets: <out>/<subject>@<d>x.png (4 sheet px per logical px; today's 2× art enlarged
 * 2 × 2 next to the 4× art, 2 sheet px per logical px at 2×), crops at real size, the HD palette
 * sheet <out>/palette-hd.png (--palette, or always when nothing else is asked), and
 * <out>/index.md listing every PNG with the generation times.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';
import type { Color } from '../src/engine/color';
import { drawText } from '../src/engine/font';
import { HD_PALETTE, HD_RAMP_NAMES, PAL_HD } from '../src/engine/palette-hd';
import { PixelBuffer } from '../src/engine/pixel';
import { getFrames } from '../src/engine/sprites';
import { HdCanvas, type Outline, brick, cobbles, folds, gunArtHd, heldArtHd, knifeArtHd, leaves, plaster, propArtHd, renderHeadHd, wood, grime, texAll } from '../src/game/art/hd/index';
import type { HeadStyle } from '../src/game/art/humanoid-head';
import { HEAD_CENTER } from '../src/game/art/humanoid-head';
import { gunArt, gunArtHi, heldArtHi, knifeArtHi, propArtHi, type PropKind } from '../src/game/art/humanoid-gear';
import { renderHeadHi } from '../src/game/art/humanoid-head';
import { noise2 } from '../src/game/art/paint';
import { loadContent } from '../src/game/content/index';
import { SHEET, savePNG } from './lib/image';

type D = 2 | 4;
const VARIANTS: readonly Outline[] = ['A', 'B', 'C'];

interface Args {
  out: string;
  palette: boolean;
  only: string | null;
}

function parseArgs(argv: readonly string[]): Args {
  const a: Args = { out: 'tmp/uhd-style', palette: false, only: null };
  for (let i = 0; i < argv.length; i++) {
    const s = argv[i];
    if (s === '--out') a.out = argv[++i] ?? a.out;
    else if (s === '--palette') a.palette = true;
    else if (s === '--only') a.only = argv[++i] ?? null;
    else if (s === '--help' || s === '-h') {
      console.log('usage: npm run uhd-spike -- [--out tmp/uhd-style] [--palette] [--only hero|swan|street]');
      process.exit(0);
    } else console.warn(`unknown option ${s}`);
  }
  return a;
}

// ------------------------------------------------------------------------------------------
// 1. Hero (recruit colours) from lit prototype parts
// ------------------------------------------------------------------------------------------

const RECRUIT_HEAD: HeadStyle = {
  skin: PAL_HD.skinA,
  hair: PAL_HD.hairB,
  hairStyle: 'short',
  headgear: 'none',
  gear: PAL_HD.olive,
  accent: PAL_HD.red,
  extras: [],
};

/** A pose: angles in degrees from straight down (+ = towards the front, right). */
interface HeroPose {
  name: string;
  /** Hip position (logical, in the 40 × 42 hero frame). */
  hip: [number, number];
  /** Torso lean (deg, + forward). */
  lean: number;
  legN: [number, number];
  legF: [number, number];
  /** Upper arm, forearm. */
  armN: [number, number];
  armF: [number, number];
  /** Gun held by the near hand: angle of the gun (deg, 0 = forward). */
  gun: number;
  /** Muzzle flash. */
  flash?: boolean;
  /** Foot tilt near / far (deg). */
  footN?: number;
  footF?: number;
}

const HERO_W = 40;
const HERO_H = 42;

const POSES: readonly HeroPose[] = [
  { name: 'idle', hip: [16, 25.5], lean: 4, legN: [8, -4], legF: [-8, 2], armN: [28, 62], armF: [10, 40], gun: 0 },
  { name: 'run', hip: [16, 24.5], lean: 14, legN: [52, -40], legF: [-34, -70], armN: [18, 66], armF: [-42, 80], gun: -10, footN: 10, footF: -30 },
  { name: 'shoot', hip: [15, 25.5], lean: 6, legN: [18, -6], legF: [-12, 4], armN: [82, 6], armF: [62, 26], gun: 0, flash: true },
];

function rad(a: number): number {
  return (a * Math.PI) / 180;
}

/** Point at distance `len` from p along angle `a` (deg from straight down, + = forward/right). */
function along(p: readonly [number, number], a: number, len: number): [number, number] {
  return [p[0] + Math.sin(rad(a)) * len, p[1] + Math.cos(rad(a)) * len];
}

function drawHero(pose: HeroPose, d: D, outline: Outline): PixelBuffer {
  const c = new HdCanvas(HERO_W, HERO_H, d);
  const M = {
    pants: c.material({ ramp: PAL_HD.stone, rim: 0.15, wrap: 0.05 }),
    boots: c.material({ ramp: PAL_HD.brown, spec: 0.45, shine: 16 }),
    shirt: c.material({ ramp: PAL_HD.sand, wrap: 0.05 }),
    vest: c.material({ ramp: PAL_HD.olive, wrap: 0.05, rim: 0.35 }),
    belt: c.material({ ramp: PAL_HD.brown, spec: 0.35, shine: 14 }),
    buckle: c.material({ ramp: PAL_HD.gold, spec: 1, shine: 26 }),
    glove: c.material({ ramp: PAL_HD.black, spec: 0.4, shine: 14, rim: 0.4 }),
    skin: c.material({ ramp: PAL_HD.skinA, spec: 0.3, shine: 16 }),
    sole: c.material({ ramp: PAL_HD.black, spec: 0.1 }),
    flash: c.material({ ramp: PAL_HD.fire, flat: true, lo: 0, hi: 7 }),
  };
  const [hx, hy] = pose.hip;
  const neck = along([hx, hy], 180 - pose.lean, 10.5);
  const sh = (side: number): [number, number] => [neck[0] - side * 1.0 + Math.sin(rad(pose.lean)) * 1.5, neck[1] + 2.2];

  // Legs: far (behind the body), near (in front).
  const leg = (hip: [number, number], a: [number, number], z: number, foot: number): void => {
    const knee = along(hip, a[0], 6.4);
    const ankle = along(knee, a[0] + a[1], 6.0);
    const part = c.newPart();
    const fold = folds({ angle: rad(a[0]) * 0.6, spacing: 2.2, amp: 0.9, cover: 0.6, seed: z > 0 ? 3 : 4 });
    c.capsule(hip[0], hip[1], knee[0], knee[1], 2.9, 2.4, { mat: M.pants, z, part, tex: fold, round: 0.85 });
    c.capsule(knee[0], knee[1], ankle[0], ankle[1] - 0.6, 2.4, 2.1, { mat: M.pants, z, part, tex: fold, round: 0.85 });
    // Trouser cuff over the boot top, then the boot: shaft, foot, toe cap, sole.
    const bp = c.newPart();
    const fa = rad(foot);
    const toe: [number, number] = [ankle[0] + Math.cos(fa) * 3.4, ankle[1] + 1.4 - Math.sin(fa) * 3.4];
    c.capsule(ankle[0] - 0.2, ankle[1] - 1.2, ankle[0], ankle[1] + 0.8, 1.8, 1.8, { mat: M.boots, z: z + 0.4, part: bp });
    c.capsule(ankle[0] - 0.6, ankle[1] + 1.1, toe[0], toe[1], 1.5, 1.35, { mat: M.boots, z: z + 0.4, part: bp, round: 0.8 });
    c.capsule(ankle[0] - 1.2, ankle[1] + 2.5, toe[0] + 0.4, toe[1] + 1.0, 0.45, 0.45, { mat: M.sole, z: z + 0.6 });
    // Laces at 4× (a row of light dots up the shaft).
    if (d >= 4) for (let k = 0; k < 3; k++) c.dot(ankle[0] + 0.9, ankle[1] - 0.8 + k * 0.6, PAL_HD.brown[6]);
  };
  leg([hx - 1.2, hy], pose.legF, -3, pose.footF ?? 0);

  // Far arm (behind the torso).
  const arm = (s0: [number, number], a: [number, number], z: number): [number, number] => {
    const el = along(s0, a[0], 4.8);
    const hand = along(el, a[0] + a[1], 4.4);
    const part = c.newPart();
    c.capsule(s0[0], s0[1], el[0], el[1], 1.9, 1.6, { mat: M.shirt, z, part, tex: folds({ angle: rad(a[0]), spacing: 1.8, amp: 0.9, seed: 9 }) });
    c.capsule(el[0], el[1], hand[0], hand[1], 1.4, 1.2, { mat: M.skin, z, part: c.newPart() });
    // Sleeve cuff.
    c.ellipsoid(el[0], el[1], 1.5, 1.5, { mat: M.shirt, z: z + 0.3, part });
    c.ellipsoid(hand[0], hand[1], 1.45, 1.35, { mat: M.glove, z: z + 0.5, tex: knuckles });
    return hand;
  };
  arm(sh(-1), pose.armF, -2.5);

  leg([hx + 1.0, hy], pose.legN, 1.5, pose.footN ?? 0);

  // Torso: the shirt volume, the vest over it (open at the front), pockets, belt, pouches.
  const tp = c.newPart();
  const top: [number, number] = [neck[0], neck[1] + 2.6];
  c.capsule(hx + 0.2, hy - 2.4, top[0], top[1], 4.1, 4.6, { mat: M.shirt, z: 0, part: tp, round: 0.8 });
  const vp = c.newPart();
  c.capsule(hx + 0.2, hy - 2.2, top[0], top[1], 4.35, 4.85, {
    mat: M.vest,
    z: 0.6,
    part: vp,
    round: 0.8,
    tex: texAll(folds({ angle: 0.3, spacing: 2.6, amp: 0.7, cover: 0.4, seed: 12 }), (s) => {
      // Open front: the shirt shows between the vest's edges on the chest.
      if (s.v > 0.62 && s.u > 0.35) s.cut = true;
      // Quilted stitch rows at 4×.
      if (s.d >= 4 && Math.abs(((s.y + 0.3) / 2.2) % 1 - 0.5) < 0.06) s.tone -= 0.12;
    }),
  });
  // Chest pockets with flaps.
  const lean = rad(pose.lean);
  const px = top[0] + 0.6 + Math.sin(lean) * 3;
  const py = top[1] + 2.4;
  c.box(px - 1.4, py, 2.6, 2.6, { mat: M.vest, z: 1.4, bevel: 0.45, r: 0.3, tone: 0.02 });
  c.box(px - 1.6, py - 0.3, 3.0, 1.0, { mat: M.vest, z: 1.8, bevel: 0.3, r: 0.25, n: [0, -0.5, 0.86] });
  if (d >= 4) c.dot(px - 0.1, py + 0.25, PAL_HD.olive[1]);
  // Collar of the shirt.
  c.ellipsoid(neck[0] + 0.4, neck[1] + 1.6, 2.4, 1.2, { mat: M.shirt, z: 1.0 });
  // Belt with buckle, pouches.
  c.box(hx - 4.2, hy - 1.6, 8.6, 1.7, { mat: M.belt, z: 2, bevel: 0.4, r: 0.4, tex: (s) => { if (s.d >= 4 && Math.abs(s.v - 0.5) > 0.36) s.tone -= 0.1; } });
  c.box(hx + 2.3, hy - 1.75, 1.6, 2.0, { mat: M.buckle, z: 2.4, bevel: 0.35, r: 0.2 });
  c.box(hx - 3.8, hy - 0.4, 2.6, 2.8, { mat: M.vest, z: 2.6, bevel: 0.5, r: 0.5, tex: grime(3, 0.3) });
  c.box(hx - 4.0, hy - 0.6, 3.0, 0.9, { mat: M.vest, z: 2.9, bevel: 0.3, r: 0.3, n: [0, -0.5, 0.86] });

  // Head (prototype head contract), placed so HEAD_CENTER sits over the neck.
  const head = renderHeadHd(RECRUIT_HEAD, pose.flash ? 'shout' : 'normal', d);
  c.image(head, neck[0] + 0.8 - HEAD_CENTER[0], neck[1] - 4.6 - HEAD_CENTER[1], { z: 0.9 });

  // Near arm with the pistol.
  const hand = arm(sh(1), pose.armN, 4);
  const g = gunArt('pistol');
  const gun = gunArtHd('pistol', d);
  const gy = hand[1] - g.grip[1] - 0.2;
  const gx = hand[0] - g.grip[0] - 0.4;
  c.image(gun, gx, gy, { z: 3.5 });
  // The fist over the grip.
  c.ellipsoid(hand[0], hand[1], 1.45, 1.35, { mat: M.glove, z: 5, tex: knuckles });
  if (pose.flash) {
    const mx = gx + g.muzzle[0];
    const my = gy + g.muzzle[1] + 0.6;
    c.plane(mx, my - 2.2, 6, 4.4, {
      mat: M.flash,
      z: 6,
      mask: (x, y) => {
        const u = (x - mx) / 6;
        const v = (y - my) / 2.2;
        const star = 0.55 + 0.45 * Math.abs(Math.cos(Math.atan2(v, u) * 3));
        return u >= 0 && u * u + v * v < star * star * (1 - u * 0.6);
      },
      tex: (s) => {
        const u = (s.x - mx) / 6;
        const v = (s.y - my) / 2.2;
        s.tone = 0.55 - Math.sqrt(u * u + v * v) * 0.9;
      },
    });
  }
  return c.render({ outline, ao: 0.35 });
}

/** Knuckle ridges across the back of a glove (4×: three bumps). */
function knuckles(s: import('../src/game/art/hd/index').TexSample): void {
  if (s.u > 0.1 && s.v < -0.1) s.ny -= Math.abs(Math.sin(s.u * 9)) * 0.4;
}

// ------------------------------------------------------------------------------------------
// 2. Swan head and neck (vehicle/swan/neck frame: 31 × 42 logical)
// ------------------------------------------------------------------------------------------

const SWAN_W = 31;
const SWAN_H = 42;

function drawSwan(d: D, outline: Outline): PixelBuffer {
  const c = new HdCanvas(SWAN_W, SWAN_H, d);
  const plume = c.material({ ramp: PAL_HD.snow, wrap: 0.3, rim: 0.2, amb: 0.08, lo: 1, hi: 6 });
  const navy = c.material({ ramp: PAL_HD.denim, spec: 0.8, shine: 22, rim: 0.4, lo: 0, hi: 4, gain: 0.8 });
  const gold = c.material({ ramp: PAL_HD.gold, spec: 1, shine: 26 });
  const beak = c.material({ ramp: PAL_HD.orange, spec: 0.6, shine: 20, lo: 1, hi: 5 });
  const knob = c.material({ ramp: PAL_HD.black, spec: 0.7, shine: 18 });
  const steel = c.material({ ramp: PAL_HD.steel, spec: 1, shine: 30, rim: 0.4 });
  // Neck: an S from the collar (top left) down to the head (lower right).
  const pts: [number, number][] = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    const x = 8 + 11.5 * t + Math.sin(t * Math.PI) * 2.2;
    const y = 9 + 21 * t - Math.sin(t * Math.PI) * 1.2;
    pts.push([x, y]);
  }
  const neckPart = c.newPart();
  c.stroke(pts, 2.6, 2.2, {
    mat: plume,
    z: 0,
    part: neckPart,
    tex: (s) => {
      // Armoured neck rings (the Swan is a machine under its plumage): each ring a short lit
      // barrel, a dark seam between rings, small feather tips over the seam at 4×.
      const along = s.x * 0.47 + s.y * 0.88;
      const ring = along / 2.6;
      const f = ring - Math.floor(ring);
      s.ny += (f - 0.5) * 0.9;
      s.nx += (f - 0.5) * 0.45;
      if (f > 0.9) s.tone -= 0.45;
      else if (f < 0.12) s.tone += 0.08;
      if (s.d >= 4 && f > 0.78 && f <= 0.9 && Math.abs(Math.sin(s.v * 9)) > 0.75) s.tone -= 0.18;
    },
  });
  // Head: skull, cheek, the black knob, the orange beak with a steel gun tip.
  const hp = c.newPart();
  c.ellipsoid(19.4, 30.4, 4.3, 3.7, { mat: plume, z: 1.2, part: hp });
  c.ellipsoid(21.2, 32.6, 3.0, 2.4, { mat: plume, z: 1.4, part: hp });
  c.capsule(22.8, 33.4, 26.6, 37.6, 2.1, 1.1, {
    mat: beak,
    z: 1.6,
    tex: (s) => {
      // The nail / ridge line along the top of the beak.
      if (s.v < -0.55) s.tone += 0.12;
      if (s.d >= 4 && Math.abs(s.v - 0.15) < 0.06 && s.u > 0.2) s.tone -= 0.25;
    },
  });
  c.ellipsoid(22.9, 32.6, 1.4, 1.3, { mat: knob, z: 2.2 });
  c.capsule(26.4, 37.4, 27.6, 38.8, 0.75, 0.7, { mat: steel, z: 2.4 });
  c.paint(27.2, 38.4, 0.8, 0.8, (x, y) => ((x - 27.6) ** 2 + (y - 38.8) ** 2 < 0.16 ? PAL_HD.ink[0] : 0));
  // Goggle eye: a brass ring round a dark lens with a catch light.
  // As big as today's goggle (the Swan's identity): ring radius 2.2, lens 1.15.
  c.ellipsoid(20.6, 30.6, 2.2, 2.2, { mat: gold, z: 3 });
  c.paint(19.3, 29.3, 2.7, 2.7, (x, y) => {
    const q = (x - 20.65) ** 2 + (y - 30.65) ** 2;
    if (q > 1.15 * 1.15) return 0;
    if ((x - 20.2) ** 2 + (y - 30.2) ** 2 < 0.12 + 0.03 * (d - 2)) return PAL_HD.sky[7];
    return q < 0.7 * 0.7 ? PAL_HD.ink[0] : PAL_HD.navy[1];
  });
  // Navy armour collar at the base with gold rivets, a steel band under it.
  c.poly(
    [
      [3.8, 4.2],
      [10.2, 3.4],
      [12.0, 11.2],
      [6.0, 13.4],
    ],
    { mat: navy, z: 2, tone: -0.2, n: [-0.1, -0.15, 0.98], tex: (s) => { const e = Math.min(s.x - 3.8, 12 - s.x, s.y - 3.4, 13.4 - s.y); if (e < 0.6) s.tone += s.x < 7 || s.y < 6 ? 0.18 : -0.18; } },
  );
  c.box(5.2, 12.0, 6.4, 1.4, { mat: steel, z: 1.8, bevel: 0.4, r: 0.4 });
  for (const [rx, ry] of [
    [5.4, 5.6],
    [9.4, 5.0],
    [6.8, 11.0],
    [10.6, 9.8],
  ] as const) {
    c.ellipsoid(rx, ry, 0.55, 0.55, { mat: gold, z: 3 });
  }
  return c.render({ outline, ao: 0.35 });
}

// ------------------------------------------------------------------------------------------
// 3. Street crop (128 × 96 logical)
// ------------------------------------------------------------------------------------------

const ST_W = 128;
const ST_H = 96;
/** Ground line, quay edge and water line. */
const STREET_Y = 66;
const QUAY_Y = 76;
const WATER_Y = 80;

type Gable = 'neck' | 'step' | 'cornice' | 'bell';
interface House {
  x: number;
  w: number;
  /** Top of the wall body (the gable rises above it). */
  top: number;
  wall: 'brick' | 'brickDark' | 'wood' | 'plaster';
  gable: Gable;
  /** Door column (0 or 1) or none. */
  door: number | null;
  seed: number;
}

const HOUSES: readonly House[] = [
  { x: 1, w: 31, top: 16, wall: 'brickDark', gable: 'neck', door: null, seed: 11 },
  { x: 32, w: 27, top: 20, wall: 'wood', gable: 'step', door: 1, seed: 12 },
  { x: 59, w: 31, top: 24, wall: 'plaster', gable: 'cornice', door: 0, seed: 13 },
  { x: 90, w: 38, top: 14, wall: 'brick', gable: 'bell', door: null, seed: 14 },
];

function drawStreet(d: D, outline: Outline): PixelBuffer {
  const c = new HdCanvas(ST_W, ST_H, d);
  const sky = c.material({ ramp: PAL_HD.sky, flat: true, dither: true, lo: 2, hi: 7 });
  const mortar = c.material({ ramp: PAL_HD.stone, rim: 0, lo: 1, hi: 5 });
  const walls = {
    brick: c.material({ ramp: PAL_HD.brick, wrap: 0.1, rim: 0, lo: 1, hi: 6 }),
    brickDark: c.material({ ramp: PAL_HD.brickDark, wrap: 0.1, rim: 0, lo: 1, hi: 6 }),
    wood: c.material({ ramp: PAL_HD.rust, wrap: 0.1, rim: 0, lo: 1, hi: 5, spec: 0.15 }),
    plaster: c.material({ ramp: PAL_HD.plaster, rim: 0.05 }),
  };
  const trim = c.material({ ramp: PAL_HD.gable, rim: 0.1, spec: 0.15, shine: 10 });
  const glass = c.material({ ramp: PAL_HD.glass, flat: true, lo: 0, hi: 5 });
  const doorM = c.material({ ramp: PAL_HD.green, spec: 0.35, shine: 14, lo: 0, hi: 5 });
  const iron = c.material({ ramp: PAL_HD.black, spec: 0.7, shine: 18, rim: 0.4 });
  const lampGlow = c.material({ ramp: PAL_HD.gold, flat: true, lo: 3, hi: 6 });
  const bark = c.material({ ramp: PAL_HD.brown, rim: 0.3 });
  const leaf = c.material({ ramp: PAL_HD.green, wrap: 0.05, rim: 0.2, lo: 1, hi: 7, amb: 0.02 });
  const cobble = c.material({ ramp: PAL_HD.stone, spec: 0.2, shine: 8, lo: 1, hi: 5 });
  const grit = c.material({ ramp: PAL_HD.sand, lo: 0, hi: 3 });
  const kerb = c.material({ ramp: PAL_HD.stone, spec: 0.15, lo: 2, hi: 6 });
  const quay = c.material({ ramp: PAL_HD.brick, lo: 1, hi: 6 });
  const moss = c.material({ ramp: PAL_HD.moss });
  const water = c.material({ ramp: PAL_HD.canal, flat: true, dither: 0.2, lo: 0, hi: 7 });
  const hoist = c.material({ ramp: PAL_HD.wood, spec: 0.2 });

  // Sky: a vertical gradient with an ordered dither (the only dithered part besides the water).
  c.plane(0, 0, ST_W, STREET_Y, { mat: sky, z: -100, tex: (s) => { s.tone = 0.55 - s.y / 90 + (noise2(s.x, s.y * 2, 14, 3) - 0.5) * 0.12; } });

  // Windows: white frames with sashes, dark glass reflecting the sky, a sill.
  const win = (x: number, y: number, w: number, h: number): void => {
    c.box(x - 0.9, y - 0.9, w + 1.8, h + 1.8, { mat: trim, z: -7, bevel: 0.4 });
    c.plane(x, y, w, h, {
      mat: glass,
      z: -6.2,
      tex: (s) => {
        const u = (s.x - x) / w;
        const v = (s.y - y) / h;
        s.tone = -0.18 + (1 - u - v) * 0.22;
        const streak = Math.abs(u - v * 0.7 - 0.3);
        if (streak < 0.08) s.tone += 0.42;
        else if (streak < 0.13) s.tone += 0.2;
        if (s.y - y < 0.9) s.tone -= 0.3;
      },
    });
    c.box(x + w / 2 - 0.35, y, 0.7, h, { mat: trim, z: -5.6, bevel: 0.25 });
    c.box(x, y + h * 0.45 - 0.35, w, 0.7, { mat: trim, z: -5.6, bevel: 0.25 });
    c.box(x - 1.3, y + h + 0.7, w + 2.6, 0.9, { mat: trim, z: -5.4, bevel: 0.3, n: [0, -0.5, 0.86] });
  };

  for (const h of HOUSES) {
    const wallM = walls[h.wall];
    const tex =
      h.wall === 'plaster'
        ? plaster({ seed: h.seed, cracks: 0.35, stains: 0.6 })
        : h.wall === 'wood'
          ? wood({ seed: h.seed, dir: 'h', plank: 1.5 })
          : brick({ mortar, bw: 3, bh: 1.5, joint: 0.5, wear: 0.6, seed: h.seed });
    const cx = h.x + h.w / 2;
    const pts: [number, number][] = [[h.x, STREET_Y], [h.x, h.top]];
    if (h.gable === 'neck' || h.gable === 'bell') {
      const nw = h.w * 0.46;
      pts.push([cx - nw / 2, h.top], [cx - nw / 2, h.top - 11], [cx + nw / 2, h.top - 11], [cx + nw / 2, h.top]);
    } else if (h.gable === 'step') {
      const st = h.w / 6;
      for (let k = 0; k < 3; k++) pts.push([h.x + st * k, h.top - 4 * k], [h.x + st * k, h.top - 4 * (k + 1)]);
      for (let k = 2; k >= 0; k--) pts.push([h.x + h.w - st * k, h.top - 4 * (k + 1)], [h.x + h.w - st * k, h.top - 4 * k]);
    }
    pts.push([h.x + h.w, h.top], [h.x + h.w, STREET_Y]);
    c.poly(pts, { mat: wallM, z: -10, tex });
    // Gable trim.
    if (h.gable === 'neck' || h.gable === 'bell') {
      const nw = h.w * 0.46;
      for (const sg of [-1, 1]) {
        const ex = cx + (sg * nw) / 2;
        c.plane(Math.min(ex, ex + sg * 6), h.top - 7, 6, 7, {
          mat: trim,
          z: -9,
          mask: (x, y) => {
            const u = (x - ex) * sg;
            return u >= 0 && u < 6 && y > h.top - 7 + (u * u) / 5.2;
          },
          tex: (s) => {
            s.nx += -sg * 0.35;
            s.ny -= 0.45;
            // A carved scroll at 4×.
            if (s.d >= 4 && Math.hypot((s.x - (ex + sg * 2.2)), s.y - (h.top - 2.2)) < 0.9) s.tone -= 0.3;
          },
        });
      }
      c.box(cx - nw / 2 - 1, h.top - 12.5, nw + 2, 1.8, { mat: trim, z: -8, bevel: 0.5 });
      if (h.gable === 'bell') c.ellipsoid(cx, h.top - 13.4, nw / 2, 3, { mat: trim, z: -8.5, round: 0.6 });
      else c.poly([[cx - nw / 2, h.top - 12.4], [cx, h.top - 16.5], [cx + nw / 2, h.top - 12.4]], { mat: trim, z: -8.5, n: [0, -0.4, 0.9] });
      c.box(cx - 0.6, h.top - 11, 1.2, 2.2, { mat: hoist, z: -7, bevel: 0.35, tex: wood({ seed: 4, dir: 'v' }) });
      win(cx - 2.6, h.top - 8.5, 5.2, 6.5);
    } else if (h.gable === 'step') {
      const st = h.w / 6;
      for (let k = 0; k < 3; k++) {
        c.box(h.x + st * k - 0.5, h.top - 4 * (k + 1) - 0.6, st + 0.6, 1.2, { mat: trim, z: -8.5, bevel: 0.4 });
        c.box(h.x + h.w - st * (k + 1) - 0.1, h.top - 4 * (k + 1) - 0.6, st + 0.6, 1.2, { mat: trim, z: -8.5, bevel: 0.4 });
      }
      win(cx - 2.4, h.top - 10, 4.8, 6);
    } else {
      c.box(h.x - 0.6, h.top - 2.6, h.w + 1.2, 2.8, { mat: trim, z: -8, bevel: 0.6, n: [0, -0.3, 0.95] });
      c.ellipsoid(cx, h.top - 3.6, 4, 2.2, { mat: trim, z: -8.4, round: 0.7 });
    }
    c.box(h.x - 0.3, h.top - 0.6, h.w + 0.6, 1.2, { mat: trim, z: -8, bevel: 0.4, n: [0, -0.3, 0.95] });
    // Two window columns, two floors; the ground floor has a door in one column.
    const cols = [h.x + h.w * 0.27, h.x + h.w * 0.73];
    const ww = Math.min(7, h.w * 0.26);
    for (let ci = 0; ci < 2; ci++) {
      const wx = cols[ci] - ww / 2;
      for (let fl = 0; fl < 2; fl++) win(wx, h.top + 4 + fl * 13, ww, 9);
      if (h.door === ci) {
        const dw = ww + 0.6;
        const dx = cols[ci] - dw / 2;
        c.box(dx - 0.8, STREET_Y - 16.5, dw + 1.6, 16.5, { mat: trim, z: -7, bevel: 0.4 });
        c.box(dx, STREET_Y - 12.4, dw, 12.4, { mat: doorM, z: -6.4, bevel: 0.5, tex: wood({ seed: h.seed, dir: 'v', plank: 1.6 }) });
        c.plane(dx, STREET_Y - 15.6, dw, 2.6, { mat: glass, z: -6.2, mask: (x, y) => Math.hypot((x - dx - dw / 2) / (dw / 2), (y - (STREET_Y - 13)) / 2.6) < 1, tex: (s) => { s.tone = 0.05 + (STREET_Y - 13 - s.y) * 0.08; } });
        c.dot(dx + dw - 1.2, STREET_Y - 6, PAL_HD.gold[5]);
      } else win(wx, STREET_Y - 11, ww, 8.5);
    }
  }

  // Street: cobbles, a kerb.
  c.plane(0, STREET_Y, ST_W, QUAY_Y - STREET_Y - 2, { mat: cobble, z: -20, tone: -0.12, normal: (_x, _y, n) => { n[0] = 0; n[1] = -0.3; n[2] = 0.95; }, tex: cobbles({ gap: grit, cw: 3.2, ch: 2.0, seed: 9 }) });
  c.box(0, QUAY_Y - 2, ST_W, 2.4, { mat: kerb, z: -19, bevel: 0.6, n: [0, -0.4, 0.9], tex: (s) => { if (((s.x / 9) % 1) < 0.05) s.tone -= 0.3; } });
  // Quay wall: brick with moss near the water line.
  c.box(0, QUAY_Y + 0.4, ST_W, WATER_Y - QUAY_Y + 3, {
    mat: quay,
    z: -21,
    tex: texAll(brick({ mortar, bw: 4, bh: 1.5, joint: 0.5, wear: 0.9, seed: 13 }), (s) => {
      if (s.y > WATER_Y - 1 + noise2(s.x, 0, 3, 2) * 1.5 && noise2(s.x, s.y, 1.5, 7) > 0.45) {
        s.mat = moss;
        s.tone += 0.05;
      }
    }),
  });
  // Canal water: the houses' mirror image wobbling by row, the quay's shadow, glints on crests.
  c.plane(0, WATER_Y + 1, ST_W, ST_H - WATER_Y - 1, {
    mat: water,
    z: -30,
    tex: (s) => {
      const wob = Math.sin(s.y * 2.1 + noise2(s.x, s.y, 6, 4) * 4) * 0.9;
      const rx = s.x + wob;
      const ry = 2 * (WATER_Y + 1) - s.y;
      let t = 0.12;
      for (const h of HOUSES) if (rx >= h.x && rx < h.x + h.w && ry > h.top) t = h.wall === 'plaster' ? -0.02 : -0.26;
      if ((rx - 98) ** 2 / 300 + (ry - 24) ** 2 / 200 < 1 && ry < 42) t = -0.32;
      t -= Math.max(0, 1 - (s.y - WATER_Y) / 3) * 0.25;
      const f = Math.sin((s.y + noise2(s.x * 0.3, s.y, 3, 7) * 2.5) * 2.6);
      t += f * 0.08;
      if (f > 0.85 && noise2(s.x * 0.5, s.y * 2, 2, 11) > 0.62) t += 0.4;
      s.tone = t - 0.12;
    },
  });

  // The elm in front of the plaster house: trunk, branches, a canopy of leaf clumps.
  c.capsule(98, STREET_Y + 1, 97, 36, 1.8, 1.3, { mat: bark, z: 5, tex: texAll(wood({ seed: 8, dir: 'v' }), grime(4, 0.5, 2)) });
  c.capsule(97.5, 44, 90, 34, 0.9, 0.6, { mat: bark, z: 4.8 });
  c.capsule(97.5, 42, 105, 32, 0.9, 0.6, { mat: bark, z: 4.8 });
  const tp = c.newPart();
  for (const [cx, cy, rx, ry] of [
    [98, 24, 17, 14],
    [86, 32, 9, 8],
    [110, 32, 10, 8],
    [96, 14, 10, 8],
  ] as const) {
    c.ellipsoid(cx, cy, rx, ry, { mat: leaf, z: 6, part: tp, tex: leaves({ size: 2.6, seed: 2, ragged: 0.7 }), round: 0.9 });
  }
  // A bollard and the street lamp (cast-iron post, lantern with a warm glow).
  c.cylinder(24, STREET_Y - 4, 2.2, 5.5, { mat: iron, z: 2, cap: 1.1 });
  const lx = 60;
  c.cylinder(lx - 1, 30, 2, STREET_Y + 1 - 30, { mat: iron, z: 3, tex: (s) => { if (Math.abs(((s.y - 30) / 8) % 1 - 0.5) < 0.05) s.tone += 0.3; } });
  c.box(lx - 2, STREET_Y - 4, 4, 5, { mat: iron, z: 3.2, bevel: 0.6, r: 0.4 });
  c.poly([[lx - 3.4, 22], [lx + 3.4, 22], [lx + 2.2, 30], [lx - 2.2, 30]], { mat: lampGlow, z: 3.4, tex: (s) => { s.tone = 0.55 - Math.abs(s.x - lx) * 0.07 + (s.y - 22) * 0.01; } });
  c.box(lx - 4, 20.4, 8, 1.8, { mat: iron, z: 3.6, bevel: 0.5, r: 0.5 });
  c.poly([[lx - 2.6, 20.6], [lx, 16.5], [lx + 2.6, 20.6]], { mat: iron, z: 3.5, n: [0.2, -0.5, 0.85] });
  c.box(lx - 3, 29.6, 6, 1.4, { mat: iron, z: 3.6, bevel: 0.4 });
  return c.render({ outline, ao: 0.3, sepZ: 0.4, shadow: 0.3, shadowMax: 3 });
}

// ------------------------------------------------------------------------------------------
// Today's art (for comparison)
// ------------------------------------------------------------------------------------------

/** Today's recruit (legs + pistol torso composed at the hip) at 2×, frame `fi` of the strips. */
function todayHero(name: string): PixelBuffer {
  const legsId = name === 'run' ? 'char/recruit/legs-run' : 'char/recruit/legs-idle';
  const torsoId = name === 'run' ? 'char/recruit/torso-pistol-run' : name === 'shoot' ? 'char/recruit/torso-pistol-shoot' : 'char/recruit/torso-pistol-idle';
  const legs = getFrames(legsId, 2)[name === 'run' ? 3 : 0];
  const torso = getFrames(torsoId, 2)[0];
  const b = new PixelBuffer(HERO_W * 2, HERO_H * 2);
  const hip = legs.pts?.hip ?? [0, -16];
  const ax = 16;
  const ay = HERO_H - 3;
  b.blit(legs.buf, (ax - legs.ox) * 2, (ay - legs.oy) * 2);
  b.blit(torso.buf, (ax + hip[0] - torso.ox) * 2, (ay + hip[1] - torso.oy) * 2);
  return b;
}

function todaySwan(): PixelBuffer {
  return getFrames('vehicle/swan/neck', 2)[0].buf;
}

/** Minimal PNG reader (8-bit RGBA / RGB, non-interlaced) for today's street shot. */
function readPNG(file: string): PixelBuffer {
  const buf = readFileSync(file);
  let p = 8;
  let w = 0;
  let h = 0;
  let ct = 6;
  const idat: Buffer[] = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p);
    const type = buf.toString('latin1', p + 4, p + 8);
    const data = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0);
      h = data.readUInt32BE(4);
      ct = data[9];
    } else if (type === 'IDAT') idat.push(data);
    p += 12 + len;
  }
  const bpp = ct === 6 ? 4 : 3;
  const raw = inflateSync(Buffer.concat(idat));
  const stride = w * bpp;
  const out = new Uint8Array(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    for (let x = 0; x < stride; x++) {
      const v = raw[y * (stride + 1) + 1 + x];
      const a = x >= bpp ? out[y * stride + x - bpp] : 0;
      const b = y > 0 ? out[(y - 1) * stride + x] : 0;
      const cc = x >= bpp && y > 0 ? out[(y - 1) * stride + x - bpp] : 0;
      let r = v;
      if (f === 1) r = v + a;
      else if (f === 2) r = v + b;
      else if (f === 3) r = v + ((a + b) >> 1);
      else if (f === 4) {
        const pp = a + b - cc;
        const pa = Math.abs(pp - a);
        const pb = Math.abs(pp - b);
        const pc = Math.abs(pp - cc);
        r = v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : cc);
      }
      out[y * stride + x] = r & 255;
    }
  }
  const pb = new PixelBuffer(w, h);
  for (let i = 0; i < w * h; i++) {
    const o = i * bpp;
    pb.data[i] = ((out[o] << 24) | (out[o + 1] << 16) | (out[o + 2] << 8) | (bpp === 4 ? out[o + 3] : 255)) >>> 0;
  }
  return pb;
}

/** Today's ams section a street at 2× (a shot at res 2, art 2), cropped to the same 128 × 96 logical window. */
function todayStreet(out: string): PixelBuffer | null {
  const file = join(out, 'today-ams-a-res2.png');
  try {
    if (!existsSync(file)) {
      execFileSync('npx', ['tsx', 'tools/shot.ts', '--mission', 'ams', '--section', 'a', '--res', '2', '--art', '2', '--ticks', '240', '--out', file], { stdio: 'ignore' });
    }
    const shot = readPNG(file);
    // The frame sits at (4k, 14k) = (8, 28) in the shot sheet; window: logical x 150..278, y 96..192.
    return shot.crop(8 + 150 * 2, 28 + 96 * 2, ST_W * 2, ST_H * 2);
  } catch (e) {
    console.warn(`today's street shot failed: ${String(e)}`);
    return null;
  }
}

// ------------------------------------------------------------------------------------------
// Sheets
// ------------------------------------------------------------------------------------------

const BG: Color = 0x2a2f3cff;

interface Cell {
  label: string;
  /** Buffer and its px per logical px. */
  buf: PixelBuffer;
  dens: number;
}

/** A row of cells at `scale` sheet px per logical px (each buffer enlarged by scale / dens, nearest). */
function sheet(title: string, rows: ReadonlyArray<ReadonlyArray<Cell>>, scale: number, bg: Color = BG): PixelBuffer {
  const pad = 8;
  const lh = 14;
  let W = 0;
  let H = 20;
  for (const r of rows) {
    let w = pad;
    let h = 0;
    for (const c of r) {
      const k = scale / c.dens;
      w += c.buf.w * k + pad;
      h = Math.max(h, c.buf.h * k);
    }
    W = Math.max(W, w);
    H += h + lh + pad;
  }
  const b = new PixelBuffer(W, H).fill(SHEET.bg);
  drawText(b, title, pad, 6, { color: SHEET.title });
  let y = 20;
  for (const r of rows) {
    let x = pad;
    let h = 0;
    for (const c of r) {
      const k = scale / c.dens;
      const img = k > 1 ? c.buf.scaled(k) : c.buf;
      b.rect(x, y + lh, img.w, img.h, bg);
      b.blit(img, x, y + lh);
      drawText(b, c.label, x, y + 3, { color: SHEET.label });
      x += img.w + pad;
      h = Math.max(h, img.h);
    }
    y += h + lh + pad;
  }
  return b;
}

/** The PAL_HD sheet: every ramp with a lit ball and a dithered cylinder (also `npm run sprites -- --palette-hd`). */
export function paletteHdSheet(): PixelBuffer {
  const sw = 22;
  const rowH = 18;
  const W = 120 + 8 * sw + 150;
  const H = 30 + HD_RAMP_NAMES.length * rowH + 10;
  const b = new PixelBuffer(W, H).fill(SHEET.bg);
  drawText(b, `PAL_HD  ${HD_PALETTE.length} colours, ${HD_RAMP_NAMES.length} ramps (dark -> light)`, 8, 6, { color: SHEET.title });
  let y = 26;
  for (const n of HD_RAMP_NAMES) {
    const r = PAL_HD[n];
    drawText(b, n, 8, y + 5, { color: SHEET.label });
    r.forEach((c, i) => b.rect(80 + i * sw, y + 1, sw - 1, rowH - 2, c));
    // A lit ball and a lit cylinder with this ramp (the kit's light, density 2).
    const c = new HdCanvas(8, 8, 2);
    const m = c.material({ ramp: r, spec: 0.6, shine: 20 });
    c.ellipsoid(4, 4, 3.6, 3.6, { mat: m });
    b.blit(c.render({ outline: 'A' }), 80 + 8 * sw + 8, y);
    const c2 = new HdCanvas(30, 8, 2);
    const m2 = c2.material({ ramp: r, dither: true });
    c2.cylinder(0.5, 0.5, 29, 7, { mat: m2, axis: 'h' });
    b.blit(c2.render({ outline: 'none' }), 80 + 8 * sw + 30, y);
    y += rowH;
  }
  return b;
}

// ------------------------------------------------------------------------------------------

function ms(t0: bigint): number {
  return Number(process.hrtime.bigint() - t0) / 1e6;
}

async function main(): Promise<void> {
  const a = parseArgs(process.argv.slice(2));
  mkdirSync(a.out, { recursive: true });
  await loadContent();
  const files: string[] = [];
  const times: string[] = [];
  const save = (b: PixelBuffer, name: string, scale = 1): void => {
    savePNG(b, join(a.out, name), scale);
    files.push(name);
  };
  const want = (s: string): boolean => a.only === null || a.only === s;

  if (a.palette || a.only === null) save(paletteHdSheet(), 'palette-hd.png');

  for (const d of [2, 4] as const) {
    const scale = d === 4 ? 4 : 2;
    if (want('hero')) {
      const rows: Cell[][] = [];
      for (const pose of POSES) {
        const row: Cell[] = [{ label: `today 2x ${pose.name}`, buf: todayHero(pose.name), dens: 2 }];
        for (const v of VARIANTS) {
          const t0 = process.hrtime.bigint();
          const buf = drawHero(pose, d, v);
          times.push(`hero ${pose.name} ${d}x ${v}: ${ms(t0).toFixed(1)} ms`);
          row.push({ label: `${d}x ${v}`, buf, dens: d });
          if (v === 'A') save(buf, `hero-${pose.name}@${d}x-real.png`);
        }
        rows.push(row);
      }
      save(sheet(`HERO (recruit colours) ${d}x vs today 2x - outline A / B / C`, rows, scale), `hero@${d}x.png`);
    }
    if (want('gear')) {
      const PROPS: PropKind[] = ['umbrella', 'needles', 'pan', 'wrench', 'plan', 'pistol-butt', 'plunger', 'airliner', 'frikandel'];
      const pairs: Array<[string, PixelBuffer, PixelBuffer]> = [
        ['pistol', gunArtHi('pistol'), gunArtHd('pistol', d)],
        ['heavy', gunArtHi('heavy'), gunArtHd('heavy', d)],
        ['rifle', gunArtHi('rifle'), gunArtHd('rifle', d)],
        ['knife', knifeArtHi(), knifeArtHd(d)],
        ['grenade', heldArtHi('grenade'), heldArtHd('grenade', d)],
        ['gift', heldArtHi('gift'), heldArtHd('gift', d)],
        ['snack', heldArtHi('snack'), heldArtHd('snack', d)],
        ...PROPS.map((k): [string, PixelBuffer, PixelBuffer] => [k, propArtHi(k), propArtHd(k, d)]),
        ['head', renderHeadHi({ ...RECRUIT_HEAD, skin: PAL_HD.skinA }, 'normal'), renderHeadHd(RECRUIT_HEAD, 'normal', d)],
      ];
      const rows: Cell[][] = [];
      for (let i = 0; i < pairs.length; i += 4) {
        rows.push(pairs.slice(i, i + 4).flatMap(([n, a, b]) => [{ label: `today ${n}`, buf: a, dens: 2 }, { label: `${d}x`, buf: b, dens: d }]));
      }
      save(sheet(`GEAR + HEAD contracts ${d}x vs today 2x (prototypes; no outline)`, rows, scale), `gear@${d}x.png`);
    }
    if (want('swan')) {
      const row: Cell[] = [{ label: 'today 2x', buf: todaySwan(), dens: 2 }];
      for (const v of VARIANTS) {
        const t0 = process.hrtime.bigint();
        const buf = drawSwan(d, v);
        times.push(`swan neck ${d}x ${v}: ${ms(t0).toFixed(1)} ms`);
        row.push({ label: `${d}x ${v}`, buf, dens: d });
      }
      save(sheet(`SWAN head + neck ${d}x vs today 2x - outline A / B / C`, [row], scale), `swan@${d}x.png`);
    }
    if (want('street')) {
      const today = todayStreet(a.out);
      const rows: Cell[][] = [];
      for (const v of VARIANTS) {
        const t0 = process.hrtime.bigint();
        const buf = drawStreet(d, v);
        times.push(`street ${d}x ${v}: ${ms(t0).toFixed(1)} ms`);
        const row: Cell[] = [];
        if (today && v === 'A') row.push({ label: 'today 2x (ams a)', buf: today, dens: 2 });
        row.push({ label: `${d}x ${v}`, buf, dens: d });
        rows.push(row);
        if (v === 'A') save(buf, `street@${d}x-real.png`);
      }
      save(sheet(`STREET 128x96 ${d}x vs today 2x - outline A / B / C`, rows, scale), `street@${d}x.png`);
    }
  }
  const md = [
    '# UHD style spike (npm run uhd-spike)',
    '',
    'Plan: uhd-arcade-fidelity, group found (KIT). Kit: src/game/art/hd/, palette: src/engine/palette-hd.ts,',
    'docs/ART_GUIDE.md "UHD art". Sheets show 4 sheet px per logical px at 4x (today\'s 2x art enlarged 2 x 2)',
    'and 2 sheet px per logical px at 2x. `*-real.png` files are single frames at their real size.',
    '',
    '## Files',
    '',
    ...files.map((f) => `- ${f}`),
    '',
    '## Generation times (node, one thread)',
    '',
    ...times.map((t) => `- ${t}`),
    '',
  ].join('\n');
  writeFileSync(join(a.out, 'index.md'), md);
  console.log(`${files.length} PNG(s) -> ${a.out}/ (index.md)`);
  for (const t of times) console.log(`  ${t}`);
}

// Run only as the entry (tools/sprites.ts imports paletteHdSheet).
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
