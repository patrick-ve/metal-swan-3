import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  GOV3D_GAP_MS,
  Governor3d,
  PS1_DITHER,
  PS1_FS,
  PS1_LEVELS,
  PS1_UNIFORMS,
  PS1_VS,
  ps1Cut,
  ps1Dither,
  ps1Fog,
  ps1Level8,
  ps1Snap,
  SKY_FS,
  SKY_UNIFORMS,
  SKY_VS,
  sortKeys,
} from '../../../src/engine/r3/ps1';

describe('r3 ps1: the PS1 look (docs/design/rally.md §7.1, §12.2)', () => {
  it('the 4×4 ordered dither of the era (offsets −4…+3, each twice)', () => {
    expect([...PS1_DITHER]).toEqual([-4, 0, -3, 1, 2, -2, 3, -1, -3, 1, -4, 0, 3, -1, 2, -2]);
    const count = new Map<number, number>();
    for (const v of PS1_DITHER) count.set(v, (count.get(v) ?? 0) + 1);
    for (let v = -4; v <= 3; v++) expect(count.get(v)).toBe(2);
    expect(ps1Dither(0, 0)).toBe(-4);
    expect(ps1Dither(3, 0)).toBe(1);
    expect(ps1Dither(0, 1)).toBe(2);
    expect(ps1Dither(4, 4)).toBe(-4);
    expect(ps1Dither(383, 215)).toBe(PS1_DITHER[3 * 4 + 3]);
  });

  it('the 15-bit cut: 5-bit levels, black and white stay, a flat tone keeps its average', () => {
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        expect(ps1Cut(0, x, y)).toBe(0);
        expect(ps1Cut(255, x, y)).toBe(31);
      }
    }
    expect(ps1Level8(0)).toBe(0);
    expect(ps1Level8(31)).toBe(255);
    expect(PS1_LEVELS).toHaveLength(32);
    // 102 dithers between levels 12 and 13 (the cells with offset +2 / +3 go up).
    const cells: number[] = [];
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) cells.push(ps1Cut(102, x, y));
    expect(new Set(cells)).toEqual(new Set([12, 13]));
    expect(cells.filter((c) => c === 13)).toHaveLength(4);
    // Over a 4×4 cell the shown tone follows the input within about one 8-bit step.
    for (let v = 8; v < 248; v += 3) {
      let sum = 0;
      for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) sum += ps1Cut(v, x, y) * 8;
      expect(Math.abs(sum / 16 - (v - 4))).toBeLessThanOrEqual(1);
    }
  });

  it('the vertex snap lands on the 1× grid, moves at most half a pixel and is idempotent', () => {
    for (const size of [384, 216, 108]) {
      for (let k = 0; k < 500; k++) {
        const ndc = -1.3 + k * 0.00517;
        const s = ps1Snap(ndc, size);
        const px = (s * 0.5 + 0.5) * size;
        expect(Math.abs(px - Math.round(px))).toBeLessThan(1e-9);
        expect(Math.abs(s - ndc) * 0.5 * size).toBeLessThanOrEqual(0.5 + 1e-9);
        expect(ps1Snap(s, size)).toBeCloseTo(s, 12);
      }
    }
  });

  it('the fog factor is linear from fogNear to fogFar', () => {
    expect(ps1Fog(10, 50, 300)).toBe(0);
    expect(ps1Fog(50, 50, 300)).toBe(0);
    expect(ps1Fog(175, 50, 300)).toBeCloseTo(0.5, 12);
    expect(ps1Fog(300, 50, 300)).toBe(1);
    expect(ps1Fog(900, 50, 300)).toBe(1);
    expect(ps1Fog(5, 10, 10)).toBe(0);
    expect(ps1Fog(10, 10, 10)).toBe(1);
  });

  it('sortKeys sorts a prefix in place like Array.sort', () => {
    let seed = 12345;
    const rnd = (): number => {
      seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
      return seed / 4294967296;
    };
    for (const n of [0, 1, 2, 3, 17, 256, 1000]) {
      const a = new Float64Array(n + 5);
      for (let i = 0; i < a.length; i++) a[i] = Math.floor(rnd() * 70000) * 65536 + i;
      const tail = Array.from(a.subarray(n));
      const want = Array.from(a.subarray(0, n)).sort((x, y) => x - y);
      sortKeys(a, n);
      expect(Array.from(a.subarray(0, n))).toEqual(want);
      expect(Array.from(a.subarray(n))).toEqual(tail);
    }
  });

  it('the 3D governor: 2 s above 20 ms at density 4 caps at 2, later at 2 caps at 1, once each', () => {
    const g = new Governor3d();
    let now = 0;
    const run = (ms: number, d: number, seconds: number): number[] => {
      const trips: number[] = [];
      for (let t = 0; t < seconds * 1000; t += ms) {
        now += ms;
        const cap = g.sample(ms, now, d);
        if (cap) trips.push(cap);
      }
      return trips;
    };
    expect(run(16.7, 4, 6)).toEqual([]);
    expect(g.cap).toBe(4);
    expect(run(19.5, 4, 6)).toEqual([]);
    // Density 1 never counts; neither do frames above the cap.
    expect(run(40, 1, 6)).toEqual([]);
    expect(run(25, 4, 3)).toEqual([2]);
    expect(g.cap).toBe(2);
    expect(g.trippedMs).toBeCloseTo(25, 6);
    expect(run(25, 4, 4)).toEqual([]); // above the cap
    expect(run(16.7, 2, 4)).toEqual([]);
    expect(run(30, 2, 3)).toEqual([1]);
    expect(g.cap).toBe(1);
    expect(run(60, 2, 5)).toEqual([]);
    expect(run(60, 1, 5)).toEqual([]);
  });

  it('the 3D governor: gaps and density changes restart the window', () => {
    const g = new Governor3d();
    let now = 0;
    // 1.5 s slow, a long gap, 1.5 s slow: no full window → no trip.
    for (let t = 0; t < 1500; t += 25) g.sample(25, (now += 25), 4);
    expect(g.sample(GOV3D_GAP_MS + 1, (now += GOV3D_GAP_MS + 1), 4)).toBe(0);
    for (let t = 0; t < 1500; t += 25) expect(g.sample(25, (now += 25), 4)).toBe(0);
    // A density change restarts too.
    for (let t = 0; t < 1500; t += 25) expect(g.sample(25, (now += 25), 2)).toBe(0);
    expect(g.cap).toBe(4);
  });

  it('the GLSL sources: ES 3.00, every uniform declared, the four traits in place', () => {
    for (const src of [PS1_VS, PS1_FS, SKY_VS, SKY_FS]) {
      expect(src.startsWith('#version 300 es\n')).toBe(true);
      expect(src).toMatch(/precision highp float;/);
      expect(src).not.toMatch(/noperspective/);
    }
    const declared = (src: string, name: string): boolean => new RegExp(`uniform \\w+ ${name};`).test(src);
    for (const u of PS1_UNIFORMS) expect(declared(PS1_VS, u) || declared(PS1_FS, u), u).toBe(true);
    for (const u of SKY_UNIFORMS) expect(declared(SKY_VS, u) || declared(SKY_FS, u), u).toBe(true);
    // Snap: the 1× grid, then back by w. Affine: uv·w and w, divided in the fragment.
    expect(PS1_VS).toMatch(/floor\(\(clip\.xy \/ w \* 0\.5 \+ 0\.5\) \* uGrid \+ 0\.5\)/);
    expect(PS1_VS).toMatch(/clip\.xy = \(px \/ uGrid \* 2\.0 - 1\.0\) \* w;/);
    expect(PS1_VS).toMatch(/vUVw = aUV \* k;/);
    expect(PS1_VS).toMatch(/float k = uAffine > 0\.5 \? max\(w, uAffineNear\) : 1\.0;/);
    expect(PS1_FS).toMatch(/vec2 uv = vUVw \/ vW;/);
    // The CLUT lookup (nearest texel fetches) and the cut-out by the CLUT's alpha.
    expect(PS1_FS).toMatch(/texelFetch\(uIndex/);
    expect(PS1_FS).toMatch(/texelFetch\(uClut/);
    expect(PS1_FS).toMatch(/if \(c\.a < 0\.5\) discard;/);
    // Shade → fog → the 15-bit cut, in that order.
    const iShade = PS1_FS.indexOf('c.rgb * vCol');
    const iFog = PS1_FS.indexOf('mix(col, uFogCol, vFog)');
    const iCut = PS1_FS.indexOf('ps1Cut(col)');
    expect(iShade).toBeGreaterThan(0);
    expect(iFog).toBeGreaterThan(iShade);
    expect(iCut).toBeGreaterThan(iFog);
    // The dither matrix and the 1× cell in both fragment shaders.
    for (const src of [PS1_FS, SKY_FS]) {
      expect(src).toContain('float[16](-4.0, 0.0, -3.0, 1.0, 2.0, -2.0, 3.0, -1.0, -3.0, 1.0, -4.0, 0.0, 3.0, -1.0, 2.0, -2.0)');
      expect(src).toContain('floor(gl_FragCoord.xy / uDensity)');
      expect(src).toContain('floor(v / 8.0) / 31.0');
    }
  });

  it('gl3d.browser.ts takes its shaders from ps1.ts and keeps the View3d contract', () => {
    const src = readFileSync(new URL('../../../src/engine/gl3d.browser.ts', import.meta.url), 'utf8');
    expect(src).toMatch(/from '\.\/r3\/ps1'/);
    expect(src).not.toMatch(/#version 300 es/);
    expect(src).toMatch(/implements Gl3dView/);
    expect(src).toMatch(/webglcontextlost/);
    expect(src).toMatch(/webglcontextrestored/);
  });
});
