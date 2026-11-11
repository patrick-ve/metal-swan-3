/**
 * The canal scenes' engine pieces for the section agents (docs/api/canal.md §7–§10):
 * - canal sprites: every scene's baked sprites sit on the game frame boxes; while section a's scene
 *   draws, the mission runner's frame overlay gives the breakable rack `decor/ams/ams-bike-rack`
 *   (one of a's five canal sprite frames) the kit's painting as frame 0 (the baked tier ≤ the
 *   density asked for), the wreck frame 1 keeps the game's art; the game's geometry and points are
 *   kept; outside the drawing (game logic), with the switch off, or for a failed scene, the game's
 *   frames; nothing of the overlay reaches the sprite registry (generators, dense bytes, packs); a
 *   baked frame whose geometry differs from the game's is refused with one warning;
 * - nothing old is built for a canal section: `canalPaintedArt` (the decor that the six scenes
 *   paint, never a canal sprite id an entity still draws) is left out of the scripts' `prewarm`, the boot's 1× preload (`bootSkip`) and the
 *   2× mission preload; with the scene off, or in ams2 (the same scripts), all of it is built;
 * - a gull on a kit lamp (`gullOnLamp`, `CanalDef.depth`): drawn at the lamp's depth while it sits
 *   there, easing to 0 over its take-off, only while the scene draws; its hitbox is unchanged;
 * - offline: an async source whose files cannot be fetched starts the section on its old scenery
 *   with one warning.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { SoftRenderer } from '../../src/engine/render-soft';
import { frameH, frameW, type Frame } from '../../src/engine/render';
import {
  clearSpriteCache,
  defineSprite,
  denseBytes,
  generatedSprites,
  getFrames,
  hasFramesAt,
  readyFrames,
  setArtTier,
  setDeferHiArt,
  setFrameOverlay,
  setHiArt,
  withArtDensity,
} from '../../src/engine/sprites';
import { Terrain } from '../../src/engine/terrain';
import type { ArtPool } from '../../src/engine/art-pool';
import { gullOnLamp, KIT_LAMP_DEPTH, LAMP_GULLS, LAMP_PERCH_Y } from '../../src/game/content/missions/ams/canal/index';
import { CANAL_MANIFEST } from '../../src/game/content/missions/ams/canal/manifest.gen';
import { prewarm } from '../../src/game/content/missions/ams/helpers';
import { isAms2Content, isLazyContent, loadContent } from '../../src/game/content/index';
import {
  canalIdle,
  canalPaintedArt,
  canalState,
  drawnArt,
  CanalSprites,
  defineCanalManifest,
  resetCanalStore,
  setCanal,
  setCanalPaintedNow,
  setCanalSource,
  wantCanal,
  type CanalSource,
} from '../../src/game/mission/canal/index';
import type { SectionDef } from '../../src/game/mission/types';
import { SectionView } from '../../src/game/mission/view';
import { getMission } from '../../src/game/registry';
import { bootSkip } from '../../src/game/scenes/boot';
import { preloadMissionArt, resetMissionArt } from '../../src/game/scenes/gameplay';
import { createHeadlessGame } from '../../src/sim/index';
import { nodeCanalSource } from '../../tools/lib/canal-source';

const RACK = 'decor/ams/ams-bike-rack';

function section(m: string, id: string): SectionDef {
  const def = getMission(m)?.sections[id];
  if (!def) throw new Error(`no ${m} section ${id}`);
  return def;
}

/** A view of ams a with its scene loaded at camera x for density d (sync source). */
function viewA(d: number, camX = 600, def = section('ams', 'a')): SectionView {
  setArtTier(d);
  const view = new SectionView(def, new Terrain(def.terrain), 7, 4);
  const r = new SoftRenderer(384, 216, undefined, { res: d });
  r.setCamera(camX, 0);
  view.prepare(camX, 0);
  r.begin();
  view.drawBack(r, 0);
  r.end();
  return view;
}

beforeAll(async () => {
  await loadContent((id) => !isLazyContent(id) || isAms2Content(id));
  setHiArt(true);
  setDeferHiArt(false);
});

afterEach(() => {
  setFrameOverlay(null);
  setCanal(true);
  setCanalSource(null);
  setCanalPaintedNow(null);
  resetCanalStore();
  resetMissionArt();
  setArtTier(2);
  defineCanalManifest('ams', CANAL_MANIFEST);
});

describe('canal sprites (§7)', () => {
  it('every scene bakes its canal sprites on the game frame boxes; section a has the rack, frame 0', () => {
    const a = CANAL_MANIFEST.sections.a;
    expect(a.sprites?.map((s) => `${s.id}#${s.frame}`)).toContain(`${RACK}#0`);
    for (const sec of Object.values(CANAL_MANIFEST.sections)) {
      for (const s of sec.sprites ?? []) {
        const f = getFrames(s.id, 1)[s.frame];
        expect(f, `${sec.id} ${s.id}#${s.frame}`).toBeTruthy();
        expect(s, `${sec.id} ${s.id}#${s.frame}`).toMatchObject({ w: frameW(f), h: frameH(f), ox: f.ox, oy: f.oy });
      }
      if (sec.sprites?.length) for (const t of ['1', '2', '4']) expect(sec.tiers[t]?.sprites?.file).toBe(`${sec.id}-u${t}-s.png`);
    }
  });

  for (const d of [1, 2, 4]) {
    it(`at density ${d} the overlay draws the kit's rack for frame 0 and the game's wreck for frame 1`, () => {
      setCanalSource(nodeCanalSource());
      const base = withArtDensity(d, () => getFrames(RACK));
      const bytes = denseBytes(4);
      const view = viewA(d);
      const ov = view.canal?.sprites;
      expect(ov).toBeTruthy();
      // The overlay holds exactly the ids the manifest lists for section a (the rack among them).
      expect(ov?.ids()).toContain(RACK);
      expect(ov?.ids().sort()).toEqual([...new Set((CANAL_MANIFEST.sections.a.sprites ?? []).map((s) => s.id))].sort());
      const was = setFrameOverlay(ov ?? null);
      let got: readonly Frame[];
      try {
        got = getFrames(RACK, d);
        // Cached: the same strip while nothing changes (no allocation per draw).
        expect(getFrames(RACK, d)).toBe(got);
      } finally {
        setFrameOverlay(was);
      }
      expect(got).toHaveLength(base.length);
      // Frame 0: the baked painting at tier d, the game's logical geometry.
      expect(got[0]).not.toBe(base[0]);
      expect(got[0].density ?? 1).toBe(d);
      expect([frameW(got[0]), frameH(got[0]), got[0].ox, got[0].oy]).toEqual([frameW(base[0]), frameH(base[0]), base[0].ox, base[0].oy]);
      expect(got[0].pts).toEqual(base[0].pts);
      // Frame 1 (the wreck): the game's own frame object.
      expect(got[1]).toBe(base[1]);
      // Outside the overlay: the game's frames; the registry never saw the baked buffers.
      expect(getFrames(RACK, d)).toBe(base);
      expect(readyFrames(RACK, 1)?.[0]).not.toBe(got[0]);
      expect(generatedSprites(1, RACK)).toEqual([RACK]);
      expect(denseBytes(4)).toBe(bytes);
      view.dispose();
    });
  }

  it('a baked tier above the density asked for is never used; a lower loaded one stands in', () => {
    setCanalSource(nodeCanalSource());
    const view = viewA(1);
    const ov = view.canal?.sprites as CanalSprites;
    const base4 = withArtDensity(4, () => getFrames(RACK));
    const got = ov.frames(RACK, 4, base4);
    // Only tier 1 is loaded (the view drew at density 1): the 1× painting stands in at density 4.
    expect(got[0].density ?? 1).toBe(1);
    expect(got[1]).toBe(base4[1]);
    view.dispose();
  });

  it('the runner sets the overlay around its drawing only; a failed scene and the switch off draw the game frames', async () => {
    setCanalSource(nodeCanalSource());
    setArtTier(2);
    const g = await createHeadlessGame({ missionId: 'ams', sectionId: 'a', seed: 7, god: true, loadContent: false, res: 2 });
    try {
      g.step(5);
      const run = g.runner;
      expect(run?.view.canalLive?.sprites).toBeTruthy();
      // Game logic sees the game's frames (the overlay is set by draw() only).
      const before = getFrames(RACK, 2);
      g.renderFrame();
      expect(getFrames(RACK, 2)).toBe(before);
      const ov = run?.view.canalLive?.sprites as CanalSprites;
      expect(ov.frames(RACK, 2, before)[0]).not.toBe(before[0]);
      // A failed scene: the overlay gives the game's frames.
      (run?.view.canal as { state: { failed: boolean } }).state.failed = true;
      expect(ov.frames(RACK, 2, before)).toBe(before);
    } finally {
      g.dispose();
    }
    // The switch off: no scene, no overlay.
    setCanal(false);
    const g2 = await createHeadlessGame({ missionId: 'ams', sectionId: 'a', seed: 7, god: true, loadContent: false });
    try {
      g2.step(5);
      expect(g2.runner?.view.canal).toBeNull();
    } finally {
      g2.dispose();
    }
  });

  it('a generator run while the overlay is set builds from the game frames', () => {
    setCanalSource(nodeCanalSource());
    defineSprite('test/canal-derived', () => getFrames(RACK, 1)[0].buf.clone());
    const view = viewA(1);
    const was = setFrameOverlay(view.canal?.sprites ?? null);
    try {
      clearSpriteCache('test/canal-derived');
      const made = getFrames('test/canal-derived', 1)[0].buf;
      expect([...made.data]).toEqual([...(readyFrames(RACK, 1) as readonly Frame[])[0].buf.data]);
    } finally {
      setFrameOverlay(was);
      view.dispose();
    }
  });

  it('a baked frame whose geometry differs from the game frame is refused (game art, one warning)', () => {
    const a = CANAL_MANIFEST.sections.a;
    const wrong = { ...a, sprites: (a.sprites ?? []).map((s) => ({ ...s, ox: s.ox + 1 })) };
    defineCanalManifest('ams', { ...CANAL_MANIFEST, sections: { ...CANAL_MANIFEST.sections, a: wrong } });
    setCanalSource(nodeCanalSource());
    setArtTier(1);
    const st = canalState('ams/a');
    if (!st) throw new Error('no scene');
    wantCanal(st, 1, 600);
    const ov = CanalSprites.of(st) as CanalSprites;
    const base = getFrames(RACK, 1);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      expect(ov.frames(RACK, 1, base)).toBe(base);
      expect(ov.frames(RACK, 1, base)).toBe(base);
      expect(warn.mock.calls.filter((c) => String(c[0]).startsWith('[canal]')).length).toBe(1);
    } finally {
      warn.mockRestore();
    }
  });
});

describe('nothing old is built for a canal section (§8)', () => {
  it('canalPaintedArt: the decor the six scenes paint, never an entity, canal or secret sprite; a section without a live scene keeps its decor; empty when off and in ams2', () => {
    const ams = getMission('ams')?.sections ?? {};
    expect(canalPaintedArt(ams).size).toBe(0); // no source
    setCanalSource(nodeCanalSource());
    const painted = canalPaintedArt(ams);
    expect(painted.has('decor/ams/house-morning')).toBe(true);
    expect(painted.has('decor/ams/drawbridge')).toBe(true);
    // Every ams section draws its elms and lamps through its scene now: nobody builds the old ones.
    expect(painted.has('decor/ams/elm')).toBe(true);
    expect(painted.has('decor/ams/lamp')).toBe(true);
    expect(painted.has(RACK)).toBe(false);
    expect(painted.has('decor/ams/ams-tulip-stall')).toBe(false);
    // A scene's canal sprites stay built (entities draw them; their unlisted frames, a wreck, are the game's art).
    for (const sec of Object.values(CANAL_MANIFEST.sections)) for (const s of sec.sprites ?? []) expect(painted.has(s.id), s.id).toBe(false);
    expect(painted.has('decor/ams/hotdog-front')).toBe(false);
    // Nothing a section still draws (its drawnArt) is left out; every decor id not drawn is.
    const drawn = Object.values(ams).flatMap((def) => [...drawnArt(def)]);
    for (const id of painted) expect(drawn.some((p) => id.startsWith(p)), id).toBe(false);
    const sprites = new Set(Object.values(CANAL_MANIFEST.sections).flatMap((sec) => (sec.sprites ?? []).map((s) => s.id)));
    for (const def of Object.values(ams)) {
      for (const d of def.decor ?? []) if (!sprites.has(d.sprite) && !drawn.some((p) => d.sprite.startsWith(p))) expect(painted.has(d.sprite), d.sprite).toBe(true);
    }
    // A section without a live scene (here b without its opt-in) keeps every decor id it lists.
    const b = ams.b;
    const bOff = canalPaintedArt({ ...ams, b: { ...b, canal: undefined } });
    for (const d of b.decor ?? []) expect(bOff.has(d.sprite), d.sprite).toBe(false);
    expect(bOff.has('decor/ams/elm')).toBe(false);
    expect(canalPaintedArt(getMission('ams2')?.sections).size).toBe(0);
    setCanal(false);
    expect(canalPaintedArt(ams).size).toBe(0);
  });

  it("the section start: prewarm skips the painted ids with the scene on, builds them with it off and in ams2", async () => {
    setCanalSource(nodeCanalSource());
    const painted = [...canalPaintedArt(getMission('ams')?.sections)];
    expect(painted.length).toBeGreaterThan(3);
    const run = async (mission: string): Promise<number> => {
      clearSpriteCache();
      const g = await createHeadlessGame({ missionId: mission, sectionId: 'a', seed: 7, god: true, loadContent: false });
      try {
        g.step(3);
      } finally {
        g.dispose();
      }
      return painted.filter((id) => hasFramesAt(id, 1)).length;
    };
    expect(await run('ams')).toBe(0);
    expect(await run('ams2')).toBe(painted.length);
    setCanal(false);
    expect(await run('ams')).toBe(painted.length);
    // The helper itself (the scripts call it before the first frame).
    clearSpriteCache();
    setCanal(true);
    setCanalPaintedNow(new Set(painted));
    prewarm('decor/ams/');
    expect(painted.filter((id) => hasFramesAt(id, 1))).toEqual([]);
    expect(hasFramesAt(RACK, 1)).toBe(true);
  });

  it("the boot's 1× preload and the 2× mission preload leave the painted ids out (scene on) and keep them (off)", async () => {
    expect(bootSkip({ mission: 'ams' }).size).toBe(0);
    setCanalSource(nodeCanalSource());
    const painted = canalPaintedArt(getMission('ams')?.sections);
    expect([...bootSkip({ mission: 'ams' })]).toEqual([...painted]);
    expect(bootSkip({ mission: 'ams2' }).size).toBe(0);
    const built = async (): Promise<string[]> => {
      const log: string[] = [];
      const pool = { build: async (ids: readonly string[]) => void log.push(...ids), close: () => {} } as unknown as ArtPool;
      resetMissionArt(() => pool);
      setArtTier(2);
      const mission = getMission('ams');
      preloadMissionArt({ preloadArt: true, session: null }, mission, 4, null);
      await new Promise((r) => setTimeout(r, 0));
      resetMissionArt();
      return log;
    };
    clearSpriteCache();
    const on = await built();
    expect(on.length).toBeGreaterThan(100);
    expect(on.filter((id) => painted.has(id))).toEqual([]);
    setCanal(false);
    clearSpriteCache();
    const off = await built();
    const hi = [...painted].filter((id) => off.includes(id));
    expect(hi.length).toBeGreaterThan(0);
  });
});

describe('a gull on a kit lamp (§9)', () => {
  it('draws at the lamp depth while perched (only with the scene and the rule), eases to 0 over its take-off; the hitbox never moves', async () => {
    setCanalSource(nodeCanalSource());
    setArtTier(1);
    const g = await createHeadlessGame({ missionId: 'ams', sectionId: 'a', seed: 7, god: true, loadContent: false });
    try {
      g.step(2);
      const w = g.world;
      if (!w) throw new Error('no world');
      // The gull asleep on the lamp at x 470 (section a's script: `at(ctx, 'seagull', 470, { perch: true }, LAMP_TOP)`).
      const gull = w.entities.find((e) => e.type === 'seagull' && Math.abs(e.x - 470) < 1) as (typeof w.entities)[number] & { spawnPerch: number; spawnPerchY: number };
      expect(gull).toBeTruthy();
      expect(gull.spawnPerchY).toBe(LAMP_PERCH_Y);
      expect(gull.spawnPerch).toBe(1);
      expect(gullOnLamp()(gull)).toBe(KIT_LAMP_DEPTH);
      expect(gullOnLamp(LAMP_PERCH_Y - 14)(gull)).toBe(0);
      const a = section('ams', 'a');
      const r = new SoftRenderer();
      const shadows = (def: SectionDef, fail = false): number => {
        const view = new SectionView(def, new Terrain(def.terrain), 7, 1);
        if (fail && view.canal) (view.canal.state as { failed: boolean }).failed = true;
        r.begin(0);
        r.setCamera(w.camera.viewX, w.camera.viewY);
        view.drawShadows(r, w);
        view.dispose();
        return gull.drawDepth;
      };
      const box = { ...gull.hitbox };
      // The scene's rule on: the lamp depth; without the rule, or with the scene off: 0.
      const withRule: SectionDef = { ...a, canal: { ...(a.canal ?? { scene: 'ams/a' }), depth: LAMP_GULLS } };
      expect(shadows(withRule)).toBe(KIT_LAMP_DEPTH);
      gull.drawDepth = 0;
      // The scene without a depth rule: 0. Section a's own rule (kerbside lamps and bridge 2's lantern): the lamp depth.
      expect(shadows({ ...a, canal: { scene: 'ams/a' } })).toBe(0);
      expect(shadows(a)).toBe(KIT_LAMP_DEPTH);
      gull.drawDepth = 0;
      // A scene that failed (its file is missing): the rule gives 0 again.
      expect(shadows(withRule)).toBe(KIT_LAMP_DEPTH);
      expect(shadows(withRule, true)).toBe(0);
      // The switch off: no scene, the rule is never registered (the gull keeps depth 0).
      gull.drawDepth = 0;
      setCanal(false);
      expect(shadows(withRule)).toBe(0);
      setCanal(true);
      expect(gull.hitbox).toEqual(box);
      // Take-off: from 1 down to 0 over the strip, then 0 for good.
      (gull as unknown as { takeOff: () => void }).takeOff();
      const seen: number[] = [];
      for (let t = 0; t < 14; t++) {
        seen.push(gull.spawnPerch);
        g.step(1);
      }
      expect(seen[0]).toBeGreaterThan(0.8);
      for (let i = 1; i < seen.length; i++) expect(seen[i]).toBeLessThanOrEqual(seen[i - 1]);
      expect(seen.at(-1)).toBe(0);
      expect(shadows(withRule)).toBe(0);
    } finally {
      g.dispose();
    }
  });
});

describe('offline (§10)', () => {
  it('files that cannot be fetched: the section starts on its old scenery, one warning', async () => {
    setArtTier(1);
    const a = section('ams', 'a');
    const draw = (view: SectionView): Uint32Array => {
      const r = new SoftRenderer(384, 216, undefined, { res: 1 });
      r.setCamera(0, 0);
      r.begin();
      view.drawBack(r, 0);
      view.drawFront(r, 0);
      r.end();
      return r.target.data.slice();
    };
    const plain = new SectionView(a, new Terrain(a.terrain), 7, 4);
    plain.prepare(0, 0);
    const old = draw(plain);
    plain.dispose();
    // The browser's source offline (service worker without a cached copy): every fetch rejects.
    const offline: CanalSource = { read: async (p) => Promise.reject(new TypeError(`Failed to fetch ${p}`)) };
    setCanalSource(offline);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const view = new SectionView(a, new Terrain(a.terrain), 7, 4);
      view.prepare(0, 0);
      await canalIdle();
      expect(view.canal?.failed).toBe(true);
      expect(view.canalLive).toBeNull();
      const now = draw(view);
      expect(now.every((v, i) => v === old[i])).toBe(true);
      view.dispose();
      expect(warn.mock.calls.filter((c) => String(c[0]).startsWith('[canal]')).length).toBe(1);
    } finally {
      warn.mockRestore();
    }
  });
});
