/**
 * Mission oldenzaal — level 4, MISSION 4 "A HAUNTING IN OTOWN" (docs/design/oldenzaal.md;
 * docs/api/oldenzaal.md): registration and card, the six sections of revision 2 (layouts, exits,
 * the crypt oz-e, the vertical tower oz-f), the light configs, the ids and their owners' prefixes,
 * the lines' limits (revision 2: no townspeople voiced, Winkel's wake lines, the statue's lines),
 * the PAL_HD_OZ and PAL_HD_OZ_R2 ramps (additive: PAL_HD, HD_PALETTE and HD_FULL_PALETTE
 * unchanged), the ghost draw and the light contract, and the bot running the mission end to end
 * (1P and 2P, god mode).
 */
import { describe, expect, it } from 'vitest';
import { luma } from '../../src/engine/color';
import { measure } from '../../src/engine/font';
import { PALETTE } from '../../src/engine/palette';
import {
  HD_FULL_PALETTE,
  HD_OZ_PALETTE,
  HD_OZ_R2_NEW,
  HD_OZ_R2_RAMP_NAMES,
  HD_OZ_RAMP_NAMES,
  HD_PALETTE,
  HD_R2_FULL_PALETTE,
  PAL_HD,
  PAL_HD_OZ,
  PAL_HD_OZ_R2,
  hdHome,
  inHdPalette,
} from '../../src/engine/palette-hd';
import type { DrawOpts, Renderer } from '../../src/engine/render';
import { Terrain } from '../../src/engine/terrain';
import { World } from '../../src/engine/world';
import { loadContent } from '../../src/game/content/index';
import { OLDENZAAL, OZ_NAME } from '../../src/game/content/missions/oldenzaal/index';
import { OLDENZAAL_ID, OZ_ART_PREFIXES, OZ_SECTION, OZ_SECTIONS, OZ_SFX, OZ_SONG, OZ_SPRITES, OZ_ZOMBIES } from '../../src/game/content/missions/oldenzaal/ids';
import {
  MEAL_NAME,
  PLECHELMUS_LINES,
  STORY_CARD_LINES,
  TBC_SUB,
  voicedLines,
  WINKEL_LINES,
  WINKEL_WAKE_LINES,
  WU_LINES,
} from '../../src/game/content/missions/oldenzaal/lines';
import { OZ_F_FLOOR, OZ_F_H, OZ_F_LEDGES, ozFLedgeY } from '../../src/game/content/missions/oldenzaal/section-oz-f';
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
  it('is registered as MISSION 4 "A HAUNTING IN OTOWN" with six sections oz-a … oz-f (revision 2)', () => {
    expect(getMission(OLDENZAAL_ID)).toBe(OLDENZAAL);
    expect(OLDENZAAL.name).toBe('A HAUNTING IN OTOWN');
    expect(OZ_NAME).toBe(OLDENZAAL.name);
    expect(Object.keys(OLDENZAAL.sections)).toEqual(['oz-a', 'oz-b', 'oz-c', 'oz-d', 'oz-e', 'oz-f']);
    expect([...OZ_SECTIONS]).toEqual(['oz-a', 'oz-b', 'oz-c', 'oz-d', 'oz-e', 'oz-f']);
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

describe('mission oldenzaal: the sections', () => {
  it.each(['oz-a', 'oz-b', 'oz-c', 'oz-d', 'oz-e'])('%s: a right-scrolling street with the start on the floor and checkpoints ≤ 1,400 px apart', (id) => {
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

  it('oz-e is the crypt (revision 2): right-scrolling, the darkest section, candle lamps, no rain', () => {
    const s = OLDENZAAL.sections[OZ_SECTION.e];
    expect(s.name).toMatch(/crypt/i);
    expect(s.scroll).toBe('right');
    const l = sectionLight(OZ_SECTION.e)!;
    for (const id of OZ_SECTIONS) if (id !== OZ_SECTION.e) expect(l.darkness, id).toBeGreaterThanOrEqual(sectionLight(id)!.darkness);
    expect(l.lamps?.length).toBeGreaterThan(0);
    expect(l.rain).toBeUndefined();
  });

  it('oz-f is the tower: a vertical "up" section of about 384 × 1,800 whose top ledge is inside the exit that completes the mission', () => {
    const s = OLDENZAAL.sections[OZ_SECTION.f];
    expect(s.scroll).toBe('up');
    expect(s.width).toBe(384);
    expect(s.height).toBe(OZ_F_H);
    expect(OZ_F_H).toBeGreaterThanOrEqual(1700);
    expect(s.music).toBe(OZ_SONG.tower);
    const t = new Terrain(s.terrain);
    expect(t.surfaceY(s.playerStart.x, s.playerStart.y - 4, s.playerStart.y + 4)).toBe(OZ_F_FLOOR);
    // The m3-b1 staircase rule: every ledge more than 20 px above the one before.
    for (let k = 1; k <= OZ_F_LEDGES; k++) expect(ozFLedgeY(k - 1) - ozFLedgeY(k)).toBeGreaterThan(20);
    const exit = s.exits!.find((e) => e.to === 'complete')!;
    expect(exit).toBeDefined();
    const top = ozFLedgeY(OZ_F_LEDGES);
    expect(top).toBeGreaterThanOrEqual(exit.rect.y);
    expect(top).toBeLessThanOrEqual(exit.rect.y + exit.rect.h);
    // Checkpoints (camera-centre y) ≤ 1,400 px apart from the start to the top.
    const cps = [s.height - 108, ...(s.checkpoints ?? []), 108];
    for (let i = 1; i < cps.length; i++) expect(Math.abs(cps[i] - cps[i - 1])).toBeLessThanOrEqual(1400);
    // The storm light moved here with the tower.
    expect(sectionLight(OZ_SECTION.f)!.rain).toBeDefined();
    expect(sectionLight(OZ_SECTION.f)!.lightning).toBeDefined();
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
    const all: string[] = Object.values(OZ_SPRITES).flat();
    for (const k of ['zombies', 'ruin', 'statue', 'church', 'tower'] as const) expect(OZ_SPRITES[k].length, k).toBeGreaterThan(0);
    for (const a of all) for (const b of all) if (a !== b) expect(a.startsWith(b), `${a} under ${b}`).toBe(false);
    for (const p of OZ_ART_PREFIXES) expect(OLDENZAAL.art).toContain(p);
    for (const p of Object.values(OZ_SFX)) expect(p.startsWith('oz/')).toBe(true);
    // Revision 2: the MG zombie never reuses the wave-A possessed gunner's id.
    expect(OZ_ZOMBIES.gunner).toBe('oz-mg');
    expect(new Set(Object.values(OZ_ZOMBIES)).size).toBe(Object.values(OZ_ZOMBIES).length);
  });

  it('speech lines fit a bubble (≤ 24 characters × 2 lines); story lines fit one row (≤ 352 px)', () => {
    const bubbles = [...WU_LINES, ...Object.values(WINKEL_LINES), ...Object.values(PLECHELMUS_LINES), ...voicedLines().map((l) => l.text)];
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
  });

  it('revision 2 lines: Wu keeps the fryer going, Winkel has 2–3 wake lines, the statue 1–3, no souls or townspeople voiced', () => {
    const wu = WU_LINES.join(' ').replace(/\n/g, ' ');
    expect(wu).toContain('IK SLUIT PAS OM TIEN UUR.');
    expect(wu).toMatch(/WINKEL/);
    expect(wu).not.toMatch(/SOUL|POSSESS|CRAWL INTO/);
    expect(WINKEL_WAKE_LINES.length).toBeGreaterThanOrEqual(2);
    expect(WINKEL_WAKE_LINES.length).toBeLessThanOrEqual(3);
    expect(Object.values(PLECHELMUS_LINES).length).toBeGreaterThanOrEqual(1);
    expect(Object.values(PLECHELMUS_LINES).length).toBeLessThanOrEqual(3);
    const story = STORY_CARD_LINES.join(' ');
    expect(story).toMatch(/GHOST/);
    expect(story).toMatch(/DEAD/);
    expect(story).toMatch(/CHUTES/);
    const voiced = voicedLines().map((l) => l.text);
    // The wave-A roof line and the townspeople are gone (spec R2-6).
    expect(Object.keys(WINKEL_LINES)).not.toContain('roof');
    expect(voiced.join(' ')).not.toMatch(/BEDANKT|NIET SCHIETEN|WELKOM/);
    for (const l of WINKEL_WAKE_LINES) expect(voiced).toContain(l);
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

  it('PAL_HD_OZ_R2 (revision 2): rot, field grey, rust, soot; 6–8 tones, rising luma; few new colours; the older palettes unchanged; ≤ 256 in all', () => {
    for (const n of ['rot', 'fieldGrey', 'rust', 'soot']) expect(HD_OZ_R2_RAMP_NAMES).toContain(n);
    for (const n of HD_OZ_R2_RAMP_NAMES) {
      const r = PAL_HD_OZ_R2[n];
      expect(r.length, n).toBeGreaterThanOrEqual(6);
      expect(r.length, n).toBeLessThanOrEqual(8);
      for (let i = 1; i < r.length; i++) expect(luma(r[i]), `${n}[${i}]`).toBeGreaterThan(luma(r[i - 1]));
      for (const c of r) expect(inHdPalette(c), `${n} ${c.toString(16)}`).toBe(true);
    }
    expect(PAL_HD_OZ_R2.rust).toBe(PAL_HD.rust);
    // Additive: the older lists keep their sizes, so no nearest-colour search changes a pixel.
    expect(HD_PALETTE.length).toBe(209);
    expect(HD_OZ_PALETTE.length).toBe(37);
    expect(HD_FULL_PALETTE.length).toBe(246);
    const old = new Set([...HD_PALETTE, ...HD_OZ_PALETTE].map((c) => c >>> 0));
    for (const c of HD_OZ_R2_NEW) expect(old.has(c >>> 0), c.toString(16)).toBe(false);
    expect(HD_OZ_R2_NEW.length).toBeLessThanOrEqual(10);
    expect(new Set(HD_R2_FULL_PALETTE).size).toBe(HD_R2_FULL_PALETTE.length);
    expect(HD_R2_FULL_PALETTE.length).toBeLessThanOrEqual(256);
    for (const c of PALETTE) expect(HD_OZ_R2_NEW.includes(c)).toBe(false);
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
  it.each([1, 2] as const)('%iP god: oz-a → oz-b → oz-c → oz-d → oz-e → oz-f → MISSION COMPLETE, no errors', async (players) => {
    const g = await createHeadlessGame({ missionId: OLDENZAAL_ID, seed: 1, players, god: true, bot: true, captureConsole: true });
    const seen: string[] = [];
    g.runUntil((gg) => {
      const s = gg.runner?.section.id;
      if (s && seen[seen.length - 1] !== s) seen.push(s);
      return gg.missionComplete;
    }, 30000);
    expect(seen).toEqual(['oz-a', 'oz-b', 'oz-c', 'oz-d', 'oz-e', 'oz-f']);
    expect(g.missionComplete).toBe(true);
    expect(g.report().errors).toEqual([]);
    g.dispose();
  }, 120000);

  it.each(['oz-b', 'oz-c', 'oz-d', 'oz-e', 'oz-f'])('a direct start at %s (&section=) completes too', async (section) => {
    const g = await createHeadlessGame({ missionId: OLDENZAAL_ID, sectionId: section, seed: 2, players: 1, god: true, bot: true, captureConsole: true });
    expect(g.runner?.section.id).toBe(section);
    g.runUntil((gg) => gg.missionComplete, 20000);
    expect(g.missionComplete).toBe(true);
    expect(g.report().errors).toEqual([]);
    g.dispose();
  }, 120000);
});
