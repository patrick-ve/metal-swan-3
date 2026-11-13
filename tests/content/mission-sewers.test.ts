/**
 * Mission sewers — level 2, MISSION 2 "RATTENJONG MET DE RATTENITEMS" (docs/design/sewers.md), wave
 * P0: the lazy registration, the MissionDef of §1, the card, the six grey sections (the widths of §2,
 * flat ground at y 176, checkpoints ascending and ≤ 1,400 px apart, the exits a → b → c → d → e →
 * end, the banners), the light entries, the sound ids, the euro rows, and the scripts: each one runs
 * 1,200 ticks in god mode without errors and spawns only registered ids; the bot plays the mission
 * end to end (1P and 2P).
 */
import { describe, expect, it } from 'vitest';
import { hasSfx, hasSong } from '../../src/engine/audio';
import { measure } from '../../src/engine/font';
import { getSampleGroup } from '../../src/engine/samples';
import { Terrain } from '../../src/engine/terrain';
import { EURO_BY_ID, MINI_BOSS_CENTS, BOSS_CENTS } from '../../src/game/budget/euro-table';
import { isLazyContent, isSewersContent, loadContent } from '../../src/game/content/index';
import { SEWERS_CARD } from '../../src/game/content/missions/sewers/card';
import {
  SEWERS_AUDIO_GROUP,
  SEWERS_BANNER,
  SEWERS_BOSS,
  SEWERS_ID,
  SEWERS_RAT,
  SEWERS_SECTION,
  SEWERS_SECTIONS,
  SEWERS_SONG,
  SEWERS_STREET,
  SEWERS_WIDTH,
  isSewersSpriteId,
} from '../../src/game/content/missions/sewers/ids';
import { SEWERS_SFX, SEWERS_SFX_IDS } from '../../src/game/content/sfx/sewers';
import { sewersVoiceLines } from '../../src/game/content/samples/sewers';
import { sectionLight } from '../../src/game/mission/light/api';
import { getMission, hasMission, listMissions } from '../../src/game/registry';
import { missionCard, missionLabel } from '../../src/game/scenes/flow-data';
import { briefingLines } from '../../src/game/scenes/mission-intro';
import { createHeadlessGame } from '../../src/sim/index';

// The boot's content set (the lazy sewers chunk stays out of it), then the chunk on its own.
await loadContent();
const beforeSewers = hasMission(SEWERS_ID);
await loadContent(isSewersContent);
const SEWERS = getMission(SEWERS_ID)!;

/** Ids spawned as placeholders (unknown entity ids) in a report's warnings. */
function unknownIds(warnings: readonly string[]): string[] {
  const out: string[] = [];
  for (const w of warnings) {
    const m = /unknown entity id "([^"]+)"/.exec(w);
    if (m) out.push(m[1]);
  }
  return out;
}

describe('mission sewers: lazy registration, the MissionDef and the card', () => {
  it('is lazy: the boot set leaves it out, its own loader registers it', () => {
    expect(beforeSewers).toBe(false);
    for (const id of ['missions/sewers', 'missions/sewers/x', 'sewers/rats', 'sewers/street', 'bosses/sewers-gerrit', 'music/sewers', 'sfx/sewers', 'samples/sewers']) {
      expect(isSewersContent(id), id).toBe(true);
      expect(isLazyContent(id), id).toBe(true);
    }
    for (const id of ['missions/oldenzaal', 'missions/ams', 'bosses/ams', 'music/oldenzaal', 'rally', 'fps', 'missions/ams2']) expect(isSewersContent(id), id).toBe(false);
    expect(hasMission(SEWERS_ID)).toBe(true);
  });

  it('is the MissionDef of spec §1', () => {
    expect(SEWERS).toMatchObject({
      id: 'sewers',
      name: 'RATTENJONG MET DE RATTENITEMS',
      subtitle: 'MISSION 2',
      start: 'sewers-a',
      next: 'rally',
      music: 'sewers-street',
      economy: 'euro',
      audioGroup: 'mission:sewers',
      hostages: { 'sewers-a': 2, 'sewers-b': 1, 'sewers-c': 1, 'sewers-d': 1 },
      bossSection: 'sewers-e',
      bossSections: ['sewers-a', 'sewers-e'],
      announce: 'MISSIE TWEE. HOU JE NEUS DICHT!',
    });
    expect(SEWERS.audioGroup).toBe(SEWERS_AUDIO_GROUP);
    expect(SEWERS.after).toBeUndefined();
    expect(SEWERS.standalone).toBeUndefined();
    expect(SEWERS.tally).toBeUndefined();
    expect(Object.keys(SEWERS.sections)).toEqual(['sewers-a', 'sewers-b', 'sewers-c', 'sewers-d', 'sewers-e', 'sewers-end']);
    expect([...SEWERS_SECTIONS]).toEqual(Object.keys(SEWERS.sections));
    for (const [id, s] of Object.entries(SEWERS.sections)) expect(s.id).toBe(id);
    // listMissions sorts ids: sewers after oldenzaal; `next` is explicit (the route guard in flow.ts).
    const ids = listMissions();
    expect(ids.indexOf('sewers')).toBeGreaterThan(ids.indexOf('oldenzaal'));
  });

  it('the card (registered at boot, not in the lazy chunk): MISSION 2, the spec text, five stops on one line', () => {
    const card = missionCard(SEWERS_ID);
    expect(card).toBe(SEWERS_CARD);
    expect(missionLabel(SEWERS_ID)).toBe('MISSION 2');
    expect(card.label).toBe('MISSION 2');
    expect(card.name).toBe('RATTENJONG MET DE RATTENITEMS');
    expect(card.place).toBe('AMSTERDAM, DE WALLEN - 2300 HOURS');
    expect(card.briefing).toEqual(['SHORE LEAVE, NIGHT TWO: DE WALLEN IS FULL OF CROOKS.', 'CLEAR THE STREETS. MIND THE DRAINS. GO!']);
    expect(card.headline).toBe('SQUAD CLEANS UP DE WALLEN! THE SEWER IS ANOTHER STORY.');
    expect(card.announce).toBe(SEWERS.announce);
    expect(briefingLines(card).length).toBeLessThanOrEqual(4);
    expect(measure(card.name, 'big')).toBeLessThanOrEqual(380);
    expect(measure(card.place, 'small')).toBeLessThanOrEqual(380);
    expect(measure(card.headline, 'small')).toBeLessThanOrEqual(380);
    expect(card.map!.labels!.map((l) => l[0])).toEqual(['WALLEN', 'STEEGJES', 'PUT', 'RIOOL', 'AFVALHAL']);
    const [x, y] = card.map!.dot;
    expect([x, y]).toEqual([card.map!.labels![0][1], card.map!.labels![0][2] - 10]);
    for (const [, lx, ly] of card.map!.labels!) {
      expect(lx).toBeGreaterThan(0);
      expect(lx).toBeLessThan(384);
      expect(ly).toBeGreaterThan(54);
      expect(ly).toBeLessThan(120);
    }
  });
});

describe('mission sewers: the grey sections', () => {
  it.each([...SEWERS_SECTIONS])('%s: the spec width, flat ground at y 176, checkpoints ascending and ≤ 1,400 px apart, exits inside', (id) => {
    const s = SEWERS.sections[id];
    expect(s.width).toBe(SEWERS_WIDTH[id]);
    expect(s.height).toBe(216);
    expect(s.scroll).toBe('right');
    const t = new Terrain(s.terrain);
    for (let x = 4; x < s.width; x += 64) expect(t.surfaceY(x, 170, 182), `${id} ground at ${x}`).toBe(176);
    expect(s.playerStart.y).toBe(176);
    const cps = s.checkpoints ?? [];
    for (let i = 1; i < cps.length; i++) expect(cps[i], `${id} checkpoint ${i}`).toBeGreaterThan(cps[i - 1]);
    const all = [0, ...cps, s.width];
    for (let i = 1; i < all.length; i++) expect(all[i] - all[i - 1], `${id} checkpoint gap ${i}`).toBeLessThanOrEqual(1400);
    for (const c of cps) expect(c).toBeLessThan(s.width);
    for (const ex of s.exits ?? []) {
      expect(ex.rect.x).toBeGreaterThanOrEqual(0);
      expect(ex.rect.x + ex.rect.w).toBeLessThanOrEqual(s.width);
    }
    expect(s.music).toBeDefined();
  });

  it('the checkpoints and boss starts of spec §2', () => {
    const cp = (id: string): number[] | undefined => SEWERS.sections[id].checkpoints;
    expect(cp('sewers-a')).toEqual([1200, 2300, 2700]);
    expect(cp('sewers-b')).toEqual([1200, 2000]);
    expect(cp('sewers-c')).toEqual([900, 1700]);
    expect(cp('sewers-d')).toEqual([1300, 2300]);
    expect(cp('sewers-e')).toEqual([600, 880]);
    expect(SEWERS.sections['sewers-a'].bossStart).toEqual({ x: 2700, y: 176 });
    expect(SEWERS.sections['sewers-e'].bossStart).toEqual({ x: 880, y: 176 });
    expect(SEWERS.sections['sewers-end'].timeLimit).toBe(0);
  });

  it('the exits chain a → b → c → d → e → end (b cuts into the grate, e fades), the end completes in its script', () => {
    for (let i = 0; i + 1 < SEWERS_SECTIONS.length; i++) {
      const ex = SEWERS.sections[SEWERS_SECTIONS[i]].exits ?? [];
      expect(ex.map((e) => e.to), SEWERS_SECTIONS[i]).toEqual([SEWERS_SECTIONS[i + 1]]);
    }
    expect(SEWERS.sections['sewers-b'].exits![0].transition).toBe('cut');
    expect(SEWERS.sections['sewers-b'].exits![0].rect.x).toBe(2384);
    expect(SEWERS.sections['sewers-e'].exits![0].transition).toBe('fade');
    expect(SEWERS.sections['sewers-end'].exits).toBeUndefined();
  });

  it('the section ids are unique in the game; every section has its light (c–e dark 0.6 with the hero glow r 28)', () => {
    const others = listMissions().filter((m) => m !== SEWERS_ID).flatMap((m) => Object.keys(getMission(m)!.sections));
    for (const id of SEWERS_SECTIONS) {
      expect(others, id).not.toContain(id);
      expect(id.startsWith('sewers-')).toBe(true);
      expect(sectionLight(id), id).toBeDefined();
    }
    for (const id of [SEWERS_SECTION.c, SEWERS_SECTION.d, SEWERS_SECTION.e]) {
      expect(sectionLight(id)?.darkness, id).toBe(0.6);
      expect(sectionLight(id)?.heroLight, id).toBe(28);
    }
    for (const id of [SEWERS_SECTION.a, SEWERS_SECTION.b]) expect(sectionLight(id)!.darkness, id).toBeLessThanOrEqual(0.7);
  });

  it('the banners: the place and the clock (spec §1), each fits the screen', () => {
    expect(SEWERS_BANNER).toEqual({
      'sewers-a': 'DE WALLEN - 23:00',
      'sewers-b': 'DE STEEGJES - 01:00',
      'sewers-c': 'DE PUT - 01:30',
      'sewers-d': 'HET RIOOL - 02:30',
      'sewers-e': 'DE AFVALHAL - 05:00',
      'sewers-end': 'DAGERAAD - 07:15',
    });
    for (const t of Object.values(SEWERS_BANNER)) expect(measure(t, 'big'), t).toBeLessThanOrEqual(376);
  });
});

describe('mission sewers: ids, sound and euros', () => {
  it('sprite ids of the mission are recognised by a path segment that starts with sewers-', () => {
    for (const id of ['enemy/sewers-rat-runner/run', 'boss/sewers-rattenjong/throw', 'decor/sewers-grate/burst', 'sewers-x']) expect(isSewersSpriteId(id), id).toBe(true);
    for (const id of ['decor/ams/lamp', 'enemy/delivery-rider/ride', 'item/pickup-gem', 'boss/oz-plechelmus/x']) expect(isSewersSpriteId(id), id).toBe(false);
  });

  it('every song and sfx id of spec §7 has a synth recipe; the sample group merges the ams sfx and voices', () => {
    expect(Object.values(SEWERS_SONG).sort()).toEqual(['sewers-boss', 'sewers-gerrit', 'sewers-sewer', 'sewers-street']);
    for (const id of Object.values(SEWERS_SONG)) expect(hasSong(id), id).toBe(true);
    const spec = ['rain-bed', 'neon-buzz', 'whistle', 'gold-pistol', 'shotgun-pump', 'shotgun', 'limo-horn', 'limo-wreck', 'knife-jab', 'knuckles', 'grate-rattle', 'grate-burst', 'rat-squeak', 'rat-hiss', 'rat-bite', 'rat-flip', 'spit-gurgle', 'spit-splat', 'brute-snort', 'brute-stomp', 'flash-click', 'battery', 'fatberg-squelch', 'fatberg-slump', 'throw-bike', 'throw-cart', 'throw-scooter', 'cart-roll', 'king-screech', 'king-squeak', 'hall-crack', 'flood', 'drip-bed', 'manhole-lid', 'taxi'].map((s) => `sewers/${s}`);
    expect([...SEWERS_SFX_IDS].sort()).toEqual(spec.sort());
    expect(Object.values(SEWERS_SFX).sort()).toEqual(spec.sort());
    for (const id of spec) expect(hasSfx(id), id).toBe(true);
    const g = getSampleGroup(SEWERS_AUDIO_GROUP);
    expect(g).toBeDefined();
    // The four songs ship as streamed takes (wave P3, 2026-11-12); the ams songs stay out of the group.
    expect(Object.keys(g!.music ?? {}).sort()).toEqual(Object.values(SEWERS_SONG).sort());
    // Every bubble line of spec §7 (12 voiced, the heroes' two text-only: row 56 took the taxi driver's two
    // out and gave the hero at the wagon's wheel `STAP IN, ZWAAN!`): ≤ 24 characters a line, two lines at
    // most, no diacritics.
    const lines = sewersVoiceLines();
    expect(lines.length).toBe(14);
    for (const { text } of lines) {
      const rows = text.split('\n');
      expect(rows.length, text).toBeLessThanOrEqual(2);
      for (const r of rows) expect(r.length, text).toBeLessThanOrEqual(24);
      expect(/[^\x20-\x7e\n€]/.test(text), text).toBe(false);
    }
  });

  it('the euro rows of every new id of spec §3 and §4', () => {
    expect(EURO_BY_ID[SEWERS_STREET.dealer]).toBe(500);
    expect(EURO_BY_ID[SEWERS_STREET.pimp]).toBe(1200);
    expect(EURO_BY_ID[SEWERS_STREET.bodyguard]).toBe(800);
    expect(EURO_BY_ID[SEWERS_RAT.runner]).toBe(200);
    expect(EURO_BY_ID[SEWERS_RAT.leaper]).toBe(300);
    expect(EURO_BY_ID[SEWERS_RAT.spitter]).toBe(400);
    expect(EURO_BY_ID[SEWERS_RAT.brute]).toBe(1500);
    expect(EURO_BY_ID[SEWERS_BOSS.gerrit]).toBe(MINI_BOSS_CENTS);
    expect(EURO_BY_ID[SEWERS_BOSS.rattenjong]).toBe(BOSS_CENTS);
  });
});

describe('mission sewers: the scripts run', () => {
  it.each([...SEWERS_SECTIONS])('%s: 1,200 ticks in god mode, no errors, only registered ids spawned', async (section) => {
    const g = await createHeadlessGame({ missionId: SEWERS_ID, sectionId: section, seed: 1, players: 1, god: true, bot: true, captureConsole: true, loadContent: false });
    try {
      expect(g.runner?.section.id).toBe(section);
      for (let t = 0; t < 1200 && !g.done; t++) g.step(1);
      const r = g.report();
      expect(r.errors).toEqual([]);
      expect(unknownIds(r.warnings)).toEqual([]);
    } finally {
      g.dispose();
    }
  }, 60_000);

  it('the boss rush (`boss=1`) starts in the Rattenjong arena; with section=sewers-a in GOUDEN GERRIT\'s', async () => {
    for (const [sectionId, x] of [[undefined, 880], ['sewers-a', 2700]] as const) {
      const g = await createHeadlessGame({ missionId: SEWERS_ID, sectionId, seed: 1, god: true, bossRush: true, loadContent: false });
      try {
        expect(g.runner?.section.id).toBe(sectionId ?? 'sewers-e');
        expect(Math.abs((g.runner?.world.players[0]?.x ?? 0) - x)).toBeLessThanOrEqual(8);
      } finally {
        g.dispose();
      }
    }
  });

  it.each([1, 2] as const)('%iP god: the bot plays sewers-a → … → sewers-end → MISSION COMPLETE, no errors', async (players) => {
    const g = await createHeadlessGame({ missionId: SEWERS_ID, seed: 1, players, god: true, bot: true, captureConsole: true, loadContent: false });
    const seen: string[] = [];
    g.runUntil((gg) => {
      const s = gg.runner?.section.id;
      if (s && seen[seen.length - 1] !== s) seen.push(s);
      return gg.missionComplete;
    }, 40000);
    expect(seen).toEqual([...SEWERS_SECTIONS]);
    expect(g.missionComplete).toBe(true);
    expect(g.report().errors).toEqual([]);
    g.dispose();
  }, 120_000);
});
