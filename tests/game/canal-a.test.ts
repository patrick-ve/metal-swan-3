/**
 * Section a of `ams` in its canal scene (tmp/l1/port/SECTION-PORT.md): the entities the kit paints
 * become canal sprites (docs/api/canal.md §7) — the breakable rack, the tulip stall, the herring
 * cart (frame 0, intact; the wrecks keep the game's art) and the moving boat (both wake frames) —
 * and the scene's gull rule (§9) puts the perched gulls on their kit lamps: the kerbside lamps at
 * depth 7.5 and the lantern on bridge 2's far parapet (depth 5) under the gull at x 2730.
 */
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { frameH, frameW } from '../../src/engine/render';
import { getFrames, setArtTier, setDeferHiArt, setFrameOverlay, setHiArt, withArtDensity } from '../../src/engine/sprites';
import { Terrain } from '../../src/engine/terrain';
import type { Entity } from '../../src/engine/entity';
import { SoftRenderer } from '../../src/engine/render-soft';
import { KIT_LAMP_DEPTH, LAMP_PERCH_Y } from '../../src/game/content/missions/ams/canal/index';
import { CANAL_MANIFEST } from '../../src/game/content/missions/ams/canal/manifest.gen';
import { G } from '../../src/game/content/missions/ams/art';
import { isAms2Content, isLazyContent, loadContent } from '../../src/game/content/index';
import { resetCanalStore, setCanal, setCanalSource } from '../../src/game/mission/canal/index';
import type { SectionDef } from '../../src/game/mission/types';
import { SectionView } from '../../src/game/mission/view';
import { getMission } from '../../src/game/registry';
import { nodeCanalSource } from '../../tools/lib/canal-source';

const PAINTED: Readonly<Record<string, readonly number[]>> = {
  'decor/ams/ams-bike-rack': [0],
  'decor/ams/ams-boat-platform': [0, 1],
  'decor/ams/ams-herring-cart': [0],
  'decor/ams/ams-tulip-stall': [0],
};

function sectionA(): SectionDef {
  const def = getMission('ams')?.sections.a;
  if (!def) throw new Error('no ams a');
  return def;
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
  resetCanalStore();
  setArtTier(2);
});

describe('ams a: canal sprites', () => {
  it('bakes the kit paintings of the rack, the stall, the cart and the boat on the game frame boxes', () => {
    const a = CANAL_MANIFEST.sections.a;
    const want = Object.entries(PAINTED).flatMap(([id, fs]) => fs.map((f) => `${id}#${f}`));
    expect(a.sprites?.map((s) => `${s.id}#${s.frame}`)).toEqual(want);
    for (const s of a.sprites ?? []) {
      const f = getFrames(s.id, 1)[s.frame];
      expect([s.w, s.h, s.ox, s.oy]).toEqual([frameW(f), frameH(f), f.ox, f.oy]);
    }
  });

  for (const d of [1, 2, 4]) {
    it(`at density ${d} the painted frames come from the scene, the wrecks from the game`, () => {
      setCanalSource(nodeCanalSource());
      setArtTier(d);
      const def = sectionA();
      const view = new SectionView(def, new Terrain(def.terrain), 7, 4);
      // The cart and the stall are on the shopping street: a camera there loads the sheet (it loads with the tier).
      const r = new SoftRenderer(384, 216, undefined, { res: d });
      r.setCamera(2100, 0);
      view.prepare(2100, 0);
      r.begin();
      view.drawBack(r, 0);
      r.end();
      const ov = view.canal?.sprites;
      expect(ov?.ids().slice().sort()).toEqual(Object.keys(PAINTED));
      for (const [id, fs] of Object.entries(PAINTED)) {
        const base = withArtDensity(d, () => getFrames(id));
        const was = setFrameOverlay(ov ?? null);
        let got: ReturnType<typeof getFrames>;
        try {
          got = getFrames(id, d);
        } finally {
          setFrameOverlay(was);
        }
        expect(got).toHaveLength(base.length);
        for (let i = 0; i < base.length; i++) {
          if (fs.includes(i)) {
            expect(got[i]).not.toBe(base[i]);
            expect([frameW(got[i]), frameH(got[i]), got[i].ox, got[i].oy]).toEqual([frameW(base[i]), frameH(base[i]), base[i].ox, base[i].oy]);
          } else expect(got[i]).toBe(base[i]);
        }
      }
      view.dispose();
    });
  }
});

describe('ams a: the gull rule', () => {
  const gull = (perchY: number | undefined, perch = 1): Entity => ({ type: 'seagull', spawnPerchY: perchY, spawnPerch: perch }) as unknown as Entity;

  it('kerbside lamps at 7.5, bridge 2 lantern at 5, every other gull at 0', () => {
    const rule = sectionA().canal?.depth?.seagull;
    expect(rule).toBeTruthy();
    if (!rule) return;
    expect(rule(gull(LAMP_PERCH_Y))).toBe(KIT_LAMP_DEPTH);
    // The script's bridge-2 gull: `at(ctx, 'seagull', 2730, { perch: true }, G - 14 - 70)`.
    expect(rule(gull(G - 14 - 70))).toBe(5);
    expect(rule(gull(G - 14 - 70, 0.5))).toBe(2.5);
    expect(rule(gull(undefined))).toBe(0);
    expect(rule(gull(120))).toBe(0);
    expect(rule({ type: 'pigeon' } as unknown as Entity)).toBe(0);
  });
});
