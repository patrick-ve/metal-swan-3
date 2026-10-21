/**
 * Mission oldenzaal integration (INTEGRATE; docs/design/oldenzaal.md, revision 2, §2–§9, §14):
 * oz-a and oz-b play end to end on the dead soldiers — every kind, every entrance (out of the
 * boarded shops, the manholes, up through the pavers, a column marching in), the weapon crates,
 * the golden record, Meneer Wu's scene and the meal, the frikandels thrown — 1P and 2P; the pacing
 * (GDD 1.5: no stretch of more than 4 s without an enemy on screen outside the scene); no hit from
 * off screen; NO wave-A ghosts (no souls, no possessed, no townspeople, no roof ghost: R2-6); the
 * whole mission oz-a → oz-f completes; the mission def (art, preload, audio, reserve, ambience).
 */
import { beforeAll, describe, expect, it } from 'vitest';
import type { Damage, Entity } from '../../src/engine/entity';
import { listSprites } from '../../src/engine/sprites';
import { hasSfx } from '../../src/engine/synth';
import type { World } from '../../src/engine/world';
import { frikandelsLeft } from '../../src/game/content/characters/snack-power';
import { loadContent } from '../../src/game/content/index';
import { OZ_SCENERY_RESERVE } from '../../src/game/content/missions/oldenzaal/art-layout';
import { OLDENZAAL_ID, OZ_AMBIENCE, OZ_AUDIO_GROUP, OZ_SECTION, OZ_SECTIONS, OZ_SONG, OZ_SPRITES, OZ_ZOMBIE_TAG } from '../../src/game/content/missions/oldenzaal/ids';
import { OZ_WUGHOST_ART, OZ_ZOMBIE_ART } from '../../src/game/content/missions/oldenzaal/script-kit';
import { OZ_A_RECORD } from '../../src/game/content/missions/oldenzaal/terrain';
import { getEntityMeta, getMission } from '../../src/game/registry';
import { createHeadlessGame } from '../../src/sim/index';

beforeAll(async () => {
  await loadContent();
}, 120_000);

/** The wave-A ids revision 2 removed (R2-6). */
const WAVE_A_IDS = ['oz-shambler', 'oz-gunner', 'oz-brute', 'oz-soul', 'oz-townsperson', 'oz-soul-eject', 'oz-ghost-shot'];
const WAVE_A_SPRITES = ['enemy/oz-shambler/', 'enemy/oz-gunner/', 'enemy/oz-brute/', 'enemy/oz-soul/', 'enemy/oz-ghost-shot/', 'npc/oz-town/', 'fx/oz/soul/'];

/** What a bot run of oz-a → oz-b saw. */
interface Seen {
  types: Set<string>;
  kills: Record<string, number>;
  /** The entrances of the dead soldiers that came in. */
  entrances: Set<string>;
  /** Openings (boarded doors / windows, manholes) that broke open. */
  opened: Set<string>;
  record: boolean;
  winkel: boolean;
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
  const seen: Seen = { types: new Set(), kills: {}, entrances: new Set(), opened: new Set(), record: false, winkel: false, mealTick: -1, thrown: 0, maxGap: {}, offScreenHits: [], sections: [] };
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
      if (e.type === 'oz-winkel') seen.winkel = true;
      if (e.hasTag(OZ_ZOMBIE_TAG)) seen.entrances.add((e as unknown as { entrance: string }).entrance);
      if ((e.type === 'oz-boarded' || e.type === 'oz-manhole') && !(e as unknown as { closed: boolean }).closed) seen.opened.add(`${e.type}/${(e as unknown as { openingKind: string }).openingKind}`);
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

describe('oldenzaal: oz-a and oz-b play end to end on the dead soldiers', () => {
  it.each([1, 2] as const)('%iP god: every kind and entrance, the crates, the record, the scene, the meal, the frikandels; no ghosts', async (players) => {
    const seen = await playStreet(players, true);
    expect(seen.sections.slice(0, 3)).toEqual([OZ_SECTION.a, OZ_SECTION.b, OZ_SECTION.c]);
    expect(seen.record).toBe(true);
    for (const id of ['oz-grunt', 'oz-rifleman', 'oz-mg', 'oz-crawler']) expect(seen.kills[id] ?? 0, id).toBeGreaterThan(0);
    for (const k of ['walk', 'rise', 'burst', 'manhole', 'march']) expect(seen.entrances.has(k), k).toBe(true);
    for (const k of ['oz-boarded/window', 'oz-boarded/door', 'oz-manhole/manhole']) expect(seen.opened.has(k), k).toBe(true);
    for (const id of ['crate', 'oz-wu', 'pickup-oz-meal', 'oz-bones']) expect(seen.types.has(id), id).toBe(true);
    // R2-6: no souls, no possessed, no townspeople, and Mevrouw Winkel is not on the street.
    for (const id of WAVE_A_IDS) expect(seen.types.has(id), id).toBe(false);
    expect(seen.winkel).toBe(false);
    expect(seen.mealTick).toBeGreaterThan(0);
    expect(seen.thrown).toBeGreaterThanOrEqual(players);
  }, 240_000);

  it('normal difficulty, mortal: pacing ≤ 4 s without an enemy on screen; no hit from off screen', async () => {
    const seen = await playStreet(1, false);
    expect(seen.maxGap[OZ_SECTION.a]).toBeLessThanOrEqual(240);
    expect(seen.maxGap[OZ_SECTION.b]).toBeLessThanOrEqual(240);
    expect(seen.offScreenHits).toEqual([]);
  }, 240_000);
});

describe('oldenzaal: the whole mission', () => {
  it('1P god: oz-a → oz-f in order, the mini-boss defeated, the tower, the Swan: MISSION COMPLETE', async () => {
    const g = await createHeadlessGame({ missionId: OLDENZAAL_ID, seed: 1, players: 1, god: true, bot: true, difficulty: 'normal', captureConsole: true });
    const order: string[] = [];
    for (let t = 0; t < 40000 && !g.missionComplete; t++) {
      g.step(1);
      const id = g.runner?.section.id;
      if (id && order[order.length - 1] !== id) order.push(id);
    }
    const rep = g.report();
    expect(order).toEqual([...OZ_SECTIONS]);
    expect(g.missionComplete).toBe(true);
    expect(rep.bossDefeated).toBe(true);
    expect(rep.errors).toEqual([]);
    expect(rep.missingSfx).toEqual([]);
    g.dispose();
  }, 300_000);
});

describe('oldenzaal: revision 2 removed the wave-A ghosts (R2-6)', () => {
  it('no possessed, souls or townspeople are registered; no sprites or sfx of theirs', () => {
    for (const id of WAVE_A_IDS) expect(getEntityMeta(id), id).toBeUndefined();
    for (const pre of WAVE_A_SPRITES) expect(listSprites(pre), pre).toEqual([]);
    for (const id of ['oz/possessed/groan', 'oz/possessed/eject', 'oz/possessed/wail']) expect(hasSfx(id), id).toBe(false);
    expect(Object.keys(OZ_SPRITES)).not.toContain('possessed');
  });
});

describe('oldenzaal: the mission def', () => {
  it('audio group, songs, ambience per section, the scenery reserve', () => {
    const m = getMission(OLDENZAAL_ID)!;
    expect(m.audioGroup).toBe(OZ_AUDIO_GROUP);
    expect(m.denseReserve).toBe(OZ_SCENERY_RESERVE);
    expect(m.music).toBe(OZ_SONG.theme);
    expect(m.bossMusic).toBe(OZ_SONG.boss);
    expect(m.bossSection).toBe(OZ_SECTION.c);
    for (const s of [OZ_SECTION.a, OZ_SECTION.b, OZ_SECTION.c, OZ_SECTION.d, OZ_SECTION.e]) expect(m.sections[s].music, s).toBe(OZ_SONG.theme);
    expect(m.sections[OZ_SECTION.f].music).toBe(OZ_SONG.tower);
    for (const s of [OZ_SECTION.a, OZ_SECTION.b, OZ_SECTION.c]) expect(m.sections[s].ambience, s).toBe(OZ_AMBIENCE.street);
    expect(m.sections[OZ_SECTION.d].ambience).toBe(OZ_AMBIENCE.nave);
    expect(m.sections[OZ_SECTION.e].ambience).toBe(OZ_AMBIENCE.nave);
    expect(m.sections[OZ_SECTION.f].ambience).toBe(OZ_AMBIENCE.storm);
  });

  it('section art and preload: the dead soldiers everywhere, Meneer Wu / the meal on the street; the decor only as section art', () => {
    const m = getMission(OLDENZAAL_ID)!;
    for (const s of OZ_SECTIONS) {
      const art = m.sections[s].art ?? [];
      for (const pre of OZ_ZOMBIE_ART) expect(art, `${s} ${pre}`).toContain(pre);
      for (const pre of WAVE_A_SPRITES) expect(art, `${s} ${pre}`).not.toContain(pre);
    }
    for (const s of [OZ_SECTION.a, OZ_SECTION.b]) {
      const art = m.sections[s].art ?? [];
      for (const pre of OZ_WUGHOST_ART) expect(art, `${s} ${pre}`).toContain(pre);
      expect(art).toContain('decor/oz/shop');
      expect(art).toContain('prop/oz-boarded/');
    }
    const first = m.preloadFirst ?? [];
    expect(first.some((p) => p.startsWith('decor/'))).toBe(false);
    for (const pre of OZ_ZOMBIE_ART) expect(first).toContain(pre);
    for (const pre of WAVE_A_SPRITES) expect(first).not.toContain(pre);
  });
});
