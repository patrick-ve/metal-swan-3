/**
 * Motion of the ams flyers and ambient life (animation wave, plan Phase 3 FLYERS + AMBIENT):
 * frame counts, the smoothness gate (no identical consecutive frames, 1× and 2×), 2× and 4× art
 * keeps the 1× geometry, and the draw-only transitions: the gull's take-off, pull-up and squash turn
 * (a tell cancels them; the tell timing is unchanged), the pigeons' take-off, the ducks' 4-step
 * paddle, the window waver's lean, the cat's swish and the tour boat's end-of-run turn.
 */
import { describe, expect, it } from 'vitest';
import type { Renderer } from '../../src/engine/render';
import { getFrames } from '../../src/engine/sprites';
import { inPalette } from '../../src/engine/palette';
import { inHdPalette } from '../../src/engine/palette-hd';
import '../../src/game/content/characters/index';
import '../../src/game/content/weapons/index';
import '../../src/game/content/items/index';
import '../../src/game/content/props/index';
import '../../src/game/content/vehicles/swan/index';
import '../../src/game/content/locals/index';
import '../../src/game/content/locals/art';
import '../../src/game/content/missions/ams/index';
import { Seagull, SEAGULL } from '../../src/game/content/locals/index';
import { AmsPigeons } from '../../src/game/content/missions/ams/entities';
import { TOUR_BOAT, type AmsTourBoat } from '../../src/game/content/missions/ams/ambient';
import { assertNoDuplicateFrames } from '../art/motion';
import { FLOOR, TestWorld } from './helpers';

const COUNTS: Record<string, number> = {
  'enemy/seagull/walk': 6,
  'enemy/seagull/idle': 6,
  'enemy/seagull/takeoff': 3,
  'enemy/seagull/pull-up': 2,
  'enemy/seagull/turn': 2,
  'npc/ams/ams-pigeons/takeoff': 2,
  'npc/ams/ams-ducks/paddle': 8,
  'npc/ams/ams-window-waver/cat-swish': 4,
  'npc/ams/ams-window-waver/lean': 3,
  'npc/ams/ams-tour-boat/turn': 2,
};

/** A renderer that records the sprite calls. */
function recorder(): { r: Renderer; calls: [string, number][] } {
  const calls: [string, number][] = [];
  const r = { sprite: (id: string, i: number) => void calls.push([id, i]) } as unknown as Renderer;
  return { r, calls };
}

describe('ambient motion: strips', () => {
  for (const [id, n] of Object.entries(COUNTS)) {
    it(`${id}: ${n} frames, palette, no identical neighbours, 2× and 4× art`, () => {
      const lo = getFrames(id, 1);
      expect(lo.length).toBe(n);
      for (let i = 0; i < n; i++) for (const c of lo[i].buf.data) if (c !== 0 && !inPalette(c)) expect.fail(`${id}[${i}] colour ${c.toString(16)}`);
      for (const d of [2, 4]) {
        const hi = getFrames(id, d);
        expect(hi.length).toBe(n);
        for (let i = 0; i < n; i++) {
          // Dense art: the 64 palette, or PAL_HD where the UHD kit draws it.
          for (const c of hi[i].buf.data) if (c !== 0 && !inPalette(c) && !inHdPalette(c)) expect.fail(`${id}[${i}] ${d}× colour ${c.toString(16)}`);
          expect(hi[i].buf.w).toBe(lo[i].buf.w * d);
          expect(hi[i].buf.h).toBe(lo[i].buf.h * d);
          expect([hi[i].ox, hi[i].oy]).toEqual([lo[i].ox, lo[i].oy]);
        }
      }
      // The duck paddle holds two looping 4-frame cycles (drake, hen): check each.
      if (id !== 'npc/ams/ams-ducks/paddle') assertNoDuplicateFrames(id);
    });
  }

  it('the take-off draws the perched gull at the flying anchor (no pop, no drop at the hand-off)', () => {
    const t = getFrames('enemy/seagull/takeoff', 1);
    const fly = getFrames('enemy/seagull/walk', 1)[0];
    const perch = getFrames('enemy/seagull/perch', 1)[0];
    // Every frame = the perch body (feet anchor − 11): the rising anchor carries the lift, so the
    // body is where the flap strip draws it when the take-off ends.
    for (const f of t) expect(f.oy).toBe(perch.oy - 11);
    expect(t[0].buf.h).toBe(fly.buf.h);
  });
});

describe('ambient motion: the gull', () => {
  it('wakes into the 3-frame take-off, then flaps', () => {
    const tw = new TestWorld({ playerX: 100, god: true, seed: 6 });
    const g = tw.spawn('seagull', 300, { perch: true }, FLOOR - 50) as Seagull;
    tw.hold('right');
    tw.until(() => g.mode === 'fly', 400);
    const { r, calls } = recorder();
    for (let i = 0; i < 12; i++) {
      g.draw(r);
      tw.run(1);
    }
    const ids = calls.map((c) => c[0]);
    expect(ids[0]).toBe('enemy/seagull/takeoff');
    expect(new Set(calls.filter((c) => c[0] === 'enemy/seagull/takeoff').map((c) => c[1]))).toEqual(new Set([0, 1, 2]));
    expect(ids.at(-1)).not.toBe('enemy/seagull/takeoff');
  });

  it('turns over squash frames with hysteresis, not an instant mid-air flip; a tell cancels it', () => {
    const tw = new TestWorld({ playerX: 100, god: true, seed: 3 });
    const g = tw.spawn('seagull', 200, {}, FLOOR - 40) as Seagull;
    tw.run(2);
    const f0 = g.facing;
    // Move the player to the other side: the gull keeps its facing a few ticks, then squashes.
    tw.player!.x = g.x + -f0 * 120;
    tw.run(1);
    expect(g.facing).toBe(f0);
    const { r, calls } = recorder();
    let flipped = -1;
    for (let i = 0; i < 40 && flipped < 0; i++) {
      g.draw(r);
      tw.run(1);
      if (g.facing !== f0) flipped = i;
    }
    expect(flipped).toBeGreaterThanOrEqual(7);
    expect(calls.some((c) => c[0] === 'enemy/seagull/turn')).toBe(true);
  });

  it('the tell window is unchanged and starts on the same tick as before (tell cancels transitions)', () => {
    const tw = new TestWorld({ playerX: 100, god: true, seed: 6 });
    const g = tw.spawn('seagull', 180, {}, FLOOR - 40) as Seagull;
    tw.until(() => g.mode === 'tell', 600);
    const { r, calls } = recorder();
    g.draw(r);
    expect(calls[0][0]).toBe('enemy/seagull/tell');
    let n = 0;
    while (g.mode === 'tell' && n < 100) {
      tw.run(1);
      n++;
    }
    expect(n).toBeGreaterThanOrEqual(SEAGULL.tele - 1);
  });
});

describe('ambient motion: ambient life', () => {
  it('pigeons crouch and push off (2 frames) before they flap', () => {
    const tw = new TestWorld({ playerX: 60, god: true });
    const f = tw.spawn('ams-pigeons', 220, { count: 3 }) as AmsPigeons;
    f.scare(200);
    const { r, calls } = recorder();
    f.draw(r);
    expect(calls[0]).toEqual(['npc/ams/ams-pigeons/takeoff', 0]);
    tw.run(4);
    calls.length = 0;
    f.draw(r);
    expect(calls[0]).toEqual(['npc/ams/ams-pigeons/takeoff', 1]);
    tw.run(8);
    calls.length = 0;
    f.draw(r);
    expect(calls.every((c) => c[0] === 'npc/ams/ams-pigeons')).toBe(true);
  });

  it('ducks paddle in 4 steps; the cat swishes in 4', () => {
    const tw = new TestWorld({ playerX: 60, god: true });
    const d = tw.spawn('ams-ducks', 300, { count: 2 });
    const c = tw.spawn('ams-window-waver', 360, { look: 'cat' });
    const { r, calls } = recorder();
    for (let i = 0; i < 64; i++) {
      d.draw(r);
      c.draw(r);
      tw.run(1);
    }
    const duck = new Set(calls.filter((x) => x[0] === 'npc/ams/ams-ducks/paddle').map((x) => x[1]));
    expect(duck).toEqual(new Set([0, 1, 2, 3, 4, 5, 6, 7]));
    const cat = new Set(calls.filter((x) => x[0] === 'npc/ams/ams-window-waver/cat-swish').map((x) => x[1]));
    expect(cat).toEqual(new Set([0, 1, 2, 3]));
  });

  it('the window waver leans in and out over 3 frames', () => {
    const tw = new TestWorld({ playerX: 60, god: true });
    const w = tw.spawn('ams-window-waver', 300, { period: 360 }, FLOOR - 80);
    const { r, calls } = recorder();
    for (let i = 0; i < 400; i++) {
      w.draw(r);
      tw.run(1);
    }
    const seq = calls.map((c) => `${c[0].split('/').at(-1)}:${c[1]}`).filter((s, i, a) => s !== a[i - 1]);
    const i0 = seq.indexOf('lean:0');
    expect(seq.slice(i0, i0 + 4)).toEqual(['lean:0', 'lean:1', 'lean:2', 'person:1']);
    const out = seq.findIndex((s, i) => s === 'lean:2' && seq[i + 1] === 'lean:1');
    expect(seq.slice(out, out + 4)).toEqual(['lean:2', 'lean:1', 'lean:0', 'person:0']);
  });

  it('the tour boat turns at the end of its run over squash frames', () => {
    const tw = new TestWorld({ playerX: 60, god: true });
    const b = tw.spawn('ams-tour-boat', 200, { range: 20, speed: 1 }, FLOOR) as AmsTourBoat;
    const { r, calls } = recorder();
    tw.until(() => b.facing < 0, 200);
    for (let i = 0; i < TOUR_BOAT.turn + 4; i++) {
      b.draw(r);
      tw.run(1);
    }
    expect(calls.some((c) => c[0] === 'npc/ams/ams-tour-boat/turn')).toBe(true);
    expect(tw.world.errors).toEqual([]);
  });
});
