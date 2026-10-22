/**
 * The ring's scenery and light (docs/design/ring.md §2, §4, §7.3, §11, §13; docs/api/ring.md
 * "Scenery"): every layer generator and set piece at 1×, 2× and 4× (geometry, palettes, the 1×
 * footprint, determinism), the chunk streaming (made ahead, evicted behind), the 4× scenery
 * reserve in every stretch, the tunnels (darkness, portals, 3 lanes), the road marks, the
 * hectometre boards and the ambience.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { inPalette } from '../../src/engine/palette';
import { inHdPalette } from '../../src/engine/palette-hd';
import type { PixelBuffer } from '../../src/engine/pixel';
import { SoftRenderer } from '../../src/engine/render-soft';
import { getFrames, setHiArt, withArtDensity } from '../../src/engine/sprites';
import { getBgGenerator, hasBgGenerator, hasHiBgGenerator, makeHiBgLayer } from '../../src/game/art/art-registry';
import { RING_SCENERY } from '../../src/game/content/sfx/ring-scenery';
import '../../src/game/content/ring/scenery/index';
import { CITY_KINDS, FAR_KINDS } from '../../src/game/content/ring/scenery/layers-far';
import { roadBaseBytes, VERGE_KINDS } from '../../src/game/content/ring/scenery/layers-near';
import { RING_LIGHT_SPRITES, RING_PIECES_BY_LANDMARK, RING_SCENERY_SPRITES } from '../../src/game/content/ring/scenery/pieces';
import { RING_LANDMARKS } from '../../src/game/ring/ids';
import { formatKm, ringKmAt } from '../../src/game/ring/landmarks';
import { TUNNEL_DARK } from '../../src/game/ring/light';
import { planRing } from '../../src/game/ring/plan';
import type { RingPlan, RingViewHost } from '../../src/game/ring/types';
import { CHUNK_W, markRoad, RING_LAYERS, RING_SCENERY_RESERVE, RingView, roadMarks } from '../../src/game/ring/view';

/** A host at plan distance `d` with camera offset `off` (camX = d + off). */
function hostAt(plan: RingPlan, d: number, off = 0, ticks = 0): RingViewHost & { camX: number; planDist: number; ticks: number } {
  const h = {
    plan,
    ticks,
    camX: d + off,
    planDist: d,
    roadSpeed: 3,
    stretchIndex: 0,
    planX(x: number): number {
      return h.planDist + (x - h.camX);
    },
    worldX(p: number): number {
      return h.camX + (p - h.planDist);
    },
  };
  return h;
}

function hashBuf(b: PixelBuffer | null): string {
  if (!b) return 'null';
  let h = 2166136261;
  for (let i = 0; i < b.data.length; i++) h = Math.imul(h ^ b.data[i], 16777619) >>> 0;
  return `${b.w}x${b.h}:${h}`;
}

/**
 * Logical opaque mask of a buffer at density d: a logical px is opaque when any art px of its
 * block is (hairlines the dense art draws inside a 1× px keep that px).
 */
function mask(b: PixelBuffer, d: number): Uint8Array {
  const w = b.w / d;
  const h = b.h / d;
  const m = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let n = 0;
      for (let yy = 0; yy < d; yy++) for (let xx = 0; xx < d; xx++) if ((b.get(x * d + xx, y * d + yy) & 255) !== 0) n++;
      m[y * w + x] = n > 0 ? 1 : 0;
    }
  }
  return m;
}

function offPalette(b: PixelBuffer, inPal: (c: number) => boolean): number {
  let bad = 0;
  for (let i = 0; i < b.data.length; i++) {
    const c = b.data[i];
    if ((c & 255) === 0) continue;
    if ((c & 255) !== 255 || !inPal(c >>> 0)) bad++;
  }
  return bad;
}

/** Every layer generator with params that exercise its kinds and features. */
function layerCases(): Array<{ gen: string; w: number; h: number; params: Record<string, unknown> }> {
  const out: Array<{ gen: string; w: number; h: number; params: Record<string, unknown> }> = [];
  const L = (key: string) => RING_LAYERS.find((l) => l.key === key) as (typeof RING_LAYERS)[number];
  out.push({ gen: 'ring-sky', w: 512, h: 104, params: { kind: 'day' } });
  for (const kind of FAR_KINDS) out.push({ gen: 'ring-far', w: CHUNK_W, h: L('far').h, params: { kind, x0: 768, rs: 3 } });
  for (const kind of CITY_KINDS) out.push({ gen: 'ring-city', w: CHUNK_W, h: L('city').h, params: { kind, x0: 768, rs: 3 } });
  for (const kind of VERGE_KINDS) out.push({ gen: 'ring-verge', w: CHUNK_W, h: L('verge').h, params: { kind, x0: 768, rs: 3 } });
  out.push({
    gen: 'ring-verge',
    w: CHUNK_W,
    h: L('verge').h,
    params: {
      kind: 'trees',
      x0: 0,
      rs: 3,
      water: [20, 120],
      cut: [140, 250],
      signs: [
        { x: 60, code: 'S112', name: 'CENTRUM', kind: 'exit' },
        { x: 190, code: 'S110', name: 'RING A10', kind: 'ring' },
        { x: 110, code: '', name: 'ROZENOORDBRUG', kind: 'name' },
      ],
    },
  });
  for (const kind of ['road', 'rail']) out.push({ gen: 'ring-farroad', w: CHUNK_W, h: L('farroad').h, params: { kind, x0: 512, rs: 3 } });
  out.push({ gen: 'ring-tunnel', w: CHUNK_W, h: L('tunnel').h, params: { kind: 'tunnel', x0: 1024, rs: 3, spans: [40, 256, 0] } });
  out.push({ gen: 'ring-tunnel', w: CHUNK_W, h: L('tunnel').h, params: { kind: 'tunnel', x0: 1024, rs: 3, spans: [0, 200, 1] } });
  out.push({ gen: 'ring-road', w: CHUNK_W, h: L('road').h, params: { kind: 'open', x0: 256, rs: 3, hm: [{ x: 80, t: '12,3' }] } });
  out.push({ gen: 'ring-road', w: CHUNK_W, h: L('road').h, params: { kind: 'open', x0: 512, rs: 3, tunnel: [100, 256, 0], bridge: [0, 90], exit: [] } });
  out.push({ gen: 'ring-road', w: CHUNK_W, h: L('road').h, params: { kind: 'open', x0: 768, rs: 3, exit: [30, 256] } });
  out.push({ gen: 'ring-front', w: CHUNK_W, h: L('front').h, params: { kind: 'rail', x0: 256, rs: 3 } });
  out.push({ gen: 'ring-front', w: CHUNK_W, h: L('front').h, params: { kind: 'rail', x0: 256, rs: 3, tunnel: [0, 100], bridge: [120, 200], exit: [210, 256] } });
  return out;
}

beforeAll(() => {
  setHiArt(true);
});

describe('ring scenery art', () => {
  it('registers every layer generator at 1×, 2× and 4×: the 1× footprint, palettes, determinism, dense detail', () => {
    const cases = layerCases();
    expect(new Set(cases.map((c) => c.gen))).toEqual(new Set(RING_LAYERS.map((l) => l.gen).concat('ring-sky')));
    for (const c of cases) {
      const tag = `${c.gen} ${String(c.params.kind)}`;
      expect(hasBgGenerator(c.gen), tag).toBe(true);
      const one = withArtDensity(1, () => getBgGenerator(c.gen)(c.w, c.h, c.params, 9));
      expect([one.w, one.h], tag).toEqual([c.w, c.h]);
      expect(offPalette(one, inPalette), `${tag} 1× palette`).toBe(0);
      expect(hashBuf(getBgGenerator(c.gen)(c.w, c.h, c.params, 9)), `${tag} deterministic`).toBe(hashBuf(one));
      for (const d of [2, 4] as const) {
        expect(hasHiBgGenerator(c.gen, d), `${tag}@${d}`).toBe(true);
        const hi = makeHiBgLayer(c.gen, c.w, c.h, c.params, 9, d);
        expect(hi, `${tag}@${d}`).not.toBeNull();
        if (!hi) continue;
        expect([hi.w, hi.h], `${tag}@${d}`).toEqual([c.w * d, c.h * d]);
        expect(offPalette(hi, inHdPalette), `${tag}@${d} PAL_HD`).toBe(0);
        expect(hashBuf(makeHiBgLayer(c.gen, c.w, c.h, c.params, 9, d)), `${tag}@${d} deterministic`).toBe(hashBuf(hi));
        // Same design: the logical footprints agree almost everywhere.
        const a = mask(one, 1);
        const b = mask(hi, d);
        let same = 0;
        for (let i = 0; i < a.length; i++) if (a[i] === b[i]) same++;
        expect(same / a.length, `${tag}@${d} footprint`).toBeGreaterThan(0.97);
        // Dense detail: some d × d blocks are not flat.
        if (one.countOpaque() > 2000) {
          const flat = hi.downsampled(d).scaled(d);
          let diff = 0;
          for (let i = 0; i < hi.data.length; i++) if (hi.data[i] !== flat.data[i]) diff++;
          expect(diff, `${tag}@${d} dense detail`).toBeGreaterThan(200);
        }
      }
    }
  }, 120_000);

  it('registers every set piece (all ten landmarks), the road furniture and the light sprites at 1×, 2× and 4× with the 1× geometry', () => {
    for (const id of RING_LANDMARKS) expect(RING_PIECES_BY_LANDMARK[id]?.length ?? 0, `${id} has set pieces`).toBeGreaterThan(0);
    const all = new Set(RING_SCENERY_SPRITES);
    for (const ids of Object.values(RING_PIECES_BY_LANDMARK)) for (const id of ids) expect(all.has(id), id).toBe(true);
    for (const id of RING_LIGHT_SPRITES) expect(all.has(id), id).toBe(true);
    for (const id of RING_SCENERY_SPRITES) {
      if (id.startsWith('decor/ring/')) expect(/^decor\/ring\/(oost|amstel|zuid|nieuwe-meer|west|westpoort|coentunnel|noord|zeeburg|exit|road)\//.test(id), id).toBe(true);
      const f1 = getFrames(id, 1);
      expect(f1.length, id).toBeGreaterThan(0);
      for (const f of f1) expect(offPalette(f.buf, inPalette), `${id} 1× palette`).toBe(0);
      for (const d of [2, 4]) {
        const fd = getFrames(id, d);
        expect(fd.length, `${id}@${d}`).toBe(f1.length);
        fd.forEach((f, i) => {
          expect(f.density, `${id}@${d}`).toBe(d);
          expect([f.buf.w, f.buf.h, f.ox, f.oy], `${id}@${d} frame ${i}`).toEqual([f1[i].buf.w * d, f1[i].buf.h * d, f1[i].ox, f1[i].oy]);
          expect(offPalette(f.buf, inHdPalette), `${id}@${d} PAL_HD`).toBe(0);
        });
      }
    }
  }, 120_000);

  it('the ambience recipes exist (tunnel echo bed, bridge rumble) and loop', () => {
    expect(RING_SCENERY['ring/tunnel-bed']?.loop).toBe(true);
    expect(RING_SCENERY['ring/bridge-rumble']?.loop).toBe(true);
  });
});

describe('ring scenery streaming', () => {
  const plan = planRing(7, 'normal', { route: 'full' });

  it('makes chunks ahead and evicts them behind the camera', () => {
    const view = new RingView(plan, 7, 1);
    const h = hostAt(plan, 1000, 0);
    for (let t = 0; t < 3000; t += 8) {
      h.camX += 24;
      h.planDist += 24;
      h.ticks = t;
      view.prepare(h, 1);
      for (const L of RING_LAYERS) {
        const i0 = Math.floor((h.camX * L.f) / CHUNK_W);
        const idx = view.chunkIndices(L.key);
        for (const i of idx) expect(i, `${L.key} chunk ${i} at camX ${h.camX}`).toBeGreaterThanOrEqual(i0 - 1);
        expect(idx.length, L.key).toBeLessThanOrEqual(Math.ceil(384 / CHUNK_W) + 3);
      }
    }
    expect(view.made).toBeGreaterThan(100);
    expect(view.evicted).toBeGreaterThan(50);
  });

  it('keeps the 4× scenery (chunks, sky, the road base) inside the reserve in every stretch', () => {
    const view = new RingView(plan, 7, 4);
    const spots: number[] = [];
    for (const st of plan.stretches) spots.push(st.start + 32, (st.start + st.end) / 2, st.end - 400);
    for (const l of plan.landmarks) if (l.tunnel) spots.push(l.start - 220, l.start - 40, l.start + l.length - 220);
    spots.sort((a, b) => a - b);
    let peak = 0;
    let t = 0;
    for (const p of spots) {
      if (p < 0) continue;
      const h = hostAt(plan, p, 0, (t += 60));
      view.prepare(h, 4);
      peak = Math.max(peak, view.residentBytes(4));
    }
    const total = peak + roadBaseBytes();
    expect(total).toBeLessThanOrEqual(RING_SCENERY_RESERVE);
    // Something real was measured (dense chunks were built).
    expect(peak).toBeGreaterThan(8 * 1024 * 1024);
  }, 120_000);

  it('is deterministic per seed: the same seed paints the same chunks; another seed differs', () => {
    const paint = (seed: number): string[] => {
      const p = planRing(seed, 'normal', { route: 'full' });
      const view = new RingView(p, seed, 1);
      const out: string[] = [];
      for (const st of p.stretches.slice(0, 4)) {
        const h = hostAt(p, st.start + 300);
        view.prepare(h, 1);
        for (const L of RING_LAYERS) for (const i of view.chunkIndices(L.key)) out.push(`${L.key}:${i}:${hashBuf(view.chunkInfo(L.key, i)?.buf ?? null)}`);
      }
      return out;
    };
    const a = paint(11);
    expect(paint(11)).toEqual(a);
    expect(paint(12)).not.toEqual(a);
  });
});

describe('ring tunnels, marks, boards and ambience', () => {
  const plan = planRing(3, 'normal', { route: 'full' });
  const coen = plan.landmarks.find((l) => l.id === 'coentunnel');

  it('tunnels: darkness between the portals, none in the open; the portal piece, 3 lanes, the echo bed', () => {
    expect(coen?.tunnel).toBe(true);
    if (!coen) return;
    const view = new RingView(plan, 3, 1);
    // Approach: the entry portal comes into view.
    const h = hostAt(plan, coen.start - 300, 40);
    view.prepare(h, 1);
    const pieces = view.chunkIndices('tunnel').flatMap((i) => view.chunkInfo('tunnel', i)?.pieces ?? []);
    expect(pieces).toContain('decor/ring/coentunnel/portal');
    expect(view.portals.some((p) => p.side === 'in' && Math.abs(p.x - (coen.start + 40)) <= 1)).toBe(true);
    expect(view.light.darkAt(h, coen.start + 40 - 10)).toBe(0);
    // Inside: full darkness, the road chunk has its tunnel span (the near lane is the walkway).
    const mid = coen.start + coen.length / 2;
    const hi = hostAt(plan, mid - 192, 40, 100);
    view.prepare(hi, 1);
    view.update(hi);
    expect(view.light.darkAt(hi, mid + 40)).toBeCloseTo(TUNNEL_DARK, 5);
    const road = view.chunkIndices('road').map((i) => view.chunkInfo('road', i)?.params.tunnel);
    expect(road.some((t) => Array.isArray(t) && t.length >= 3)).toBe(true);
    expect(view.ambience).toBe('ring/tunnel-bed');
    // The back layers are not painted inside (no memory there).
    const far = view.chunkIndices('city').map((i) => view.chunkInfo('city', i)?.params.kind);
    expect(far).toContain('none');
    // In the open: no darkness, no ambience (or a bridge's rumble).
    const ho = hostAt(plan, plan.stretches[0].start + 1500, 0, 200);
    view.prepare(ho, 1);
    view.update(ho);
    expect(view.light.darkAt(ho, ho.camX + 192)).toBe(0);
    expect(view.ambience === null || view.ambience === 'ring/bridge-rumble').toBe(true);
  });

  it('a bridge rumbles; the covered stretch at Bos en Lommer darkens lightly', () => {
    const view = new RingView(plan, 3, 1);
    const br = plan.chunks.find((c) => c.type === 'bridge');
    expect(br).toBeDefined();
    if (br) {
      const h = hostAt(plan, br.start + br.length / 2 - 192);
      view.update(h);
      expect(view.ambience).toBe('ring/bridge-rumble');
    }
    const cov = view.spans.find((s) => s.kind === 'covered');
    expect(cov).toBeDefined();
    if (cov) {
      const h = hostAt(plan, (cov.p0 + cov.p1) / 2 - 192);
      const a = view.light.darkAt(h, (cov.p0 + cov.p1) / 2);
      expect(a).toBeGreaterThan(0.1);
      expect(a).toBeLessThan(TUNNEL_DARK);
    }
  });

  it('hectometre boards carry the km of the plan (GEN ringKmAt), rising along the road', () => {
    const view = new RingView(plan, 3, 1);
    const st = plan.stretches[1];
    const h = hostAt(plan, st.start + 600, 0);
    view.prepare(h, 1);
    const boards: Array<{ x: number; t: string; i: number }> = [];
    for (const i of view.chunkIndices('road')) {
      const hm = view.chunkInfo('road', i)?.params.hm as Array<{ x: number; t: string }> | undefined;
      for (const b of hm ?? []) if (b.x >= 0 && b.x < CHUNK_W) boards.push({ ...b, i });
    }
    expect(boards.length).toBeGreaterThan(0);
    for (const b of boards) {
      const P = h.planX(b.i * CHUNK_W + b.x);
      const km = ringKmAt(plan, P);
      expect([formatKm(km), formatKm(Math.round(km * 10 - 1) / 10)]).toContain(b.t);
    }
  });

  it('road marks: markRoad paints yellow lines along the lane and drops marks behind the view', () => {
    const view = new RingView(plan, 3, 1);
    const h = hostAt(plan, 2000, 0, 10);
    markRoad(h, { x0: h.camX + 100, x1: h.camX + 300, lane: 2 });
    markRoad(h, { x0: h.camX - 900, x1: h.camX - 700, lane: 1 });
    expect(roadMarks(h).length).toBe(2);
    const r = new SoftRenderer(undefined, undefined, undefined, { res: 1 });
    r.begin(view.sky);
    r.setCamera(h.camX, 0);
    withArtDensity(1, () => view.drawBack(r, h));
    r.end();
    expect(roadMarks(h).length).toBe(1);
    // The lane 1|2 border at x 200 of the screen is yellow.
    const c = r.target.get(200, 134);
    expect(((c >>> 24) & 255) > 150 && ((c >>> 16) & 255) > 100 && ((c >>> 8) & 255) < 120).toBe(true);
  });

  it('draws whole frames at res 1 and 2 (back, front, light) inside and outside a tunnel', () => {
    if (!coen) return;
    for (const res of [1, 2]) {
      const view = new RingView(plan, 3, res === 1 ? 1 : 2);
      for (const d of [coen.start - 600, coen.start + 200, 30_000]) {
        const h = hostAt(plan, d, 17, d);
        const r = new SoftRenderer(undefined, undefined, undefined, { res });
        r.begin(view.sky);
        r.setCamera(h.camX, 0);
        withArtDensity(res, () => {
          view.drawBack(r, h);
          view.drawFront(r, h);
          view.drawLight(r, h);
        });
        r.end();
        const colors = new Set<number>();
        for (let i = 0; i < r.target.data.length; i += 97) colors.add(r.target.data[i]);
        expect(colors.size, `res ${res} at ${d}`).toBeGreaterThan(20);
      }
    }
  });
});
