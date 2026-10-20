/**
 * The ring's dense scenery off the main thread (src/game/ring/scenery-job.ts, review fix
 * 2026-10-21): the worker's build gives the same frame as the main-thread build (byte-identical
 * pixels, the same crop and anchor), the sky keeps its full buffer, and without Worker (node,
 * tests, tools) the view falls back to the main-thread path.
 */
import { describe, expect, it } from 'vitest';
import type { Frame } from '../../../src/engine/render';
import { makeHiBgLayer } from '../../../src/game/art/art-registry';
import '../../../src/game/content/ring/scenery/index';
import { planRing } from '../../../src/game/ring/plan';
import { buildRingScenery, replyFrame, requestRingScenery, ringSceneryInFlight, trimmedFrame } from '../../../src/game/ring/scenery-job';
import type { RingViewHost } from '../../../src/game/ring/types';
import { CHUNK_W, RING_LAYERS, RingView } from '../../../src/game/ring/view';

function sameFrame(a: Frame | null, b: Frame | null): void {
  expect(!!a).toBe(!!b);
  if (!a || !b) return;
  expect([a.buf.w, a.buf.h, a.ox, a.oy, a.density]).toEqual([b.buf.w, b.buf.h, b.ox, b.oy, b.density]);
  expect(Buffer.from(a.buf.data.buffer, a.buf.data.byteOffset, a.buf.data.byteLength).equals(Buffer.from(b.buf.data.buffer, b.buf.data.byteOffset, b.buf.data.byteLength))).toBe(true);
}

describe('ring scenery job (the worker build)', () => {
  const plan = planRing(4, 'normal');
  const d0 = plan.stretches[2].start + 200;
  const host = {
    plan,
    ticks: 0,
    camX: d0,
    planDist: d0,
    roadSpeed: 3,
    stretchIndex: 2,
    planX: (x: number): number => x,
    worldX: (p: number): number => p,
  } satisfies RingViewHost;
  const view = new RingView(plan, 4, 1);
  view.prepare(host, 1);

  for (const key of ['road', 'verge', 'city'] as const) {
    it(`builds the ${key} chunk at 4× byte-identical to the main thread (crop and anchor too)`, () => {
      const L = RING_LAYERS.find((l) => l.key === key)!;
      const i = view.chunkIndices(key)[1];
      const info = view.chunkInfo(key, i);
      expect(info).not.toBeNull();
      const seed = 1234 + i;
      const main = (() => {
        const buf = makeHiBgLayer(L.gen, CHUNK_W, L.h, info!.params, seed, 4);
        return buf ? trimmedFrame(buf, 4) : null;
      })();
      const { reply, transfer } = buildRingScenery({ id: 7, gen: L.gen, w: CHUNK_W, h: L.h, params: info!.params, seed, d: 4, trim: true });
      expect(reply.id).toBe(7);
      expect(reply.error).toBeUndefined();
      if (reply.px) expect(transfer).toEqual([reply.px]);
      sameFrame(replyFrame(reply), main);
    }, 60_000);
  }

  it('keeps the sky whole (no crop) and reports a missing generator as none', () => {
    const { reply } = buildRingScenery({ id: 1, gen: 'ring-sky', w: 512, h: 104, params: { kind: 'day' }, seed: 9, d: 2, trim: false });
    const f = replyFrame(reply);
    expect(f?.buf.w).toBe(1024);
    expect(f?.buf.h).toBe(208);
    expect([Math.abs(f?.ox ?? 1), Math.abs(f?.oy ?? 1)]).toEqual([0, 0]);
    const none = buildRingScenery({ id: 2, gen: 'ring-no-such-layer', w: 8, h: 8, params: {}, seed: 1, d: 2, trim: true });
    expect(none.reply.px).toBeNull();
    expect(replyFrame(none.reply)).toBeNull();
  });

  it('without Worker the request is refused (the view queues its main-thread job)', () => {
    expect(typeof (globalThis as { Worker?: unknown }).Worker).toBe('undefined');
    let ran = 0;
    const sent = requestRingScenery('test:0', { gen: 'ring-road', w: CHUNK_W, h: 123, params: {}, seed: 1, d: 2, trim: true }, () => ran++, () => ran++);
    expect(sent).toBe(false);
    expect(ran).toBe(0);
    expect(ringSceneryInFlight()).toBe(0);
  });
});
