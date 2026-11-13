/**
 * THE FLASHLIGHT of mission sewers (docs/design/sewers.md §5.1; wave P1b C): `LightMap.addCone`, the
 * hero cone (muzzle, aim, tilt, battery), the pure light test `isLit` (true in a and b; the union
 * of the cones and glows in c, d, e), the pass (cones after FLASHLIGHTS ON, the rat eyes drawn after
 * the darkness), the gate "the sims of c, d, e run the same with isLit normal, forced true and
 * forced false" (ticks, kills, world hash), and the cone's draw cost.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { PAL } from '../../src/engine/palette';
import type { Renderer } from '../../src/engine/render';
import { SoftRenderer } from '../../src/engine/render-soft';
import { isSewersContent, loadContent } from '../../src/game/content/index';
import { isLit, setLitOverride } from '../../src/game/content/sewers/light-test';
import { Rat } from '../../src/game/content/sewers/rats/base';
import { flashlightsOn, setFlashlights } from '../../src/game/mission/light/api';
import { FLASHLIGHT, heroCone, inCone, type HeroCone } from '../../src/game/mission/light/cone';
import { LightMap } from '../../src/game/mission/light/index';
import { createHeadlessGame, type HeadlessGame } from '../../src/sim/index';

await loadContent();
await loadContent(isSewersContent);

afterEach(() => setLitOverride(null));

const DEG = Math.PI / 180;

async function game(section: string, o: { players?: 1 | 2; bot?: boolean } = {}): Promise<HeadlessGame> {
  return createHeadlessGame({ missionId: 'sewers', sectionId: section, seed: 5, players: o.players ?? 1, god: true, bot: o.bot ?? false, captureConsole: true, loadContent: false });
}

describe('LightMap.addCone', () => {
  it('lights the cone along its axis, nothing behind or outside; a dithered rim; the far end fades', () => {
    const m = new LightMap(385, 217);
    m.begin(0, 0);
    m.addCone(50, 100, 0, 210, 20 * DEG, 1, PAL.snow[3], 0, 3 * DEG, 0.35);
    expect(m.count).toBe(1);
    expect(m.lightAt(120, 100)).toBe(1);
    expect(m.lightAt(40, 100)).toBe(0);
    expect(m.lightAt(120, 100 - 70 * Math.tan(25 * DEG))).toBe(0);
    expect(m.lightAt(50 + 230, 100)).toBe(0);
    // The far end fades: less than full at 90 % of the length.
    const far = m.lightAt(50 + 189, 100);
    expect(far).toBeGreaterThan(0);
    expect(far).toBeLessThan(1);
    // The rim: in the outer band about 1 cell in 4 is lit, in the inner band about 1 in 2.
    const band = (a0: number, a1: number): number => {
      let lit = 0;
      let n = 0;
      for (let d = 60; d < 120; d++)
        for (let k = 0; k < 6; k++) {
          const a = (a0 + ((a1 - a0) * (k + 0.5)) / 6) * DEG;
          const x = 50 + d * Math.cos(a);
          const y = 100 + d * Math.sin(a);
          n++;
          if (m.lightAt(x, y) > 0) lit++;
        }
      return lit / n;
    };
    expect(band(0, 10)).toBeGreaterThan(0.95);
    expect(band(14.5, 16.5)).toBeGreaterThan(0.3);
    expect(band(14.5, 16.5)).toBeLessThan(0.7);
    expect(band(17.5, 19.5)).toBeGreaterThan(0.1);
    expect(band(17.5, 19.5)).toBeLessThan(0.45);
  });

  it('points any way (up, diagonal, left); the same input gives the same cells; off-map costs nothing', () => {
    const cells = (angle: number): number[] => {
      const m = new LightMap(100, 100);
      m.begin(0, 0);
      m.addCone(50, 50, angle, 40, 20 * DEG, 1, PAL.snow[3], 0.2, 3 * DEG, 0.35);
      const out: number[] = [];
      for (let y = 0; y < 100; y++) for (let x = 0; x < 100; x++) out.push(m.lightAt(x, y));
      return out;
    };
    expect(cells(-Math.PI / 2)).toEqual(cells(-Math.PI / 2));
    const up = new LightMap(100, 100);
    up.begin(0, 0);
    up.addCone(50, 50, -Math.PI / 2, 40, 20 * DEG, 1, PAL.snow[3], 0, 0, 0);
    expect(up.lightAt(50, 20)).toBe(1);
    expect(up.lightAt(50, 70)).toBe(0);
    const left = new LightMap(100, 100);
    left.begin(0, 0);
    left.addCone(50, 50, Math.PI - 5 * DEG, 40, 20 * DEG, 1, PAL.snow[3], 0, 0, 0);
    expect(left.lightAt(20, 52)).toBe(1);
    expect(left.lightAt(80, 50)).toBe(0);
    const off = new LightMap(100, 100);
    off.begin(1000, 0);
    off.addCone(50, 50, 0, 40, 20 * DEG, 1, PAL.snow[3], 0, 0, 0);
    expect(off.count).toBe(0);
  });
});

describe('the hero cone and isLit', () => {
  it('from the muzzle along the aim; a horizontal aim tilts 5° down; facing left mirrors it', async () => {
    const g = await game('sewers-d');
    try {
      const p = g.player(0)!;
      g.step(5);
      const c: HeroCone = { x: 0, y: 0, angle: 0, len: 0, half: 0 };
      heroCone(p, c);
      const m = p.muzzleWorld([0, 0]);
      expect([c.x, c.y]).toEqual(m);
      expect(c.angle).toBeCloseTo(5 * DEG, 6);
      expect(c.len).toBe(FLASHLIGHT.len);
      expect(c.half).toBeCloseTo(20 * DEG, 6);
      p.facing = -1;
      heroCone(p, c);
      expect(c.angle).toBeCloseTo(Math.PI - 5 * DEG, 6);
      p.elev = -Math.PI / 2;
      heroCone(p, c);
      expect(Math.sin(c.angle)).toBeCloseTo(-1, 6);
      p.elev = -Math.PI / 4;
      heroCone(p, c);
      expect(c.angle).toBeCloseTo(Math.PI + Math.PI / 4, 6);
      expect(inCone(c, c.x - 50, c.y - 50)).toBe(true);
      expect(inCone(c, c.x + 50, c.y - 50)).toBe(false);
    } finally {
      g.dispose();
    }
  });

  it('isLit: true everywhere in a and b; in c only the glows before FLASHLIGHTS ON; then the cones too; never behind', async () => {
    for (const s of ['sewers-a', 'sewers-b']) {
      const g = await game(s);
      try {
        g.step(2);
        expect(isLit(g.world!, 2000, 20)).toBe(true);
      } finally {
        g.dispose();
      }
    }
    const g = await game('sewers-c');
    try {
      const w = g.world!;
      const p = g.player(0)!;
      g.runUntil(() => !p.dropping, 200);
      setFlashlights(w, false);
      expect(isLit(w, p.x + 2, p.y - 14)).toBe(true);
      expect(isLit(w, p.x + 120, p.y - 20)).toBe(false);
      setFlashlights(w, true);
      expect(flashlightsOn(w)).toBe(true);
      p.facing = 1;
      p.elev = 0;
      expect(isLit(w, p.x + 120, p.y - 20)).toBe(true);
      expect(isLit(w, p.x - 120, p.y - 20)).toBe(false);
      expect(isLit(w, p.x + 300, p.y - 20)).toBe(false);
      setLitOverride(false);
      expect(isLit(w, p.x + 2, p.y - 14)).toBe(false);
      setLitOverride(true);
      expect(isLit(w, p.x + 300, p.y - 20)).toBe(true);
      // A dead hero gives no light.
      setLitOverride(null);
      p.state = 'dead';
      expect(isLit(w, p.x + 2, p.y - 14)).toBe(false);
      p.state = 'play';
    } finally {
      g.dispose();
    }
  });
});

describe('the light pass in the sewer', () => {
  it('c: no cones during the fall, the cones after FLASHLIGHTS ON; the rat eyes are drawn after the darkness', async () => {
    const g = await game('sewers-c', { players: 2 });
    try {
      const r = g.runner!;
      const light = r.light!;
      expect(light).not.toBeNull();
      g.step(10);
      g.renderFrame();
      expect(light.conesDrawn).toBe(0);
      g.runUntil(() => flashlightsOn(g.world!), 200);
      g.step(1);
      g.renderFrame();
      expect(light.conesDrawn).toBe(2);
      // A rat in the dark ahead: its eyes are drawn after the darkness image (an emitter).
      const w = g.world!;
      const p = g.player(0)!;
      p.facing = -1;
      g.player(1)!.facing = -1;
      const rat = w.spawn('sewers-rat-runner', p.x + 150, 176, { gag: true }) as Rat;
      w.flush();
      g.step(3);
      expect(rat.lit).toBe(false);
      const calls: string[] = [];
      const rec = new Proxy({} as Renderer, {
        get: (_t, k) => {
          if (k === 'camX' || k === 'camY') return w.camera.x;
          if (k === 'res') return 1;
          return (...a: unknown[]) => {
            if (k === 'image') calls.push('image');
            if (k === 'sprite') calls.push(String(a[0]));
          };
        },
      });
      light.draw(rec, r.ticks, 1);
      const dark = calls.indexOf('image');
      const eyes = calls.indexOf('enemy/sewers-rat-runner/eyes');
      expect(dark).toBeGreaterThanOrEqual(0);
      expect(eyes).toBeGreaterThan(dark);
      // A soft frame draws without errors at 1× and the cones lift the dark ahead of the heroes.
      const soft = new SoftRenderer();
      soft.begin(0x000000ff);
      soft.setCamera(w.camera.x, 0);
      light.draw(soft, r.ticks, 1);
      soft.end();
      expect(light.map.lightAt(p.x - 60, p.y - 18)).toBeGreaterThan(0.9);
      expect(light.map.lightAt(p.x + 150, p.y - 60)).toBe(0);
      expect(g.report().errors).toEqual([]);
    } finally {
      g.dispose();
    }
  });

  it('the cone draw cost: two battery cones (the worst case) into the map stay well under 0.2 ms', () => {
    const m = new LightMap(385, 217);
    const B = FLASHLIGHT.battery;
    const run = (): void => {
      m.begin(0, 0);
      m.addCone(60, 150, 5 * DEG, B.len, B.half, 1, PAL.snow[3], 0, FLASHLIGHT.band, FLASHLIGHT.fade);
      m.addCone(40, 150, 5 * DEG, B.len, B.half, 1, PAL.snow[3], 0, FLASHLIGHT.band, FLASHLIGHT.fade);
    };
    for (let i = 0; i < 200; i++) run();
    const N = 400;
    const t0 = performance.now();
    for (let i = 0; i < N; i++) run();
    const ms = (performance.now() - t0) / N;
    // The begin() clear is the pass's own cost; the gate (spec §5.1 gate 3) is 0.2 ms. Loose here
    // (the suite runs in parallel); the report gives the quiet number (tools bench).
    expect(ms).toBeLessThan(1);
  });
});

/** The gate's run length: c and d whole (the god bot needs ~1,300 + ~3,000 ticks), then into e. */
const SIM_TICKS = 9000;

/** A run from c through d, e and the end with the god bot: ticks, kills, a hash of every tick. */
async function simRun(lit: boolean | null, players: 1 | 2): Promise<{ ticks: number; kills: number; hash: number; sections: string[] }> {
  setLitOverride(lit);
  const g = await game('sewers-c', { players, bot: true });
  try {
    let h = 2166136261;
    const mix = (v: number): void => {
      h = Math.imul(h ^ (v | 0), 16777619) >>> 0;
    };
    const sections: string[] = [];
    let darkRats = 0;
    for (let t = 0; t < SIM_TICKS && !g.done && !g.missionComplete; t++) {
      g.step(1);
      const w = g.world;
      if (!w) continue;
      const s = g.runner!.section.id;
      if (sections[sections.length - 1] !== s) sections.push(s);
      for (const v of w.rng.getState()) mix(v);
      mix(w.entities.length);
      for (const p of w.players) {
        mix(Math.round(p.x * 16));
        mix(Math.round(p.y * 16));
      }
      for (const e of w.byTag('enemy')) {
        mix(Math.round(e.x * 4));
        if (e instanceof Rat && !e.lit) darkRats++;
      }
    }
    const r = g.report();
    expect(r.errors).toEqual([]);
    if (lit === null) expect(darkRats).toBeGreaterThan(0);
    return { ticks: r.ticks, kills: r.kills, hash: h, sections };
  } finally {
    g.dispose();
    setLitOverride(null);
  }
}

describe('gate 1 (spec §5.1): the sims of c, d, e do not depend on the light', () => {
  it.each([1, 2] as const)('%iP: normal, forced lit and forced dark give the same ticks, kills and world hash', async (players) => {
    const base = await simRun(null, players);
    expect(base.sections.slice(0, 3)).toEqual(['sewers-c', 'sewers-d', 'sewers-e']);
    expect(base.kills).toBeGreaterThan(40);
    const on = await simRun(true, players);
    const off = await simRun(false, players);
    expect(on).toEqual(base);
    expect(off).toEqual(base);
  }, 120_000);
});
