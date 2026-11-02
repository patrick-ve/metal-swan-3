/**
 * The shade function of mission oat (docs/design/oat.md §8.3, §8.4; docs/api/oat.md §10): the sun's
 * shadow numbers per section, the opposite row's line on our façade (H_s = H_opp − W · tan e / sin
 * yaw), the floor in the narrow streets of a, the thin sun strip of b, the shade of c and c1, open
 * stretches in full sun, the casters (posts, boxes, crowns, plates), the mixed façade scale, hard
 * edges at 1× and soft ones at 2× / 4×, and the night sections that never shade.
 */
import { afterEach, describe, expect, it } from 'vitest';
import '../../src/game/content/missions/oat/light/index';
import {
  facadeMetres,
  facadePx,
  lotProfile,
  proceduralLots,
  shadowLine,
  SHEET_9_STRAATJES,
  skylineFromLots,
  StreetShade,
  sunGeom,
  wallShadowPx,
  type StreetShadeDef,
} from '../../src/game/content/missions/oat/light/shadow';
import { resetSectionShade, sectionShade, shadeCamera, shadeSpan, OAT_STREETS } from '../../src/game/content/missions/oat/light/section-shade';
import { OAT_SUN } from '../../src/game/content/missions/oat/light/index';

/** A flat opposite row of `h` metres everywhere (gap: none). */
function flat(h: number, w: number, sun = { elevation: 32, yaw: 40 }, extra: Partial<StreetShadeDef> = {}): StreetShade {
  return new StreetShade({ sun, width: 1024, streets: [{ u0: 0, u1: 1024, w }], opposite: () => h, vFacade: 0, vOpposite: 100, ...extra });
}

afterEach(() => resetSectionShade());

describe('the sun numbers (spec §8.3)', () => {
  it('floor shadow per metre of height: a 1.60, b 1.19, c 3.08, c1 3.73 → 5.14', () => {
    expect(sunGeom(32, 40).length).toBeCloseTo(1.6, 2);
    expect(sunGeom(40, 30).length).toBeCloseTo(1.19, 2);
    expect(sunGeom(18, 45).length).toBeCloseTo(3.08, 2);
    expect(sunGeom(15, 45).length).toBeCloseTo(3.73, 2);
    expect(sunGeom(11, 45).length).toBeCloseTo(5.14, 2);
  });

  it('the parts agree with the light API offsets (Δu = h cot e cos yaw, Δv = −h cot e sin yaw)', () => {
    const g = sunGeom(32, 40);
    expect(g.right).toBeCloseTo(1.6003 * Math.cos((40 * Math.PI) / 180), 3);
    expect(g.back).toBeCloseTo(1.6003 * Math.sin((40 * Math.PI) / 180), 3);
    expect(g.left).toBeCloseTo(1 / Math.tan((40 * Math.PI) / 180), 4);
    expect(g.rise).toBeCloseTo(Math.tan((32 * Math.PI) / 180) / Math.sin((40 * Math.PI) / 180), 4);
  });

  it('the opposite row line H_s: a ≈ 4.5 m, b below the base (lit), c ≈ 2.4 m, c1 4.3 → 6.7 m', () => {
    expect(shadowLine(sunGeom(32, 40), 12.5, 8.2)).toBeCloseTo(4.5, 1);
    expect(shadowLine(sunGeom(40, 30), 12.5, 8)).toBeLessThan(0);
    expect(shadowLine(sunGeom(18, 45), 13, 23)).toBeCloseTo(2.4, 1);
    expect(shadowLine(sunGeom(15, 45), 13, 23)).toBeCloseTo(4.3, 1);
    expect(shadowLine(sunGeom(11, 45), 13, 23)).toBeCloseTo(6.7, 1);
  });

  it('the sun table registers a, b, c, c1 and no sun for d and e (the sun stays LEFT: yaw 30–45)', () => {
    expect(Object.keys(OAT_SUN).sort()).toEqual(['oat-a', 'oat-b', 'oat-c', 'oat-c1']);
    for (const s of Object.values(OAT_SUN)) expect(s.yaw).toBeGreaterThanOrEqual(30);
    expect(sectionShade('oat-d').geom).toBeNull();
    expect(sectionShade('oat-e').floor(500, 10)).toBe(0);
    expect(sectionShade('oat-d').facade(500, 3)).toBe(0);
  });
});

describe('the mixed façade scale (spec §8.2)', () => {
  it('20 px/m to the band top, 8 px/m above; the conversions invert', () => {
    expect(facadeMetres(40, 72)).toBeCloseTo(2, 6);
    expect(facadeMetres(72 + 24, 72)).toBeCloseTo(3.6 + 3, 6);
    for (const m of [0, 1.2, 3.6, 5, 12.5, 16.2]) expect(facadeMetres(facadePx(m, 72), 72)).toBeCloseTo(m, 6);
  });

  it('wall shadows: a cornice in the upper band, an awning in the ground band (down-right for the left sun)', () => {
    const g = sunGeom(32, 40);
    const o = { dx: 0, dy: 0 };
    wallShadowPx(g, 0.5, 160, 72, o); // a 0.5 m cornice high up: 12 px/m across, 8 px/m down
    expect(o.dx).toBeCloseTo(0.5 * g.left * 12, 4);
    expect(o.dy).toBeCloseTo(0.5 * g.rise * 8, 4);
    wallShadowPx(g, 1.5, 52, 72, o); // a 1.5 m awning at 2.6 m: true scale
    expect(o.dx).toBeCloseTo(1.5 * g.left * 20, 4);
    expect(o.dy).toBeCloseTo(1.5 * g.rise * 20, 4);
  });
});

describe('the street model (spec §8.4)', () => {
  it('a (32°): the narrow street floor lies in shade, our façade is lit above about 4.5 m', () => {
    const s = flat(12.5, 8.2);
    for (const v of [0, 20, 50, 80, 99]) expect(s.floor(500, v, 1)).toBe(1);
    expect(s.facade(500, 3, 1)).toBe(1);
    expect(s.facade(500, 6, 1)).toBe(0);
    expect(s.facadeLine(500)).toBeCloseTo(4.5, 1);
  });

  it('b (40°): a thin strip of sun (about 0.5 m) at the façade foot, the rest of the street in shade', () => {
    const s = flat(12.5, 8, { elevation: 40, yaw: 30 });
    // z = 8 · v / 100: the strip ends at z ≈ 0.55 m → v ≈ 6.9.
    expect(s.floor(500, 2, 1)).toBe(0);
    expect(s.floor(500, 10, 1)).toBe(1);
    expect(s.facade(500, 0.1, 1)).toBe(0);
  });

  it('open stretches (bridges, vistas) are in full sun; gaps in the opposite row let sun shafts through', () => {
    const s = new StreetShade({
      sun: { elevation: 32, yaw: 40 },
      width: 2048,
      streets: [{ u0: 0, u1: 1000, w: 8.2 }, { u0: 1000, u1: 1200, w: 10, open: true }],
      opposite: (u) => (u > 400 && u < 440 ? 0 : 12.5),
      vFacade: 0,
      vOpposite: 100,
    });
    expect(s.floor(1100, 50, 1)).toBe(0);
    expect(s.facadeLine(1100)).toBe(-Infinity);
    // The gap at 400–440 lands on our façade W · cot yaw · 20 px to the right.
    const shift = 8.2 * sunGeom(32, 40).left * 20;
    expect(s.facade(420 + shift, 1, 1)).toBe(0);
    expect(s.facade(300 + shift, 1, 1)).toBe(1);
  });

  it('c and c1: the shade covers the floor; the shade line climbs as the c1 sun sinks', () => {
    const c = sectionShade('oat-c');
    const span = shadeSpan(shadeCamera('oat-c'));
    for (const t of [0.05, 0.5, 0.95]) expect(c.floor(1000, span.vFacade + (span.vOpposite - span.vFacade) * t, 1)).toBe(1);
    const c1 = sectionShade('oat-c1');
    // Seeded skyline: compare one u's line at the start and the end of the chase (same eaves → it climbs).
    const h0 = c1.facadeLine(20);
    const s0 = sunGeom(15, 45);
    const s1 = sunGeom(11, 45);
    expect(h0).toBeCloseTo(c1.skylineAt(20 - 23 * s0.left * 20) - 23 * s0.rise, 1);
    const end = 4000;
    expect(c1.facadeLine(end)).toBeGreaterThan(c1.skylineAt(end - 23 * s1.left * 20) - 23 * s1.rise - 0.4);
  });

  it('casters: a post, a box, a crown and a plate cast where the sun puts them (right and back)', () => {
    const g = sunGeom(32, 40);
    const s = new StreetShade({
      sun: { elevation: 32, yaw: 40 },
      width: 2048,
      streets: [],
      opposite: () => 0,
      vFacade: 0,
      vOpposite: 100,
      openDepth: 10,
      casters: [
        { kind: 'post', u: 200, z: 6, h: 4, r: 0.08 },
        { kind: 'box', u0: 600, u1: 640, z0: 6, z1: 7, h: 1 },
        { kind: 'crown', u: 1000, z: 8, h: 3, r: 1 },
        { kind: 'plate', u0: 1400, u1: 1500, z0: 5, z1: 7, h: 2 },
      ],
    });
    const vOf = (z: number): number => z * 10;
    // Post: halfway up its shadow.
    expect(s.floor(200 + 2 * g.right * 20, vOf(6 - 2 * g.back), 1)).toBe(1);
    expect(s.floor(200 - 30, vOf(6), 1)).toBe(0);
    // Box: just behind-right of it.
    expect(s.floor(620 + 0.5 * g.right * 20, vOf(6.5 - 0.5 * g.back), 1)).toBe(1);
    // Crown centre's shadow.
    expect(s.floor(1000 + 3 * g.right * 20, vOf(8 - 3 * g.back), 1)).toBe(1);
    // Plate: its footprint moved by h along the sun.
    expect(s.floor(1450 + 2 * g.right * 20, vOf(6 - 2 * g.back), 1)).toBe(1);
    expect(s.floor(1450, vOf(6), 1)).toBe(0);
    // A post near the wall climbs it: the post at z 1, its top 4 m → on the wall up to 4 − rise.
    const w = new StreetShade({ sun: { elevation: 32, yaw: 40 }, width: 1024, streets: [], opposite: () => 0, vFacade: 0, vOpposite: 100, casters: [{ kind: 'post', u: 300, z: 1, h: 4, r: 0.1 }] });
    expect(w.facade(300 + 1 * g.left * 20, 2, 1)).toBe(1);
    expect(w.facade(300 + 1 * g.left * 20, 4 - g.rise + 0.3, 1)).toBe(0);
  });

  it('hard edges at 1×, a soft penumbra at 2× / 4× (values between 0 and 1 only near the edge)', () => {
    const s = flat(12.5, 8.2);
    const line = s.facadeLine(500);
    expect(s.facade(500, line - 0.5, 4)).toBe(1);
    expect(s.facade(500, line + 0.5, 4)).toBe(0);
    const mid = s.facade(500, line, 4);
    expect(mid).toBeGreaterThan(0.2);
    expect(mid).toBeLessThan(0.8);
    expect([0, 1]).toContain(s.facade(500, line, 1));
  });

  it('is pure: the same inputs give the same numbers (and the section model is cached)', () => {
    const a = sectionShade('oat-a');
    expect(sectionShade('oat-a')).toBe(a);
    const vals = [100, 700, 1700, 2300, 3500].map((u) => a.floor(u, 10, 4) + a.facade(u, 5, 2));
    resetSectionShade('oat-a');
    const b = sectionShade('oat-a');
    expect(b).not.toBe(a);
    expect([100, 700, 1700, 2300, 3500].map((u) => b.floor(u, 10, 4) + b.facade(u, 5, 2))).toEqual(vals);
  });

  it('a: Berenstraat in shade at the shop fronts, the bridges in sun (the narrow-then-bright rhythm)', () => {
    const a = sectionShade('oat-a');
    const { vFacade, vOpposite } = shadeSpan(shadeCamera('oat-a'));
    const mid = vFacade + (vOpposite - vFacade) * 0.4;
    expect(OAT_STREETS['oat-a'].length).toBe(3);
    expect(a.floor(1000, mid, 1)).toBe(1);
    expect(a.floor(430, mid, 1)).toBe(0);
    expect(a.facade(1000, 1.5, 1)).toBe(1);
  });
});

describe('the opposite skyline', () => {
  it('gable profiles stay between the eaves and the top; flat fronts are flat', () => {
    for (const gable of ['trap', 'hals', 'verhoogde-hals', 'klok', 'tuit', 'lijst']) {
      const lot = { u0: 0, w: 80, eaves: 12, top: 16, gable };
      for (let t = 0; t <= 1; t += 0.05) {
        const h = lotProfile(lot, t);
        expect(h).toBeGreaterThanOrEqual(12 - 1e-9);
        expect(h).toBeLessThanOrEqual(16 + 1e-9);
      }
      expect(lotProfile(lot, 0.5)).toBe(16);
    }
  });

  it('the seeded row is deterministic, covers the range and has a few gaps', () => {
    const a = proceduralLots(SHEET_9_STRAATJES, 0, 4608, 7);
    expect(proceduralLots(SHEET_9_STRAATJES, 0, 4608, 7)).toEqual(a);
    const sky = skylineFromLots(a);
    let gaps = 0;
    let prev = 1;
    for (let u = 0; u < 4608; u++) {
      const h = sky(u + 0.5);
      if (h === 0 && prev > 0) gaps++;
      prev = h;
    }
    expect(gaps).toBeGreaterThanOrEqual(2);
    expect(gaps).toBeLessThanOrEqual(10);
  });
});
