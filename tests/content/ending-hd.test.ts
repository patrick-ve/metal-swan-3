/**
 * UHD art of the ending flow (docs/ART_GUIDE.md "UHD art"; content/ui/ending.art.ts): every
 * backdrop, effect and high-score head has native 2× and 4× art with exactly its 1× frame's
 * geometry, PAL_HD colours only, new art (not the 1× or 2× frames scaled), deterministic; the
 * scenes draw it at the screen density (1× at res 1: as before), drop its 4× frames when the flow
 * moves on, and the glitch bridge corrupts a dense snapshot at density ≤ 2.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { InputManager } from '../../src/engine/input';
import { inHdPalette } from '../../src/engine/palette-hd';
import type { Frame, Renderer } from '../../src/engine/render';
import { clearSpriteCache, denseBytes, generatedSprites, getFrames, hasFramesAt, hasHiSprite, setArtTier, spriteErrors } from '../../src/engine/sprites';
import { MemoryStore } from '../../src/engine/storage';
import { createApp, newCampaign } from '../../src/game/app';
import { loadContent } from '../../src/game/content/index';
import * as art from '../../src/game/content/ui/ending.art';
import { DEFAULT_PARAMS } from '../../src/game/params';
import type { MissionRunner } from '../../src/game/mission/runner';
import { EndingScene } from '../../src/game/scenes/ending';
import { FinalTallyScene } from '../../src/game/scenes/final-tally';
import { GlitchBridgeScene } from '../../src/game/scenes/glitch-bridge';
import { headIcon, headSpriteId } from '../../src/game/scenes/heads';
import { BEAM_ID, drawLake, ENDING_ART, LAKE_ART, LAKE_HORIZON, LAKE_ID, NIGHT_ID, STREET_ID } from '../../src/game/scenes/lake';
import { GameSession } from '../../src/game/session';
import { SimAudio } from '../../src/sim/stats';
import { RecordingRenderer } from '../engine/helpers';

const HEADS = ['legion', 'recruit', 'vincent', 'thom', 'dirk', 'bob', 'patrick'].map(headSpriteId);

/** Is `hi` (density d) just `lo` scaled by an integer factor? */
function scaledCopy(hi: Frame, lo: Frame, k: number): boolean {
  const s = lo.buf.scaled(k).data;
  return hi.buf.data.length === s.length && hi.buf.data.every((c, i) => c === s[i]);
}

function app() {
  const a = createApp({ input: new InputManager(), audio: new SimAudio(), store: new MemoryStore(), params: { ...DEFAULT_PARAMS, players: 1 } });
  a.session = new GameSession({ characters: ['vincent'], seed: 7 });
  a.campaign = newCampaign();
  return a;
}

/** A recording renderer with a backbuffer `res` (the screens' density is min(tier, res)). */
function recorder(res: number): RecordingRenderer {
  const r = new RecordingRenderer();
  (r as unknown as { res: number }).res = res;
  return r;
}

describe('UHD art of the ending flow', () => {
  const ids = [...ENDING_ART, ...HEADS];
  beforeAll(async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await loadContent();
    warn.mockRestore();
  }, 120_000);
  afterEach(() => {
    setArtTier(1);
  });

  it('the scenes name exactly the ids and lines the art module paints', () => {
    expect(ENDING_ART).toEqual(art.ENDING_ART);
    expect([LAKE_ID, BEAM_ID, NIGHT_ID, STREET_ID]).toEqual([art.LAKE_ID, art.BEAM_ID, art.NIGHT_ID, art.STREET_ID]);
    expect(LAKE_HORIZON).toBe(art.LAKE_HORIZON);
  });

  it('gives every backdrop, effect and head 2× and 4× art with the 1× geometry, PAL_HD px only, new art', () => {
    for (const id of ids) {
      expect(hasHiSprite(id, 2), id).toBe(true);
      expect(hasHiSprite(id, 4), id).toBe(true);
      const lo = getFrames(id, 1);
      for (const d of [2, 4] as const) {
        const hi = getFrames(id, d);
        expect(hi.length, `${id}@${d}x`).toBe(lo.length);
        let fresh = false;
        for (let i = 0; i < lo.length; i++) {
          const f = hi[i];
          const tag = `${id}@${d}x[${i}]`;
          expect(f.density, tag).toBe(d);
          expect([f.buf.w, f.buf.h, f.ox, f.oy], tag).toEqual([lo[i].buf.w * d, lo[i].buf.h * d, lo[i].ox, lo[i].oy]);
          const bad = f.buf.data.find((c) => (c & 255) !== 0 && ((c & 255) !== 255 || !inHdPalette(c)));
          expect(bad, tag).toBeUndefined();
          if (!scaledCopy(f, lo[i], d)) fresh = true;
        }
        expect(fresh, `${id}@${d}x is the 1× art scaled`).toBe(true);
      }
      const h2 = getFrames(id, 2);
      expect(
        getFrames(id, 4).some((f, i) => !scaledCopy(f, h2[i], 2)),
        `${id}@4x is the 2× art doubled`,
      ).toBe(true);
    }
    expect(spriteErrors().filter((e) => ids.some((id) => e.id.startsWith(id)))).toEqual([]);
  }, 120_000);

  it('paints the backdrops edge to edge and the heads inside their 1× icon box', () => {
    for (const id of [LAKE_ID, NIGHT_ID, STREET_ID]) {
      const f = getFrames(id, 4)[0];
      // Backdrops are opaque where their 1× frame is (the street: below its roofs).
      const one = getFrames(id, 1)[0].buf;
      for (let y = id === STREET_ID ? 126 : 0; y < one.h; y += 7) {
        for (let x = 0; x < one.w; x += 5) {
          if ((one.get(x, y) & 255) === 0) continue;
          expect(f.buf.get(x * 4 + 2, y * 4 + 2) & 255, `${id} (${x}, ${y})`).toBe(255);
        }
      }
    }
    for (const sid of HEADS) {
      const one = headIcon(sid.slice('ui/score-head/'.length));
      expect(one, sid).not.toBeNull();
      const hd = getFrames(sid, 4)[0].buf;
      expect([hd.w, hd.h], sid).toEqual([one!.w * 4, one!.h * 4]);
      expect(hd.data.some((c) => (c & 255) !== 0), sid).toBe(true);
    }
  });

  it('is deterministic (same input, same pixels)', () => {
    for (const id of [LAKE_ID, STREET_ID, BEAM_ID, headSpriteId('vincent')]) {
      const a = getFrames(id, 2)[0].buf.data.slice();
      clearSpriteCache(id);
      expect(getFrames(id, 2)[0].buf.data, id).toEqual(a);
    }
  });

  it('draws the lake as before at res 1 and its HD frames at the screen density', () => {
    setArtTier(4);
    const one = recorder(1);
    drawLake(one, 10);
    expect(one.count('frame')).toBe(0);
    expect(one.calls.find((c) => c.op === 'image')?.args[0]).toBe(getFrames(LAKE_ID, 1)[0].buf);
    expect(one.count('rect')).toBe(14);
    const four = recorder(8);
    drawLake(four, 10);
    const frames = four.calls.filter((c) => c.op === 'frame').map((c) => (c.args[0] as Frame).density);
    expect(frames.length).toBe(15);
    expect(new Set(frames)).toEqual(new Set([4]));
    const two = recorder(8);
    setArtTier(2);
    drawLake(two, 10);
    expect((two.calls.find((c) => c.op === 'frame')?.args[0] as Frame).density).toBe(2);
  });

  it('draws every ending phase at the tier and drops the 4× backdrops when the flow moves on', () => {
    setArtTier(4);
    const a = app();
    const end = new EndingScene(a, { variant: 'fps' });
    a.scenes.reset(end);
    const r = recorder(8);
    const dense = (): number => r.calls.filter((c) => c.op === 'frame' && ((c.args[0] as Frame).density ?? 1) === 4).length;
    for (const phase of ['captions', 'parade', 'poses'] as const) {
      for (let i = 0; i < 4000 && end.phase !== phase; i++) a.scenes.update();
      r.calls.length = 0;
      end.draw(r as Renderer);
      expect(dense(), phase).toBeGreaterThan(0);
    }
    expect(hasFramesAt(NIGHT_ID, 4)).toBe(true);
    end.exit();
    expect(hasFramesAt(NIGHT_ID, 4)).toBe(false);
    expect(hasFramesAt(BEAM_ID, 4)).toBe(false);
    for (const id of LAKE_ART) expect(hasFramesAt(id, 4), id).toBe(true);
    new FinalTallyScene(a).exit();
    for (const id of LAKE_ART) expect(hasFramesAt(id, 4), id).toBe(false);
  }, 60_000);

  it('corrupts a dense snapshot at the glitch density min(d, 2), with the 1× choices', () => {
    const a = app();
    const from = { update() {}, draw(r: Renderer) { drawLake(r, 0); } };
    for (const [d, g] of [[1, 1], [2, 2], [4, 2]] as const) {
      setArtTier(d);
      const runner = { artDensity: d, hud: { banner: null } } as unknown as MissionRunner;
      const s = new GlitchBridgeScene(a, { from, runner });
      expect(s.snap.density ?? 1).toBe(d);
      expect(s.g).toBe(g);
      for (let i = 0; i < 200 && s.phase !== 'glitch'; i++) s.update();
      for (let i = 0; i < 30; i++) s.update();
      const r = recorder(8);
      s.draw(r);
      if (g === 1) expect(r.count('image')).toBe(1);
      else {
        const f = r.calls.find((c) => c.op === 'frame')?.args[0] as Frame;
        expect([f.density, f.buf.w, f.buf.h]).toEqual([2, 768, 432]);
      }
    }
  }, 60_000);

  it('drops the mission\'s 4× frames when the bridge starts (the snapshot keeps the picture)', () => {
    const a = app();
    setArtTier(4);
    // A mission's tier-4 working set: a hero strip and a backdrop, built at 4× (and at 2×).
    const set = ['char/vincent/legs-idle', 'ui/base/sky'];
    for (const id of set) {
      getFrames(id, 4);
      getFrames(id, 2);
    }
    expect(set.every((id) => hasFramesAt(id, 4))).toBe(true);
    const from = { update() {}, draw(r: Renderer) { drawLake(r, 0); } };
    const s = new GlitchBridgeScene(a, { from });
    const snap = s.snap.buf.data.slice();
    s.enter();
    expect(generatedSprites(4)).toEqual([]);
    expect(denseBytes(4)).toBe(0);
    // The 2× stand-ins stay; the snapshot is untouched.
    expect(set.every((id) => hasFramesAt(id, 2))).toBe(true);
    expect(s.snap.buf.data).toEqual(snap);
  }, 60_000);
});
