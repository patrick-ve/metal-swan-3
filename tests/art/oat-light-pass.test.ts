/**
 * The oat flags of the mission light pass (docs/design/oat.md §8.4, §8.8, §8.9; docs/api/oat.md
 * "LIGHT-WATER"): the night configs of oat-d and oat-e and the day configs of a, b, c, c1; the smooth
 * glow (a dense light map: round at 2× / 4×, 1× unchanged); the night streaks; the lamp groups (on,
 * off, a flicker that dies); the 03:00 bake cross-fade pushed to the strips; the day mode (no map);
 * the sun tails and the dynamic reflections; and the frame path allocates nothing.
 */
import { describe, expect, it } from 'vitest';
import { PAL_HD_OAT } from '../../src/engine/palette-hd';
import type { Renderer } from '../../src/engine/render';
import { SoftRenderer } from '../../src/engine/render-soft';
import { World } from '../../src/engine/world';
import { Entity } from '../../src/engine/entity';
import {
  lampsOf,
  nightLights,
  OAT_D_GROUPS,
  OAT_D_LIGHTS,
  sunTail,
} from '../../src/game/content/missions/oat/light/index';
import { terrainA, terrainD } from '../../src/game/content/missions/oat/terrain';
import { REFLECT_TAG, WaterReflections } from '../../src/game/mission/floor/reflect';
import { crossFadeLight, lampGroup, lightSetMix, sectionLight, type SectionLight } from '../../src/game/mission/light/api';
import { SunShadows } from '../../src/game/mission/light/contact';
import { GlowFrames } from '../../src/game/mission/light/glow';
import { MissionLight } from '../../src/game/mission/light/index';
import { bindLiveStripStore } from '../../src/game/mission/strips/live';
import type { StripStoreApi } from '../../src/game/mission/strips/types';

const NIGHT = PAL_HD_OAT.nightSky[0];

/** A renderer that draws nothing (the measured code is the pass's own). */
function nullRenderer(res: number): Renderer & { camX: number; camY: number } {
  return { w: 384, h: 216, res, subpixel: 'all', camX: 0, camY: 0, frame() {}, sprite() {}, surface() {}, line() {}, rect() {}, image() {}, parallax() {}, text() {}, fade() {} } as unknown as Renderer & {
    camX: number;
    camY: number;
  };
}

describe('the oat light configs (spec §8.3, §8.9)', () => {
  it('oat-d and oat-e opt in with the smooth glow, streaks and groups; d has the 03:00 bakes', () => {
    const d = sectionLight('oat-d') as SectionLight;
    const e = sectionLight('oat-e') as SectionLight;
    expect(d.darkness).toBeCloseTo(0.35, 5);
    expect(e.darkness).toBeCloseTo(0.4, 5);
    for (const c of [d, e]) {
      expect(c.glow).toBe('smooth');
      expect(c.streaks).toBeTruthy();
      expect(c.groups?.length).toBeGreaterThan(0);
      expect(c.day).toBeFalsy();
    }
    expect(d.bakes).toEqual({ x0: 3877, x1: 4480, fadeTicks: 60 }); // facade/rows.ts OAT_D_DARK (FIX-A)
    expect(d.groups?.find((g) => g.name === OAT_D_GROUPS.bossHouse)?.state).toBe('off');
    // Every lamp's group is a declared group; the proof strip's lights sit where STREET-A bakes them.
    const names = new Set(d.groups?.map((g) => g.name));
    for (const l of d.lamps ?? []) if (l.group !== undefined) expect(names.has(l.group), l.group).toBe(true);
    expect(nightLights('oat-d')).toBe(OAT_D_LIGHTS);
    expect(OAT_D_LIGHTS.filter((l) => l.u < 1280).map((l) => l.u)).toEqual([96, 196, 330, 486, 600, 742, 880, 1012, 1150, 1250]);
  });

  it('the day sections a, b, c, c1 are day passes: no darkness, the sun tails, water in a and c1', () => {
    for (const id of ['oat-a', 'oat-b', 'oat-c', 'oat-c1']) {
      const c = sectionLight(id) as SectionLight;
      expect(c.day, id).toBe(true);
      expect(c.lamps, id).toBeUndefined();
      expect(c.sunShadows?.along, id).toBeGreaterThan(0);
    }
    expect(sectionLight('oat-a')?.water?.bands.length).toBe(3);
    expect(sectionLight('oat-c1')?.water?.bands.length).toBe(1);
    expect(sectionLight('oat-b')?.water).toBeUndefined();
  });

  it('the sun tails follow the sun: a 1.23 px per px of height, c1 the longest; up the screen a little', () => {
    const a = sunTail('oat-a');
    expect(a.along).toBeCloseTo(1.6003 * Math.cos((40 * Math.PI) / 180), 3);
    expect(a.up).toBeGreaterThan(0.1);
    expect(a.up).toBeLessThan(a.along);
    expect(sunTail('oat-b').along).toBeLessThan(a.along);
    expect(sunTail('oat-c1').along).toBeGreaterThan(sunTail('oat-c').along);
  });

  it('neon, lanterns and red tubes streak; windows and the tower floodlight do not', () => {
    const lamps = lampsOf([
      { u: 0, depth: 0, h: 50, kind: 'pink', r: 30, k: 1 },
      { u: 0, depth: 0, h: 50, kind: 'window', r: 30, k: 1 },
      { u: 0, depth: 0, h: 50, kind: 'flood', r: 30, k: 1, streak: false },
    ]);
    expect(lamps.map((l) => l.streak === true)).toEqual([true, false, false]);
    expect(lamps[0].y).toBe(126);
  });
});

describe('the smooth glow (spec §8.9: round glows at 2× / 4×, 1× per pixel)', () => {
  it('a glow frame is a dense round disc: the pixels of one logical px differ at its edge (no 4 × 4 blocks)', () => {
    const g = new GlowFrames();
    g.begin();
    g.circle(50, 50, 20, 0xff3fa0ff, 0.5, 4);
    let f: { buf: { w: number; h: number; data: Uint32Array }; density?: number } | null = null;
    const r = { ...nullRenderer(4), frame(fr: never) { f = fr; } } as unknown as Renderer;
    g.flush(r);
    expect(g.drawn).toBe(1);
    const fr = f as unknown as { buf: { w: number; h: number; data: Uint32Array }; density: number };
    expect(fr.density).toBe(4);
    expect(fr.buf.w).toBe(160);
    let split = 0;
    for (let y = 0; y < 40; y++) {
      for (let x = 0; x < 40; x++) {
        const a = fr.buf.data[y * 4 * 160 + x * 4] & 255;
        let differs = false;
        for (let k = 1; k < 16 && !differs; k++) if ((fr.buf.data[(y * 4 + (k >> 2)) * 160 + x * 4 + (k & 3)] & 255) !== a) differs = true;
        if (differs) split++;
      }
    }
    expect(split).toBeGreaterThan(600);
    // Its colour is the light's; the centre is opaque, the corner empty.
    expect(fr.buf.data[80 * 160 + 80] >>> 8).toBe(0xff3fa0);
    expect(fr.buf.data[0]).toBe(0);
  });

  it('frames are cached per colour, size and density (one frame per light kind, not per frame)', () => {
    const g = new GlowFrames();
    for (let t = 0; t < 5; t++) {
      g.begin();
      g.circle(10 + t, 10, 20, 0xffd29aff, 0.4, 4);
      g.ellipse(30, 40, 16, 5, 0xffd29aff, 0.3, 4, 38);
      g.flush(nullRenderer(4));
    }
    const once = g.bytes;
    g.begin();
    g.circle(99, 10, 20, 0xffd29aff, 0.4, 4);
    g.flush(nullRenderer(4));
    expect(g.bytes).toBe(once);
  });

  it('the oat-d pass: dense glows at res 2 and 4 (at the art density), the own glow of the map at res 1', () => {
    const world = new World({ seed: 1, terrain: terrainD() });
    const pass = new MissionLight(sectionLight('oat-d') as SectionLight, world, 1, 1, 'oat-d');
    for (const res of [1, 2, 4]) {
      const r = new SoftRenderer(384, 216, undefined, { res });
      r.begin(0x202020ff);
      r.setCamera(100, 0);
      pass.update(10);
      pass.draw(r, 10, res);
      expect(pass.map.count).toBeGreaterThan(0);
      expect(pass.glowDrawn, `res ${res}`).toBe(true);
      expect(pass.glows?.drawn ?? 0, `res ${res}`).toBe(res >= 2 ? (pass.glows?.drawn as number) : 0);
      if (res >= 2) expect(pass.glows?.drawn).toBeGreaterThan(3);
    }
    pass.dispose();
  });
});

describe('streaks, groups and bakes (spec §6.9, §8.8, §8.9)', () => {
  function dPass(): { pass: MissionLight; world: World } {
    const world = new World({ seed: 1, terrain: terrainD() });
    return { pass: new MissionLight(sectionLight('oat-d') as SectionLight, world, 7, 1, 'oat-d'), world };
  }

  it('lights marked streak mirror as dashes in the water rows only; no streaks without the flag', () => {
    const { pass } = dPass();
    const r = nullRenderer(2);
    r.camX = 0;
    pass.update(5);
    pass.draw(r, 5, 2);
    expect(pass.streakDashes).toBeGreaterThan(10);
    // The dashes light the water rows (y ≥ 193), not the rows above them under the same lamp.
    const m = pass.map;
    let water = 0;
    for (let y = 194; y < 216; y++) water += m.lightAt(196, y);
    expect(water).toBeGreaterThan(0);
    const off = new MissionLight({ ...(sectionLight('oat-d') as SectionLight), streaks: false }, new World({ seed: 1 }), 7, 1, 'oat-d');
    off.update(5);
    off.draw(r, 5, 2);
    expect(off.streakDashes).toBe(0);
    pass.dispose();
    off.dispose();
  });

  it('a group switched off adds no light; a flicker dies to off within its 20–40 ticks', () => {
    const { pass, world } = dPass();
    const r = nullRenderer(2);
    pass.update(0);
    pass.draw(r, 0, 2);
    const before = pass.map.lightAt(196, 126);
    expect(before).toBeGreaterThan(0.3);
    lampGroup(world, OAT_D_GROUPS.neonWest, 'flicker');
    expect(pass.groupOf(OAT_D_GROUPS.neonWest)).toBe('flicker');
    let dim = 0;
    for (let t = 1; t <= 45; t++) {
      pass.update(t);
      pass.draw(r, t, 2);
      if (pass.map.lightAt(196, 126) < before * 0.6) dim++;
    }
    expect(dim).toBeGreaterThan(3);
    expect(pass.groupOf(OAT_D_GROUPS.neonWest)).toBe('off');
    // The lantern next to it stays on; the boss's house starts off and lights up on 'on'.
    expect(pass.map.lightAt(96, 104)).toBeGreaterThan(0.3);
    expect(pass.groupOf(OAT_D_GROUPS.bossHouse)).toBe('off');
    lampGroup(world, OAT_D_GROUPS.bossHouse, 'on');
    expect(pass.groupOf(OAT_D_GROUPS.bossHouse)).toBe('on');
    lampGroup(world, 'no-such-group', 'off');
    pass.dispose();
  });

  it('a flicker dims at most 3 times a second per group, and no two groups dim on the same tick (spec §14 risk 6)', () => {
    const names = ['g0', 'g1', 'g2', 'g3', 'g4', 'g5'];
    const cfg: SectionLight = { darkness: 0.4, tint: NIGHT, glow: 'smooth', groups: names.map((name) => ({ name, ticks: [20, 40] as [number, number] })), lamps: [] };
    for (const seed of [1, 2, 3]) {
      const world = new World({ seed });
      const pass = new MissionLight(cfg, world, seed, 1);
      const k = pass as unknown as { groupK(g: number, t: number): number };
      pass.update(0);
      for (const n of names) lampGroup(world, n, 'flicker');
      const dimTicks = new Map<number, number>();
      for (let g = 0; g < names.length; g++) {
        const dims: number[] = [];
        let last = 1;
        for (let t = 0; t <= 60; t++) {
          const v = k.groupK(g, t);
          // A dim: the light drops while the tube still glows (the final off is not a flash).
          if (v < last && v > 0) dims.push(t);
          last = v;
        }
        for (const t of dims) {
          expect(dims.filter((u) => u > t - 60 && u <= t).length, `${names[g]} dims ${dims.join(',')}`).toBeLessThanOrEqual(3);
          expect(dimTicks.has(t), `${names[g]} and ${names[dimTicks.get(t) ?? 0]} dim on tick ${t}`).toBe(false);
          dimTicks.set(t, g);
        }
      }
      pass.dispose();
    }
  });

  it('the reduced flashes fade a flicker smoothly (no on / off steps)', () => {
    const cfg: SectionLight = { darkness: 0.4, tint: NIGHT, glow: 'smooth', groups: [{ name: 'g' }], lamps: [{ x: 100, y: 100, r: 30, color: 0xff3fa0ff, group: 'g' }] };
    for (const scale of [1, 0.3]) {
      // Flickers started on several ticks (the steps lie on the world's tick grid).
      let total = 0;
      for (const t0 of [0, 7, 13, 21, 34, 55]) {
        const world = new World({ seed: 1 });
        const pass = new MissionLight(cfg, world, 7, scale);
        const r = nullRenderer(2);
        pass.update(t0);
        lampGroup(world, 'g', 'flicker');
        let last = Infinity;
        let rises = 0;
        for (let t = t0; t <= t0 + 45; t++) {
          pass.update(t);
          pass.draw(r, t, 2);
          const v = pass.map.lightAt(100, 100);
          if (v > last + 1e-6) rises++;
          last = v;
        }
        // The reduced flashes only fade.
        if (scale < 1) expect(rises).toBe(0);
        total += rises;
        expect(last).toBe(0);
        pass.dispose();
      }
      // The dying tube steps up again now and then.
      if (scale === 1) expect(total).toBeGreaterThan(0);
    }
  });

  it('crossFadeLight eases the bake over 60 ticks and pushes the mix to the strips', () => {
    const { pass, world } = dPass();
    const store = { darkMix: 0 } as unknown as StripStoreApi;
    bindLiveStripStore('oat-d', store);
    pass.update(100);
    expect(lightSetMix(world)).toBe(0);
    crossFadeLight(world, 'dark');
    pass.update(130);
    const mid = lightSetMix(world);
    expect(mid).toBeGreaterThan(0.3);
    expect(mid).toBeLessThan(0.7);
    expect(store.darkMix).toBeCloseTo(mid, 6);
    pass.update(160);
    expect(lightSetMix(world)).toBe(1);
    expect(store.darkMix).toBe(1);
    bindLiveStripStore('oat-d', null);
    pass.dispose();
  });

  it('a day pass draws no darkness and builds no map', () => {
    const world = new World({ seed: 1, terrain: terrainA() });
    const pass = new MissionLight(sectionLight('oat-a') as SectionLight, world, 1, 1, 'oat-a');
    let draws = 0;
    const r = { ...nullRenderer(4), image() { draws++; }, frame() { draws++; }, rect() { draws++; } } as unknown as Renderer;
    pass.update(1);
    pass.draw(r, 1, 4);
    expect(draws).toBe(0);
    expect(pass.map.count).toBe(0);
    pass.dispose();
  });
});

/** A test actor that mirrors (and casts a sun tail as a 'player'). */
class Actor extends Entity {
  sprite = 'vehicle/swan/idle';
  override update(): void {}
  override draw(): void {}
  reflectOf(out: { sprite: string; frame: number; x: number; y: number; flipX: boolean }): boolean {
    out.sprite = this.sprite;
    out.frame = 0;
    out.x = this.x;
    out.y = this.y;
    out.flipX = false;
    return true;
  }
}

describe('the ground overlays (spec §8.4 "Actors", §8.8 "Dynamic reflections")', () => {
  it('reflections: at most 6, only in a band, every slice in the water rows, alpha 0.35–0.5', () => {
    const world = new World({ seed: 1 });
    const actors: Actor[] = [];
    for (let i = 0; i < 9; i++) actors.push(world.add(new Actor(world, 20 + i * 40, 200)));
    actors.push(world.add(new Actor(world, 380, 150)));
    world.flush();
    for (const a of actors) a.addTag(REFLECT_TAG);
    const rows: number[] = [];
    const alphas: number[] = [];
    const r = { ...nullRenderer(2), sprite(_id: string, _f: number, _x: number, y: number, o: { src: { y: number; h: number }; alpha: number; flipY: boolean }) {
      expect(o.flipY).toBe(true);
      rows.push(y);
      alphas.push(o.alpha);
    } } as unknown as Renderer;
    const refl = new WaterReflections({ bands: [{ u0: 0, u1: 300, y0: 193, y1: 216 }] });
    refl.draw(r, world, 50, null);
    expect(refl.drawn).toBe(6);
    expect(refl.slices).toBeGreaterThan(6);
    for (const a of alphas) {
      expect(a).toBeGreaterThanOrEqual(0.35 - 1e-9);
      expect(a).toBeLessThanOrEqual(0.5 + 1e-9);
    }
    // The mirror line is the spot's water line (200 ≥ the band's top).
    for (const y of rows) expect(y).toBe(200);
  });

  it('reflections: the ripple moves a slice a little every tick (interpolated: no hold-then-jump)', () => {
    const world = new World({ seed: 1 });
    const a = world.add(new Actor(world, 100, 200));
    world.flush();
    a.addTag(REFLECT_TAG);
    const xs: number[] = [];
    let first = true;
    const r = { ...nullRenderer(4), sprite(_id: string, _f: number, x: number) {
      if (first) xs.push(x);
      first = false;
    } } as unknown as Renderer;
    const refl = new WaterReflections({ bands: [{ u0: 0, u1: 300, y0: 193, y1: 216 }], ripple: 2 });
    for (let t = 0; t < 60; t++) {
      first = true;
      refl.draw(r, world, t, null);
    }
    let held = 0;
    let worst = 0;
    for (let i = 1; i < xs.length; i++) {
      const dx = Math.abs(xs[i] - xs[i - 1]);
      if (dx < 1e-9) held++;
      worst = Math.max(worst, dx);
    }
    // The old table read held a slice for 8–9 ticks, then jumped (up to 0.163 × amp).
    expect(held).toBeLessThan(5);
    expect(worst).toBeLessThan(0.05 * 2);
  });

  it('sun tails: one per actor on the ground in sun, none in shade, longer for a taller caster', () => {
    const world = new World({ seed: 1, terrain: terrainA() });
    const a = world.add(new Actor(world, 100, 176));
    const b = world.add(new Actor(world, 200, 176));
    world.flush();
    a.addTag('player');
    b.addTag('player');
    a.hitbox = { x: -9, y: -36, w: 18, h: 36 };
    b.hitbox = { x: -9, y: -18, w: 18, h: 18 };
    const sizes: number[] = [];
    const r = { ...nullRenderer(4), frame(f: { buf: { w: number } }) { sizes.push(f.buf.w); } } as unknown as Renderer;
    const tails = new SunShadows({ ...sunTail('oat-a'), lit: (x) => (x < 150 ? 1 : 0) });
    tails.draw(r, world, 4);
    expect(tails.drawn).toBe(1);
    const all = new SunShadows({ ...sunTail('oat-a'), lit: () => 1 });
    sizes.length = 0;
    all.draw(r, world, 4);
    expect(all.drawn).toBe(2);
    expect(sizes[0]).toBeGreaterThan(sizes[1]);
  });

  it('sun tails lie only on the sunlit floor along their length: walking into shade shrinks a tail, no pop', () => {
    const world = new World({ seed: 1, terrain: terrainA() });
    const a = world.add(new Actor(world, 100, 176));
    world.flush();
    a.addTag('player');
    a.hitbox = { x: -9, y: -36, w: 18, h: 36 };
    let w = 0;
    let srcSeen = false;
    const r = { ...nullRenderer(4), frame(f: { buf: { w: number }; density?: number }, _x: number, _y: number, o: { src?: { w: number } }) {
      srcSeen ||= o.src !== undefined;
      w = o.src ? o.src.w : f.buf.w / (f.density ?? 1);
    } } as unknown as Renderer;
    // Sun left of x 150, shade right of it.
    const tails = new SunShadows({ ...sunTail('oat-a'), lit: (x) => (x < 150 ? 1 : 0) });
    const widths: number[] = [];
    for (let x = 60; x <= 160; x += 0.5) {
      a.x = x;
      w = 0;
      tails.draw(r, world, 4);
      widths.push(tails.drawn ? w : 0);
    }
    expect(srcSeen).toBe(true);
    // The drawn length never jumps by more than a step's walk plus the bisection's grain and the
    // frame's clear 2 px pad past the tip (the old tail: the whole ~50 px at once).
    for (let i = 1; i < widths.length; i++) expect(Math.abs(widths[i] - widths[i - 1]), `at x ${60 + i * 0.5}`).toBeLessThan(3);
    // Feet in shade, the tip in sun: the lit end of the tail is drawn.
    const back = new SunShadows({ ...sunTail('oat-a'), lit: (x) => (x > 120 ? 1 : 0) });
    a.x = 110;
    back.draw(r, world, 4);
    expect(back.drawn).toBe(1);
    expect(w).toBeGreaterThan(0);
  });
});

describe('no allocation per frame (Hard Rule 7) and the frame cost (spec §8.12)', () => {
  it('600 frames of the oat-d pass (smooth glow, streaks, groups) and the overlays sample no heap growth', async () => {
    const { Session } = await import('node:inspector/promises');
    const world = new World({ seed: 1, terrain: terrainD() });
    const actors: Actor[] = [];
    for (let i = 0; i < 4; i++) actors.push(world.add(new Actor(world, 100 + i * 60, 176)));
    world.flush();
    for (const a of actors) {
      a.addTag(REFLECT_TAG);
      a.addTag('player');
      a.hitbox = { x: -9, y: -36, w: 18, h: 36 };
    }
    const pass = new MissionLight(sectionLight('oat-d') as SectionLight, world, 1, 1, 'oat-d');
    const refl = new WaterReflections({ bands: [{ u0: 0, u1: 1664, y0: 193, y1: 216 }] });
    const tails = new SunShadows({ ...sunTail('oat-a'), lit: () => 1 });
    const r = nullRenderer(4);
    lampGroup(world, OAT_D_GROUPS.neonEast, 'flicker');
    const frame = (i: number): void => {
      r.camX = (i * 1.75) % 1000;
      pass.update(i);
      pass.draw(r, i, 4);
      refl.draw(r, world, i, null);
      tails.draw(r, world, 4);
    };
    for (let i = 0; i < 1200; i++) frame(i);
    type N = { selfSize: number; callFrame: { url: string; functionName: string }; children: N[] };
    let best = Infinity;
    let where: string[] = [];
    for (let attempt = 0; attempt < 3 && best / 600 >= 64; attempt++) {
      const ses = new Session();
      ses.connect();
      await ses.post('HeapProfiler.enable');
      await ses.post('HeapProfiler.startSampling', { samplingInterval: 1024 } as never);
      for (let i = 0; i < 600; i++) frame(2000 + i);
      const { profile } = (await ses.post('HeapProfiler.stopSampling')) as unknown as { profile: { head: N } };
      ses.disconnect();
      let bytes = 0;
      const at: string[] = [];
      const walk = (n: N): void => {
        if (n.selfSize > 0 && /\/(light|floor)\//.test(n.callFrame.url)) {
          bytes += n.selfSize;
          at.push(`${n.callFrame.functionName} ${n.selfSize}`);
        }
        for (const c of n.children) walk(c);
      };
      walk(profile.head);
      if (bytes < best) {
        best = bytes;
        where = at;
      }
    }
    expect(best / 600, `bytes per frame: ${where.join(', ')}`).toBeLessThan(64);
    // The cost of the pass's own code per frame (the dense map at res 4; a dev machine: ~0.3 ms).
    const t0 = performance.now();
    for (let i = 0; i < 300; i++) frame(5000 + i);
    const ms = (performance.now() - t0) / 300;
    expect(ms).toBeLessThan(3);
    pass.dispose();
  }, 120_000);
});
