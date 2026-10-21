/**
 * The mission light pass (src/game/mission/light/; docs/design/oldenzaal.md §10.2): an additive
 * opt-in. Off for every section without a light config (ams and the rest draw as before); lights
 * add; the lightning schedule and the script control; the weather generators are deterministic.
 */
import { createHash } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { PAL } from '../../src/engine/palette';
import { HD_FULL_PALETTE, PAL_HD_OZ } from '../../src/engine/palette-hd';
import type { PixelBuffer } from '../../src/engine/pixel';
import { SoftRenderer } from '../../src/engine/render-soft';
import { World } from '../../src/engine/world';
import { loadContent } from '../../src/game/content/index';
import {
  lightControl,
  lightning,
  sectionLight,
  setDarkness,
  type SectionLight,
} from '../../src/game/content/oldenzaal/kit/light-api';
import { OZ_LIGHT_POINT } from '../../src/game/content/oldenzaal/kit/light-point';
import { paintFog, paintRain } from '../../src/game/content/oldenzaal/weather/index';
import { explosion, muzzleFlash } from '../../src/game/fx';
import { flickerAt, gustAt, LightMap, MissionLight, REDUCED_FLASH } from '../../src/game/mission/light/index';
import { gameEntityFactory, getMission, listMissions } from '../../src/game/registry';
import { createHeadlessGame } from '../../src/sim/index';

function hashBuf(b: PixelBuffer): string {
  return createHash('sha1').update(new Uint8Array(b.data.buffer, b.data.byteOffset, b.data.byteLength)).digest('hex').slice(0, 16);
}

const PAL_SET = new Set<number>();
for (const r of Object.values(PAL)) if (Array.isArray(r)) for (const c of r) PAL_SET.add(((c as number) | 255) >>> 0);
const HD_SET = new Set<number>(HD_FULL_PALETTE.map((c) => c >>> 0));

beforeAll(async () => {
  await loadContent();
});

describe('opt-in: off by default', () => {
  it('only oldenzaal sections register a light config', () => {
    for (const mid of listMissions()) {
      const m = getMission(mid);
      if (!m) continue;
      for (const sid of Object.keys(m.sections)) {
        if (mid === 'oldenzaal') expect(sectionLight(sid), `${mid}/${sid}`).toBeDefined();
        else expect(sectionLight(sid), `${mid}/${sid}`).toBeUndefined();
      }
    }
  });

  it('an ams runner has no pass, no back hook and no row eviction; nothing is bound', async () => {
    const g = await createHeadlessGame({ missionId: 'ams', sectionId: 'a', seed: 1, god: true, loadContent: false });
    g.step(30);
    const run = g.runner;
    expect(run).not.toBeNull();
    if (!run) return;
    expect(run.light).toBeNull();
    expect(run.view.backHook).toBeNull();
    expect(run.view.evictRows).toBe(false);
    expect(lightControl(run.world)).toBeNull();
    // Script calls are no-ops without a pass.
    lightning(run.world, 1);
    setDarkness(run.world, 0.5, 10);
    expect(run.light).toBeNull();
  });

  it('an oldenzaal runner has a pass per section, bound to its world, drawn deterministically', async () => {
    const frame = async (): Promise<string> => {
      const g = await createHeadlessGame({ missionId: 'oldenzaal', sectionId: 'oz-a', seed: 4, god: true, loadContent: false });
      g.step(120);
      const run = g.runner;
      if (!run) throw new Error('no runner');
      expect(run.light).not.toBeNull();
      expect(run.view.backHook).not.toBeNull();
      expect(lightControl(run.world)).toBe(run.light);
      const r = new SoftRenderer();
      r.begin(run.sky);
      run.draw(r);
      r.end();
      const lit = hashBuf(r.target);
      // The same frame without the pass differs (the pass draws).
      const keep = run.light;
      const hook = run.view.backHook;
      run.light = null;
      run.view.backHook = null;
      r.begin(run.sky);
      run.draw(r);
      r.end();
      run.light = keep;
      run.view.backHook = hook;
      expect(hashBuf(r.target)).not.toBe(lit);
      return lit;
    };
    expect(await frame()).toBe(await frame());
  });
});

describe('LightMap', () => {
  it('lights add, cut the darkness and add their colour; off-map lights cost nothing', () => {
    const m = new LightMap(64, 32);
    m.begin(100, 50);
    m.add(120, 66, 10, 0.5, PAL_HD_OZ.candle[5], 0.4);
    const one = m.lightAt(120, 66);
    expect(one).toBeGreaterThan(0.4);
    m.add(120, 66, 10, 0.5, PAL_HD_OZ.candle[5], 0.4);
    expect(m.lightAt(120, 66)).toBeCloseTo(one * 2, 5);
    expect(m.lightAt(140, 66)).toBe(0);
    m.add(-500, 66, 20, 1, PAL_HD_OZ.candle[5], 1);
    expect(m.count).toBe(2);
    const glow = m.resolve(PAL_HD_OZ.night[1], 0.6);
    expect(glow).toBe(true);
    const dark = (x: number, y: number): number => m.dark.get(x - 100, y - 50) & 255;
    // Far from the light: the full darkness; at the light: (nearly) none.
    expect(dark(160, 50)).toBe(Math.round(0.6 * 255));
    expect(dark(120, 66)).toBeLessThan(5);
    expect(m.dark.get(60, 16) & 0xffffff00).toBe((PAL_HD_OZ.night[1] & 0xffffff00) >>> 0);
    // The glow is warm (red ≥ green ≥ blue) where the light is, empty elsewhere.
    const g = m.glow.get(20, 16);
    expect(g & 255).toBeGreaterThan(0);
    expect((g >>> 24) & 255).toBeGreaterThanOrEqual((g >>> 8) & 255);
    expect(m.glow.get(60, 2)).toBe(0);
    // A new frame clears everything.
    m.begin(100, 50);
    m.resolve(PAL_HD_OZ.night[1], 0.6);
    expect(dark(120, 66)).toBe(Math.round(0.6 * 255));
    expect(m.glow.get(20, 16)).toBe(0);
  });

  it('flicker and gusts are pure functions of the tick', () => {
    expect(flickerAt(0, 123, 4)).toBe(1);
    const a = [0, 1, 2, 3, 50, 99].map((t) => flickerAt(0.8, t, 7));
    expect([0, 1, 2, 3, 50, 99].map((t) => flickerAt(0.8, t, 7))).toEqual(a);
    for (const v of a) expect(v).toBeGreaterThan(0);
    for (let t = 0; t < 2000; t += 37) expect(gustAt(t)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...Array.from({ length: 400 }, (_, i) => gustAt(i * 10)))).toBeGreaterThan(0.3);
  });
});

describe('MissionLight', () => {
  const cfg: SectionLight = {
    darkness: 0.6,
    tint: PAL_HD_OZ.night[1],
    lamps: [{ x: 100, y: 120, r: 30, color: PAL_HD_OZ.candle[5] }],
    fog: { density: 0.6, color: PAL_HD_OZ.night[5], top: 140, drift: -0.2 },
    rain: { density: 0.8, slant: 0.3 },
    lightning: { every: [30, 60], strength: 1, double: 0.5 },
    heroLight: 28,
  };

  function run(seed: number, ticks: number): { light: MissionLight; world: World; flashes: number[] } {
    const world = new World({ seed, factory: gameEntityFactory });
    const light = new MissionLight(cfg, world, seed);
    const flashes: number[] = [];
    for (let t = 1; t <= ticks; t++) {
      light.update(t);
      flashes.push(Math.round(light.flashAt(t) * 1000));
    }
    return { light, world, flashes };
  }

  it('binds its control; the lightning schedule is seeded and repeatable; thunder follows', () => {
    const a = run(9, 600);
    const b = run(9, 600);
    expect(lightControl(a.world)).toBe(a.light);
    expect(a.light.bolts).toBeGreaterThanOrEqual(600 / 60 - 1);
    expect(a.light.thunders).toBeGreaterThan(0);
    expect(a.flashes).toEqual(b.flashes);
    expect(Math.max(...a.flashes)).toBeGreaterThan(500);
    expect(run(10, 600).flashes).not.toEqual(a.flashes);
    a.light.dispose();
    expect(lightControl(a.world)).toBeNull();
  });

  it('scripts flash and fade the darkness through the world', () => {
    const world = new World({ seed: 1 });
    const light = new MissionLight({ darkness: 0.4, tint: PAL_HD_OZ.night[1] }, world, 1);
    light.update(10);
    expect(light.flashAt(10)).toBe(0);
    lightning(world, 0.8);
    expect(light.flashAt(10)).toBeCloseTo(0.8, 5);
    expect(light.flashAt(60)).toBe(0);
    setDarkness(world, 0.7, 20);
    expect(light.darkness).toBeCloseTo(0.4, 5);
    light.update(20);
    expect(light.darkness).toBeCloseTo(0.55, 5);
    light.update(30);
    expect(light.darkness).toBeCloseTo(0.7, 5);
    // Capped for readability.
    setDarkness(world, 1, 0);
    expect(light.darkness).toBe(0.75);
  });

  it('draws the same pixels for the same ticks; lamps and light entities cut the dark', () => {
    const shot = (): { hash: string; lights: number; centre: number; far: number } => {
      const { light, world } = run(3, 90);
      world.spawn(OZ_LIGHT_POINT, 300, 80, { r: 24, flicker: 0.5 });
      world.flush();
      const r = new SoftRenderer();
      r.begin(0x101018ff);
      r.setCamera(0, 0);
      light.drawBack(r, 90, 1);
      light.draw(r, 90, 1);
      r.end();
      return { hash: hashBuf(r.target), lights: light.map.count, centre: light.map.lightAt(100, 120), far: light.map.lightAt(200, 20) };
    };
    const a = shot();
    expect(a).toEqual(shot());
    expect(a.lights).toBe(2);
    expect(a.centre).toBeGreaterThan(0.9);
    expect(a.far).toBe(0);
  });
});

describe('MissionLight extras', () => {
  it('muzzle flashes and blasts light the dark for a moment', () => {
    const world = new World({ seed: 2, factory: gameEntityFactory });
    const light = new MissionLight({ darkness: 0.6, tint: PAL_HD_OZ.night[1] }, world, 2);
    const count = (): number => {
      const r = new SoftRenderer();
      r.begin(0x000000ff);
      r.setCamera(0, 0);
      light.draw(r, world.tick, 1);
      r.end();
      return light.map.count;
    };
    expect(count()).toBe(0);
    explosion(world, 120, 120, 'm');
    muzzleFlash(world, 200, 100, 0);
    world.flush();
    expect(count()).toBe(2);
    for (let i = 0; i < 40; i++) world.update();
    expect(count()).toBe(0);
  });

  it('reduced flashes draw the lightning at 30 %; the schedule is the same', () => {
    const cfg: SectionLight = { darkness: 0.5, tint: PAL_HD_OZ.night[1], lightning: { every: [20, 40] } };
    const frame = (scale: number, t: number): string => {
      const world = new World({ seed: 6 });
      const light = new MissionLight(cfg, world, 6, scale);
      let peak = -1;
      for (let i = 1; i <= t; i++) {
        light.update(i);
        if (light.flashAt(i) > 0.5) {
          peak = i;
          break;
        }
      }
      expect(peak).toBeGreaterThan(0);
      const r = new SoftRenderer();
      r.begin(0x202030ff);
      light.drawBack(r, peak, 1);
      light.draw(r, peak, 1);
      r.end();
      return `${peak}:${r.target.get(10, 10) >>> 0}`;
    };
    const full = frame(1, 200);
    const reduced = frame(REDUCED_FLASH, 200);
    expect(full.split(':')[0]).toBe(reduced.split(':')[0]);
    const lum = (s: string): number => (Number(s.split(':')[1]) >>> 24) & 255;
    expect(lum(full)).toBeGreaterThan(lum(reduced));
  });
});

describe('weather generators', () => {
  it('fog: deterministic, the palette of each density, soft top, d times the size', () => {
    const one = paintFog(128, 40, { color: PAL_HD_OZ.night[5] }, 7, 1);
    expect(hashBuf(paintFog(128, 40, { color: PAL_HD_OZ.night[5] }, 7, 1))).toBe(hashBuf(one));
    expect(hashBuf(paintFog(128, 40, { color: PAL_HD_OZ.night[5] }, 8, 1))).not.toBe(hashBuf(one));
    for (const c of one.data) if (c & 255) expect(PAL_SET.has((c | 255) >>> 0)).toBe(true);
    // Top row thin, bottom rows thick.
    let top = 0;
    let bottom = 0;
    for (let x = 0; x < 128; x++) {
      top += one.get(x, 0) & 255;
      bottom += one.get(x, 36) & 255;
    }
    expect(bottom).toBeGreaterThan(top * 3);
    for (const d of [2, 4] as const) {
      const hi = paintFog(128, 40, { color: PAL_HD_OZ.night[5] }, 7, d);
      expect([hi.w, hi.h]).toEqual([128 * d, 40 * d]);
      for (const c of hi.data) if (c & 255) expect(HD_SET.has((c | 255) >>> 0)).toBe(true);
    }
  });

  it('rain: deterministic, thin streaks in the palette of each density, wraps', () => {
    const one = paintRain(96, 108, { slant: 0.3 }, 5, 1);
    expect(hashBuf(paintRain(96, 108, { slant: 0.3 }, 5, 1))).toBe(hashBuf(one));
    let lit = 0;
    for (const c of one.data) if (c & 255) {
      lit++;
      expect(PAL_SET.has((c | 255) >>> 0)).toBe(true);
    }
    expect(lit).toBeGreaterThan(200);
    expect(lit).toBeLessThan(96 * 108 * 0.25);
    const hi = paintRain(96, 108, { slant: 0.3 }, 5, 4);
    expect([hi.w, hi.h]).toEqual([384, 432]);
    for (const c of hi.data) if (c & 255) expect(HD_SET.has((c | 255) >>> 0)).toBe(true);
  });
});
