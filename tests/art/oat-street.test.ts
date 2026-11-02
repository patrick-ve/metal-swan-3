/**
 * STREET-A, wave A (docs/design/oat.md §2.1, §2.5, §8.2, §8.5, §8.7 a and d, §8.10, §8.11, §8.12):
 * the scenery of oat-a and of the oat-d night proof strip (0–1,280).
 *
 * - every decor sprite the two sections place is registered, has 1×, 2× and 4× art with the same
 *   logical geometry, and every 2× / 4× pixel is in PAL_HD ∪ PAL_HD_OAT (1×: PAL);
 * - static props carry NO ink outline, what can be shot carries outline A (decisions 38 and 60);
 * - the layers: registered generators, palette, the sky layers unlifted, factorX below s(back edge);
 * - the floor painter: pure (the same texel twice), palette, ≥ 12 wear marks per 256 px of street,
 *   the wetness field (wet in the shade, drying in the sun; d all wet);
 * - the floor defs: camera of spec §2, no kerb across the walk line, front rows ≥ 34 px apart;
 * - memory: the 4× decor and layers of each section within the spec §8.12 shares.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { inOatPalette, PAL_HD } from '../../src/engine/palette-hd';
import { inPalette } from '../../src/engine/palette';
import { getFrames, hasSprite } from '../../src/engine/sprites';
import { getBgGenerator, hasBgGenerator, makeHiBgLayer } from '../../src/game/art/art-registry';
import type { FloorPaintCtx } from '../../src/game/mission/floor/registry';
import type { SectionDef } from '../../src/game/mission/types';
import { getMission } from '../../src/game/registry';
import { loadOatContent } from '../../src/game/scenes/oat-route';

let A: SectionDef;
let D: SectionDef;
let kit: typeof import('../../src/game/content/missions/oat/art/kit');
let painter: typeof import('../../src/game/content/missions/oat/floor/painter');
let floorIndex: typeof import('../../src/game/content/missions/oat/floor/index');

beforeAll(async () => {
  await loadOatContent();
  const m = getMission('oat');
  if (!m) throw new Error('oat not registered');
  A = m.sections['oat-a'];
  D = m.sections['oat-d'];
  kit = await import('../../src/game/content/missions/oat/art/kit');
  painter = await import('../../src/game/content/missions/oat/floor/painter');
  floorIndex = await import('../../src/game/content/missions/oat/floor/index');
}, 60_000);

const INK = PAL_HD.ink[0] >>> 0;

function streetIds(s: SectionDef): string[] {
  return [...new Set((s.decor ?? []).map((d) => d.sprite))];
}

describe('oat street decor (STREET-A)', () => {
  it('every placed sprite is registered and has 1×, 2× and 4× art of one geometry', () => {
    for (const s of [A, D]) {
      const ids = streetIds(s);
      expect(ids.length).toBeGreaterThan(10);
      for (const id of ids) {
        expect(hasSprite(id), id).toBe(true);
        const one = getFrames(id, 1);
        for (const dd of [2, 4]) {
          const hi = getFrames(id, dd);
          expect(hi.length, id).toBe(one.length);
          hi.forEach((f, i) => {
            expect(f.density ?? 1, id).toBe(dd);
            expect(f.buf.w, id).toBe(one[i].buf.w * dd);
            expect(f.buf.h, id).toBe(one[i].buf.h * dd);
            expect(f.ox, id).toBe(one[i].ox);
            expect(f.oy, id).toBe(one[i].oy);
          });
        }
      }
    }
  });

  it('the oat set at 2× / 4×, PAL at 1×', () => {
    for (const id of kit.OAT_STREET_SPRITES) {
      for (const f of getFrames(id, 1)) for (const c of f.buf.data) if ((c & 255) !== 0) expect(inPalette(c), `${id} 1× ${c.toString(16)}`).toBe(true);
      for (const dd of [2, 4]) {
        const bad = new Set<number>();
        for (const f of getFrames(id, dd)) for (const c of f.buf.data) if ((c & 255) !== 0 && !inOatPalette(c)) bad.add(c >>> 0);
        expect([...bad].map((c) => c.toString(16)), `${id} ${dd}×`).toEqual([]);
      }
    }
  });

  it('no ink outline on static props; outline A on what can be shot (spec §8.11)', () => {
    for (const id of kit.OAT_STREET_SPRITES) {
      const f = getFrames(id, 4)[0];
      const { w, h, data } = f.buf;
      let edge = 0;
      let ink = 0;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const c = data[y * w + x];
          if ((c & 255) === 0) continue;
          const open = x === 0 || y === 0 || x === w - 1 || y === h - 1 || (data[y * w + x - 1] & 255) === 0 || (data[y * w + x + 1] & 255) === 0 || (data[(y - 1) * w + x] & 255) === 0 || (data[(y + 1) * w + x] & 255) === 0;
          if (!open) continue;
          edge++;
          if (c >>> 0 === INK) ink++;
        }
      }
      if (kit.OAT_STREET_HITTABLE.has(id)) expect(ink / edge, id).toBeGreaterThan(0.9);
      else expect(ink / Math.max(1, edge), id).toBeLessThan(0.25);
    }
  });

  it('background figures stay few (≤ 4 per day screen) and the plates name the real streets', () => {
    const people = (A.decor ?? []).filter((d) => d.sprite.includes('/person-')).map((d) => d.x);
    for (let x = 0; x < A.width; x += 64) expect(people.filter((p) => p >= x && p < x + 384).length).toBeLessThanOrEqual(4);
    const plates = streetIds(A).filter((id) => id.includes('/plate-'));
    for (const name of ['berenstraat', 'wolvenstraat', 'oude-spiegelstraat']) expect(plates).toContain(`decor/oat/a/plate-${name}`);
  });
});

describe('oat street layers (STREET-A)', () => {
  it('registered, oat palette at 2× / 4×, sky unlifted, factorX below the back edge s', () => {
    for (const s of [A, D]) {
      const sky = s.floor?.skyLayers ?? [];
      for (const l of s.background.layers) {
        expect(hasBgGenerator(l.gen), l.gen).toBe(true);
        if (!sky.includes(l.gen)) expect(l.factorX, l.gen).toBeLessThan(0.862);
        if (!l.gen.startsWith('oat-')) continue;
        getBgGenerator(l.gen)(l.width ?? 512, l.height ?? 216, l.params ?? {}, 1);
        for (const dd of [2, 4] as const) {
          const buf = makeHiBgLayer(l.gen, l.width ?? 512, l.height ?? 216, l.params ?? {}, 1, dd);
          expect(buf, l.gen).not.toBeNull();
          const bad = new Set<number>();
          for (const c of (buf as { data: Uint32Array }).data) if ((c & 255) !== 0 && !inOatPalette(c)) bad.add(c >>> 0);
          expect(bad.size, `${l.gen} ${dd}×`).toBe(0);
        }
      }
    }
  });

  it('memory: the 4× layers and decor of each section within the spec §8.12 shares', () => {
    for (const s of [A, D]) {
      const layers = s.background.layers.reduce((n, l) => n + (l.width ?? 512) * (l.height ?? 216) * 16 * 4, 0);
      expect(layers / 2 ** 20, `${s.id} layers MB`).toBeLessThanOrEqual(50);
      let decor = 0;
      for (const id of streetIds(s)) for (const f of getFrames(id, 4)) decor += f.buf.w * f.buf.h * 4;
      expect(decor / 2 ** 20, `${s.id} decor MB`).toBeLessThanOrEqual(30);
    }
  });
});

describe('oat street floor (STREET-A)', () => {
  /** A painter context for the street camera at density d. */
  function ctx(d: number, params: Record<string, unknown>): FloorPaintCtx {
    const cam = { yh: 60, yw: 176, f: 210 };
    return {
      d,
      params,
      seed: 11,
      cam,
      heightAt: () => 0,
      featureAt: () => -1,
      vAt: (depth: number) => cam.f * (1 - 1 / (1 - depth / (cam.yw - cam.yh))),
      depthAt: (v: number) => (cam.yw - cam.yh) * (1 - cam.f / (cam.f - v)),
    } as unknown as FloorPaintCtx;
  }

  it('the camera of spec §2 and no kerb across the walk line; front rows ≥ 34 px apart', () => {
    for (const s of [A, D]) {
      const f = s.floor;
      expect(f, s.id).toBeTruthy();
      expect(f?.camera).toMatchObject({ yh: 60, f: 210, back: 160 });
      for (const ft of f?.features ?? []) {
        if (ft.kind !== 'kerb') continue;
        const from = typeof ft.from === 'number' ? ft.from : 99;
        const to = typeof ft.to === 'number' ? ft.to : -99;
        expect(from > 0 && to < 0, `${s.id} kerb across 0`).toBe(false);
      }
      for (const r of f?.rows ?? []) {
        if (r.depth >= 0 || !r.at) continue;
        const at = [...r.at].sort((a, b) => a - b);
        for (let i = 1; i < at.length; i++) expect(at[i] - at[i - 1], r.name).toBeGreaterThanOrEqual(34);
      }
    }
  });

  it('the painter is pure and paints the oat set (PAL at 1×)', () => {
    for (const light of ['morning', 'night']) {
      for (const d of [1, 2, 4]) {
        const p = { light, section: light === 'night' ? 'oat-d' : 'oat-a' };
        const t1 = painter.streetTexels(ctx(d, p));
        const t2 = painter.streetTexels(ctx(d, p));
        for (let i = 0; i < 400; i++) {
          const u = 300 + i * 9.37;
          const v = -60 + ((i * 7.1) % 80);
          const c = t1(u, v);
          expect(t2(u, v)).toBe(c);
          if (d === 1) expect(inPalette(c), `${light} 1×`).toBe(true);
          else expect(inOatPalette(c), `${light} ${d}× ${c.toString(16)}`).toBe(true);
        }
      }
    }
  });

  it('≥ 12 wear marks per 256 px of floor (spec §8.10)', () => {
    const d = 4;
    const on = painter.streetTexels(ctx(d, { light: 'morning', section: 'oat-a' }));
    const off = painter.streetTexels(ctx(d, { light: 'morning', section: 'oat-a', wear: false }));
    const c = ctx(d, {});
    const v0 = c.vAt(15.5);
    const v1 = c.vAt(-30);
    for (const u0 of [600, 1900, 3300]) {
      const W = 256 * d;
      const H = Math.ceil((v1 - v0) * d);
      const mask = new Uint8Array(W * H);
      for (let Y = 0; Y < H; Y++) {
        for (let X = 0; X < W; X++) {
          const u = u0 + (X + 0.5) / d;
          const v = v0 + (Y + 0.5) / d;
          if (on(u, v) !== off(u, v)) mask[Y * W + X] = 1;
        }
      }
      // Count the marks: 8-connected components of ≥ 2 art px.
      let marks = 0;
      const stack: number[] = [];
      for (let i = 0; i < mask.length; i++) {
        if (mask[i] !== 1) continue;
        let n = 0;
        mask[i] = 2;
        stack.push(i);
        while (stack.length) {
          const k = stack.pop() as number;
          n++;
          const x = k % W;
          const y = (k - x) / W;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              const xx = x + dx;
              const yy = y + dy;
              if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
              const j = yy * W + xx;
              if (mask[j] === 1) {
                mask[j] = 2;
                stack.push(j);
              }
            }
          }
        }
        if (n >= 2) marks++;
      }
      expect(marks, `marks in ${u0}…${u0 + 256}`).toBeGreaterThanOrEqual(12);
    }
  });

  it('wet in the shade after the rain, drying in the sun; d all wet (spec §8.10)', () => {
    const wetA = floorIndex.wetnessOf('oat-a');
    const wetD = floorIndex.wetnessOf('oat-d');
    const c = ctx(4, {});
    // The middle of the Berenstraat's clinker street lies in the opposite row's shade; the bridges in sun.
    const vStreet = c.vAt(4);
    let shadeSum = 0;
    let sunSum = 0;
    for (let i = 0; i < 40; i++) {
      shadeSum += wetA(900 + i * 7, vStreet);
      sunSum += wetA(1610 + i * 3, vStreet);
    }
    expect(shadeSum / 40).toBeGreaterThan(sunSum / 40 + 0.2);
    for (let i = 0; i < 40; i++) expect(wetD(40 + i * 30, c.vAt(-4))).toBeGreaterThanOrEqual(0.9);
  });
});
