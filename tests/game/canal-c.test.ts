/**
 * Sections c (Amstel) and c1 (Brug) of `ams` in their canal scenes (tmp/l1/port/SECTION-PORT.md):
 * the entities the kit paints become canal sprites (docs/api/canal.md §7) — in c the two rowing
 * boats (both wake frames), the herring cart and the market stall (frame 0, intact; the wrecks keep
 * the game's art), in c1 the tour boats (both wake frames; the turn strip keeps the game's art) —
 * and the scenes' gull rules (§9): c's lamp at 520 stands on the quay-head square at depth 0 (its
 * gull too), the one at 2000 is kerbside (7.5); c1's lamp at 920 is kerbside.
 */
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { frameH, frameW } from '../../src/engine/render';
import { getFrames, setArtTier, setDeferHiArt, setFrameOverlay, setHiArt, withArtDensity } from '../../src/engine/sprites';
import { Terrain } from '../../src/engine/terrain';
import type { Entity } from '../../src/engine/entity';
import { SoftRenderer } from '../../src/engine/render-soft';
import { KIT_LAMP_DEPTH, LAMP_PERCH_Y } from '../../src/game/content/missions/ams/canal/index';
import { CANAL_MANIFEST } from '../../src/game/content/missions/ams/canal/manifest.gen';
import { ROOF_Y } from '../../src/game/content/missions/ams/terrain';
import { isAms2Content, isLazyContent, loadContent } from '../../src/game/content/index';
import { resetCanalStore, setCanal, setCanalSource } from '../../src/game/mission/canal/index';
import type { SectionDef } from '../../src/game/mission/types';
import { SectionView } from '../../src/game/mission/view';
import { getMission } from '../../src/game/registry';
import { nodeCanalSource } from '../../tools/lib/canal-source';

const PAINTED: Readonly<Record<string, Readonly<Record<string, readonly number[]>>>> = {
  c: {
    'decor/ams/ams-boat-platform': [0, 1],
    'decor/ams/ams-herring-cart': [0],
    'decor/ams/ams-market-stall': [0],
  },
  c1: { 'npc/ams/ams-tour-boat': [0, 1] },
};
/** A camera where each section's sprite sheet is loaded (it loads with the tier). */
const CAM: Readonly<Record<string, number>> = { c: 1400, c1: 100 };

function section(id: string): SectionDef {
  const def = getMission('ams')?.sections[id];
  if (!def) throw new Error(`no ams ${id}`);
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

for (const id of ['c', 'c1']) {
  describe(`ams ${id}: canal sprites`, () => {
    it('opts in to its scene', () => {
      expect(section(id).canal?.scene).toBe(`ams/${id}`);
    });

    it('bakes the kit paintings on the game frame boxes', () => {
      const m = CANAL_MANIFEST.sections[id];
      const want = Object.entries(PAINTED[id]).flatMap(([sid, fs]) => fs.map((f) => `${sid}#${f}`));
      expect(m?.sprites?.map((s) => `${s.id}#${s.frame}`)).toEqual(want);
      for (const s of m?.sprites ?? []) {
        const f = getFrames(s.id, 1)[s.frame];
        expect([s.w, s.h, s.ox, s.oy]).toEqual([frameW(f), frameH(f), f.ox, f.oy]);
      }
      for (const t of ['1', '2', '4']) expect(m?.tiers[t]?.sprites?.file).toBe(`${id}-u${t}-s.png`);
    });

    for (const d of [1, 2, 4]) {
      it(`at density ${d} the painted frames come from the scene, the others from the game`, () => {
        setCanalSource(nodeCanalSource());
        setArtTier(d);
        const def = section(id);
        const view = new SectionView(def, new Terrain(def.terrain), 7, 4);
        const r = new SoftRenderer(384, 216, undefined, { res: d });
        r.setCamera(CAM[id], 0);
        view.prepare(CAM[id], 0);
        r.begin();
        view.drawBack(r, 0);
        r.end();
        const ov = view.canal?.sprites;
        expect(ov?.ids().slice().sort()).toEqual(Object.keys(PAINTED[id]));
        for (const [sid, fs] of Object.entries(PAINTED[id])) {
          const base = withArtDensity(d, () => getFrames(sid));
          const was = setFrameOverlay(ov ?? null);
          let got: ReturnType<typeof getFrames>;
          try {
            got = getFrames(sid, d);
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
}

describe('ams c / c1: the gull rules', () => {
  const gull = (x: number, perchY: number | undefined, perch = 1): Entity =>
    ({ type: 'seagull', x, spawnPerchY: perchY, spawnPerch: perch }) as unknown as Entity;

  it('c: the square lamp (520) at 0, the kerbside lamp (2000) at 7.5, the roof gulls at 0', () => {
    const rule = section('c').canal?.depth?.seagull;
    expect(rule).toBeTruthy();
    if (!rule) return;
    expect(rule(gull(520, LAMP_PERCH_Y))).toBe(0);
    expect(rule(gull(2000, LAMP_PERCH_Y))).toBe(KIT_LAMP_DEPTH);
    expect(rule(gull(2000, LAMP_PERCH_Y, 0.5))).toBe(KIT_LAMP_DEPTH / 2);
    expect(rule(gull(1030, ROOF_Y))).toBe(0);
    expect(rule(gull(1290, ROOF_Y))).toBe(0);
    expect(rule(gull(1150, undefined))).toBe(0);
  });

  it('c1: the kerbside lamp (920) at 7.5, every other gull at 0', () => {
    const rule = section('c1').canal?.depth?.seagull;
    expect(rule).toBeTruthy();
    if (!rule) return;
    expect(rule(gull(920, LAMP_PERCH_Y))).toBe(KIT_LAMP_DEPTH);
    expect(rule(gull(260, undefined))).toBe(0);
  });
});
