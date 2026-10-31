/**
 * The engine opt-ins and contracts of the oat wave A (CORE; docs/design/oat.md §7.5, §8.3, §8.5,
 * §8.6, §8.9; docs/api/oat.md): every opt-in is additive, so its default draws byte for byte as
 * before — the sun of the HD canvas (`DEFAULT_SUN` = today's `KEY`), the BgCanvas colour set
 * (`HD_BG_PALETTE` = PAL_HD), the light API's neutral home (oldenzaal's module re-exports the very
 * same functions and registry) — plus the `€` glyph in both 1× fonts (and its HD masks), the euro
 * notation, the strip source registry and the stub store.
 */
import { describe, expect, it } from 'vitest';
import { getFont, glyphMask, measure } from '../../src/engine/font';
import { HD_OAT_FULL_PALETTE, HD_PALETTE, PAL_HD, PAL_HD_OAT, inOatPalette } from '../../src/engine/palette-hd';
import { PixelBuffer } from '../../src/engine/pixel';
import { HdCanvas } from '../../src/game/art/hd/canvas';
import { BOUNCE, DEFAULT_SUN, HALF, KEY, diffuse, specular, sunFrom } from '../../src/game/art/hd/light';
import { DISPLAY_MAX_CENTS, BUDGET_CATEGORIES, START_CENTS, euroText, pay } from '../../src/game/budget/index';
import * as ozLight from '../../src/game/content/oldenzaal/kit/light-api';
import { BgCanvas, HD_BG_PALETTE, bgPalette, colourOf, ix } from '../../src/game/content/missions/ams/art-hd-bg-kit';
import * as light from '../../src/game/mission/light/api';
import { createStripStore, defineStripSource, getStripSource, STRIP_CHUNK, type SectionStripsDef, type StripPlan } from '../../src/game/mission/strips/index';

describe('the € glyph (spec §7.5)', () => {
  it('both 1× fonts have it, as wide as a digit in small; HD masks at 2× and 4× stay in the cell', () => {
    for (const id of ['small', 'big'] as const) {
      const f = getFont(id);
      const g = f.glyph(0x20ac);
      expect(g.code, id).toBe(0x20ac);
      expect(g).not.toBe(f.glyph(63));
      // Last in the table: every older glyph keeps its index (the atlases).
      expect(g.index, id).toBe(f.glyphs.length - 1);
      expect(g.w).toBeLessThanOrEqual(f.maxW);
      for (const D of [2, 4] as const) {
        const m = glyphMask(f, g, D);
        expect(m.length).toBe(g.w * D * f.height * D);
        expect(m.some((v) => v !== 0)).toBe(true);
      }
    }
    expect(getFont('small').glyph(0x20ac).w).toBe(getFont('small').glyph(48).w);
    // The widest HUD text (spec §7.5: 19 glyphs) fits the 170 px of a side.
    expect(measure('BUDGET -€ 12.345,67', 'small')).toBeLessThanOrEqual(170);
  });
});

describe('the euro notation (budget/format.ts; BUDGET owns it)', () => {
  it('€ 1.234,56, the hyphen as minus, compact pop-ups, the display clamp', () => {
    expect(euroText(123456)).toBe('€ 1.234,56');
    expect(euroText(0)).toBe('€ 0,00');
    expect(euroText(5)).toBe('€ 0,05');
    expect(euroText(-1234)).toBe('-€ 12,34');
    expect(euroText(START_CENTS)).toBe('€ 100,00');
    expect(euroText(15, { plus: true, compact: true })).toBe('+€0,15');
    expect(euroText(-9500, { compact: true })).toBe('-€95');
    expect(euroText(-1234567)).toBe('-€ 12.345,67');
    expect(euroText(1e12)).toBe(euroText(DISPLAY_MAX_CENTS));
    expect(euroText(DISPLAY_MAX_CENTS)).toBe('€ 99.999,99');
    expect(euroText(1e12, { clamp: false })).toBe('€ 10.000.000.000,00');
    expect(BUDGET_CATEGORIES.length).toBeLessThanOrEqual(32);
    // The stub pay path is callable and inert (BUDGET implements it).
    expect(() => pay(null as never, 0, 15, 0, 0, 'deposit')).not.toThrow();
  });
});

describe('SunDef (art/hd/light.ts): the default is today\'s key light', () => {
  it('DEFAULT_SUN holds the very KEY, BOUNCE and HALF; diffuse / specular agree with and without it', () => {
    expect(DEFAULT_SUN.key).toBe(KEY);
    expect(DEFAULT_SUN.bounce).toBe(BOUNCE);
    expect(DEFAULT_SUN.half).toBe(HALF);
    for (const [x, y, z] of [[0, 0, 1], [-0.6, -0.6, 0.53], [0.7, 0.1, 0.7], [0, 1, 0]] as const) {
      expect(diffuse(x, y, z, 0.05, 1, 0.08, 0.22, 0.3, DEFAULT_SUN)).toBe(diffuse(x, y, z, 0.05, 1, 0.08, 0.22, 0.3));
      expect(specular(x, y, z, 24, DEFAULT_SUN)).toBe(specular(x, y, z, 24));
    }
  });

  it('HdCanvas.render: `sun: DEFAULT_SUN` gives the same pixels as no sun; another sun moves the light', () => {
    const draw = (sun?: typeof DEFAULT_SUN): PixelBuffer => {
      const c = new HdCanvas(24, 24, 4);
      const m = c.material({ ramp: PAL_HD.steel, spec: 0.6 });
      c.ellipsoid(12, 12, 9, 9, { mat: m });
      return c.render({ outline: 'A', shadow: 0.3, ...(sun ? { sun } : {}) });
    };
    const base = draw();
    expect(Array.from(draw(DEFAULT_SUN).data)).toEqual(Array.from(base.data));
    // A low sun from the right lights the right side instead.
    const right = draw(sunFrom(15, 45, BOUNCE));
    expect(Array.from(right.data)).not.toEqual(Array.from(base.data));
  });

  it('sunFrom: unit vectors, left and in front for the oat suns, higher sun = smaller |x|', () => {
    for (const [e, yaw] of [[32, 40], [40, 30], [18, 45], [11, 45]] as const) {
      const s = sunFrom(e, yaw);
      expect(Math.hypot(...s.key)).toBeCloseTo(1, 9);
      expect(Math.hypot(...s.half)).toBeCloseTo(1, 9);
      expect(s.key[0]).toBeLessThan(0);
      expect(s.key[1]).toBeLessThan(0);
      expect(s.key[2]).toBeGreaterThan(0);
      expect(s.bounce).toBe(BOUNCE);
    }
    expect(Math.abs(sunFrom(40, 30).key[1])).toBeGreaterThan(Math.abs(sunFrom(18, 45).key[1]));
  });
});

describe('BgCanvas colour sets (art-hd-bg-kit.ts)', () => {
  it('the default set is PAL_HD with the module functions: a default canvas finishes as before', () => {
    expect(HD_BG_PALETTE.colours).toBe(HD_PALETTE);
    expect(bgPalette(HD_PALETTE)).toBe(HD_BG_PALETTE);
    const paint = (c: BgCanvas): void => {
      c.rect(0, 0, 8, 4, ix(PAL_HD.steel[2]));
      c.rect(2, 2, 6, 4, ix(PAL_HD.wood[5]));
      c.dot(1, 7, ix(PAL_HD.moss[3]));
    };
    const a = new BgCanvas(8, 8, 2);
    const b = new BgCanvas(8, 8, 2, HD_BG_PALETTE);
    paint(a);
    paint(b);
    expect(Array.from(a.finish().data)).toEqual(Array.from(b.finish().data));
    expect(colourOf(ix(PAL_HD.steel[2]))).toBe(PAL_HD.steel[2]);
  });

  it('the oat set (PAL_HD ∪ PAL_HD_OAT) indexes the oat ramps exactly and snaps anything else into the set', () => {
    const oat = bgPalette(HD_OAT_FULL_PALETTE);
    expect(bgPalette(HD_OAT_FULL_PALETTE)).toBe(oat);
    expect(oat.colours.length).toBe(HD_OAT_FULL_PALETTE.length);
    const c = new BgCanvas(4, 4, 2, oat);
    c.rect(0, 0, 4, 2, oat.ix(PAL_HD_OAT.canal[2]));
    c.rect(0, 2, 4, 2, oat.ix(PAL_HD_OAT.brick[4]));
    const out = c.finish();
    expect(out.get(0, 0)).toBe(PAL_HD_OAT.canal[2]);
    expect(out.get(7, 7)).toBe(PAL_HD_OAT.brick[4]);
    expect(oat.colourOf(oat.ix(PAL_HD.steel[3]))).toBe(PAL_HD.steel[3]);
    expect(inOatPalette(oat.nearest(0x123456ff))).toBe(true);
    const t = oat.tableOf((col) => oat.ix(col));
    expect(t[oat.ix(PAL_HD_OAT.green[1])]).toBe(oat.ix(PAL_HD_OAT.green[1]));
    expect(() => bgPalette(Array.from({ length: 300 }, (_, i) => ((i * 0x010203) << 8) | 255))).toThrow();
  });
});

describe('the light API (mission/light/api.ts; oldenzaal re-exports it)', () => {
  it('one module: the same functions and the same registry', () => {
    expect(ozLight.defineSectionLight).toBe(light.defineSectionLight);
    expect(ozLight.sectionLight).toBe(light.sectionLight);
    expect(ozLight.LIGHT_TAG).toBe(light.LIGHT_TAG);
    expect(ozLight.bindLightControl).toBe(light.bindLightControl);
    expect(light.LIGHT_TAG).toBe('oz-light');
    const cfg = ozLight.defineSectionLight('test-oat-contract', { darkness: 0.3, tint: 0x000000ff });
    expect(light.sectionLight('test-oat-contract')).toBe(cfg);
    // The oat flags are optional (today's behaviour by default).
    expect(cfg.glow).toBeUndefined();
    expect(cfg.groups).toBeUndefined();
  });

  it('the sun registry and the spec shadow offsets (§8.3: cot e per metre)', () => {
    const s = light.defineSectionSun('test-oat-sun', { elevation: 32, yaw: 40, color: 0xffd9b6ff, key: sunFrom(32, 40) });
    expect(light.sectionSun('test-oat-sun')).toBe(s);
    const f = light.sunFloorShadow(s, 1, { du: 0, dv: 0 });
    expect(Math.hypot(f.du, f.dv)).toBeCloseTo(1.6, 2);
    expect(f.du).toBeGreaterThan(0);
    expect(f.dv).toBeLessThan(0);
    for (const [e, len] of [[40, 1.19], [18, 3.08]] as const) {
      const g = light.sunFloorShadow({ elevation: e, yaw: 30 }, 1, { du: 0, dv: 0 });
      expect(Math.hypot(g.du, g.dv)).toBeCloseTo(len, 2);
    }
    const w = light.sunWallShadow(s, 0.3, { dx: 0, dy: 0 });
    expect(w.dx).toBeGreaterThan(0);
    expect(w.dy).toBeGreaterThan(0);
  });

  it('the script calls are no-ops without a pass (and without the oat methods)', () => {
    const world = {} as never;
    expect(() => light.lampGroup(world, 'neon', 'off')).not.toThrow();
    expect(() => light.crossFadeLight(world, 'dark')).not.toThrow();
    const calls: string[] = [];
    light.bindLightControl(world, { flash: () => calls.push('flash'), setDarkness: () => calls.push('dark') });
    light.lampGroup(world, 'neon', 'off');
    light.crossFadeLight(world, 'dark', 60);
    light.lightning(world);
    expect(calls).toEqual(['flash']);
    light.bindLightControl(world, null);
  });
});

describe('the strips contract (mission/strips/)', () => {
  const def: SectionStripsDef = { source: 'test-oat-strips', depth: 16, height: 160, rows: [{ u0: 0, u1: 1024, sheet: '9-straatjes' }] };

  it('a registered source is planned by the store; the stub store holds and draws nothing', () => {
    const asked: string[] = [];
    const plan: StripPlan = {
      height: 160,
      covers: (cx) => cx * STRIP_CHUNK < 1024,
      bands: () => 1,
      paint: () => {},
    };
    defineStripSource('test-oat-strips', {
      plan(d, s) {
        asked.push(`${s.id}:${d.rows.length}`);
        return plan;
      },
    });
    expect(getStripSource('test-oat-strips')).toBeDefined();
    const store = createStripStore(def, { id: 'oat-a', width: 4608, seed: 1 });
    expect(asked).toEqual(['oat-a:1']);
    expect(store.plan).toBe(plan);
    store.prepare(0, 1);
    expect(store.chunk(0, 4)).toBeNull();
    expect(store.bytes).toBe(0);
    store.dispose();
  });

  it('an unknown or broken source fails soft: no plan, no throw', () => {
    expect(createStripStore({ ...def, source: 'no-such-source' }, { id: 'x', width: 512, seed: 1 }).plan).toBeNull();
    defineStripSource('test-oat-broken', {
      plan() {
        throw new Error('broken');
      },
    });
    expect(createStripStore({ ...def, source: 'test-oat-broken' }, { id: 'x', width: 512, seed: 1 }).plan).toBeNull();
  });
});
