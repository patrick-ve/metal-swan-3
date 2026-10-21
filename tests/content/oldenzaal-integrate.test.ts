/**
 * Mission oldenzaal, wave A integration (INTEGRATE; docs/design/oldenzaal.md §2–§4, §14): oz-a and
 * oz-b play end to end with their scripts — the drop with Mevrouw Winkel on the roof, the waves of
 * the possessed (shamblers, gunners, a brute, free souls, townspeople), the golden record, Meneer
 * Wu's scene and the meal, the frikandels thrown at packs — 1P and 2P; the pacing (GDD 1.5: no
 * stretch of more than 4 s without an enemy on screen outside the scene); the holy-mayo blast
 * drives the souls out of real hosts; the mission def (art, preload, audio, reserve, ambience).
 */
import { beforeAll, describe, expect, it } from 'vitest';
import type { Damage, Entity } from '../../src/engine/entity';
import type { World } from '../../src/engine/world';
import { frikandelsLeft } from '../../src/game/content/characters/snack-power';
import { loadContent } from '../../src/game/content/index';
import { OZ_SCENERY_RESERVE } from '../../src/game/content/missions/oldenzaal/art-layout';
import { OLDENZAAL_ID, OZ_AMBIENCE, OZ_AUDIO_GROUP, OZ_SECTION, OZ_SONG } from '../../src/game/content/missions/oldenzaal/ids';
import { OZ_STREET_ART, OZ_WUGHOST_ART } from '../../src/game/content/missions/oldenzaal/script-kit';
import { OZ_A_RECORD } from '../../src/game/content/missions/oldenzaal/terrain';
import { holyMayoBlast } from '../../src/game/content/oldenzaal/items/index';
import { OZ_HOST_TAG } from '../../src/game/content/oldenzaal/possessed/index';
import { getMission } from '../../src/game/registry';
import { createHeadlessGame } from '../../src/sim/index';
import { FLOOR, TestWorld } from './helpers';

beforeAll(async () => {
  await loadContent();
}, 120_000);

/** What a bot run of oz-a → oz-b saw. */
interface Seen {
  types: Set<string>;
  kills: Record<string, number>;
  record: boolean;
  winkelAt: number;
  mealTick: number;
  thrown: number;
  /** The longest stretch (ticks) without an enemy on screen, outside the scene (timer paused) and the walk to the exit. */
  maxGap: Record<string, number>;
  offScreenHits: string[];
  sections: string[];
}

/** Run the bot from the mission start through oz-a and oz-b (until oz-c starts). */
async function playStreet(players: 1 | 2, god: boolean, difficulty: 'easy' | 'normal' | 'hard' = 'normal'): Promise<Seen> {
  const g = await createHeadlessGame({ missionId: OLDENZAAL_ID, seed: 1, players, god, bot: true, difficulty, captureConsole: true });
  const seen: Seen = { types: new Set(), kills: {}, record: false, winkelAt: -1, mealTick: -1, thrown: 0, maxGap: {}, offScreenHits: [], sections: [] };
  const wrapped = new WeakSet<World>();
  let gap = 0;
  let sec = '';
  let t = 0;
  const thrownBefore = [2, 2];
  while (t < 20000) {
    g.step(1);
    t++;
    const w = g.world;
    const r = g.runner;
    if (!w || !r) continue;
    const id = r.section.id;
    if (id !== sec) {
      seen.sections.push(id);
      sec = id;
      gap = 0;
    }
    if (id === OZ_SECTION.c) break;
    if (!wrapped.has(w)) {
      wrapped.add(w);
      const orig = w.damage.bind(w);
      w.damage = (target: Entity, d: Damage, part = 0): boolean => {
        if (target.hasTag('player') && d.kind !== 'crush' && d.source && !w.onScreen(d.source, 0)) seen.offScreenHits.push(`${id} ${d.source.type}`);
        return orig(target, d, part);
      };
    }
    for (const e of w.entities) {
      seen.types.add(e.type);
      if (e.type === 'pickup-gem' && Math.abs(e.x - OZ_A_RECORD[0]) < 4) seen.record = true;
      if (e.type === 'oz-winkel' && seen.winkelAt < 0) seen.winkelAt = t;
    }
    for (const p of w.players) {
      const left = frikandelsLeft(p as never);
      const k = (p as unknown as { index: number }).index;
      if (left > 0 && seen.mealTick < 0) seen.mealTick = t;
      if (left < thrownBefore[k] && seen.mealTick >= 0) {
        seen.thrown += thrownBefore[k] - left;
        thrownBefore[k] = left;
      } else if (left > thrownBefore[k]) thrownBefore[k] = left;
    }
    let any = false;
    for (const e of w.byTag('enemy')) if (e.alive && w.onScreen(e, 0)) any = true;
    const scene = (r as unknown as { timerPaused: boolean }).timerPaused;
    if (any || scene) gap = 0;
    else gap++;
    // The walk to the exit after the last lock is the section's end, not a lull.
    const toExit = w.camera.right >= r.section.width - 64;
    if (!toExit) seen.maxGap[id] = Math.max(seen.maxGap[id] ?? 0, gap);
  }
  seen.kills = g.report().killsByType;
  expect(g.report().errors).toEqual([]);
  g.dispose();
  return seen;
}

describe('oldenzaal wave A: oz-a and oz-b play end to end', () => {
  it.each([1, 2] as const)('%iP god: the drop, Winkel, every kind of possessed, the record, the scene, the meal, the frikandels', async (players) => {
    const seen = await playStreet(players, true);
    expect(seen.sections.slice(0, 3)).toEqual([OZ_SECTION.a, OZ_SECTION.b, OZ_SECTION.c]);
    expect(seen.winkelAt).toBeGreaterThanOrEqual(0);
    expect(seen.winkelAt).toBeLessThan(10);
    expect(seen.record).toBe(true);
    for (const id of ['oz-shambler', 'oz-gunner', 'oz-brute', 'oz-soul', 'oz-townsperson', 'oz-soul-eject', 'oz-wu', 'pickup-oz-meal']) expect(seen.types.has(id), id).toBe(true);
    for (const id of ['oz-shambler', 'oz-gunner', 'oz-brute', 'oz-soul']) expect(seen.kills[id] ?? 0, id).toBeGreaterThan(0);
    expect(seen.mealTick).toBeGreaterThan(0);
    expect(seen.thrown).toBeGreaterThanOrEqual(players);
  }, 180_000);

  it('normal difficulty, mortal: pacing ≤ 4 s without an enemy on screen; no hit from off screen', async () => {
    const seen = await playStreet(1, false);
    expect(seen.maxGap[OZ_SECTION.a]).toBeLessThanOrEqual(240);
    expect(seen.maxGap[OZ_SECTION.b]).toBeLessThanOrEqual(240);
    expect(seen.offScreenHits).toEqual([]);
  }, 180_000);
});

describe('oldenzaal wave A: the holy-mayo blast on real hosts', () => {
  it('drives the soul out of every host in its radius at once; free souls burst; townspeople and far hosts are untouched', () => {
    const tw = new TestWorld({ playerX: 60, god: true, seed: 4 });
    const near = [tw.spawn('oz-shambler', 300), tw.spawn('oz-shambler', 316), tw.spawn('oz-brute', 330, { look: 'butcher' }), tw.spawn('oz-gunner', 290)];
    const soul = tw.spawn('oz-soul', 310, {}, FLOOR - 30);
    const town = tw.spawn('oz-townsperson', 305, { flee: false });
    const far = tw.spawn('oz-shambler', 420);
    tw.run(2);
    const n = holyMayoBlast(tw.world, 310, FLOOR - 10, 0, 48);
    tw.run(2);
    expect(n).toBeGreaterThanOrEqual(near.length);
    for (const h of near) expect(h.alive, h.type).toBe(false);
    expect(soul.alive).toBe(false);
    expect(town.alive).toBe(true);
    expect(far.alive).toBe(true);
    expect(tw.world.byTag(OZ_HOST_TAG).filter((e) => e.alive)).toEqual([far]);
    // Each freed host became a dazed townsperson and an ejected soul.
    expect(tw.ofType('oz-soul-eject').length).toBeGreaterThanOrEqual(near.length);
    expect(tw.ofType('oz-townsperson').length).toBeGreaterThanOrEqual(near.length + 1);
  });
});

describe('oldenzaal wave A: the mission def', () => {
  it('audio group, songs, ambience per section, the scenery reserve', () => {
    const m = getMission(OLDENZAAL_ID)!;
    expect(m.audioGroup).toBe(OZ_AUDIO_GROUP);
    expect(m.denseReserve).toBe(OZ_SCENERY_RESERVE);
    expect(m.music).toBe(OZ_SONG.theme);
    expect(m.sections[OZ_SECTION.e].music).toBe(OZ_SONG.tower);
    expect(m.sections[OZ_SECTION.a].ambience).toBe(OZ_AMBIENCE.street);
    expect(m.sections[OZ_SECTION.b].ambience).toBe(OZ_AMBIENCE.street);
    expect(m.sections[OZ_SECTION.d].ambience).toBe(OZ_AMBIENCE.nave);
    expect(m.sections[OZ_SECTION.e].ambience).toBe(OZ_AMBIENCE.storm);
  });

  it('section art and preload: the street possessed and Meneer Wu / the meal; no churchgoer sets; the town decor only as section art', () => {
    const m = getMission(OLDENZAAL_ID)!;
    for (const s of [OZ_SECTION.a, OZ_SECTION.b]) {
      const art = m.sections[s].art ?? [];
      for (const pre of [...OZ_STREET_ART, ...OZ_WUGHOST_ART]) expect(art, `${s} ${pre}`).toContain(pre);
      expect(art.some((a) => a.includes('churchgoer'))).toBe(false);
      expect(art).toContain('decor/oz/shop');
    }
    const first = m.preloadFirst ?? [];
    expect(first.some((p) => p.startsWith('decor/oz/'))).toBe(false);
    expect(first.some((p) => p.includes('churchgoer'))).toBe(false);
    for (const pre of OZ_STREET_ART) expect(first).toContain(pre);
  });
});
