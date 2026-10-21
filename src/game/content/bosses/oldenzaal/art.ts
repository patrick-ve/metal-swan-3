/**
 * The art of St. Plechelmus, the statue mini-boss (docs/design/oldenzaal.md §5.1; a likeness by
 * eye from the user's photo, never traced or sampled): a seated bishop in weathered grey-green
 * stone — the tall mitre with its cleft and orphrey bands, the robe and the cope with a broad
 * collar, the stole down the front, the right hand raised with a small reliquary, the left hand
 * holding the long crozier with its curled head across the body — on a tall stepped plinth of
 * square blocks with a dark plaque `ST.` / `PLECHELMUS` in our own lettering, a stone throne on it.
 *
 * ONE density-generic drawer per id: every frame is painted by the HD kit (HdCanvas: lit
 * primitives, form shading, weathering, AO, cast shadows) at d 1, 2 and 4 — at d 1 on PAL ramps
 * (the 64 colours), at d 2 / 4 on `PAL_HD` / `PAL_HD_OZ_R2` ramps — so a 2× / 4× frame has its 1×
 * frame's logical size, anchor and points (geometry is law). Outline A for everything that moves
 * or can be hit (the statue, the crozier, the stone, the bits, the waves); outline C for the
 * plinth (static decor drawn by the boss).
 *
 * Sprites (`boss/oz-plechelmus/…`): `sit` (7 seated poses, geometry.ts SIT_POSES), `stand` (10
 * standing poses), `crozier` / `crozier-broken` (one frame per CROZIER_ANGLES entry, anchored at
 * the grip), `fist` (the crozier hand drawn over the shaft), `shaft` (the hook's stretched staff,
 * a horizontal tile), `plinth` (4 frames: 0 … 3 blocks missing), `stone` (4, the tumbling block),
 * `bit` (3, the small stones), `wave` (4, the shockwave), `sweep` (4, the low sweep wave).
 * Effects (`fx/oz/statue/…`): `crack` (3, a glowing crack, drawn additive), `eyes` (2, the
 * glowing eyes), `glow` (1, a soft green glow for the additive pass).
 * The TO BE CONTINUED card's art is in tbc-art.ts (`ui/oz-tbc/…`).
 */
import type { Color } from '../../../../engine/color';
import { nearest as nearestPal } from '../../../../engine/palette';
import { PAL_HD, PAL_HD_OZ, PAL_HD_OZ_R2 } from '../../../../engine/palette-hd';
import type { Ramp } from '../../../../engine/pixel';
import type { Frame } from '../../../../engine/render';
import { defineSprite } from '../../../../engine/sprites';
import { HdCanvas, type HdMaterial, type RenderOpts, type Texture } from '../../../art/hd';
import { hash2, noise2 } from '../../../art/paint';
import { Pen, outlineA, tinyText, tinyWidth, type Dn } from '../../missions/oldenzaal/art-kit';
import {
  CROZIER,
  CROZIER_ANGLES,
  PLINTH,
  SIT_FRAME,
  SIT_POSES,
  STAND_FRAME,
  STAND_POSES,
  STATUE,
  type BodyPose,
  type V2,
} from './geometry';

export const ART = 'boss/oz-plechelmus';
export const FX = 'fx/oz/statue';

/** Every sprite id this module registers (tests, the sprites tool). */
export const STATUE_SPRITES: string[] = [];

// =============================================================================== palette

const palCache = new Map<number, Color>();
function pal1(c: Color): Color {
  const k = (c | 255) >>> 0;
  let hit = palCache.get(k);
  if (hit === undefined) {
    hit = nearestPal(k) >>> 0;
    palCache.set(k, hit);
  }
  return hit;
}

/** An HD ramp for density d: itself at 2 / 4, its nearest PAL tones (no repeats) at 1. */
function rampD(r: Ramp, d: Dn): Ramp {
  if (d !== 1) return r;
  if (r === STONE) return STONE_1X;
  const out: Color[] = [];
  for (const c of r) {
    const p = pal1(c);
    if (out[out.length - 1] !== p) out.push(p);
  }
  return out as unknown as Ramp;
}

/** Weathered grey-green stone (the statue): field grey's green greys, bone-pale on top. */
const STONE: Ramp = PAL_HD_OZ_R2.fieldGrey;
/** The statue's stone at 1× (the 64 colours): a cool neutral grey, no green patches. */
const STONE_1X: Ramp = [0x221a28ff, 0x3b4457ff, 0x635857ff, 0x8e827aff, 0xbeb1a2ff] as unknown as Ramp;
/** The plinth's paler weathered stone. */
const PLINTH_STONE: Ramp = PAL_HD.stone;
/** Lichen on the stone (moss). */
const LICHEN: Ramp = PAL_HD.moss;
/** The plaque's dark bronze. */
const PLAQUE: Ramp = PAL_HD.black;
/** The curse's glow (Mevrouw Winkel's cold green). */
const GHOST: Ramp = PAL_HD_OZ.ghost;

/** A sprite's look: outline A, AO, the cool rim light, short cast shadows. */
const SPRITE_LOOK: RenderOpts = { outline: 'A', ao: 0.35, rimLight: 2, shadow: 0.28, shadowMax: 2.5 };
/** The plinth: static decor, outline C. */
const DECOR_LOOK: RenderOpts = { outline: 'C', ao: 0.3, shadow: 0.3, shadowMax: 3 };

interface Mats {
  stone: number;
  stoneDark: number;
  lichen: number;
  plinth: number;
  plaque: number;
}

function mats(c: HdCanvas, d: Dn): Mats {
  const stone: HdMaterial = { ramp: rampD(STONE, d), amb: 0.08, rim: 0.35, wrap: 0.12, bounce: 0.25 };
  return {
    stone: c.material(stone),
    stoneDark: c.material({ ...stone, gain: 0.7 }),
    lichen: c.material({ ramp: rampD(LICHEN, d), amb: 0.08, wrap: 0.1 }),
    plinth: c.material({ ramp: rampD(PLINTH_STONE, d), amb: 0.1, wrap: 0.1, bounce: 0.2, edge: 'C' }),
    plaque: c.material({ ramp: rampD(PLAQUE, d), amb: 0.05, spec: 0.3, shine: 18 }),
  };
}

// =============================================================================== textures

/**
 * Weathered stone: soft blotches, pitting at 4×, rain streaks running down, lichen patches (the
 * material switches to lichen in the blotches' cores). Tone only (plus the material switch).
 */
function weathered(seed: number, lichen: number, amount = 1): Texture {
  return (s) => {
    const n = noise2(s.x, s.y, 3.2, seed);
    if (n > 0.62) s.tone -= (n - 0.62) * 0.75 * amount;
    // Rain streaks: columns of darker tone that fade downward from random starts.
    const col = Math.floor(s.x * 1.5);
    const h = hash2(col, 3, seed + 7);
    if (h > 0.78) {
      const start = hash2(col, 5, seed + 9) * 40;
      const k = (s.y + 100 - start) % 40;
      if (k > 0 && k < 26) s.tone -= 0.18 * amount * (1 - k / 26);
    }
    if (s.d >= 2 && hash2(Math.floor(s.x * s.d), Math.floor(s.y * s.d), seed + 3) > 0.94) s.tone -= 0.22;
    if (s.d >= 4 && hash2(Math.floor(s.x * 4), Math.floor(s.y * 4), seed + 5) > 0.97) s.tone += 0.16;
    if (lichen > 0 && s.d >= 2 && noise2(s.x + 40, s.y, 1.6, seed + 21) > 0.93 - lichen * 0.05 && hash2(Math.floor(s.x * 2), Math.floor(s.y * 2), seed) > 0.35) s.mat = -1;
  };
}

/** Vertical robe folds (soft ridges with dark valleys), patchy. */
function robeFolds(seed: number, spacing = 3.2): Texture {
  return (s) => {
    const ph = (s.x + (noise2(s.x, s.y, 7, seed) - 0.5) * 2.4) / spacing;
    const k = Math.floor(ph);
    const f = ph - k;
    if (hash2(k, 1, seed) > 0.72) return;
    const r = f < 0.5 ? f * 2 : (1 - f) * 2;
    s.nx += (f < 0.5 ? -1 : 1) * 0.35 * (1 - r);
    if (r < 0.14) s.tone -= 0.28;
  };
}

/** Chain textures and resolve the lichen switch (mat −1) to the lichen material. */
function tex(m: Mats, ...ts: Texture[]): Texture {
  return (s) => {
    const own = s.mat;
    for (const t of ts) t(s);
    if (s.mat === -1) s.mat = m.lichen;
    else if (s.mat !== own && s.mat <= 0) s.mat = own;
  };
}

// =============================================================================== the statue

type P = (x: number, y: number) => [number, number];

/** Upper-body transform: shoulders lean in x and dip in y, the hem stays put. */
function bodyXf(ax: number, ay: number, pose: BodyPose): P {
  const top = pose.seated ? 14 : 34;
  const span = pose.seated ? 40 : 46;
  return (x, y) => {
    const k = Math.max(0, Math.min(1, (-y - top) / span));
    return [ax + x + pose.lean * k, ay + y + pose.dip * k];
  };
}

/** Simple two-bone arm: shoulder S, hand H, segment lengths a, b; the elbow bends away (side ±1) and down. */
function elbow(S: V2, H: V2, a: number, b: number, side: number): [number, number] {
  const dx = H[0] - S[0];
  const dy = H[1] - S[1];
  const D = Math.max(0.01, Math.hypot(dx, dy));
  if (D >= a + b - 0.01) return [S[0] + (dx * a) / (a + b), S[1] + (dy * a) / (a + b)];
  const x = (a * a - b * b + D * D) / (2 * D);
  const h = Math.sqrt(Math.max(0, a * a - x * x));
  // Perpendicular, choosing the side that points outward (side) and down.
  let px = -dy / D;
  let py = dx / D;
  if (px * side + py * 0.4 < 0) {
    px = -px;
    py = -py;
  }
  return [S[0] + (dx * x) / D + px * h, S[1] + (dy * x) / D + py * h];
}

/** The small reliquary in the raised hand (a little gabled box with a cross). */
function relic(c: HdCanvas, m: Mats, x: number, y: number, z: number, seed: number): void {
  c.box(x - 1.8, y - 4.2, 3.6, 3.2, { mat: m.stone, z, bevel: 0.5, tex: weathered(seed, 0, 0.6) });
  c.poly(
    [
      [x - 2.2, y - 4.1],
      [x, y - 6],
      [x + 2.2, y - 4.1],
    ],
    { mat: m.stone, z: z + 0.2, n: [-0.2, -0.6, 0.8] },
  );
  c.box(x - 0.3, y - 8, 0.6, 2.2, { mat: m.stone, z: z + 0.4 });
  c.box(x - 0.9, y - 7.4, 1.8, 0.6, { mat: m.stone, z: z + 0.4 });
}

/** A plinth block (the thrown stone): a bevelled box of the plinth's stone. */
function block(c: HdCanvas, m: Mats, x: number, y: number, w: number, h: number, z: number, seed: number): void {
  c.box(x, y, w, h, { mat: m.plinth, z, bevel: Math.min(w, h) * 0.18, tex: weathered(seed, 0, 0.8) });
}

/**
 * The statue's body in a pose (no crozier: it is its own sprite) on canvas `c` with the anchor at
 * (ax, ay): seated (feet on the plinth's top, the throne behind is the plinth's) or standing.
 */
export function drawStatueBody(c: HdCanvas, d: Dn, pose: BodyPose, ax: number, ay: number, seed = 3): void {
  const m = mats(c, d);
  const T = bodyXf(ax, ay, pose);
  const W = (x: number, y: number, s = seed): Texture => tex(m, weathered(s + Math.round(x * 3 + y), 0.5));
  const seated = pose.seated;
  // Key heights (seated / standing).
  const yS = seated ? -46 : -64; // shoulders
  const yW = seated ? -27 : -42; // waist / lap
  const yH = seated ? -56 : -74; // head centre
  const hem = -1.5;
  const sh: V2 = [-12.5, yS + 1.5];
  const sr: V2 = [12.5, yS + 1.5];

  // -- the cope's back (behind the arms): a broad mantle from the collar down past the lap.
  {
    const pts: Array<[number, number]> = seated
      ? [T(-14, yS - 2), T(14, yS - 2), T(22, -22), T(21, -5), T(-21, -5), T(-22, -22)]
      : [T(-14, yS - 2), T(14, yS - 2), T(19, -40), T(17, -16), T(9, -12), T(-9, -12), T(-17, -16), T(-19, -40)];
    c.blob(pts, 3.5, { mat: m.stone, z: 1, bulge: 0.3, tex: tex(m, weathered(seed + 1, 0.6), robeFolds(seed + 2, 3.6)) });
  }
  // -- the robe: seated over the knees; standing down to the hem.
  if (seated) {
    // The robe from the knees down: widest at the knees, falling straight and a little narrower
    // to the feet (a seated figure seen from the front, not a cone).
    c.blob([T(-17, -27), T(17, -27), T(17, -20), T(14.5, hem), T(-14.5, hem), T(-17, -20)], 3, { mat: m.stone, z: 3, bulge: 0.22, tex: tex(m, weathered(seed + 3, 0.4), robeFolds(seed + 4, 2.8)) });
    // The lap: the thighs come toward the viewer; two knees under the cloth, their tops catch the
    // light, a soft valley between them and a shadow under the knees' overhang.
    c.ellipsoid(...T(0, -25.5), 16.5, 4.2, { mat: m.stone, z: 4, round: 0.7, tex: W(0, -25) });
    c.ellipsoid(...T(-7, -23.2), 7.4, 4.2, { mat: m.stone, z: 4.4, round: 0.85, tex: W(-7, -23) });
    c.ellipsoid(...T(7, -23.2), 7.4, 4.2, { mat: m.stone, z: 4.4, round: 0.85, tex: W(7, -23) });
    c.shade(ax - 17, ay - 28, 34, 3, (_x, y) => (y < ay - 26.5 ? 0.12 : 0.06));
    c.shade(ax - 1.6, ay - 26, 3.2, 8, (x) => (Math.abs(x - ax) < 0.9 ? -0.32 : -0.12));
    c.shade(ax - 16, ay - 20, 32, 2.6, (_x, y) => (y < ay - 18.6 ? -0.34 : -0.16));
    // The robe falls from the knees in deep vertical folds down to the feet.
    c.shade(ax - 16, ay - 17.4, 32, 16, (x) => {
      const u = x - ax;
      return Math.abs(u) < 0.9 || Math.abs(Math.abs(u) - 7) < 0.6 || Math.abs(Math.abs(u) - 12.5) < 0.6 ? -0.28 : Math.abs(Math.abs(u) - 4) < 1.2 ? 0.08 : 0;
    });
  } else {
    const fl = pose.feet ?? [-6, 6, 0, 0];
    const sway = (fl[1] + fl[0]) * 0.5;
    c.blob([T(-12, yW - 2), T(12, yW - 2), [ax + 15 + sway, ay + hem - 1], [ax - 15 + sway, ay + hem - 1]], 3, {
      mat: m.stone,
      z: 3,
      bulge: 0.22,
      tex: tex(m, weathered(seed + 3, 0.4), robeFolds(seed + 4, 3.2)),
    });
  }
  // The feet (sandalled toes under the hem).
  {
    const fl = pose.feet ?? [-6, 6, 0, 0];
    const lx = seated ? -6 : fl[0];
    const rx = seated ? 6 : fl[1];
    c.ellipsoid(ax + lx, ay - 1.6 - (seated ? 0 : fl[2]), 3.4, 2, { mat: m.stone, z: 5, tex: W(lx, 0) });
    c.ellipsoid(ax + rx, ay - 1.6 - (seated ? 0 : fl[3]), 3.4, 2, { mat: m.stone, z: 5, tex: W(rx, 0) });
  }
  // -- the chasuble over the torso.
  // A bell: narrow at the shoulders, wide at the waist, its curved hem falling to a soft point
  // in front (over the lap when seated, to the knees when standing); the alb shows below it.
  {
    const bot = seated ? -27 : -24;
    const side = seated ? 15.5 : 15;
    const pts: Array<[number, number]> = [T(-11, yS - 1), T(11, yS - 1), T(side - 1, yW - 8), T(side, yW + (seated ? -4 : 4))];
    for (let i = 1; i < 8; i++) {
      const u = i / 8;
      const x = side - 2 * side * u;
      const y = bot + (seated ? -5 : -10) * Math.pow(Math.abs(2 * u - 1), 1.6);
      pts.push(T(x, y));
    }
    pts.push(T(-side, yW + (seated ? -4 : 4)), T(-side + 1, yW - 8));
    c.blob(pts, 2.6, { mat: m.stone, z: 5, bulge: 0.38, tex: tex(m, weathered(seed + 5, 0.3), robeFolds(seed + 6, 4.6)) });
  }
  // The stole: a raised band down the front.
  c.poly([T(-2.4, yS + 1), T(2.4, yS + 1), T(2.6, seated ? -26 : -27), T(-2.6, seated ? -26 : -27)], { mat: m.stone, z: 6, tone: 0.12, n: [0, -0.05, 1] });
  if (d >= 2) {
    // A small cross worked into the stole.
    const [cx, cy] = T(0, yS + 9);
    c.box(cx - 0.35, cy - 2, 0.7, 4, { mat: m.stone, z: 6.3, tone: 0.15 });
    c.box(cx - 1.4, cy - 1, 2.8, 0.7, { mat: m.stone, z: 6.3, tone: 0.15 });
  }
  // The broad collar of the cope.
  c.ellipsoid(...T(0, yS - 1.5), 11, 3.6, { mat: m.stone, z: 6.5, tex: W(0, yS) });
  // Neck and head.
  c.capsule(...T(0, yS - 3), ...T(0, yS - 6), 2.8, 2.8, { mat: m.stone, z: 7 });
  const [hx, hy] = T(0, yH);
  c.ellipsoid(hx, hy, 5.6, 6.6, { mat: m.stone, z: 8, tex: tex(m, weathered(seed + 9, 0, 0.5)) });
  // Face (stern, calm, clean-shaven, like the real statue): a lit brow ridge over deep eye
  // sockets with the stone eyeballs in them, a straight nose with its shadow under it, hollow
  // cheeks, a firm mouth line, a strong chin, the ears.
  c.ellipsoid(hx - 5, hy + 0.5, 1.1, 2, { mat: m.stone, z: 7.5 });
  c.ellipsoid(hx + 5, hy + 0.5, 1.1, 2, { mat: m.stone, z: 7.5 });
  c.ellipsoid(hx, hy - 2.1, 4.2, 1.1, { mat: m.stone, z: 8.8, round: 0.5, tone: 0.12 });
  // The jaw narrows to the chin (the head is not a ball).
  c.shade(hx - 6, hy + 2, 12, 5, (x, y) => {
    const u = Math.abs(x - hx);
    const edge = 5.4 - (y - hy - 2) * 0.55;
    return u > edge ? -0.3 : u > edge - 1 ? -0.12 : 0;
  });
  // The eye sockets under the brow, the stone eyeballs a little lighter in them.
  c.shade(hx - 4, hy - 1.4, 8, 2.2, (x, y) => {
    const u = Math.abs(x - hx) - 2;
    const v = y - (hy - 0.4);
    const k = (u * u) / 2 + (v * v) / 0.9;
    if (k > 1) return 0;
    return k < 0.3 ? -0.16 : -0.46;
  });
  // The nose: a lit straight bridge, its shadow side and a short shadow under the tip.
  c.ellipsoid(hx - 0.1, hy + 1, 0.95, 2.3, { mat: m.stone, z: 9.2, round: 0.9, tone: 0.2 });
  c.shade(hx + 0.5, hy - 0.6, 1, 3.4, () => -0.16);
  c.shade(hx - 1.2, hy + 3.1, 2.4, 0.6, () => -0.3);
  // A firm, short mouth line and the lit lower lip; the chin.
  c.shade(hx - 1.4, hy + 4.2, 2.8, 0.55, () => -0.34);
  c.shade(hx - 1.1, hy + 4.8, 2.2, 0.5, () => 0.1);
  c.ellipsoid(hx, hy + 5.6, 1.7, 1, { mat: m.stone, z: 8.9, round: 0.6, tone: 0.08 });
  // -- the mitre: the tall front panel with the cleft, the band round the base and the orphrey.
  {
    const by = hy - 4.6;
    const pts: Array<[number, number]> = [];
    // The left half (base → a gentle outward bulge → the left peak), then mirrored.
    const half: Array<[number, number]> = [
      [-6.4, 0],
      [-6.9, -4],
      [-6.6, -8],
      [-5.2, -12],
      [-2.8, -15.6],
      [-1.4, -16.6],
      [-0.4, -14.4],
    ];
    for (const [x, y2] of half) pts.push([hx + x, by + y2]);
    for (let i = half.length - 1; i >= 0; i--) pts.push([hx - half[i][0], by + half[i][1]]);
    c.poly(pts, { mat: m.stone, z: 8.6, n: [0, -0.1, 1], tex: W(0, by, seed + 11) });
    // Its curved sides roll away (a slight cylinder), the cleft between the two peaks is dark.
    c.shade(hx - 7, by - 17, 14, 17, (x) => -Math.max(0, Math.abs(x - hx) - 3.4) * 0.16);
    c.box(hx - 6.6, by - 2.2, 13.2, 2.4, { mat: m.stone, z: 9, bevel: 0.7, tone: 0.1 });
    c.box(hx - 1, by - 15, 2, 13, { mat: m.stone, z: 8.9, bevel: 0.45, tone: 0.12 });
    if (d >= 2) c.box(hx - 3.6, by - 9, 7.2, 1.3, { mat: m.stone, z: 8.95, bevel: 0.4, tone: 0.08 });
  }
  // -- the arms with their wide sleeves (the raised hand on the viewer's left, the crozier hand on the right).
  const arm = (S: V2, H: V2, side: number, part: number): void => {
    const s = T(S[0], S[1]);
    const h: V2 = [ax + H[0], ay + H[1]];
    const e = elbow(s, h, 9.5, 9.5, side);
    const wx = e[0] + (h[0] - e[0]) * 0.78;
    const wy = e[1] + (h[1] - e[1]) * 0.78;
    // The bell sleeve hangs below the forearm (gravity), wider at the cuff.
    const drop = 6.5;
    c.blob(
      [
        [e[0] - side * 1.2, e[1] - 1.6],
        [wx, wy - 2.4],
        [wx + (wx - e[0]) * 0.12, wy + drop],
        [e[0] + (wx - e[0]) * 0.4, Math.max(e[1], wy) + drop * 0.8],
        [e[0] + side * 1.5, e[1] + 2.4],
      ],
      1.6,
      { mat: m.stone, z: 9.8, part: part + 1, bulge: 0.35, tex: tex(m, weathered(seed + part + 2, 0.3), robeFolds(seed + part, 2.2)) },
    );
    c.capsule(s[0], s[1], e[0], e[1], 3.6, 3.2, { mat: m.stone, z: 10, part, tex: W(S[0], S[1], seed + part) });
    c.capsule(e[0], e[1], wx, wy, 3.2, 3, { mat: m.stone, z: 10.2, part, tex: W(S[0], S[1], seed + part + 1) });
    // The cuff and the hand.
    c.ellipsoid(wx, wy, 2.6, 2.6, { mat: m.stone, z: 10.5, round: 0.6, tone: -0.05 });
    c.ellipsoid(h[0], h[1], 2.3, 2.6, { mat: m.stone, z: 11, tone: 0.06 });
  };
  arm(sh, pose.raise, -1, 50);
  arm(sr, pose.hand, 1, 60);
  if (pose.holds === 'relic') relic(c, m, ax + pose.raise[0], ay + pose.raise[1] - 1.4, 11.5, seed + 13);
  if (pose.holds === 'block') block(c, m, ax + pose.raise[0] - 6, ay + pose.raise[1] - 11, 12, 9, 12, seed + 17);
}

// =============================================================================== the crozier

/** The crozier's points before rotation (grip at the origin, the shaft up the y axis). */
function crozierLocal(broken: boolean): { foot: V2; top: V2; knop: V2; curl: Array<[number, number]> } {
  const L = CROZIER.len;
  const g = CROZIER.grip;
  const foot: V2 = [0, g];
  const top: V2 = [0, broken ? -(L - g) * 0.35 : -(L - g - CROZIER.curlR * 2)];
  const knop: V2 = [0, -(L - g) * 0.42];
  const curl: Array<[number, number]> = [];
  if (!broken) {
    // A crook: up from the shaft's top, over and down, curling inward (a spiral).
    const r0 = CROZIER.curlR;
    const cx = r0 * 0.95;
    const cy = top[1];
    for (let i = 0; i <= 14; i++) {
      const a = Math.PI + (i / 14) * Math.PI * 1.65;
      const r = r0 * (1 - (i / 14) * 0.55);
      curl.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
  }
  return { foot, top, knop, curl };
}

function rot(p: V2, a: number): [number, number] {
  const s = Math.sin(a);
  const c = Math.cos(a);
  return [p[0] * c - p[1] * s, p[0] * s + p[1] * c];
}

/** The crozier frame of angle index i (whole or broken): tight bounds, anchored at the grip. */
function crozierFrame(i: number, broken: boolean, d: Dn): Frame {
  const a = (CROZIER_ANGLES[i] * Math.PI) / 180;
  const loc = crozierLocal(broken);
  const pts = [loc.foot, loc.top, loc.knop, ...loc.curl].map((p) => rot(p, a));
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [x, y] of pts) {
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  }
  const pad = 4;
  const ox = Math.ceil(-x0 + pad);
  const oy = Math.ceil(-y0 + pad);
  const w = Math.ceil(x1 + ox + pad);
  const h = Math.ceil(y1 + oy + pad);
  const c = new HdCanvas(w, h, d);
  const m = mats(c, d);
  const P = (p: V2): [number, number] => {
    const r = rot(p, a);
    return [r[0] + ox, r[1] + oy];
  };
  const W = tex(m, weathered(29 + i, 0.4, 0.8));
  c.capsule(...P(loc.foot), ...P(loc.top), 1.3, 1.25, { mat: m.stone, z: 2, tex: W });
  c.ellipsoid(...P(loc.knop), 2.1, 2.1, { mat: m.stone, z: 3, tex: W });
  if (broken) {
    // A jagged break with a pale fresh face.
    const t = P(loc.top);
    c.ellipsoid(t[0], t[1], 1.7, 1.7, { mat: m.plinth, z: 3, tone: 0.3 });
  } else {
    const curl = loc.curl.map(P);
    c.stroke(curl, 1.5, 0.9, { mat: m.stone, z: 3, tex: W });
    // A small leaf bud at the curl's end.
    const e = curl[curl.length - 1];
    c.ellipsoid(e[0], e[1], 1.3, 1.3, { mat: m.stone, z: 3.4, tone: 0.1 });
  }
  return { buf: c.render(SPRITE_LOOK), ox, oy, ...(d === 1 ? {} : { density: d }) };
}

// =============================================================================== the plinth

/** Plinth geometry (logical, relative to the floor centre). */
const PL = {
  base: { w: 60, h: 6 },
  /** The courses taper upward (a tall stepped pillar, narrower at the top). */
  courses: [
    { w: 54, h: 12 },
    { w: 49, h: 11 },
    { w: 44, h: 11 },
  ],
  top: { w: 47, h: 6 },
  /** The throne: seat block width / height above the plinth's top, the back's top. */
  throne: { w: 34, back: 34 },
} as const;

/** The missing blocks' slots (course index, block index from the left), in the order they go. */
const MISSING: ReadonlyArray<readonly [number, number]> = [
  [2, 0],
  [1, 3],
  [2, 3],
];

function plinthFrame(missing: number, d: Dn): Frame {
  const W = PLINTH.frameW;
  const H = PLINTH.frameH;
  const c = new HdCanvas(W, H, d);
  const m = mats(c, d);
  const cx = W / 2;
  const fy = H; // the floor
  let y = fy - PL.base.h;
  c.box(cx - PL.base.w / 2, y, PL.base.w, PL.base.h, { mat: m.plinth, z: 4, bevel: 1.2, tex: weathered(41, 0, 0.9) });
  for (let k = 0; k < PL.courses.length; k++) {
    const cr = PL.courses[k];
    y -= cr.h;
    const n = 4;
    const bw = cr.w / n;
    for (let b = 0; b < n; b++) {
      const gone = MISSING.slice(0, missing).some(([ck, cb]) => ck === k && cb === b);
      const x = cx - cr.w / 2 + b * bw;
      const jog = (k + b) % 2 === 0 ? 0 : bw * 0.18;
      if (gone) {
        // A dark socket where the block was torn out.
        c.box(x + 0.3, y + 0.3, bw - 0.6, cr.h - 0.6, { mat: m.plinth, z: 1, tone: -0.8 });
        continue;
      }
      c.box(x + 0.25, y + 0.25, bw - 0.5 + (b === n - 1 ? 0 : jog * 0), cr.h - 0.5, { mat: m.plinth, z: 3 + (b % 2) * 0.1, bevel: 0.9, tex: weathered(43 + k * 7 + b, 0, 0.9) });
    }
  }
  // The plaque on the middle course: dark bronze, our own lettering in two lines.
  {
    const pw = 44;
    const ph = 13;
    const px = cx - pw / 2;
    const py = fy - PL.base.h - PL.courses[0].h - PL.courses[1].h + 0.5 - 1;
    if (missing < 2) {
      c.box(px, py, pw, ph, { mat: m.plaque, z: 3.6, bevel: 0.6, tex: weathered(51, 0, 0.5) });
      const pen = new Pen(pw, ph, d);
      const ink = 1;
      const l1 = 'ST.';
      const l2 = 'PLECHELMUS';
      tinyText(pen, l1, (pw - tinyWidth(l1)) / 2, 1.5, ink);
      tinyText(pen, l2, (pw - tinyWidth(l2)) / 2, 7, ink);
      const lit = d === 1 ? pal1(PAL_HD.stone[4]) : PAL_HD.stone[5];
      const deep = d === 1 ? pal1(PAL_HD.ink[1]) : PAL_HD.ink[0];
      c.paint(px, py, pw, ph, (_x, _y, X, Y) => {
        const lx = X - Math.round(px * d);
        const ly = Y - Math.round(py * d);
        if (pen.at(lx, ly) !== 0) return d >= 2 && pen.at(lx, ly - 1) === 0 ? deep : lit;
        if (d >= 2 && pen.at(lx - 1, ly - 1) !== 0) return deep;
        return 0;
      }, 4);
    }
  }
  y -= PL.top.h;
  c.box(cx - PL.top.w / 2, y, PL.top.w, PL.top.h, { mat: m.plinth, z: 4.5, bevel: 1.2, tex: weathered(57, 0, 0.9) });
  // The throne on top: a seat block with a back (behind the seated saint).
  const ty = y;
  c.box(cx - PL.throne.w / 2, ty - 14, PL.throne.w, 14, { mat: m.stone, z: 2, bevel: 1.3, tex: tex(m, weathered(61, 0.6)) });
  c.box(cx - PL.throne.w / 2 + 2, ty - PL.throne.back, PL.throne.w - 4, PL.throne.back - 13, { mat: m.stoneDark, z: 1, r: 3, bevel: 1.6, tex: tex(m, weathered(63, 0.6)) });
  // The throne's arms beside the lap (they show past the robe: he SITS), on short square posts.
  for (const side of [-1, 1]) {
    const x0 = side < 0 ? cx - 22.5 : cx + 17.5;
    c.box(x0, ty - 13, 5, 13, { mat: m.stoneDark, z: 2.2, bevel: 1, tex: tex(m, weathered(65 + side, 0.6)) });
    c.box(x0 - 0.5, ty - 16, 6, 3.4, { mat: m.stone, z: 2.4, bevel: 1, tex: tex(m, weathered(67 + side, 0.6)) });
  }
  return { buf: c.render(DECOR_LOOK), ox: cx, oy: fy, ...(d === 1 ? {} : { density: d }) };
}

// =============================================================================== shots

function stoneFrame(i: number, d: Dn): Frame {
  const S = 16;
  const c = new HdCanvas(S, S, d);
  const m = mats(c, d);
  const a = (i * Math.PI) / 8;
  const corners: Array<[number, number]> = [
    [-5, -4],
    [5, -4],
    [5, 4],
    [-5, 4],
  ].map((p) => {
    const r = rot(p as unknown as V2, a);
    return [r[0] + S / 2, r[1] + S / 2];
  });
  c.poly(corners, { mat: m.plinth, z: 2, tex: weathered(71 + i, 0, 1) });
  // Bevel feel: light the top-left edges, darken the bottom-right ones.
  c.shade(0, 0, S, S, (x, y) => {
    const u = x - S / 2;
    const v = y - S / 2;
    const r = rot([u, v], -a);
    const e = Math.max(Math.abs(r[0]) - 4, Math.abs(r[1]) - 3);
    if (e < 0) return 0;
    return r[0] + r[1] < 0 ? 0.35 : -0.35;
  });
  // A torn edge (where it broke off the plinth): one rough corner.
  c.erase(0, 0, S, S, (x, y) => {
    const r = rot([x - S / 2, y - S / 2], -a);
    return r[0] > 3.2 && r[1] > 2.2 && hash2(Math.floor(x * 2), Math.floor(y * 2), 3) > 0.4;
  });
  return { buf: c.render(SPRITE_LOOK), ox: S / 2, oy: S / 2, ...(d === 1 ? {} : { density: d }) };
}

function bitFrame(i: number, d: Dn): Frame {
  const S = 8;
  const c = new HdCanvas(S, S, d);
  const m = mats(c, d);
  const r = 2.2 + (i % 2) * 0.4;
  c.blob(
    [
      [S / 2 - r, S / 2 - r * 0.6],
      [S / 2 + r * 0.4, S / 2 - r],
      [S / 2 + r, S / 2 + r * 0.3],
      [S / 2 - r * 0.2, S / 2 + r * 0.9],
    ].map((p, k) => {
      const q = rot([p[0] - S / 2, p[1] - S / 2], (i * 2 + k * 0.1) * 0.9);
      return [q[0] + S / 2, q[1] + S / 2] as [number, number];
    }),
    1,
    { mat: m.plinth, z: 2, bulge: 0.5, tex: weathered(81 + i, 0, 1) },
  );
  return { buf: c.render(SPRITE_LOOK), ox: S / 2, oy: S / 2, ...(d === 1 ? {} : { density: d }) };
}

/**
 * The shockwave along the pavers (and the low sweep): a breaking crest of grey dust and stone
 * shards with a cold green glint (the curse), drawn moving LEFT; frame i animates the curl.
 * Painted with the Pen (soft, no lighting model), outline A.
 */
function waveFrame(i: number, low: boolean, d: Dn): Frame {
  const w = low ? STATUE.sweep.waveW + 4 : STATUE.slam.waveW + 6;
  const h = (low ? STATUE.sweep.waveH : STATUE.slam.waveH) + 6;
  const p = new Pen(w, h, d);
  const dust = (k: number): Color => (d === 1 ? pal1(PAL_HD.stone[Math.max(0, Math.min(7, k))]) : PAL_HD.stone[Math.max(0, Math.min(7, k))]);
  const glint = (k: number): Color => (d === 1 ? pal1(GHOST[k]) : GHOST[k]);
  const base = h - 2;
  const crest = h - 3 - (low ? 7 : 10) * (0.85 + 0.15 * Math.sin(i * 1.6));
  // The crest: a leaning hump, highest near the front (left), trailing off to the right.
  p.fill(1, 1, w - 2, h - 2, (X, Y) => {
    const x = (X + 0.5) / d;
    const y = (Y + 0.5) / d;
    const u = (x - 2) / (w - 4);
    if (u < 0 || u > 1) return 0;
    const top = base - (base - crest) * Math.sin(Math.min(1, u * 1.4 + 0.08) * Math.PI) * (1 - u * 0.45);
    if (y < top || y > base) return 0;
    const n = noise2(x + i * 3, y, 2, 7);
    if (y < top + 1.2 && hash2(X, Y + i * 13, 5) > 0.55) return 0;
    const k = 2 + Math.floor((1 - (y - top) / Math.max(1, base - top)) * 4 + n * 1.5);
    return dust(k);
  });
  // Shards flying off the crest and the green glints of the curse.
  for (let s = 0; s < 4; s++) {
    const sx = 3 + ((s * 5 + i * 3) % (w - 6));
    const sy = crest - 1 - ((s + i) % 3);
    p.rect(sx, sy, 1, 1, dust(5 + (s % 2)));
  }
  if (d >= 2) for (let s = 0; s < 3; s++) p.rect(4 + ((s * 7 + i * 5) % (w - 8)), base - 2 - ((s * 3 + i) % 4), 1 / d * 2, 1 / d * 2, glint(5));
  else p.rect(4 + i, base - 2, 1, 1, glint(4));
  outlineA(p);
  return p.frame(Math.floor(w / 2), base);
}

// =============================================================================== effects

/** A glowing crack (drawn additive over the stone): a jagged zigzag, frames = 3 shapes. */
function crackFrame(i: number, d: Dn): Frame {
  const w = 12;
  const h = 16;
  const p = new Pen(w, h, d);
  const col = (k: number): Color => (d === 1 ? pal1(GHOST[k]) : GHOST[k]);
  let x = 5 + (i % 2);
  let y = 1;
  const steps = 7;
  for (let s = 0; s < steps; s++) {
    const nx = 2 + ((hash2(s, i, 9) * 8) | 0);
    const ny = y + 2;
    p.line(x, y, nx, ny, col(5), d >= 4 ? 2 : 1);
    if (d >= 2) p.line(x, y, nx, ny, col(6), 1);
    if (s === 3) p.line(nx, ny, nx + (i === 1 ? -3 : 3), ny + 2, col(4), 1);
    x = nx;
    y = ny;
  }
  return p.frame(w / 2, h / 2);
}

/** The glowing eyes: two pale green points (frame 1: brighter, wider). */
function eyesFrame(i: number, d: Dn): Frame {
  const w = 10;
  const h = 4;
  const p = new Pen(w, h, d);
  const col = (k: number): Color => (d === 1 ? pal1(GHOST[k]) : GHOST[k]);
  for (const ex of [2.6, 6.4]) {
    p.disc(ex + 0.5, 2, 1.4 + i * 0.3, 1 + i * 0.2, col(5));
    p.disc(ex + 0.5, 2, 0.7, 0.6, col(6));
  }
  return p.frame(w / 2, h / 2);
}

/** A soft round glow (additive). */
function glowFrame(d: Dn): Frame {
  const r = 14;
  const p = new Pen(r * 2, r * 2, d);
  p.disc(r, r, r - 0.5, r - 0.5, (X, Y, u, v) => {
    const q = Math.sqrt(u * u + v * v);
    const k = Math.floor((1 - q) * 4 + (hash2(X, Y, 3) - 0.5) * 0.6);
    return k <= 0 ? 0 : d === 1 ? pal1(GHOST[Math.min(4, k)]) : GHOST[Math.min(4, k)];
  });
  return p.frame(r, r);
}

// =============================================================================== registration

/** Register sprite `id` with `n` frames, each made by `make(i, d)` at d 1, 2 and 4. */
function reg(id: string, n: number, make: (i: number, d: Dn) => Frame, o: { defer?: boolean; ticksPerFrame?: number } = {}): void {
  const frames = (d: Dn): Frame[] => Array.from({ length: n }, (_, i) => make(i, d));
  defineSprite(id, () => frames(1), { hd: (d) => frames(d as Dn), defer: o.defer, ticksPerFrame: o.ticksPerFrame ?? 8 });
  STATUE_SPRITES.push(id);
}

function bodyFrame(pose: BodyPose, d: Dn): Frame {
  const F = pose.seated ? SIT_FRAME : STAND_FRAME;
  const c = new HdCanvas(F.w, F.h, d);
  drawStatueBody(c, d, pose, F.ox, F.oy);
  const buf = c.render(SPRITE_LOOK);
  const pts = { hand: pose.hand, raise: pose.raise };
  return d === 1 ? { buf, ox: F.ox, oy: F.oy, pts } : { buf, ox: F.ox, oy: F.oy, pts, density: d };
}

reg(`${ART}/sit`, SIT_POSES.length, (i, d) => bodyFrame(SIT_POSES[i], d));
reg(`${ART}/stand`, STAND_POSES.length, (i, d) => bodyFrame(STAND_POSES[i], d));
reg(`${ART}/crozier`, CROZIER_ANGLES.length, (i, d) => crozierFrame(i, false, d));
reg(`${ART}/crozier-broken`, CROZIER_ANGLES.length, (i, d) => crozierFrame(i, true, d), { defer: true });
reg(`${ART}/fist`, 1, (_i, d) => {
  const c = new HdCanvas(8, 8, d);
  const m = mats(c, d);
  c.ellipsoid(4, 4, 2.6, 2.8, { mat: m.stone, z: 2, tone: 0.06, tex: tex(m, weathered(91, 0.2)) });
  if (d >= 2) c.shade(1, 3, 6, 3, (_x, y) => (Math.abs(y - 4) < 0.3 || Math.abs(y - 5.2) < 0.25 ? -0.3 : 0));
  return { buf: c.render(SPRITE_LOOK), ox: 4, oy: 4, ...(d === 1 ? {} : { density: d }) };
});
reg(`${ART}/shaft`, 1, (_i, d) => {
  const c = new HdCanvas(10, 6, d);
  const m = mats(c, d);
  c.capsule(-1, 3, 11, 3, 1.3, 1.3, { mat: m.stone, z: 2, tex: tex(m, weathered(93, 0.3)) });
  return { buf: c.render({ ...SPRITE_LOOK, outline: 'none' }), ox: 0, oy: 3, ...(d === 1 ? {} : { density: d }) };
});
reg(`${ART}/plinth`, PLINTH.maxMissing + 1, (i, d) => plinthFrame(i, d));
reg(`${ART}/stone`, 4, (i, d) => stoneFrame(i, d), { ticksPerFrame: 4 });
reg(`${ART}/bit`, 3, (i, d) => bitFrame(i, d), { ticksPerFrame: 4 });
reg(`${ART}/wave`, 4, (i, d) => waveFrame(i, false, d), { ticksPerFrame: 3 });
reg(`${ART}/sweep`, 4, (i, d) => waveFrame(i, true, d), { ticksPerFrame: 3 });
reg(`${FX}/crack`, 3, (i, d) => crackFrame(i, d));
reg(`${FX}/eyes`, 2, (i, d) => eyesFrame(i, d));
reg(`${FX}/glow`, 1, (_i, d) => glowFrame(d));

/** The plaque's two lines (tests: our own lettering, spec §0 #23). */
export const PLAQUE_LINES: readonly string[] = ['ST.', 'PLECHELMUS'];
/** Where the cracks sit on a seated / standing body (relative to the pose anchor): chest, lap, shoulder. */
export const CRACK_SPOTS: { readonly sit: readonly V2[]; readonly stand: readonly V2[] } = {
  sit: [
    [-4, -38],
    [6, -20],
    [-9, -46],
  ],
  stand: [
    [-4, -55],
    [5, -28],
    [-9, -63],
  ],
};
