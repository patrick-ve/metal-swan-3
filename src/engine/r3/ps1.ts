/**
 * The PS1 look of the 3D view (docs/design/rally.md §7.1, §7.2, §12.2; docs/api/rally.md "A.GL The
 * 3D view"): the GLSL ES 3.00 sources of the PS1 program and the sky pass, the 4×4 ordered dither
 * of the era, the constants, the JS references of the shader maths (node tests check them), the
 * key sort of the draw list and the 3D frame-interval governor. Pure: no DOM, no GPU (the WebGL2
 * code is `gl3d.browser.ts`). The determinism rules of `r3/` hold here too (no Math.sin & co.):
 * nothing in this file feeds the race state anyway.
 *
 * The four traits (`Ps1Opts`, view3d.ts; the game passes `PS1_ON`, tests switch them one by one):
 * - `snap` (vertex wobble): after projection every vertex snaps to the 1× pixel grid of its view
 *   (384 × 216, or 384 × 108 in split screen) at every density; then x and y are multiplied back
 *   by w, so the clipper and the depth stay correct;
 * - `affine` (texture warp): the varyings carry uv·k and k with k = max(w, `PS1_AFFINE_NEAR`); the
 *   fragment divides them, which cancels the perspective-correct interpolation of the GPU (GLSL ES
 *   3.00 has no `noperspective`): screen-linear uv from the near limit on;
 * - `dither` (colour): after the shade and the fog the colour is cut to 15 bits (5:5:5) with the
 *   4×4 ordered dither of the era (offsets −4…+3 on 8-bit values); the dither cell is one 1× pixel
 *   (`floor(gl_FragCoord / d)`), counted from the top-left of the 384 × 216 frame; off = the full
 *   8-bit colour (no cut either);
 * - `fog` (short sight): linear fog on the view depth (w) from `fogNear` to `fogFar`, per vertex.
 */
import { VIEW3D_H } from '../view3d';

/** The 4×4 ordered dither of the era, row-major [y·4 + x] (offsets on 8-bit values). */
export const PS1_DITHER: readonly number[] = Object.freeze([-4, 0, -3, 1, 2, -2, 3, -1, -3, 1, -4, 0, 3, -1, 2, -2]);

/** Meshes without normals: the vertex colour is the baked shading; the view light scales it by (ambient + sun · this). */
export const PS1_BAKED_SUN = 0.6;
/**
 * The affine warp works on view depths from here on (m): a vertex nearer than this counts as this
 * far for the warp, so a triangle wholly inside this distance is drawn perspective-correct and one
 * that reaches into it warps less. The near road of a low (bumper) camera would otherwise smear;
 * the chase camera sees the road from about 4 m on and keeps the full warp. 0 = the pure trait.
 */
export const PS1_AFFINE_NEAR = 2.5;
/** The sky gradient reaches `skyTop` at this elevation (the sine of the angle above the horizon). */
export const PS1_SKY_SPAN = 0.45;
/**
 * The 3D governor (spec §12.2: "above 20 ms"): a window of 3D frames whose average interval is
 * above this (ms) lowers the cap. 20.5, not 20: a 50 Hz display shows a frame every 20.0 ms and its
 * window average wobbles around 20.0 by a few µs; it must not trip.
 */
export const GOV3D_LIMIT_MS = 20.5;
/** The governor's window (ms). */
export const GOV3D_WINDOW_MS = 2000;
/** A longer interval than this (ms: a hitch, a hidden tab, a pause in the scene stack) restarts the window. */
export const GOV3D_GAP_MS = 250;

/** The dither offset at the logical pixel (x, y) of the frame (top-left origin). */
export function ps1Dither(x: number, y: number): number {
  return PS1_DITHER[((y & 3) << 2) | (x & 3)];
}

/** The 5-bit level (0..31) that the 15-bit cut gives an 8-bit value `v8` at logical pixel (x, y). */
export function ps1Cut(v8: number, x: number, y: number): number {
  const v = Math.min(255, Math.max(0, Math.round(v8) + ps1Dither(x, y)));
  return v >> 3;
}

/** The 8-bit value a 5-bit level shows as (31 = 255). */
export function ps1Level8(v5: number): number {
  return Math.round((v5 * 255) / 31);
}

/** The 8-bit values a 15-bit channel can show (32 entries). */
export const PS1_LEVELS: readonly number[] = Object.freeze(Array.from({ length: 32 }, (_, i) => ps1Level8(i)));

/** The vertex snap of one axis: an NDC coordinate → the NDC of the nearest corner of the 1× grid (`size` logical px). */
export function ps1Snap(ndc: number, size: number): number {
  const px = Math.floor((ndc * 0.5 + 0.5) * size + 0.5);
  return (px / size) * 2 - 1;
}

/** The fog factor (0 = clear, 1 = all fog) at view depth `w`. */
export function ps1Fog(w: number, near: number, far: number): number {
  if (far <= near) return w >= far ? 1 : 0;
  return Math.min(1, Math.max(0, (w - near) / (far - near)));
}

/**
 * Sort the first `n` entries of `a` ascending, in place, with no allocation (a heap sort): the
 * draw-list keys of `gl3d.browser.ts` (opaque: page then index; blended: far to near).
 */
export function sortKeys(a: Float64Array, n: number): void {
  if (n > a.length) n = a.length;
  for (let start = (n >> 1) - 1; start >= 0; start--) siftDown(a, start, n);
  for (let end = n - 1; end > 0; end--) {
    const t = a[0];
    a[0] = a[end];
    a[end] = t;
    siftDown(a, 0, end);
  }
}

function siftDown(a: Float64Array, i: number, n: number): void {
  const v = a[i];
  for (;;) {
    let c = 2 * i + 1;
    if (c >= n) break;
    if (c + 1 < n && a[c + 1] > a[c]) c++;
    if (a[c] <= v) break;
    a[i] = a[c];
    i = c;
  }
  a[i] = v;
}

/**
 * The 3D view's frame-interval governor (spec §12.2): the 2D `FrameGovernor` times the CPU only
 * and cannot see the GPU. This one averages the interval between 3D frames (a rAF interval) over
 * `windowMs`; a window above `limitMs` at density 4 caps the 3D view at 2, and a later one at
 * density 2 caps it at 1 (each at most once per session: the cap only goes down). Frames below
 * density 2 or above the cap do not count; a density change or a gap above `GOV3D_GAP_MS`
 * restarts the window. Pure: the clock comes in; no allocation.
 */
export class Governor3d {
  /** The highest density the 3D view may use (4, then 2, then 1). */
  cap: 1 | 2 | 4 = 4;
  /** The window average of the last trip (ms; 0 before). */
  trippedMs = 0;
  /** The average of the last finished window (ms; 0 before). */
  lastMs = 0;
  readonly limitMs: number;
  readonly windowMs: number;
  private start = -1;
  private density = 0;
  private sum = 0;
  private n = 0;

  constructor(limitMs = GOV3D_LIMIT_MS, windowMs = GOV3D_WINDOW_MS) {
    this.limitMs = limitMs;
    this.windowMs = windowMs;
  }

  /**
   * One 3D frame: `intervalMs` since the previous 3D frame, `now` a clock (ms), `density` the
   * density it was drawn at. Returns the new cap on the frame that trips, else 0.
   */
  sample(intervalMs: number, now: number, density: number): 0 | 1 | 2 {
    const counts = this.cap > 1 && density >= 2 && density <= this.cap && intervalMs >= 0 && intervalMs <= GOV3D_GAP_MS;
    if (!counts || density !== this.density) {
      this.start = -1;
      this.density = density;
    }
    if (!counts) return 0;
    if (this.start < 0) {
      this.start = now;
      this.sum = 0;
      this.n = 0;
    }
    this.sum += intervalMs;
    this.n++;
    if (now - this.start < this.windowMs) return 0;
    const avg = this.sum / this.n;
    this.start = -1;
    this.lastMs = avg;
    if (avg <= this.limitMs) return 0;
    this.trippedMs = avg;
    this.cap = density >= 4 ? 2 : 1;
    return this.cap;
  }
}

// ---------------------------------------------------------------------------------------------
// GLSL ES 3.00
// ---------------------------------------------------------------------------------------------

const f = (v: number): string => (Number.isInteger(v) ? `${v}.0` : String(v));

/** The 15-bit cut with the 4×4 dither (shared by the PS1 program and the sky pass). */
const CUT = `
const float DITHER[16] = float[16](${PS1_DITHER.map(f).join(', ')});
uniform float uDensity;
uniform float uDither;
vec3 ps1Cut(vec3 c) {
  if (uDither < 0.5) return c;
  ivec2 cell = ivec2(floor(gl_FragCoord.xy / uDensity));
  int x = cell.x & 3;
  int y = (${VIEW3D_H - 1} - cell.y) & 3;
  vec3 v = clamp(floor(clamp(c, 0.0, 1.0) * 255.0 + 0.5) + DITHER[y * 4 + x], 0.0, 255.0);
  return floor(v / 8.0) / 31.0;
}`;

/** The PS1 program, vertex shader: transform, snap, Gouraud light, fog, the affine varyings. */
export const PS1_VS = `#version 300 es
precision highp float;
layout(location = 0) in vec3 aPos;
layout(location = 1) in vec2 aUV;
layout(location = 2) in vec3 aRGB;
layout(location = 3) in vec3 aNrm;
uniform mat4 uViewProj;
uniform mat4 uModel;
uniform vec3 uSunDir;
uniform vec3 uSun;
uniform vec3 uAmbient;
uniform float uLit;
uniform float uHasNrm;
uniform vec2 uGrid;
uniform float uSnap;
uniform float uAffine;
uniform float uAffineNear;
uniform vec3 uFog;
out vec2 vUVw;
out float vW;
out vec3 vCol;
out float vFog;
void main() {
  vec4 clip = uViewProj * (uModel * vec4(aPos, 1.0));
  float w = clip.w;
  if (uSnap > 0.5 && w > 1e-5) {
    vec2 px = floor((clip.xy / w * 0.5 + 0.5) * uGrid + 0.5);
    clip.xy = (px / uGrid * 2.0 - 1.0) * w;
  }
  gl_Position = clip;
  float k = uAffine > 0.5 ? max(w, uAffineNear) : 1.0;
  vUVw = aUV * k;
  vW = k;
  vec3 base = aRGB * (255.0 / 128.0);
  float d = uHasNrm > 0.5 ? max(dot(normalize(mat3(uModel) * aNrm), uSunDir), 0.0) : ${f(PS1_BAKED_SUN)};
  vCol = uLit > 0.5 ? base * (uAmbient + uSun * d) : base;
  vFog = uFog.z > 0.5 ? clamp((w - uFog.x) * uFog.y, 0.0, 1.0) : 0.0;
}`;

/** The PS1 program, fragment shader: the affine uv, the CLUT lookup, the shade, the fog, the 15-bit cut. */
export const PS1_FS = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;
uniform sampler2D uIndex;
uniform sampler2D uClut;
uniform vec2 uPage;
uniform int uRow;
uniform vec3 uFogCol;
in vec2 vUVw;
in float vW;
in vec3 vCol;
in float vFog;
out vec4 outColor;
${CUT}
void main() {
  vec2 uv = vUVw / vW;
  ivec2 t = min(ivec2(mod(floor(uv), uPage)), ivec2(uPage) - 1);
  int i = int(texelFetch(uIndex, t, 0).r * 255.0 + 0.5);
  vec4 c = texelFetch(uClut, ivec2(i, uRow), 0);
  if (c.a < 0.5) discard;
  vec3 col = clamp(c.rgb * vCol, 0.0, 1.0);
  col = mix(col, uFogCol, vFog);
  outColor = vec4(ps1Cut(col), 1.0);
}`;

/** The sky pass, vertex shader: one triangle over the viewport (no buffers). */
export const SKY_VS = `#version 300 es
precision highp float;
void main() {
  vec2 p = vec2(float((gl_VertexID & 1) * 4 - 1), float((gl_VertexID >> 1) * 4 - 1));
  gl_Position = vec4(p, 0.0, 1.0);
}`;

/**
 * The sky pass, fragment shader: `skyBottom` at the horizon (and below it) → `skyTop` at
 * `PS1_SKY_SPAN`, per 1× pixel (the same at every density), dithered.
 */
export const SKY_FS = `#version 300 es
precision highp float;
precision highp int;
uniform mat3 uCamRot;
uniform vec4 uVp;
uniform vec2 uTan;
uniform vec3 uTop;
uniform vec3 uBottom;
out vec4 outColor;
${CUT}
void main() {
  vec2 fc = (floor(gl_FragCoord.xy / uDensity) + 0.5) * uDensity;
  vec2 ndc = (fc - uVp.xy) / uVp.zw * 2.0 - 1.0;
  vec3 dir = uCamRot * vec3(ndc.x * uTan.x, ndc.y * uTan.y, -1.0);
  float t = clamp(dir.y / length(dir) / ${f(PS1_SKY_SPAN)}, 0.0, 1.0);
  outColor = vec4(ps1Cut(mix(uBottom, uTop, t)), 1.0);
}`;

/** The uniforms each program uses (the GL layer looks them up; a test checks the sources declare them). */
export const PS1_UNIFORMS = [
  'uViewProj',
  'uModel',
  'uSunDir',
  'uSun',
  'uAmbient',
  'uLit',
  'uHasNrm',
  'uGrid',
  'uSnap',
  'uAffine',
  'uAffineNear',
  'uFog',
  'uIndex',
  'uClut',
  'uPage',
  'uRow',
  'uFogCol',
  'uDensity',
  'uDither',
] as const;
export const SKY_UNIFORMS = ['uCamRot', 'uVp', 'uTan', 'uTop', 'uBottom', 'uDensity', 'uDither'] as const;
export type Ps1Uniform = (typeof PS1_UNIFORMS)[number];
export type SkyUniform = (typeof SKY_UNIFORMS)[number];
