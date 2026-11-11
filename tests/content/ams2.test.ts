/**
 * Mission `ams2` (docs/design/ams2.md, docs/design/ams2-contract.md): the same level as `ams` with new
 * scenery, stand-alone, and the post rule: an Amsterdammertje stands on kerbstones, nowhere else.
 */
import { describe, expect, it } from 'vitest';
import { getFrames, setSpriteOverrides, hasSprite, withArtDensity } from '../../src/engine/sprites';
import { checkPostFoot, PostOnWrongGround } from '../../src/game/art/herokit/floors';
import { R } from '../../src/game/art/herokit/palette';
import '../../src/game/content/index';
import { AMS } from '../../src/game/content/missions/ams/index';
import { AMS2 } from '../../src/game/content/missions/ams2/index';
import { type FloorPlan, B1, B2, defineFloor, FLOORS, FLOOR_W, kerbPosts, keepClear, NEAR_FOOT, paintFloorBand, postRow, S_BACK, S_NEAR, TILE_W, waterCut } from '../../src/game/content/missions/ams2/stage';
import type { DecorDef } from '../../src/game/mission/types';
import { listMissions } from '../../src/game/registry';
import { FPS_ROUTE } from '../../src/game/scenes/flow-data';
import { isAms2Content, isLazyContent } from '../../src/game/content/index';
import { createHeadlessGame } from '../../src/sim/index';

const SECTIONS = ['a', 'b', 'c', 'c1', 'c2', 'd'];

describe('ams2: the same level', () => {
  it('has the sections of ams, each with the same play', () => {
    expect(Object.keys(AMS2.sections).sort()).toEqual(Object.keys(AMS.sections).sort());
    for (const id of SECTIONS) {
      const a = AMS.sections[id];
      const b = AMS2.sections[id];
      expect(b.script, id).toBe(a.script);
      expect(b.terrain, id).toBe(a.terrain);
      expect(b.exits, id).toBe(a.exits);
      expect(b.playerStart, id).toBe(a.playerStart);
      expect(b.checkpoints, id).toBe(a.checkpoints);
      expect(b.respawn, id).toBe(a.respawn);
      expect(b.timeLimit, id).toBe(a.timeLimit);
      expect(b.width, id).toBe(a.width);
      expect(b.bossStart, id).toBe(a.bossStart);
    }
  });

  it('has no mesh floor and a painted one, and every decor sprite exists', () => {
    for (const id of SECTIONS) {
      const s = AMS2.sections[id];
      expect(s.floor, id).toBeUndefined();
      expect(s.paintedFloor, id).toBe('all');
      for (const d of s.decor ?? []) expect(hasSprite(d.sprite), `${id}: ${d.sprite}`).toBe(true);
    }
  });

  it('leaves ams alone', () => {
    for (const id of SECTIONS) {
      expect(AMS.sections[id].floor, id).toBeDefined();
      expect(AMS.sections[id].paintedFloor, id).toBeUndefined();
      expect(AMS.sections[id].spriteOverrides, id).toBeUndefined();
    }
    expect(AMS.standalone).toBeUndefined();
    expect(AMS.seedAs).toBeUndefined();
  });
});

describe('ams2: stand-alone', () => {
  it('is lazy, on no route, with no next mission', () => {
    expect(isLazyContent('missions/ams2')).toBe(true);
    expect(isAms2Content('missions/ams2')).toBe(true);
    expect(FPS_ROUTE).not.toContain('ams2');
    expect(AMS2.next).toBeUndefined();
    expect(AMS2.standalone).toBe(true);
    expect(AMS.next).not.toBe('ams2');
    expect(listMissions()).toContain('ams2');
  });

  it('is nobody\'s implicit next mission, and has none itself', async () => {
    const g = await createHeadlessGame({ missionId: 'ams2', sectionId: 'a', seed: 1, players: 1, god: true, bot: false });
    g.step(1);
    expect(g.runner?.nextMission()).toBeNull();
    g.dispose();
    const h = await createHeadlessGame({ missionId: 'ams', sectionId: 'a', seed: 1, players: 1, god: true, bot: false });
    h.step(1);
    expect(h.runner?.nextMission()).not.toBe('ams2');
    h.dispose();
  });
});

describe('ams2: the same sim', () => {
  for (const section of SECTIONS) {
    it(`section ${section}: the bot completes it, and plays both the same at the same seed`, async () => {
      const play = async (missionId: string): Promise<Record<string, unknown>> => {
        const g = await createHeadlessGame({ missionId, sectionId: section, seed: 7, players: 1, god: true, bot: { route: 'lower' } });
        for (let i = 0; i < 60 && !g.missionComplete; i++) g.step(600);
        const r = g.report() as unknown as Record<string, unknown>;
        const { timing: _t, mission: _m, ...same } = r;
        const px = g.player(0)?.x;
        g.dispose();
        return { ...same, px };
      };
      const got = await play('ams2');
      expect(got.missionComplete, section).toBe(true);
      expect(got.bossDefeated, section).toBe(true);
      expect(got.errors, section).toEqual([]);
      expect(got).toEqual(await play('ams'));
    }, 60_000);
  }

  for (const [route, via] of [['lower', 'c2'], ['upper', 'c1']] as const) {
    it(`the ${route} route: the bot goes from a by ${via} to d and finishes, as in ams`, async () => {
      const play = async (missionId: string): Promise<Record<string, unknown>> => {
        const g = await createHeadlessGame({ missionId, seed: 7, players: 1, god: true, bot: { route } });
        for (let i = 0; i < 60 && !g.missionComplete; i++) g.step(600);
        const { timing: _t, mission: _m, ...same } = g.report() as unknown as Record<string, unknown>;
        g.dispose();
        return same;
      };
      const got = await play('ams2');
      expect(got.sectionsVisited).toEqual(['a', 'b', 'c', via, 'd']);
      expect(got.missionComplete).toBe(true);
      expect(got.errors).toEqual([]);
      expect(got).toEqual(await play('ams'));
    }, 60_000);
  }
});

describe('the post rule', () => {
  /** The floor tile under band x p of a band's speed in this decor list, and the x in its canvas. */
  function groundOf(decor: readonly DecorDef[], speed: number, p: number): { plan: FloorPlan; cx: number; band: 'far' | 'near' } | null {
    for (const plan of FLOORS) {
      const band = speed === S_BACK ? plan.far : plan.near;
      for (const d of decor) {
        if (d.sprite !== band.id || d.x > p || d.x + TILE_W <= p) continue;
        return { plan, cx: (d.frame ?? 0) * TILE_W + p - d.x, band: speed === S_BACK ? 'far' : 'near' };
      }
    }
    return null;
  }

  it('every post of every section stands on painted kerbstones, off the water', () => {
    let count = 0;
    for (const id of SECTIONS) {
      const decor = AMS2.sections[id].decor ?? [];
      const posts = decor.filter((d) => /\/post(-far)?$/.test(d.sprite));
      for (const d of posts) {
        const where = `section ${id} post at band x ${d.x}`;
        expect(d.parallax === S_BACK || d.parallax === S_NEAR, `${where}: on a kerbed band`).toBe(true);
        const foot = d.y - 2;
        const w = getFrames(d.sprite, 1)[0].buf.w;
        for (const p of [d.x + 1, d.x + w - 2]) {
          const g = groundOf(decor, d.parallax as number, p);
          expect(g, `${where}: on a floor`).not.toBeNull();
          if (!g) continue;
          const canvas = paintFloorBand(g.plan.spec, g.band);
          expect(R.kerb, `${where}: x ${p} y ${foot}`).toContain(canvas.c[foot * canvas.w + g.cx]);
          for (const [x0, x1] of g.plan.cuts) {
            const s = d.parallax as number;
            const a = Math.round(192 + (x0 - 192) * s);
            const b = Math.round(192 + (x1 - 192) * s);
            expect(p >= a && p <= b, `${where}: in the water`).toBe(false);
          }
        }
        count++;
      }
    }
    expect(count).toBeGreaterThan(40);
  });

  const plan = defineFloor({ light: 'noon', name: 'test/post-rule', seed: 5 });
  const canvas = paintFloorBand(plan.spec, 'near');

  it('kerbPosts refuses the bike lane, the road and a band without a kerb', () => {
    expect(() => kerbPosts(plan, 'noon', 'near', [50], B2 + 8)).toThrow(PostOnWrongGround);
    expect(() => kerbPosts(plan, 'noon', 'near', [50], B2 - 4)).toThrow(PostOnWrongGround);
    expect(() => kerbPosts(plan, 'noon', 'far', [50], B1 + 4)).toThrow(PostOnWrongGround);
    const water = defineFloor({ light: 'noon', name: 'test/post-water', seed: 6, near: 'water' });
    expect(() => kerbPosts(water, 'noon', 'near', [50])).toThrow(PostOnWrongGround);
  });

  it('kerbPosts refuses a water cut, postRow skips it and a clear span', () => {
    const wet = defineFloor({ light: 'noon', name: 'test/post-cut', seed: 7 });
    waterCut(wet, 'noon', 'cut', 400, 600);
    const inWater = Math.round(192 + (500 - 192) * S_NEAR);
    expect(() => kerbPosts(wet, 'noon', 'near', [inWater])).toThrow(PostOnWrongGround);
    expect(postRow(wet, 'near', inWater, 1000, 1000)).toEqual([]);
    const dry = defineFloor({ light: 'noon', name: 'test/post-clear', seed: 8 });
    const free = postRow(dry, 'far', 300, 40, 1200).length;
    keepClear(dry, 500, 700);
    expect(postRow(dry, 'far', 300, 40, 1200).length).toBeLessThan(free);
  });

  it('kerbPosts accepts a kerbstone, and the painted row is one', () => {
    expect(kerbPosts(plan, 'noon', 'near', [50]).length).toBe(1);
    expect(() => checkPostFoot(canvas, 50, 9, NEAR_FOOT, 'test')).not.toThrow();
    expect(() => checkPostFoot(canvas, 50, 9, B2 + 8, 'test')).toThrow(PostOnWrongGround);
    expect(canvas.w).toBe(FLOOR_W);
  });
});

describe('the sprite override', () => {
  const SHARED = 'decor/ams/ams-bike-rack';

  it('shows the twin only while a section with the map draws', async () => {
    const g = await createHeadlessGame({ missionId: 'ams2', sectionId: 'a', seed: 1, players: 1, god: true, bot: false });
    g.step(1);
    const over = g.runner?.section.spriteOverrides;
    expect(over?.get(SHARED)).toBeDefined();
    const shared = getFrames(SHARED, 1);
    const twin = getFrames(over?.get(SHARED) as string, 1);
    const was = setSpriteOverrides(over ?? null);
    expect(withArtDensity(1, () => getFrames(SHARED))).toBe(twin);
    setSpriteOverrides(was);
    expect(getFrames(SHARED, 1)).toBe(shared);
    // Same frames, same anchor rule: frame 0 whole, frame 1 wrecked, the feet in the middle of the box.
    expect(twin.length).toBe(shared.length);
    expect(twin[0].oy).toBe(twin[0].buf.h);
    expect(twin[0].ox).toBe(twin[0].buf.w >> 1);
    g.renderFrame();
    expect(getFrames(SHARED, 1)).toBe(shared);
    g.dispose();
  });

  it('the override is on the section, ams has none', () => {
    expect(AMS.sections.a.spriteOverrides).toBeUndefined();
    expect(AMS2.sections.a.art).toContain(AMS2.sections.a.spriteOverrides?.get(SHARED));
  });
});

describe('the tiers', () => {
  it('a kit sprite has the same logical size and anchor at every tier', () => {
    const id = (AMS2.sections.a.decor ?? []).find((d) => /\/bench$/.test(d.sprite))?.sprite as string;
    const a = getFrames(id, 1)[0];
    for (const u of [2, 4] as const) {
      const f = getFrames(id, u)[0];
      expect([f.buf.w, f.buf.h]).toEqual([a.buf.w * u, a.buf.h * u]);
      expect([f.ox, f.oy]).toEqual([a.ox, a.oy]);
    }
  });
});
