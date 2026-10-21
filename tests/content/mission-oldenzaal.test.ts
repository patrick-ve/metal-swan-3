/**
 * Mission oldenzaal — level 4, MISSION 4 "A HAUNTING IN OTOWN" (docs/design/oldenzaal.md;
 * docs/api/oldenzaal.md): registration and card, the five section stubs (layouts, exits, the
 * vertical oz-e), the light configs, the ids and their owners' prefixes, the lines' limits, the
 * PAL_HD_OZ ramps (additive: PAL_HD and HD_PALETTE unchanged), the ghost draw and the light
 * contract, and the bot running the mission end to end (1P and 2P, god mode).
 */
import { describe, expect, it } from 'vitest';
import { luma } from '../../src/engine/color';
import { measure } from '../../src/engine/font';
import { PALETTE } from '../../src/engine/palette';
import { HD_FULL_PALETTE, HD_OZ_PALETTE, HD_OZ_RAMP_NAMES, HD_PALETTE, PAL_HD_OZ, hdHome, inHdPalette } from '../../src/engine/palette-hd';
import type { DrawOpts, Renderer } from '../../src/engine/render';
import { Terrain } from '../../src/engine/terrain';
import { World } from '../../src/engine/world';
import { loadContent } from '../../src/game/content/index';
import { OLDENZAAL, OZ_NAME } from '../../src/game/content/missions/oldenzaal/index';
import { OLDENZAAL_ID, OZ_ART_PREFIXES, OZ_SECTION, OZ_SECTIONS, OZ_SFX, OZ_SONG, OZ_SPRITES } from '../../src/game/content/missions/oldenzaal/ids';
import { FREED_LINES, MEAL_NAME, STORY_CARD_LINES, TBC_SUB, voicedLines, WINKEL_LINES, WU_LINES } from '../../src/game/content/missions/oldenzaal/lines';
import { OZ_E_FLOOR, OZ_E_LEDGES, ozELedgeY } from '../../src/game/content/missions/oldenzaal/terrain';
import { drawGhost, GHOST_TINT } from '../../src/game/content/oldenzaal/kit/ghost-draw';
import { bindLightControl, isLightSource, LIGHT_TAG, lightControl, lightning, sectionLight, setDarkness } from '../../src/game/content/oldenzaal/kit/light-api';
import { BUBBLE_LINE_CHARS } from '../../src/game/context';
import { getMission, listMissions } from '../../src/game/registry';
import { briefingLines } from '../../src/game/scenes/mission-intro';
import { missionCard, missionLabel } from '../../src/game/scenes/flow-data';
import { createHeadlessGame } from '../../src/sim/index';
import type { Entity } from '../../src/engine/entity';

await loadContent();

describe('mission oldenzaal: registration and card', () => {
  it('is registered as MISSION 4 "A HAUNTING IN OTOWN" with five sections oz-a … oz-e', () => {
    expect(getMission(OLDENZAAL_ID)).toBe(OLDENZAAL);
    expect(OLDENZAAL.name).toBe('A HAUNTING IN OTOWN');
    expect(OZ_NAME).toBe(OLDENZAAL.name);
    expect(Object.keys(OLDENZAAL.sections)).toEqual(['oz-a', 'oz-b', 'oz-c', 'oz-d', 'oz-e']);
    expect([...OZ_SECTIONS]).toEqual(['oz-a', 'oz-b', 'oz-c', 'oz-d', 'oz-e']);
    expect(OLDENZAAL.start).toBe('oz-a');
    expect(OLDENZAAL.bossSection).toBe('oz-c');
    expect(OLDENZAAL.introDrop).toBe(true);
    expect(OLDENZAAL.artDensity).toBe(4);
    expect(OLDENZAAL.music).toBe(OZ_SONG.theme);
    expect(OLDENZAAL.next).toBeUndefined();
    expect(OLDENZAAL.after).toBeUndefined();
    for (const [id, s] of Object.entries(OLDENZAAL.sections)) expect(s.id).toBe(id);
    // The m5 trap: listMissions sorts ids, oldenzaal comes after m5 (flow.ts filters it).
    const ids = listMissions();
    expect(ids.indexOf('oldenzaal')).toBeGreaterThan(ids.indexOf('m5'));
  });

  it('the card: MISSION 4, the title, OLDENZAAL, a briefing that fits the radio box, a map dot', () => {
    const card = missionCard(OLDENZAAL_ID);
    expect(card.label).toBe('MISSION 4');
    expect(missionLabel(OLDENZAAL_ID)).toBe('MISSION 4');
    expect(card.name).toBe('A HAUNTING IN OTOWN');
    expect(card.place).toContain('OLDENZAAL');
    expect(card.briefing.length).toBe(2);
    expect(briefingLines(card).length).toBeLessThanOrEqual(4);
    expect(briefingLines(card).join(' ')).toBe(card.briefing.join(' '));
    expect(measure(card.headline, 'small')).toBeLessThanOrEqual(340);
    const [x, y] = card.map!.dot;
    expect(x).toBeGreaterThan(0);
    expect(x).toBeLessThan(384);
    expect(y).toBeGreaterThan(54);
    expect(y).toBeLessThan(120);
  });
});

describe('mission oldenzaal: the section stubs', () => {
  it.each(['oz-a', 'oz-b', 'oz-c', 'oz-d'])('%s: a right-scrolling street with the start on the floor and checkpoints ≤ 1,400 px apart', (id) => {
    const s = OLDENZAAL.sections[id];
    expect(s.scroll).toBe('right');
    expect(s.height).toBe(216);
    const t = new Terrain(s.terrain);
    expect(t.surfaceY(s.playerStart.x, s.playerStart.y - 4, s.playerStart.y + 4)).toBe(s.playerStart.y);
    const cps = [0, ...(s.checkpoints ?? []), s.width - 384];
    for (let i = 1; i < cps.length; i++) expect(Math.abs(cps[i] - cps[i - 1]), `${id} checkpoint ${i}`).toBeLessThanOrEqual(1400);
    for (const ex of s.exits ?? []) {
      expect(ex.rect.x).toBeGreaterThanOrEqual(0);
      expect(ex.rect.x + ex.rect.w).toBeLessThanOrEqual(s.width);
    }
  });

  it('oz-e is a vertical "up" section whose top ledge is inside the exit that completes the mission', () => {
    const s = OLDENZAAL.sections[OZ_SECTION.e];
    expect(s.scroll).toBe('up');
    expect(s.height).toBeGreaterThan(216);
    const t = new Terrain(s.terrain);
    expect(t.surfaceY(s.playerStart.x, s.playerStart.y - 4, s.playerStart.y + 4)).toBe(OZ_E_FLOOR);
    // The m3-b1 staircase rule: every ledge more than 20 px above the one before.
    for (let k = 1; k <= OZ_E_LEDGES; k++) expect(ozELedgeY(k - 1) - ozELedgeY(k)).toBeGreaterThan(20);
    const exit = s.exits!.find((e) => e.to === 'complete')!;
    expect(exit).toBeDefined();
    const top = ozELedgeY(OZ_E_LEDGES);
    expect(top).toBeGreaterThanOrEqual(exit.rect.y);
    expect(top).toBeLessThanOrEqual(exit.rect.y + exit.rect.h);
  });

  it('every section opts in to the light pass with a readable darkness (≤ 0.7)', () => {
    for (const id of OZ_SECTIONS) {
      const l = sectionLight(id);
      expect(l, id).toBeDefined();
      expect(l!.darkness).toBeGreaterThan(0);
      expect(l!.darkness).toBeLessThanOrEqual(0.7);
    }
    // Other missions never register one (they draw as today).
    for (const id of ['a', 'b', 'c', 'd']) expect(sectionLight(id)).toBeUndefined();
  });
});

describe('mission oldenzaal: ids, lines and palette', () => {
  it('the owners\' sprite prefixes never overlap and are all in the mission art list', () => {
    const all = Object.values(OZ_SPRITES).flat();
    for (const a of all) for (const b of all) if (a !== b) expect(a.startsWith(b), `${a} under ${b}`).toBe(false);
    for (const p of OZ_ART_PREFIXES) expect(OLDENZAAL.art).toContain(p);
    for (const p of Object.values(OZ_SFX)) expect(p.startsWith('oz/')).toBe(true);
  });

  it('speech lines fit a bubble (≤ 24 characters × 2 lines); story lines fit one row (≤ 352 px)', () => {
    const bubbles = [...WU_LINES, ...Object.values(WINKEL_LINES), ...FREED_LINES, ...voicedLines().map((l) => l.text)];
    for (const b of bubbles) {
      const rows = b.split('\n');
      expect(rows.length, b).toBeLessThanOrEqual(2);
      for (const r of rows) expect(r.length, r).toBeLessThanOrEqual(BUBBLE_LINE_CHARS);
    }
    expect(WU_LINES.length).toBeGreaterThanOrEqual(4);
    expect(WU_LINES.length).toBeLessThanOrEqual(6);
    expect(STORY_CARD_LINES.length).toBeGreaterThanOrEqual(3);
    expect(STORY_CARD_LINES.length).toBeLessThanOrEqual(5);
    for (const l of [...STORY_CARD_LINES, TBC_SUB]) expect(measure(l, 'small'), l).toBeLessThanOrEqual(352);
    expect(MEAL_NAME).toBe('PATAT MAYO MET 2 FRIKANDELLEN');
    expect(FREED_LINES).toContain('BEDANKT!');
    expect(FREED_LINES).toContain('WAT IS ER GEBEURD?');
  });

  it('PAL_HD_OZ: 6–8 tones per ramp, rising luma, only new colours, PAL_HD + PAL_HD_OZ ≤ 256', () => {
    const base = new Set(HD_PALETTE.map((c) => c >>> 0));
    expect(HD_PALETTE.length).toBe(209);
    for (const n of HD_OZ_RAMP_NAMES) {
      const r = PAL_HD_OZ[n];
      expect(r.length, n).toBeGreaterThanOrEqual(6);
      expect(r.length, n).toBeLessThanOrEqual(8);
      for (let i = 1; i < r.length; i++) expect(luma(r[i]), `${n}[${i}]`).toBeGreaterThan(luma(r[i - 1]));
      for (const c of r) {
        expect(base.has(c >>> 0), `${n} ${c.toString(16)}`).toBe(false);
        expect(inHdPalette(c)).toBe(true);
      }
    }
    expect(new Set(HD_OZ_PALETTE).size).toBe(HD_OZ_PALETTE.length);
    expect(HD_FULL_PALETTE.length).toBe(HD_PALETTE.length + HD_OZ_PALETTE.length);
    expect(HD_FULL_PALETTE.length).toBeLessThanOrEqual(256);
    for (const n of ['sandstone', 'dusk', 'ghost', 'candle', 'night']) expect(HD_OZ_RAMP_NAMES).toContain(n);
    // The 64 swatches keep their HD homes (no oz ramp holds one).
    for (const c of PALETTE) expect(HD_OZ_PALETTE.includes(c)).toBe(false);
    for (const c of PALETTE) expect(hdHome(c)).not.toBeNull();
  });
});

describe('the kit: ghost draw and light contract', () => {
  it('drawGhost: the body at alpha 0.5, then the additive green silhouette; a fade of 0 draws nothing', () => {
    const calls: Array<{ id: string; o: DrawOpts }> = [];
    const r = { sprite: (id: string, _f: number, _x: number, _y: number, o: DrawOpts) => calls.push({ id, o: { ...o } }) } as unknown as Renderer;
    drawGhost(r, 'fx/poof', 0, 10, 20, { flipX: true });
    expect(calls.length).toBe(2);
    expect(calls[0].o.alpha).toBeCloseTo(0.5);
    expect(calls[0].o.blend).toBeUndefined();
    expect(calls[0].o.flipX).toBe(true);
    expect(calls[1].o.blend).toBe('add');
    expect(calls[1].o.tint).toBe(GHOST_TINT);
    calls.length = 0;
    drawGhost(r, 'fx/poof', 0, 10, 20, { alpha: 0 });
    expect(calls.length).toBe(0);
    // A glow sprite that is not defined is skipped; no tint pass with tint: null.
    drawGhost(r, 'fx/poof', 0, 10, 20, { glow: 'fx/oz/light/none', tint: null });
    expect(calls.length).toBe(1);
  });

  it('light control: no-ops without a pass; a bound pass gets flashes and darkness changes', () => {
    const w = new World({});
    expect(lightControl(w)).toBeNull();
    lightning(w, 1);
    setDarkness(w, 0.4);
    const got: string[] = [];
    bindLightControl(w, { flash: (s) => got.push(`flash ${s}`), setDarkness: (d, f) => got.push(`dark ${d} ${f}`) });
    lightning(w, 0.5);
    setDarkness(w, 0.3, 30);
    expect(got).toEqual(['flash 0.5', 'dark 0.3 30']);
    bindLightControl(w, null);
    expect(lightControl(w)).toBeNull();
    const tags = new Set<string>();
    const e = { hasTag: (t: string) => tags.has(t) } as unknown as Entity;
    expect(isLightSource(e)).toBe(false);
    tags.add(LIGHT_TAG);
    expect(isLightSource(e)).toBe(false);
    (e as unknown as { lightOf: () => boolean }).lightOf = () => true;
    expect(isLightSource(e)).toBe(true);
  });
});

describe('mission oldenzaal: the bot plays the placeholders end to end', () => {
  it.each([1, 2] as const)('%iP god: oz-a → oz-b → oz-c → oz-d → oz-e → MISSION COMPLETE, no errors', async (players) => {
    const g = await createHeadlessGame({ missionId: OLDENZAAL_ID, seed: 1, players, god: true, bot: true, captureConsole: true });
    const seen: string[] = [];
    g.runUntil((gg) => {
      const s = gg.runner?.section.id;
      if (s && seen[seen.length - 1] !== s) seen.push(s);
      return gg.missionComplete;
    }, 30000);
    expect(seen).toEqual(['oz-a', 'oz-b', 'oz-c', 'oz-d', 'oz-e']);
    expect(g.missionComplete).toBe(true);
    expect(g.report().errors).toEqual([]);
    g.dispose();
  }, 120000);

  it.each(['oz-b', 'oz-c', 'oz-d', 'oz-e'])('a direct start at %s (&section=) completes too', async (section) => {
    const g = await createHeadlessGame({ missionId: OLDENZAAL_ID, sectionId: section, seed: 2, players: 1, god: true, bot: true, captureConsole: true });
    expect(g.runner?.section.id).toBe(section);
    g.runUntil((gg) => gg.missionComplete, 20000);
    expect(g.missionComplete).toBe(true);
    expect(g.report().errors).toEqual([]);
    g.dispose();
  }, 120000);
});
