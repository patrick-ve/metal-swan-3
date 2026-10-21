/**
 * Mission oldenzaal, revision 3 (2026-10-21; the user after a play: "I want more zombies as it is
 * very easy to play against them now"; docs/design/oldenzaal.md "Revision 3"): more of the dead at
 * a time, scaled by difficulty and player count — easy stays close to revision 2, normal about
 * twice as many, hard more again, 2P more than 1P — while they stay the slow tanks (numbers.ts) and
 * the street's attack tokens cap how many attack at once.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { loadContent } from '../../src/game/content/index';
import { OZ_F_POSTS } from '../../src/game/content/missions/oldenzaal/script-oz-f';
import { OLDENZAAL_ID, OZ_SECTION } from '../../src/game/content/missions/oldenzaal/ids';
import { CRAWLER, GRUNT, GUNNER, RIFLEMAN } from '../../src/game/content/oldenzaal/zombies/numbers';
import { isZombie, OZ_ZOMBIE_TAG } from '../../src/game/content/oldenzaal/zombies/api';
import { createHeadlessGame } from '../../src/sim/index';

beforeAll(async () => {
  await loadContent();
}, 120_000);

/** Run the god bot through oz-a; the dead spawned there and the most visible on screen at once. */
async function streetA(difficulty: 'easy' | 'normal' | 'hard', players: 1 | 2): Promise<{ spawned: number; screen: number }> {
  const g = await createHeadlessGame({ missionId: OLDENZAAL_ID, seed: 1, players, god: true, bot: true, difficulty, captureConsole: true });
  const seen = new WeakSet<object>();
  let spawned = 0;
  let screen = 0;
  for (let t = 0; t < 12000; t++) {
    g.step(1);
    const w = g.world;
    if (!w || !g.runner) continue;
    if (g.runner.section.id !== OZ_SECTION.a) break;
    let n = 0;
    for (const e of w.byTag(OZ_ZOMBIE_TAG)) {
      if (!isZombie(e)) continue;
      if (!seen.has(e)) {
        seen.add(e);
        spawned++;
      }
      if (e.alive && !e.removed && !e.hidden && w.onScreen(e, 0)) n++;
    }
    screen = Math.max(screen, n);
  }
  expect(g.report().errors).toEqual([]);
  g.dispose();
  return { spawned, screen };
}

describe('oldenzaal revision 3: more of the dead', () => {
  it('oz-a: easy close to revision 2 (34), normal about twice, hard more, 2P more than 1P; twice as many on screen on normal', async () => {
    const easy = await streetA('easy', 1);
    const normal = await streetA('normal', 1);
    const hard = await streetA('hard', 1);
    const normal2 = await streetA('normal', 2);
    expect(easy.spawned).toBeLessThanOrEqual(38);
    expect(normal.spawned).toBeGreaterThanOrEqual(easy.spawned * 2 - 4);
    expect(hard.spawned).toBeGreaterThan(normal.spawned);
    expect(normal2.spawned).toBeGreaterThan(normal.spawned);
    // Revision 2 had at most 5–6 on screen on normal.
    expect(normal.screen).toBeGreaterThanOrEqual(9);
    expect(easy.screen).toBeLessThanOrEqual(5);
  }, 240_000);

  it('the tower: easy keeps its 8 posts, normal about twice (19), hard more, 2P more', () => {
    const count = (d: 'easy' | 'normal' | 'hard', players: number): number =>
      OZ_F_POSTS.filter((p) => !(p.n && d === 'easy') && !(p.h && d !== 'hard') && !(p.p2 && players < 2)).length;
    expect(count('easy', 1)).toBe(8);
    expect(count('normal', 1)).toBe(19);
    expect(count('hard', 1)).toBeGreaterThan(count('normal', 1));
    expect(count('normal', 2)).toBeGreaterThan(count('normal', 1));
    // Crawlers only below the tide's start (a grab must never meet the tide).
    for (const p of OZ_F_POSTS) if (p.kind === 'crawler') expect(p.k, `crawler on landing ${p.k}`).toBeLessThanOrEqual(13);
  });

  it('they stay the slow tanks of revision 2 (numbers.ts unchanged)', () => {
    expect([GRUNT.hp, RIFLEMAN.hp, GUNNER.hp, CRAWLER.hp]).toEqual([90, 90, 260, 40]);
    for (const n of [GRUNT, RIFLEMAN, GUNNER, CRAWLER]) expect(n.walk).toBeLessThanOrEqual(0.5);
  });
});
