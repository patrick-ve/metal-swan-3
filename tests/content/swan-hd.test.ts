/**
 * UHD art of SWAN-3 and the Mute (docs/ART_GUIDE.md "UHD art"): every `vehicle/swan/…` and
 * `vehicle/swan-mute/…` id and the Swan's fx have ONE density-generic generator for the 2× and
 * the 4× art, drawn natively (hd-*.art.ts) from the 1× rig's geometry: the 1× logical size,
 * anchor and points (geometry is law), PAL_HD colours only, new art (never the 1× frame scaled),
 * the 1× silhouette, real form (5+ tones of white enamel), the water colours under the surface,
 * front overlays cut out of their body frames. The m3 sock variants stay 1×; the old 2× kit
 * paths are gone.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Frame } from '../../src/engine/render';
import { PAL_HD, inHdPalette } from '../../src/engine/palette-hd';
import { getFrames, hasHiSprite, listSprites, spriteErrors } from '../../src/engine/sprites';
import { loadContent } from '../../src/game/content/index';
import * as kit from '../../src/game/content/vehicles/swan/kit.art';
import * as body from '../../src/game/content/vehicles/swan/body.art';
import * as head from '../../src/game/content/vehicles/swan/head.art';
import { RIDDEN } from '../../src/game/content/vehicles/swan/poses.art';
import { renderBodyHd } from '../../src/game/content/vehicles/swan/hd-body.art';
import { HD_SWAN_FIT } from '../../src/game/content/vehicles/swan/hd-kit.art';

const PREFIXES = ['vehicle/swan/', 'vehicle/swan-mute/'];
const FX = ['fx/tin-feather', 'fx/muzzle-swan-beak-gun'];

function swanIds(): string[] {
  return [...listSprites().filter((id) => PREFIXES.some((p) => id.startsWith(p))), ...FX];
}

/** Logical px covered by at least half of their d² art px. */
function hdMask(f: Frame): Uint8Array {
  const d = f.density ?? 1;
  const w = f.buf.w / d;
  const h = f.buf.h / d;
  const m = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let n = 0;
      for (let j = 0; j < d; j++) for (let i = 0; i < d; i++) if ((f.buf.data[(y * d + j) * f.buf.w + x * d + i] & 255) !== 0) n++;
      m[y * w + x] = n * 2 >= d * d ? 1 : 0;
    }
  }
  return m;
}

/** Intersection over union of the HD silhouette and the 1× silhouette (all frames of an id). */
function iou(id: string, d: 2 | 4): number {
  let both = 0;
  let either = 0;
  const hi = getFrames(id, d);
  getFrames(id, 1).forEach((f, n) => {
    const m = hdMask(hi[n]);
    for (let i = 0; i < m.length; i++) {
      const a = (f.buf.data[i] & 255) !== 0;
      const b = m[i] === 1;
      if (a && b) both++;
      if (a || b) either++;
    }
  });
  return either === 0 ? 1 : both / either;
}

/** Distinct colours of an HD ramp in a frame. */
function tones(f: Frame, ramp: readonly number[]): number {
  const set = new Set<number>();
  for (const c of f.buf.data) if ((c & 255) !== 0 && ramp.includes(c >>> 0)) set.add(c >>> 0);
  return set.size;
}

describe('SWAN-3: UHD art (2× and 4×)', () => {
  let warn: { mock: { calls: unknown[][] }; mockRestore: () => void };
  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => warn.mockRestore());

  it('every Swan id has an HD generator at 2× and 4× with the 1× geometry, PAL_HD colours and new art', async () => {
    await loadContent();
    const ids = swanIds();
    expect(ids.length).toBeGreaterThan(170);
    for (const id of ['vehicle/swan/idle', 'vehicle/swan/run-front', 'vehicle/swan-mute/neck', 'vehicle/swan/scuffs', 'vehicle/swan/egg', 'vehicle/swan/beak-flash']) {
      expect(ids.includes(id), id).toBe(true);
    }
    for (const d of [2, 4] as const) {
      for (const id of ids) {
        expect(hasHiSprite(id, d), `${id}@${d}x`).toBe(true);
        const lo = getFrames(id, 1);
        const hi = getFrames(id, d);
        expect(hi.length, id).toBe(lo.length);
        let scaled = true;
        for (let i = 0; i < lo.length; i++) {
          const f = hi[i];
          expect(f.density, `${id}[${i}]@${d}x`).toBe(d);
          expect([f.buf.w, f.buf.h, f.ox, f.oy], `${id}[${i}]@${d}x`).toEqual([lo[i].buf.w * d, lo[i].buf.h * d, lo[i].ox, lo[i].oy]);
          expect(f.pts ?? {}, `${id}[${i}]@${d}x`).toEqual(lo[i].pts ?? {});
          const off = f.buf.data.find((c) => (c & 255) !== 0 && !inHdPalette(c));
          expect(off, `${id}[${i}]@${d}x colour outside PAL_HD`).toBeUndefined();
          const up = lo[i].buf.scaled(d).data;
          if (!f.buf.data.every((c, k) => c === up[k])) scaled = false;
        }
        // New art, never the 1× frame scaled (a 1 × 1 empty front overlay is the same either way).
        if (!lo.every((f) => f.buf.w <= 1)) expect(scaled, `${id}@${d}x is the 1× frame scaled`).toBe(false);
      }
      expect(spriteErrors().filter((e) => ids.some((id) => e.id === `${id}@${d}x`))).toEqual([]);
    }
    const cut = warn.mock.calls.map((c: unknown[]) => String(c[0])).filter((m: string) => m.includes('outside the 1× frame') && ids.some((id) => m.includes(`"${id}"`)));
    expect(cut).toEqual([]);
    // The drawers fit inside the 1× rectangles by themselves (nothing trimmed at the frame edge).
    expect(HD_SWAN_FIT.px).toBe(0);
  }, 300_000);

  it('the HD silhouettes keep the 1× shape (bodies, fronts, necks, extras)', async () => {
    await loadContent();
    const sample = ['idle', 'run', 'swim', 'glide', 'flap', 'crouch', 'dazed', 'empty', 'wreck', 'neck', 'swim-neck', 'neck-relax', 'neck-honk', 'idle-front', 'glide-front'];
    for (const pre of PREFIXES) {
      for (const name of sample) {
        for (const d of [2, 4] as const) expect(iou(`${pre}${name}`, d), `${pre}${name}@${d}x`).toBeGreaterThanOrEqual(0.8);
      }
    }
    for (const id of ['vehicle/swan/egg', 'fx/tin-feather', 'vehicle/swan/beak-flash']) {
      for (const d of [2, 4] as const) expect(iou(id, d), `${id}@${d}x`).toBeGreaterThanOrEqual(0.7);
    }
    // The damage decal reads as strongly: its marks cover most of the 1× marks' logical px.
    for (const d of [2, 4] as const) {
      const lo = getFrames('vehicle/swan/scuffs', 1);
      getFrames('vehicle/swan/scuffs', d).forEach((f, n) => {
        const m = hdMask(f);
        let hit = 0;
        let all = 0;
        lo[n].buf.data.forEach((c, i) => {
          if ((c & 255) === 0) return;
          all++;
          // A logical px counts when it or a 4-neighbour is marked (the HD marks are round).
          const w = lo[n].buf.w;
          if (m[i] || m[i - 1] || m[i + 1] || m[i - w] || m[i + w]) hit++;
        });
        expect(hit / all, `scuffs[${n}]@${d}x`).toBeGreaterThanOrEqual(0.85);
      });
    }
  }, 300_000);

  it('the Swan reads as a volume: 5+ tones of white enamel, lit steel and gold, the ink outline (outline A)', async () => {
    await loadContent();
    for (const d of [2, 4] as const) {
      for (const id of ['vehicle/swan/idle', 'vehicle/swan/glide', 'vehicle/swan/neck']) {
        const f = getFrames(id, d)[0];
        expect(tones(f, PAL_HD.snow), `${id}@${d}x enamel tones`).toBeGreaterThanOrEqual(5);
        expect(f.buf.data.some((c) => c >>> 0 === PAL_HD.ink[0] >>> 0), `${id}@${d}x outline`).toBe(true);
      }
      const idle = getFrames('vehicle/swan/idle', d)[0];
      expect(tones(idle, PAL_HD.steel), `idle@${d}x steel tones`).toBeGreaterThanOrEqual(4);
      expect(tones(idle, PAL_HD.gold), `idle@${d}x gold tones`).toBeGreaterThanOrEqual(3);
      expect(tones(idle, PAL_HD.orange), `idle@${d}x orange tones`).toBeGreaterThanOrEqual(3);
      // The Mute: black enamel neck and head with a lit glint, steel wing tips.
      const mute = getFrames('vehicle/swan-mute/neck', d)[2];
      expect(tones(mute, PAL_HD.black), `mute neck@${d}x black tones`).toBeGreaterThanOrEqual(4);
    }
    // The outline is one logical px (d art px) wide: a 4× frame has an ink run of 4 at its left edge.
    const f = getFrames('vehicle/swan/idle', 4)[0];
    let run = 0;
    const y = Math.floor(f.buf.h * 0.55);
    for (let x = 0; x < f.buf.w; x++) {
      const c = f.buf.data[y * f.buf.w + x];
      if ((c & 255) === 0) continue;
      while (f.buf.data[y * f.buf.w + x + run] >>> 0 === PAL_HD.ink[0] >>> 0) run++;
      break;
    }
    expect(run).toBeGreaterThanOrEqual(3);
  }, 120_000);

  it('under the water line the parts take the water ramps and a navy outline; the wing plates stay dry', async () => {
    await loadContent();
    for (const d of [2, 4] as const) {
      const lo = getFrames('vehicle/swan/swim', 1)[0];
      const f = getFrames('vehicle/swan/swim', d)[0];
      // The surface row (body y −16) in art px.
      const pts = lo.pts ?? {};
      const lift = (pts.hull?.[1] ?? 0) - Math.round(body.REST.hull[1] + RIDDEN.swim.frames[0].dy);
      const y0 = (body.SURFACE + lo.oy + lift) * d;
      const below = new Set<number>();
      for (let y = Math.max(0, y0 + d); y < f.buf.h; y++) for (let x = 0; x < f.buf.w; x++) {
        const c = f.buf.data[y * f.buf.w + x];
        if ((c & 255) !== 0) below.add(c >>> 0);
      }
      expect(below.size, `swim@${d}x has parts under water`).toBeGreaterThan(3);
      for (const c of below) {
        expect(PAL_HD.orange.includes(c) || PAL_HD.snow.includes(c) || c === PAL_HD.ink[0] >>> 0, `swim@${d}x ${c.toString(16)} under water`).toBe(false);
      }
      expect([...below].some((c) => PAL_HD.teal.includes(c)), `swim@${d}x teal paddles`).toBe(true);
    }
  }, 120_000);

  it('front overlays are cut out of their body frames (the same px where they draw)', async () => {
    await loadContent();
    for (const d of [2, 4] as const) {
      for (const anim of ['idle', 'run', 'glide', 'crouch', 'honk', 'swim']) {
        const b = getFrames(`vehicle/swan/${anim}`, d);
        const fr = getFrames(`vehicle/swan/${anim}-front`, d);
        const lf = getFrames(`vehicle/swan/${anim}-front`, 1);
        fr.forEach((f, i) => {
          const B = b[i];
          const dx = (B.ox - f.ox) * d;
          const dy = (B.oy - f.oy) * d;
          let n = 0;
          for (let y = 0; y < f.buf.h; y++) {
            for (let x = 0; x < f.buf.w; x++) {
              const c = f.buf.data[y * f.buf.w + x];
              if ((c & 255) === 0) continue;
              n++;
              expect(B.buf.data[(y + dy) * B.buf.w + x + dx], `${anim}-front[${i}]@${d}x ${x},${y}`).toBe(c);
            }
          }
          const loEmpty = lf[i].buf.data.every((c) => (c & 255) === 0);
          expect(n > 0, `${anim}-front[${i}]@${d}x drawn`).toBe(!loEmpty);
        });
      }
    }
  }, 120_000);

  it('is deterministic (same pose, same px)', async () => {
    await loadContent();
    const style = { colour: 'ivory' as const, socks: false };
    const lo = getFrames('vehicle/swan/run', 1)[3];
    const lf = getFrames('vehicle/swan/run-front', 1)[3];
    const a = renderBodyHd(style, RIDDEN.run.frames[3], 4, lo, lf);
    const b = renderBodyHd(style, RIDDEN.run.frames[3], 4, lo, lf);
    expect(Array.from(a.body.buf.data)).toEqual(Array.from(b.body.buf.data));
    expect(Array.from(a.front!.buf.data)).toEqual(Array.from(b.front!.buf.data));
  });

  it('the m3 sock variants keep only their 1× art; the old 2× kit paths are retired', async () => {
    await loadContent();
    for (const d of [2, 4] as const) {
      expect(hasHiSprite('vehicle/swan-socks/idle', d)).toBe(false);
      expect(hasHiSprite('vehicle/swan-mute-socks/run', d)).toBe(false);
    }
    for (const gone of ['withKitDensity', 'kitDensity', 'placeHi', 'withHiCover', 'hiToBody', 'fine', 'slab']) expect(gone in kit, `kit.${gone}`).toBe(false);
    for (const gone of ['hiCut', 'rivetHi']) expect(gone in body, `body.${gone}`).toBe(false);
    expect('neckCut' in head).toBe(false);
    // The 1× renderers take no density any more.
    expect(body.renderBody.length).toBe(2);
    expect(head.renderNeckFrame.length).toBe(2);
  });
});
