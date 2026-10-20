/**
 * HD shots and muzzle flashes (2× and 4×; docs/ART_GUIDE.md "UHD art"): every shot of
 * weapons/art.ts and weapons/shots.art.ts drawn natively per frame and per direction —
 *
 * - tracers: a hot capsule (white-hot head, gold body, orange tail), cooler at the edges;
 * - shells, rockets and homing missiles: lit brass, pale steel, red paint and a glowing
 *   exhaust, drawn in each of the 16 directions with the light from the upper left (never a
 *   turned bitmap);
 * - flashes: emissive cones, blooms, spikes and arcs (`Glow`), white-hot at the muzzle, through
 *   the frame's own turn (`Xf`: straight, up, diagonal);
 * - grenades, the bomb, casings, the bounce mine: lit volumes with bands, caps, fuses, rivets;
 * - flame blobs: billowing fire, ragged rims; laser light: cyan stars.
 *
 * Geometry: the 1× frame's logical size and anchor; shapes sit where the 1× pixels are.
 */
import type { Color } from '../../../../engine/color';
import { PAL_HD } from '../../../../engine/palette-hd';
import type { PixelBuffer, Ramp } from '../../../../engine/pixel';
import type { Frame } from '../../../../engine/render';
import { getFrames } from '../../../../engine/sprites';
import type { DrawOpts } from '../../../art/hd/index';
import { billow, FIRE, INK, fireMat, frayCut, gasMat, glowMat, hash, hdStrip, lambert, metalMat, paintMat, sat, turb, type HdCanvas } from './kit';
import { drawGlows, Xf, type Glow } from './shapes';

/** Brass (cases, casings, caps): the gold ramp. */
const BRASS: Ramp = PAL_HD.gold;
/** Cyan laser light (crevice tone first), up to white. */
const LASER: Ramp = [PAL_HD.teal[1], PAL_HD.teal[2], PAL_HD.teal[3], PAL_HD.teal[4], PAL_HD.teal[5], PAL_HD.teal[6], PAL_HD.snow[6]];
/** Flash outline (the 1× flashes' orange rim). */
const FLASH_RIM: Color = PAL_HD.fire[3];

/** A glow-only render: no AO, no separations, outline A in `ink` (or none). */
function renderGlow(c: HdCanvas, ink: Color | null): PixelBuffer {
  return c.render({ outline: ink === null ? 'none' : 'A', ink: ink ?? INK, ao: 0, sep: false, clean: true });
}

/** A lit solid sprite: AO, separations, outline A, the thin cool rim. */
function renderSolid(c: HdCanvas): PixelBuffer {
  return c.render({ outline: 'A', ao: 0.3, sep: true, sepZ: 0.3, rimLight: 1 });
}

// ------------------------------------------------------------------------------------ muzzle flashes

/** Which turn of a right-pointing flash a sprite holds. */
export type FlashTurn = 'fwd' | 'up' | 'diag';

/** The transform of a flash variant: base (bx, by) of the unrotated w × h flash buffer. */
function flashXf(turn: FlashTurn, w: number, h: number, bx: number, by: number, f1: Frame): Xf {
  if (turn === 'up') return Xf.up(w, bx, by);
  if (turn === 'diag') return Xf.turn(-Math.PI / 4, w, h, bx, by, f1.buf.w, f1.buf.h);
  return Xf.at(bx, by);
}

/**
 * Generic star-burst flash: step 0 a white-hot core, a forked flame (a main cone and two side
 * tongues) and two whiskers; step 1 a smaller fork; step 2 a fading bloom. Heat falls along the
 * shot (bands across it, not parallel to the rim).
 */
function genericFlash(len: number, half: number, step: number, heavy: boolean): Glow[] {
  if (step === 2) {
    return [
      { k: 'blob', u: len * 0.45, v: 0, ru: len * 0.42 + 0.2, rv: half * 0.55 + 0.35, h: 0.6, fall: 0.4 },
      { k: 'blob', u: len * 0.34, v: 0, ru: len * 0.18 + 0.2, rv: half * 0.28 + 0.2, h: 0.8, fall: 0.3 },
    ];
  }
  const k = step === 0 ? 1 : 0.68;
  const tail = heavy ? 0.42 : 0.36;
  const g: Glow[] = [
    { k: 'cone', u0: 0.4, u1: len - 0.6, w0: half * k * 0.8 + 0.35, w1: 0.38, h0: 1.0, h1: tail, edge: 0.2 },
  ];
  for (const s of [-1, 1]) {
    g.push({ k: 'spike', u0: 0.9, v0: s * 0.3, u1: len * (step === 0 ? 0.62 : 0.5), v1: s * half * k * 0.92, r0: half * k * 0.42 + 0.22, r1: 0.22, h0: 0.92, h1: tail });
  }
  if (step === 0) {
    for (const s of [-1, 1]) g.push({ k: 'spike', u0: 0.7, v0: s * 0.6, u1: 1.3 + half * 0.55, v1: s * (half + 1.15), r0: 0.36, r1: 0.12, h0: 0.86, h1: 0.55 });
  }
  g.push({ k: 'blob', u: 1.15, v: 0, ru: 1.05 + half * 0.16 * k, rv: Math.min(half * k * 0.68 + 0.4, 1.7), h: 1.15, fall: 0.3 });
  return g;
}

/** The generic flash frames (weapons/art.ts `muzzleFrames`): light or heavy, fwd / up / diag. */
export function genericFlashHd(id: string, d: number, heavy: boolean, turn: FlashTurn): Frame[] {
  const sizes: Array<[number, number]> = heavy ? [[12, 4], [9, 3], [6, 2]] : [[7, 3], [5, 2], [3, 1]];
  return hdStrip(id, d, (c, i, f1) => {
    const [len, half] = sizes[i];
    // The unrotated 1× buffer: (len + 4) × (2·half + 5); the flash starts at x = 2 on the centre line.
    const w = len + 4;
    const h = half * 2 + 5;
    const xf = flashXf(turn, w, h, 2, h / 2, f1);
    drawGlows(c, xf, genericFlash(len, half, i, heavy), { glow: fireMat(c), part: c.newPart(), uMin: -0.85 });
    return renderGlow(c, FLASH_RIM);
  });
}

/** Per-family flash recipes (weapons/shots.art.ts `FLASHES`), local u from the base, v across. */
const FAMILY: Readonly<Record<string, { frames: readonly (readonly Glow[])[]; ink: Color | null; ramp?: Ramp }>> = {
  shotgun: {
    ink: PAL_HD.red[2],
    frames: [
      [
        { k: 'cone', u0: 0.4, u1: 12.6, w0: 1.9, w1: 0.55, h0: 1, h1: 0.24, edge: 0.32 },
        { k: 'blob', u: 3.8, v: 0, ru: 4.2, rv: 1.45, h: 1.12, fall: 0.3 },
        { k: 'spike', u0: 3, v0: 0, u1: 1.4, v1: -2.9, r0: 0.55, r1: 0.2, h0: 0.85, h1: 0.55 },
        { k: 'spike', u0: 3, v0: 0, u1: 1.4, v1: 2.9, r0: 0.55, r1: 0.2, h0: 0.85, h1: 0.55 },
        { k: 'spike', u0: 6.2, v0: 0, u1: 7.6, v1: -2.9, r0: 0.55, r1: 0.2, h0: 0.8, h1: 0.5 },
        { k: 'spike', u0: 6.2, v0: 0, u1: 7.6, v1: 2.9, r0: 0.55, r1: 0.2, h0: 0.8, h1: 0.5 },
        { k: 'blob', u: 10.6, v: -1.9, ru: 0.5, h: 0.42, fall: 0.2 },
        { k: 'blob', u: 10.6, v: 1.9, ru: 0.5, h: 0.42, fall: 0.2 },
        { k: 'blob', u: 13.6, v: -1, ru: 0.5, h: 0.36, fall: 0.2 },
        { k: 'blob', u: 13.6, v: 1, ru: 0.5, h: 0.36, fall: 0.2 },
      ],
      [
        { k: 'cone', u0: 0.4, u1: 11, w0: 1.5, w1: 0.5, h0: 0.95, h1: 0.24, edge: 0.3 },
        { k: 'blob', u: 3.2, v: 0, ru: 3, rv: 1.15, h: 1.02, fall: 0.3 },
        { k: 'spike', u0: 3.5, v0: 0, u1: 3.6, v1: -2.2, r0: 0.45, r1: 0.18, h0: 0.72, h1: 0.5 },
        { k: 'spike', u0: 3.5, v0: 0, u1: 3.6, v1: 2.2, r0: 0.45, r1: 0.18, h0: 0.72, h1: 0.5 },
        { k: 'spike', u0: 7.4, v0: 0, u1: 7.6, v1: -2.2, r0: 0.45, r1: 0.18, h0: 0.68, h1: 0.45 },
        { k: 'spike', u0: 7.4, v0: 0, u1: 7.6, v1: 2.2, r0: 0.45, r1: 0.18, h0: 0.68, h1: 0.45 },
      ],
      [
        { k: 'smoke', u: 3.4, v: 0, r: 1.7, seed: 5 },
        { k: 'smoke', u: 5.6, v: 0.1, r: 1.35, seed: 6 },
        { k: 'smoke', u: 7.6, v: 0, r: 0.9, seed: 7, fade: 0.3 },
      ],
    ],
  },
  'rocket-launcher': {
    ink: PAL_HD.red[2],
    frames: [
      [
        { k: 'cone', u0: 4, u1: 8.3, w0: 1.2, w1: 0.45, h0: 0.75, h1: 0.32 },
        { k: 'blob', u: 3.6, v: 0, ru: 3, rv: 2.3, h: 1.12, fall: 0.62, lit: 0.25 },
      ],
      [{ k: 'blob', u: 4, v: 0, ru: 2.3, rv: 1.6, h: 0.92, fall: 0.55, lit: 0.2 }],
      [{ k: 'smoke', u: 4.2, v: 0, r: 1.8, seed: 9 }],
    ],
  },
  flamethrower: {
    ink: PAL_HD.red[2],
    frames: [
      [
        { k: 'cone', u0: 1, u1: 4.6, w0: 1.0, w1: 0.38, h0: 0.9, h1: 0.4 },
        { k: 'blob', u: 1.7, v: 0, ru: 1.6, rv: 1.25, h: 1.05, fall: 0.45 },
      ],
      [
        { k: 'cone', u0: 0.6, u1: 3.5, w0: 0.75, w1: 0.32, h0: 0.82, h1: 0.4 },
        { k: 'blob', u: 1.2, v: 0, ru: 1.2, rv: 0.95, h: 0.95, fall: 0.45 },
      ],
    ],
  },
  laser: {
    ink: null,
    ramp: LASER,
    frames: [
      [
        { k: 'spike', u0: 2.5, v0: 0, u1: 0.1, v1: 0, r0: 0.55, r1: 0.2, h0: 0.8, h1: 0.35 },
        { k: 'spike', u0: 2.5, v0: 0, u1: 4.9, v1: 0, r0: 0.55, r1: 0.2, h0: 0.8, h1: 0.35 },
        { k: 'spike', u0: 2.5, v0: 0, u1: 2.5, v1: -2.4, r0: 0.55, r1: 0.2, h0: 0.8, h1: 0.35 },
        { k: 'spike', u0: 2.5, v0: 0, u1: 2.5, v1: 2.4, r0: 0.55, r1: 0.2, h0: 0.8, h1: 0.35 },
        { k: 'blob', u: 2.5, v: 0, ru: 1.45, h: 1.1, fall: 0.5 },
      ],
      [
        { k: 'spike', u0: 2.5, v0: 0, u1: 1, v1: 0, r0: 0.45, r1: 0.18, h0: 0.7, h1: 0.35 },
        { k: 'spike', u0: 2.5, v0: 0, u1: 4, v1: 0, r0: 0.45, r1: 0.18, h0: 0.7, h1: 0.35 },
        { k: 'spike', u0: 2.5, v0: 0, u1: 2.5, v1: -1.5, r0: 0.45, r1: 0.18, h0: 0.7, h1: 0.35 },
        { k: 'spike', u0: 2.5, v0: 0, u1: 2.5, v1: 1.5, r0: 0.45, r1: 0.18, h0: 0.7, h1: 0.35 },
        { k: 'blob', u: 2.5, v: 0, ru: 1.0, h: 1.05, fall: 0.5 },
      ],
    ],
  },
  homing: {
    ink: PAL_HD.red[2],
    frames: [
      [
        { k: 'cone', u0: 0.6, u1: 4.5, v: -1.5, w0: 0.85, w1: 0.32, h0: 0.9, h1: 0.36 },
        { k: 'cone', u0: 0.6, u1: 4.5, v: 1.5, w0: 0.85, w1: 0.32, h0: 0.9, h1: 0.36 },
        { k: 'blob', u: 1.5, v: -1.5, ru: 1.35, rv: 0.85, h: 1.05, fall: 0.4 },
        { k: 'blob', u: 1.5, v: 1.5, ru: 1.35, rv: 0.85, h: 1.05, fall: 0.4 },
      ],
      [
        { k: 'blob', u: 1.9, v: -1, ru: 1.4, rv: 0.6, h: 0.85, fall: 0.4 },
        { k: 'blob', u: 1.9, v: 1, ru: 1.4, rv: 0.6, h: 0.85, fall: 0.4 },
      ],
    ],
  },
  tuba: {
    ink: INK,
    ramp: PAL_HD.gold,
    frames: [
      [
        { k: 'arc', u: -1.6, v: 0, R: 3.9, rv: 3.3, a0: -1.0, a1: 1.0, r: 0.75, h: 0.62, lead: 0.3 },
        { k: 'arc', u: 2.2, v: 0, R: 3.5, rv: 2.8, a0: -0.85, a1: 0.85, r: 0.62, h: 0.5, lead: 0.3 },
      ],
      [
        { k: 'arc', u: -0.6, v: 0, R: 3.7, rv: 2.5, a0: -0.85, a1: 0.85, r: 0.62, h: 0.55, lead: 0.3 },
        { k: 'arc', u: 3.4, v: 0, R: 3.2, rv: 2.1, a0: -0.8, a1: 0.8, r: 0.5, h: 0.45, lead: 0.3 },
      ],
    ],
  },
  'bounce-mine': {
    ink: null,
    frames: [
      [
        { k: 'smoke', u: 1.9, v: -0.1, r: 1.5, seed: 11 },
        { k: 'smoke', u: 3.5, v: 0.2, r: 1.05, seed: 12 },
      ],
      [{ k: 'smoke', u: 2.5, v: -0.2, r: 1.05, seed: 13, tone: -0.15 }],
    ],
  },
};

/** The family flash frames (`fx/muzzle-<family>[-up|-diag]`). */
export function familyFlashHd(id: string, d: number, family: string, turn: FlashTurn): Frame[] {
  const f = FAMILY[family];
  // The unrotated 1× flash of each frame (rows + a 1-px border; the flash starts at x = 1).
  const fwd = getFrames(`fx/muzzle-${family}`, 1);
  return hdStrip(id, d, (c, i, f1) => {
    const { w, h } = fwd[i].buf;
    const xf = flashXf(turn, w, h, 1, h / 2, f1);
    const glow = f.ramp ? glowMat(c, f.ramp, f.ramp === PAL_HD.gold ? 2 : 1) : fireMat(c);
    const gas = gasMat(c, PAL_HD.stone, 2, 6);
    drawGlows(c, xf, f.frames[i], { glow, gas, part: c.newPart(), uMin: -0.85 });
    return renderGlow(c, f.ink);
  });
}

/** Families with HD flashes. */
export const FLASH_FAMILIES = Object.keys(FAMILY);

// ------------------------------------------------------------------------------------ tracers

/** Tracer direction strip: a hot capsule `len` long, `width` thick at the head (MG: a redder tail). */
export function tracerHd(id: string, d: number, len: number, width: number, redTail: boolean): Frame[] {
  return hdStrip(id, d, (c, i, f1) => {
    const a = (i / 16) * Math.PI * 2;
    const S = f1.buf.w;
    const xf = Xf.turn(a, S, S, S / 2, S / 2, S, S);
    const [x0, y0] = xf.pt(-len / 2 + 0.3, 0);
    const [x1, y1] = xf.pt(len / 2 - width / 2 + 0.2, 0);
    const fire = fireMat(c);
    const tail = redTail ? 0.12 : 0.3;
    c.capsule(x0, y0, x1, y1, 0.45, width / 2, {
      mat: fire,
      tex: (s) => {
        const h = tail + (1.05 - tail) * Math.pow(s.u, 0.75) - 0.28 * s.v * s.v;
        s.tone = sat(h) * 0.999 - 0.5;
      },
    });
    return c.render({ outline: 'A', ao: 0, sep: false });
  });
}

// ------------------------------------------------------------------------------------ shells and missiles

/** A direction strip of a right-pointing shape `draw(c, xf)` from a bw × bh 1× bitmap. */
function directionHd(id: string, d: number, bw: number, bh: number, draw: (c: HdCanvas, xf: Xf) => void): Frame[] {
  return hdStrip(id, d, (c, i, f1) => {
    const xf = Xf.turn((i / 16) * Math.PI * 2, bw, bh, bw / 2, bh / 2, f1.buf.w, f1.buf.h);
    draw(c, xf);
    return renderSolid(c);
  });
}

/** Capsule in local coordinates. */
function cap(c: HdCanvas, xf: Xf, u0: number, v0: number, u1: number, v1: number, r0: number, r1: number, o: DrawOpts): void {
  const [x0, y0] = xf.pt(u0, v0);
  const [x1, y1] = xf.pt(u1, v1);
  c.capsule(x0, y0, x1, y1, r0, r1, o);
}

/** The cannon shell (9 × 3): a glowing base, a brass case with a groove, a steel nose. */
export function shellHd(id: string, d: number): Frame[] {
  return directionHd(id, d, 9, 3, (c, xf) => {
    const brass = metalMat(c, BRASS, 0.9, 2, 6);
    const steel = metalMat(c, PAL_HD.steel, 1, 2, 6);
    const fire = fireMat(c);
    cap(c, xf, -3.1, 0, 0.9, 0, 1.4, 1.4, { mat: brass, z: 1, tex: (s) => { if (s.u < 0.08 || (s.u > 0.62 && s.u < 0.68)) s.tone -= 0.35; } });
    cap(c, xf, 1.3, 0, 3.9, 0, 1.3, 0.35, { mat: steel, z: 1.2 });
    const [gx, gy] = xf.pt(-3.85, 0);
    c.ellipsoid(gx, gy, 0.85, 0.85, { mat: fire, z: 0.5, tex: (s) => { s.tone = sat(0.95 - 0.5 * (s.u * s.u + s.v * s.v)) - 0.5; } });
  });
}

/** The launcher's rocket (14 × 5): gold exhaust, gold fins, a pale steel body, a red band and nose. */
export function rocketHd(id: string, d: number): Frame[] {
  return directionHd(id, d, 14, 5, (c, xf) => {
    const body = metalMat(c, PAL_HD.steel, 0.8, 3, 6);
    const red = paintMat(c, PAL_HD.red, 0.6, 2, 6);
    const gold = metalMat(c, BRASS, 0.7, 2, 6);
    const fire = fireMat(c);
    const fins = c.newPart();
    for (const s of [-1, 1]) cap(c, xf, -3.6, s * 0.9, -4.9, s * 2.05, 0.5, 0.42, { mat: gold, z: 0.6, part: fins });
    cap(c, xf, -5.2, 0, -3.6, 0, 1.1, 1.2, { mat: gold, z: 0.8, part: fins });
    cap(c, xf, -4.2, 0, 3.0, 0, 1.45, 1.45, { mat: body, z: 1 });
    cap(c, xf, 1.0, 0, 2.6, 0, 1.5, 1.5, { mat: red, z: 1.15, tone: -0.05 });
    cap(c, xf, 3.7, 0, 6.4, 0, 1.4, 0.3, { mat: red, z: 1.2 });
    const [ex, ey] = xf.pt(-6.1, 0);
    c.ellipsoid(ex, ey, 1.05, 1.05, { mat: fire, z: 2, tex: (s) => { s.tone = sat(1.05 - 0.55 * (s.u * s.u + s.v * s.v)) - 0.5; } });
  });
}

/** A homing missile (12 × 3): an ivory capsule with a sky band, a red nose, a gold exhaust. */
export function homingHd(id: string, d: number): Frame[] {
  return directionHd(id, d, 12, 3, (c, xf) => {
    const ivory = paintMat(c, PAL_HD.snow, 0.7, 1, 5);
    const sky = paintMat(c, PAL_HD.sky, 0.5, 1, 6);
    const red = paintMat(c, PAL_HD.red, 0.6, 2, 6);
    const fire = fireMat(c);
    cap(c, xf, -4.5, 0, 2.1, 0, 1.4, 1.4, { mat: ivory, z: 1 });
    cap(c, xf, -0.7, 0, -0.1, 0, 1.45, 1.45, { mat: sky, z: 1.1 });
    cap(c, xf, 2.4, 0, 5.3, 0, 1.35, 0.35, { mat: red, z: 1.2 });
    const [ex, ey] = xf.pt(-5.75, 0);
    c.ellipsoid(ex, ey, 0.85, 0.85, { mat: fire, z: 2, tex: (s) => { s.tone = sat(1.0 - 0.5 * (s.u * s.u + s.v * s.v)) - 0.5; } });
  });
}

// ------------------------------------------------------------------------------------ round shots

/** A hot glowing ball (pellet, enemy bullets): ramp tone from the centre, lit from the upper left, a catchlight. */
function glowBall(c: HdCanvas, cx: number, cy: number, r: number, ramp: Ramp, core = 1.08): void {
  const m = glowMat(c, ramp);
  c.ellipsoid(cx, cy, r, r, {
    mat: m,
    tex: (s) => {
      const q2 = s.u * s.u + s.v * s.v;
      s.tone = sat(core - 0.75 * q2 + lambert(s.nx, s.ny, s.nz) * 0.3 - 0.12) * 0.999 - 0.5;
    },
  });
}

/** The shotgun pellet (5 × 5): a white-hot ball. */
export function pelletHd(id: string, d: number): Frame[] {
  return hdStrip(id, d, (c) => {
    glowBall(c, 2.5, 2.5, 1.5, FIRE);
    return c.render({ outline: 'A', ao: 0, sep: false });
  });
}

/** Enemy shot (9 × 9, 2 frames): a pulsing plasma ball (orange, then pink) with a white core and a catchlight. */
export function enemyBulletHd(id: string, d: number): Frame[] {
  const ramps: Ramp[] = [
    [PAL_HD.red[2], PAL_HD.red[4], PAL_HD.red[5], PAL_HD.orange[3], PAL_HD.orange[4], PAL_HD.gold[6], PAL_HD.snow[6]],
    [PAL_HD.pink[0], PAL_HD.pink[1], PAL_HD.pink[2], PAL_HD.pink[3], PAL_HD.pink[4], PAL_HD.pink[6], PAL_HD.snow[6]],
  ];
  return hdStrip(id, d, (c, i) => {
    glowBall(c, 4.5, 4.5, 3.4, ramps[i], 0.92);
    c.paint(3.0, 3.0, 1.0, 1.0, (x, y) => (Math.hypot(x - 3.5, y - 3.5) < 0.42 ? PAL_HD.snow[6] : 0));
    return c.render({ outline: 'A', ao: 0, sep: false });
  });
}

/** The enemy bomb (15 × 15, 4 frames): a black ball, a brass cap, a curling fuse with a spark. */
export function enemyGrenadeHd(id: string, d: number): Frame[] {
  return hdStrip(id, d, (c, i) => {
    const black = c.material({ ramp: PAL_HD.black, spec: 0.9, shine: 30, rim: 0.45, gain: 1.1, lo: 1, hi: 5 });
    const brass = metalMat(c, BRASS, 0.9, 2, 6);
    const rope = paintMat(c, PAL_HD.brown, 0.2, 2, 6);
    c.ellipsoid(7.5, 8.5, 4.4, 4.4, { mat: black, z: 0 });
    c.cylinder(6.1, 3.3, 2.8, 2.2, { mat: brass, z: 2.5, cap: 0.7, tex: d >= 4 ? (s) => { if (s.v > 0.75) s.tone -= 0.3; } : null });
    const fx = [8, 9, 9, 8][i] + 1;
    c.stroke([[7.9, 3.4], [8.3, 2.4], [fx + 0.3, 1.6]], 0.36, 0.3, { mat: rope, z: 3 });
    const fire = fireMat(c);
    const spark = c.newPart();
    const big = i % 2 === 0;
    c.ellipsoid(fx + 0.5, 1.1, big ? 0.85 : 0.6, big ? 0.85 : 0.6, { mat: fire, part: spark, z: 4, tex: (s) => { s.tone = sat(1.05 - 0.6 * (s.u * s.u + s.v * s.v)) - 0.5; } });
    if (big) {
      for (const [dx, dy] of [[1.4, -0.6], [1.2, 0.8], [-0.2, -1.0]] as const) {
        c.capsule(fx + 0.5, 1.1, fx + 0.5 + dx, 1.1 + dy, 0.28, 0.12, { mat: fire, part: spark, z: 4, tex: (s) => { s.tone = sat(0.8 - 0.4 * s.u) - 0.5; } });
      }
    }
    return renderSolid(c);
  });
}

/** Casings (4 tumbling frames): a brass case, the open mouth darker. */
export function casingHd(id: string, d: number): Frame[] {
  const poses: ReadonlyArray<[number, number, number, number]> = [
    [2, 2, -0.6, 1.7],
    [2, 2.1, 0.35, 1.7],
    [2, 2, 2.0, 1.7],
    [1.5, 2.5, Math.PI / 2, 2.4],
  ];
  return hdStrip(id, d, (c, i) => {
    const brass = metalMat(c, BRASS, 1, 2, 6);
    const [cx, cy, a, len] = poses[i];
    const dx = (Math.cos(a) * len) / 2 - Math.cos(a) * 0.6 * 0.5;
    const dy = (Math.sin(a) * len) / 2 - Math.sin(a) * 0.6 * 0.5;
    c.capsule(cx - dx, cy - dy, cx + dx, cy + dy, 0.62, 0.62, { mat: brass, tex: (s) => { if (s.u > 0.82) s.tone -= 0.45; } });
    return c.render({ outline: 'A', ao: 0, sep: false, rimLight: 1 });
  });
}

/** Smoke-trail puff (9 × 9, 4 frames, no outline as at 1×): a pale billow that grows and frays. */
export function smokeTrailHd(id: string, d: number): Frame[] {
  const radii = [1.5, 2.5, 3.5, 3.5];
  return hdStrip(id, d, (c, i) => {
    const gas = gasMat(c, PAL_HD.stone, 3, 6);
    const fade = [0, 0, 0.32, 0.62][i];
    billow(c, 4.5, 4.6, radii[i], 21 + i, {
      mat: gas,
      lumps: i === 0 ? 3 : undefined,
      tex: (s, q) => {
        if (frayCut(Math.min(1, q), fade, s.X, s.Y)) s.cut = true;
      },
    });
    return c.render({ outline: 'none', ao: 0.25, sep: false, rimLight: 0 });
  });
}

/** The hand grenade in flight (8 × 9, 4 frames): olive ball, a turning gold band and stencil, a steel cap. */
export function grenadeHd(id: string, d: number): Frame[] {
  const dirs: ReadonlyArray<[number, number]> = [
    [1, 0],
    [Math.SQRT1_2, -Math.SQRT1_2],
    [0, 1],
    [Math.SQRT1_2, Math.SQRT1_2],
  ];
  const stencil: ReadonlyArray<[number, number]> = [
    [3.5, 4.5],
    [5.5, 4.5],
    [5.5, 6.5],
    [3.5, 6.5],
  ];
  return hdStrip(id, d, (c, i) => {
    const olive = paintMat(c, PAL_HD.olive, 0.4, 1, 6);
    const gold = metalMat(c, BRASS, 0.8, 2, 6);
    const steel = metalMat(c, PAL_HD.steel, 1, 2, 6);
    const [bx, by] = dirs[i];
    c.ellipsoid(4.5, 5.5, 3.1, 3.1, {
      mat: olive,
      tex: (s) => {
        // The band: a great circle across the ball, perpendicular to (bx, by) turned 90°.
        const across = Math.abs(-by * s.u + bx * s.v);
        if (across < 0.2) s.mat = gold;
      },
    });
    const [sx, sy] = stencil[i];
    c.paint(sx - 0.5, sy - 0.5, 1, 1, (x, y) => (Math.hypot(x - sx, y - sy) < 0.45 ? PAL_HD.snow[5] : 0));
    c.box(3.6, 1.2, 2.2, 1.4, { mat: steel, z: 3.5, bevel: 0.35, r: 0.3 });
    return renderSolid(c);
  });
}

/** The bounce mine (11 × 8, 4 frames): a steel dome, a gold band whose rivets travel, a blinking light. */
export function mineHd(id: string, d: number): Frame[] {
  return hdStrip(id, d, (c, i) => {
    const steel = metalMat(c, PAL_HD.steel, 1, 2, 6);
    const under = metalMat(c, PAL_HD.steel, 0.5, 1, 4);
    const gold = metalMat(c, BRASS, 0.9, 2, 6);
    c.ellipsoid(5.5, 5.4, 4.2, 2.0, { mat: under, z: 0 });
    c.ellipsoid(5.6, 4.3, 3.9, 1.9, { mat: steel, z: 0.6, tex: (s) => { if (s.v > 0.2) s.cut = true; } });
    c.cylinder(1.3, 4.0, 8.6, 1.05, {
      mat: gold,
      z: 1.2,
      axis: 'h',
      tex: (s) => {
        // Rivets travel along the band as the disc spins (the 1× (x + i) % 3 pattern, rounder).
        const k = s.x - 1.5 + i;
        const f = ((k % 3) + 3) % 3;
        if (Math.hypot(f - 0.5, (s.y - 4.5) * 1.6) < 0.42) {
          s.tone += 0.35;
          s.nx -= (f - 0.5) * 0.8;
          s.ny -= (s.y - 4.5) * 1.2;
        }
      },
    });
    const on = i < 2;
    const lamp = glowMat(c, PAL_HD.red, 1, 7);
    c.ellipsoid(5.5, 1.9, 0.62, 0.55, { mat: lamp, z: 2, tex: (s) => { s.tone = (on ? 0.95 : 0.25) - 0.35 * (s.u * s.u + s.v * s.v) - 0.5; } });
    if (on) c.ellipsoid(5.5, 0.75, 0.42, 0.42, { mat: fireMat(c), z: 3, tex: (s) => { s.tone = 0.85 - 0.5 * (s.u * s.u + s.v * s.v) - 0.5; } });
    return renderSolid(c);
  });
}

// ------------------------------------------------------------------------------------ tuba rings

/** Ring heights (weapons/shots.art.ts RING_SIZES). */
const RINGS = [12, 16, 20, 24, 28, 32, 36, 40];

/** The sonic ring (8 sizes; `up`: the quarter turn): a white-hot front crescent and a softer arc behind. */
export function ringHd(id: string, d: number, up: boolean): Frame[] {
  return hdStrip(id, d, (c, i) => {
    const h = RINGS[i];
    const a = Math.max(3, Math.round(h * 0.22));
    const bw = a * 2 + 8 + 4;
    const bh = h + 4;
    const cx = Math.floor(bw / 2) - 1 + 0.5;
    const cy = (bh - 1) / 2 + 0.5;
    const R = h / 2;
    const xf = up ? Xf.up(bw, 0, 0) : Xf.at(0, 0);
    const glow = glowMat(c, PAL_HD.gold, 2, 7);
    drawGlows(c, xf, [
      { k: 'arc', u: cx - 4, v: cy, R: a - 1, rv: R - 0.4, a0: -1.05, a1: 1.05, r: 0.62, h: 0.42, lead: 0.15 },
      { k: 'arc', u: cx, v: cy, R: a, rv: R - 0.4, a0: -1.3, a1: 1.3, r: 1.2, h: 0.62, lead: 0.42 },
    ], { glow, part: c.newPart() });
    return c.render({ outline: 'A', ao: 0, sep: false });
  });
}

// ------------------------------------------------------------------------------------ flame

/** Hotness per flame size step (small = white-hot, big = cool red). */
const FLAME_HEAT = [1.05, 0.95, 0.78, 0.62, 0.48, 0.36];

/** A flame blob (12 frames: 6 sizes × 2 flickers): billowing fire with a tongue, a ragged crimson rim. */
export function flameHd(id: string, d: number): Frame[] {
  return hdStrip(id, d, (c, i) => {
    const k = i >> 1;
    const flick = i & 1;
    const r = 2 + k;
    const size = r * 2 + 6;
    const cx = size / 2;
    const cy = size / 2 + 2;
    const hot = FLAME_HEAT[k];
    const fire = fireMat(c);
    const seed = k * 7 + flick;
    c.plane(0, 0, size, size + 3, {
      mat: fire,
      tex: (s) => {
        const dx = s.x - cx;
        const dy = s.y - cy;
        const upd = dy < 0 ? dy / 1.45 : dy;
        const lean = dy < 0 ? (flick ? 0.35 : -0.35) * -dy : 0;
        const n = turb(s.x, s.y, Math.max(1.5, r * 0.5), seed);
        const dist = Math.hypot(dx - lean, upd) / r;
        if (dist > 0.9 + n * (k < 2 ? 0.15 : 0.3)) {
          s.cut = true;
          return;
        }
        // A rounded volume lit from the upper left, a hotter core, licks of heat, cooler at the rim.
        const nx = (dx - lean) / r;
        const ny = upd / r;
        const lam = lambert(nx, ny, Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny)));
        s.tone = sat(hot - dist * 0.5 + n * 0.4 + lam * 0.3 - 0.1) * 0.999 - 0.5;
      },
    });
    const ink = k < 2 ? PAL_HD.fire[3] : PAL_HD.fire[1];
    const out = c.render({ outline: 'A', ink, ao: 0, sep: false });
    // A ragged rim: break the outline into dashes on logical cells, so overlapping blobs merge.
    const data = out.data;
    const W = out.w;
    for (let p = 0; p < data.length; p++) {
      if (data[p] !== ink) continue;
      const X = p % W;
      const Y = (p / W) | 0;
      if (hash(Math.floor(X / d), Math.floor(Y / d), seed + 17) > 0.62) data[p] = 0;
    }
    dropFloatingInk(data, W, ink);
    out.touch();
    return out;
  });
}

/**
 * Clears the rim px of colour `ink` that no longer touch the body: a dash cut on logical cells can
 * leave the outer art px of the ring floating 1–2 art px off the silhouette (orphan specks at 4×).
 * Keeps every ink px 4-connected (through ink) to a px of another colour.
 */
function dropFloatingInk(data: Uint32Array, W: number, ink: number): void {
  const H = data.length / W;
  const keep = new Uint8Array(data.length);
  const stack: number[] = [];
  for (let p = 0; p < data.length; p++) {
    if (data[p] !== ink) continue;
    const X = p % W;
    const touches =
      (X > 0 && data[p - 1] !== 0 && data[p - 1] !== ink) ||
      (X < W - 1 && data[p + 1] !== 0 && data[p + 1] !== ink) ||
      (p >= W && data[p - W] !== 0 && data[p - W] !== ink) ||
      (p < data.length - W && data[p + W] !== 0 && data[p + W] !== ink);
    if (touches) {
      keep[p] = 1;
      stack.push(p);
    }
  }
  while (stack.length) {
    const p = stack.pop() as number;
    const X = p % W;
    const Y = (p / W) | 0;
    const next = [X > 0 ? p - 1 : -1, X < W - 1 ? p + 1 : -1, Y > 0 ? p - W : -1, Y < H - 1 ? p + W : -1];
    for (const q of next) {
      if (q < 0 || keep[q] || data[q] !== ink) continue;
      keep[q] = 1;
      stack.push(q);
    }
  }
  for (let p = 0; p < data.length; p++) if (data[p] === ink && !keep[p]) data[p] = 0;
}

/** The pilot flame at the nozzle (9 × 9, 2 frames, additive): a hot glowing ball. */
export function flameGlowHd(id: string, d: number): Frame[] {
  return hdStrip(id, d, (c, i) => {
    const m = fireMat(c);
    const r = 3.5 - i;
    c.ellipsoid(4.5, 4.5, r, r, { mat: m, tex: (s) => { s.tone = sat(1.08 - 0.8 * (s.u * s.u + s.v * s.v)) * 0.999 - 0.5; } });
    return c.render({ outline: 'none', ao: 0, sep: false });
  });
}

// ------------------------------------------------------------------------------------ laser

/** A laser star at (cx, cy): core radius `core`, axis spikes `len`, diagonal spikes `diag` (0 = none). */
function laserStar(c: HdCanvas, cx: number, cy: number, core: number, len: number, lenV: number, diag: number): void {
  const xf = Xf.at(cx, cy);
  const g: Glow[] = [];
  for (const [u, v] of [[len, 0], [-len, 0], [0, lenV], [0, -lenV]] as const) {
    if (u === 0 && v === 0) continue;
    g.push({ k: 'spike', u0: 0, v0: 0, u1: u, v1: v, r0: 0.55, r1: 0.16, h0: 0.82, h1: 0.3 });
  }
  if (diag > 0) for (const [u, v] of [[1, 1], [1, -1], [-1, 1], [-1, -1]] as const) g.push({ k: 'spike', u0: 0, v0: 0, u1: u * diag, v1: v * diag, r0: 0.4, r1: 0.14, h0: 0.62, h1: 0.25 });
  g.push({ k: 'blob', u: 0, v: 0, ru: core, h: 0.98, fall: 0.62 });
  drawGlows(c, xf, g, { glow: glowMat(c, LASER), part: c.newPart() });
}

/** The laser flare at the gun (11 × 11, 2 frames, additive). */
export function laserFlareHd(id: string, d: number): Frame[] {
  return hdStrip(id, d, (c, i) => {
    laserStar(c, 5.5, 5.5, 2.3 - i * 0.5, 4.6 - i, 4.4 - i, i === 0 ? 2.6 : 0);
    return c.render({ outline: 'none', ao: 0, sep: false });
  });
}

/** Where the beam hits (11 × 9, 3 frames, additive): a crackling cyan burst. */
export function laserHitHd(id: string, d: number): Frame[] {
  return hdStrip(id, d, (c, i) => {
    if (i === 0) laserStar(c, 5.5, 4.5, 1.6, 4.4, 3.3, 2.2);
    else if (i === 1) laserStar(c, 5.5, 4.5, 1.5, 2.6, 2.2, 3.6);
    else laserStar(c, 5.5, 4.5, 1.1, 1.6, 1.4, 3.1);
    return c.render({ outline: 'none', ao: 0, sep: false });
  });
}

