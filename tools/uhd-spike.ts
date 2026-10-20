/**
 * npm run uhd-spike -- [--out tmp/uhd-style] [--palette] [--only hero|swan|street|gear]
 *
 * The UHD STYLE SPIKE (plan uhd-arcade-fidelity, groups found + style; docs/ART_GUIDE.md "UHD
 * art"): renders, at 2× AND 4×, with the HD kit (src/game/art/hd/) and nothing registered in the game:
 *   1. today's recruit as an HD hero — idle, one run frame, shooting — from soft cloth volumes
 *      (`blob` over `limb` outlines: vest over the tan shirt, sleeves with an elbow fold and a cuff,
 *      cargo trousers, chunky boots, black gloves), the head contract `renderHeadHd` and `gunArtHd`;
 *   2. the Swan's head and neck (white plumage, the steel and orange parts, the navy collar);
 *   3. a 128 × 96 logical ams street crop (canal houses with varied façades and gables, the canal
 *      behind the street railing, a bench, a bike, a flower box, a bollard, a lamp, an elm);
 * each next to the GAME's registered art of the same subject ("game 2x": since the UHD wave the
 * registered 2× art is the HD art itself; the gear and head contracts next to their 1× art), in
 * the decided outline (style decisions: A for sprites, none for the painted background with C on
 * its façade decor), plus ONE hero A vs B sheet. Sheets: <out>/<subject>@<d>x.png (4 sheet px per logical px at 4×, 2 at 2×), frames at
 * real size, the HD palette sheet <out>/palette-hd.png (--palette, or always when nothing else is
 * asked), and <out>/index.md (what changed, every PNG, generation times).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';
import type { Color } from '../src/engine/color';
import { drawText, measureText } from '../src/engine/font';
import { HD_PALETTE, HD_RAMP_NAMES, PAL_HD } from '../src/engine/palette-hd';
import { PixelBuffer } from '../src/engine/pixel';
import { getFrames } from '../src/engine/sprites';
import { HdCanvas, type Outline, along, brick, gunArtHd, lerpPt, limb, heldArtHd, knifeArtHd, leaves, plaster, propArtHd, renderHeadHd, wood, grime, texAll } from '../src/game/art/hd/index';
import type { HeadStyle } from '../src/game/art/humanoid-head';
import { HEAD_CENTER, HEAD_H, HEAD_W } from '../src/game/art/humanoid-head';
import { giftArt, grenadeArt, gunArt, knifeArt, propArt, snackArt, type PropKind } from '../src/game/art/humanoid-gear';
import { noise2 } from '../src/game/art/paint';
import { loadContent } from '../src/game/content/index';
import { SHEET, savePNG } from './lib/image';

type D = 2 | 4;
/** The top of index.md: what changed in the last style round. */
const CHANGES: readonly string[] = [
  '## What changed (style round 1: lead feedback)',
  '',
  '- Outlines per the style decisions: A for the hero, the Swan and the gear; the street has NO ink outline',
  '  (sky, houses, water, terrain), its facade decor (lamp, tree, bench, bike, flower box, bollard) has C.',
  '  hero-outline-ab.png keeps one A vs B comparison.',
  "- Hero = today's recruit: big head (today's head point and size), side-parted brown hair in locks with a",
  '  fringe and the ear showing, light face, bigger eye; the olive vest (yoke, side strap, D-ring, pockets,',
  '  zip, quilting at 4x) over the tan shirt (collar, sleeves); darker grey-brown cargo trousers with a thigh',
  '  pocket; chunky brown boots with toe caps and soles; black gloves (fist with finger rows and knuckles at',
  '  4x, a thumb at 2x and 4x).',
  '- Hero shapes are soft cloth volumes (HdCanvas.blob over limb outlines), not tubes: sleeves with an',
  '  elbow bend, a fold in the bend and a rolled cuff; idle stands on the near leg with the far knee bent.',
  '- Hero shading: 5-6 hard bands per material (no fold / strand textures: no stripe banding), the light',
  '  cluster upper left, the deep core on the right, a thin cool rim px on the shadow edge (rimLight).',
  "- Street: today's ams identity - orange-red, dark green, cream, black, dark brick and red facades;",
  '  step, neck, bell and spout gables; white frames with glazing bars; the canal BEHIND the street',
  '  railing with dark facade reflections broken by ripples; a bench, a bike, a flower box with tulips, an',
  '  XXX bollard, the lamp; an elm of irregular leaf clusters with gaps and branches; a sky gradient',
  '  with painted clouds (dither only at the band borders).',
  '- Swan unchanged (outline A only).',
  '- Verifier: near-white sky glints (short horizontal dashes) on the open canal water; the gear sheet',
  "  compares with today's real recruit head (cut from today's idle frame) and labels no longer overlap;",
  '  times are cold and warm (median of 5); the kit renders a 4x hero frame in about 3 ms warm (was 6-7:',
  '  heightField evaluates the field once per art px, the outline skips px with nothing drawn near them).',
];

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
export interface HeroPose {
  name: string;
  /** Hip position (logical, in the 40 × 42 hero frame). */
  hip: [number, number];
  /** Torso lean (deg, + forward). */
  lean: number;
  /** Thigh, shin (absolute angles). */
  legN: [number, number];
  legF: [number, number];
  /** Upper arm, forearm (absolute angles). */
  armN: [number, number];
  armF: [number, number];
  /** Gun held by the near hand: angle of the gun (deg, 0 = forward). */
  gun: number;
  /** Muzzle flash. */
  flash?: boolean;
  /** Foot tilt near / far (deg, + = toe up). */
  footN?: number;
  footF?: number;
}

const HERO_W = 40;
const HERO_H = 42;

/**
 * Today's recruit proportions (char/recruit/ at 2×): ground at y 39, hip at y 23, head top at
 * y 2.5 (the head is a third of the figure), chunky 8-px boots, the pistol fist at chest height.
 */
export const POSES: readonly HeroPose[] = [
  // Idle: the weight on the near leg (straight), the far knee relaxed forward, the far boot back.
  { name: 'idle', hip: [16, 23], lean: 3, legN: [7, 3], legF: [-2, -16], armN: [14, 98], armF: [20, 92], gun: 0, footF: 4 },
  { name: 'run', hip: [16, 22.5], lean: 12, legN: [48, -12], legF: [-30, -78], armN: [20, 100], armF: [-40, 40], gun: -6, footN: 8, footF: -22 },
  { name: 'shoot', hip: [15, 23], lean: 5, legN: [16, -6], legF: [-12, -2], armN: [76, 92], armF: [70, 96], gun: 0, flash: true },
];

function rad(a: number): number {
  return (a * Math.PI) / 180;
}

/** Rotate a torso-local point (x forward, y down from the hip) by the lean and place it at the hip. */
function tp(hip: readonly [number, number], lean: number, x: number, y: number): [number, number] {
  const a = rad(lean);
  return [hip[0] + x * Math.cos(a) - y * Math.sin(a), hip[1] + x * Math.sin(a) + y * Math.cos(a)];
}

/** A boot / hand shape in local coordinates (x forward), rotated by `a` deg and placed at p. */
function place(pts: ReadonlyArray<readonly [number, number]>, p: readonly [number, number], a: number): Array<[number, number]> {
  const r = rad(-a);
  const ca = Math.cos(r);
  const sa = Math.sin(r);
  return pts.map(([x, y]) => [p[0] + x * ca - y * sa, p[1] + x * sa + y * ca] as [number, number]);
}

const BOOT: ReadonlyArray<readonly [number, number]> = [
  [-1.9, -1.6], [1.6, -1.6], [2.1, 0.0], [3.6, 0.9], [5.1, 1.5], [5.8, 2.4], [5.7, 3.4], [-2.2, 3.4], [-2.4, 0.8],
];
const SOLE: ReadonlyArray<readonly [number, number]> = [[-2.5, 3.0], [5.9, 3.0], [6.0, 3.6], [5.6, 4.3], [-2.5, 4.3]];
const TOECAP: ReadonlyArray<readonly [number, number]> = [[2.8, 0.6], [4.4, 1.0], [5.5, 1.8], [5.8, 2.6], [5.6, 3.2], [2.6, 3.2]];

export function drawHero(pose: HeroPose, d: D, outline: Outline, rim = 2): PixelBuffer {
  const c = new HdCanvas(HERO_W, HERO_H, d);
  const M = {
    pants: c.material({ ramp: PAL_HD.stone, lo: 1, hi: 4, wrap: 0, rim: 0.05 }),
    pantsFar: c.material({ ramp: PAL_HD.stone, lo: 0, hi: 3, wrap: 0, rim: 0.05 }),
    boots: c.material({ ramp: PAL_HD.brown, spec: 0.5, shine: 18, wrap: 0, rim: 0.05 }),
    shirt: c.material({ ramp: PAL_HD.sand, lo: 3, hi: 6, amb: 0.3, wrap: 0.1, rim: 0.05 }),
    vest: c.material({ ramp: PAL_HD.olive, lo: 1, hi: 6, wrap: 0, rim: 0.05 }),
    strap: c.material({ ramp: PAL_HD.olive, lo: 0, hi: 4, wrap: 0, rim: 0.05 }),
    belt: c.material({ ramp: PAL_HD.brown, lo: 0, hi: 4, spec: 0.35, shine: 14 }),
    buckle: c.material({ ramp: PAL_HD.gold, spec: 1, shine: 26 }),
    glove: c.material({ ramp: PAL_HD.black, lo: 0, hi: 3, spec: 0.55, shine: 16, wrap: 0, rim: 0.05 }),
    skin: c.material({ ramp: PAL_HD.skinA, lo: 2, hi: 5, spec: 0.2, shine: 18, wrap: 0.1, rim: 0.05 }),
    sole: c.material({ ramp: PAL_HD.ink, lo: 0, hi: 1, rimPx: false }),
    flash: c.material({ ramp: PAL_HD.fire, flat: true, lo: 0, hi: 7 }),
  };
  const hip = pose.hip;
  const L = pose.lean;
  const T = (x: number, y: number): [number, number] => tp(hip, L, x, y);

  // ---- Legs: trouser leg (thigh, knee, shin, a cuff bunched over the boot), then the boot. ----
  const leg = (h0: [number, number], a: [number, number], z: number, foot: number, far: boolean): void => {
    const knee = along(h0, a[0], 6.0);
    const ankle = along(knee, a[1], 5.0);
    const mat = far ? M.pantsFar : M.pants;
    const part = c.newPart();
    c.blob(limb([h0, knee, along(ankle, a[1], -0.6)], [2.9, 2.5, 2.45], 0), 1.3, { mat, z, part, bulge: 0.35 });
    // The knee: a crease cluster on the inside of the bend, a lit cap on the outside.
    const bend = a[0] - a[1];
    if (Math.abs(bend) > 6 && d >= 4) {
      const s = Math.sign(bend);
      const kin = along(knee, a[1] + 90 * s, 1.0);
      c.shade(kin[0] - 1.6, kin[1] - 1.6, 3.2, 3.2, (x, y) => (Math.hypot(x - kin[0], (y - kin[1]) * 1.6) < 0.75 ? -0.35 : 0), part);
    }
    // Fold clusters: two short creases across the shin above the boot (the cloth bunches).
    for (const t of [] as number[]) {
      const p = lerpPt(knee, ankle, t);
      c.shade(p[0] - 2.2, p[1] - 1, 4.4, 2, (x, y) => {
        const along2 = (x - p[0]) * Math.cos(rad(a[1])) - (y - p[1]) * Math.sin(rad(a[1]));
        const across = (x - p[0]) * Math.sin(rad(a[1])) + (y - p[1]) * Math.cos(rad(a[1]));
        return Math.abs(across - along2 * 0.35) < 0.28 && along2 > -0.4 ? -0.3 : 0;
      }, part);
    }
    if (!far && d >= 4) {
      // Cargo pocket on the thigh with its flap.
      const pc = lerpPt(h0, knee, 0.55);
      const pk = place([[-1.3, -1.2], [1.3, -1.2], [1.4, 1.3], [-1.2, 1.4]], pc, -a[0]);
      c.blob(pk, 0.35, { mat, z: z + 1.4, bulge: 0.15, tone: -0.03 });
      const fl = place([[-1.5, -1.5], [1.5, -1.5], [1.5, -0.6], [-1.5, -0.6]], pc, -a[0]);
      c.blob(fl, 0.3, { mat, z: z + 1.7, bulge: 0.1, tone: 0.03 });
    }
    // Boot: shaft, foot, toe cap, a padded collar, the sole, laces at 4×.
    const fa = foot;
    const bp = c.newPart();
    const boot = place(BOOT, ankle, fa);
    c.blob(boot, 1.0, { mat: M.boots, z: z - 0.4, part: bp, bulge: 0.3, tone: far ? -0.15 : 0 });
    c.blob(place(TOECAP, ankle, fa), 0.8, { mat: M.boots, z: z + 1.3, bulge: 0.35, tone: far ? -0.1 : 0.05 });
    c.blob(place(SOLE, ankle, fa), 0.3, { mat: M.sole, z: z + 1.1 });
    if (d >= 4) for (let k = 0; k < 3; k++) {
      const p = place([[1.5 + k * 0.6, 0.0 + k * 0.32]], ankle, fa)[0];
      c.dot(p[0], p[1], PAL_HD.sand[5]);
    }
  };
  leg(T(-2.3, 0.8), pose.legF, -3, pose.footF ?? 0, true);

  // ---- Arms: a shaped sleeve over the elbow (puffed at the shoulder, a fold in the bend), a rolled cuff, the forearm, the glove. ----
  const arm = (s0: [number, number], a: [number, number], z: number, far: boolean): [number, number] => {
    const el = along(s0, a[0], 5.0);
    const wrist = along(el, a[1], 4.6);
    const cuff = along(el, a[1], 1.3);
    const sp = c.newPart();
    const tone = far ? -0.18 : 0;
    // Forearm (skin) from inside the cuff to the wrist.
    c.blob(limb([cuff, wrist], [1.25, 1.0], 2), 0.8, { mat: M.skin, z: z - 0.2, bulge: 0.3, tone });
    // The sleeve: shoulder, elbow, cuff.
    c.blob(limb([s0, el, cuff], [2.3, 1.95, 1.7], 2), 1.1, { mat: M.shirt, z, part: sp, bulge: 0.35, tone });
    // The fold inside the elbow: a deep crease and a lit ridge above it.
    const bend = a[1] - a[0];
    if (Math.abs(bend) > 15 && d >= 4) {
      const s = Math.sign(bend);
      const fi = along(el, a[0] + 90 * s, 0.9);
      c.shade(fi[0] - 1.5, fi[1] - 1.5, 3, 3, (x, y) => {
        const q = Math.hypot(x - fi[0], y - fi[1]);
        return q < 0.55 ? -0.45 : q < 0.95 ? 0.12 : 0;
      }, sp);
    }
    // A crease from the armpit and one across the upper sleeve.
    const mid = lerpPt(s0, el, 0.45);
    if (d >= 4) c.shade(mid[0] - 1.8, mid[1] - 1, 3.6, 2, (x, y) => (Math.abs(y - mid[1] - (x - mid[0]) * 0.5) < 0.22 && x > mid[0] - 0.6 ? -0.3 : 0), sp);
    // Rolled cuff: a band across the forearm, lighter, with a groove in it.
    const c1 = along(el, a[1], 0.7);
    const c2 = along(el, a[1], 1.9);
    c.blob(limb([c1, c2], [1.7, 1.6], 0), 0.45, {
      mat: M.shirt,
      z: z + 0.6,
      bulge: 0.2,
      tone: tone + 0.06,
      tex: (s) => {
        if (Math.abs(s.v - 0.55) < 0.09) s.tone -= 0.35;
      },
    });
    // The glove: a fist (back of the hand, knuckles along the front, finger rows), the thumb on top.
    const hand = along(wrist, a[1], 1.2);
    const ha = a[1] - 90;
    const gp = c.newPart();
    const fist = place([[-1.5, -1.4], [0.9, -1.6], [1.8, -0.9], [1.9, 0.9], [1.2, 1.7], [-1.3, 1.6], [-1.8, 0.2]], hand, -ha);
    c.blob(fist, 0.9, {
      mat: M.glove,
      z: z + 0.8,
      part: gp,
      bulge: 0.25,
      tone,
      tex: (s) => {
        // Finger rows on the front: grooves between the fingers wrapped round the grip.
        const lx = (s.x - hand[0]) * Math.cos(rad(ha)) + (s.y - hand[1]) * Math.sin(rad(ha));
        const ly = -(s.x - hand[0]) * Math.sin(rad(ha)) + (s.y - hand[1]) * Math.cos(rad(ha));
        if (lx > 0.4) {
          const r = (ly + 1.6) / 1.05;
          const f = r - Math.floor(r);
          if (s.d >= 4 && f < 0.2 && r > 0.8) s.tone -= 0.5;
          s.ny += (f - 0.5) * 0.7;
        } else if (lx > -0.2 && s.d >= 4) {
          // The knuckle line.
          s.nx += 0.4;
          s.tone += 0.08;
        }
      },
    });
    const th0 = place([[-0.9, -1.0]], hand, -ha)[0];
    const th1 = place([[1.4, -1.6]], hand, -ha)[0];
    c.capsule(th0[0], th0[1], th1[0], th1[1], 0.75, 0.6, { mat: M.glove, z: z + 1.6, tone: tone + 0.05 });
    // Cuff of the glove at the wrist.
    const w0 = along(wrist, a[1], -0.3);
    const w1 = along(wrist, a[1], 0.6);
    c.blob(limb([w0, w1], [1.2, 1.25], 0), 0.4, { mat: M.glove, z: z + 0.5, tone: tone - 0.05 });
    return hand;
  };
  const shoulderF = T(-0.6, -8.0);
  const handF = arm(shoulderF, pose.armF, -2.5, true);

  leg(T(1.3, 0.8), pose.legN, 1.5, pose.footN ?? 0, false);

  // ---- Torso: the shirt (collar), the vest over it (yoke, pockets, side strap, zip, quilting), the belt, a pouch. ----
  const tpart = c.newPart();
  const shirt = [T(-4.4, -8.6), T(-2.6, -10.6), T(2.0, -10.6), T(3.8, -8.8), T(4.4, -5.4), T(4.0, 0.4), T(-5.2, 0.4), T(-5.6, -5.0)];
  c.blob(shirt, 1.4, { mat: M.shirt, z: 0, part: tpart, bulge: 0.35 });
  const vp = c.newPart();
  const vest = [T(-5.0, -9.4), T(-3.0, -10.5), T(-0.4, -10.1), T(1.0, -8.0), T(2.6, -9.6), T(3.9, -8.4), T(4.6, -5.6), T(4.3, -2.0), T(4.1, 1.0), T(-5.6, 1.0), T(-6.1, -2.5), T(-6.0, -6.4)];
  c.blob(vest, 1.5, {
    mat: M.vest,
    z: 0.5,
    part: vp,
    bulge: 0.4,
    tex: (s) => {
      // Quilted rows on the back panel at 4×, the zip line down the front.
      const [lx, ly] = untp(hip, L, s.x, s.y);
      if (s.d >= 4 && lx < -0.5 && Math.abs((((ly + 20) / 2.4) % 1) - 0.5) < 0.07) s.tone -= 0.2;
      if (lx > 2.8 && lx < 3.25) s.tone -= 0.35;
      else if (lx >= 3.25 && lx < 3.6) s.tone += 0.1;
    },
  });
  // Side strap (webbing) from the shoulder to the belt, a D-ring at chest height.
  c.blob([T(-2.6, -10.0), T(-1.4, -10.0), T(-1.0, 0.6), T(-2.2, 0.6)], 0.35, { mat: M.strap, z: 1.9, bulge: 0.1, tone: -0.06 });
  if (d >= 4) {
    const r = T(-1.8, -4.2);
    c.ellipsoid(r[0], r[1], 0.65, 0.65, { mat: M.buckle, z: 2.6, round: 0.7, tex: (s) => { if (Math.hypot(s.u, s.v) < 0.45) s.cut = true; } });
  }
  // Chest pocket with its flap and a press stud.
  const pk = [T(0.2, -7.4), T(3.1, -7.4), T(3.0, -4.2), T(0.3, -4.2)];
  c.blob(pk, 0.4, { mat: M.vest, z: 2.0, bulge: 0.2, tone: 0.02 });
  c.blob([T(0.0, -8.0), T(3.3, -8.0), T(3.2, -6.5), T(1.65, -6.1), T(0.1, -6.5)], 0.35, { mat: M.vest, z: 2.4, bulge: 0.15, tone: 0.06 });
  if (d >= 4) {
    const st = T(1.65, -6.7);
    c.ellipsoid(st[0], st[1], 0.4, 0.4, { mat: M.buckle, z: 2.8 });
  }
  // Lower pocket.
  c.blob([T(-0.4, -3.4), T(3.0, -3.4), T(2.9, -0.4), T(-0.3, -0.4)], 0.4, { mat: M.vest, z: 1.8, bulge: 0.2 });
  c.blob([T(-0.6, -3.8), T(3.2, -3.8), T(3.1, -2.6), T(-0.5, -2.6)], 0.3, { mat: M.vest, z: 2.1, bulge: 0.12, tone: 0.05 });
  // Belt with buckle, the pelvis of the trousers under it.
  c.blob([T(-4.6, 0.2), T(4.0, 0.2), T(4.1, 3.0), T(-4.7, 3.0)], 1.0, { mat: M.pants, z: 0.2, bulge: 0.3 });
  c.blob([T(-5.2, 0.0), T(4.2, 0.0), T(4.2, 1.6), T(-5.2, 1.6)], 0.4, { mat: M.belt, z: 2.2, bulge: 0.12, tex: (s) => { if (s.d >= 4 && (s.v < 0.16 || s.v > 0.84)) s.tone -= 0.15; } });
  c.blob([T(2.4, -0.25), T(4.0, -0.25), T(4.0, 1.85), T(2.4, 1.85)], 0.3, { mat: M.buckle, z: 2.6, bulge: 0.1 });
  // Pouch on the back hip.
  c.blob([T(-5.6, 0.6), T(-2.6, 0.6), T(-2.7, 4.0), T(-5.4, 4.0)], 0.6, { mat: M.vest, z: 2.5, bulge: 0.25, tone: -0.04 });
  c.blob([T(-5.8, 0.2), T(-2.4, 0.2), T(-2.5, 1.6), T(-5.7, 1.6)], 0.35, { mat: M.vest, z: 2.9, bulge: 0.12, tone: 0.04 });

  // ---- Head (the head contract), placed by today's head point (hip + (1, −14)) → HEAD_CENTER. ----
  const hpnt = T(1, -14);
  const head = renderHeadHd(RECRUIT_HEAD, pose.flash ? 'shout' : 'normal', d);
  c.image(head, hpnt[0] - HEAD_CENTER[0], hpnt[1] - HEAD_CENTER[1], { z: 2.2 });
  // Shirt collar round the base of the neck (in front of the neck, behind the chin).
  c.blob([T(-1.8, -10.9), T(0.2, -11.0), T(1.9, -10.0), T(1.2, -8.9), T(-1.6, -9.6)], 0.5, { mat: M.shirt, z: 2.4, bulge: 0.2, tone: 0.05 });

  // ---- Near arm with the pistol. ----
  const shoulderN = T(0.4, -8.0);
  const g = gunArt('pistol');
  const gun = gunArtHd('pistol', d);
  // The hand position from the pose; the gun's grip sits in the fist.
  const el = along(shoulderN, pose.armN[0], 5.0);
  const wrist = along(el, pose.armN[1], 4.6);
  const handN = along(wrist, pose.armN[1], 1.2);
  const gx = handN[0] - g.grip[0] - 0.3;
  const gy = handN[1] - g.grip[1] - 0.6;
  c.image(gun, gx, gy, { z: 4.6 });
  arm(shoulderN, pose.armN, 4.2, false);
  void handF;
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
  return c.render({ outline, ao: 0.3, rimLight: rim });
}

/** Inverse of `tp`: a frame point back to torso-local (x forward, y down from the hip). */
function untp(hip: readonly [number, number], lean: number, x: number, y: number): [number, number] {
  const a = rad(-lean);
  const dx = x - hip[0];
  const dy = y - hip[1];
  return [dx * Math.cos(a) - dy * Math.sin(a), dx * Math.sin(a) + dy * Math.cos(a)];
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
// 3. Street crop (128 × 96 logical) — today's ams layout: canal houses on the far quay, the
//    canal, the street railing with a bench, a bike, a flower box with tulips, a lamp, a
//    bollard and a tree, the paved street and its stone front face (the terrain).
// ------------------------------------------------------------------------------------------

const ST_W = 128;
const ST_H = 96;
/** Foot of the houses (the far quay), the water, the railing / street line, the terrain face. */
const HOUSE_Y = 54;
const WATER_Y = 56;
const RAIL_Y = 70;
const STREET_Y = 73;
const FACE_Y = 77;

type Gable = 'step' | 'neck' | 'bell' | 'spout';
type Facade = 'brick' | 'green' | 'plaster' | 'black' | 'brickDark' | 'red';
interface House {
  x: number;
  w: number;
  /** Top of the wall body (the gable rises above it). */
  top: number;
  wall: Facade;
  gable: Gable;
  /** Window columns. */
  cols: number;
  seed: number;
}

const HOUSES: readonly House[] = [
  { x: 0, w: 22, top: 22, wall: 'brick', gable: 'step', cols: 2, seed: 11 },
  { x: 22, w: 19, top: 18, wall: 'green', gable: 'neck', cols: 2, seed: 12 },
  { x: 41, w: 22, top: 24, wall: 'plaster', gable: 'bell', cols: 3, seed: 13 },
  { x: 63, w: 19, top: 16, wall: 'black', gable: 'spout', cols: 2, seed: 14 },
  { x: 82, w: 22, top: 21, wall: 'brickDark', gable: 'step', cols: 2, seed: 15 },
  { x: 104, w: 24, top: 26, wall: 'red', gable: 'neck', cols: 3, seed: 16 },
];

/** Top edge of a house (the gable silhouette) at x: the y where the wall starts. */
function gableTop(h: House, x: number): number {
  const u = (x - h.x) / h.w;
  const cx = h.x + h.w / 2;
  const t = h.top;
  if (h.gable === 'step') {
    const k = Math.min(3, Math.floor(Math.min(u, 1 - u) * 7.5));
    return t - k * 3.6;
  }
  if (h.gable === 'neck') {
    const nw = h.w * 0.42;
    const off = Math.abs(x - cx);
    if (off < nw / 2) return t - 11 - Math.max(0, 2.6 - off * 0.9);
    // Claw pieces: a concave quarter curve from the neck down to the wall top.
    const q = (off - nw / 2) / (h.w / 2 - nw / 2);
    return t - 11 * (1 - Math.sqrt(Math.min(1, q * 1.1)));
  }
  if (h.gable === 'bell') {
    const off = Math.abs(x - cx) / (h.w / 2);
    if (off > 0.92) return t;
    // A bell: convex top, flaring out at the foot.
    return t - 12 * Math.cos(off * Math.PI * 0.5) ** 0.7 + (off > 0.7 ? (off - 0.7) * 6 : 0);
  }
  // Spout: a steep point with a narrow flat top.
  const off = Math.abs(x - cx);
  return t - Math.max(0, 13 - Math.max(0, off - 1.4) * 1.5);
}

export function drawStreet(d: D): PixelBuffer {
  const c = new HdCanvas(ST_W, ST_H, d);
  const sky = c.material({ ramp: PAL_HD.sky, flat: true, dither: 0.22, lo: 1, hi: 7 });
  const cloud = c.material({ ramp: PAL_HD.snow, wrap: 0.35, amb: 0.25, rim: 0, lo: 1, hi: 6 });
  const mk = (ramp: readonly Color[], extra: Partial<import('../src/game/art/hd/index').HdMaterial> = {}): number => c.material({ ramp, wrap: 0.1, rim: 0, ...extra });
  const walls: Record<Facade, number> = {
    brick: mk(PAL_HD.brick, { lo: 2, hi: 6 }),
    green: mk(PAL_HD.green, { lo: 1, hi: 4 }),
    plaster: mk(PAL_HD.plaster, { lo: 2, hi: 6 }),
    black: mk(PAL_HD.black, { lo: 1, hi: 4 }),
    brickDark: mk(PAL_HD.brickDark, { lo: 1, hi: 5 }),
    red: mk(PAL_HD.red, { lo: 2, hi: 6 }),
  };
  const mortars: Record<Facade, number> = {
    brick: mk(PAL_HD.stone, { lo: 2, hi: 4 }),
    green: mk(PAL_HD.green, { lo: 0, hi: 2 }),
    plaster: mk(PAL_HD.plaster, { lo: 1, hi: 3 }),
    black: mk(PAL_HD.black, { lo: 0, hi: 1 }),
    brickDark: mk(PAL_HD.stone, { lo: 1, hi: 3 }),
    red: mk(PAL_HD.stone, { lo: 2, hi: 4 }),
  };
  const trim = mk(PAL_HD.gable, { lo: 2, hi: 6, spec: 0.15, shine: 10 });
  const glass = c.material({ ramp: PAL_HD.glass, flat: true, lo: 0, hi: 5 });
  const hoist = mk(PAL_HD.wood, { lo: 1, hi: 5 });
  const quayTop = mk(PAL_HD.stone, { lo: 1, hi: 5 });
  const quayWall = mk(PAL_HD.brickDark, { lo: 0, hi: 3 });
  const moss = mk(PAL_HD.moss, { lo: 1, hi: 4 });
  const water = c.material({ ramp: PAL_HD.canal, flat: true, dither: 0.18, lo: 0, hi: 7 });
  const pavers = mk(PAL_HD.brick, { lo: 1, hi: 5 });
  const paverGap = mk(PAL_HD.stone, { lo: 0, hi: 2 });
  const faceStone = mk(PAL_HD.stone, { lo: 1, hi: 5 });
  const faceMortar = mk(PAL_HD.stone, { lo: 0, hi: 2 });
  const railM = mk(PAL_HD.black, { lo: 0, hi: 3, spec: 0.5, shine: 16 });
  // Static facade decor: outline C (edge), lit like sprites.
  const deco = (ramp: readonly Color[], extra: Partial<import('../src/game/art/hd/index').HdMaterial> = {}): number => c.material({ ramp, wrap: 0.05, rim: 0.15, edge: 'C', ...extra });
  const iron = deco(PAL_HD.black, { lo: 0, hi: 4, spec: 0.7, shine: 18 });
  const lampGlow = c.material({ ramp: PAL_HD.gold, flat: true, lo: 3, hi: 6, edge: 'C' });
  const bark = deco(PAL_HD.brown, { lo: 1, hi: 4 });
  const leaf = deco(PAL_HD.green, { lo: 1, hi: 7, wrap: 0.1, amb: 0.02 });
  const benchWood = deco(PAL_HD.wood, { lo: 1, hi: 6, spec: 0.15 });
  const bikeFrame = deco(PAL_HD.teal, { lo: 1, hi: 5, spec: 0.6, shine: 20 });
  const tyre = deco(PAL_HD.ink, { lo: 0, hi: 1 });
  const chrome = deco(PAL_HD.steel, { spec: 1, shine: 26 });
  const boxM = deco(PAL_HD.green, { lo: 1, hi: 5 });
  const stem = deco(PAL_HD.green, { lo: 2, hi: 6 });
  const tulipR = deco(PAL_HD.red, { lo: 2, hi: 7 });
  const tulipY = deco(PAL_HD.gold, { lo: 3, hi: 7 });
  const tulipP = deco(PAL_HD.pink, { lo: 1, hi: 6 });
  const bollard = deco(PAL_HD.brickDark, { lo: 1, hi: 6, spec: 0.4, shine: 16 });

  // ---- Sky: a soft gradient (ordered dither only at the band borders), painted clouds. ----
  c.plane(0, 0, ST_W, HOUSE_Y, { mat: sky, z: -100, tex: (s) => { s.tone = -0.2 + s.y / 62; } });
  const cloudAt = (puffs: ReadonlyArray<readonly [number, number, number, number]>, base: number): void => {
    const part = c.newPart();
    for (const [cx, cy, rx, ry] of puffs) {
      c.ellipsoid(cx, cy, rx, ry, {
        mat: cloud,
        z: -95,
        part,
        round: 0.8,
        tex: (s) => {
          if (s.y > base) s.cut = true;
          // The flat underside in the cool shade.
          if (s.y > base - 1.6) s.tone -= 0.25;
        },
      });
    }
  };
  cloudAt([[16, 11, 7, 4.5], [24, 8, 6, 5.5], [32, 11, 6, 4], [8, 13, 5, 3]], 14);
  cloudAt([[70, 6, 6, 4], [78, 4, 5, 4.5], [86, 7, 5, 3.5], [63, 8, 4, 2.5]], 9.5);

  // ---- Houses: wall with its gable, trims, windows with glazing bars, hoist beams. ----
  const win = (x: number, y: number, w: number, h: number, seed: number): void => {
    c.box(x - 0.8, y - 0.8, w + 1.6, h + 1.6, { mat: trim, z: -44, bevel: 0.35 });
    c.plane(x, y, w, h, {
      mat: glass,
      z: -43.5,
      tex: (s) => {
        const u = (s.x - x) / w;
        const v = (s.y - y) / h;
        // Reflected sky: lighter at the top, a soft diagonal sheen in some panes; dark under the frame.
        s.tone = -0.3 + (1 - v) * 0.12 + (hash01(seed) > 0.6 ? 0.1 : 0);
        const streak = Math.abs(u + v * 0.8 - 0.55 - hash01(seed + 1) * 0.3);
        if (streak < 0.08) s.tone += 0.38;
        else if (streak < 0.14) s.tone += 0.16;
        if (s.y - y < 0.6) s.tone -= 0.3;
      },
    });
    // Glazing bars: one upright, two transoms (six panes), sill under the window.
    c.box(x + w / 2 - 0.3, y, 0.6, h, { mat: trim, z: -43.6, bevel: 0.2 });
    for (const t of [0.34, 0.67]) c.box(x, y + h * t - 0.3, w, 0.6, { mat: trim, z: -43.6, bevel: 0.2 });
    c.box(x - 1.2, y + h + 0.6, w + 2.4, 0.9, { mat: trim, z: -43, bevel: 0.3, n: [0, -0.5, 0.86] });
  };

  for (const h of HOUSES) {
    const wallM = walls[h.wall];
    const tex =
      h.wall === 'plaster'
        ? plaster({ seed: h.seed, cracks: 0.3, stains: 0.5 })
        : h.wall === 'green' || h.wall === 'black'
          ? texAll(brick({ mortar: mortars[h.wall], bw: 3, bh: 1.5, joint: 0.35, wear: 0.25, seed: h.seed }), grime(h.seed, 0.25, 6))
          : brick({ mortar: mortars[h.wall], bw: 3, bh: 1.5, joint: 0.5, wear: 0.6, seed: h.seed });
    const pts: [number, number][] = [[h.x, HOUSE_Y]];
    for (let x = h.x; x <= h.x + h.w + 1e-6; x += 0.25) pts.push([x, gableTop(h, x)]);
    pts.push([h.x + h.w, HOUSE_Y]);
    c.poly(pts, { mat: wallM, z: -50, tex });
    // Gable trim: white coping along the gable edge (a ½ px band), the cornice at the wall top.
    c.plane(h.x, h.top - 16, h.w, 16.5, {
      mat: trim,
      z: -48,
      mask: (x, y) => {
        const gt = gableTop(h, x);
        return y >= gt && y < gt + 0.9 && gt < h.top - 0.5;
      },
      tex: (s) => {
        s.ny -= 0.5;
      },
    });
    c.box(h.x - 0.2, h.top - 0.4, h.w + 0.4, 1.4, { mat: trim, z: -47, bevel: 0.4, n: [0, -0.35, 0.94] });
    const cx = h.x + h.w / 2;
    // Hoist beam under the gable top, an attic window.
    const ty = gableTop(h, cx);
    c.box(cx - 0.6, ty + 1.2, 1.2, 2.2, { mat: hoist, z: -46, bevel: 0.35 });
    if (h.gable !== 'spout') win(cx - 2.2, ty + 4.4, 4.4, 5, h.seed + 7);
    else win(cx - 1.6, ty + 5, 3.2, 4.6, h.seed + 7);
    if (h.gable === 'neck') {
      // Scrolls at the foot of the neck.
      for (const sg of [-1, 1]) c.ellipsoid(cx + sg * (h.w * 0.21 + 1.2), h.top - 1.6, 1.3, 1.3, { mat: trim, z: -46.5, round: 0.8 });
    }
    // Floors of windows down to the quay.
    const ww = h.cols === 3 ? 4.2 : 5;
    for (let fl = 0; fl < 3; fl++) {
      const wy = h.top + 3.2 + fl * 10;
      if (wy + 8 > HOUSE_Y - 1) break;
      for (let ci = 0; ci < h.cols; ci++) {
        const wx = h.x + (h.w * (ci + 0.5)) / h.cols - ww / 2;
        win(wx, wy, ww, 7.4, h.seed * 7 + fl * 3 + ci);
      }
    }
  }
  // Far quay: a stone coping and a dark brick wall into the water, moss at the water line.
  c.box(0, HOUSE_Y - 0.6, ST_W, 1.4, { mat: quayTop, z: -40, bevel: 0.4, n: [0, -0.5, 0.86] });
  c.box(0, HOUSE_Y + 0.8, ST_W, WATER_Y - HOUSE_Y - 0.4, {
    mat: quayWall,
    z: -41,
    tex: texAll(brick({ mortar: faceMortar, bw: 3.5, bh: 1.2, joint: 0.35, wear: 0.8, seed: 31 }), (s) => {
      if (s.y > WATER_Y - 1.1 && noise2(s.x, 0, 2.5, 4) > 0.4) s.mat = moss;
    }),
  });

  // ---- Canal: dark reflections of the facades, broken by ripples. ----
  c.plane(0, WATER_Y, ST_W, RAIL_Y - WATER_Y + 1, {
    mat: water,
    z: -60,
    tex: (s) => {
      const dy = s.y - WATER_Y;
      const wob = (noise2(s.x * 0.4, s.y * 2.2, 3, 5) - 0.5) * (2.6 + dy * 0.35);
      const rx = s.x + wob;
      const ry = HOUSE_Y - dy * 1.6;
      // Ripples: long, broken horizontal breaks (not parallel streaks), more of them farther out.
      const rip = noise2(s.x * 0.2, s.y * 2.0, 3, 9);
      const broken = rip > 0.6 - dy * 0.008;
      let hit: House | null = null;
      for (const h of HOUSES) if (rx >= h.x && rx < h.x + h.w && ry >= gableTop(h, rx)) hit = h;
      if (hit && !broken) {
        s.mat = walls[hit.wall];
        s.nx = 0;
        s.ny = 0;
        s.nz = 1;
        s.tone = -0.42 - Math.min(0.2, dy * 0.02) + (noise2(s.x, s.y * 3, 2, 3) - 0.5) * 0.1;
        // The windows' dark reflections.
        const local = (rx - hit.x) / (hit.w / hit.cols);
        if (Math.abs(local - Math.floor(local) - 0.5) < 0.22 && ((HOUSE_Y - ry) % 10) > 2.5) s.tone -= 0.2;
      } else {
        // Sky reflected in the water: mid tones, a lit crest on the broken ripples.
        s.tone = 0.05 - dy * 0.015 + (rip - 0.5) * 0.15;
        if (broken && rip > 0.78) s.tone += 0.28;
        // Sky glints: short, near-white horizontal dashes on the open water (sparse; more near the
        // street, where the eye looks down at a steeper angle onto the sky's reflection).
        const gl = noise2(s.x * 0.3, s.y * 4.5, 2, 23);
        if (gl > 0.84 - dy * 0.006) s.tone = 0.48;
      }
      // The quay's shadow on the water right under it.
      if (dy < 1.2) s.tone -= 0.25;
    },
  });

  // ---- Railing at the street edge (behind the decor): posts, a top rail and a middle rail. ----
  const rp = c.newPart();
  c.box(0, RAIL_Y - 9.4, ST_W, 1.2, { mat: railM, z: -12, part: rp, bevel: 0.4 });
  c.box(0, RAIL_Y - 5, ST_W, 0.7, { mat: railM, z: -12.2, part: rp, bevel: 0.25 });
  for (let x = 3; x < ST_W; x += 9) c.cylinder(x, RAIL_Y - 9, 1.1, 9.2, { mat: railM, z: -12, part: rp });

  // ---- Street: brick pavers seen from above, the kerb, the stone front face (terrain: no outline). ----
  c.plane(0, RAIL_Y, ST_W, FACE_Y - RAIL_Y, {
    mat: pavers,
    z: -20,
    normal: (_x, _y, n) => {
      n[0] = 0;
      n[1] = -0.75;
      n[2] = 0.66;
    },
    tex: brick({ mortar: paverGap, bw: 2.4, bh: 1.4, joint: 0.3, wear: 0.7, seed: 21 }),
  });
  c.box(0, FACE_Y - 1.2, ST_W, 1.6, { mat: faceStone, z: -19, bevel: 0.5, n: [0, -0.4, 0.92] });
  c.box(0, FACE_Y + 0.4, ST_W, ST_H - FACE_Y, {
    mat: faceStone,
    z: -21,
    tex: texAll(brick({ mortar: faceMortar, bw: 8, bh: 4, joint: 0.5, wear: 0.9, seed: 23 }), grime(29, 0.35, 5)),
  });

  // ---- Decor (outline C): a bollard, the lamp, a bench, a bike, the flower box, the tree. ----
  // Bollard ("Amsterdammertje") with three white crosses.
  c.cylinder(10, STREET_Y - 7, 2.6, 7, { mat: bollard, z: 2, cap: 1.2 });
  c.ellipsoid(11.3, STREET_Y - 7.2, 1.0, 0.8, { mat: bollard, z: 2.6 });
  if (d >= 4) {
    for (let k = 0; k < 3; k++) {
      const yy = STREET_Y - 5.6 + k * 1.6;
      c.paint(10.4, yy - 0.5, 1.8, 1.0, (x, y) => (Math.abs(Math.abs(x - 11.3) - Math.abs(y - yy) * 0.9) < 0.18 ? PAL_HD.snow[5] : 0));
    }
  } else c.paint(10.6, STREET_Y - 4.8, 1.4, 1.2, (x, y) => (Math.abs(Math.abs(x - 11.3) - Math.abs(y - (STREET_Y - 4.2))) < 0.3 ? PAL_HD.snow[5] : 0));

  // Street lamp: cast-iron post, a lantern with a warm glow.
  const lx = 30;
  c.cylinder(lx - 0.9, 34, 1.8, STREET_Y - 34, { mat: iron, z: 3, tex: (s) => { if (Math.abs((((s.y - 34) / 9) % 1) - 0.5) < 0.05) s.tone += 0.25; } });
  c.box(lx - 1.8, STREET_Y - 5, 3.6, 5, { mat: iron, z: 3.2, bevel: 0.6, r: 0.4 });
  c.poly([[lx - 3.2, 26], [lx + 3.2, 26], [lx + 2.1, 33], [lx - 2.1, 33]], { mat: lampGlow, z: 3.4, tex: (s) => { s.tone = 0.55 - Math.abs(s.x - lx) * 0.07 + (s.y - 26) * 0.01; } });
  c.box(lx - 3.8, 24.6, 7.6, 1.6, { mat: iron, z: 3.6, bevel: 0.5, r: 0.5 });
  c.poly([[lx - 2.6, 24.8], [lx, 21], [lx + 2.6, 24.8]], { mat: iron, z: 3.5, n: [0.2, -0.5, 0.85] });
  c.box(lx - 2.8, 32.6, 5.6, 1.3, { mat: iron, z: 3.6, bevel: 0.4 });

  // Bench: three slats on two iron legs, a backrest.
  const bx = 40;
  for (const [yy, hh] of [[STREET_Y - 9, 1.2], [STREET_Y - 7.4, 1.2], [STREET_Y - 5, 1.3]] as const) {
    c.box(bx, yy, 15, hh, { mat: benchWood, z: 2 + (yy > STREET_Y - 6 ? 0.6 : 0), bevel: 0.35, r: 0.2, tex: wood({ seed: Math.round(yy), dir: 'h', plank: 3 }), n: yy > STREET_Y - 6 ? [0, -0.6, 0.8] : [0, 0, 1] });
  }
  for (const lxx of [bx + 1.5, bx + 12.3]) {
    c.box(lxx, STREET_Y - 9.4, 1.2, 9.4, { mat: iron, z: 1.6, bevel: 0.3 });
    c.capsule(lxx + 0.6, STREET_Y - 3.6, lxx + 2, STREET_Y - 0.3, 0.5, 0.45, { mat: iron, z: 2.8 });
  }

  // A bike leaning on the railing: two wheels, a teal frame, saddle, bars.
  const wr = 3.6;
  const w1: [number, number] = [64, STREET_Y - wr];
  const w2: [number, number] = [76, STREET_Y - wr];
  for (const w of [w1, w2]) {
    c.plane(w[0] - wr, w[1] - wr, wr * 2, wr * 2, {
      mat: tyre,
      z: 4,
      mask: (x, y) => {
        const q = Math.hypot(x - w[0], y - w[1]);
        return q < wr && q > wr - 0.75;
      },
    });
    c.plane(w[0] - wr, w[1] - wr, wr * 2, wr * 2, {
      mat: chrome,
      z: 3.9,
      mask: (x, y) => {
        const q = Math.hypot(x - w[0], y - w[1]);
        if (q < 0.5) return true;
        if (d < 4 || q > wr - 0.75) return false;
        const a = Math.atan2(y - w[1], x - w[0]);
        return Math.abs(((a / (Math.PI / 6)) % 1 + 1) % 1 - 0.5) > 0.42;
      },
    });
  }
  const crank: [number, number] = [69.5, STREET_Y - wr];
  const seat: [number, number] = [67.2, STREET_Y - 10.5];
  const head: [number, number] = [74.3, STREET_Y - 10.8];
  const fr = { mat: bikeFrame, z: 4.4 };
  c.capsule(w1[0], w1[1], crank[0], crank[1], 0.45, 0.45, fr);
  c.capsule(w1[0], w1[1], seat[0], seat[1], 0.42, 0.42, fr);
  c.capsule(crank[0], crank[1], seat[0], seat[1], 0.5, 0.5, fr);
  c.capsule(crank[0], crank[1], head[0], head[1] + 1, 0.55, 0.55, fr);
  c.capsule(seat[0], seat[1] + 0.8, head[0], head[1] + 0.6, 0.45, 0.45, fr);
  c.capsule(head[0], head[1], w2[0], w2[1], 0.42, 0.42, fr);
  c.box(seat[0] - 1.8, seat[1] - 1.4, 3.4, 1.1, { mat: tyre, z: 4.8, r: 0.4, bevel: 0.3 });
  c.capsule(head[0] - 0.5, head[1] - 1, head[0] + 1.6, head[1] - 1.6, 0.4, 0.4, { mat: chrome, z: 4.8 });
  c.capsule(w2[0] - 4.6, w2[1] - 3.2, w2[0] + 1.8, w2[1] - 3.4, 0.35, 0.35, { mat: chrome, z: 4.6 });

  // Flower box with tulips (red, yellow, pink) on the railing side of the street.
  const fx = 108;
  c.box(fx, STREET_Y - 5, 15, 5, { mat: boxM, z: 2.4, bevel: 0.5, tex: wood({ seed: 5, dir: 'h', plank: 1.6 }) });
  c.box(fx - 0.5, STREET_Y - 5.6, 16, 1, { mat: boxM, z: 2.9, bevel: 0.3, tone: 0.1 });
  const tulips = [tulipR, tulipY, tulipR, tulipP, tulipY, tulipR, tulipP];
  for (let k = 0; k < tulips.length; k++) {
    const tx = fx + 1.6 + k * 2.0 + (hash01(k + 40) - 0.5) * 0.6;
    const ty = STREET_Y - 9.6 - hash01(k + 50) * 2;
    c.capsule(tx, STREET_Y - 5.4, tx + (hash01(k + 60) - 0.5) * 0.8, ty + 1, 0.3, 0.28, { mat: stem, z: 2.2 });
    if (k % 2 === 0) c.ellipsoid(tx - 0.8, STREET_Y - 6.6, 0.9, 0.4, { mat: stem, z: 2.3 });
    c.ellipsoid(tx, ty, 0.95, 1.2, {
      mat: tulips[k],
      z: 2.6,
      tex: (s) => {
        // The cup's notched rim (petal tips).
        if (s.v < -0.55 && Math.abs(s.u) < 0.25) s.cut = true;
      },
    });
  }

  // The elm: a trunk forking into branches; a canopy of irregular leaf clusters with gaps (branches
  // show through), each cluster lit on its own (dappled light), shadows on the houses behind.
  const tx0 = 95;
  c.capsule(tx0, STREET_Y + 0.5, tx0 - 1, 44, 1.8, 1.3, { mat: bark, z: 5, tex: texAll(wood({ seed: 8, dir: 'v' }), grime(4, 0.5, 2)) });
  const branches: ReadonlyArray<readonly [number, number, number, number, number]> = [
    [tx0 - 1, 46, 85, 30, 0.8],
    [tx0 - 1, 45, 104, 28, 0.8],
    [tx0 - 1, 44, 96, 18, 0.75],
    [88, 36, 80, 33, 0.45],
    [101, 33, 110, 34, 0.45],
  ];
  for (const [x0, y0, x1, y1, r] of branches) c.capsule(x0, y0, x1, y1, r, r * 0.55, { mat: bark, z: 5.2 });
  // Leaf masses (centre, radii): each a cloud of small clumps of different sizes with ragged
  // edges, lit one by one (dappled), the mass darker towards its lower right; gaps between masses.
  const masses: ReadonlyArray<readonly [number, number, number, number]> = [
    [83, 27, 10, 7.5],
    [99, 16, 10.5, 8],
    [109, 28, 7, 6],
    [91, 37, 6, 3.6],
    [77, 37, 4.5, 3.4],
    [104, 38, 4, 3],
  ];
  masses.forEach(([mx, my, mrx, mry], mi) => {
    const part = c.newPart();
    const n = Math.round((mrx * mry) / 3.2);
    for (let k = 0; k < n; k++) {
      const h1 = hash01(mi * 97 + k * 3 + 1);
      const h2 = hash01(mi * 97 + k * 3 + 2);
      const h3 = hash01(mi * 97 + k * 3 + 3);
      const px = mx + (h1 - 0.5) * 2 * mrx * 0.8;
      const py = my + (h2 - 0.5) * 2 * mry * 0.8;
      if (((px - mx) / mrx) ** 2 + ((py - my) / mry) ** 2 > 0.75) continue;
      const r = 1.6 + h3 * 2.0;
      const mt = -((px - mx) / mrx) * 0.12 - ((py - my) / mry) * 0.22;
      c.ellipsoid(px, py, r * 1.15, r * 0.9, {
        mat: leaf,
        z: 6 + mi * 0.05 + (py - my + mry) * 0.08 + h3 * 0.3,
        part,
        round: 0.75,
        tone: mt + (h1 - 0.5) * 0.1,
        tex: (s) => {
          // Ragged clump edge (single leaves), small leaf facets inside the clump.
          const q = s.u * s.u + s.v * s.v;
          if (q > 0.5 && noise2(s.x * 1.7, s.y * 1.7, 1.2, 17 + k) > 0.5) {
            s.cut = true;
            return;
          }
          leafFacets(s);
        },
      });
    }
  });
  return c.render({ outline: 'none', sep: false, ao: 0.3, sepZ: 0.4, shadow: 0.3, shadowMax: 4 });
}

/** Leaf facets inside a clump: small leaves tilt the normal (the light breaks into flecks). */
const leafFacets = leaves({ size: 1.3, seed: 41, ragged: 0 });

/** A hash in 0..1 of an integer (deterministic). */
function hash01(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

// ------------------------------------------------------------------------------------------
// Today's art (for comparison)
// ------------------------------------------------------------------------------------------

/** A finished buffer of density d with an outline A (gear sheet only: the rig outlines whole figures). */
function outlined(b: PixelBuffer, d: number): PixelBuffer {
  const pad = 1;
  const c = new HdCanvas(b.w / d + pad * 2, b.h / d + pad * 2, d);
  c.image(b, pad, pad);
  return c.render({ outline: 'A', ao: 0, sep: false });
}

/**
 * The game's registered recruit (legs + pistol torso composed at the hip) at density `dd`, for
 * pose `name`. Since the UHD wave the registered 2× frames are the HD rig's (not the pre-wave 2×
 * art), so the sheets label them "game 2x".
 */
function gameHero(name: string, dd: 1 | 2 = 2): PixelBuffer {
  const legsId = name === 'run' ? 'char/recruit/legs-run' : 'char/recruit/legs-idle';
  const torsoId = name === 'run' ? 'char/recruit/torso-pistol-run' : name === 'shoot' ? 'char/recruit/torso-pistol-shoot' : 'char/recruit/torso-pistol-idle';
  const legs = getFrames(legsId, dd)[name === 'run' ? 3 : 0];
  const torso = getFrames(torsoId, dd)[0];
  const b = new PixelBuffer(HERO_W * dd, HERO_H * dd);
  const hip = legs.pts?.hip ?? [0, -16];
  const ax = 16;
  const ay = HERO_H - 3;
  b.blit(legs.buf, (ax - legs.ox) * dd, (ay - legs.oy) * dd);
  b.blit(torso.buf, (ax + hip[0] - torso.ox) * dd, (ay + hip[1] - torso.oy) * dd);
  return b;
}

/** The game's 1× recruit head, cut from its 1× idle frame (its own colours), HEAD_W × HEAD_H logical px round the head point. */
function gameHead1x(): PixelBuffer {
  const hp = tp(POSES[0].hip, POSES[0].lean, 1, -14);
  return gameHero('idle', 1).crop(Math.round(hp[0] - HEAD_CENTER[0]), Math.round(hp[1] - HEAD_CENTER[1]), HEAD_W, HEAD_H);
}

/** The game's registered 2× Swan neck frame (since the UHD wave: the HD tin-feather neck). */
function gameSwan(): PixelBuffer {
  return getFrames('vehicle/swan/neck', 2)[0].buf;
}

/** Minimal PNG reader (8-bit RGBA / RGB, non-interlaced) for the game's street shot. */
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
/** The game's section a at res 2 and art 2 (the registered 2× art), cropped to the spike's street window. */
function gameStreet(out: string): PixelBuffer | null {
  const file = join(out, 'game-ams-a-res2.png');
  try {
    if (!existsSync(file)) {
      execFileSync('npx', ['tsx', 'tools/shot.ts', '--mission', 'ams', '--section', 'a', '--res', '2', '--art', '2', '--ticks', '240', '--out', file], { stdio: 'ignore' });
    }
    const shot = readPNG(file);
    // The frame sits at (4k, 14k) = (8, 28) in the shot sheet; window: logical x 150..278, y 96..192.
    return shot.crop(8 + 150 * 2, 28 + 96 * 2, ST_W * 2, ST_H * 2);
  } catch (e) {
    console.warn(`the game's street shot failed: ${String(e)}`);
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
      w += Math.max(c.buf.w * k, measureText(c.label).w) + pad;
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
      // A cell is as wide as its label, so labels never run into the next cell's.
      x += Math.max(img.w, measureText(c.label).w) + pad;
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

/** Run `fn` once (cold: JIT warm-up included) and 5 more times; log both (the warm median is the steady cost a worker pays). */
function timed<T>(label: string, fn: () => T, times: string[]): T {
  const t0 = process.hrtime.bigint();
  const out = fn();
  const cold = ms(t0);
  const warm: number[] = [];
  for (let i = 0; i < 5; i++) {
    const t = process.hrtime.bigint();
    fn();
    warm.push(ms(t));
  }
  warm.sort((x, y) => x - y);
  times.push(`${label}: ${cold.toFixed(1)} ms cold, ${warm[2].toFixed(1)} ms warm (median of 5)`);
  return out;
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

  const abRows: Cell[][] = [];
  for (const d of [2, 4] as const) {
    const scale = d === 4 ? 4 : 2;
    if (want('hero')) {
      const rows: Cell[][] = [];
      for (const pose of POSES) {
        const buf = timed(`hero ${pose.name} ${d}x`, () => drawHero(pose, d, 'A'), times);
        rows.push([
          { label: `game 2x ${pose.name}`, buf: gameHero(pose.name), dens: 2 },
          { label: `${d}x (outline A)`, buf, dens: d },
        ]);
        save(buf, `hero-${pose.name}@${d}x-real.png`);
        // The A / B comparison (one sheet, both densities at 4 sheet px per logical px).
        abRows.push([
          { label: `${pose.name} ${d}x A`, buf, dens: d },
          { label: `${pose.name} ${d}x B`, buf: drawHero(pose, d, 'B'), dens: d },
        ]);
      }
      save(sheet(`HERO (recruit) ${d}x vs game 2x - outline A`, rows, scale), `hero@${d}x.png`);
    }
    if (want('gear')) {
      const PROPS: PropKind[] = ['umbrella', 'needles', 'pan', 'wrench', 'plan', 'pistol-butt', 'plunger', 'airliner', 'frikandel'];
      const pairs: Array<[string, PixelBuffer, PixelBuffer]> = [
        ['pistol', gunArt('pistol').buf, gunArtHd('pistol', d)],
        ['heavy', gunArt('heavy').buf, gunArtHd('heavy', d)],
        ['rifle', gunArt('rifle').buf, gunArtHd('rifle', d)],
        ['knife', knifeArt(), knifeArtHd(d)],
        ['grenade', grenadeArt(), heldArtHd('grenade', d)],
        ['gift', giftArt(), heldArtHd('gift', d)],
        ['snack', snackArt(), heldArtHd('snack', d)],
        ...PROPS.map((k): [string, PixelBuffer, PixelBuffer] => [k, propArt(k).buf, propArtHd(k, d)]),
        ['head', gameHead1x(), renderHeadHd(RECRUIT_HEAD, 'normal', d)],
      ];
      const rows: Cell[][] = [];
      for (let i = 0; i < pairs.length; i += 4) {
        rows.push(pairs.slice(i, i + 4).flatMap(([n, a, b]) => [{ label: `1x ${n}`, buf: a, dens: 1 }, { label: `${d}x`, buf: outlined(b, d), dens: d }]));
      }
      save(sheet(`GEAR + HEAD contracts ${d}x vs 1x (outline A added for the sheet; the rig outlines the figure)`, rows, scale), `gear@${d}x.png`);
    }
    if (want('swan')) {
      const buf = timed(`swan neck ${d}x`, () => drawSwan(d, 'A'), times);
      save(sheet(`SWAN head + neck ${d}x vs game 2x - outline A`, [[{ label: 'game 2x', buf: gameSwan(), dens: 2 }, { label: `${d}x A`, buf, dens: d }]], scale), `swan@${d}x.png`);
    }
    if (want('street')) {
      const game = gameStreet(a.out);
      const buf = timed(`street ${d}x`, () => drawStreet(d), times);
      const rows: Cell[][] = game ? [[{ label: 'game 2x (ams a)', buf: game, dens: 2 }], [{ label: `${d}x (no outline; decor C)`, buf, dens: d }]] : [[{ label: `${d}x`, buf, dens: d }]];
      save(sheet(`STREET 128x96 ${d}x vs game 2x - backgrounds no outline, facade decor C`, rows, scale), `street@${d}x.png`);
      save(buf, `street@${d}x-real.png`);
    }
  }
  if (abRows.length) save(sheet('HERO outline A vs B (2x and 4x, 4 sheet px per logical px)', abRows, 4), 'hero-outline-ab.png');
  const md = [
    '# UHD style spike (npm run uhd-spike)',
    '',
    ...CHANGES,
    '',
    'Plan: uhd-arcade-fidelity, group found (KIT). Kit: src/game/art/hd/, palette: src/engine/palette-hd.ts,',
    'docs/ART_GUIDE.md "UHD art". Sheets show 4 sheet px per logical px at 4x (the game\'s 2x art enlarged 2 x 2, 1x gear 4 x 4)',
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
