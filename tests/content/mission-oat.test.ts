/**
 * Mission oat — level 2, MISSION 2 "OAT OF CONTROL" (docs/design/oat.md; docs/api/oat.md), wave A
 * (CORE): the lazy registration and the card, the six section stubs (widths, the start on the
 * floor, checkpoints ≤ 1,400 px apart, exits inside, the chase's Swan and auto-scroll, the boss
 * starts), the ids and their prefixes (unique, apart from ams's), the lines, the kit contracts (the
 * sun table), the PAL_HD_OAT ramps (additive: PAL_HD and the oldenzaal sets unchanged) and the bot
 * running the stub end to end (1P and 2P, god mode).
 */
import { describe, expect, it } from 'vitest';
import { luma } from '../../src/engine/color';
import { measure } from '../../src/engine/font';
import {
  HD_FULL_PALETTE,
  HD_OAT_FULL_PALETTE,
  HD_OAT_NEW,
  HD_OAT_RAMP_NAMES,
  HD_OZ_PALETTE,
  HD_OZ_R2_NEW,
  HD_PALETTE,
  HD_R2_FULL_PALETTE,
  PAL_HD,
  PAL_HD_OAT,
  inHdPalette,
  inOatPalette,
} from '../../src/engine/palette-hd';
import { Terrain } from '../../src/engine/terrain';
import { isLazyContent, isOatContent, loadContent } from '../../src/game/content/index';
import { OAT_CARD } from '../../src/game/content/missions/oat/card';
import {
  OAT_AMBIENCE,
  OAT_AUDIO_GROUP,
  OAT_BOSS,
  OAT_ENEMY,
  OAT_ID,
  OAT_PIECE,
  OAT_SECTIONS,
  OAT_SONG,
  OAT_SPEAKER,
  OAT_SPRITE_PREFIXES,
  OAT_STATUS,
  OAT_WIDTH,
  isOatSpriteId,
} from '../../src/game/content/missions/oat/ids';
import { SECTION_BANNERS, voicedLines } from '../../src/game/content/missions/oat/lines';
import { OAT_A, OAT_C1, OAT_D, WATER_Y } from '../../src/game/content/missions/oat/terrain';
import { OZ_SECTIONS } from '../../src/game/content/missions/oldenzaal/ids';
import { sectionLight, sectionSun } from '../../src/game/mission/light/api';
import { getMission, hasMission, listEntities, listMissions } from '../../src/game/registry';
import { missionCard, missionLabel } from '../../src/game/scenes/flow-data';
import { briefingLines } from '../../src/game/scenes/mission-intro';
import { createHeadlessGame } from '../../src/sim/index';

// The boot's content set (the lazy oat chunk stays out of it), then the chunk on its own.
await loadContent();
const beforeOat = { mission: hasMission(OAT_ID), entities: new Set(listEntities()) };
await loadContent(isOatContent);
const OAT = getMission(OAT_ID)!;

describe('mission oat: lazy registration and the card', () => {
  it('is lazy: the boot set leaves it out, its own loader registers it', () => {
    expect(beforeOat.mission).toBe(false);
    expect(isLazyContent('missions/oat')).toBe(true);
    for (const id of ['missions/oat', 'missions/oat/art', 'oat/traffic', 'bosses/oat-makelaar', 'music/oat', 'sfx/oat', 'sfx/oat-night', 'samples/oat']) expect(isOatContent(id), id).toBe(true);
    for (const id of ['missions/oldenzaal', 'missions/ams', 'oldenzaal/kit', 'bosses/ams', 'music/oldenzaal', 'rally', 'fps']) expect(isOatContent(id), id).toBe(false);
    expect(hasMission(OAT_ID)).toBe(true);
    // The wave-A stub defines no entity of its own (the cast arrives in waves B and C).
    expect(listEntities().filter((id) => !beforeOat.entities.has(id))).toEqual([]);
  });

  it('is MISSION 2 "OAT OF CONTROL" with six sections oat-a … oat-e in play order; next the rally', () => {
    expect(OAT.name).toBe('OAT OF CONTROL');
    expect(OAT.subtitle).toBe('MISSION 2');
    expect(Object.keys(OAT.sections)).toEqual(['oat-a', 'oat-b', 'oat-c', 'oat-c1', 'oat-d', 'oat-e']);
    expect([...OAT_SECTIONS]).toEqual(Object.keys(OAT.sections));
    for (const [id, s] of Object.entries(OAT.sections)) expect(s.id).toBe(id);
    expect(OAT.start).toBe('oat-a');
    expect(OAT.bossSection).toBe('oat-d');
    expect(OAT.bossSections).toEqual(['oat-a', 'oat-d']);
    expect(OAT.next).toBe('rally');
    expect(OAT.after).toBeUndefined();
    expect(OAT.hostages).toEqual({});
    expect(OAT.artDensity).toBe(4);
    expect(OAT.economy).toBe('euro');
    expect(OAT.tally).toBe('receipt');
    expect(OAT.audioGroup).toBe(OAT_AUDIO_GROUP);
    expect(OAT.denseReserve).toBe(84 * 1024 * 1024);
    expect(OAT.announce).toBe('MISSIE TWEE. HOU JE PORTEMONNEE VAST!');
    // The m5 trap: listMissions sorts ids, oat comes after m5 (flow.ts's route guard filters it).
    const ids = listMissions();
    expect(ids.indexOf('oat')).toBeGreaterThan(ids.indexOf('m5'));
  });

  it('the card (registered at boot, not in the lazy chunk): MISSION 2, the folder look, the spec text, a briefing that fits the radio box', () => {
    const card = missionCard(OAT_ID);
    expect(card).toBe(OAT_CARD);
    expect(missionLabel(OAT_ID)).toBe('MISSION 2');
    expect(card.label).toBe('MISSION 2');
    expect(card.name).toBe('OAT OF CONTROL');
    expect(card.place).toBe('AMSTERDAM, DE BINNENSTAD - 0930 HOURS');
    expect(card.briefing).toEqual(['SHORE LEAVE, DAY TWO: A DAY OUT IN THE OLD CITY.', 'EVERY CYGNET GETS 100 EURO. AMSTERDAM IS NOT CHEAP. GO!']);
    expect(card.announce).toBe(OAT.announce);
    expect(card.look).toBe('folder');
    expect(briefingLines(card).length).toBeLessThanOrEqual(4);
    expect(briefingLines(card).join(' ')).toBe(card.briefing.join(' '));
    expect(measure(card.headline, 'small')).toBeLessThanOrEqual(340);
    expect(measure(card.place, 'small')).toBeLessThanOrEqual(380);
    const [x, y] = card.map!.dot;
    expect(x).toBeGreaterThan(0);
    expect(x).toBeLessThan(384);
    expect(y).toBeGreaterThan(54);
    expect(y).toBeLessThan(120);
  });
});

describe('mission oat: the section stubs', () => {
  it.each([...OAT_SECTIONS])('%s: the spec width, right-scrolling, the start on the floor, checkpoints ≤ 1,400 px apart, exits inside', (id) => {
    const s = OAT.sections[id];
    expect(s.width).toBe(OAT_WIDTH[id]);
    expect(s.scroll).toBe('right');
    expect(s.height).toBe(216);
    const t = new Terrain(s.terrain);
    expect(t.surfaceY(s.playerStart.x, s.playerStart.y - 4, s.playerStart.y + 4)).toBe(s.playerStart.y);
    const cps = [0, ...(s.checkpoints ?? []), s.width - 384];
    for (let i = 1; i < cps.length; i++) expect(Math.abs(cps[i] - cps[i - 1]), `${id} checkpoint ${i}`).toBeLessThanOrEqual(1400);
    for (const ex of s.exits ?? []) {
      expect(ex.rect.x).toBeGreaterThanOrEqual(0);
      expect(ex.rect.x + ex.rect.w).toBeLessThanOrEqual(s.width);
      expect([...OAT_SECTIONS, 'complete']).toContain(ex.to);
    }
    expect(s.music).toBeDefined();
    expect(s.ambience).toBe(OAT_AMBIENCE[id]);
  });

  it('the sections lead on in play order (exits), the last one completes in its script; the boss starts are the spec x', () => {
    for (let i = 0; i + 1 < OAT_SECTIONS.length; i++) expect(OAT.sections[OAT_SECTIONS[i]].exits?.[0]?.to).toBe(OAT_SECTIONS[i + 1]);
    expect(OAT.sections['oat-e'].exits).toBeUndefined();
    expect(OAT.sections['oat-a'].bossStart).toEqual({ x: OAT_A.bossX, y: 176 });
    expect(OAT.sections['oat-d'].bossStart).toEqual({ x: OAT_D.bossX, y: 176 });
    expect(OAT_A.bossX).toBe(4250);
    expect(OAT_D.bossX).toBe(3990);
  });

  it('oat-c1 is the chase: every player starts on a Swan, the canal is water, no timer; oat-d takes no vehicle in', () => {
    const c1 = OAT.sections['oat-c1'];
    expect(c1.startVehicle).toBe('swan');
    expect(c1.vehicles).toEqual(['swan']);
    expect(c1.timeLimit).toBe(0);
    const t = new Terrain(c1.terrain);
    const mid = (OAT_C1.water[0] + OAT_C1.water[1]) / 2;
    expect(t.hazardAt({ x: mid, y: WATER_Y + 4, w: 2, h: 2 })?.kind).toBe('water');
    expect(OAT_C1.stopX).toBe(3600);
    expect(OAT.sections['oat-d'].vehicles).toBeUndefined();
    expect(OAT.sections['oat-e'].timeLimit).toBe(0);
  });

  it('section ids are unique in the game (never ams\'s bare a … d or oldenzaal\'s oz-…); no section light yet (LIGHT-WATER)', () => {
    const others = listMissions().filter((m) => m !== OAT_ID).flatMap((m) => Object.keys(getMission(m)!.sections));
    for (const id of OAT_SECTIONS) {
      expect(others, id).not.toContain(id);
      expect(id.startsWith('oat-')).toBe(true);
      expect(sectionLight(id), id).toBeUndefined();
    }
    for (const id of OZ_SECTIONS) expect(sectionLight(id), id).toBeDefined();
  });

  it('the banners: the place and the clock (spec §1)', () => {
    expect(SECTION_BANNERS['oat-a']).toBe('DE 9 STRAATJES - 09:30');
    expect(SECTION_BANNERS['oat-b']).toBe('FORT NEGEN & ZESTIG - 12:30');
    expect(SECTION_BANNERS['oat-c']).toBe('DE KADEMUUR - 17:15');
    expect(SECTION_BANNERS['oat-d']).toBe('DE WALLEN - 22:30');
    expect(SECTION_BANNERS['oat-e']).toBe('NAAR DE RING - 03:20');
    for (const t of Object.values(SECTION_BANNERS)) expect(measure(t, 'big'), t).toBeLessThanOrEqual(376);
    // Wave A voices nothing of its own yet.
    expect(voicedLines()).toEqual([]);
  });
});

describe('mission oat: ids and prefixes', () => {
  it('every entity id starts with oat- and is unique; the sprite prefixes stay apart from what ams preloads', () => {
    const ids = [...Object.values(OAT_ENEMY), ...Object.values(OAT_BOSS), ...Object.values(OAT_PIECE), ...Object.values(OAT_STATUS)];
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id.startsWith('oat-'), id).toBe(true);
    const ams = getMission('ams')!;
    const amsPre = [...(ams.preloadFirst ?? []), ...(ams.preloadLast ?? []), ...Object.values(ams.sections).flatMap((s) => [...(s.art ?? []), ...(s.artLate ?? [])])];
    for (const p of OAT_SPRITE_PREFIXES) {
      for (const a of amsPre) {
        expect(p.startsWith(a), `${p} under ams's ${a}`).toBe(false);
        expect(a.startsWith(p), `ams's ${a} under ${p}`).toBe(false);
      }
    }
    for (const id of ['decor/oat/a/lamp', 'enemy/oat-taxi/drive', 'boss/oat-makelaar/idle', 'item/oat/can', 'ui/oat/folder', 'npc/oat/barista', 'fx/oat/splash']) expect(isOatSpriteId(id), id).toBe(true);
    for (const id of ['decor/ams/lamp', 'enemy/handhaver', 'item/pickup-gem', 'ui/icon-bomb', 'boss/oz-plechelmus/x']) expect(isOatSpriteId(id), id).toBe(false);
  });

  it('songs, speakers and the sample group (AUDIO adds the recipes and the group)', () => {
    expect(Object.values(OAT_SONG)).toEqual(['oat-a', 'oat-b', 'oat-c', 'oat-d', 'oat-boss']);
    expect(OAT.music).toBe(OAT_SONG.a);
    expect(OAT.bossMusic).toBe(OAT_SONG.boss);
    expect(Object.keys(OAT_SPEAKER).length).toBe(12);
    expect(OAT_AUDIO_GROUP).toBe('mission:oat');
  });
});

describe('mission oat: the light kit start values (spec §8.3)', () => {
  it('a sun for every day section, left and in front (decision 37); none at night', () => {
    const table: Record<string, [number, number]> = { 'oat-a': [32, 40], 'oat-b': [40, 30], 'oat-c': [18, 45], 'oat-c1': [15, 45] };
    for (const [id, [e, yaw]] of Object.entries(table)) {
      const s = sectionSun(id)!;
      expect(s, id).toBeDefined();
      expect([s.elevation, s.yaw]).toEqual([e, yaw]);
      // Left (x < 0), up (y < 0 in the HD frame) and in front (z > 0).
      expect(s.key.key[0]).toBeLessThan(0);
      expect(s.key.key[1]).toBeLessThan(0);
      expect(s.key.key[2]).toBeGreaterThan(0);
    }
    expect(sectionSun('oat-c1')!.elevationEnd).toBe(11);
    expect(sectionSun('oat-d')).toBeUndefined();
    expect(sectionSun('oat-e')).toBeUndefined();
    expect(sectionSun('a')).toBeUndefined();
  });
});

describe('PAL_HD_OAT (additive; spec §8.5)', () => {
  it('11 ramps, 43 colours, ≤ 47 new; with PAL_HD ≤ 255 (a BgCanvas index is a byte, 0 = clear)', () => {
    expect(HD_OAT_RAMP_NAMES.length).toBe(11);
    const all = HD_OAT_RAMP_NAMES.flatMap((n) => [...PAL_HD_OAT[n]]);
    expect(all.length).toBe(43);
    expect(HD_OAT_NEW.length).toBeLessThanOrEqual(47);
    expect(HD_OAT_FULL_PALETTE.length).toBe(HD_PALETTE.length + HD_OAT_NEW.length);
    expect(HD_OAT_FULL_PALETTE.length).toBeLessThanOrEqual(255);
    expect(new Set(HD_OAT_FULL_PALETTE).size).toBe(HD_OAT_FULL_PALETTE.length);
  });

  it('every ramp rises in luma; the tone counts of the spec table', () => {
    const tones: Record<string, number> = { canal: 6, nightWater: 4, brick: 7, mortar: 4, green: 4, oxblood: 3, lantern: 4, redLight: 3, neonPink: 2, neonCyan: 2, nightSky: 4 };
    for (const n of HD_OAT_RAMP_NAMES) {
      const r = PAL_HD_OAT[n];
      expect(r.length, n).toBe(tones[n]);
      for (let i = 1; i < r.length; i++) expect(luma(r[i]), `${n}[${i}]`).toBeGreaterThan(luma(r[i - 1]));
    }
  });

  it('kept apart: HD_PALETTE (209), the oldenzaal sets and their lists are unchanged; no oat colour is an oldenzaal colour', () => {
    expect(HD_PALETTE.length).toBe(209);
    expect(HD_FULL_PALETTE.length).toBe(HD_PALETTE.length + HD_OZ_PALETTE.filter((c) => !HD_PALETTE.includes(c)).length);
    expect(HD_R2_FULL_PALETTE.length).toBe(HD_FULL_PALETTE.length + HD_OZ_R2_NEW.length);
    const oz = new Set<number>([...HD_OZ_PALETTE, ...HD_OZ_R2_NEW]);
    for (const c of HD_OAT_NEW) {
      expect(oz.has(c), c.toString(16)).toBe(false);
      expect(inOatPalette(c)).toBe(true);
      expect(inHdPalette(c)).toBe(true);
    }
    for (const c of HD_PALETTE) expect(inOatPalette(c)).toBe(true);
    for (const c of HD_OZ_PALETTE) if (!HD_PALETTE.includes(c)) expect(inOatPalette(c)).toBe(false);
    expect(Object.keys(PAL_HD)).not.toContain('nightWater');
  });
});

describe('mission oat: the bot runs the stub end to end', () => {
  it.each([1, 2] as const)('%iP god: complete, every section, no errors, the golden record picked up', async (players) => {
    const game = await createHeadlessGame({ missionId: OAT_ID, seed: 1, players, god: true, bot: true });
    try {
      for (let t = 0; t < 30000 && !game.done; t++) game.step(1);
    } finally {
      game.dispose();
    }
    const r = game.report();
    expect(r.errors).toEqual([]);
    expect(r.missionComplete).toBe(true);
    expect(r.sectionsVisited).toEqual([...OAT_SECTIONS]);
    expect(game.session.slots[0].mission.goldenRecord).toBe(true);
  }, 60000);
});
